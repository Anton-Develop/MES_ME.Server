using Dapper;
using MES_ME.Server.Data;
using MES_ME.Server.Models;
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

    public TemperingController(
        AppDbContext context,
        NpgsqlDataSource dataSource,
        ILogger<TemperingController> logger,
        ITemperingRepository temperingRepo)
    {
        _context = context;
        _dataSource = dataSource;
        _logger = logger;
        _temperingRepo = temperingRepo;
    }

    private string GetUserName() => User.Identity?.Name ?? "UNKNOWN";

    /// <summary>
    /// Печи 3 и 4 поддерживают до 2 кассет (слоты 1 и 2).
    /// Печи 1 и 2 — только 1 кассету (slot_number = NULL).
    /// </summary>
    private static bool IsDualSlotFurnace(int furnaceNo) => furnaceNo == 3 || furnaceNo == 4;

    [HttpGet("current")]
    public async Task<IActionResult> GetCurrentPlcData()
    {
        await using var con = await _dataSource.OpenConnectionAsync();
        var result = await con.QueryAsync(@"
            SELECT DISTINCT ON (furnace_no)
                furnace_no, time,
                temp_act, temp_ref, t1, t2, t_average_furn,
                time_proc_set, time_to_proc_end,
                act_time_heat_acc, act_time_heat_wait, act_time_total,
                proc_fault, proc_run, proc_end,
                point_ref_1, point_time_1, point_dtime_2,
                burn1_te_lower, burn1_te_upper, burn1_air_prs, burn1_gas_prs,
                cassette_no, cass_day, cass_month, cass_year, cass_hour,
                cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
                cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour
            FROM plc.tempering_data
            ORDER BY furnace_no, time DESC
        ");
        return Ok(result);
    }

    /// <summary>
    /// GET /api/tempering/active-sessions
    /// Возвращает все активные сессии. Для печей 3 и 4 — до двух (с slotNumber 1 и 2).
    /// </summary>
    [HttpGet("active-sessions")]
    public async Task<IActionResult> GetActiveSessions()
    {
        await using var con = await _dataSource.OpenConnectionAsync();
        var result = await con.QueryAsync(@"
            SELECT 
                id,
                furnace_number AS ""furnaceNumber"",
                slot_number    AS ""slotNumber"",
                business_key   AS ""businessKey"",
                cassette_number AS ""cassetteNumber"",
                loaded_at      AS ""loadedAt"",
                loaded_by      AS ""loadedBy"",
                status         AS ""status"",
                completed_by_plc AS ""completedByPlc""
            FROM mes.tempering_sessions_new
            WHERE unloaded_at IS NULL
            ORDER BY furnace_number, slot_number NULLS FIRST
        ");
        return Ok(result);
    }

    /// <summary>
    /// POST /api/tempering/load
    /// Загрузка кассеты в печь.
    /// Для печей 3 и 4: можно указать Slot (1 или 2). Если не указан — выбирается свободный автоматически.
    /// </summary>
    [HttpPost("load")]
    public async Task<IActionResult> LoadCassette([FromBody] LoadCassetteRequest request)
    {
        if (request.FurnaceNo < 1 || request.FurnaceNo > 4)
            return BadRequest("Некорректный номер печи (1-4)");

        var userName = GetUserName();
        await using var con = await _dataSource.OpenConnectionAsync();
        var dualSlot = IsDualSlotFurnace(request.FurnaceNo);

        // ── 1. Проверка занятости печи / слота ──────────────────────────────
        if (!dualSlot)
        {
            // Печи 1 и 2 — только одна кассета
            var activeCount = await con.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM mes.tempering_sessions_new WHERE furnace_number = @F AND unloaded_at IS NULL",
                new { F = request.FurnaceNo });

            if (activeCount > 0)
                return BadRequest($"В печи №{request.FurnaceNo} уже есть кассета. Сначала выгрузите её.");
        }
        else
        {
            // Печи 3 и 4 — до двух кассет
            var activeSessions = (await con.QueryAsync(
                "SELECT id, slot_number FROM mes.tempering_sessions_new WHERE furnace_number = @F AND unloaded_at IS NULL",
                new { F = request.FurnaceNo })).ToList();

            if (activeSessions.Count >= 2)
                return BadRequest($"В печи №{request.FurnaceNo} уже заняты оба слота.");

            var occupiedSlots = activeSessions
                .Select(s => (int?)s.slot_number)
                .ToHashSet();

            if (request.Slot.HasValue)
            {
                if (request.Slot.Value != 1 && request.Slot.Value != 2)
                    return BadRequest("Слот должен быть 1 или 2");

                if (occupiedSlots.Contains(request.Slot.Value))
                    return BadRequest($"Слот {request.Slot.Value} в печи №{request.FurnaceNo} уже занят.");
            }
            else
            {
                // Автоматический выбор свободного слота
                request.Slot = !occupiedSlots.Contains(1) ? 1 : 2;
            }
        }

        // ── 2. Поиск кассеты ────────────────────────────────────────────────
        var cassette = await con.QueryFirstOrDefaultAsync(
            @"SELECT business_key, cassette_number, is_closed 
              FROM mes.active_cassettes 
              WHERE cassette_number = @Num 
              ORDER BY created_at DESC LIMIT 1",
            new { Num = request.CassetteNumber });

        if (cassette == null)
            return NotFound($"Кассета №{request.CassetteNumber} не найдена среди активных");

        if (!(bool)cassette.is_closed)
            return BadRequest($"Кассета №{request.CassetteNumber} ещё не закрыта оператором");

        var businessKey = (string)cassette.business_key;

        // ── 3. Листы кассеты ────────────────────────────────────────────────
        var sheets = await _context.Set<CassetteSheet>()
            .Where(cs => cs.CassetteBusinessKey == businessKey)
            .ToListAsync();

        if (sheets.Count == 0)
            return BadRequest("Кассета пуста");

        // ── 4. Создание сессии ──────────────────────────────────────────────
        await con.ExecuteAsync(
            @"INSERT INTO mes.tempering_sessions_new 
              (furnace_number, slot_number, business_key, cassette_number, loaded_at, loaded_by, status)
              VALUES (@Furnace, @Slot, @BusinessKey, @CassNum, NOW(), @User, 'Загружена')",
            new
            {
                Furnace = request.FurnaceNo,
                Slot = request.Slot,        // NULL для печей 1 и 2, 1 или 2 — для печей 3 и 4
                BusinessKey = businessKey,
                CassNum = request.CassetteNumber,
                User = userName
            });

        // ── 5. Обновление статусов листов ───────────────────────────────────
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

        // ── 6. Удаление из active_cassettes ─────────────────────────────────
        await con.ExecuteAsync(
            "DELETE FROM mes.active_cassettes WHERE business_key = @Key",
            new { Key = businessKey });

        var slotInfo = dualSlot ? $", слот {request.Slot}" : "";
        _logger.LogInformation(
            "🔥 Кассета №{Cassette} ({Count} л.) загружена в печь №{Furnace}{SlotInfo} оператором {User}",
            request.CassetteNumber, sheets.Count, request.FurnaceNo, slotInfo, userName);

        return Ok(new
        {
            message = $"Кассета №{request.CassetteNumber} загружена в печь №{request.FurnaceNo}{slotInfo}",
            businessKey,
            slot = request.Slot,
            sheetCount = sheets.Count
        });
    }

    /// <summary>
    /// POST /api/tempering/unload
    /// Выгрузка кассеты из печи.
    /// Для печей 3 и 4: можно указать Slot (1 или 2) для выгрузки конкретной кассеты.
    /// Если Slot не указан — выгружаются ВСЕ кассеты из печи.
    /// </summary>
    [HttpPost("unload")]
    public async Task<IActionResult> UnloadCassette([FromBody] UnloadCassetteRequest request)
    {
        if (request.FurnaceNo < 1 || request.FurnaceNo > 4)
            return BadRequest("Некорректный номер печи");

        var userName = GetUserName();
        await using var con = await _dataSource.OpenConnectionAsync();

        // ── 1. Поиск сессий для выгрузки ────────────────────────────────────
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

        // ── 2. Выгрузка каждой найденной сессии ─────────────────────────────
        var unloadedKeys = new List<string>();
        var totalSheets = 0;

        foreach (var session in sessions)
        {
            var businessKey = (string)session.business_key;
            var slotNum = (int?)session.slot_number;

            await con.ExecuteAsync(
                @"UPDATE mes.tempering_sessions_new 
                  SET unloaded_at = NOW(), 
                      unloaded_by = @User, 
                      completed_by_plc = FALSE,
                      status = 'Выгружена вручную'
                  WHERE id = @Id",
                new { Id = session.id, User = userName });

            var sheets = await _context.Set<CassetteSheet>()
                .Where(cs => cs.CassetteBusinessKey == businessKey)
                .ToListAsync();

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
        }

        await _context.SaveChangesAsync();

        var sessionCount = sessions.Count();
        _logger.LogWarning(
            "📤 Кассеты ({Count} шт., {Keys}) ВЫГРУЖЕНЫ из печи №{Furnace} оператором {User}",
            sessionCount, string.Join(", ", unloadedKeys), request.FurnaceNo, userName);

        return Ok(new
        {
            message = sessionCount == 1
                ? $"Кассета выгружена из печи №{request.FurnaceNo}"
                : $"Выгружено {sessionCount} кассет из печи №{request.FurnaceNo}",
            unloadedCount = sessionCount,
            sheetCount = totalSheets
        });
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> GetTemperingSessions(
        [FromQuery] int? furnaceNo,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 200,
        CancellationToken ct = default)
    {
        try
        {
            var result = await _temperingRepo.GetSessionsAsync(furnaceNo, from, to, page, pageSize, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetTemperingSessions failed");
            return StatusCode(500, new { error = "Ошибка при получении списка сессий" });
        }
    }

    [HttpGet("sessions/{id:long}")]
    public async Task<IActionResult> GetTemperingSessionById(long id, CancellationToken ct = default)
    {
        try
        {
            var result = await _temperingRepo.GetSessionDetailsAsync(id, ct);
            if (result == null)
                return NotFound(new { error = "Сессия не найдена" });
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetTemperingSessionById failed for id={Id}", id);
            return StatusCode(500, new { error = "Ошибка при получении деталей сессии" });
        }
    }
}

// ─── DTO ────────────────────────────────────────────────────────────────────
public class LoadCassetteRequest
{
    public int FurnaceNo { get; set; }
    public int CassetteNumber { get; set; }
    /// <summary>Слот 1 или 2 (только для печей 3 и 4). Для печей 1 и 2 — не используется.</summary>
    public int? Slot { get; set; }
}

public class UnloadCassetteRequest
{
    public int FurnaceNo { get; set; }
    /// <summary>Слот 1 или 2 (только для печей 3 и 4). Если null — выгружаются ВСЕ кассеты из печи.</summary>
    public int? Slot { get; set; }
}