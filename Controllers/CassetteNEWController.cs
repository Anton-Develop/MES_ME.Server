using Dapper;
using MES_ME.Server.Data;
using MES_ME.Server.DTOs;
using MES_ME.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;


namespace MES_ME.Server.Controllers
{
   
    [Route("api/[controller]")]
    [ApiController]
    public class CassetteNEWController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly NpgsqlDataSource _dataSource;
        private readonly ILogger<CassetteNEWController> _logger;

        public CassetteNEWController(
            AppDbContext context,
            NpgsqlDataSource dataSource,
            ILogger<CassetteNEWController> logger)
        {
            _context = context;
            _dataSource = dataSource;
            _logger = logger;
        }

        private string GetUserName() => User.Identity?.Name ?? "UNKNOWN";
        private bool IsMasterOrAbove()
        {
            var role = User.FindFirst("role")?.Value ?? "";
            return role is "master" or "superadmin" or "developer";
        }

        /// <summary>
        /// Генерирует бизнес-ключ кассеты: {number}/{yyyyMMdd-HHmm}
        /// </summary>
        private static string BuildBusinessKey(int cassetteNumber)
        {
            var now = DateTime.UtcNow; // Используем UTC для консистентности
            return $"{cassetteNumber}/{now:yyyyMMdd-HHmm}";
        }

        /// <summary>
        /// POST /api/cassette/create
        /// Создать новую кассету. Проверяет, не занята ли кассета с таким номером в печи.
        /// </summary>
        [HttpPost("create")]
        public async Task<IActionResult> CreateCassette([FromBody] CreateCassetteRequestnew request)
        {
            if (request.CassetteNumber <= 0)
                return BadRequest(new { message = "Некорректный номер кассеты" });

            var userName = GetUserName();

            // Проверяем: кассета с таким номером сейчас в печи?
            await using var con = await _dataSource.OpenConnectionAsync();
            var inFurnace = await con.QueryFirstOrDefaultAsync<int>(
                @"SELECT COUNT(*) FROM mes.furnace_cassette_sessions 
              WHERE cassette_id = @CassNo::TEXT AND unloaded_at IS NULL",
                new { CassNo = request.CassetteNumber.ToString() });

            if (inFurnace > 0)
            {
                return BadRequest(new
                {
                    message = $"Кассета №{request.CassetteNumber} сейчас находится в печи. Выберите другой номер."
                });
            }

            var businessKey = BuildBusinessKey(request.CassetteNumber);

            // Проверяем, не существует ли уже такая кассета (защита от двойного клика)
            var exists = await _context.Set<CassetteSheet>()
                .AnyAsync(cs => cs.CassetteBusinessKey == businessKey);

            if (exists)
            {
                return Conflict(new { message = "Кассета с таким ключом уже создаётся. Попробуйте через минуту." });
            }

            // Логируем создание
            await LogAuditAsync(con, businessKey, "create", null, userName, null);

            _logger.LogInformation("Создана новая кассета: {BusinessKey} оператором {User}", businessKey, userName);
            await con.ExecuteAsync(
    @"INSERT INTO mes.active_cassettes (business_key, cassette_number, created_by)
      VALUES (@Key, @CassetteNumber, @User)",
    new { Key = businessKey, CassNo = request.CassetteNumber, User = userName });
            return Ok(new
            {
                businessKey,
                cassetteNumber = request.CassetteNumber,
                message = $"Кассета №{request.CassetteNumber} создана"
            });
        }

        /// <summary>
        /// GET /api/cassette/{businessKey}/sheets
        /// Получить список листов в кассете
        /// </summary>
        [HttpGet("{businessKey}/sheets")]
        public async Task<IActionResult> GetCassetteSheets(string businessKey)
        {
            var sheets = await _context.Set<CassetteSheet>()
                .Where(cs => cs.CassetteBusinessKey == businessKey)
                .OrderBy(cs => cs.SortOrder)
                .Select(cs => new
                {
                    cs.Id,
                    cs.MatId,
                    cs.AddedAt,
                    cs.AddedBy,
                    cs.SortOrder,
                    Sheet = new
                    {
                        cs.Sheet!.MeltNumber,
                        cs.Sheet.BatchNumber,
                        cs.Sheet.PackNumber,
                        cs.Sheet.SheetNumber,
                        cs.Sheet.SteelGrade,
                        cs.Sheet.SheetDimensions,
                        cs.Sheet.Status,
                        cs.Sheet.QuenchingStatus,
                    },
                    // ✅ Используем отдельный запрос к SheetMeasurement вместо navigation property
                    Measurement = _context.Set<SheetMeasurement>()
                        .Where(m => m.MatId == cs.MatId && m.MeasuredAt != null)
                        .OrderByDescending(m => m.MeasuredAt)
                        .Select(m => new
                        {
                            m.Id,
                            m.H1Before,
                            m.H2Before,
                            m.H3Before,
                            m.H4Before,
                            m.H5Before,
                            m.H6Before,
                            m.H7Before,
                            m.H8Before,
                            m.H1After,
                            m.H2After,
                            m.H3After,
                            m.H4After,
                            m.H5After,
                            m.H6After,
                            m.H7After,
                            m.H8After,
                            m.MeasuredAt,
                            m.MeasuredBy
                        })
                        .FirstOrDefault()
                })
                .ToListAsync();

            return Ok(sheets);
        }

