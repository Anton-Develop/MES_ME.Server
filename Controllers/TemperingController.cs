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

    private string GetUserName(string? requestOperator = null)
    => string.IsNullOrWhiteSpace(requestOperator) ? (User.Identity?.Name ?? "UNKNOWN") : requestOperator;


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
            noAlias = $"{prefix}.FromHmi_CaasetteNo";
            dayAlias = $"{prefix}.FromHmi_Day";
            monthAlias = $"{prefix}.FromHmi_Month";
            yearAlias = $"{prefix}.FromHmi_Year";
            hourAlias = $"{prefix}.FromHmi_Hour";
        }
        else
        {
            string s = slot == 2 ? "2" : "1";
            noAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{s}_CaasetteNo{s}";
            dayAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{s}_Day";
            monthAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{s}_Month";
            yearAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{s}_Year";
            hourAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{s}_Hour";
        }

        await _opcService.WriteByAliasAsync(noAlias, cassetteNumber);
        await _opcService.WriteByAliasAsync(dayAlias, loadTime.Day);
        await _opcService.WriteByAliasAsync(monthAlias, loadTime.Month);
        await _opcService.WriteByAliasAsync(yearAlias, loadTime.Year);
        await _opcService.WriteByAliasAsync(hourAlias, (ushort)loadTime.Hour);


      
          
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
            noAlias = $"{prefix}.FromHmi_CaasetteNo";
            dayAlias = $"{prefix}.FromHmi_Day";
            monthAlias = $"{prefix}.FromHmi_Month";
            yearAlias = $"{prefix}.FromHmi_Year";
            hourAlias = $"{prefix}.FromHmi_Hour";
        }
        else
        {
            // Для печей 3 и 4 слот ОБЯЗАН быть указан (1 или 2)
            string suffix = slot == 2 ? "2" : "1";
            noAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{suffix}_CaasetteNo{suffix}";
            dayAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{suffix}_Day";
            monthAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{suffix}_Month";
            yearAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{suffix}_Year";
            hourAlias = $"RelFurn{furnaceNo}.FromHmi_Cassette{suffix}_Hour";
        }

        await _opcService.WriteByAliasAsync(noAlias, 0);
        await _opcService.WriteByAliasAsync(dayAlias, 0);
        await _opcService.WriteByAliasAsync(monthAlias, 0);
        await _opcService.WriteByAliasAsync(yearAlias, 0);
        await _opcService.WriteByAliasAsync(hourAlias, (ushort)0);

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
        SELECT tsn.id, 
               tsn.furnace_number AS ""furnaceNumber"", 
               tsn.slot_number AS ""slotNumber"",
               tsn.business_key AS ""businessKey"", 
               tsn.cassette_number AS ""cassetteNumber"",
               tsn.loaded_at AS ""loadedAt"", 
               tsn.loaded_by AS ""loadedBy"", 
               tsn.status AS ""status"",
               tsn.completed_by_plc AS ""completedByPlc"",
               COALESCE(max_reheat.max_reheat, 0) AS ""maxReheatNum""   
        FROM mes.tempering_sessions_new tsn
        LEFT JOIN LATERAL (
            SELECT MAX(cs.reheat_num) AS max_reheat
            FROM mes.cassette_sheets cs
            WHERE cs.cassette_business_key = tsn.business_key
        ) max_reheat ON TRUE
        WHERE tsn.unloaded_at IS NULL
        ORDER BY tsn.furnace_number, tsn.slot_number NULLS FIRST
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

        var userName = GetUserName(request.OperatorName);
        await using var con = await _dataSource.OpenConnectionAsync();
        var dualSlot = IsDualSlotFurnace(request.FurnaceNo);

        // 1. Проверка занятости
        if (!dualSlot)
        {
            request.Slot = 1;
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
            if (sheet == null) continue;

            // 🔎 Проверяем текущий reheat_num листа
            int melt = int.TryParse(sheet.MeltNumber, out var m) ? m : 0;
            int partNo = int.TryParse(sheet.BatchNumber, out var p) ? p : 0;
            int pack = int.TryParse(sheet.PackNumber, out var pk) ? pk : 0;
            int sheetNum = int.TryParse(sheet.SheetNumber, out var s) ? s : 0;

            int currentReheat = await con.QueryFirstOrDefaultAsync<int>(
                @"SELECT COALESCE(MAX(reheat_num), 0)
                    FROM plc.heating_sessions
                WHERE melt = @Melt AND part_no = @Part
                    AND pack = @Pack AND sheet = @Sheet",
                new { Melt = melt, Part = partNo, Pack = pack, Sheet = sheetNum });

            if (cs.ReheatNum >= currentReheat)
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

        var userName = GetUserName(request.OperatorName);
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
                  ORDER BY slot_number",
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

            var sheets = await _context.Set<CassetteSheet>()
                .Where(cs => cs.CassetteBusinessKey == businessKey)
                .ToListAsync();

            foreach (var cs in sheets)
            {
                var sheet = await _context.InputData.FindAsync(cs.MatId);
                if (sheet == null) continue;

                // 🔎 Проверяем: есть ли у листа более свежий нагрев?
                int melt = int.TryParse(sheet.MeltNumber, out var m) ? m : 0;
                int partNo = int.TryParse(sheet.BatchNumber, out var p) ? p : 0;
                int pack = int.TryParse(sheet.PackNumber, out var pk) ? pk : 0;
                int sheetNum = int.TryParse(sheet.SheetNumber, out var s) ? s : 0;

                int currentReheat = await con.QueryFirstOrDefaultAsync<int>(
                    @"SELECT COALESCE(MAX(reheat_num), 0)
                        FROM plc.heating_sessions
                    WHERE melt = @Melt AND part_no = @Part
                        AND pack = @Pack AND sheet = @Sheet",
                    new { Melt = melt, Part = partNo, Pack = pack, Sheet = sheetNum });

                // Обновляем статус ТОЛЬКО если это был последний актуальный reheat
                if (cs.ReheatNum >= currentReheat)
                {
                    sheet.Status = "Отпуск пройден";
                    sheet.QuenchingStatus = "Отпуск пройден";
                }
                else
                {
                    _logger.LogInformation(
                        "🔁 Лист {MatId} имеет более свежий reheat_num={Current} (в кассете был {CassetteReheat}). Статус не меняем.",
                        cs.MatId, currentReheat, cs.ReheatNum);
                }
            }

            totalSheets += sheets.Count;
            unloadedKeys.Add(businessKey);
            unloadedSlots.Add(slotNum);
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
    // ═══════════════════════════════════════════════════════════════════════════
    // POST /cancel-load — Отмена загрузки (возврат кассеты в активные)
    // ═══════════════════════════════════════════════════════════════════════════

    [HttpPost("cancel-load")]
    public async Task<IActionResult> CancelLoad([FromBody] CancelLoadRequest request)
    {
        if (request.FurnaceNo < 1 || request.FurnaceNo > 4)
            return BadRequest("Некорректный номер печи (1-4)");

        var dualSlot = IsDualSlotFurnace(request.FurnaceNo);
        if (dualSlot && !request.Slot.HasValue)
            return BadRequest("Для печей №3 и №4 необходимо указать слот (1 или 2).");

        var userName = GetUserName(request.OperatorName);
        await using var con = await _dataSource.OpenConnectionAsync();
        await using var tx = await con.BeginTransactionAsync();

        try
        {
            // 1. Поиск активной сессии
            dynamic? session;
            if (dualSlot)
            {
                session = await con.QueryFirstOrDefaultAsync(
                    @"SELECT id, business_key, cassette_number, slot_number, loaded_at
                      FROM mes.tempering_sessions_new 
                      WHERE furnace_number = @F AND slot_number = @Slot AND unloaded_at IS NULL
                      ORDER BY loaded_at DESC LIMIT 1",
                    new { F = request.FurnaceNo, Slot = request.Slot!.Value }, tx);
            }
            else
            {
                session = await con.QueryFirstOrDefaultAsync(
                    @"SELECT id, business_key, cassette_number, slot_number, loaded_at
                      FROM mes.tempering_sessions_new 
                      WHERE furnace_number = @F AND unloaded_at IS NULL
                      ORDER BY loaded_at DESC LIMIT 1",
                    new { F = request.FurnaceNo }, tx);
            }

            if (session == null)
            {
                return NotFound(
                    dualSlot
                        ? $"В печи №{request.FurnaceNo} в слоте {request.Slot} нет активной кассеты."
                        : $"В печи №{request.FurnaceNo} нет активной кассеты."
                );
            }

            string businessKey = (string)session.business_key;
            int cassetteNumber = (int)session.cassette_number;
            int? slotNum = (int?)session.slot_number;

            // 2. Удаляем сессию (полная отмена факта загрузки)
            var deleted = await con.ExecuteAsync(
                "DELETE FROM mes.tempering_sessions_new WHERE id = @Id",
                new { Id = session.id }, tx);
            if (deleted == 0)
                return StatusCode(500, "Не удалось удалить сессию.");

            // 3. Возвращаем кассету в active_cassettes
            // Проверяем, нет ли уже такой кассеты (защита от дубликатов)
            var alreadyActive = await con.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM mes.active_cassettes WHERE business_key = @Key",
                new { Key = businessKey }, tx);

            if (alreadyActive == 0)
            {
                await con.ExecuteAsync(
                    @"INSERT INTO mes.active_cassettes (business_key, cassette_number, is_closed, created_at, created_by)
          VALUES (@Key, @Num, TRUE, NOW(), @User)",
                    new { Key = businessKey, Num = cassetteNumber, User = userName }, tx);
            }

            // 4. Откат статусов листов (возвращаем в "Закрыта")
            var sheets = await _context.Set<CassetteSheet>()
                .Where(cs => cs.CassetteBusinessKey == businessKey).ToListAsync();

            foreach (var cs in sheets)
            {
                var sheet = await _context.InputData.FindAsync(cs.MatId);
                if (sheet != null)
                {
                    sheet.Status = "Закрыта";
                    sheet.QuenchingStatus = "Закрыта";
                }
            }
            await _context.SaveChangesAsync();

            // 5. Коммитим транзакцию
            await tx.CommitAsync();

            // 6. Очистка OPC UA (вне транзакции — это внешняя система)
            try
            {
                await ClearCassetteInOpcAsync(request.FurnaceNo, slotNum);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "⚠️ Ошибка очистки OPC UA при отмене загрузки в печь №{Furnace}", request.FurnaceNo);
            }

            var slotInfo = dualSlot ? $", слот {slotNum}" : "";
            _logger.LogInformation("↩️ Загрузка кассеты №{Cassette} в печь №{Furnace}{SlotInfo} отменена пользователем {User}. Кассета возвращена в активные.",
                cassetteNumber, request.FurnaceNo, slotInfo, userName);

            return Ok(new
            {
                message = $"Кассета №{cassetteNumber} возвращена в активные",
                businessKey,
                slot = slotNum,
                furnaceNo = request.FurnaceNo,
                sheetCount = sheets.Count
            });
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    [HttpGet("sessions")]
    public async Task<IActionResult> GetTemperingSessions([FromQuery] int? furnaceNo, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 200, CancellationToken ct = default)
    {
        try { return Ok(await _temperingRepo.GetSessionsAsync(furnaceNo, from, to, page, pageSize, ct)); }
        catch (Exception ex) { _logger.LogError(ex, "GetTemperingSessions failed"); return StatusCode(500, new { error = "Ошибка" }); }
    }

    [HttpGet("sessions/{id:long}")]
    public async Task<IActionResult> GetTemperingSessionById(long id, [FromQuery] int coolingMinutes = 0, CancellationToken ct = default)
    {
        try
        {
            var result = await _temperingRepo.GetSessionDetailsAsync(id, coolingMinutes, ct);
            return result == null ? NotFound(new { error = "Сессия не найдена" }) : Ok(result);
        }
        catch (Exception ex) { _logger.LogError(ex, "GetTemperingSessionById failed"); return StatusCode(500, new { error = "Ошибка" }); }
    }


    /// <summary>
    /// GET /api/tempering/session-by-key?key={businessKey}
    /// Получение полных данных сессии отпуска по ключу кассеты
    /// </summary>
    [HttpGet("session-by-key")]
    public async Task<IActionResult> GetTemperingSessionByKey(
        [FromQuery] string key,
        [FromQuery] int coolingMinutes = 0, // ✅ 1. Добавляем параметр с дефолтным значением 0
        CancellationToken ct = default)
    {
        try
        {
            await using var con = await _dataSource.OpenConnectionAsync();

            // 1. Данные сессии (без изменений)
            var session = await con.QueryFirstOrDefaultAsync(@"
            SELECT 
                id, 
                furnace_number AS ""furnaceNumber"", 
                slot_number AS ""slotNumber"",
                business_key AS ""businessKey"", 
                cassette_number AS ""cassetteNumber"",
                loaded_at AS ""loadedAt"", 
                unloaded_at AS ""unloadedAt"",
                loaded_by AS ""loadedBy"", 
                unloaded_by AS ""unloadedBy"",
                status AS ""status"", 
                completed_by_plc AS ""completedByPlc"",
                CASE 
                    WHEN unloaded_at IS NOT NULL THEN EXTRACT(EPOCH FROM (unloaded_at - loaded_at)) / 60 
                    ELSE EXTRACT(EPOCH FROM (NOW() - loaded_at)) / 60 
                END AS ""totalTimeMin"",
                (SELECT MAX(temp_ref) FROM plc.tempering_data 
                 WHERE furnace_no = ts.furnace_number 
                    AND time >= ts.loaded_at 
                    AND (ts.unloaded_at IS NULL OR time <= ts.unloaded_at)
                ) AS ""tempRef"",
                (SELECT MAX(act_time_total) FROM plc.tempering_data 
                 WHERE furnace_no = ts.furnace_number 
                    AND time >= ts.loaded_at 
                    AND (ts.unloaded_at IS NULL OR time <= ts.unloaded_at)
                    and proc_end = false
                ) AS ""act_time_total""
            FROM mes.tempering_sessions_new ts
            WHERE business_key = @Key
            ORDER BY loaded_at DESC LIMIT 1",
                new { Key = key });

            if (session == null)
                return NotFound(new { error = "Сессия отпуска не найдена" });

            // 2. Данные о листах — с reheatNum
            var sheets = await con.QueryAsync(@"
                SELECT 
                    id.matid AS ""MatId"",
                    id.sheet_number AS ""Sheet"",
                    id.slab_number AS ""Slab"",
                    id.melt_number AS ""Melt"",
                    id.batch_number AS ""PartNo"",
                    id.pack_number AS ""Pack"",
                    id.steel_grade AS ""AlloyCodeText"",
                    id.sheet_dimensions AS ""Thickness"",
                    id.status AS ""Status"",
                    cs.reheat_num AS ""ReheatNum""  
                FROM mes.cassette_sheets cs
                INNER JOIN mes.inputdata id ON cs.mat_id = id.matid
                WHERE cs.cassette_business_key = @Key
                ORDER BY cs.sort_order, id.matid",
                new { Key = key });

            // 3. ✅ Получаем данные температур из PLC с учётом времени остывания
            var tempData = await con.QueryAsync(@"
            SELECT ""time"", temp_act, temp_ref, t1, t2, t_average_furn
            FROM plc.tempering_data
            WHERE furnace_no = @FurnaceNo
              AND ""time"" >= @LoadedAt
              AND (@UnloadedAt IS NULL OR ""time"" <= @UnloadedAt + (@CoolingMinutes || ' minutes')::INTERVAL)
            ORDER BY ""time""",
                new
                {
                    FurnaceNo = session.furnaceNumber,
                    LoadedAt = session.loadedAt,
                    UnloadedAt = session.unloadedAt,
                    CoolingMinutes = coolingMinutes // ✅ 2. Передаём параметр в SQL
                });

            return Ok(new
            {
                session,
                sheets,
                tempData = tempData.Select(d => new
                {
                    time = d.time,
                    tempAct = d.temp_act,
                    tempRef = d.temp_ref,
                    t1 = d.t1,
                    t2 = d.t2,
                    tAverage = d.t_average_furn
                })
            });
        }
        catch (OperationCanceledException)
        {
            // Это не ошибка сервера, а таймаут клиента или разрыв соединения
            _logger.LogWarning("⏱️ Запрос отменен (таймаут или разрыв соединения) для key={Key}", key);
            return StatusCode(408, new { error = "Превышено время ожидания ответа от сервера" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GetTemperingSessionByKey failed for key={Key}", key);
            return StatusCode(500, new { error = "Ошибка при получении данных сессии" });
        }
    }
    /// <summary>
/// GET /api/tempering/cassette-key-by-sheet
/// Находит бизнес-ключ кассеты по параметрам листа
/// </summary>
        [HttpGet("cassette-key-by-sheet")]
        public async Task<IActionResult> GetCassetteKeyBySheet(
            [FromQuery] string sheet,
            [FromQuery] string melt,
            [FromQuery] string partNo,
            [FromQuery] string pack,
            [FromQuery] int? reheatNum,   // ← НОВОЕ
            CancellationToken ct = default)
        {
            try
            {
                await using var con = await _dataSource.OpenConnectionAsync();

                // ✅ Если reheatNum передан — фильтруем строго по нему
                //    Иначе — берём самую свежую кассету (для обратной совместимости)
                var cassetteBusinessKey = await con.QueryFirstOrDefaultAsync<string>(
                    new CommandDefinition(@"
                    SELECT cs.cassette_business_key 
                    FROM mes.cassette_sheets cs
                    INNER JOIN mes.inputdata id ON cs.mat_id = id.matid
                    WHERE id.sheet_number = @Sheet
                    AND id.melt_number  = @Melt
                    AND id.batch_number = @PartNo
                    AND id.pack_number  = @Pack
                    AND (@ReheatNum IS NULL OR cs.reheat_num = @ReheatNum)
                    ORDER BY cs.reheat_num DESC, cs.added_at DESC
                    LIMIT 1",
                        new
                        {
                            Sheet = sheet,
                            Melt = melt,
                            PartNo = partNo,
                            Pack = pack,
                            ReheatNum = reheatNum
                        },
                        cancellationToken: ct));

                if (string.IsNullOrEmpty(cassetteBusinessKey))
                {
                    return NotFound(new
                    {
                        error = "Лист не найден ни в одной кассете отпуска. " +
                                "Возможно, он ещё не прошёл закалку или отпуск для этого reheat_num."
                    });
                }

                return Ok(new { cassetteBusinessKey });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetCassetteKeyBySheet failed for sheet={Sheet}, reheatNum={ReheatNum}",
                    sheet, reheatNum);
                return StatusCode(500, new { error = "Ошибка при поиске кассеты" });
            }
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 30)
        {
            await using var con = await _dataSource.OpenConnectionAsync();

            var totalCount = await con.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM mes.tempering_sessions_new WHERE unloaded_at IS NOT NULL");

            var sessions = await con.QueryAsync(
                @"SELECT tsn.id, tsn.furnace_number, tsn.business_key, 
                        tsn.loaded_at, tsn.loaded_by, tsn.unloaded_at, tsn.unloaded_by,
                        tsn.completed_by_plc, tsn.status,
                        (SELECT COUNT(*) FROM mes.cassette_sheets cs 
                        WHERE cs.cassette_business_key = tsn.business_key) AS sheet_count,
                        COALESCE((SELECT MAX(cs.reheat_num) FROM mes.cassette_sheets cs 
                                WHERE cs.cassette_business_key = tsn.business_key), 0) AS max_reheat_num
                FROM mes.tempering_sessions_new tsn
                WHERE tsn.unloaded_at IS NOT NULL
                ORDER BY tsn.unloaded_at DESC
                LIMIT @Limit OFFSET @Offset",
                new { Limit = pageSize, Offset = (page - 1) * pageSize });

            return Ok(new { sessions, totalCount, page, pageSize });
        }
}

public class LoadCassetteRequest
{
    public int FurnaceNo { get; set; }
    public int CassetteNumber { get; set; }
    public int? Slot { get; set; }
    public string? OperatorName { get; set; }
}

public class UnloadCassetteRequest
{
    public int FurnaceNo { get; set; }
    public int? Slot { get; set; }
    public string? OperatorName { get; set; }
}
public class CancelLoadRequest
{
    public int FurnaceNo { get; set; }
    public int? Slot { get; set; }
    public string? OperatorName { get; set; }
}