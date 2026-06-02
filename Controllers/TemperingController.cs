using Dapper;
using MES_ME.Server.Data;
using MES_ME.Server.Models;
using MES_ME.Server.OpcUa;
using MES_ME.Server.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MES_ME.Server.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class TemperingController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NpgsqlDataSource _dataSource;
    private readonly ITemperingRepository _temperingRepo;
    private readonly ILogger<TemperingController> _logger;
    private readonly IOpcUaService _opcService;


    public TemperingController(
        AppDbContext context,
        NpgsqlDataSource dataSource,
        ILogger<TemperingController> logger,
        ITemperingRepository temperingRepo,
        IOpcUaService opcService)
    {
        _context = context;
        _dataSource = dataSource;
        _logger = logger;
        _temperingRepo = temperingRepo;
        _opcService = opcService;
    }

    private string GetUserName() => User.Identity?.Name ?? "UNKNOWN";

    private static bool IsDualSlotFurnace(int furnaceNo) => furnaceNo == 3 || furnaceNo == 4;

    private static string BuildBusinessKey(int cassetteNumber)
    {
        var now = DateTime.UtcNow.ToLocalTime();
        return $"{cassetteNumber}/{now:yyyyMMdd-HHmm}";
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OPC UA: Запись и очистка тегов кассеты
    // ═══════════════════════════════════════════════════════════════════════════

    private async Task WriteCassetteToOpcAsync(int furnaceNo, int? slot, int cassetteNumber, DateTime loadTime)
    {
        string noAlias, dayAlias, monthAlias, yearAlias, hourAlias;

        if (furnaceNo <= 2)
        {
            string prefix = furnaceNo == 1 ? "RelFurn12.RelFurn1" : "RelFurn12.RelFurn2";
            noAlias = $"{prefix}.CaasetteNo";
            dayAlias = $"{prefix}.Day";
            monthAlias = $"{prefix}.Month";
            yearAlias = $"{prefix}.Year";
            hourAlias = $"{prefix}.Hour";
        }
        else
        {
            string s = slot == 2 ? "2" : "1";
            noAlias = $"RelFurn{furnaceNo}.Cassette{s}_CaasetteNo{s}";
            dayAlias = $"RelFurn{furnaceNo}.Cassette{s}_Day";
            monthAlias = $"RelFurn{furnaceNo}.Cassette{s}_Month";
            yearAlias = $"RelFurn{furnaceNo}.Cassette{s}_Year";
            hourAlias = $"RelFurn{furnaceNo}.Cassette{s}_Hour";
        }

        await _opcService.WriteByAliasAsync(noAlias, cassetteNumber);
        await _opcService.WriteByAliasAsync(dayAlias, loadTime.Day);
        await _opcService.WriteByAliasAsync(monthAlias, loadTime.Month);
        await _opcService.WriteByAliasAsync(yearAlias, loadTime.Year);
        await _opcService.WriteByAliasAsync(hourAlias, loadTime.Hour);

        _logger.LogInformation("✅ OPC UA записано: печь №{Furnace}, слот {Slot}, кассета №{Cassette}",
            furnaceNo, slot ?? 0, cassetteNumber);
    }

    /// <summary>
    /// Обнуляет теги кассеты в OPC UA строго для указанного слота.
    /// </summary>
    private async Task ClearCassetteInOpcAsync(int furnaceNo, int? slot)
    {
        string noAlias, dayAlias, monthAlias, yearAlias, hourAlias;

        if (furnaceNo <= 2)
        {
            string prefix = furnaceNo == 1 ? "RelFurn12.RelFurn1" : "RelFurn12.RelFurn2";
            noAlias = $"{prefix}.CaasetteNo";
            dayAlias = $"{prefix}.Day";
            monthAlias = $"{prefix}.Month";
            yearAlias = $"{prefix}.Year";
            hourAlias = $"{prefix}.Hour";
        }
        else
        {
            // Для печей 3 и 4 слот ОБЯЗАН быть указан (1 или 2)
            string suffix = slot == 2 ? "2" : "1";
            noAlias = $"RelFurn{furnaceNo}.Cassette{suffix}_CaasetteNo{suffix}";
            dayAlias = $"RelFurn{furnaceNo}.Cassette{suffix}_Day";
            monthAlias = $"RelFurn{furnaceNo}.Cassette{suffix}_Month";
            yearAlias = $"RelFurn{furnaceNo}.Cassette{suffix}_Year";
            hourAlias = $"RelFurn{furnaceNo}.Cassette{suffix}_Hour";
        }

        await _opcService.WriteByAliasAsync(noAlias, 0);
        await _opcService.WriteByAliasAsync(dayAlias, 0);
        await _opcService.WriteByAliasAsync(monthAlias, 0);
        await _opcService.WriteByAliasAsync(yearAlias, 0);
        await _opcService.WriteByAliasAsync(hourAlias, 0);

        _logger.LogInformation("🧹 OPC UA очищено: печь №{Furnace}, слот {Slot}", furnaceNo, slot ?? 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GET-методы
    // ═══════════════════════════════════════════════════════════════════════════

    [HttpGet("current")]
    public async Task<IActionResult> GetCurrentPlcData()
    {
        await using var con = await _dataSource.OpenConnectionAsync();
        var result = await con.QueryAsync(@"
            SELECT DISTINCT ON (furnace_no)
                furnace_no, time, temp_act, temp_ref, t1, t2, t_average_furn,
                time_proc_set, time_to_proc_end, act_time_heat_acc, act_time_heat_wait, act_time_total,
                proc_fault, proc_run, proc_end, point_ref_1, point_time_1, point_dtime_2,
                burn1_te_lower, burn1_te_upper, burn1_air_prs, burn1_gas_prs,
                cassette_no, cass_day, cass_month, cass_year, cass_hour,
                cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
                cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
            FROM plc.tempering_data
            ORDER BY furnace_no, time DESC
        ");
        return Ok(result);
    }

    [HttpGet("active-sessions")]
    public async Task<IActionResult> GetActiveSessions()
    {
        await using var con = await _dataSource.OpenConnectionAsync();
        var result = await con.QueryAsync(@"
            SELECT id, furnace_number AS ""furnaceNumber"", slot_number AS ""slotNumber"",
                   business_key AS ""businessKey"", cassette_number AS ""cassetteNumber"",
                   loaded_at AS ""loadedAt"", loaded_by AS ""loadedBy"", status AS ""status"",
                   completed_by_plc AS ""completedByPlc""
            FROM mes.tempering_sessions_new
            WHERE unloaded_at IS NULL
            ORDER BY furnace_number, slot_number NULLS FIRST
        ");
        return Ok(result);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // POST /load — Загрузка кассеты
    // ═══════════════════════════════════════════════════════════════════════════

    [HttpPost("load")]
    public async Task<IActionResult> LoadCassette([FromBody] LoadCassetteRequest request)
    {
        if (request.FurnaceNo < 1 || request.FurnaceNo > 4)
            return BadRequest("Некорректный номер печи (1-4)");

        var userName = GetUserName();
        await using var con = await _dataSource.OpenConnectionAsync();
        var dualSlot = IsDualSlotFurnace(request.FurnaceNo);

        // 1. Проверка занятости
        if (!dualSlot)
        {
            var activeCount = await con.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM mes.tempering_sessions_new WHERE furnace_number = @F AND unloaded_at IS NULL",
                new { F = request.FurnaceNo });
            if (activeCount > 0)
                return BadRequest($"В печи №{request.FurnaceNo} уже есть кассета.");
        }
        else
        {
            var activeSessions = (await con.QueryAsync(
                "SELECT slot_number FROM mes.tempering_sessions_new WHERE furnace_number = @F AND unloaded_at IS NULL",
                new { F = request.FurnaceNo })).ToList();

            if (activeSessions.Count >= 2)
                return BadRequest($"В печи №{request.FurnaceNo} уже заняты оба слота.");

            var occupiedSlots = activeSessions.Select(s => (int?)s.slot_number).ToHashSet();

            if (request.Slot.HasValue)
            {
                if (request.Slot.Value != 1 && request.Slot.Value != 2)
                    return BadRequest("Слот должен быть 1 или 2");
                if (occupiedSlots.Contains(request.Slot.Value))
                    return BadRequest($"Слот {request.Slot.Value} в печи №{request.FurnaceNo} уже занят.");
            }
            else
            {
                request.Slot = !occupiedSlots.Contains(1) ? 1 : 2;
            }
        }

        // 2. Поиск кассеты
        var cassette = await con.QueryFirstOrDefaultAsync(
            @"SELECT business_key, cassette_number, is_closed 
              FROM mes.active_cassettes 
              WHERE cassette_number = @Num 
              ORDER BY created_at DESC LIMIT 1",
            new { Num = request.CassetteNumber });

        if (cassette == null) return NotFound($"Кассета №{request.CassetteNumber} не найдена");
        if (!(bool)cassette.is_closed) return BadRequest($"Кассета №{request.CassetteNumber} ещё не закрыта");

        var businessKey = (string)cassette.business_key;
        if (string.IsNullOrWhiteSpace(businessKey))
            businessKey = BuildBusinessKey(request.CassetteNumber);

        // 3. Листы кассеты
        var sheets = await _context.Set<CassetteSheet>()
            .Where(cs => cs.CassetteBusinessKey == businessKey).ToListAsync();
        if (sheets.Count == 0) return BadRequest("Кассета пуста");

        // 4. Создание сессии
        await con.ExecuteAsync(
            @"INSERT INTO mes.tempering_sessions_new 
              (furnace_number, slot_number, business_key, cassette_number, loaded_at, loaded_by, status)
              VALUES (@Furnace, @Slot, @BusinessKey, @CassNum, NOW(), @User, 'Загружена')",
            new { Furnace = request.FurnaceNo, Slot = request.Slot, BusinessKey = businessKey, CassNum = request.CassetteNumber, User = userName });

        // 5. Обновление статусов
        foreach (var cs in sheets)
        {
            var sheet = await _context.InputData.FindAsync(cs.MatId);
            if (sheet != null)
            {
                sheet.Status = "В печи отпуска";
                sheet.QuenchingStatus = "В печи отпуска";
            }
        }
        await _context.SaveChangesAsync();

        // 6. Удаление из active_cassettes
        await con.ExecuteAsync("DELETE FROM mes.active_cassettes WHERE business_key = @Key", new { Key = businessKey });

        // 7. ✅ Запись в OPC UA
        try
        {
            await WriteCassetteToOpcAsync(request.FurnaceNo, request.Slot, request.CassetteNumber, DateTime.UtcNow.ToLocalTime());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "⚠️ Ошибка записи в OPC UA при загрузке в печь №{Furnace}", request.FurnaceNo);
        }

        var slotInfo = dualSlot ? $", слот {request.Slot}" : "";
        _logger.LogInformation("🔥 Кассета №{Cassette} загружена в печь №{Furnace}{SlotInfo}", request.CassetteNumber, request.FurnaceNo, slotInfo);

        return Ok(new { message = $"Кассета №{request.CassetteNumber} загружена в печь №{request.FurnaceNo}{slotInfo}", businessKey, slot = request.Slot, sheetCount = sheets.Count });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // POST /unload — Выгрузка кассеты
    // ═══════════════════════════════════════════════════════════════════════════

    [HttpPost("unload")]
    public async Task<IActionResult> UnloadCassette([FromBody] UnloadCassetteRequest request)
    {
        if (request.FurnaceNo < 1 || request.FurnaceNo > 4)
            return BadRequest("Некорректный номер печи");

        var userName = GetUserName();
        await using var con = await _dataSource.OpenConnectionAsync();

        IEnumerable<dynamic> sessions;

        if (request.Slot.HasValue)
        {
            var session = await con.QueryFirstOrDefaultAsync(
                @"SELECT id, business_key, cassette_number, slot_number
                  FROM mes.tempering_sessions_new 
                  WHERE furnace_number = @F AND slot_number = @Slot AND unloaded_at IS NULL
                  ORDER BY loaded_at DESC LIMIT 1",
                new { F = request.FurnaceNo, Slot = request.Slot.Value });

            if (session == null)
                return NotFound($"Нет активной кассеты в печи №{request.FurnaceNo}, слот {request.Slot.Value}");

            sessions = new List<dynamic> { session };
        }
        else
        {
            sessions = (await con.QueryAsync(
                @"SELECT id, business_key, cassette_number, slot_number
                  FROM mes.tempering_sessions_new 
                  WHERE furnace_number = @F AND unloaded_at IS NULL
                  ORDER BY slot_number NULLS FIRST",
                new { F = request.FurnaceNo })).ToList();

            if (!sessions.Any())
                return NotFound($"Нет активных кассет в печи №{request.FurnaceNo}");
        }

        var unloadedKeys = new List<string>();
        var totalSheets = 0;
        var unloadedSlots = new HashSet<int?>(); // Собираем только реально выгруженные слоты

        foreach (var session in sessions)
        {
            var businessKey = (string)session.business_key;
            var slotNum = (int?)session.slot_number;

            await con.ExecuteAsync(
                @"UPDATE mes.tempering_sessions_new 
                  SET unloaded_at = NOW(), unloaded_by = @User, completed_by_plc = FALSE, status = 'Выгружена вручную'
                  WHERE id = @Id",
                new { Id = session.id, User = userName });

            var sheets = await _context.Set<CassetteSheet>().Where(cs => cs.CassetteBusinessKey == businessKey).ToListAsync();
            foreach (var cs in sheets)
            {
                var sheet = await _context.InputData.FindAsync(cs.MatId);
                if (sheet != null)
                {
                    sheet.Status = "Отпуск пройден";
                    sheet.QuenchingStatus = "Отпуск пройден";
                }
            }

            totalSheets += sheets.Count;
            unloadedKeys.Add(businessKey);
            unloadedSlots.Add(slotNum); // ✅ Добавляем слот в список для очистки
        }

        await _context.SaveChangesAsync();

        // ✅ Очистка тегов в OPC UA ТОЛЬКО для реально выгруженных слотов
        try
        {
            foreach (var slot in unloadedSlots)
            {
                await ClearCassetteInOpcAsync(request.FurnaceNo, slot);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "⚠️ Ошибка очистки OPC UA при выгрузке из печи №{Furnace}", request.FurnaceNo);
        }

        var sessionCount = sessions.Count();
        _logger.LogWarning("📤 Кассеты ({Count} шт.) ВЫГРУЖЕНЫ из печи №{Furnace}", sessionCount, request.FurnaceNo);

        return Ok(new
        {
            message = sessionCount == 1 ? $"Кассета выгружена из печи №{request.FurnaceNo}" : $"Выгружено {sessionCount} кассет из печи №{request.FurnaceNo}",
            unloadedCount = sessionCount,
            sheetCount = totalSheets
        });
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> GetTemperingSessions([FromQuery] int? furnaceNo, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 200, CancellationToken ct = default)
    {
        try { return Ok(await _temperingRepo.GetSessionsAsync(furnaceNo, from, to, page, pageSize, ct)); }
        catch (Exception ex) { _logger.LogError(ex, "GetTemperingSessions failed"); return StatusCode(500, new { error = "Ошибка" }); }
    }

    [HttpGet("sessions/{id:long}")]
    public async Task<IActionResult> GetTemperingSessionById(long id, CancellationToken ct = default)
    {
        try
        {
            var result = await _temperingRepo.GetSessionDetailsAsync(id, ct);
            return result == null ? NotFound(new { error = "Сессия не найдена" }) : Ok(result);
        }
        catch (Exception ex) { _logger.LogError(ex, "GetTemperingSessionById failed"); return StatusCode(500, new { error = "Ошибка" }); }
    }
}

public class LoadCassetteRequest
{
    public int FurnaceNo { get; set; }
    public int CassetteNumber { get; set; }
    public int? Slot { get; set; }
}

public class UnloadCassetteRequest
{
    public int FurnaceNo { get; set; }
    public int? Slot { get; set; }
}