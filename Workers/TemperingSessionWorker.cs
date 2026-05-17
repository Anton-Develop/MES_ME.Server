using Dapper;
using Npgsql;

namespace MES_ME.Server.Workers;

public sealed class TemperingSessionWorker : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<TemperingSessionWorker> _log;
    private readonly int _intervalMinutes;
    private readonly int _gracePeriodMinutes;
    private readonly int _catchUpDays;

    public TemperingSessionWorker(
        IServiceProvider sp,
        IConfiguration cfg,
        ILogger<TemperingSessionWorker> log)
    {
        _sp = sp;
        _log = log;
        _intervalMinutes = cfg.GetValue("Worker:TemperingSessionIntervalMinutes", 2);
        _gracePeriodMinutes = cfg.GetValue("Worker:TemperingGracePeriodMinutes", 2);
        _catchUpDays = cfg.GetValue("Worker:TemperingCatchUpDays", 7);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _log.LogInformation("TemperingSessionWorker started. Interval={Interval}min Grace={Grace}min CatchUpDays={CatchUp}",
            _intervalMinutes, _gracePeriodMinutes, _catchUpDays);

        // Catch-up: полный период (например, 7 дней)
        await RunAsync(_catchUpDays, ct);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(_intervalMinutes));
        while (await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                // Регулярный режим: смотрим только последние сутки
                await RunAsync(1, ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "TemperingSessionWorker iteration failed");
            }
        }
    }

    private async Task RunAsync(int lookbackDays, CancellationToken ct)
    {
        await using var scope = _sp.CreateAsyncScope();
        await using var con = await scope.ServiceProvider
            .GetRequiredService<NpgsqlDataSource>()
            .OpenConnectionAsync(ct);

        const string sql = @"
WITH params AS (
    SELECT
        35.0 AS start_threshold,
        35.0 AS end_threshold,
        30   AS min_duration_min,
        (@GracePeriodMinutes || ' minutes')::INTERVAL AS grace_interval
),
temp_data AS (
    SELECT
        furnace_no, time, temp_act, temp_ref,
        point_ref_1, point_time_1, point_dtime_2, time_proc_set, proc_fault,
        cassette_no, cass_day, cass_month, cass_year, cass_hour,
        cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
        cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
    FROM plc.tempering_data
    WHERE time > NOW() - (@LookbackDays || ' days')::INTERVAL
      AND temp_act IS NOT NULL
      AND furnace_no IN (1,2,3,4)   -- если у вас только 4 печи
),
state_raw AS (
    SELECT *,
        CASE
            WHEN temp_act > (SELECT start_threshold FROM params) THEN 1
            WHEN temp_act < (SELECT end_threshold   FROM params) THEN 0
            ELSE NULL
        END AS raw_state
    FROM temp_data
),
state_filled AS MATERIALIZED (
    SELECT *,
        COALESCE(
            raw_state,
            FIRST_VALUE(raw_state) OVER (
                PARTITION BY furnace_no, state_group
                ORDER BY time
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            )
        ) AS state
    FROM (
        SELECT *,
            COUNT(raw_state) OVER (
                PARTITION BY furnace_no
                ORDER BY time
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS state_group
        FROM state_raw
    ) sub
),
transitions AS (
    SELECT *,
        CASE WHEN state = 1
              AND LAG(state, 1, 0) OVER (PARTITION BY furnace_no ORDER BY time) = 0
             THEN 1 ELSE 0
        END AS session_start
    FROM state_filled
),
session_ids AS MATERIALIZED (
    SELECT *,
        SUM(session_start) OVER (
            PARTITION BY furnace_no
            ORDER BY time
            ROWS UNBOUNDED PRECEDING
        ) AS session_id
    FROM transitions
),
session_bounds AS (
    SELECT
        furnace_no, session_id,
        MIN(time) AS started_at,
        MAX(time) AS last_active_at
    FROM session_ids
    WHERE state = 1 AND session_id > 0
    GROUP BY furnace_no, session_id
),
session_end_times AS (
    SELECT DISTINCT ON (si.furnace_no, si.session_id)
        si.furnace_no,
        si.session_id,
        si.time AS ended_at
    FROM session_ids si
    JOIN session_bounds sb USING (furnace_no, session_id)
    WHERE si.state = 0
      AND si.time > sb.last_active_at
    ORDER BY si.furnace_no, si.session_id, si.time
),
session_with_end AS (
    SELECT
        sb.*,
        COALESCE(et.ended_at, sb.last_active_at) AS ended_at
    FROM session_bounds sb
    LEFT JOIN session_end_times et USING (furnace_no, session_id)
),
agg AS (
    SELECT
        si.furnace_no,
        si.session_id,
        sw.started_at,
        sw.ended_at,
        EXTRACT(EPOCH FROM (sw.ended_at - sw.started_at)) / 60 AS duration_min,
        MIN(si.temp_act)       AS temp_min,
        MAX(si.temp_act)       AS temp_max,
        AVG(si.temp_act)       AS temp_avg,
        MAX(si.temp_ref)       AS temp_ref,
        MAX(si.point_ref_1)    AS target_temp,
        MAX(si.time_proc_set)  AS target_time,
        BOOL_OR(si.proc_fault) AS had_fault,
        MAX(si.point_ref_1)    AS point_ref_1,
        MAX(si.point_time_1)   AS point_time_1,
        MAX(si.point_dtime_2)  AS point_dtime_2,
        (ARRAY_REMOVE(ARRAY_AGG(si.cassette_no ORDER BY si.time DESC), 0))[1] AS cassette_no,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass_day    ORDER BY si.time DESC), 0))[1] AS cass_day,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass_month  ORDER BY si.time DESC), 0))[1] AS cass_month,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass_year   ORDER BY si.time DESC), 0))[1] AS cass_year,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass_hour   ORDER BY si.time DESC), 0))[1] AS cass_hour,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass1_no    ORDER BY si.time DESC), 0))[1] AS cass1_no,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass1_day   ORDER BY si.time DESC), 0))[1] AS cass1_day,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass1_month ORDER BY si.time DESC), 0))[1] AS cass1_month,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass1_year  ORDER BY si.time DESC), 0))[1] AS cass1_year,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass1_hour  ORDER BY si.time DESC), 0))[1] AS cass1_hour,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass2_no    ORDER BY si.time DESC), 0))[1] AS cass2_no,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass2_day   ORDER BY si.time DESC), 0))[1] AS cass2_day,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass2_month ORDER BY si.time DESC), 0))[1] AS cass2_month,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass2_year  ORDER BY si.time DESC), 0))[1] AS cass2_year,
        (ARRAY_REMOVE(ARRAY_AGG(si.cass2_hour  ORDER BY si.time DESC), 0))[1] AS cass2_hour
    FROM session_ids si
    JOIN session_with_end sw USING (furnace_no, session_id)
    WHERE si.state = 1 AND si.session_id > 0
    GROUP BY si.furnace_no, si.session_id, sw.started_at, sw.ended_at
)
INSERT INTO plc.tempering_sessions (
    furnace_no, started_at, ended_at, duration_min,
    temp_min, temp_max, temp_avg, temp_ref,
    target_temp, target_time, point_ref_1, point_time_1, point_dtime_2,
    had_fault,
    cassette_no, cass_day, cass_month, cass_year, cass_hour,
    cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
    cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
)
SELECT
    furnace_no, started_at, ended_at, duration_min,
    temp_min, temp_max, temp_avg, temp_ref,
    target_temp, target_time, point_ref_1, point_time_1, point_dtime_2,
    had_fault,
    cassette_no, cass_day, cass_month, cass_year, cass_hour,
    cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
    cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
FROM agg, params
WHERE duration_min >= params.min_duration_min
  
  AND NOT EXISTS (
      SELECT 1 FROM plc.tempering_sessions ts
      WHERE ts.furnace_no = agg.furnace_no
        AND ts.started_at = agg.started_at
  );
        ";

        var inserted = await con.ExecuteAsync(new CommandDefinition(
            sql,
            new { LookbackDays = lookbackDays, GracePeriodMinutes = _gracePeriodMinutes },
            commandTimeout: 300,
            cancellationToken: ct));

        if (inserted > 0)
            _log.LogInformation("TemperingSessionWorker: inserted {Count} sessions (lookback={Days}d)", inserted, lookbackDays);
    }
}