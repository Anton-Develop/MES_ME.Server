using Dapper;
using Npgsql;
using System.Data;

namespace MES_ME.Server.Workers;

public sealed class TemperingSessionWorker : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<TemperingSessionWorker> _log;
    private readonly int _intervalMinutes;
    private readonly int _gracePeriodMinutes;
    private readonly int _catchUpDays;

    public TemperingSessionWorker(IServiceProvider sp, IConfiguration cfg, ILogger<TemperingSessionWorker> log)
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

        // Catch-up при старте
        await CatchUpMissedSessionsAsync(ct);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(_intervalMinutes));
        while (await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                await ProcessNewSessionsAsync(ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "TemperingSessionWorker iteration failed");
            }
        }
    }

    private async Task CatchUpMissedSessionsAsync(CancellationToken ct)
    {
        _log.LogInformation("Catch-up: looking for missing sessions in last {Days} days", _catchUpDays);
        await using var scope = _sp.CreateAsyncScope();
        await using var con = await scope.ServiceProvider
            .GetRequiredService<NpgsqlDataSource>()
            .OpenConnectionAsync(ct);

        const string catchUpSql = @"
            WITH raw AS (
                SELECT
                    time, furnace_no, proc_run, proc_end, proc_fault,
                    temp_act, temp_ref, point_ref_1, point_time_1, point_dtime_2, time_proc_set,
                    cassette_no, cass_day, cass_month, cass_year, cass_hour,
                    cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
                    cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour,
                    LAG(proc_run) OVER (PARTITION BY furnace_no ORDER BY time) AS prev_run
                FROM plc.tempering_data
                WHERE time > NOW() - (@CatchUpDays || ' days')::INTERVAL
                  AND (proc_run = TRUE OR proc_end = TRUE)
            ),
            with_session AS (
                SELECT *,
                    SUM(CASE WHEN proc_run = TRUE AND (prev_run IS NULL OR prev_run = FALSE) THEN 1 ELSE 0 END)
                        OVER (PARTITION BY furnace_no ORDER BY time ROWS UNBOUNDED PRECEDING) AS sid
                FROM raw
            ),
            agg AS (
                SELECT
                    furnace_no, sid,
                    MIN(time) AS started_at,
                    MAX(CASE WHEN proc_end = TRUE THEN time END) AS ended_at,
                    EXTRACT(EPOCH FROM (MAX(CASE WHEN proc_end = TRUE THEN time END) - MIN(time)))/60 AS duration_min,
                    MIN(temp_act) AS temp_min, MAX(temp_act) AS temp_max, AVG(temp_act) AS temp_avg,
                    MAX(temp_ref) AS temp_ref,
                    MAX(point_ref_1) AS target_temp, MAX(time_proc_set) AS target_time,
                    MAX(point_ref_1) AS point_ref_1, MAX(point_time_1) AS point_time_1, MAX(point_dtime_2) AS point_dtime_2,
                    BOOL_OR(proc_fault) AS had_fault,
                    MAX(cassette_no) AS cassette_no, MAX(cass_day) AS cass_day, MAX(cass_month) AS cass_month,
                    MAX(cass_year) AS cass_year, MAX(cass_hour) AS cass_hour,
                    MAX(cass1_no) AS cass1_no, MAX(cass1_day) AS cass1_day, MAX(cass1_month) AS cass1_month,
                    MAX(cass1_year) AS cass1_year, MAX(cass1_hour) AS cass1_hour,
                    MAX(cass2_no) AS cass2_no, MAX(cass2_day) AS cass2_day, MAX(cass2_month) AS cass2_month,
                    MAX(cass2_year) AS cass2_year, MAX(cass2_hour) AS cass2_hour
                FROM with_session
                GROUP BY furnace_no, sid
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
            WHERE ended_at IS NOT NULL
              AND ended_at < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
              AND NOT EXISTS (
                  SELECT 1 FROM plc.tempering_sessions ts
                  WHERE ts.furnace_no = agg.furnace_no AND ts.started_at = agg.started_at
              )
        ";

        var inserted = await con.ExecuteAsync(new CommandDefinition(catchUpSql, new
        {
            CatchUpDays = _catchUpDays,
            GracePeriodMinutes = _gracePeriodMinutes
        }, commandTimeout: 300, cancellationToken: ct));

        _log.LogInformation("Catch-up completed. Inserted {Count} missing sessions", inserted);
    }

    private async Task ProcessNewSessionsAsync(CancellationToken ct)
{
    await using var scope = _sp.CreateAsyncScope();
    await using var con = await scope.ServiceProvider
        .GetRequiredService<NpgsqlDataSource>()
        .OpenConnectionAsync(ct);

    const string sql = @"
        WITH raw AS (
            SELECT
                time, furnace_no, proc_run, proc_end, proc_fault,
                temp_act, temp_ref, point_ref_1, point_time_1, point_dtime_2, time_proc_set,
                cassette_no, cass_day, cass_month, cass_year, cass_hour,
                cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
                cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour,
                LAG(proc_run) OVER (PARTITION BY furnace_no ORDER BY time) AS prev_run
            FROM plc.tempering_data
            WHERE time > NOW() - INTERVAL '1 day'
              AND (proc_run = TRUE OR proc_end = TRUE)
        ),
        with_session AS (
            SELECT *,
                SUM(CASE WHEN proc_run = TRUE AND (prev_run IS NULL OR prev_run = FALSE) THEN 1 ELSE 0 END)
                    OVER (PARTITION BY furnace_no ORDER BY time ROWS UNBOUNDED PRECEDING) AS sid
            FROM raw
        ),
        agg AS (
            SELECT
                furnace_no, sid,
                MIN(time) AS started_at,
                MAX(CASE WHEN proc_end = TRUE THEN time END) AS ended_at,
                EXTRACT(EPOCH FROM (MAX(CASE WHEN proc_end = TRUE THEN time END) - MIN(time)))/60 AS duration_min,
                MIN(temp_act) AS temp_min, MAX(temp_act) AS temp_max, AVG(temp_act) AS temp_avg,
                MAX(temp_ref) AS temp_ref,
                MAX(point_ref_1) AS target_temp, MAX(time_proc_set) AS target_time,
                MAX(point_ref_1) AS point_ref_1, MAX(point_time_1) AS point_time_1, MAX(point_dtime_2) AS point_dtime_2,
                BOOL_OR(proc_fault) AS had_fault,
                MAX(cassette_no) AS cassette_no,
                MAX(cass_day) AS cass_day, MAX(cass_month) AS cass_month, MAX(cass_year) AS cass_year, MAX(cass_hour) AS cass_hour,
                MAX(cass1_no) AS cass1_no, MAX(cass1_day) AS cass1_day, MAX(cass1_month) AS cass1_month,
                MAX(cass1_year) AS cass1_year, MAX(cass1_hour) AS cass1_hour,
                MAX(cass2_no) AS cass2_no, MAX(cass2_day) AS cass2_day, MAX(cass2_month) AS cass2_month,
                MAX(cass2_year) AS cass2_year, MAX(cass2_hour) AS cass2_hour
            FROM with_session
            GROUP BY furnace_no, sid
        )
        INSERT INTO plc.tempering_sessions (
            furnace_no, started_at, ended_at, duration_min,
            temp_min, temp_max, temp_avg, temp_ref,
            target_temp, target_time,
            point_ref_1, point_time_1, point_dtime_2,
            had_fault,
            cassette_no, cass_day, cass_month, cass_year, cass_hour,
            cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
            cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
        )
        SELECT
            furnace_no, started_at, ended_at, duration_min,
            temp_min, temp_max, temp_avg, temp_ref,
            target_temp, target_time,
            point_ref_1, point_time_1, point_dtime_2,
            had_fault,
            cassette_no, cass_day, cass_month, cass_year, cass_hour,
            cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
            cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
        FROM agg
        WHERE ended_at IS NOT NULL
          AND ended_at < NOW() - (@GracePeriodMinutes || ' minutes')::INTERVAL
          AND NOT EXISTS (
              SELECT 1 FROM plc.tempering_sessions ts
              WHERE ts.furnace_no = agg.furnace_no AND ts.started_at = agg.started_at
          )
    ";

    var cmd = new CommandDefinition(
        commandText: sql,
        parameters: new { GracePeriodMinutes = _gracePeriodMinutes },
        commandTimeout: 120,
        cancellationToken: ct
    );

    var inserted = await con.ExecuteAsync(cmd);
    if (inserted > 0)
        _log.LogInformation("Processed {Count} new tempering sessions", inserted);
}
}