        /// <summary>
        /// POST /api/cassette/{businessKey}/add-sheet
        /// Добавить лист в кассету. Только листы со статусом "Закалка пройдена".
        /// </summary>
        [HttpPost("{businessKey}/add-sheet")]
        public async Task<IActionResult> AddSheetToCassette(
            string businessKey, [FromBody] AddSheetRequest request)
        {
            var userName = GetUserName();

            // Проверяем, что лист существует и прошёл закалку
            var sheet = await _context.InputData
                .FirstOrDefaultAsync(s => s.MatId == request.MatId);

            if (sheet == null)
                return NotFound(new { message = $"Лист {request.MatId} не найден" });

            if (sheet.Status != "Закалка пройдена" && sheet.Status != "Закалка пройдена, измерен")
            {
                return BadRequest(new
                {
                    message = $"Лист {request.MatId} имеет статус '{sheet.Status}'. " +
                              "В кассету можно добавить только листы, прошедшие закалку."
                });
            }

            // Проверяем, не добавлен ли уже этот лист в эту кассету
            var alreadyAdded = await _context.Set<CassetteSheet>()
                .AnyAsync(cs => cs.CassetteBusinessKey == businessKey && cs.MatId == request.MatId);

            if (alreadyAdded)
                return Conflict(new { message = "Лист уже добавлен в эту кассету" });

            // Определяем порядок
            var maxOrder = await _context.Set<CassetteSheet>()
                .Where(cs => cs.CassetteBusinessKey == businessKey)
                .MaxAsync(cs => (int?)cs.SortOrder) ?? 0;

            var cassetteSheet = new CassetteSheet
            {
                CassetteBusinessKey = businessKey,
                MatId = request.MatId,
                AddedBy = userName,
                SortOrder = maxOrder + 1
            };

            _context.Set<CassetteSheet>().Add(cassetteSheet);
            await _context.SaveChangesAsync();

            // Лог
            await using var con = await _dataSource.OpenConnectionAsync();
            await LogAuditAsync(con, businessKey, "add_sheet", request.MatId, userName,
                new { melt = sheet.MeltNumber, sheet = sheet.SheetNumber });

            _logger.LogInformation("Лист {MatId} добавлен в кассету {Key} оператором {User}",
                request.MatId, businessKey, userName);

            return Ok(new { message = "Лист добавлен в кассету", sortOrder = cassetteSheet.SortOrder });
        }

        /// <summary>
        /// DELETE /api/cassette/{businessKey}/remove-sheet/{matId}
        /// Удалить лист из кассеты. ТОЛЬКО master/superadmin/developer.
        /// </summary>
        [HttpDelete("{businessKey}/remove-sheet/{matId}")]
        public async Task<IActionResult> RemoveSheetFromCassette(
            string businessKey, string matId, [FromBody] EditReasonRequest? request)
        {
            if (!IsMasterOrAbove())
                return Forbid("Удаление листов из кассеты доступно только мастеру или администратору");

            var userName = GetUserName();

            var cassetteSheet = await _context.Set<CassetteSheet>()
                .FirstOrDefaultAsync(cs => cs.CassetteBusinessKey == businessKey && cs.MatId == matId);

            if (cassetteSheet == null)
                return NotFound(new { message = "Лист не найден в кассете" });

            _context.Set<CassetteSheet>().Remove(cassetteSheet);
            await _context.SaveChangesAsync();

            // Лог
            await using var con = await _dataSource.OpenConnectionAsync();
            await LogAuditAsync(con, businessKey, "remove_sheet", matId, userName,
                new { reason = request?.Reason ?? "Не указана" });

            _logger.LogWarning("🔧 Лист {MatId} УДАЛЁН из кассеты {Key} мастером {User}. Причина: {Reason}",
                matId, businessKey, userName, request?.Reason);

            return Ok(new { message = "Лист удалён из кассеты" });
        }

