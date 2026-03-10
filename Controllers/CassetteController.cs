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

        ///сортировка по Matid    
        query = query.OrderBy(s => s.MatId);

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
           // var sheetExists = await _context.InputData.AnyAsync(s => s.MatId == request.MatId);
            var sheetExists = await _context.InputData.FindAsync(request.MatId); 
            if (sheetExists== null)
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
                    return Conflict(new { message = $"Лист {request.MatId} уже связан с кассетой {existingLink.CassetteId}." });
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
                  // --- НОВОЕ: Обновление статуса листа ---
                // Установим новый статус, например, "В кассете" или "Формируется в кассете"
                // Лучше всего использовать константу или настраиваемое значение
                string newSheetStatus = "В кассете"; // <-- Замените на нужный вам статус или получите из конфигурации/DTO
                sheetExists.Status = newSheetStatus; // Обновляем статус в объекте
                // _context.InputData.Update(sheetExists); // EF может автоматически отследить изменения, но явное обновление гарантирует
                // --- КОНЕЦ НОВОГО ---
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
            var sheetExists = await _context.InputData.FindAsync(matId);
            if (sheetExists==null)
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

            // --- НОВОЕ: Возвращение статуса листа ---
            // Установим статус, например, "Доступен" или "В плане закалки"
            // Лучше всего использовать константу или настраиваемое значение
            string resetSheetStatus = "Подготовлен к прокату"; // <-- Замените на нужный вам статус или получите из конфигурации
            sheetExists.Status = resetSheetStatus; // Обновляем статус в объекте
            // _context.InputData.Update(sheet); // EF может автоматически отследить изменения, но явное обновление гарантирует
            // --- КОНЕЦ НОВОГО ---

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


        // --- МЕТОД 10: Удаление кассеты и освобождение связанных листов ---
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCassette(string id)
        {
            // Проверка аутентификации и авторизации (например, только для 'master' или 'admin')
             var currentUser = HttpContext.User;
             //if (!IsUserAuthorized(currentUser, ["master", "admin"])) // Пример ролей
             //{
             //    return Forbid();
             // }

            // 1. Проверяем, существует ли кассета
            var cassette = await _context.Cassettes.FindAsync(id);
            if (cassette == null)
            {
                return NotFound(new { message = $"Кассета с ID {id} не найдена." });
            }

            // 2. Проверяем статус кассеты. Возможно, удалять можно только кассеты в определённых статусах (например, "Создана", "Формируется").
            // Это зависит от бизнес-логики. Пример:
            if (cassette.Status != "Создана" && cassette.Status != "Формируется")
             {
                 return BadRequest(new { message = $"Невозможно удалить кассету со статусом '{cassette.Status}'." });
             }

            // 3. Находим все связи (SheetCassetteLink), относящиеся к этой кассете
            var linksToRemove = await _context.SheetCassetteLinks
                                              .Where(l => l.CassetteId == id)
                                              .ToListAsync();

             // --- НОВОЕ: Подготовка к возврату статусов листов ---
            List<string> matIdsToReset = new List<string>();
            if (linksToRemove.Any())
            {
                matIdsToReset = linksToRemove.Select(l => l.MatId).ToList();
            }
            // --- КОНЕЦ НОВОГО ---

            if (linksToRemove.Any())
            {
                // 4. Удаляем все найденные связи (освобождаем листы)
                _context.SheetCassetteLinks.RemoveRange(linksToRemove);
                Console.WriteLine($"Освобождено {linksToRemove.Count} листов из кассеты {id}."); // Логирование
            }
            else
            {
                Console.WriteLine($"Кассета {id} не содержала листов, связи для удаления отсутствуют."); // Логирование
            }

            // 5. Удаляем саму кассету
            _context.Cassettes.Remove(cassette);
            
             // --- НОВОЕ: Возврат статусов листов ---
            if (matIdsToReset.Any())
            {
                 string resetSheetStatus = "Подготовлен к прокату"; // <-- Замените на нужный вам статус или получите из конфигурации
                 // Обновляем статусы всех освобождаемых листов
                 // Используем Bulk Update или UpdateMany, если ваш ORM поддерживает (например, EF Core Plus, Z.EntityFramework.Extensions)
                 // В стандартном EF Core проще загрузить объекты и обновить их
                 var sheetsToReset = await _context.InputData
                     .Where(s => matIdsToReset.Contains(s.MatId))
                     .ToListAsync();

                 foreach (var sheet in sheetsToReset)
                 {
                     sheet.Status = resetSheetStatus;
                     // _context.InputData.Update(sheet); // Не обязательно, если объекты уже отслеживаются после ToListAsync
                 }

                 Console.WriteLine($"Сброшены статусы для {sheetsToReset.Count} листов, освобождённых из кассеты {id}."); // Логирование
            }
            // --- КОНЕЦ НОВОГО ---

            try
            {
                // 6. Сохраняем все изменения (и удаление связей, и удаление кассеты) в одной транзакции
                await _context.SaveChangesAsync();
                Console.WriteLine($"Кассета {id} успешно удалена."); // Логирование
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при удалении кассеты {id}: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при удалении кассеты." });
            }

            // 7. Возвращаем успешный ответ
            return Ok(new { message = $"Кассета {id} и все её связи успешно удалены. Листы освобождены." });
        }

         // --- НОВЫЙ МЕТОД: Получение детальной информации о кассете ---
        [HttpGet("{id}/details")]
        public async Task<IActionResult> GetCassetteDetails(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return BadRequest(new { message = "ID кассеты не может быть пустым." });
            }

            try
            {
                // 1. Найти саму кассету
                var cassette = await _context.Cassettes
                    .Where(c => c.CassetteId == id)
                    .Select(c => new
                    {
                        Id = c.CassetteId,
                        Status = c.Status,
                        CreatedAt = c.CreatedAt,
                        CreatedBy = c.CreatedBy,
                        Notes = c.Notes // Предполагается, что Notes есть в модели Cassette
                    })
                    .FirstOrDefaultAsync();

                if (cassette == null)
                {
                    return NotFound(new { message = $"Кассета с ID {id} не найдена." });
                }

                // 2. Найти все листы, связанные с этой кассетой
                var linkedSheets = await _context.SheetCassetteLinks
                    .Where(link => link.CassetteId == id)
                    .Join(_context.InputData, // Соединяем с input_data
                          link => link.MatId,
                          input => input.MatId,
                          (link, input) => new
                          {
                              MatId = input.MatId,
                              MeltNumber = input.MeltNumber,
                              BatchNumber = input.BatchNumber,
                              PackNumber = input.PackNumber,
                              SteelGrade = input.SteelGrade,
                              SheetDimensions = input.SheetDimensions,
                              SlabNumber = input.SheetNumber,
                              
                             
                          })
                    .ToListAsync();


                // 3. Собрать результат
                var result = new
                {
                    Cassette = cassette,
                    Sheets = linkedSheets
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при получении деталей кассеты {id}: {ex.Message}");
                // Логирование ошибки
                return StatusCode(500, new { message = "Произошла ошибка при получении деталей кассеты." });
            }
        }
    }

    
    
}