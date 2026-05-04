using MES_ME.Server.DTOs;
using MES_ME.Server.Repositories;
using System.Text.Json;

namespace MES_ME.Server.Workers;

public sealed class HeatingSessionWorker : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<HeatingSessionWorker> _log;
    private readonly int _intervalSec;
    private readonly int _gracePeriodMin;
    private readonly int _catchUpDays;

    public HeatingSessionWorker(
        IServiceProvider sp,
        IConfiguration cfg,
        ILogger<HeatingSessionWorker> log)
    {
        _sp = sp;
        _log = log;
        _intervalSec = cfg.GetValue("Worker:HeatingSessionIntervalSeconds", 30);
        _gracePeriodMin = cfg.GetValue("Worker:SheetExitGracePeriodMinutes", 2);
        _catchUpDays = cfg.GetValue("Worker:CatchUpDays", 7);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _log.LogInformation("HeatingSessionWorker started. Interval={Interval}s GracePeriod={Grace}min CatchUpDays={CatchUpDays}",
            _intervalSec, _gracePeriodMin, _catchUpDays);

        // Catch-up при старте
        await CatchUpMissedSessionsAsync(ct);

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
                _log.LogError(ex, "HeatingSessionWorker iteration failed");
            }
        }

        _log.LogInformation("HeatingSessionWorker stopped");
    }

    private async Task CatchUpMissedSessionsAsync(CancellationToken ct)
    {
        _log.LogInformation("Starting catch-up for missed sessions...");

        using var scope = _sp.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IFurnaceRepository>();

        try
        {
            var missedSheets = await repo.FindMissedSheetsAsync(_catchUpDays, ct);
            var list = missedSheets.ToList();

            if (list.Count == 0)
            {
                _log.LogInformation("No missed sessions found during catch-up");
                return;
            }

            _log.LogInformation("Catch-up found {Count} sheets to process", list.Count);

            var processed = 0;
            foreach (var sheet in list)
            {
                ct.ThrowIfCancellationRequested();
                try
                {
                    await ProcessSheetAsync(repo, sheet, ct);
                    processed++;
                    if (processed % 100 == 0)
                        _log.LogInformation("Catch-up progress: {Processed}/{Total}", processed, list.Count);
                }
                catch (Exception ex)
                {
                    _log.LogError(ex, "Failed to process sheet {Sheet}", (int)sheet.sheet);
                }
            }

            _log.LogInformation("Catch-up completed. Processed: {Processed}", processed);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Catch-up failed");
        }
    }

    private async Task ProcessAsync(CancellationToken ct)
    {
        using var scope = _sp.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IFurnaceRepository>();
        var candidates = (await repo.FindCompletedSheetsAsync(_gracePeriodMin, ct)).ToList();

        if (candidates.Count == 0) return;

        _log.LogInformation("Processing {Count} completed sheets", candidates.Count);
        foreach (var c in candidates)
        {
            ct.ThrowIfCancellationRequested();
            await ProcessSheetAsync(repo, c, ct);
        }
    }

    private async Task ProcessSheetAsync(IFurnaceRepository repo, dynamic c, CancellationToken ct)
    {
        object? enteredAtObj = c.entered_at;
        object? exitedAtObj = c.exited_at;

        if (enteredAtObj == null || exitedAtObj == null)
        {
            _log.LogWarning("Missing dates for sheet {Sheet}", (int)c.sheet);
            return;
        }

        if (enteredAtObj is not DateTime enteredAtRaw || exitedAtObj is not DateTime exitedAtRaw)
        {
            _log.LogWarning("Invalid date types for sheet {Sheet}", (int)c.sheet);
            return;
        }

        // После отключения LegacyTimestampBehavior Npgsql возвращает Utc напрямую.
        // Но если Kind всё ещё Unspecified — конвертируем через ToUniversalTime, а не SpecifyKind
        DateTime enteredAt = enteredAtRaw.Kind switch
        {
            DateTimeKind.Utc => enteredAtRaw,
            DateTimeKind.Local => enteredAtRaw.ToUniversalTime(),
            _ => DateTime.SpecifyKind(enteredAtRaw, DateTimeKind.Utc) // Unspecified — считаем что уже UTC
        };

        DateTime exitedAt = exitedAtRaw.Kind switch
        {
            DateTimeKind.Utc => exitedAtRaw,
            DateTimeKind.Local => exitedAtRaw.ToUniversalTime(),
            _ => DateTime.SpecifyKind(exitedAtRaw, DateTimeKind.Utc)
        };

        // Логируем Kind — чтобы видеть что получаем от Npgsql
        _log.LogDebug(
            "Sheet {Sheet} dates: enteredAt={EnteredAt} (Kind={Kind1}) exitedAt={ExitedAt} (Kind={Kind2})",
            (int)c.sheet,
            enteredAt, enteredAtRaw.Kind,
            exitedAt, exitedAtRaw.Kind);

        if (enteredAt >= exitedAt)
        {
            _log.LogWarning("Invalid range sheet {Sheet}", (int)c.sheet);
            return;
        }

        var tempsFrom = enteredAt;
        var tempsTo = exitedAt;

        var tempsRaw = await repo.GetTemperatureArraysAsync(tempsFrom, tempsTo, ct);
        var temps = DownsampleTemps(tempsRaw, 300);


        // Хелпер среднего — игнорирует null
        static float? Avg(List<float?> list)
        {
            if (list == null || list.Count == 0) return null;
            var vals = list.Where(v => v.HasValue).Select(v => v!.Value).ToList();
            return vals.Count > 0 ? vals.Average() : null;
        }

        var parameters = new
        {
            Sheet = ConvertToInt(c.sheet),
            Slab = ConvertToNullableInt(c.slab),
            Melt = ConvertToNullableInt(c.melt),
            PartNo = ConvertToNullableInt(c.part_no),
            Pack = ConvertToNullableInt(c.pack),
            ReheatNum = ConvertToInt(c.reheat_num),
            AlloyCode = ConvertToNullableInt(c.alloy_code),
            AlloyCodeText = ConvertToString(c.alloy_code_text),
            Thickness = ConvertToNullableFloat(c.thickness),
            ZonesPath = ConvertToString(c.zones_path),
            EnteredAt = enteredAt,
            ExitedAt = exitedAt,
            TotalMin = (float)(exitedAt - enteredAt).TotalMinutes,
            F1Min = ConvertToNullableFloat(c.f1_min),
            F2Min = ConvertToNullableFloat(c.f2_min),
            F3Min = ConvertToNullableFloat(c.f3_min),
            F4Min = ConvertToNullableFloat(c.f4_min),
            HadAlarm = ConvertToBool(c.had_alarm),
            // Средние — из полных данных
            AvgZ1_1 = Avg(tempsRaw.Z1_1),
            AvgZ1_2 = Avg(tempsRaw.Z1_2),
            AvgZ1_3 = Avg(tempsRaw.Z1_3), 
            AvgZ1_4 = Avg(tempsRaw.Z1_4),  
            AvgZ2_1 = Avg(tempsRaw.Z2_1),
            AvgZ2_2 = Avg(tempsRaw.Z2_2),
            AvgZ2_3 = Avg(tempsRaw.Z2_3),  
            AvgZ2_4 = Avg(tempsRaw.Z2_4), 
            AvgZ3_1 = Avg(tempsRaw.Z3_1),
            AvgZ3_2 = Avg(tempsRaw.Z3_2),
            AvgZ3_3 = Avg(tempsRaw.Z3_3),
            AvgZ3_4 = Avg(tempsRaw.Z3_4),
            AvgZ4_1 = Avg(tempsRaw.Z4_1),
            AvgZ4_2 = Avg(tempsRaw.Z4_2),
            AvgZ4_3 = Avg(tempsRaw.Z4_3),
            AvgZ4_4 = Avg(tempsRaw.Z4_4),

            // Массивы с заданиями — добавляем ref в каждую зону
            TempsZ1 = JsonSerializer.Serialize(new {
                z1_1     = temps.Z1_1,
                z1_2     = temps.Z1_2,
                z1_3     = temps.Z1_3,
                z1_4     = temps.Z1_4,
                z1_1_ref = temps.Z1_1_Ref  // ← задание зоны 1
            }),
            TempsZ2 = JsonSerializer.Serialize(new {
                z2_1     = temps.Z2_1,
                z2_2     = temps.Z2_2,
                z2_3     = temps.Z2_3,
                z2_4     = temps.Z2_4,
                z2_1_ref = temps.Z2_1_Ref  // ← задание зоны 2
            }),
            TempsZ3 = JsonSerializer.Serialize(new {
                z3_1     = temps.Z3_1,
                z3_2     = temps.Z3_2,
                z3_3     = temps.Z3_3,
                z3_4     = temps.Z3_4,
                z3_1_ref = temps.Z3_1_Ref  // ← задание зоны 3
            }),
            TempsZ4 = JsonSerializer.Serialize(new {
                z4_1     = temps.Z4_1,
                z4_2     = temps.Z4_2,
                z4_3     = temps.Z4_3,
                z4_4     = temps.Z4_4,
                z4_1_ref = temps.Z4_1_Ref  // ← задание зоны 4
            }),
            TempsTime = JsonSerializer.Serialize(temps.Times),
                
        };

        await repo.UpsertHeatingSessionAsync(parameters, ct);

        
    }


    // Вспомогательные методы для безопасного преобразования
    private int ConvertToInt(object? value)
    {
        if (value == null) return 0;
        try
        {
            return Convert.ToInt32(value);
        }
        catch
        {
            return 0;
        }
    }

    private int? ConvertToNullableInt(object? value)
    {
        if (value == null) return null;
        try
        {
            return Convert.ToInt32(value);
        }
        catch
        {
            return null;
        }
    }

    private float? ConvertToNullableFloat(object? value)
    {
        if (value == null) return null;
        try
        {
            return Convert.ToSingle(value);
        }
        catch
        {
            return null;
        }
    }

    private string? ConvertToString(object? value)
    {
        if (value == null) return null;
        return value.ToString();
    }

    private bool ConvertToBool(object? value)
    {
        if (value == null) return false;
        try
        {
            return Convert.ToBoolean(value);
        }
        catch
        {
            return false;
        }
    }
    private TemperatureArraysDto DownsampleTemps(TemperatureArraysDto src, int targetPoints = 300)
    {
        int count = src.Times.Count;
        if (count <= targetPoints) return src;  // и так мало — не трогаем

        // Берём каждый N-й элемент
        int step = (int)Math.Ceiling((double)count / targetPoints);

        var indices = Enumerable.Range(0, count)
            .Where(i => i % step == 0)
            .ToList();

        List<float?> Pick(List<float?> list) =>
            indices.Select(i => i < list.Count ? list[i] : null).ToList();

        return new TemperatureArraysDto
        {
            Times    = indices.Select(i => src.Times[i]).ToList(),
            Z1_1     = Pick(src.Z1_1),
            Z1_2     = Pick(src.Z1_2),
            Z1_3     = Pick(src.Z1_3),
            Z1_4     = Pick(src.Z1_4),
            Z2_1     = Pick(src.Z2_1),
            Z2_2     = Pick(src.Z2_2),
            Z2_3     = Pick(src.Z2_3),
            Z2_4     = Pick(src.Z2_4),
            Z3_1     = Pick(src.Z3_1),
            Z3_2     = Pick(src.Z3_2),
            Z3_3     = Pick(src.Z3_3),
            Z3_4     = Pick(src.Z3_4),
            Z4_1     = Pick(src.Z4_1),
            Z4_2     = Pick(src.Z4_2),
            Z4_3     = Pick(src.Z4_3),
            Z4_4     = Pick(src.Z4_4),
            // Задания тоже даунсемплируем
            Z1_1_Ref = Pick(src.Z1_1_Ref),
            Z2_1_Ref = Pick(src.Z2_1_Ref),
            Z3_1_Ref = Pick(src.Z3_1_Ref),
            Z4_1_Ref = Pick(src.Z4_1_Ref),
        };
    }


}