        /// <summary>
        /// PUT /api/cassette/{businessKey}/edit-measurement/{matId}
        /// Редактировать замеры планшетности листа в кассете. ТОЛЬКО master+.
        /// </summary>
        [HttpPut("{businessKey}/edit-measurement/{matId}")]
        public async Task<IActionResult> EditMeasurement(
            string businessKey, string matId, [FromBody] EditMeasurementRequest request)
        {
            if (!IsMasterOrAbove())
                return Forbid("Редактирование замеров доступно только мастеру или администратору");

            var userName = GetUserName();

            // Проверяем, что лист в кассете
            var inCassette = await _context.Set<CassetteSheet>()
                .AnyAsync(cs => cs.CassetteBusinessKey == businessKey && cs.MatId == matId);

            if (!inCassette)
                return BadRequest(new { message = "Лист не найден в кассете" });

            // Находим последнюю запись измерений
            var measurement = await _context.Set<SheetMeasurement>()
                .Where(m => m.MatId == matId && m.MeasuredAt != null)
                .OrderByDescending(m => m.MeasuredAt)
                .FirstOrDefaultAsync();

            if (measurement == null)
                return NotFound(new { message = "Замеры для этого листа не найдены" });

            // Сохраняем старые значения для лога
            var oldValues = new
            {
                measurement.H1Before,
                measurement.H2Before,
                measurement.H3Before,
                measurement.H4Before,
                measurement.H5Before,
                measurement.H6Before,
                measurement.H7Before,
                measurement.H8Before,
                measurement.H1After,
                measurement.H2After,
                measurement.H3After,
                measurement.H4After,
                measurement.H5After,
                measurement.H6After,
                measurement.H7After,
                measurement.H8After
            };

            // Обновляем замеры
            if (request.H1Before.HasValue) measurement.H1Before = request.H1Before;
            if (request.H2Before.HasValue) measurement.H2Before = request.H2Before;
            if (request.H3Before.HasValue) measurement.H3Before = request.H3Before;
            if (request.H4Before.HasValue) measurement.H4Before = request.H4Before;
            if (request.H5Before.HasValue) measurement.H5Before = request.H5Before;
            if (request.H6Before.HasValue) measurement.H6Before = request.H6Before;
            if (request.H7Before.HasValue) measurement.H7Before = request.H7Before;
            if (request.H8Before.HasValue) measurement.H8Before = request.H8Before;
            if (request.H1After.HasValue) measurement.H1After = request.H1After;
            if (request.H2After.HasValue) measurement.H2After = request.H2After;
            if (request.H3After.HasValue) measurement.H3After = request.H3After;
            if (request.H4After.HasValue) measurement.H4After = request.H4After;
            if (request.H5After.HasValue) measurement.H5After = request.H5After;
            if (request.H6After.HasValue) measurement.H6After = request.H6After;
            if (request.H7After.HasValue) measurement.H7After = request.H7After;
            if (request.H8After.HasValue) measurement.H8After = request.H8After;

            measurement.EditedAt = DateTime.UtcNow;
            measurement.EditedBy = userName;

            await _context.SaveChangesAsync();

            // Лог
            await using var con = await _dataSource.OpenConnectionAsync();
            await LogAuditAsync(con, businessKey, "edit_measurement", matId, userName,
                new { reason = request.Reason, oldValues, newValues = request });

            _logger.LogWarning("🔧 Замеры листа {MatId} ОТРЕДАКТИРОВАНЫ мастером {User}. Причина: {Reason}",
                matId, userName, request.Reason);

            return Ok(new { message = "Замеры обновлены" });
        }

