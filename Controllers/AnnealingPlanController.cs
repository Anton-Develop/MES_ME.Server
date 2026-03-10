using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Models;
using MES_ME.Server.Data;
using MES_ME.Server.DTOs;

namespace MES_ME.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AnnealingPlanController : ControllerBase
    {
        private readonly AppDbContext _context; // Замените на ваш тип DbContext

        public AnnealingPlanController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AnnealingPlan
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AnnealingPlan>>> GetAnnealingPlans([FromQuery]string? statusFilter = null)
        {
            
            var query = _context.AnnealingPlans.AsQueryable();

            if (!string.IsNullOrEmpty(statusFilter))
            {
                query = query.Where(p => p.Status == statusFilter);
            }

            var plans = await query.OrderBy(p => p.PlanId).ToListAsync(); // Сортировка по ID
            return Ok(plans);
        }

        // GET: api/AnnealingPlan/AP001
        [HttpGet("{id}")]
        public async Task<ActionResult<AnnealingPlan>> GetAnnealingPlan(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return BadRequest(new { message = "ID плана не может быть пустым." });
            }

            var plan = await _context.AnnealingPlans.FindAsync(id);

            if (plan == null)
            {
                return NotFound(new { message = $"План отпуска с ID {id} не найден." });
            }

            return Ok(plan);
        }

        // POST: api/AnnealingPlan
        [HttpPost]
        public async Task<ActionResult<AnnealingPlan>> CreateAnnealingPlan(CreateAnnealingPlanRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            // Генерация ID (например, AP####)
            string newPlanId;
            int counter = 1;
            do
            {
                newPlanId = $"AP{counter:D4}";
                counter++;
            } while (await _context.AnnealingPlans.AnyAsync(p => p.PlanId == newPlanId));

            var plan = new AnnealingPlan
            {
                PlanId = newPlanId,
                PlanName = request.PlanName,
                ScheduledStartTime = request.ScheduledStartTime,
                ScheduledEndTime = request.ScheduledEndTime,
                Status = "Создан", // Статус по умолчанию
                FurnaceNumber = request.FurnaceNumber,
                Notes = request.Notes
                // CassettesCount и TotalWeightKg по умолчанию 0
            };

            _context.AnnealingPlans.Add(plan);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при создании плана отпуска: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при создании плана отпуска." });
            }

            return CreatedAtAction(nameof(GetAnnealingPlan), new { id = plan.PlanId }, plan);
        }

        // PUT: api/AnnealingPlan/AP001
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAnnealingPlan(string id, UpdateAnnealingPlanRequest request)
        {
             if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var plan = await _context.AnnealingPlans.FindAsync(id);

            if (plan == null)
            {
                return NotFound(new { message = $"План отпуска с ID {id} не найден." });
            }

            // Обновляем поля
            plan.PlanName = request.PlanName;
            plan.ScheduledStartTime = request.ScheduledStartTime;
            plan.ScheduledEndTime = request.ScheduledEndTime;
            plan.FurnaceNumber = request.FurnaceNumber;
            plan.Notes = request.Notes;
            // Обновление статуса отдельно (см. метод UpdateStatus)

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _context.AnnealingPlans.AnyAsync(e => e.PlanId == id))
                {
                    return NotFound(new { message = $"План отпуска с ID {id} не найден." });
                }
                else
                {
                    throw;
                }
            }

            return NoContent(); // 204 OK
        }

        // DELETE: api/AnnealingPlan/AP001
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAnnealingPlan(string id)
        {
            var plan = await _context.AnnealingPlans.FindAsync(id);
            if (plan == null)
            {
                return NotFound(new { message = $"План отпуска с ID {id} не найден." });
            }

            // Проверяем, связан ли план с кассетами
            var hasLinkedCassettes = await _context.CassettePlanLinks.AnyAsync(l => l.PlanId == id);
            if (hasLinkedCassettes)
            {
                 // В зависимости от логики, можно вернуть ошибку или удалить связи
                 // Здесь возвращаем ошибку
                 return BadRequest(new { message = $"Невозможно удалить план отпуска {id}, так как он содержит кассеты." });
            }

            _context.AnnealingPlans.Remove(plan);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при удалении плана отпуска {id}: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при удалении плана отпуска." });
            }

            return NoContent(); // 204 OK
        }

        // PUT: api/AnnealingPlan/AP001/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateAnnealingPlanStatusRequest request)
        {
            if (!ModelState.IsValid || string.IsNullOrEmpty(request.NewStatus))
            {
                return BadRequest(ModelState);
            }

            var plan = await _context.AnnealingPlans.FindAsync(id);

            if (plan == null)
            {
                return NotFound(new { message = $"План отпуска с ID {id} не найден." });
            }

            // Здесь можно добавить логику проверки перехода статуса (например, нельзя из "Завершён" вернуться в "Создан")

            // Обновляем статус и, возможно, время начала/окончания
            plan.Status = request.NewStatus;
            if (request.NewStatus == "В работе" && plan.ActualStartTime == null)
            {
                plan.ActualStartTime = DateTime.UtcNow;
            }
            if ((request.NewStatus == "Завершён" || request.NewStatus == "Прерван") && plan.ActualEndTime == null)
            {
                plan.ActualEndTime = DateTime.UtcNow;
            }

            // Если статус плана меняется, возможно, нужно обновить статусы связанных кассет
            // await UpdateCassetteStatusesForPlan(id, request.NewStatus, request.Comment); // Реализовать отдельно

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await _context.AnnealingPlans.AnyAsync(e => e.PlanId == id))
                {
                    return NotFound(new { message = $"План отпуска с ID {id} не найден." });
                }
                else
                {
                    throw;
                }
            }

            return NoContent(); // 204 OK
        }

        // GET: api/AnnealingPlan/AP001/cassettes
        [HttpGet("{id}/cassettes")]
        public async Task<ActionResult<IEnumerable<Cassette>>> GetCassettesForPlan(string id)
        {
             // Проверяем существование плана
             var planExists = await _context.AnnealingPlans.AnyAsync(p => p.PlanId == id);
             if (!planExists)
             {
                 return NotFound(new { message = $"План отпуска с ID {id} не найден." });
             }

             var cassettes = await _context.CassettePlanLinks
                 .Where(l => l.PlanId == id)
                 .Join(_context.Cassettes, // Соединяем с таблицей кассет
                       link => link.CassetteId,
                       cassette => cassette.CassetteId,
                       (link, cassette) => new { Link = link, Cassette = cassette })
                 .Select(joined => joined.Cassette) // Выбираем только кассету
                 .OrderBy(c => c.CassetteId) // Сортировка по ID кассеты
                 .ToListAsync();

             return Ok(cassettes);
        }

        // POST: api/AnnealingPlan/AP001/add-cassette
        [HttpPost("{id}/add-cassette")]
        public async Task<IActionResult> AddCassetteToPlan(string id, [FromBody] AddCassetteToPlanRequest request)
        {
            if (!ModelState.IsValid || string.IsNullOrEmpty(request.CassetteId))
            {
                return BadRequest(ModelState);
            }

            // Проверяем, существует ли план
            var planExists = await _context.AnnealingPlans.AnyAsync(p => p.PlanId == id);
            if (!planExists)
            {
                return NotFound(new { message = $"План отпуска с ID {id} не найден." });
            }

            // Проверяем, существует ли кассета
            var cassetteExists = await _context.Cassettes.AnyAsync(c => c.CassetteId == request.CassetteId);
            if (!cassetteExists)
            {
                return NotFound(new { message = $"Кассета с ID {request.CassetteId} не найдена." });
            }

            // Проверяем, не связана ли кассета уже с *другим* планом отпуска (уникальность)
            var existingLink = await _context.CassettePlanLinks
                .FirstOrDefaultAsync(link => link.CassetteId == request.CassetteId);
            if (existingLink != null)
            {
                // Если кассета уже в *другом* плане отпуска
                if (existingLink.PlanId != id)
                {
                     return Conflict(new { message = $"Кассета с ID {request.CassetteId} уже связана с планом отпуска {existingLink.PlanId}." });
                }
                // Если кассета уже в *этом* плане, возвращаем Ok или Conflict
                return Conflict(new { message = $"Кассета с ID {request.CassetteId} уже находится в плане отпуска {id}." });
            }

            // Создаём связь
            var newLink = new CassettePlanLink { PlanId = id, CassetteId = request.CassetteId, CassetteNumberInPlan = request.CassetteNumberInPlan };
            _context.CassettePlanLinks.Add(newLink);

            // Опционально: обновляем статус кассеты
            // await UpdateCassetteStatus(request.CassetteId, "В плане отпуска"); // Реализовать отдельно

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при добавлении кассеты в план отпуска: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при добавлении кассеты в план отпуска." });
            }

            return Ok(new { message = $"Кассета {request.CassetteId} успешно добавлена в план отпуска {id}." });
        }

        // DELETE: api/AnnealingPlan/AP001/remove-cassette/CAS001
        [HttpDelete("{id}/remove-cassette/{cassetteId}")]
        public async Task<IActionResult> RemoveCassetteFromPlan(string id, string cassetteId)
        {
            // Проверяем, существует ли план
            var planExists = await _context.AnnealingPlans.AnyAsync(p => p.PlanId == id);
            if (!planExists)
            {
                return NotFound(new { message = $"План отпуска с ID {id} не найден." });
            }

             // Проверяем, существует ли кассета
            var cassetteExists = await _context.Cassettes.AnyAsync(c => c.CassetteId == cassetteId);
            if (!cassetteExists)
            {
                return NotFound(new { message = $"Кассета с ID {cassetteId} не найдена." });
            }

            // Находим связь
            var link = await _context.CassettePlanLinks
                .FirstOrDefaultAsync(l => l.PlanId == id && l.CassetteId == cassetteId);

            if (link == null)
            {
                // Связь не найдена, кассета не в этом плане
                return NotFound(new { message = $"Кассета {cassetteId} не найдена в плане отпуска {id}." });
            }

            _context.CassettePlanLinks.Remove(link);

            // Опционально: возвращаем статус кассеты
            // await UpdateCassetteStatus(cassetteId, "Доступна"); // Реализовать отдельно

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при удалении кассеты из плана отпуска: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при удалении кассеты из плана отпуска." });
            }

            return Ok(new { message = $"Кассета {cassetteId} успешно удалена из плана отпуска {id}." });
        }
    }
}
