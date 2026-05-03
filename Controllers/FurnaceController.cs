using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MES_ME.Server.DTOs;
using MES_ME.Server.Models;
using MES_ME.Server.Repositories;

[ApiController]
[Route("api/furnace")]
[Produces("application/json")]
public sealed class FurnaceController : ControllerBase
{
    private readonly IFurnaceRepository _repo;
    private readonly ILogger<FurnaceController> _log;
    private readonly IConfiguration _cfg;

    public FurnaceController(
        IFurnaceRepository repo,
        ILogger<FurnaceController> log,
        IConfiguration cfg)
    {
        _repo = repo;
        _log = log;
        _cfg = cfg;
    }

    private static DateTime ToUtc(DateTime dt) => dt.Kind switch
    {
        DateTimeKind.Utc => dt,
        DateTimeKind.Local => dt.ToUniversalTime(),
        _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
    };

    // -----------------------------------------------------------------------
    // ЗОНЫ
    // -----------------------------------------------------------------------

    // GET /api/furnace/zones/history?from=...&to=...&zone=F1&sheet=42&limit=500
    [HttpGet("zones/history")]
    public async Task<IActionResult> GetZoneHistory(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] string? zone = null,
        [FromQuery] int? sheet = null,
        [FromQuery] int? limit = null,
        CancellationToken ct = default)
    {
        if (from >= to)
            return BadRequest(new ApiError { Code = "INVALID_RANGE", Message = "from должен быть меньше to" });

        var filter = new ZoneHistoryFilter
        {
            From = ToUtc(from),
            To = ToUtc(to),
            Zone = zone?.ToUpperInvariant(),
            Sheet = sheet,
            Limit = Math.Min(limit ?? _cfg.GetValue("Api:DefaultPageSize", 500),
                                     _cfg.GetValue("Api:MaxPageSize", 5000))
        };

        return Ok(await _repo.GetZoneHistoryAsync(filter, ct));
    }

    // GET /api/furnace/zones/track/{sheet}?melt=888888&partNo=8&pack=7
    // Трек конкретного листа — нужны все 4 поля для точного поиска
    [HttpGet("zones/track/{sheet:int}")]
    public async Task<IActionResult> GetZoneTrack(
        int sheet,
        [FromQuery] int? melt = null,
        [FromQuery] int? partNo = null,
        [FromQuery] int? pack = null,
        CancellationToken ct = default)
    {
        var data = await _repo.GetZoneTrackBySheetAsync(sheet, ct);
        var list = data.ToList();

        // Если переданы уточняющие параметры — фильтруем в памяти
        // (данных за 30 мин немного, дополнительный запрос не нужен)
        if (melt.HasValue) list = list.Where(r => r.Melt == melt).ToList();
        if (partNo.HasValue) list = list.Where(r => r.PartNo == partNo).ToList();
        if (pack.HasValue) list = list.Where(r => r.Pack == pack).ToList();

        if (list.Count == 0)
            return NotFound(new ApiError { Code = "NOT_FOUND", Message = $"Нет данных для листа {sheet}" });

        return Ok(list);
    }

    // -----------------------------------------------------------------------
    // ТЕМПЕРАТУРЫ
    // -----------------------------------------------------------------------

    // GET /api/furnace/temperatures?from=...&to=...&intervalMin=5
    [HttpGet("temperatures")]
    public async Task<IActionResult> GetTemperatures(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] int intervalMin = 1,
        CancellationToken ct = default)
    {
        if (from >= to)
            return BadRequest(new ApiError { Code = "INVALID_RANGE", Message = "from должен быть меньше to" });

        if ((to - from).TotalHours > 24 && intervalMin < 5)
            intervalMin = 5;

        var filter = new TemperatureFilter
        {
            From = ToUtc(from),
            To = ToUtc(to),
            IntervalMinutes = Math.Max(1, intervalMin)
        };

        return Ok(await _repo.GetTemperatureHistoryAsync(filter, ct));
    }

    // -----------------------------------------------------------------------
    // СЕССИИ НАГРЕВА
    // -----------------------------------------------------------------------

    // GET /api/furnace/sessions?from=...&to=...&melt=888888&page=1&pageSize=50
    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions(
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? slab = null,
        [FromQuery] int? melt = null,
        [FromQuery] int? alloyCode = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        if (page < 1)
            return BadRequest(new ApiError { Code = "INVALID_PAGE", Message = "page >= 1" });

        var filter = new SessionFilter
        {
            From = from.HasValue ? ToUtc(from.Value) : null,
            To = to.HasValue ? ToUtc(to.Value) : null,
            Slab = slab,
            Melt = melt,
            AlloyCode = alloyCode,
            Page = page,
            PageSize = Math.Clamp(pageSize, 1, 200)
        };

        return Ok(await _repo.GetSessionsAsync(filter, ct));
    }

    // GET /api/furnace/sessions/sheet/42
    // Все сессии листа (все плавки, все повторы)
    [HttpGet("sessions/sheet/{sheet:int}")]
    public async Task<IActionResult> GetSessionsBySheet(int sheet, CancellationToken ct = default)
    {
        var sessions = await _repo.GetSessionBySheetAsync(sheet, ct);
        return sessions is null
            ? NotFound(new ApiError { Code = "NOT_FOUND", Message = $"Лист {sheet} не найден" })
            : Ok(sessions);
    }

    // GET /api/furnace/sessions/key/888888-8-7-77-0
    // Конкретная сессия по business_key
    [HttpGet("sessions/key/{key}")]
    public async Task<IActionResult> GetSessionByKey(string key, CancellationToken ct = default)
    {
        var session = await _repo.GetSessionByKeyAsync(key, ct);
        return session is null
            ? NotFound(new ApiError { Code = "NOT_FOUND", Message = $"Сессия {key} не найдена" })
            : Ok(session);
    }

    // -----------------------------------------------------------------------
    // ОТЧЁТ ПО НАГРЕВУ
    // -----------------------------------------------------------------------

    // GET /api/furnace/report/key/888888-8-7-77-0
    // Полный отчёт по конкретной сессии (business_key)
    [HttpGet("report/key/{key}")]
    public async Task<IActionResult> GetReportByKey(string key, CancellationToken ct = default)
    {
        var session = await _repo.GetSessionByKeyAsync(key, ct);
        if (session is null)
            return NotFound(new ApiError
            {
                Code = "NOT_FOUND",
                Message = $"Сессия {key} не найдена или ещё не обработана воркером"
            });

        return Ok(await BuildReport(session, ct));
    }

    // GET /api/furnace/report/sheet/42?melt=888888&partNo=8&pack=7&reheatNum=0
    // Отчёт по листу с уточнением (если несколько плавок/повторов)
    [HttpGet("report/sheet/{sheet:int}")]
    public async Task<IActionResult> GetReportBySheet(
        int sheet,
        [FromQuery] int? melt = null,
        [FromQuery] int? partNo = null,
        [FromQuery] int? pack = null,
        [FromQuery] int reheatNum = 0,
        CancellationToken ct = default)
    {
        HeatingSession? session;

        // Если переданы все параметры — ищем по business_key точно
        if (melt.HasValue && partNo.HasValue && pack.HasValue)
        {
            var key = $"{melt}-{partNo}-{pack}-{sheet}-{reheatNum}";
            session = await _repo.GetSessionByKeyAsync(key, ct);
        }
        else
        {
            // Иначе берём первую запись по номеру листа
            session = await _repo.GetSessionBySheetAsync(sheet, ct);
        }

        if (session is null)
            return NotFound(new ApiError
            {
                Code = "NOT_FOUND",
                Message = $"Отчёт для листа {sheet} не найден"
            });

        return Ok(await BuildReport(session, ct));
    }

    // -----------------------------------------------------------------------
    // Приватный метод сборки отчёта
    // -----------------------------------------------------------------------
    private async Task<HeatingReportDto> BuildReport(HeatingSession session, CancellationToken ct)
    {
        var trackTask = _repo.GetZoneTrackBySheetAsync(session.Sheet, ct);

        var tempsTask = session.EnteredAt.HasValue && session.ExitedAt.HasValue
            ? _repo.GetTemperatureHistoryAsync(new TemperatureFilter
            {
                From = ToUtc(session.EnteredAt.Value),
                To = ToUtc(session.ExitedAt.Value),
                IntervalMinutes = 1
            }, ct)
            : Task.FromResult(Enumerable.Empty<TemperatureBucketDto>());

        await Task.WhenAll(trackTask, tempsTask);

        // Фильтруем трек только по нужной плавке/пачке
        var track = (await trackTask)
            .Where(r => r.Melt == session.Melt
                     && r.PartNo == session.PartNo
                     && r.Pack == session.Pack)
            .ToList();

        return new HeatingReportDto
        {
            Sheet = session.Sheet,
            Slab = session.Slab,
            Melt = session.Melt,
            PartNo = session.PartNo,
            AlloyCode = session.AlloyCode,
            AlloyCodeText = session.AlloyCodeText,
            Thickness = session.Thickness,
            ZonesPath = session.ZonesPath,
            EnteredAt = session.EnteredAt,
            ExitedAt = session.ExitedAt,
            TotalMin = session.TotalMin,
            F1Min = session.F1Min,
            F2Min = session.F2Min,
            F3Min = session.F3Min,
            F4Min = session.F4Min,
            AvgZ3_1 = session.AvgZ3_1,
            AvgZ3_2 = session.AvgZ3_2,
            AvgZ3_3 = session.AvgZ3_3,
            AvgZ3_4 = session.AvgZ3_4,
            AvgZ4_1 = session.AvgZ4_1,
            AvgZ4_2 = session.AvgZ4_2,
            AvgZ4_3 = session.AvgZ4_3,
            AvgZ4_4 = session.AvgZ4_4,
            HadAlarm = session.HadAlarm,
            ZoneTrack = track,
            Temperatures = (await tempsTask).ToList()
        };
    }
}    

