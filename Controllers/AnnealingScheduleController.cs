
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data; 
using MES_ME.Server.Models; 
using System.ComponentModel.DataAnnotations; // Для Required и других атрибутов
using MES_ME.Server.DTOs;   
using Npgsql; // Для обработки специфичных ошибок PostgreSQL

namespace MES_ME.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AnnealingScheduleController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AnnealingScheduleController(AppDbContext context)
        {
            _context = context;
        }

        // --- МЕТОД 1: Создание записи в плане закалки ---
        [HttpPost]
        public async Task<IActionResult> CreateAnnealingSchedule([FromBody] CreateAnnealingScheduleRequest request)
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

            // Проверяем, существует ли лист
            var sheetExists = await _context.InputData.AnyAsync(s => s.MatId == request.MatId);
            if (!sheetExists)
            {
                return NotFound(new { message = $"Лист с ID {request.MatId} не найден." });
            }

            // Проверяем, нет ли уже плана закалки для этого листа
            var existingPlan = await _context.AnnealingSchedules.AnyAsync(plan => plan.MatId == request.MatId);
            if (existingPlan)
            {
                return BadRequest(new { message = $"План закалки для листа {request.MatId} уже существует." });
            }

            var currentUser = HttpContext.User.Identity.Name; // Получаем имя текущего пользователя

            var scheduleEntry = new AnnealingSchedule
            {
                MatId = request.MatId,
                SequenceNumber = request.SequenceNumber,
                FurnaceNumber = request.FurnaceNumber,
                ScheduledStartTime = request.ScheduledStartTime,
                ScheduledEndTime = request.ScheduledEndTime,
                Notes = request.Notes,
                CreatedBy = currentUser
            };

            _context.AnnealingSchedules.Add(scheduleEntry);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при создании плана закалки: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при создании плана закалки." });
            }

            return CreatedAtAction(nameof(GetAnnealingScheduleById), new { id = scheduleEntry.AnnealingPlanId }, scheduleEntry);
        }

        // --- МЕТОД 2: Получение записи плана закалки по ID ---
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAnnealingScheduleById(int id)
        {
            var entry = await _context.AnnealingSchedules
                                      .Include(e => e.Sheet) // Подгружаем информацию о листе, если навигационное свойство есть
                                      .FirstOrDefaultAsync(e => e.AnnealingPlanId == id);

            if (entry == null)
            {
                return NotFound(new { message = $"Запись плана закалки с ID {id} не найдена." });
            }

            return Ok(entry);
        }

        // --- МЕТОД 3: Получение списка записей плана закалки (с фильтрацией, пагинацией) ---
        [HttpGet]
        public async Task<IActionResult> GetAllAnnealingSchedules(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? statusFilter = null,
            [FromQuery] string? matIdFilter = null,
            [FromQuery] string? furnaceNumberFilter = null
        // Добавьте другие фильтры по мере необходимости
        )
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 10;

            var query = _context.AnnealingSchedules.AsQueryable();

            // Применяем фильтры
            if (!string.IsNullOrEmpty(statusFilter))
            {
                query = query.Where(e => e.Status.Contains(statusFilter));
            }
            if (!string.IsNullOrEmpty(matIdFilter))
            {
                query = query.Where(e => e.MatId.Contains(matIdFilter));
            }
            if (!string.IsNullOrEmpty(furnaceNumberFilter))
            {
                query = query.Where(e => e.FurnaceNumber.Contains(furnaceNumberFilter));
            }
            // ... добавьте другие фильтры ...

            var totalCount = await query.CountAsync();

            var data = await query
                           .Include(e => e.Sheet) // Подгружаем информацию о листе
                           .OrderBy(e => e.SequenceNumber) // Сортировка, например, по sequence_number
                           .Skip((page - 1) * pageSize)
                           .Take(pageSize)
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

        // --- МЕТОД 4: Обновление статуса выполнения план ---
        [HttpPut("{id}/execute")]
        public async Task<IActionResult> UpdateAnnealingScheduleExecution(int id, [FromBody] UpdateAnnealingScheduleExecutionRequest request)
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

            var entry = await _context.AnnealingSchedules.FindAsync(id);
            if (entry == null)
            {
                return NotFound(new { message = $"Запись плана закалки с ID {id} не найдена." });
            }

            var currentUser = HttpContext.User.Identity.Name; // Получаем имя текущего пользователя

            // Обновляем статус выполнения, комментарий, кем и когда
            entry.Status = request.Status;
            entry.ExecutionComment = request.Comment;
            entry.ExecutedBy = currentUser;
            entry.ExecutedAt = DateTimeOffset.UtcNow;

            // Опционально: обновить ActualEndTime, если статус указывает на завершение
            var completionStatuses = new[] { "Завершено", "Прервано аварией", "Отменено" }; // Уточните список
            if (completionStatuses.Contains(request.Status, StringComparer.OrdinalIgnoreCase))
            {
                if (entry.ActualEndTime == null)
                {
                    entry.ActualEndTime = DateTimeOffset.UtcNow; // Устанавливаем время завершения при первом обновлении в статус завершения
                }
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при обновлении выполнения плана закалки: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при обновлении выполнения плана закалки." });
            }

            return Ok(entry);
        }

        // --- МЕТОД 5: Удаление записи из плана закалки ---
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAnnealingSchedule(int id)
        {
            // Проверка аутентификации и авторизации (например, только для 'master')
            // var currentUser = HttpContext.User;
            // if (!IsUserAuthorized(currentUser, ["master"]))
            // {
            //     return Forbid();
            // }

            var entry = await _context.AnnealingSchedules.FindAsync(id);
            if (entry == null)
            {
                return NotFound(new { message = $"Запись плана закалки с ID {id} не найдена." });
            }

            _context.AnnealingSchedules.Remove(entry);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при удалении плана закалки: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при удалении плана закалки." });
            }

            return NoContent(); // 204 No Content
        }
    }
}