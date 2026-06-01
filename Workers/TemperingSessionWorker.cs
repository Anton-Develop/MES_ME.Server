using MES_ME.Server.Repositories;

namespace MES_ME.Server.Workers;

public sealed class TemperingSessionWorker : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<TemperingSessionWorker> _log;
    private readonly int _intervalMinutes;
    private readonly int _gracePeriodMinutes;
    private readonly int _catchUpDays;
    private readonly int _regularLookbackDays;

    public TemperingSessionWorker(
        IServiceProvider sp,
        IConfiguration cfg,
        ILogger<TemperingSessionWorker> log)
    {
        _sp = sp;
        _log = log;
        _intervalMinutes      = cfg.GetValue("Worker:TemperingSessionIntervalMinutes", 2);
        _gracePeriodMinutes   = cfg.GetValue("Worker:TemperingGracePeriodMinutes", 2);
        _catchUpDays          = cfg.GetValue("Worker:TemperingCatchUpDays", 7);
        // 2 дня в регулярном режиме перекрывают любые разумные пропуски (до ~48 часов)
        _regularLookbackDays  = cfg.GetValue("Worker:TemperingRegularLookbackDays", 2);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _log.LogInformation(
            "TemperingSessionWorker started. Interval={Interval}min Grace={Grace}min CatchUp={CatchUp}d RegularLookback={Regular}d",
            _intervalMinutes, _gracePeriodMinutes, _catchUpDays, _regularLookbackDays);

        // Catch-up: один раз при старте смотрим весь период (например, 7 дней)
        await RunAsync(_catchUpDays, ct);

        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(_intervalMinutes));
        while (await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                await RunAsync(_regularLookbackDays, ct);
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
        var repo = scope.ServiceProvider.GetRequiredService<ITemperingRepository>();

        try
        {
            var inserted = await repo.UpsertSessionsAsync(lookbackDays, _gracePeriodMinutes, ct);

            if (inserted > 0)
                _log.LogInformation(
                    "TemperingSessionWorker: inserted {Count} sessions (lookback={Days}d)",
                    inserted, lookbackDays);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "TemperingSessionWorker: UpsertSessionsAsync failed for lookback={Days}d", lookbackDays);
            throw; // Пробрасываем выше, чтобы поймать в ExecuteAsync
        }
    }
}