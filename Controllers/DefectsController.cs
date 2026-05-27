using MES_ME.Server.Data;
using MES_ME.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MES_ME.Server.Controllers;

[Authorize]
[Route("api/[controller]")]
[ApiController]
public class DefectsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<DefectsController> _logger;

    public DefectsController(AppDbContext context, ILogger<DefectsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Получить список типов дефектов (для выпадающего списка на фронте)
    /// </summary>
    [HttpGet("types")]
    public async Task<IActionResult> GetDefectTypes()
    {
        var types = await _context.DefectTypes
            .Where(dt => dt.IsActive)
            .OrderBy(dt => dt.Severity)
            .ThenBy(dt => dt.Name)
            .Select(dt => new { dt.Id, dt.Code, dt.Name, dt.Severity })
            .ToListAsync();
        return Ok(types);
    }

    /// <summary>
    /// 🚨 Зарегистрировать брак (вызывается с HMI при клике на "Установить БРАК")
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateDefect([FromBody] CreateDefectRequest request)
    {
        if (string.IsNullOrEmpty(request.MatId))
            return BadRequest(new { message = "Не указан MatId листа" });

        // Находим лист
        var sheet = await _context.InputData.FirstOrDefaultAsync(s => s.MatId == request.MatId);
        if (sheet == null)
            return NotFound(new { message = $"Лист с MatId {request.MatId} не найден" });

        // Проверяем, что лист в допустимом статусе для установки брака
        var allowedStatuses = new[]
        {
            "Закалка пройдена",
            "Закалка пройдена, измерен",
            "Измерение планшетности",
            "В охлаждении"
        };

        if (!allowedStatuses.Contains(sheet.Status))
        {
            return BadRequest(new
            {
                message = $"Лист в статусе '{sheet.Status}' не может быть помечен как брак. " +
                          $"Брак устанавливается только для листов, прошедших закалку."
            });
        }

        var userName = User.Identity?.Name ?? "HMI_OPERATOR";

        // Создаём запись в таблице defects
        var defect = new Defect
        {
            MatId = request.MatId,
            DefectTypeId = request.DefectTypeId,
            DefectCode = request.DefectCode,
            DefectDescription = request.Description,
            Severity = request.Severity ?? 1,
            DetectedAtZone = request.DetectedAtZone ?? "X2",
            DetectedByProcess = "visual_inspection",
            DetectedBy = userName,
            DetectedAt = DateTime.UtcNow,
            Status = "open"
        };

        _context.Defects.Add(defect);

        // Меняем статус листа на "Брак"
        sheet.Status = "Брак";
        sheet.QuenchingStatus = "Требуется обработка брака";

        await _context.SaveChangesAsync();

        _logger.LogWarning(
            "🚨 Зарегистрирован брак: DefectId={DefectId}, MatId={MatId}, Type={Type}, " +
            "Description={Description}, DetectedBy={User}",
            defect.Id, defect.MatId, defect.DefectCode,
            defect.DefectDescription, userName);

        return Ok(new
        {
            message = "Брак успешно зарегистрирован",
            defectId = defect.Id,
            matId = defect.MatId,
            newStatus = sheet.Status
        });
    }

    /// <summary>
    /// Получить все браки (для страницы "БРАК")
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllDefects(
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.Defects
            .Include(d => d.DefectType)
            .Include(d => d.Sheet)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(d => d.Status == status);

        var totalCount = await query.CountAsync();

        var defects = await query
            .OrderByDescending(d => d.DetectedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new
            {
                d.Id,
                d.MatId,
                DefectType = d.DefectType != null ? new { d.DefectType.Code, d.DefectType.Name } : null,
                d.DefectDescription,
                d.Severity,
                d.DetectedAtZone,
                d.DetectedBy,
                d.DetectedAt,
                d.Status,
                Sheet = new
                {
                    d.Sheet!.MeltNumber,
                    d.Sheet.BatchNumber,
                    d.Sheet.PackNumber,
                    d.Sheet.SheetNumber,
                    d.Sheet.SteelGrade,
                    d.Sheet.Status
                }
            })
            .ToListAsync();

        return Ok(new { defects, totalCount, page, pageSize });
    }

    /// <summary>
    /// ♻️ Сбросить брак (вернуть лист в работу)
    /// </summary>
    [HttpPost("{id:long}/resolve")]
    public async Task<IActionResult> ResolveDefect(long id, [FromBody] ResolveDefectRequest request)
    {
        var defect = await _context.Defects.FindAsync(id);
        if (defect == null)
            return NotFound(new { message = "Дефект не найден" });

        var userName = User.Identity?.Name ?? "MASTER";

        defect.Status = request.Action == "scrap" ? "scrapped" : "resolved";
        defect.ResolvedAt = DateTime.UtcNow;
        defect.ResolvedBy = userName;
        defect.ResolutionNotes = request.Notes;

        // Если возвращаем в работу — сбрасываем статус листа
        if (request.Action == "rework")
        {
            var sheet = await _context.InputData.FirstOrDefaultAsync(s => s.MatId == defect.MatId);
            if (sheet != null)
            {
                sheet.Status = "Подготовлен к прокату";
                sheet.QuenchingStatus = "В процессе";
                sheet.QuenchingDate = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = request.Action == "scrap" ? "Лист утилизирован" : "Лист возвращён в работу",
            defect.Id,
            defect.Status
        });
    }
}

public class CreateDefectRequest
{
    public string MatId { get; set; } = string.Empty;
    public int? DefectTypeId { get; set; }
    public string? DefectCode { get; set; }
    public string? Description { get; set; }
    public int? Severity { get; set; }
    public string? DetectedAtZone { get; set; }
}

public class ResolveDefectRequest
{
    public string Action { get; set; } = "rework"; // "rework" | "scrap"
    public string? Notes { get; set; }
}