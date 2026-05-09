using MES_ME.Server.DTOs;
using MES_ME.Server.Repositories;
using System.Text;
using System.Text.Json;

namespace MES_ME.Server.Workers;

public sealed class QuenchingSessionWorker : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<QuenchingSessionWorker> _log;
    private readonly int _intervalSec;
    private readonly int _gracePeriodMin;
    private readonly int _catchUpDays;
    private readonly int _dataMarginSec;


    public QuenchingSessionWorker(
        IServiceProvider sp,
        IConfiguration cfg,
        ILogger<QuenchingSessionWorker> log)
    {
        _sp = sp;
        _log = log;
        _intervalSec = cfg.GetValue("Worker:QuenchingSessionIntervalSeconds", 30);
        _gracePeriodMin = cfg.GetValue("Worker:QuenchingGracePeriodMinutes", 2);
        _catchUpDays = cfg.GetValue("Worker:QuenchingCatchUpDays", 7);
        _dataMarginSec = cfg.GetValue("Worker:QuenchingDataMarginSeconds", 5);
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _log.LogInformation("QuenchingSessionWorker started. Interval={Interval}s Grace={Grace}min CatchUp={CatchUp}d",
            _intervalSec, _gracePeriodMin, _catchUpDays);

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
                _log.LogError(ex, "QuenchingSessionWorker iteration failed");
            }
        }

        _log.LogInformation("QuenchingSessionWorker stopped");
    }

    // ----------------------------------------------------------------
    // Catch‑up (пропущенные сессии при старте)
    // ----------------------------------------------------------------
    private async Task CatchUpMissedSessionsAsync(CancellationToken ct)
    {
        using var scope = _sp.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuenchingRepository>();

        _log.LogInformation("Starting catch-up for missed quenching sessions…");
        var missed = (await repo.FindMissedQuenchingSheetsAsync(_catchUpDays, _gracePeriodMin, ct)).ToList();

        if (missed.Count == 0)
        {
            _log.LogInformation("No missed quenching sessions found");
            return;
        }

        _log.LogInformation("Catch-up: {Count} sheets to process", missed.Count);
        int processed = 0;
        foreach (dynamic sheet in missed)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                await ProcessSheetAsync(repo, sheet, ct);
                processed++;
                if (processed % 100 == 0)
                    _log.LogInformation("Catch-up progress: {Processed}/{Total}", processed, missed.Count);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Failed to process sheet {Sheet}", (int)sheet.sheet);
            }
        }

        _log.LogInformation("Catch-up completed. Processed: {Processed}", processed);
    }

    // ----------------------------------------------------------------
    // Регулярная обработка
    // ----------------------------------------------------------------
    private async Task ProcessAsync(CancellationToken ct)
    {
        using var scope = _sp.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IQuenchingRepository>();

        var candidates = (await repo.FindCompletedQuenchingSheetsAsync(_gracePeriodMin, ct)).ToList();
        if (candidates.Count == 0) return;

        _log.LogInformation("Processing {Count} completed quenching sheets", candidates.Count);
        foreach (dynamic c in candidates)
        {
            ct.ThrowIfCancellationRequested();
            await ProcessSheetAsync(repo, c, ct);
        }
    }

    // ----------------------------------------------------------------
    // Обработка одного листа
    // ----------------------------------------------------------------
    private async Task ProcessSheetAsync(IQuenchingRepository repo, dynamic c, CancellationToken ct)
    {
        DateTime enteredAt = ToUtc((DateTime)c.entered_at);
        DateTime exitedAt = ToUtc((DateTime)c.exited_at);
        if (enteredAt >= exitedAt)
        {
            _log.LogWarning("Invalid time range for sheet {Sheet}", (int)c.sheet);
            return;
        }
        DateTime from = enteredAt.AddSeconds(-_dataMarginSec);
        DateTime to = exitedAt.AddSeconds(_dataMarginSec);


        // 1. Получить сырые данные за весь интервал
        var raw = await repo.GetQuenchingArraysAsync(from, to, ct);

        // 2. Агрегация unlock (строки из 10 символов)
        string valves1Unlock = BuildUnlockString(raw, group: 1);
        string valves2Unlock = BuildUnlockString(raw, group: 2);

        // 3. Средние mnat -> json-массив
        string valves1Mnat = BuildAvgMnatJson(raw, group: 1);
        string valves2Mnat = BuildAvgMnatJson(raw, group: 2);

        // 4. Средние по всем остальным параметрам (давления, уровни, температуры, позиции)
        // Используем универсальную функцию AvgNullable, которая принимает string? и парсит
        float? AvgNullable(string? json)
        {
            var list = ParseJsonList<float?>(json);
            if (list == null || list.Count == 0) return null;
            var vals = list.Where(v => v.HasValue).Select(v => v!.Value).ToList();
            return vals.Count > 0 ? vals.Average() : null;
        }

        // 5. Сборка параметров для upsert
        var parameters = new
        {
            Sheet = (int)c.sheet,
            Slab = ConvertToNullableInt(c.slab),
            Melt = ConvertToNullableInt(c.melt),
            PartNo = ConvertToNullableInt(c.part_no),
            Pack = ConvertToNullableInt(c.pack),
            ReheatNum = (int)c.reheat_num,
            AlloyCode = ConvertToNullableInt(c.alloy_code),
            AlloyCodeText = ConvertToString(c.alloy_code_text),
            Thickness = ConvertToNullableFloat(c.thickness),
            EnteredAt = enteredAt,
            ExitedAt = exitedAt,
            TotalSec = (float)(exitedAt - enteredAt).TotalSeconds,
            Valves1Unlock = valves1Unlock,
            Valves2Unlock = valves2Unlock,
            Valves1Mnat = valves1Mnat,
            Valves2Mnat = valves2Mnat,

            // Давления
            Press9 = AvgNullable(raw.Press9),
            Press10 = AvgNullable(raw.Press10),
            Press11 = AvgNullable(raw.Press11),
            Press12 = AvgNullable(raw.Press12),
            PressTopLamin1 = AvgNullable(raw.PressTopLamin1),
            PressBotLamin1 = AvgNullable(raw.PressBotLamin1),
            PressTopLamin2 = AvgNullable(raw.PressTopLamin2),
            PressBotLamin2 = AvgNullable(raw.PressBotLamin2),
            PressTopZak = AvgNullable(raw.PressTopZak),
            PressBotZak = AvgNullable(raw.PressBotZak),

            // Уровни и воздух
            LevelHaccum = AvgNullable(raw.LevelHaccum),
            LevelTank = AvgNullable(raw.LevelTank),
            AirPrs = AvgNullable(raw.AirPrs),

            // Температуры
            TempGrad = AvgNullable(raw.TempGrad),
            TempTopLam1 = AvgNullable(raw.TempTopLam1),
            TempBotLam1 = AvgNullable(raw.TempBotLam1),
            TempTopLam2 = AvgNullable(raw.TempTopLam2),
            TempBotLam2 = AvgNullable(raw.TempBotLam2),
            TempHaccum = AvgNullable(raw.TempHaccum),

            // Позиции клапанов
            ValveX1UpPosRef = AvgNullable(raw.ValveX1UpPosRef),
            ValveX1UpPosFbk = AvgNullable(raw.ValveX1UpPosFbk),
            ValveX1DownPosRef = AvgNullable(raw.ValveX1DownPosRef),
            ValveX1DownPosFbk = AvgNullable(raw.ValveX1DownPosFbk),
            ValveX2_1UpPosRef = AvgNullable(raw.ValveX2_1UpPosRef),
            ValveX2_1UpPosFbk = AvgNullable(raw.ValveX2_1UpPosFbk),
            ValveX2_1DownPosRef = AvgNullable(raw.ValveX2_1DownPosRef),
            ValveX2_1DownPosFbk = AvgNullable(raw.ValveX2_1DownPosFbk),
            ValveX2_2UpPosRef = AvgNullable(raw.ValveX2_2UpPosRef),
            ValveX2_2UpPosFbk = AvgNullable(raw.ValveX2_2UpPosFbk),
            ValveX2_2DownPosRef = AvgNullable(raw.ValveX2_2DownPosRef),
            ValveX2_2DownPosFbk = AvgNullable(raw.ValveX2_2DownPosFbk),

            HadAlarm = (bool)c.had_alarm
        };

        await repo.UpsertQuenchingSessionAsync(parameters, ct);
    }

    // ----------------------------------------------------------------
    // Утилиты для работы с JSON-строками
    // ----------------------------------------------------------------
    private static List<T?>? ParseJsonList<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<List<T?>>(json);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Строит строку из 10 символов '0'/'1' для группы клапанов по преобладающему состоянию.
    /// </summary>
    private static string BuildUnlockString(QuenchingDataDto dto, int group)
    {
        var sb = new StringBuilder(10);
        for (int i = 1; i <= 10; i++)
        {
            var series = GetUnlockSeries(dto, group, i);
            if (series == null || series.Count == 0)
            {
                sb.Append('0');
                continue;
            }
            int trueCount = series.Count(b => b);
            int falseCount = series.Count - trueCount;
            sb.Append(trueCount > falseCount ? '1' : '0');
        }
        return sb.ToString();
    }

    private static List<bool>? GetUnlockSeries(QuenchingDataDto dto, int group, int n)
    {
        string? json = group switch
        {
            1 => n switch
            {
                1 => dto.V1_U1,
                2 => dto.V1_U2,
                3 => dto.V1_U3,
                4 => dto.V1_U4,
                5 => dto.V1_U5,
                6 => dto.V1_U6,
                7 => dto.V1_U7,
                8 => dto.V1_U8,
                9 => dto.V1_U9,
                10 => dto.V1_U10,
                _ => null
            },
            2 => n switch
            {
                1 => dto.V2_U1,
                2 => dto.V2_U2,
                3 => dto.V2_U3,
                4 => dto.V2_U4,
                5 => dto.V2_U5,
                6 => dto.V2_U6,
                7 => dto.V2_U7,
                8 => dto.V2_U8,
                9 => dto.V2_U9,
                10 => dto.V2_U10,
                _ => null
            },
            _ => null
        };
        return ParseJsonList<bool?>(json)?.Where(v => v.HasValue).Select(v => v!.Value).ToList();
    }

    /// <summary>
    /// Возвращает JSON-массив средних (целых модальных значений) для группы клапанов.
    /// </summary>
     private static string BuildAvgMnatJson(QuenchingDataDto dto, int group)
{
    var avgs = new List<int?>(10);
    for (int i = 1; i <= 10; i++)
    {
        var series = GetMnatSeries(dto, group, i);
        if (series == null || series.Count == 0)
        {
            avgs.Add(null);
            continue;
        }
        var intValues = series.Select(v => (int)v).ToList();
        avgs.Add(intValues.Max());
    }
    return JsonSerializer.Serialize(avgs);
}
    /*private static string BuildAvgMnatJson(QuenchingDataDto dto, int group)
    {
        var avgs = new List<int?>(10);
        for (int i = 1; i <= 10; i++)
        {
            var series = GetMnatSeries(dto, group, i); // List<float>?
            if (series == null || series.Count == 0)
            {
                avgs.Add(null);
                continue;
            }
            // Преобразуем в целые, убираем null, ищем моду (наиболее частое значение)
            var intValues = series.Select(v => (int)v).ToList();
            var mode = intValues.GroupBy(v => v)
                               .OrderByDescending(g => g.Count())
                               .First().Key;
            avgs.Add(mode);
        }
        return JsonSerializer.Serialize(avgs);
    }
    */
    private static List<float>? GetMnatSeries(QuenchingDataDto dto, int group, int n)
    {
        string? json = group switch
        {
            1 => n switch
            {
                1 => dto.V1_M1,
                2 => dto.V1_M2,
                3 => dto.V1_M3,
                4 => dto.V1_M4,
                5 => dto.V1_M5,
                6 => dto.V1_M6,
                7 => dto.V1_M7,
                8 => dto.V1_M8,
                9 => dto.V1_M9,
                10 => dto.V1_M10,
                _ => null
            },
            2 => n switch
            {
                1 => dto.V2_M1,
                2 => dto.V2_M2,
                3 => dto.V2_M3,
                4 => dto.V2_M4,
                5 => dto.V2_M5,
                6 => dto.V2_M6,
                7 => dto.V2_M7,
                8 => dto.V2_M8,
                9 => dto.V2_M9,
                10 => dto.V2_M10,
                _ => null
            },
            _ => null
        };
        return ParseJsonList<int?>(json)?.Where(v => v.HasValue).Select(v => (float)v!.Value).ToList();
    }

    // ----------------------------------------------------------------
    // Общие хелперы (даты и конвертеры)
    // ----------------------------------------------------------------
    private static DateTime ToUtc(DateTime dt) => dt.Kind switch
    {
        DateTimeKind.Utc => dt,
        DateTimeKind.Local => dt.ToUniversalTime(),
        _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
    };

    private static int? ConvertToNullableInt(object? value) =>
        value is null || value is DBNull ? null : Convert.ToInt32(value);

    private static float? ConvertToNullableFloat(object? value) =>
        value is null || value is DBNull ? null : Convert.ToSingle(value);

    private static string? ConvertToString(object? value) =>
        value?.ToString();
}