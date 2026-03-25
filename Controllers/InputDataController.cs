using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using MiniExcelLibs;
using System.Globalization;
using MES_ME.Server.Data; 
using MES_ME.Server.Models;
using System.Linq.Expressions;
using MES_ME.Server.DTOs;
using Microsoft.AspNetCore.Authorization;

namespace MES_ME.Server.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")] 
    public class InputDataController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InputDataController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Authorize(Roles = "superadmin,developer")]
        public async Task<IActionResult> GetData(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string sortField = "matid", // Поле по умолчанию
            [FromQuery] string sortOrder = "asc",   // Порядок по умолчанию
            [FromQuery] string? matidFilter = null,
            [FromQuery] string? statusFilter = null,
            [FromQuery] string? meltNumberFilter = null,
            [FromQuery] string? batchNumberFilter = null,
            [FromQuery] string? packNumberFilter = null,
            [FromQuery] string? sheetNumberFilter = null,
            [FromQuery] DateTime? rollDateFromFilter = null,
            [FromQuery] DateTime? rollDateToFilter = null
        // ... добавьте другие параметры фильтрации по мере необходимости
        )
        {
            // Проверка page и pageSize
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 100) pageSize = 10; // Ограничим максимальный размер страницы

            // Начинаем строить запрос IQueryable
            var query = _context.InputData.AsQueryable(); // 
            // Применяем фильтры
            if (!string.IsNullOrEmpty(matidFilter))
            {
                query = query.Where(x => x.MatId.Contains(matidFilter));
            }
            if (!string.IsNullOrEmpty(statusFilter))
            {
                query = query.Where(x => x.Status.Contains(statusFilter));
            }
            if (!string.IsNullOrEmpty(meltNumberFilter))
            {
                query = query.Where(x => x.MeltNumber.Contains(meltNumberFilter));
            }
            if (!string.IsNullOrEmpty(batchNumberFilter))
            {
                query = query.Where(x => x.BatchNumber.Contains(batchNumberFilter));
            }
            if (!string.IsNullOrEmpty(packNumberFilter))
            {
                query = query.Where(x => x.PackNumber.Contains(packNumberFilter));
            }
            if (!string.IsNullOrEmpty(sheetNumberFilter))
            {
                query = query.Where(x => x.SheetNumber.Contains(sheetNumberFilter));
            }
            if (rollDateFromFilter.HasValue)
            {
                query = query.Where(x => x.RollDate >= rollDateFromFilter.Value.Date); // .Date для точного совпадения с полуночью
            }
            if (rollDateToFilter.HasValue)
            {
                query = query.Where(x => x.RollDate <= rollDateToFilter.Value.Date.AddDays(1).AddTicks(-1)); // До конца дня
            }
            // ... добавьте другие фильтры ...

            // Подсчитываем общее количество записей до пагинации
            var totalCount = await query.CountAsync();

            // Определяем порядок сортировки
            // Внимание: используем Expression Trees для безопасности, чтобы избежать SQL-инъекций
            // Это чуть сложнее, чем просто OrderBy(sortField), но безопаснее.
            // Пример для одного поля. Для обобщения можно использовать рефлексию или библиотеку (например, LinqKit).
            // Упрощённый способ для часто используемых полей:
            switch (sortField.ToLower())
            {
                case "matid":
                    query = sortOrder.ToLower() == "desc" ? query.OrderByDescending(x => x.MatId) : query.OrderBy(x => x.MatId);
                    break;
                case "status":
                    query = sortOrder.ToLower() == "desc" ? query.OrderByDescending(x => x.Status) : query.OrderBy(x => x.Status);
                    break;
                case "melt_number":
                case "meltnumber": // Если имя свойства в модели InputDatum такое
                    query = sortOrder.ToLower() == "desc" ? query.OrderByDescending(x => x.MeltNumber) : query.OrderBy(x => x.MeltNumber);
                    break;
                case "batch_number":
                case "batchnumber":
                    query = sortOrder.ToLower() == "desc" ? query.OrderByDescending(x => x.BatchNumber) : query.OrderBy(x => x.BatchNumber);
                    break;
                case "pack_number":
                case "packnumber":
                    query = sortOrder.ToLower() == "desc" ? query.OrderByDescending(x => x.PackNumber) : query.OrderBy(x => x.PackNumber);
                    break;
                case "sheet_number":
                case "sheetnumber":
                    query = sortOrder.ToLower() == "desc" ? query.OrderByDescending(x => x.SheetNumber) : query.OrderBy(x => x.SheetNumber);
                    break;
                case "roll_date":
                case "rolldate":
                    query = sortOrder.ToLower() == "desc" ? query.OrderByDescending(x => x.RollDate) : query.OrderBy(x => x.RollDate);
                    break;
                // ... добавьте другие поля ...
                default:
                    // Сортировка по умолчанию
                    query = query.OrderBy(x => x.MatId);
                    break;
            }

            // Применяем пагинацию
            var data = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Возвращаем результат
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


         // --- НОВЫЙ МЕТОД: Получение листов, доступных для добавления в план закалки ---
    [HttpGet("for-annealing-plan")]
    public async Task<IActionResult> GetSheetsForAnnealingPlan(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 100,
        [FromQuery] string? matidFilter = null,
        [FromQuery] string? statusFilter = null, // Может быть полезно для уточнения, но основной фильтр ниже
        [FromQuery] string? meltNumberFilter = null,
        [FromQuery] string? batchNumberFilter = null,
        [FromQuery] string? packNumberFilter = null,
        [FromQuery] string? sheetNumberFilter = null,
        [FromQuery] DateTime? rollDateFromFilter = null,
        [FromQuery] DateTime? rollDateToFilter = null
        // ... другие параметры фильтрации ...
    )
    {
        // Проверка page и pageSize
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 25; // Ограничим максимальный размер страницы

        // Начинаем строить запрос IQueryable
        // ВАЖНО: Этот метод возвращает ТОЛЬКО листы со статусом "Подготовлен к прокату"
        var query = _context.InputData.AsQueryable()
                                      .Where(x => x.Status == "Подготовлен к прокату"); // <-- ДОБАВЛЕН ФИЛЬТР

        // Применяем *дополнительные* фильтры поверх основного
        if (!string.IsNullOrEmpty(matidFilter))
        {
            query = query.Where(x => x.MatId.Contains(matidFilter));
        }
        // Обратите внимание: statusFilter игнорируется или используется с оговоркой,
        // так как основной статус уже зафиксирован
        if (!string.IsNullOrEmpty(meltNumberFilter))
        {
            query = query.Where(x => x.MeltNumber.Contains(meltNumberFilter));
        }
        if (!string.IsNullOrEmpty(batchNumberFilter))
        {
            query = query.Where(x => x.BatchNumber.Contains(batchNumberFilter));
        }
        if (!string.IsNullOrEmpty(packNumberFilter))
        {
            query = query.Where(x => x.PackNumber.Contains(packNumberFilter));
        }
        if (!string.IsNullOrEmpty(sheetNumberFilter))
        {
            query = query.Where(x => x.SheetNumber.Contains(sheetNumberFilter));
        }
        if (rollDateFromFilter.HasValue)
        {
            query = query.Where(x => x.RollDate >= rollDateFromFilter.Value.Date);
        }
        if (rollDateToFilter.HasValue)
        {
            query = query.Where(x => x.RollDate <= rollDateToFilter.Value.Date.AddDays(1).AddTicks(-1));
        }
        // ... добавьте другие фильтры ...

        // Подсчитываем общее количество записей до пагинации
        var totalCount = await query.CountAsync();

        // Определяем порядок сортировки (можно сделать параметром, если нужно)
        // Например, по умолчанию сортируем по MatId
        query = query.OrderBy(x => x.MatId);

        // Применяем пагинацию
        var data = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Возвращаем результат
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
        [HttpPut("update-status")]
        public async Task<IActionResult> UpdateStatus([FromBody] UpdateStatusRequest request)
        {
            if (request.MatIds == null || request.MatIds.Count == 0 || string.IsNullOrWhiteSpace(request.NewStatus))
            {
                return BadRequest(new { message = "Необходимо указать список MatId и новый статус." });
            }

            try
            {
                // Находим все записи, которые нужно обновить
                var sheetsToUpdate = await _context.InputData
                    .Where(s => request.MatIds.Contains(s.MatId))
                    .ToListAsync();

                if (!sheetsToUpdate.Any())
                {
                    return NotFound(new { message = "Ни одного листа с указанными MatId не найдено." });
                }

                // Обновляем статус у найденных записей
                foreach (var sheet in sheetsToUpdate)
                {
                    // Опционально: проверить текущий статус, например, чтобы нельзя было сбросить "Прошел закалку" в "В плане..."
                    // if (sheet.Status == "Подготовлен к прокату" || sheet.Status.StartsWith("В плане"))
                    // {
                    sheet.Status = request.NewStatus;
                    // }
                   // sheet.UpdatedAt = DateTimeOffset.UtcNow; // Обновляем время изменения
                }

                await _context.SaveChangesAsync();

                return Ok(new { message = $"Статус успешно обновлен для {sheetsToUpdate.Count} листов.", updatedIds = sheetsToUpdate.Select(s => s.MatId).ToList() });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при обновлении статуса листов: {ex.Message}");
                return StatusCode(500, new { message = "Произошла ошибка при обновлении статуса листов." });
            }
        }
        [HttpPost("update-sheets-status-bulk")] 
        public async Task<IActionResult> UpdateSheetsStatusBulk([FromBody] BulkStatusUpdateRequest request)
        {
            if (request?.MatIds == null || request.MatIds.Count == 0 || string.IsNullOrEmpty(request.NewStatus))
            {
                return BadRequest(new { message = "Необходимо указать список MatId и новый статус." });
            }

            try
            {
                // 1. Найти все записи по списку MatId
                var sheetsToUpdate = await _context.InputData
                    .Where(x => request.MatIds.Contains(x.MatId)) // <-- Используем Contains для списка
                    .ToListAsync();

                if (!sheetsToUpdate.Any())
                {
                    return NotFound(new { message = "Ни одного листа с указанными MatId не найдено." });
                }

                // 2. Опционально: проверить текущий статус или права доступа
                // foreach (var sheet in sheetsToUpdate)
                // {
                //     if (!CanUserModifyStatus(user, sheet.CurrentStatus, request.NewStatus))
                //     {
                //         return Forbid($"Недостаточно прав для изменения статуса листа {sheet.MatId}");
                //     }
                // }

                // 3. Обновить статус у найденных записей
                int updatedCount = 0;
                foreach (var sheet in sheetsToUpdate)
                {
                    // Опционально: логика проверки смены статуса
                    // if (IsStatusTransitionValid(sheet.Status, request.NewStatus))
                    // {
                        sheet.Status = request.NewStatus;
                        updatedCount++;
                    // }
                }

                // 4. Сохранить изменения в базе данных
                await _context.SaveChangesAsync();

                return Ok(new {
                    message = $"Статус успешно обновлен для {updatedCount} листов.",
                    updatedIds = sheetsToUpdate.Select(s => s.MatId).ToList()
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при массовом обновлении статуса листов: {ex.Message}");
                // Логирование ошибки с использованием ILogger рекомендуется
                // _logger.LogError(ex, "Ошибка при массовом обновлении статуса");
                return StatusCode(500, new { message = "Произошла внутренняя ошибка сервера." });
            }
        }
    }

   
}