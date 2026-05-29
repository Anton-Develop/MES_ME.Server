using Dapper;
using MES_ME.Server.Data;
using MES_ME.Server.Models;
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
    private readonly ILogger<TemperingController> _logger;

    public TemperingController(
        AppDbContext context,
        NpgsqlDataSource dataSource,
        ILogger<TemperingController> logger)
    {
        _context = context;
        _dataSource = dataSource;
        _logger = logger;
    }

    private string GetUserName() => User.Identity?.Name ?? "UNKNOWN";

    /// <summary>
    /// GET /api/tempering/current
    /// Последние данные PLC по каждой печи (текущие температуры, таймеры и т.д.)
    /// </summary>
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
    /// Активные сессии (кассеты в печах) — из НОВОЙ таблицы
    /// </summary>
    [HttpGet("active-sessions")]
    public async Task<IActionResult> GetActiveSessions()
    {
        await using var con = await _dataSource.OpenConnectionAsync();
        var result = await con.QueryAsync(@"
        SELECT 
            id,
            furnace_number AS ""furnaceNumber"",      
            business_key AS ""businessKey"",          
            cassette_number AS ""cassetteNumber"",    
            loaded_at AS ""loadedAt"",                
            loaded_by AS ""loadedBy"",               
            status AS ""status"",
            completed_by_plc AS ""completedByPlc""
        FROM mes.tempering_sessions_new
        WHERE unloaded_at IS NULL
        ORDER BY furnace_number
    ");
        return Ok(result);
    }

    /// <summary>
    /// POST /api/tempering/load
    /// Загрузить кассету в печь отпуска — в НОВУЮ таблицу
    /// </summary>
    [HttpPost("load")]
    public async Task<IActionResult> LoadCassette([FromBody] LoadCassetteRequest request)
    {
        if (request.FurnaceNo < 1 || request.FurnaceNo > 4)
            return BadRequest("Некорректный номер печи (1-4)");

        var userName = GetUserName();
        await using var con = await _dataSource.OpenConnectionAsync();

        // 1. Проверяем, свободна ли печь (в НОВОЙ таблице)
        var activeInFurnace = await con.QueryFirstOrDefaultAsync<int>(
            "SELECT COUNT(*) FROM mes.tempering_sessions_new WHERE furnace_number = @F AND unloaded_at IS NULL",
            new { F = request.FurnaceNo });

        if (activeInFurnace > 0)
            return BadRequest($"В печи №{request.FurnaceNo} уже есть кассета. Сначала выгрузите её.");

        // 2. Ищем закрытую кассету
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

        // 3. Получаем листы
        var sheets = await _context.Set<CassetteSheet>()
            .Where(cs => cs.CassetteBusinessKey == businessKey)
            .ToListAsync();

        if (sheets.Count == 0)
            return BadRequest("Кассета пуста");

        // 4. Создаём сессию в НОВОЙ таблице
        await con.ExecuteAsync(
            @"INSERT INTO mes.tempering_sessions_new 
          (furnace_number, business_key, cassette_number, loaded_at, loaded_by, status)
          VALUES (@Furnace, @BusinessKey, @CassNum, NOW(), @User, 'Загружена')",
            new
            {
                Furnace = request.FurnaceNo,
                BusinessKey = businessKey,
                CassNum = request.CassetteNumber,
                User = userName
            });

        // 5. Обновляем статусы листов
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

        // 6. Удаляем из active_cassettes
        await con.ExecuteAsync(
            "DELETE FROM mes.active_cassettes WHERE business_key = @Key",
            new { Key = businessKey });

        _logger.LogInformation(
            "🔥 Кассета №{Cassette} ({Count} л.) загружена в печь №{Furnace} оператором {User}",
            request.CassetteNumber, sheets.Count, request.FurnaceNo, userName);

        return Ok(new
        {
            message = $"Кассета №{request.CassetteNumber} загружена в печь №{request.FurnaceNo}",
            businessKey,
            sheetCount = sheets.Count
        });
    }

    /// <summary>
    /// POST /api/tempering/unload
    /// Ручная выгрузка кассеты из печи — в НОВОЙ таблице
    /// </summary>
    [HttpPost("unload")]
    public async Task<IActionResult> UnloadCassette([FromBody] UnloadCassetteRequest request)
    {
        if (request.FurnaceNo < 1 || request.FurnaceNo > 4)
            return BadRequest("Некорректный номер печи");

        var userName = GetUserName();
        await using var con = await _dataSource.OpenConnectionAsync();

        // 1. Находим активную сессию (в НОВОЙ таблице)
        var session = await con.QueryFirstOrDefaultAsync(
            @"SELECT id, business_key, cassette_number
          FROM mes.tempering_sessions_new 
          WHERE furnace_number = @F AND unloaded_at IS NULL
          ORDER BY loaded_at DESC LIMIT 1",
            new { F = request.FurnaceNo });

        if (session == null)
            return NotFound($"Нет активной кассеты в печи №{request.FurnaceNo}");

        var businessKey = (string)session.business_key;

        // 2. Обновляем сессию
        await con.ExecuteAsync(
            @"UPDATE mes.tempering_sessions_new 
          SET unloaded_at = NOW(), 
              unloaded_by = @User, 
              completed_by_plc = FALSE,
              status = 'Выгружена вручную'
          WHERE id = @Id",
            new { Id = session.id, User = userName });

        // 3. Обновляем статусы листов
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
        await _context.SaveChangesAsync();

        _logger.LogWarning(
            "📤 Кассета {Key} ВЫГРУЖЕНА ВРУЧНУЮ из печи №{Furnace} оператором {User}",
            businessKey, request.FurnaceNo, userName);

        return Ok(new
        {
            message = $"Кассета выгружена из печи №{request.FurnaceNo}",
            businessKey,
            sheetCount = sheets.Count
        });
    }
}

// ── DTOs ──
public class LoadCassetteRequest
{
    public int FurnaceNo { get; set; }
    public int CassetteNumber { get; set; }
}

public class UnloadCassetteRequest
{
    public int FurnaceNo { get; set; }
}