        /// <summary>
        /// POST /api/cassette/{businessKey}/finish
        /// Завершить формирование кассеты. Отправляет в печь отпуска.
        /// </summary>
        [HttpPost("{businessKey}/finish")]
        public async Task<IActionResult> FinishCassette(string businessKey, [FromBody] FinishCassetteRequest request)
        {
            var userName = GetUserName();

            var sheets = await _context.Set<CassetteSheet>()
                .Where(cs => cs.CassetteBusinessKey == businessKey)
                .ToListAsync();

            if (sheets.Count == 0)
                return BadRequest(new { message = "Кассета пуста. Добавьте хотя бы один лист." });

            // Извлекаем номер кассеты из бизнес-ключа
            var cassetteNumber = businessKey.Split('/')[0];

            // Ещё раз проверяем, не занята ли печь этой кассетой
            await using var con = await _dataSource.OpenConnectionAsync();
            var isClosed = await con.QueryFirstOrDefaultAsync<bool>(
    "SELECT is_closed FROM mes.active_cassettes WHERE business_key = @Key",
    new { Key = businessKey });

            if (!isClosed)
            {
                return BadRequest(new
                {
                    message = "Кассета ещё не закрыта! Сначала нажмите «Закончить формирование»."
                });
            }
            var inFurnace = await con.QueryFirstOrDefaultAsync<int>(
                @"SELECT COUNT(*) FROM mes.furnace_cassette_sessions 
              WHERE cassette_id = @CassNo AND unloaded_at IS NULL",
                new { CassNo = cassetteNumber });

            if (inFurnace > 0)
                return BadRequest(new { message = $"Кассета №{cassetteNumber} уже в печи!" });

            // Создаём сессию печи
            await con.ExecuteAsync(
                @"INSERT INTO mes.furnace_cassette_sessions 
              (furnace_number, cassette_id, loaded_at, loaded_by, status)
              VALUES (@Furnace, @CassId, NOW(), @User, 'Загружена')",
                new
                {
                    Furnace = request.FurnaceNumber,
                    CassId = cassetteNumber,
                    User = userName
                });

            // Обновляем статусы листов
            foreach (var cs in sheets)
            {
                var sheet = await _context.InputData.FindAsync(cs.MatId);
                if (sheet != null)
                {
                    sheet.Status = "Добавлен в кассету";
                    sheet.QuenchingStatus = "В кассете";
                }
            }
            await _context.SaveChangesAsync();

            // Лог
            await LogAuditAsync(con, businessKey, "finish", null, userName,
                new { furnace = request.FurnaceNumber, sheetCount = sheets.Count });

            _logger.LogInformation(
                "✅ Кассета {Key} завершена. {Count} листов отправлено в печь №{Furnace} оператором {User}",
                businessKey, sheets.Count, request.FurnaceNumber, userName);
            await con.ExecuteAsync(
    "DELETE FROM mes.active_cassettes WHERE business_key = @Key",
    new { Key = businessKey });
            return Ok(new
            {
                message = $"Кассета отправлена в печь №{request.FurnaceNumber}",
                sheetCount = sheets.Count
            });
        }

        /// <summary>
        /// GET /api/cassette/furnaces-status
        /// Какие кассеты сейчас в печах (для блокировки номеров)
        /// </summary>
        [HttpGet("furnaces-status")]
        public async Task<IActionResult> GetFurnacesStatus()
        {
            await using var con = await _dataSource.OpenConnectionAsync();
            var sessions = await con.QueryAsync(
                @"SELECT furnace_number, cassette_id, loaded_at, loaded_by, status
              FROM mes.furnace_cassette_sessions
              WHERE unloaded_at IS NULL
              ORDER BY furnace_number");

            return Ok(sessions);
        }

        // ── Вспомогательный метод аудита ──
        private async Task LogAuditAsync(
            NpgsqlConnection con, string businessKey, string action,
            string? matId, string user, object? details)
        {
            await con.ExecuteAsync(
                @"INSERT INTO mes.cassette_audit_log 
              (cassette_business_key, action, mat_id, details, performed_by)
              VALUES (@Key, @Action, @MatId, @Details::jsonb, @User)",
                new
                {
                    Key = businessKey,
                    Action = action,
                    MatId = matId,
                    Details = details != null
                        ? System.Text.Json.JsonSerializer.Serialize(details)
                        : null,
                    User = user
                });
        }

        /// <summary>
        /// POST /api/cassette/{businessKey}/close
        /// Закрыть кассету (завершить формирование). Только после этого можно отправить в печь.
        /// </summary>
        [HttpPost("{businessKey}/close")]
        public async Task<IActionResult> CloseCassette(string businessKey)
        {
            var userName = GetUserName();

            await using var con = await _dataSource.OpenConnectionAsync();

            // Проверяем, существует ли активная кассета
            var exists = await con.QueryFirstOrDefaultAsync<bool>(
                "SELECT COUNT(*) > 0 FROM mes.active_cassettes WHERE business_key = @Key",
                new { Key = businessKey });

            if (!exists)
                return NotFound(new { message = "Активная кассета не найдена" });

            // Проверяем, есть ли листы в кассете
            var sheetCount = await con.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM mes.cassette_sheets WHERE cassette_business_key = @Key",
                new { Key = businessKey });

            if (sheetCount == 0)
                return BadRequest(new { message = "Нельзя закрыть пустую кассету. Добавьте хотя бы один лист." });

            // Закрываем кассету
            await con.ExecuteAsync(
                @"UPDATE mes.active_cassettes 
          SET is_closed = TRUE, closed_at = NOW(), closed_by = @User
          WHERE business_key = @Key",
                new { Key = businessKey, User = userName });

            // Лог
            await LogAuditAsync(con, businessKey, "close", null, userName,
                new { sheetCount });

            _logger.LogInformation("🔒 Кассета {Key} ЗАКРЫТА оператором {User}. Листов: {Count}",
                businessKey, userName, sheetCount);

            return Ok(new { message = "Кассета закрыта. Теперь можно отправить в печь.", sheetCount });
        }

