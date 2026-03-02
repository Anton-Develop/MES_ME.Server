using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data; 
using MES_ME.Server.Models; 
using System.ComponentModel.DataAnnotations; 
using MES_ME.Server.DTOs; 
using Npgsql; 

namespace MES_ME.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CassetteController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CassetteController(AppDbContext context)
        {
            _context = context;
        }

        // --- МЕТОД 1: Создание новой кассеты (Пункт 1.c) ---
        [HttpPost]
        public async Task<IActionResult> CreateCassette([FromBody] CreateCassetteRequest request)
        {
            // Проверка аутентификации и авторизации (например, только для 'master' или 'operator')
            // var currentUser = HttpContext.User; // Получить текущего пользователя
            // if (!IsUserAuthorized(currentUser, ["master", "operator"])) // Условная проверка
            // {
            //     return Forbid(); // Forbidden
            // }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Генерация нового уникального ID для кассеты
            // Ищем последнюю созданную кассету и увеличиваем номер
            // Формат: CAS0000001, CAS0000002, ... (теперь 10 символов максимум)
            string newCassetteId;
            var lastCassette = await _context.Cassettes
                                           .OrderByDescending(c => c.CassetteId)
                                           .FirstOrDefaultAsync(c => c.CassetteId.StartsWith("CAS"));

            int nextNumber = 1;
            if (lastCassette != null)
            {
                var lastNumberStr = lastCassette.CassetteId.Substring(3); // Убираем "CAS"
                if (int.TryParse(lastNumberStr, out int lastNumber))
                {
                    nextNumber = lastNumber + 1;
                }
            }
            // Изменяем формат с D8 на D7, чтобы уложиться в 10 символов (CAS + 7 цифр)
            newCassetteId = $"CAS{nextNumber:D7}"; // Формат: CAS + 7 цифр с ведущими нулями

            // Проверяем, не существует ли уже кассеты с таким ID (на случай гонки)
            while (await _context.Cassettes.AnyAsync(c => c.CassetteId == newCassetteId))
            {
                nextNumber++;
                newCassetteId = $"CAS{nextNumber:D7}";
            }

            var currentUser = HttpContext.User.Identity.Name; // Получаем имя текущего пользователя

            var cassette = new Cassette
            {
                CassetteId = newCassetteId,
                Status = "Создана",
                CreatedBy = currentUser, // Кто создал
                Notes = request.Notes // Заметки (если переданы)
            };

            _context.Cassettes.Add(cassette);

            try
            {
                // 1. Сохраняем только кассету, чтобы получить ID в БД
                await _context.SaveChangesAsync();
                // Теперь cassette.CassetteId гарантированно сохранён в БД
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при сохранении кассеты: {ex.Message}");
                if (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "22001") // Проверка на длину строки
                {
                    return StatusCode(500, new { message = "Ошибка: Сгенерированный идентификатор кассеты слишком длинный." });
                }
                // Любая другая ошибка при сохранении кассеты
                return StatusCode(500, new { message = "Произошла ошибка при создании кассеты." });
            }

            // 2. Создаём запись в логе статусов (теперь cassetteId существует в БД)
            var logEntry = new CassetteStatusLog
            {
                CassetteId = cassette.CassetteId, // Теперь используем ID, который был только что сохранён
                OldStatus = null, // Нет предыдущего статуса при создании
                NewStatus = cassette.Status,
                ChangedBy = currentUser,
                Comment = "Кассета создана" // Комментарий по умолчанию при создании
            };
            _context.CassetteStatusLogs.Add(logEntry);

            try
            {
                // 3. Сохраняем запись в логе
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при сохранении лога статуса: {ex.Message}");
                // Важно: Кассета уже создана, но лог не записан. Это нарушение логики.
                // В реальном приложении может потребоваться Rollback или специальная обработка.
                // Здесь просто возвращаем ошибку.
                return StatusCode(500, new { message = "Произошла ошибка при сохранении лога статуса кассеты." });
            }

            // 4. Возвращаем результат
            return CreatedAtAction(nameof(GetCassetteById), new { id = cassette.CassetteId }, cassette);
        }

        // --- МЕТОД 2: Изменение статуса кассеты (Пункт 1.e) ---
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateCassetteStatus(string id, [FromBody] UpdateCassetteStatusRequest request)
        {
            // Проверка аутентификации и авторизации (например, только для 'master' или 'operator')
            // var currentUser = HttpContext.User;
            // if (!IsUserAuthorized(currentUser, ["master", "operator"]))
            // {
            //     return Forbid();
            // }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var cassette = await _context.Cassettes.FindAsync(id);
            if (cassette == null)
            {
                return NotFound(new { message = $"Кассета с ID {id} не найдена." });
            }

            // Проверяем, можно ли изменить статус (опционально, можно добавить бизнес-логику)
            // Например, нельзя изменить статус "Завершена" или "Отменена" на "Формируется"
            var oldStatus = cassette.Status;
            if (IsTerminalStatus(oldStatus) && request.NewStatus != oldStatus)
            {
                 return BadRequest(new { message = $"Невозможно изменить статус кассеты из '{oldStatus}' на '{request.NewStatus}'." });
            }

            var currentUser = HttpContext.User.Identity.Name; // Получаем имя текущего пользователя

            // Обновляем статус кассеты
            cassette.Status = request.NewStatus;
            // Если переданы заметки, можно обновить их
            if (!string.IsNullOrEmpty(request.Notes))
            {
                cassette.Notes = request.Notes;
            }

            // Создаём запись в логе статусов
            var logEntry = new CassetteStatusLog
            {
                CassetteId = cassette.CassetteId,
                OldStatus = oldStatus,
                NewStatus = request.NewStatus,
                ChangedBy = currentUser,
                Comment = request.Comment // Комментарий, переданный пользователем
            };
            _context.CassetteStatusLogs.Add(logEntry);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при обновлении статуса кассеты: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при обновлении статуса кассеты." });
            }

            // Возвращаем обновлённую кассету
            return Ok(cassette);
        }

        // --- МЕТОД 3: Получение кассеты по ID ---
        [HttpGet("{id}")]
        public async Task<IActionResult> GetCassetteById(string id)
        {
            var cassette = await _context.Cassettes.FindAsync(id);
            if (cassette == null)
            {
                return NotFound(new { message = $"Кассета с ID {id} не найдена." });
            }

            return Ok(cassette);
        }

        // --- МЕТОД 4: Получение истории статусов кассеты ---
        [HttpGet("{id}/status-history")]
        public async Task<IActionResult> GetCassetteStatusHistory(string id)
        {
            var history = await _context.CassetteStatusLogs.Where(l => l.CassetteId == id)
                                   .OrderBy(l => l.ChangeTimestamp)
                                   .ToListAsync();

            if (history == null || !history.Any())
            {
                return NotFound(new { message = $"История статусов для кассеты с ID {id} не найдена." });
            }

            return Ok(history);
        }

        // --- МЕТОД 5: Получение списка всех кассет ---
        [HttpGet]
        public async Task<IActionResult> GetAllCassettes()
        {
            // Проверка аутентификации и авторизации (например, только для 'master', 'operator', 'admin')
            // var currentUser = HttpContext.User;
            // if (!IsUserAuthorized(currentUser, ["master", "operator", "admin"]))
            // {
            //     return Forbid();
            // }

            var cassettes = await _context.Cassettes
                                          .OrderByDescending(c => c.CreatedAt) // Сортировка по дате создания, например
                                          .ToListAsync();

            return Ok(cassettes);
        }

        // --- МЕТОД 6: Получение списка доступных листов (не связанных с кассетами) ---
        [HttpGet("available-sheets")]
       public async Task<IActionResult> GetAvailableSheets(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? matIdFilter = null,
        [FromQuery] string? meltNumberFilter = null,
        [FromQuery] string? batchNumberFilter = null,
        [FromQuery] string? packNumberFilter = null,
        [FromQuery] string? steelGradeFilter = null,
        [FromQuery] string? sheetDimensionsFilter = null,
        [FromQuery] string? sheetNumberFilter = null
        // Добавьте другие фильтры по мере необходимости
    )
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 10; // Ограничим максимальный размер страницы

        // Запрос для получения листов, у которых нет связи в sheet_cassette_links
        var query = _context.InputData
                            .Where(sheet => !_context.SheetCassetteLinks.Any(link => link.MatId == sheet.MatId)); // Фильтр на отсутствие связи

        // Применяем фильтры
        if (!string.IsNullOrEmpty(matIdFilter))
        {
            query = query.Where(s => s.MatId.Contains(matIdFilter));
        }
        if (!string.IsNullOrEmpty(meltNumberFilter))
        {
            query = query.Where(s => s.MeltNumber.Contains(meltNumberFilter));
        }
        if (!string.IsNullOrEmpty(batchNumberFilter))
        {
            query = query.Where(s => s.BatchNumber.Contains(batchNumberFilter));
        }
        if (!string.IsNullOrEmpty(packNumberFilter))
        {
            query = query.Where(s => s.PackNumber.Contains(packNumberFilter));
        }
        if (!string.IsNullOrEmpty(steelGradeFilter))
        {
            query = query.Where(s => s.SteelGrade.Contains(steelGradeFilter));
        }
        if (!string.IsNullOrEmpty(sheetDimensionsFilter))
        {
            query = query.Where(s => s.SheetDimensions.Contains(sheetDimensionsFilter));
        }
        if (!string.IsNullOrEmpty(sheetNumberFilter))
        {
            query = query.Where(s => s.SheetNumber.Contains(sheetNumberFilter));
        }
        // ... добавьте другие фильтры ...

        var totalCount = await query.CountAsync();

        var data = await query
                       .Skip((page - 1) * pageSize)
                       .Take(pageSize)
                       .Select(s => new // Используем анонимный тип или DTO
                       {
                           s.MatId,
                           s.Status,
                           s.MeltNumber, // Добавлено
                           s.BatchNumber, // Добавлено
                           s.PackNumber, // Добавлено
                           s.SteelGrade, // Добавлено
                           s.SheetDimensions, // Добавлено
                           s.SheetNumber // Уже было
                           // Добавьте другие нужные поля
                       })
                       .ToListAsync();

        var result = new
        {
            Data = data,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        };

        return Ok(result);
    }

        // --- МЕТОД 7: Получение списка листов, связанных с кассетой ---
        [HttpGet("{cassetteId}/sheets")]
        public async Task<IActionResult> GetSheetsForCassette(string cassetteId)
        {
            // Проверка существования кассеты (опционально, но рекомендуется)
            var cassetteExists = await _context.Cassettes.AnyAsync(c => c.CassetteId == cassetteId);
            if (!cassetteExists)
            {
                return NotFound(new { message = $"Кассета с ID {cassetteId} не найдена." });
            }

            // Запрос для получения листов, связанных с конкретной кассетой
            var linkedSheets = await _context.SheetCassetteLinks
                                             .Where(link => link.CassetteId == cassetteId)
                                             .Include(link => link.Sheet) // Загружаем данные листа
                                             .Select(link => link.Sheet) // Возвращаем только листы
                                             .ToListAsync();

            return Ok(linkedSheets);
        }

        // --- МЕТОД 8: Добавление листа в кассету ---
        [HttpPost("{cassetteId}/add-sheet")]
        public async Task<IActionResult> AddSheetToCassette(string cassetteId, [FromBody] AddSheetToCassetteRequest request)
        {
            // Проверка аутентификации и авторизации (например, только для 'master', 'operator')
            // var currentUser = HttpContext.User;
            // if (!IsUserAuthorized(currentUser, ["master", "operator"]))
            // {
            //     return Forbid();
            // }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Проверяем, существует ли кассета
            var cassetteExists = await _context.Cassettes.AnyAsync(c => c.CassetteId == cassetteId);
            if (!cassetteExists)
            {
                return NotFound(new { message = $"Кассета с ID {cassetteId} не найдена." });
            }

            // Проверяем, существует ли лист
            var sheetExists = await _context.InputData.AnyAsync(s => s.MatId == request.MatId);
            if (!sheetExists)
            {
                return NotFound(new { message = $"Лист с ID {request.MatId} не найден." });
            }

            // Проверяем, не связан ли лист уже с *другой* кассетой (уникальность)
            var existingLink = await _context.SheetCassetteLinks
                                              .FirstOrDefaultAsync(link => link.MatId == request.MatId);
            if (existingLink != null)
            {
                // Возвращаем ошибку, если лист уже в другой кассете
                if (existingLink.CassetteId != cassetteId)
                {
                    return BadRequest(new { message = $"Лист {request.MatId} уже связан с кассетой {existingLink.CassetteId}." });
                }
                // Если лист уже в *этой* кассете, возвращаем Ok (или NoContent)
                return Ok(new { message = $"Лист {request.MatId} уже находится в кассете {cassetteId}." });
            }

            var currentUser = HttpContext.User.Identity.Name; // Получаем имя текущего пользователя

            var link = new SheetCassetteLink
            {
                MatId = request.MatId,
                CassetteId = cassetteId,
                AssignedBy = currentUser // Кто добавил
            };

            _context.SheetCassetteLinks.Add(link);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при добавлении листа в кассету: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при добавлении листа в кассету." });
            }

            return Ok(new { message = $"Лист {request.MatId} успешно добавлен в кассету {cassetteId}." });
        }

        // --- МЕТОД 9: Удаление листа из кассеты ---
        [HttpDelete("{cassetteId}/remove-sheet/{matId}")]
        public async Task<IActionResult> RemoveSheetFromCassette(string cassetteId, string matId)
        {
            // Проверка аутентификации и авторизации (например, только для 'master', 'operator')
            // var currentUser = HttpContext.User;
            // if (!IsUserAuthorized(currentUser, ["master", "operator"]))
            // {
            //     return Forbid();
            // }

            // Проверяем, существует ли кассета
            var cassetteExists = await _context.Cassettes.AnyAsync(c => c.CassetteId == cassetteId);
            if (!cassetteExists)
            {
                return NotFound(new { message = $"Кассета с ID {cassetteId} не найдена." });
            }

            // Проверяем, существует ли лист
            var sheetExists = await _context.InputData.AnyAsync(s => s.MatId == matId);
            if (!sheetExists)
            {
                return NotFound(new { message = $"Лист с ID {matId} не найден." });
            }

            // Находим связь
            var link = await _context.SheetCassetteLinks
                                      .FirstOrDefaultAsync(l => l.CassetteId == cassetteId && l.MatId == matId);

            if (link == null)
            {
                // Связь не найдена, лист не в этой кассете
                return NotFound(new { message = $"Лист {matId} не найден в кассете {cassetteId}." });
            }

            _context.SheetCassetteLinks.Remove(link);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при удалении листа из кассеты: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при удалении листа из кассеты." });
            }

            return Ok(new { message = $"Лист {matId} успешно удалён из кассеты {cassetteId}." });
        }

        // --- ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Проверка финальных статусов --- Надо сделать чтобы только мастер или суперадмин могли менять
        private static bool IsTerminalStatus(string status)
        {
            // Список статусов, из которых нельзя выйти (по вашей логике)
            var terminalStatuses = new[] { "Завершена", "Отменена" };
            return terminalStatuses.Contains(status, StringComparer.OrdinalIgnoreCase);
        }
    }

    
    
}