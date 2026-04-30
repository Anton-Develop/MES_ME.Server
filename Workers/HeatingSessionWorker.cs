using System;
using MES_ME.Server.Repositories;

namespace MES_ME.Server.Workers;

/// <summary>
/// Каждые N секунд ищет листы, которые полностью вышли из печи,
/// и записывает агрегированный отчёт в heating_sessions.
/// Работает независимо от API — падение Worker не роняет API и наоборот.
/// </summary>
public sealed class HeatingSessionWorker : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<HeatingSessionWorker> _log;
    private readonly int _intervalSec;
    private readonly int _gracePeriodMin;

    public HeatingSessionWorker(
        IServiceProvider sp,
        IConfiguration cfg,
        ILogger<HeatingSessionWorker> log)
    {
        _sp            = sp;
        _log           = log;
        _intervalSec   = cfg.GetValue("Worker:HeatingSessionIntervalSeconds", 30);
        _gracePeriodMin = cfg.GetValue("Worker:SheetExitGracePeriodMinutes",   2);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _log.LogInformation(
            "HeatingSessionWorker started. Interval={Interval}s GracePeriod={Grace}min",
            _intervalSec, _gracePeriodMin);

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_intervalSec));

        while (await timer.WaitForNextTickAsync(ct))
        {
            try
            {
                await ProcessAsync(ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                // Логируем и продолжаем — Worker не должен падать из-за одной итерации
                _log.LogError(ex, "HeatingSessionWorker iteration failed");
            }
        }

        _log.LogInformation("HeatingSessionWorker stopped");
    }

    private async Task ProcessAsync(CancellationToken ct)
    {
        // Каждая итерация — отдельный scope и соединение с БД
        using var scope = _sp.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IFurnaceRepository>();

        var candidates = (await repo.FindCompletedSheetsAsync(_gracePeriodMin, ct)).ToList();

        if (candidates.Count == 0) return;

        _log.LogInformation("HeatingSessionWorker: processing {Count} completed sheets", candidates.Count);

        foreach (var c in candidates)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                await ProcessSheetAsync(repo, c, ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to process sheet {Sheet}", (int)c.sheet);
            }
        }
    }

    private async Task ProcessSheetAsync(IFurnaceRepository repo, dynamic c, CancellationToken ct)
    {
        DateTime enteredAt = c.entered_at;
        DateTime exitedAt  = c.exited_at;

        var temps = await repo.GetAvgTempsAsync(enteredAt, exitedAt, ct);

        var parameters = new
        {
            Sheet          = (int)c.sheet,
            Slab           = (int?)c.slab,
            Melt           = (int?)c.melt,
            PartNo         = (int?)c.part_no,
            AlloyCode      = (int?)c.alloy_code,
            AlloyCodeText  = (string?)c.alloy_code_text,
            Thickness      = (float?)c.thickness,
            ZonesPath      = (string?)c.zones_path,
            EnteredAt      = enteredAt,
            ExitedAt       = exitedAt,
            TotalMin       = (float)(exitedAt - enteredAt).TotalMinutes,
            F1Min          = (float?)c.f1_min,
            F2Min          = (float?)c.f2_min,
            F3Min          = (float?)c.f3_min,
            F4Min          = (float?)c.f4_min,
            HadAlarm       = (bool)c.had_alarm,
            // Средние температуры — null если данных нет
            AvgZ1_1        = (float?)temps?.avg_z1_1,
            AvgZ1_2        = (float?)temps?.avg_z1_2,
            AvgZ2_1        = (float?)temps?.avg_z2_1,
            AvgZ2_2        = (float?)temps?.avg_z2_2,
            AvgZ3_1        = (float?)temps?.avg_z3_1,
            AvgZ3_2        = (float?)temps?.avg_z3_2,
            AvgZ3_3        = (float?)temps?.avg_z3_3,
            AvgZ3_4        = (float?)temps?.avg_z3_4,
            AvgZ4_1        = (float?)temps?.avg_z4_1,
            AvgZ4_2        = (float?)temps?.avg_z4_2,
            AvgZ4_3        = (float?)temps?.avg_z4_3,
            AvgZ4_4        = (float?)temps?.avg_z4_4,
        };

        await repo.UpsertHeatingSessionAsync(parameters, ct);

        _log.LogInformation(
            "HeatingSession saved: sheet={Sheet} slab={Slab} path={Path} total={Total:N1}min",
            parameters.Sheet, parameters.Slab, parameters.ZonesPath, parameters.TotalMin);
    }
}