        /// <summary>
        /// GET /api/cassette/{businessKey}/status
        /// Получить статус активной кассеты (для фронтенда)
        /// </summary>
        [HttpGet("{businessKey}/status")]
        public async Task<IActionResult> GetCassetteStatus(string businessKey)
        {
            await using var con = await _dataSource.OpenConnectionAsync();

            var status = await con.QueryFirstOrDefaultAsync(
                @"SELECT business_key, cassette_number, created_at, created_by,
                 is_closed, closed_at, closed_by,
                 (SELECT COUNT(*) FROM mes.cassette_sheets WHERE cassette_business_key = @Key) AS sheet_count
          FROM mes.active_cassettes
          WHERE business_key = @Key",
                new { Key = businessKey });

            if (status == null)
                return NotFound(new { message = "Активная кассета не найдена" });

            return Ok(status);
        }

        /// <summary>
        /// GET /api/cassette/history?page=1&pageSize=30
        /// История завершённых кассет
        /// </summary>
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] int page = 1, [FromQuery] int pageSize = 30)
        {
            await using var con = await _dataSource.OpenConnectionAsync();

            var totalCount = await con.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM mes.furnace_cassette_sessions WHERE unloaded_at IS NOT NULL");

            var sessions = await con.QueryAsync(
                @"SELECT fcs.id, fcs.furnace_number, fcs.cassette_id, 
                 fcs.loaded_at, fcs.loaded_by, fcs.unloaded_at, fcs.unloaded_by,
                 fcs.completed_by_plc, fcs.status,
                 (SELECT COUNT(*) FROM mes.cassette_sheets cs 
                  WHERE cs.cassette_business_key LIKE fcs.cassette_id || '/%') AS sheet_count
          FROM mes.furnace_cassette_sessions fcs
          WHERE fcs.unloaded_at IS NOT NULL
          ORDER BY fcs.unloaded_at DESC
          LIMIT @Limit OFFSET @Offset",
                new { Limit = pageSize, Offset = (page - 1) * pageSize });

            return Ok(new { sessions, totalCount, page, pageSize });
        }

        /// <summary>
        /// GET /api/cassette/{businessKey}/audit
        /// Аудит-лог конкретной кассеты
        /// </summary>
        [HttpGet("{businessKey}/audit")]
        public async Task<IActionResult> GetAuditLog(string businessKey)
        {
            await using var con = await _dataSource.OpenConnectionAsync();
            var logs = await con.QueryAsync(
                @"SELECT action, mat_id, details, performed_by, performed_at
          FROM mes.cassette_audit_log
          WHERE cassette_business_key = @Key
          ORDER BY performed_at ASC",
                new { Key = businessKey });

            return Ok(logs);
        }
    }


}
// ── DTOs ──────────────────────────────────────────────────────────────

public class CreateCassetteRequestnew
{
    public int CassetteNumber { get; set; }
}

public class AddSheetRequest
{
    public string MatId { get; set; } = string.Empty;
}

public class EditReasonRequest
{
    public string? Reason { get; set; }
}

public class EditMeasurementRequest
{
    public string? Reason { get; set; }
    public float? H1Before { get; set; }
    public float? H2Before { get; set; }
    public float? H3Before { get; set; }
    public float? H4Before { get; set; }
    public float? H5Before { get; set; }
    public float? H6Before { get; set; }
    public float? H7Before { get; set; }
    public float? H8Before { get; set; }
    public float? H1After { get; set; }
    public float? H2After { get; set; }
    public float? H3After { get; set; }
    public float? H4After { get; set; }
    public float? H5After { get; set; }
    public float? H6After { get; set; }
    public float? H7After { get; set; }
    public float? H8After { get; set; }
}

public class FinishCassetteRequest
{
    public int FurnaceNumber { get; set; }
}