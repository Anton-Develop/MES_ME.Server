using MES_ME.Server.Data; 
using MES_ME.Server.DTOs; 
using MES_ME.Server.Models; 
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.ComponentModel.DataAnnotations; // Для Required и других атрибутов
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

            // 1. Добавляем кассету
            _context.Cassettes.Add(cassette);

            try
            {
                // 2. Сохраняем только кассету, чтобы получить ID в БД
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

            // 3. Создаём запись в логе статусов (теперь cassetteId существует в БД)
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
                // 4. Сохраняем запись в логе
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

            // 5. Возвращаем результат
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

        // --- МЕТОД 3: Получение списка всех кассет ---
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

        // --- ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Получение кассеты по ID (для примера) ---
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

        // --- ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Получение истории статусов кассеты ---
        [HttpGet("{id}/status-history")]
        public async Task<IActionResult> GetCassetteStatusHistory(string id)
        {
            var history = await _context.CassetteStatusLogs
                                       .Where(l => l.CassetteId == id)
                                       .OrderBy(l => l.ChangeTimestamp)
                                       .ToListAsync();

            if (history == null || !history.Any())
            {
                return NotFound(new { message = $"История статусов для кассеты с ID {id} не найдена." });
            }

            return Ok(history);
        }

        // --- ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Проверка финальных статусов ---
        private static bool IsTerminalStatus(string status)
        {
            // Список статусов, из которых нельзя выйти (по вашей логике)
            var terminalStatuses = new[] { "Завершена", "Отменена" };
            return terminalStatuses.Contains(status, StringComparer.OrdinalIgnoreCase);
        }
    }

    // --- DTOs (Data Transfer Objects) для запросов ---
    // Создайте папку DTOs в проекте, если её нет
    // Файл: DTOs/CreateCassetteRequest.cs
    public class CreateCassetteRequest
    {
        public string? Notes { get; set; } // Опциональные заметки при создании
    }

    // Файл: DTOs/UpdateCassetteStatusRequest.cs
    public class UpdateCassetteStatusRequest
    {
        [Required(ErrorMessage = "Новый статус обязателен.")]
        public string NewStatus { get; set; } = null!;

        public string? Comment { get; set; } // Комментарий при изменении статуса
        public string? Notes { get; set; } // Возможность обновить заметки при смене статуса
    }
}