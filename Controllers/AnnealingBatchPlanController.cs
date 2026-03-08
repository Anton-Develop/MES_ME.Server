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
        [HttpGet("report")]
        public async Task<IActionResult> GetAnnealingReport(
            [FromQuery] DateTime? dateFrom,
            [FromQuery] DateTime? dateTo,
            [FromQuery] string? statusFilter = null,
            [FromQuery] string? furnaceNumberFilter = null)
        {
            var query = _context.AnnealingBatchPlans
                .Include(bp => bp.LinkedSheets)
                .ThenInclude(ls => ls.Sheet)
                .AsQueryable();

            // Фильтрация по датам (берем Planned Start Time как основную дату графика)
            if (dateFrom.HasValue)
            {
                query = query.Where(bp => bp.ScheduledStartTime >= dateFrom.Value);
            }
            if (dateTo.HasValue)
            {
                // Добавляем 1 день, чтобы включить всю дату "до"
                query = query.Where(bp => bp.ScheduledStartTime <= dateTo.Value.AddDays(1).AddTicks(-1));
            }

            if (!string.IsNullOrEmpty(statusFilter))
            {
                query = query.Where(bp => bp.Status.Contains(statusFilter));
            }

            if (!string.IsNullOrEmpty(furnaceNumberFilter))
            {
                query = query.Where(bp => bp.FurnaceNumber.Contains(furnaceNumberFilter));
            }

            // Сортировка по времени начала
            query = query.OrderBy(bp => bp.ScheduledStartTime);

            var data = await query.ToListAsync();

            var reportData = data.Select(bp => new AnnealingReportItem
            {
                PlanId = bp.PlanId,
                PlanName = bp.PlanName,
                Status = bp.Status,
                FurnaceNumber = bp.FurnaceNumber,
                ScheduledStartTime = bp.ScheduledStartTime,
                ScheduledEndTime = bp.ScheduledEndTime,
                ActualStartTime = bp.ActualStartTime,
                ActualEndTime = bp.ActualEndTime,
                Notes = bp.Notes,
                SheetsCount = bp.LinkedSheets.Count,
                //  TotalWeightKg = bp.LinkedSheets.Sum(ls => ls.Sheet != null ? ls.Sheet.ActualNetWeightKg : 0),
                SheetDetails = string.Join(", ", bp.LinkedSheets.Take(5).Select(ls => ls.MatId)) + (bp.LinkedSheets.Count > 5 ? "..." : "")
            }).ToList();

            return Ok(reportData);
        }

        [HttpGet("{id}/details")]
        public async Task<ActionResult<AnnealingPlanDetailsDto>> GetPlanDetails(int id)
        {
            var plan = await _context.AnnealingBatchPlans
                .Include(p => p.LinkedSheets)
                    .ThenInclude(ls => ls.Sheet) // Предполагаем, что есть связь с таблицей листов
                .FirstOrDefaultAsync(p => p.PlanId == id);

            if (plan == null)
            {
                return NotFound();
            }

            var sheetsData = plan.LinkedSheets.Select(ls =>
            {
                var sheet = ls.Sheet;
                return new PlanSheetDetailDto
                {
                    MatId = ls.MatId, // Или sheet.MatId
                    MeltNumber = sheet?.MeltNumber ?? "",
                    BatchNumber = sheet?.BatchNumber ?? "",
                    PackNumber = sheet?.PackNumber ?? "",
                    SteelGrade = sheet?.SteelGrade ?? "",
                    Dimensions = sheet.SheetDimensions ?? "",
                    SlabNumber = sheet?.SlabNumber ?? "",
                    SheetNumber = sheet?.SheetNumber ?? "",
                    NetWeight = sheet?.ActualNetWeightKg ?? 0,
                    QuenchingDate = plan.ActualEndTime, // Или дата из листа, если хранится отдельно
                    Status = sheet?.Status ?? "В плане"
                };
            }).ToList();

            return new AnnealingPlanDetailsDto
            {
                PlanId = plan.PlanId,
                PlanName = plan.PlanName,
                FurnaceNumber = plan.FurnaceNumber,
                ScheduledStartTime = plan.ScheduledStartTime,
                ScheduledEndTime = plan.ScheduledEndTime,
                Status = plan.Status,
                Notes = plan.Notes,
                Sheets = sheetsData,
                TotalSheetsCount = sheetsData.Count,
                TotalWeight = sheetsData.Sum(s => s.NetWeight)
            };

        }
        [HttpPut("{id}")]
        public async Task<IActionResult> EditBatchPlan(int id, [FromBody] UpdateAnnealingBatchPlanRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var plan = await _context.AnnealingBatchPlans
                .Include(p => p.LinkedSheets) // Подгружаем существующие связи
                .FirstOrDefaultAsync(p => p.PlanId == id);

            if (plan == null)
            {
                return NotFound(new { message = $"План закалки с ID {id} не найден." });
            }

            // Проверка, можно ли редактировать (например, только если статус "Создан")
            if (plan.Status != "Создан") // Используем тот же статус, что и на фронте
            {
                return BadRequest(new { message = $"Невозможно редактировать план с ID {id}, так как его статус '{plan.Status}'. Редактирование возможно только для планов со статусом 'Создан'." });
            }

            // Сохраняем старое имя плана для обновления статуса листов
            var oldPlanName = plan.PlanName;

            // Обновляем основные поля плана
            if (!string.IsNullOrEmpty(request.PlanName))
            {
                plan.PlanName = request.PlanName;
            }
            if (!string.IsNullOrEmpty(request.FurnaceNumber))
            {
                plan.FurnaceNumber = request.FurnaceNumber;
            }
            if (request.ScheduledStartTime.HasValue)
            {
                plan.ScheduledStartTime = request.ScheduledStartTime;
            }
            if (request.ScheduledEndTime.HasValue)
            {
                plan.ScheduledEndTime = request.ScheduledEndTime;
            }
            if (request.Notes != null) // Может быть пустая строка
            {
                plan.Notes = request.Notes;
            }

            // --- ОБНОВЛЕНИЕ СВЯЗЕЙ С ЛИСТАМИ ---
            if (request.MatIds != null) // Если список MatIds был передан
            {
                var newMatIds = request.MatIds.Distinct().ToList(); // Убираем дубликаты

                // 1. Найти существующие связи
                var existingLinks = plan.LinkedSheets.ToList(); // ToList() чтобы отвязать от контекста при манипуляциях

                // 2. Определить, какие листы нужно добавить и какие удалить
                var currentMatIdsInPlan = existingLinks.Select(l => l.MatId).ToHashSet();
                var newMatIdsSet = newMatIds.ToHashSet();

                var matIdsToAdd = newMatIdsSet.Except(currentMatIdsInPlan).ToList();
                var matIdsToRemove = currentMatIdsInPlan.Except(newMatIdsSet).ToList();

                // --- НОВАЯ ЛОГИКА: Обновление статусов листов при изменении связей ---
                // 3a. Проверить и подготовить листы для добавления
                if (matIdsToAdd.Any())
                {
                    var existingMatIds = await _context.InputData
                        .Where(s => matIdsToAdd.Contains(s.MatId))
                        .Select(s => s.MatId)
                        .ToListAsync();

                    var missingMatIds = matIdsToAdd.Except(existingMatIds).ToList();
                    if (missingMatIds.Any())
                    {
                        return NotFound(new { message = $"Листы с ID {string.Join(", ", missingMatIds)} не найдены." });
                    }

                    // 3b. Проверить, не входят ли листы, которые хотим добавить, уже в *другой* активный план
                    var conflictingLinks = await _context.AnnealingBatchPlanSheets
                        .Include(l => l.BatchPlan) // Подгружаем план
                        .Where(l => matIdsToAdd.Contains(l.MatId) &&
                                    l.BatchPlan.Status != "Завершён" &&
                                    l.BatchPlan.Status != "Отменён" &&
                                    l.PlanId != id) // Исключаем текущий план
                        .Select(l => new { l.MatId, l.BatchPlan.PlanName })
                        .ToListAsync();

                    if (conflictingLinks.Any())
                    {
                        var conflictInfo = string.Join("; ", conflictingLinks.Select(cl => $"{cl.MatId} (в плане '{cl.PlanName}')"));
                        return BadRequest(new { message = $"Листы {conflictInfo} уже входят в другой активный план закалки." });
                    }
                }

                // 4. Удалить старые связи
                if (matIdsToRemove.Any())
                {
                    _context.AnnealingBatchPlanSheets.RemoveRange(existingLinks.Where(l => matIdsToRemove.Contains(l.MatId)));
                }

                // 5. Добавить новые связи
                if (matIdsToAdd.Any())
                {
                    var newLinks = matIdsToAdd.Select(matId => new AnnealingBatchPlanSheet
                    {
                        PlanId = plan.PlanId,
                        MatId = matId
                    }).ToList();
                    _context.AnnealingBatchPlanSheets.AddRange(newLinks);
                }

                // 6. Обновить статусы листов в InputData
                // a. Обновить статусы у добавленных листов
                if (matIdsToAdd.Any())
                {
                    var sheetsToAdd = await _context.InputData
                        .Where(s => matIdsToAdd.Contains(s.MatId))
                        .ToListAsync();

                    foreach (var sheet in sheetsToAdd)
                    {
                        sheet.Status = $"В плане закалки \"{plan.PlanName}\"";
                       // sheet.UpdatedAt = DateTimeOffset.UtcNow;
                    }
                }

                // b. Обновить статусы у удаленных листов (только если план был "Создан")
                if (matIdsToRemove.Any())
                {
                    var sheetsToRemove = await _context.InputData
                        .Where(s => matIdsToRemove.Contains(s.MatId))
                        .ToListAsync();

                    foreach (var sheet in sheetsToRemove)
                    {
                        // Сбрасываем статус на "Подготовлен к прокату", так как он был в этом состоянии до добавления в план
                        sheet.Status = "Подготовлен к прокату";
                      //  sheet.UpdatedAt = DateTimeOffset.UtcNow;
                    }
                }

                // Сохраняем изменения связей и статусов
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException ex)
                {
                    Console.WriteLine($"Ошибка при обновлении связей и статусов листов в EditBatchPlan: {ex.Message}");
                    return StatusCode(500, new { message = "Произошла ошибка при обновлении связей и статусов листов." });
                }
            }
            else
            {
                // Если список MatIds не был передан, просто сохраняем изменения основных данных плана
                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException ex)
                {
                    Console.WriteLine($"Ошибка при обновлении данных плана закалки: {ex.Message}");
                    return StatusCode(500, new { message = "Произошла ошибка при обновлении данных плана закалки." });
                }
            }


            // Возвращаем обновленный план (опционально, можно вернуть OK)
            var updatedPlan = await _context.AnnealingBatchPlans
                .Include(p => p.LinkedSheets)
                    .ThenInclude(ls => ls.Sheet)
                .FirstOrDefaultAsync(p => p.PlanId == id);

            if (updatedPlan == null)
            {
                // Теоретически не должно произойти, но на всякий случай
                return NotFound(new { message = $"План закалки с ID {id} не найден после обновления." });
            }

            return Ok(updatedPlan);
        }
    }
}