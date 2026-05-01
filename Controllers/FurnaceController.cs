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
        _log  = log;
        _cfg  = cfg;
    }
    private static DateTime ToUtc(DateTime dt) => dt.Kind switch
    {
        DateTimeKind.Utc => dt,
        DateTimeKind.Local => dt.ToUniversalTime(),
        _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
    };
    // -----------------------------------------------------------------------
    // ЗОНЫ — история и текущее состояние
    // -----------------------------------------------------------------------

    /// <summary>
    /// История слежения зон за период.
    /// GET /api/furnace/zones/history?from=...&amp;to=...&amp;zone=F1&amp;sheet=42&amp;limit=500
    /// </summary>
    [HttpGet("zones/history")]
    [ProducesResponseType(typeof(IEnumerable<ZoneHistoryDto>), 200)]
    [ProducesResponseType(typeof(ApiError), 400)]
    public async Task<IActionResult> GetZoneHistory(
        [FromQuery] DateTime  from,
        [FromQuery] DateTime  to,
        [FromQuery] string?   zone  = null,
        [FromQuery] int?      sheet = null,
        [FromQuery] int?      limit = null,
        CancellationToken     ct    = default)
    {
        if (from >= to)
            return BadRequest(new ApiError
            {
                Code    = "INVALID_RANGE",
                Message = "from должен быть меньше to"
            });

        var maxLimit = _cfg.GetValue("Api:MaxPageSize", 5000);
        var defLimit = _cfg.GetValue("Api:DefaultPageSize", 500);

        var filter = new ZoneHistoryFilter
        {
            From = ToUtc(from),   // ← добавить ToUtc
            To = ToUtc(to),
            Zone = zone?.ToUpperInvariant(),
            Sheet = sheet,
            Limit = Math.Min(limit ?? defLimit, maxLimit)
        };

        var data = await _repo.GetZoneHistoryAsync(filter, ct);
        return Ok(data);
    }

    /// <summary>
    /// Трек конкретного листа по всем зонам печи (для отчёта).
    /// GET /api/furnace/zones/track/42
    /// </summary>
    [HttpGet("zones/track/{sheet:int}")]
    [ProducesResponseType(typeof(IEnumerable<ZoneHistoryDto>), 200)]
    [ProducesResponseType(typeof(ApiError), 404)]
    public async Task<IActionResult> GetZoneTrack(int sheet, CancellationToken ct = default)
    {
        var data = await _repo.GetZoneTrackBySheetAsync(sheet, ct);
        var list = data.ToList();

        if (list.Count == 0)
            return NotFound(new ApiError
            {
                Code    = "NOT_FOUND",
                Message = $"Нет данных для листа {sheet}"
            });

        return Ok(list);
    }

    // -----------------------------------------------------------------------
    // ТЕМПЕРАТУРЫ — история горения печи
    // -----------------------------------------------------------------------

    /// <summary>
    /// История температур с даунсемплингом (для графика горения).
    /// GET /api/furnace/temperatures?from=...&amp;to=...&amp;intervalMin=5
    /// </summary>
    [HttpGet("temperatures")]
    [ProducesResponseType(typeof(IEnumerable<TemperatureBucketDto>), 200)]
    [ProducesResponseType(typeof(ApiError), 400)]
    public async Task<IActionResult> GetTemperatures(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] int      intervalMin = 1,
        CancellationToken    ct          = default)
    {
        if (from >= to)
            return BadRequest(new ApiError
            {
                Code    = "INVALID_RANGE",
                Message = "from должен быть меньше to"
            });

        // Защита: не даём запросить сырые данные за слишком большой период
        // При intervalMin=1 и периоде > 24ч переключаем на 5 мин автоматически
        var spanHours = (to - from).TotalHours;
        if (spanHours > 24 && intervalMin < 5)
        {
            intervalMin = 5;
            _log.LogDebug("Auto-adjusted intervalMin to 5 for {Hours:N1}h range", spanHours);
        }

        var filter = new TemperatureFilter
        {
            From = ToUtc(from),
            To = ToUtc(to),
            IntervalMinutes = Math.Max(1, intervalMin)
        };

        var data = await _repo.GetTemperatureHistoryAsync(filter, ct);
        return Ok(data);
    }

    // -----------------------------------------------------------------------
    // ОТЧЁТ ПО НАГРЕВУ ЛИСТА
    // -----------------------------------------------------------------------

    /// <summary>
    /// Полный отчёт по нагреву конкретного листа.
    /// GET /api/furnace/report/sheet/42
    /// </summary>
    [HttpGet("report/sheet/{sheet:int}")]
    [ProducesResponseType(typeof(HeatingReportDto), 200)]
    [ProducesResponseType(typeof(ApiError), 404)]
    public async Task<IActionResult> GetSheetReport(int sheet, CancellationToken ct = default)
    {
        // Берём агрегат из heating_sessions (быстро — один запрос по индексу)
        var session = await _repo.GetSessionBySheetAsync(sheet, ct);
        if (session is null)
            return NotFound(new ApiError
            {
                Code    = "NOT_FOUND",
                Message = $"Отчёт для листа {sheet} ещё не готов или лист не найден"
            });

        // Параллельно подгружаем детальный трек зон и температуры за период нагрева
        var trackTask = _repo.GetZoneTrackBySheetAsync(sheet, ct);
        var tempsTask = session.EnteredAt.HasValue && session.ExitedAt.HasValue
    ? _repo.GetTemperatureHistoryAsync(new TemperatureFilter
    {
        From = ToUtc(session.EnteredAt.Value),
        To = ToUtc(session.ExitedAt.Value),
        IntervalMinutes = 1
    }, ct)
    : Task.FromResult(Enumerable.Empty<TemperatureBucketDto>());


        await Task.WhenAll(trackTask, tempsTask);

        var report = new HeatingReportDto
        {
            Sheet          = session.Sheet,
            Slab           = session.Slab,
            Melt           = session.Melt,
            PartNo         = session.PartNo,
            AlloyCode      = session.AlloyCode,
            AlloyCodeText  = session.AlloyCodeText,
            Thickness      = session.Thickness,
            ZonesPath      = session.ZonesPath,
            EnteredAt      = session.EnteredAt,
            ExitedAt       = session.ExitedAt,
            TotalMin       = session.TotalMin,
            F1Min          = session.F1Min,
            F2Min          = session.F2Min,
            F3Min          = session.F3Min,
            F4Min          = session.F4Min,
            AvgZ3_1        = session.AvgZ3_1,
            AvgZ3_2        = session.AvgZ3_2,
            AvgZ3_3        = session.AvgZ3_3,
            AvgZ3_4        = session.AvgZ3_4,
            AvgZ4_1        = session.AvgZ4_1,
            AvgZ4_2        = session.AvgZ4_2,
            AvgZ4_3        = session.AvgZ4_3,
            AvgZ4_4        = session.AvgZ4_4,
            HadAlarm       = session.HadAlarm,
            ZoneTrack      = (await trackTask).ToList(),
            Temperatures   = (await tempsTask).ToList()
        };

        return Ok(report);
    }

    // -----------------------------------------------------------------------
    // СПИСОК СЕССИЙ НАГРЕВА (история по плавкам/слябам)
    // -----------------------------------------------------------------------

    /// <summary>
    /// Постраничный список сессий нагрева с фильтрами.
    /// GET /api/furnace/sessions?from=...&amp;to=...&amp;slab=5&amp;page=1&amp;pageSize=50
    /// </summary>
    [HttpGet("sessions")]
    [ProducesResponseType(typeof(PagedResult<HeatingSession>), 200)]
    [ProducesResponseType(typeof(ApiError), 400)]
    public async Task<IActionResult> GetSessions(
        [FromQuery] DateTime? from      = null,
        [FromQuery] DateTime? to        = null,
        [FromQuery] int?      slab      = null,
        [FromQuery] int?      melt      = null,
        [FromQuery] int?      alloyCode = null,
        [FromQuery] int       page      = 1,
        [FromQuery] int       pageSize  = 50,
        CancellationToken     ct        = default)
    {
        if (page < 1)
            return BadRequest(new ApiError { Code = "INVALID_PAGE", Message = "page >= 1" });

        pageSize = Math.Clamp(pageSize, 1, 200);

        var filter = new SessionFilter
        {
            From = from.HasValue ? ToUtc(from.Value) : null,
            To = to.HasValue ? ToUtc(to.Value) : null,
            Slab = slab,
            Melt = melt,
            AlloyCode = alloyCode,
            Page = page,
            PageSize = pageSize
        };


        var result = await _repo.GetSessionsAsync(filter, ct);
        return Ok(result);
    }

    /// <summary>
    /// Одна сессия по номеру листа.
    /// GET /api/furnace/sessions/sheet/42
    /// </summary>
    [HttpGet("sessions/sheet/{sheet:int}")]
    [ProducesResponseType(typeof(HeatingSession), 200)]
    [ProducesResponseType(typeof(ApiError), 404)]
    public async Task<IActionResult> GetSessionBySheet(int sheet, CancellationToken ct = default)
    {
        var session = await _repo.GetSessionBySheetAsync(sheet, ct);
        return session is null
            ? NotFound(new ApiError { Code = "NOT_FOUND", Message = $"Лист {sheet} не найден" })
            : Ok(session);
    }
}
