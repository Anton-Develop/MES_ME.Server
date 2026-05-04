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

        static float? Avg(List<float?> list) => list?.Where(v => v.HasValue).Select(v => v!.Value).ToList() is var vals && vals.Count > 0 ? vals.Average() : null;

        float? avgZ1_1 = null, avgZ1_2 = null, avgZ1_3 = null, avgZ1_4 = null;
        float? avgZ2_1 = null, avgZ2_2 = null, avgZ2_3 = null, avgZ2_4 = null;
        float? avgZ3_1 = null, avgZ3_2 = null, avgZ3_3 = null, avgZ3_4 = null;
        float? avgZ4_1 = null, avgZ4_2 = null, avgZ4_3 = null, avgZ4_4 = null;
        string? tempsZ1 = null, tempsZ2 = null, tempsZ3 = null, tempsZ4 = null;

        // Обработка зоны F1
        DateTime? enteredF1 = null, exitedF1 = null;
        try
        {
            var e1 = c.entered_at_f1;
            var x1 = c.exited_at_f1;
            if (e1 is DateTime dt1 && x1 is DateTime dt2)
            {
                enteredF1 = dt1;
                exitedF1 = dt2;
            }
        }
        catch { /* не было в зоне */ }

        if (enteredF1.HasValue && exitedF1.HasValue && enteredF1.Value < exitedF1.Value)
        {
            var from = ToUtc(enteredF1.Value);
            var to = ToUtc(exitedF1.Value);
            var raw = await repo.GetTemperatureArraysAsync(from, to, ct);
            avgZ1_1 = Avg(raw.Z1_1);
            avgZ1_2 = Avg(raw.Z1_2);
            avgZ1_3 = Avg(raw.Z1_3);
            avgZ1_4 = Avg(raw.Z1_4);
            var down = DownsampleTemps(raw, 300);
            var jsonObj = new { times = down.Times.Select(t => t.ToString("o")).ToList(), z1_1 = down.Z1_1, z1_2 = down.Z1_2, z1_3 = down.Z1_3, z1_4 = down.Z1_4, z1_1_ref = down.Z1_1_Ref };
            tempsZ1 = JsonSerializer.Serialize(jsonObj);
        }



        // Зона F2
        DateTime? enteredF2 = null, exitedF2 = null;
        try
        {
            var e1 = c.entered_at_f2;
            var x1 = c.exited_at_f2;
            if (e1 is DateTime dt1 && x1 is DateTime dt2)
            {
                enteredF2 = dt1;
                exitedF2 = dt2;
            }
        }
        catch { /* не было в зоне */ }

        if (enteredF2.HasValue && exitedF2.HasValue && enteredF2.Value < exitedF2.Value)
        {
            var from = ToUtc(enteredF2.Value);
            var to = ToUtc(exitedF2.Value);
            var raw = await repo.GetTemperatureArraysAsync(from, to, ct);
            avgZ2_1 = Avg(raw.Z2_1);
            avgZ2_2 = Avg(raw.Z2_2);
            avgZ2_3 = Avg(raw.Z2_3);
            avgZ2_4 = Avg(raw.Z2_4);
            var down = DownsampleTemps(raw, 300);
            var jsonObj = new { times = down.Times.Select(t => t.ToString("o")).ToList(), z2_1 = down.Z2_1, z2_2 = down.Z2_2, z2_3 = down.Z2_3, z2_4 = down.Z2_4, z2_1_ref = down.Z2_1_Ref };
            tempsZ2 = JsonSerializer.Serialize(jsonObj);
        }

        // Зона F3
        DateTime? enteredF3 = null, exitedF3 = null;
        try
        {
            var e1 = c.entered_at_f3;
            var x1 = c.exited_at_f3;
            if (e1 is DateTime dt1 && x1 is DateTime dt2)
            {
                enteredF3 = dt1;
                exitedF3 = dt2;
            }
        }
        catch { /* не было в зоне */ }

        if (enteredF3.HasValue && exitedF3.HasValue && enteredF3.Value < exitedF3.Value)
        {
            var from = ToUtc(enteredF3.Value);
            var to = ToUtc(exitedF3.Value);
            var raw = await repo.GetTemperatureArraysAsync(from, to, ct);
            avgZ3_1 = Avg(raw.Z3_1);
            avgZ3_2 = Avg(raw.Z3_2);
            avgZ3_3 = Avg(raw.Z3_3);
            avgZ3_4 = Avg(raw.Z3_4);
            var down = DownsampleTemps(raw, 300);
            var jsonObj = new { times = down.Times.Select(t => t.ToString("o")).ToList(), Z3_1 = down.Z3_1, Z3_2 = down.Z3_2, Z3_3 = down.Z3_3, Z3_4 = down.Z3_4, Z3_1_ref = down.Z3_1_Ref };
            tempsZ3 = JsonSerializer.Serialize(jsonObj);
        }

        // Зона F4
        DateTime? enteredF4 = null, exitedF4 = null;
        try
        {
            var e1 = c.entered_at_f4;
            var x1 = c.exited_at_f4;
            if (e1 is DateTime dt1 && x1 is DateTime dt2)
            {
                enteredF4 = dt1;
                exitedF4 = dt2;
            }
        }
        catch { /* не было в зоне */ }

        if (enteredF4.HasValue && exitedF4.HasValue && enteredF4.Value < exitedF4.Value)
        {
            var from = ToUtc(enteredF4.Value);
            var to = ToUtc(exitedF4.Value);
            var raw = await repo.GetTemperatureArraysAsync(from, to, ct);
            avgZ4_1 = Avg(raw.Z4_1);
            avgZ4_2 = Avg(raw.Z4_2);
            avgZ4_3 = Avg(raw.Z4_3);
            avgZ4_4 = Avg(raw.Z4_4);
            var down = DownsampleTemps(raw, 300);
            var jsonObj = new { times = down.Times.Select(t => t.ToString("o")).ToList(), Z4_1 = down.Z4_1, Z4_2 = down.Z4_2, Z4_3 = down.Z4_3, Z4_4 = down.Z4_4, Z4_1_ref = down.Z4_1_Ref };
            tempsZ4 = JsonSerializer.Serialize(jsonObj);
        }

        // Формирование parameters и вызов UpsertHeatingSession (как раньше, но с новыми avg и temps)
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
            EnteredAt = ToUtc(enteredAtRaw),
            ExitedAt = ToUtc(exitedAtRaw),
            TotalMin = (float)(exitedAtRaw - enteredAtRaw).TotalMinutes,
            F1Min = ConvertToNullableFloat(c.f1_min),
            F2Min = ConvertToNullableFloat(c.f2_min),
            F3Min = ConvertToNullableFloat(c.f3_min),
            F4Min = ConvertToNullableFloat(c.f4_min),
            HadAlarm = ConvertToBool(c.had_alarm),
            AvgZ1_1 = avgZ1_1,
            AvgZ1_2 = avgZ1_2,
            AvgZ1_3 = avgZ1_3,
            AvgZ1_4 = avgZ1_4,
            AvgZ2_1 = avgZ2_1,
            AvgZ2_2 = avgZ2_2,
            AvgZ2_3 = avgZ2_3,
            AvgZ2_4 = avgZ2_4,
            AvgZ3_1 = avgZ3_1,
            AvgZ3_2 = avgZ3_2,
            AvgZ3_3 = avgZ3_3,
            AvgZ3_4 = avgZ3_4,
            AvgZ4_1 = avgZ4_1,
            AvgZ4_2 = avgZ4_2,
            AvgZ4_3 = avgZ4_3,
            AvgZ4_4 = avgZ4_4,
            TempsZ1 = tempsZ1,
            TempsZ2 = tempsZ2,
            TempsZ3 = tempsZ3,
            TempsZ4 = tempsZ4,
            TempsTime = "[]" // или null – в данном варианте временные метки хранятся внутри каждого tempsZx, поэтому общее поле можно не заполнять
        };
        await repo.UpsertHeatingSessionAsync(parameters, ct);

    }
    // Вспомогательные методы
    private DateTime? GetNullableDateTime(object? value)
    {
        _log.LogDebug("GetNullableDateTime input: {Value} ({Type})", value, value?.GetType());
        if (value == null || value == DBNull.Value) return null;
        if (value is DateTime dt) return dt;
        _log.LogWarning("Unexpected type: {Type}", value.GetType());
        return null;
    }

    private DateTime? ConvertToNullableDateTime(object? value)
    {
        if (value == null) return null;
        if (value is DateTime dt) return dt;
        return null;
    }

    private DateTime ToUtc(DateTime dt) => dt.Kind switch
    {
        DateTimeKind.Utc => dt,
        DateTimeKind.Local => dt.ToUniversalTime(),
        _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
    };

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