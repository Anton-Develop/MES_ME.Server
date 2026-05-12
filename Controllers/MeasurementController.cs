// Controllers/MeasurementController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data;
using MES_ME.Server.Models;
using MES_ME.Server.DTOs;

namespace MES_ME.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MeasurementController : ControllerBase
    {
        private readonly AppDbContext _context;

        public MeasurementController(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// GET /api/measurement/current?melt=123&partNo=456&pack=789&sheet=12
        /// Найти существующую запись измерений по ключу
        /// </summary>
        [HttpGet("current")]
        public async Task<IActionResult> GetCurrent(
            [FromQuery] int? melt,
            [FromQuery] int? partNo,
            [FromQuery] int? pack,
            [FromQuery] int? sheet)
        {
            if (melt == null || partNo == null || pack == null || sheet == null)
                return BadRequest(new { message = "Требуются melt, partNo, pack, sheet" });

            var record = await _context.Set<SheetMeasurement>()
                .Where(sm =>
                    sm.Melt == melt &&
                    sm.PartNo == partNo &&
                    sm.Pack == pack &&
                    sm.Sheet == sheet)
                .Select(sm => new SheetMeasurementDto
                {
                    Id = sm.Id,
                    Sheet = sm.Sheet,
                    Melt = sm.Melt,
                    Slab = sm.Slab,
                    PartNo = sm.PartNo,
                    Pack = sm.Pack,
                    SheetInPack = sm.SheetInPack,
                    SheetsInPack = sm.SheetsInPack,
                    Thickness = sm.Thickness,
                    AlloyCodeText = sm.AlloyCodeText,
                    EnteredX2At = sm.EnteredX2At,
                    H1Before = sm.H1Before,
                    H2Before = sm.H2Before,
                    H3Before = sm.H3Before,
                    H4Before = sm.H4Before,
                    H5Before = sm.H5Before,
                    H6Before = sm.H6Before,
                    H7Before = sm.H7Before,
                    H8Before = sm.H8Before,
                    H1After = sm.H1After,
                    H2After = sm.H2After,
                    H3After = sm.H3After,
                    H4After = sm.H4After,
                    H5After = sm.H5After,
                    H6After = sm.H6After,
                    H7After = sm.H7After,
                    H8After = sm.H8After,
                    MeasuredAt = sm.MeasuredAt,
                    MeasuredBy = sm.MeasuredBy,
                    CreatedAt = sm.CreatedAt,
                })
                .FirstOrDefaultAsync();

            if (record == null)
                return NotFound(new { message = "Запись измерений не найдена" });

            return Ok(record);
        }

        /// <summary>
        /// POST /api/measurement
        /// Создать новую запись измерений при появлении листа в X2
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateMeasurementRequest request)
        {
            if (request.Melt == null || request.Sheet == null)
                return BadRequest(new { message = "Поля melt и sheet обязательны" });

            // Проверка на дубликат
            var exists = await _context.Set<SheetMeasurement>()
                .AnyAsync(sm =>
                    sm.Melt == request.Melt &&
                    sm.PartNo == request.PartNo &&
                    sm.Pack == request.Pack &&
                    sm.Sheet == request.Sheet);

            if (exists)
                return Conflict(new { message = "Запись для этого листа уже существует" });

            var record = new SheetMeasurement
            {
                Sheet = request.Sheet ?? 0,
                Melt = request.Melt,
                Slab = request.Slab,
                PartNo = request.PartNo,
                Pack = request.Pack,
                SheetInPack = request.SheetInPack,
                SheetsInPack = request.SheetsInPack,
                Thickness = request.Thickness,
                AlloyCodeText = request.AlloyCodeText,
                EnteredX2At = request.EnteredX2At ?? DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
            };

            _context.Set<SheetMeasurement>().Add(record);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = record.Id }, MapToDto(record));
        }

        /// <summary>
        /// GET /api/measurement/{id}
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<IActionResult> GetById(long id)
        {
            var record = await _context.Set<SheetMeasurement>().FindAsync(id);
            if (record == null)
                return NotFound();

            return Ok(MapToDto(record));
        }

        /// <summary>
        /// PUT /api/measurement/{id}
        /// Сохранить замеры (16 точек)
        /// </summary>
        [HttpPut("{id:long}")]
        public async Task<IActionResult> SaveMeasurements(long id, [FromBody] SaveMeasurementsRequest request)
        {
            var record = await _context.Set<SheetMeasurement>().FindAsync(id);
            if (record == null)
                return NotFound(new { message = "Запись не найдена" });

            // Проверка, не сохранены ли уже замеры
            if (record.MeasuredAt != null)
                return BadRequest(new { message = "Измерения уже сохранены. Для повторного замера обратитесь к мастеру." });

            // Сохраняем замеры
            record.H1Before = request.H1Before;
            record.H2Before = request.H2Before;
            record.H3Before = request.H3Before;
            record.H4Before = request.H4Before;
            record.H5Before = request.H5Before;
            record.H6Before = request.H6Before;
            record.H7Before = request.H7Before;
            record.H8Before = request.H8Before;
            record.H1After = request.H1After;
            record.H2After = request.H2After;
            record.H3After = request.H3After;
            record.H4After = request.H4After;
            record.H5After = request.H5After;
            record.H6After = request.H6After;
            record.H7After = request.H7After;
            record.H8After = request.H8After;
            record.MeasuredAt = request.MeasuredAt ?? DateTime.UtcNow;
            record.MeasuredBy = request.MeasuredBy ?? User?.Identity?.Name ?? "operator";

            await _context.SaveChangesAsync();

            return Ok(MapToDto(record));
        }

        /// <summary>
        /// GET /api/measurement/latest?limit=10
        /// Последние записи (для истории)
        /// </summary>
        [HttpGet("latest")]
        public async Task<IActionResult> GetLatest([FromQuery] int limit = 10)
        {
            var records = await _context.Set<SheetMeasurement>()
                .OrderByDescending(sm => sm.EnteredX2At)
                .Take(limit)
                .Select(sm => MapToDto(sm))
                .ToListAsync();

            return Ok(records);
        }

        // ── Вспомогательный метод маппинга ──
        private static SheetMeasurementDto MapToDto(SheetMeasurement sm) => new()
        {
            Id = sm.Id,
            Sheet = sm.Sheet,
            Melt = sm.Melt,
            Slab = sm.Slab,
            PartNo = sm.PartNo,
            Pack = sm.Pack,
            SheetInPack = sm.SheetInPack,
            SheetsInPack = sm.SheetsInPack,
            Thickness = sm.Thickness,
            AlloyCodeText = sm.AlloyCodeText,
            EnteredX2At = sm.EnteredX2At,
            H1Before = sm.H1Before,
            H2Before = sm.H2Before,
            H3Before = sm.H3Before,
            H4Before = sm.H4Before,
            H5Before = sm.H5Before,
            H6Before = sm.H6Before,
            H7Before = sm.H7Before,
            H8Before = sm.H8Before,
            H1After = sm.H1After,
            H2After = sm.H2After,
            H3After = sm.H3After,
            H4After = sm.H4After,
            H5After = sm.H5After,
            H6After = sm.H6After,
            H7After = sm.H7After,
            H8After = sm.H8After,
            MeasuredAt = sm.MeasuredAt,
            MeasuredBy = sm.MeasuredBy,
            CreatedAt = sm.CreatedAt,
        };
    }
}