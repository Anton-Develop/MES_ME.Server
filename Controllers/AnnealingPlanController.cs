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

            [HttpGet("cassette-plan-links")] 
            public async Task<ActionResult<IEnumerable<CassettePlanLink>>> GetAllCassettePlanLinks()
            {
                var links = await _context.CassettePlanLinks
                    .AsNoTracking() // Улучшает производительность, если данные не изменяются
                    .ToListAsync();
                return Ok(links);
            }
        // --- ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Обновление статуса кассеты ---
        private async Task<bool> UpdateCassetteStatus(string cassetteId, string newStatus, string comment = "")
        {
            var cassette = await _context.Cassettes.FindAsync(cassetteId);
            if (cassette == null)
            {
                Console.WriteLine($"Предупреждение: Кассета {cassetteId} не найдена при попытке обновить статус на {newStatus}.");
                return false; // Не удалось найти кассету
            }

            var oldStatus = cassette.Status;
            cassette.Status = newStatus;

            // Опционально: запись в лог статусов кассеты
            // var statusLogEntry = new CassetteStatusLog { ... };
            // _context.CassetteStatusLogs.Add(statusLogEntry);

            Console.WriteLine($"Статус кассеты {cassetteId} изменён с '{oldStatus}' на '{newStatus}'. {(string.IsNullOrEmpty(comment) ? "" : "Комментарий: " + comment)}");

            return true; // Успешно обновлено в памяти, будет сохранено позже
        }
        // --- КОНЕЦ ВСПОМОГАТЕЛЬНОГО МЕТОДА ---

        // GET: api/AnnealingPlan
        // GET: api/AnnealingPlan
        // --- ИЗМЕНЕНО: Добавлена пагинация и фильтрация по furnaceNumber ---
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AnnealingPlan>>> GetAnnealingPlans(
            [FromQuery]int page = 1,
            [FromQuery]int pageSize = 10,
            [FromQuery]string? statusFilter = null,
            [FromQuery]string? furnaceNumberFilter = null) // Добавлен фильтр по печи
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 10; // Ограничим максимальный размер страницы

            var query = _context.AnnealingPlans.AsQueryable();

            if (!string.IsNullOrEmpty(statusFilter))
            {
                query = query.Where(p => p.Status == statusFilter);
            }

            if (!string.IsNullOrEmpty(furnaceNumberFilter))
            {
                query = query.Where(p => p.FurnaceNumber == furnaceNumberFilter); // Или Contains, если нужно частичное совпадение
            }

            // Вычисляем общее количество
            var totalCount = await query.CountAsync();

            var plans = await query
                .OrderBy(p => p.PlanId) // Сортировка
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var result = new
            {
                Data = plans,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            };

            return Ok(result);
        }
        // --- КОНЕЦ ИЗМЕНЕНИЯ ---

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

            // --- ШАГ 1: Генерация и создание самого плана ---
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
                // Status = "Создан", // Пока не меняем, статус установим ниже
                FurnaceNumber = request.FurnaceNumber,
                Notes = request.Notes
                // CassettesCount и TotalWeightKg по умолчанию 0
            };

            _context.AnnealingPlans.Add(plan);

            // --- ШАГ 2: Проверка и добавление кассет ---
            List<CassettePlanLink> linksToAdd = new List<CassettePlanLink>();
            List<string> statusesToReset = new List<string>(); // Для отката в случае ошибки

            if (request.CassettesToInclude != null && request.CassettesToInclude.Any())
            {
                foreach (var cassetteId in request.CassettesToInclude.Distinct()) // Убираем дубликаты
                {
                    // Проверяем, существует ли кассета
                    var cassette = await _context.Cassettes.FindAsync(cassetteId);
                    if (cassette == null)
                    {
                        return NotFound(new { message = $"Кассета с ID {cassetteId} не найдена." });
                    }

                    // Проверяем, не связана ли кассета уже с *другим* планом отпуска
                    var existingLink = await _context.CassettePlanLinks.FirstOrDefaultAsync(l => l.CassetteId == cassetteId);
                    if (existingLink != null)
                    {
                        return Conflict(new { message = $"Кассета с ID {cassetteId} уже связана с планом отпуска {existingLink.PlanId}." });
                    }

                    // Создаём связь
                    var newLink = new CassettePlanLink { PlanId = newPlanId, CassetteId = cassetteId, CassetteNumberInPlan = null }; // Или присвоить номер из запроса
                    linksToAdd.Add(newLink);

                    // Подготовим обновление статуса кассеты (не сохраняем ещё)
                    if (await UpdateCassetteStatus(cassetteId, "Готова к отправке", $"Добавлена в план отпуска {newPlanId}")) // Или "В плане отпуска"
                    {
                         statusesToReset.Add(cassetteId); // Добавляем в список для отката при ошибке
                    }
                    else
                    {
                        // Если кассета не найдена, ошибка уже возвращена из UpdateCassetteStatus
                        // Но если были другие проблемы, можно обработать их здесь
                        return NotFound(new { message = $"Кассета с ID {cassetteId} не найдена." });
                    }
                }

                // Добавляем все связи в контекст
                _context.CassettePlanLinks.AddRange(linksToAdd);

                // Обновляем счётчики в плане
                plan.CassettesCount = linksToAdd.Count;
                // TotalWeightKg можно рассчитать здесь, если известен вес кассет или листов в них
                // plan.TotalWeightKg = ...
            }

            // --- ШАГ 3: Установка статуса плана и сохранение ---
            plan.Status = "Готов к отправке"; // Устанавливаем статус после добавления кассет

            try
            {
                await _context.SaveChangesAsync(); // Сохраняем план, связи и обновлённые статусы кассет в одной транзакции
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при создании плана отпуска: {ex.Message}");
                // Опционально: попытка откатить статусы кассет, если они были изменены (statusesToReset)
                // Это может быть сложно, если транзакция неуспешна. Лучше строго проверять условия до SaveChanges.
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
                 .AsNoTracking() // --- ДОБАВЛЕНО: Улучшает производительность ---
                 .ToListAsync();

             return Ok(cassettes);
        }

        // --- НОВОЕ: Метод для получения доступных кассет для плана ---
        [HttpGet("{id}/available-cassettes")]
        public async Task<ActionResult<IEnumerable<Cassette>>> GetAvailableCassettesForPlan(string id)
        {

            var planExists = await _context.AnnealingPlans.AnyAsync(p => p.PlanId == id);
            if (!planExists)
            {
                return NotFound(new { message = $"План отпуска с ID {id} не найден." });
            }

            // Найти все ID кассет, которые находятся в *других* планах отпуска
            var linkedCassetteIds = await _context.CassettePlanLinks
                .Where(l => l.PlanId != id) // Исключаем кассеты, уже находящиеся в *этом* плане
                .Select(l => l.CassetteId)
                .ToListAsync();

            // Найти все кассеты, которые не находятся в других планах
            var availableCassettes = await _context.Cassettes
                .Where(c => !linkedCassetteIds.Contains(c.CassetteId))
                .OrderBy(c => c.CassetteId) // Сортировка по ID кассеты
                .AsNoTracking() // --- ДОБАВЛЕНО: Улучшает производительность ---
                .ToListAsync();

            return Ok(availableCassettes);
        }
        // --- КОНЕЦ НОВОГО ---

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

            // --- ШАГ 1: Возвращаем статус кассеты ---
            if (!await UpdateCassetteStatus(cassetteId, "Доступна", $"Удалена из плана отпуска {id}")) // Или "Создана", в зависимости от логики
            {
                 // Кассета не найдена, хотя была в связи. Скорее всего ошибка в данных.
                 return StatusCode(500, new { message = $"Критическая ошибка: Кассета {cassetteId} не найдена при попытке сбросить статус." });
            }
            // --- КОНЕЦ ШАГА 1 ---

            // --- ШАГ 2: Обновляем счётчики в плане ---
            var plan = await _context.AnnealingPlans.FindAsync(id);
            if (plan != null) // План должен существовать, если связь была
            {
                plan.CassettesCount = Math.Max(0, plan.CassettesCount - 1); // Защита от отрицательного счёта

                // Опционально: изменить статус плана, если он зависел от наличия кассет
                // Например, если удаляется последняя кассета, статус плана может измениться
                // if (plan.CassettesCount == 0)
                // {
                //     plan.Status = "Создан";
                // }
            }
            // --- КОНЕЦ ШАГА 2 ---

            try
            {
                await _context.SaveChangesAsync(); // Сохраняем удаление связи и обновление статуса кассеты
            }
            catch (DbUpdateException ex)
            {
                // Логирование ошибки
                Console.WriteLine($"Ошибка при удалении кассеты из плана отпуска: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при удалении кассеты из плана отпуска." });
            }

            return Ok(new { message = $"Кассета {cassetteId} успешно удалена из плана отпускататус кассеты сброшен." });
        
        }

    }
}
