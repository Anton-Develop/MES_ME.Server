using MES_ME.Server.Data;
using MES_ME.Server.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MES_ME.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class QuenchingHmiController : ControllerBase
    {      
        private readonly AppDbContext _context;  
        public QuenchingHmiController(AppDbContext context)
        {
            _context = context;
        }

        // Вспомогательный метод для парсинга строки размеров из inputdata
        // Примеры: "4.2 x 2000 x 8000 мм", "Чх1500х3000", "Шх1250х3000", "14х1250х3000"
        // Возвращаемые значения: (толщина, ширина, длина)
        // Для форм "Чх" или "Шх" предполагается, что после буквы идут ширина и длина.
        // Если строка начинается с числа (толщина), предполагается формат "толщина x ширина x длина".
        private (double thickness, int width, int length) ParseDimensions(string dimensionsStr)
{
    if (string.IsNullOrWhiteSpace(dimensionsStr)) return (0.0, 0, 0);

    // Шаг 1: Очистка строки.
    // Удаляем *все* буквы (включая "Ш", "Ч", "х", "мм") и оставляем только цифры, точки и пробелы.
    // Заменяем любую букву (латиница/кириллица) на пробел.
    var cleanedStr = System.Text.RegularExpressions.Regex.Replace(dimensionsStr, @"[a-zA-Zа-яА-Я]", " ").Trim();

    // Шаг 2: Разделение на части по одному или более пробелам.
    // Это объединит несколько подряд идущих пробельных символов, включая те, что были буквами.
    var parts = System.Text.RegularExpressions.Regex.Split(cleanedStr, @"\s+")
        .Where(p => !string.IsNullOrEmpty(p)) // Убираем пустые элементы
        .ToList();

    double thickness = 0.0;
    int width = 0;
    int length = 0;

    // Шаг 3: Анализ частей.
    if (parts.Count == 2)
    {
        // Сценарий 1: Только ширина и длина (например, "1500 3000" после очистки "Чх1500х3000")
        if (int.TryParse(parts[0], out var w)) width = w;
        if (int.TryParse(parts[1], out var l)) length = l;
        // thickness остаётся 0.0
    }
    else if (parts.Count >= 3)
    {
        // Сценарий 2: Толщина, ширина, длина (например, "4.2 2000 8000" после очистки "4.2 x 2000 x 8000 мм")
        // Предполагаем стандартный порядок: толщина (double), ширина (int), длина (int).
        if (double.TryParse(parts[0], out var t)) thickness = t;
        if (parts.Count > 1 && int.TryParse(parts[1], out var w)) width = w;
        if (parts.Count > 2 && int.TryParse(parts[2], out var l)) length = l;
    }
    // parts.Count == 1 или > 3 - обработка как ошибка или неполные данные (возвращаются 0).

    // Важно: Логика определения, что есть что (толщина, ширина, длина), может зависеть от бизнес-правил.
    // В текущей реализации:
    // - Если 2 числа -> это ширина и длина.
    // - Если 3+ числа -> первое - толщина (double), второе - ширина (int), третье - длина (int).
    // Это соответствует ожиданиям DTO HMI.

    return (thickness, width, length);
}

                 
        // GET: api/quenchinghmi/plans
        [HttpGet("plans")]
        public async Task<ActionResult<IEnumerable<HmiPlanDto>>> GetPlans()
        {
            var requiredStatuses = new[] { "Готов к работе", "В работе" };

             var hmiPlans = await _context.AnnealingBatchPlans
        // 1. Сначала сортируем по свойству из БД (например, ScheduledStartTime).
        // null значения могут сортироваться по-разному в зависимости от провайдера БД (PostgreSQL, SQL Server).
        // Здесь они будут отсортированы в начало или конец.
        .Where(bp => requiredStatuses.Contains(bp.Status))
        .OrderBy(bp => bp.ScheduledStartTime)
        // 2. *Затем* выполняем Select для создания DTO.
        .Select(bp => new HmiPlanDto
        {
            Id = bp.PlanId,
            PlanName = bp.PlanName,
            Furnace = bp.FurnaceNumber ?? "",
            // Обработка null для даты и времени при создании DTO
            Date = DateOnly.FromDateTime(bp.ScheduledStartTime.Value.DateTime).ToString(),
            Time = TimeOnly.FromDateTime(bp.ScheduledStartTime.Value.DateTime).ToString(),
            //Date = bp.ScheduledStartTime.ToString("yyyy-MM-dd"),// .ToString("yyyy-MM-dd") ?? string.Empty,
           // Time = bp.ScheduledStartTime.ToString("HH:mm:ss") ?? string.Empty,
            Status = bp.Status ?? "",
            SheetCount = bp.LinkedSheets.Count // Обратите внимание: Count() здесь может быть проблемой для больших объёмов
        })
        .ToListAsync(); // Выполняем асинхронный запрос

    return Ok(hmiPlans);
        }

        // GET: api/quenchinghmi/plans/{id}/sheets
        [HttpGet("plans/{planId:int}/sheets")]
        public async Task<ActionResult<IEnumerable<HmiSheetDto>>> GetSheetsForPlan(int planId)
        {
            var plan = await _context.AnnealingBatchPlans
                .Include(p => p.LinkedSheets)
                    .ThenInclude(ls => ls.Sheet)
                .FirstOrDefaultAsync(p => p.PlanId == planId);

            if (plan == null)
            {
                return NotFound(new { message = $"План закалки с ID {planId} не найден." });
            }

            var hmiSheets = plan.LinkedSheets
                .Where(ls => ls.Sheet != null)
                .Select(ls =>
                {
                    var inputDatum = ls.Sheet;
                    var dims = ParseDimensions(inputDatum.SheetDimensions ?? "");
                    double thickness = dims.thickness;
                    int width = dims.width;
                    int length = dims.length;

                    return new HmiSheetDto
                    {
                        Id = ls.LinkId,
                        UniqueId = inputDatum.MatId,
                        Melt = inputDatum.MeltNumber ?? "",
                        Batch = inputDatum.BatchNumber ?? "",
                        Pack = inputDatum.PackNumber ?? "",
                        Sheet = inputDatum.SheetNumber ?? "",
                        Grade = inputDatum.SteelGrade ?? "",
                        Thick = thickness,
                        Width = width,
                        Len = length,
                        Wt = (double)(inputDatum.ActualNetWeightKg ?? 0.0m),
                        Status = "Ожидание",
                        Loc = ""
                    };
                })
                .ToList();

            return Ok(hmiSheets);
        }


    }
}
