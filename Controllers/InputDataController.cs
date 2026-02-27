using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using MiniExcelLibs;
using System.Globalization;
using MES_ME.Server.Data; 
using MES_ME.Server.Models;
using System.Linq.Expressions;

namespace MES_ME.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // Изменим маршрут для логичности
    public class InputDataController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InputDataController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
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
            var query = _context.InputData.AsQueryable(); // Предполагаем, что у вас есть DbSet<InputDatum> InputData в AppDbContext

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
    }
}