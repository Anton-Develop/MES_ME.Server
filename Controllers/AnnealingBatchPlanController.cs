// Controllers/AnnealingBatchPlanController.cs
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
    public class AnnealingBatchPlanController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AnnealingBatchPlanController(AppDbContext context)
        {
            _context = context;
        }

        // --- МЕТОД 1: Создание нового плана закалки ---
        [HttpPost]
        public async Task<IActionResult> CreateBatchPlan([FromBody] CreateAnnealingBatchPlanRequest request)
        {
            // Проверка аутентификации и авторизации (например, только для 'master')
            // var currentUser = HttpContext.User;
            // if (!IsUserAuthorized(currentUser, ["master"]))
            // {
            //     return Forbid();
            // }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var currentUser = HttpContext.User.Identity.Name; // Получаем имя текущего пользователя

            var plan = new AnnealingBatchPlan
            {
                PlanName = request.PlanName,
                FurnaceNumber = request.FurnaceNumber,
                ScheduledStartTime = request.ScheduledStartTime,
                ScheduledEndTime = request.ScheduledEndTime,
                Notes = request.Notes,
                CreatedBy = currentUser
            };

            _context.AnnealingBatchPlans.Add(plan);
            await _context.SaveChangesAsync(); // Сохраняем план, чтобы получить PlanId

            // Добавляем связи с листами
            var linksToAdd = new List<AnnealingBatchPlanSheet>();
            foreach (var matId in request.MatIds.Distinct()) // Убираем дубликаты
            {
                // Проверяем, существует ли лист
                var sheetExists = await _context.InputData.AnyAsync(s => s.MatId == matId);
                if (!sheetExists)
                {
                    // Возвращаем ошибку, если лист не найден
                    return NotFound(new { message = $"Лист с ID {matId} не найден." });
                }

                // Проверяем, не входит ли лист уже в *другой* активный план (опционально)
                var existingActiveLink = await _context.AnnealingBatchPlanSheets
                                                       .Include(l => l.BatchPlan) // Подгружаем план
                                                       .AnyAsync(l => l.MatId == matId && l.BatchPlan.Status != "Завершён" && l.BatchPlan.Status != "Отменён");

                if (existingActiveLink)
                {
                    return BadRequest(new { message = $"Лист {matId} уже входит в другой активный план закалки." });
                }

                linksToAdd.Add(new AnnealingBatchPlanSheet
                {
                    PlanId = plan.PlanId,
                    MatId = matId
                });
            }

            _context.AnnealingBatchPlanSheets.AddRange(linksToAdd);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при создании плана закалки и связей: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при создании плана закалки." });
            }

            // Возвращаем созданный план с листами
            var createdPlanWithSheets = await _context.AnnealingBatchPlans
                                                     .Include(bp => bp.LinkedSheets)
                                                     .ThenInclude(ls => ls.Sheet) // Подгружаем информацию о листах
                                                     .FirstOrDefaultAsync(bp => bp.PlanId == plan.PlanId);

            return CreatedAtAction(nameof(GetBatchPlanById), new { id = createdPlanWithSheets!.PlanId }, createdPlanWithSheets);
        }

        // --- МЕТОД 2: Получение плана по ID ---
        [HttpGet("{id}")]
        public async Task<IActionResult> GetBatchPlanById(int id)
        {
            var plan = await _context.AnnealingBatchPlans
                                     .Include(bp => bp.LinkedSheets)
                                     .ThenInclude(ls => ls.Sheet) // Подгружаем информацию о листах
                                     .FirstOrDefaultAsync(bp => bp.PlanId == id);

            if (plan == null)
            {
                return NotFound(new { message = $"План закалки с ID {id} не найден." });
            }

            return Ok(plan);
        }

        // --- МЕТОД 3: Получение списка планов (с фильтрацией, пагинацией) ---
        [HttpGet]
        public async Task<IActionResult> GetAllBatchPlans(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? statusFilter = null,
            [FromQuery] string? furnaceNumberFilter = null
            // Добавьте другие фильтры по мере необходимости
        )
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 10;

            var query = _context.AnnealingBatchPlans.AsQueryable();

            // Применяем фильтры
            if (!string.IsNullOrEmpty(statusFilter))
            {
                query = query.Where(bp => bp.Status.Contains(statusFilter));
            }
            if (!string.IsNullOrEmpty(furnaceNumberFilter))
            {
                query = query.Where(bp => bp.FurnaceNumber.Contains(furnaceNumberFilter));
            }
            // ... добавьте другие фильтры ...

            var totalCount = await query.CountAsync();

            var data = await query
               .Include(bp => bp.LinkedSheets) // Загружаем связи план->листы
               .ThenInclude(ls => ls.Sheet)   // Загружаем листы для каждой связи
               .OrderBy(bp => bp.CreatedAt)
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

        // --- МЕТОД 4: Обновление статуса выполнения плана ---
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateBatchPlanStatus(int id, [FromBody] UpdateAnnealingBatchPlanStatusRequest request)
        {
            // Проверка аутентификации и авторизации (например, только для 'master')
            // var currentUser = HttpContext.User;
            // if (!IsUserAuthorized(currentUser, ["master"]))
            // {
            //     return Forbid();
            // }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var plan = await _context.AnnealingBatchPlans.FindAsync(id);
            if (plan == null)
            {
                return NotFound(new { message = $"План закалки с ID {id} не найден." });
            }

            // Опционально: проверить, можно ли изменить статус
            // var allowedTransitions = new Dictionary<string, List<string>>
            // {
            //     { "Создан", new List<string> { "Готов к запуску", "Отменён" } },
            //     { "уску", new List<string> { "В работе", "Отменён" } },
            //     { "В работе", new List<string> { "Завершён", "Прерван", "Отменён" } },
            //     // ... остальные переходы ...
            // };
            // if (!allowedTransitions.ContainsKey(plan.Status) || !allowedTransitions[plan.Status].Contains(request.Status))
            // {
            //     return BadRequest(new { message = $"Невозможно изменить статус плана из '{plan.Status}' на '{request.Status}'." });
            // }

            var currentUser = HttpContext.User.Identity.Name; // Получаем имя текущего пользователя

            // Обновляем статус плана
            plan.Status = request.Status;
            // Обновляем время начала/окончания в зависимости от статуса
            var now = DateTimeOffset.UtcNow;
            if (request.Status == "В работе" && plan.ActualStartTime == null)
            {
                plan.ActualStartTime = now;
            }
            else if (request.Status == "Завершён" && plan.ActualEndTime == null)
            {
                plan.ActualEndTime = now;
            }
            else if (request.Status == "Прерван" && plan.ActualEndTime == null)
            {
                // Можно установить время окончания при прерывании
                plan.ActualEndTime = now;
            }
            // Не обновляем UpdatedAt, так как это делает EF Core автоматически при изменении сущности

            // Опционально: обновить Notes или создать запись в логе (например, в отдельной таблице) с комментарием

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при обновлении статуса плана закалки: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при обновлении статуса плана закалки." });
            }

            return Ok(plan);
        }

        // --- МЕТОД 5: Удаление плана ---
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBatchPlan(int id)
        {
            // Проверка аутентификации и авторизации (например, только для 'master')
            // var currentUser = HttpContext.User;
            // if (!IsUserAuthorized(currentUser, ["master"]))
            // {
            //     return Forbid();
            // }

            var plan = await _context.AnnealingBatchPlans
                                     .Include(bp => bp.LinkedSheets) // Подгружаем связи
                                     .FirstOrDefaultAsync(bp => bp.PlanId == id);

            if (plan == null)
            {
                return NotFound(new { message = $"План закалки с ID {id} не найден." });
            }

            // Опционально: проверить, можно ли удалить план (например, только если статус "Создан")
            // if (plan.Status != "Создан")
            // {
            //     return BadRequest(new { message = $"Невозможно удалить план с ID {id}, так как его статус '{plan.Status}'." });
            // }

            _context.AnnealingBatchPlans.Remove(plan); // CASCADE удалит и связи

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