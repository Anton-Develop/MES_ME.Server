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
WITH raw AS (
    SELECT
        furnace_no, time,
        temp_act, temp_ref, point_ref_1, point_time_1, point_dtime_2, time_proc_set,
        proc_fault,
        cassette_no, cass_day, cass_month, cass_year, cass_hour,
        cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
        cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour,
        return_cassette_cmd,
        proc_end,
        CASE
            WHEN furnace_no IN (1,2) AND cassette_no IS NOT NULL
                THEN CONCAT(furnace_no, '|', cassette_no, '|', cass_day, '|', cass_month, '|', cass_year, '|', cass_hour)
            WHEN furnace_no = 3 AND cass1_no IS NOT NULL
                THEN CONCAT(furnace_no, '|', cass1_no, '|', cass1_day, '|', cass1_month, '|', cass1_year, '|', cass1_hour)
            WHEN furnace_no = 4 AND cass2_no IS NOT NULL
                THEN CONCAT(furnace_no, '|', cass2_no, '|', cass2_day, '|', cass2_month, '|', cass2_year, '|', cass2_hour)
            ELSE NULL
        END AS session_key
    FROM plc.tempering_data
    WHERE time > NOW() - (@LookbackDays || ' days')::INTERVAL
      AND temp_act IS NOT NULL
      AND (
          (furnace_no IN (1,2) AND cassette_no IS NOT NULL) OR
          (furnace_no = 3 AND cass1_no IS NOT NULL) OR
          (furnace_no = 4 AND cass2_no IS NOT NULL)
      )
),
-- Добавляем время выдачи для каждой группы
with_eject AS (
    SELECT *,
        MIN(CASE WHEN return_cassette_cmd = TRUE OR proc_end = TRUE THEN time END) 
            OVER (PARTITION BY session_key) AS eject_time
    FROM raw
),
-- Оставляем только строки до выдачи (или все, если выдачи не было)
filtered AS (
    SELECT * FROM with_eject
    WHERE eject_time IS NULL OR time <= eject_time
),
-- Агрегируем уже отфильтрованные данные
agg AS (
    SELECT
        furnace_no, session_key,
        MIN(time) AS started_at,
        MAX(time) AS ended_at,   -- теперь MAX(time) не будет включать точки после выдачи
        EXTRACT(EPOCH FROM (MAX(time) - MIN(time))) / 60 AS duration_min,
        COUNT(*) AS points_count,
        MIN(temp_act) AS temp_min,
        MAX(temp_act) AS temp_max,
        AVG(temp_act) AS temp_avg,
        MAX(temp_ref) AS temp_ref,
        MAX(point_ref_1) AS target_temp,
        MAX(time_proc_set) AS target_time,
        BOOL_OR(proc_fault) AS had_fault,
		  MAX(point_ref_1) AS point_ref_1,
  MAX(point_time_1) AS point_time_1,
  MAX(point_dtime_2) AS point_dtime_2,
        MAX(cassette_no) AS cassette_no,
        MAX(cass_day) AS cass_day, MAX(cass_month) AS cass_month,
        MAX(cass_year) AS cass_year, MAX(cass_hour) AS cass_hour,
        MAX(cass1_no) AS cass1_no, MAX(cass1_day) AS cass1_day,
        MAX(cass1_month) AS cass1_month, MAX(cass1_year) AS cass1_year,
        MAX(cass1_hour) AS cass1_hour,
        MAX(cass2_no) AS cass2_no, MAX(cass2_day) AS cass2_day,
        MAX(cass2_month) AS cass2_month, MAX(cass2_year) AS cass2_year,
        MAX(cass2_hour) AS cass2_hour
    FROM filtered
    WHERE session_key IS NOT NULL
    GROUP BY furnace_no, session_key
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
FROM agg
WHERE duration_min >= 30
  AND ended_at < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
  AND NOT EXISTS (
      SELECT 1 FROM plc.tempering_sessions ts
      WHERE ts.furnace_no = agg.furnace_no
        AND ts.started_at = agg.started_at
  )
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