using MES_ME.Server.Data;
using MES_ME.Server.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.OpcUa; 

namespace MES_ME.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class QuenchingHmiController : ControllerBase
    {      
        private readonly AppDbContext _context;  
        private readonly IOpcUaService _opcService;
        private readonly ILogger<QuenchingHmiController> _logger;

        public QuenchingHmiController(AppDbContext context,IOpcUaService opcService,
        ILogger<QuenchingHmiController> logger)
        {
            _context = context;
            _opcService = opcService;
            _logger = logger;
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

         // GET: api/quenchinghmi/zonetemperatures
        [HttpGet("zonetemperatures")]
        public async Task<ActionResult<ZoneTemperatureDto>> GetZoneTemperatures()
        {
            try
                {

                var singleRow = await _context.ActualTemperatureAVG_HMI
                                      .FirstOrDefaultAsync();;
                    // Преобразуем результаты в DTO с фиксированными полями для 4-х зон
                if (singleRow == null)
                    {
                        // Обработка случая, если строка не найдена
                        Console.WriteLine("Данные о температуре не найдены в view.");
                        // Можно вернуть 200 с нулевыми значениями или 500
                        return Ok(new ZoneTemperatureDto()); // Возвращает DTO с нулями
                    }

                var zoneTempDto = new ZoneTemperatureDto
                {
                    
                            Zone1     = singleRow.Zone_1_TE_avg ?? 0.0, // Используем 0.0, если null
                            Zone2     = singleRow.Zone_2_TE_avg ?? 0.0,
                            Zone3     = singleRow.Zone_3_TE_avg ?? 0.0,
                            Zone4     = singleRow.Zone_4_TE_avg ?? 0.0,
                            Zone1_ref = singleRow.Zone_1_RefTE_avg ?? 0.0,
                            Zone2_ref = singleRow.Zone_2_RefTE_avg ?? 0.0,
                            Zone3_ref = singleRow.Zone_3_RefTE_avg ?? 0.0,
                            Zone4_ref = singleRow.Zone_4_RefTE_avg ?? 0.0,
                            
                    
                };
                
                   return Ok(zoneTempDto);
                }  
            catch(Exception ex)
            {
                 // Логирование ошибки (ILogger)
                Console.WriteLine($"Ошибка при получении температур из view: {ex.Message}");
                return StatusCode(500, new { message = "Внутренняя ошибка сервера при получении температур." });
            }

        }


        [HttpPost("write-entry")]
    public async Task<IActionResult> WriteEntry([FromBody] WriteEntryRequest request)
    {
        if (request == null || string.IsNullOrEmpty(request.UniqueId))
        {
            return BadRequest(new { message = "Не указан UniqueId листа." });
        }

        // 1. Найти лист в БД
        var sheet = await _context.InputData.FindAsync(request.UniqueId);
        if (sheet == null)
        {
            return NotFound(new { message = $"Лист с ID {request.UniqueId} не найден." });
        }

        // 2. Проверить, что лист находится в статусе, допускающем подачу на рольганг
        //    (например, "В плане закалки ..." или "Ожидание")
        if (!sheet.Status.StartsWith("В плане закалки") && sheet.Status != "Ожидание")
        {
            return BadRequest(new { message = $"Лист {request.UniqueId} имеет статус '{sheet.Status}', подача невозможна." });
        }

        // 3. Записать данные в OPC UA (теги E1)
        bool success = true;
        try
        {
            // Используем WriteByAliasAsync, если алиасы заданы в конфигурации
            // или WriteAsync с прямыми NodeId.
            // В вашем appsettings.json есть алиасы: E1_Melt, E1_PartNo, E1_Pack, E1_Sheet
          //  success &= await _opcService.WriteByAliasAsync("E1_Melt", request.Melt);
          //  success &= await _opcService.WriteByAliasAsync("E1_PartNo", request.PartNo);
          //  success &= await _opcService.WriteByAliasAsync("E1_Pack", request.Pack);
          //  success &= await _opcService.WriteByAliasAsync("E1_Sheet", request.Sheet);
            // Устанавливаем признак присутствия листа (E1_Ocp = true)
         //   success &= await _opcService.WriteByAliasAsync("E1_Ocp", true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка записи в OPC UA при подаче листа {MatId}", request.UniqueId);
            return StatusCode(500, new { message = "Ошибка связи с OPC-сервером." });
        }

        if (!success)
        {
            return StatusCode(500, new { message = "Не удалось записать данные в OPC UA." });
        }

        // 4. Обновить статус листа в БД
        sheet.Status = "На рольганге";
        // sheet.UpdatedAt = DateTimeOffset.UtcNow; // если есть поле
        await _context.SaveChangesAsync();

        return Ok(new { message = $"Лист {request.UniqueId} подан на входной рольганг." });
    }
    }
}
