using Dapper;
using MES_ME.Server.Data;
using MES_ME.Server.Models;
using MES_ME.Server.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using static MES_ME.Server.DTOs.TemperingSessionDTO;

namespace MES_ME.Server.Controllers
{
    [ApiController]
    [Route("api/tempering")]
    public sealed class TemperingController : ControllerBase
    {
         private readonly IFurnaceRepository _furnaceRepo;
        private readonly NpgsqlDataSource _ds;
        private readonly AppDbContext _context;
        private readonly ILogger<TemperingController> _logger;

        public TemperingController(NpgsqlDataSource ds, AppDbContext context,IFurnaceRepository furnaceRepo, ILogger<TemperingController> log) 
        {
            _ds = ds;
            _context = context;
            _logger = log;
            _furnaceRepo = furnaceRepo;
        }

        // GET /api/tempering/current — текущее состояние всех 4 печей
        [HttpGet("current")]
        public async Task<IActionResult> GetCurrentState(CancellationToken ct)
        {
            await using var con = await _ds.OpenConnectionAsync(ct);
            var rows = await con.QueryAsync("""
            SELECT DISTINCT ON (furnace_no)
                furnace_no, time,
                proc_run, proc_end, proc_fault,
                temp_act, temp_ref, t1, t2, t_average_furn,
                act_time_total, act_time_heat_acc, act_time_heat_wait,
                time_proc_set, time_to_proc_end, proc_time_min,
                point_ref_1, point_time_1, point_dtime_2,
                cassette_no, cass_day, cass_month, cass_year, cass_hour,
                cass1_no, cass1_day, cass1_month, cass1_year, cass1_hour,
                cass2_no, cass2_day, cass2_month, cass2_year, cass2_hour,
                furn_prs, burn1_air_prs, burn1_gas_prs,
                burn1_te_lower, burn1_te_upper, burn2_air_prs, burn2_gas_prs,
                burn2_te_lower, burn2_te_upper,
                return_cassette_cmd
            FROM plc.tempering_data
            ORDER BY furnace_no, time DESC
            """);
            return Ok(rows);
        }

        // GET /api/tempering/history?furnaceNo=1&from=...&to=...&intervalMin=1
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] int furnaceNo,
            [FromQuery] DateTime from,
            [FromQuery] DateTime to,
            [FromQuery] int intervalMin = 1,
            CancellationToken ct = default)
        {
            if (from >= to)
                return BadRequest(new { error = "from должен быть меньше to" });

            // Авто-увеличение интервала для больших периодов
            if ((to - from).TotalHours > 24 && intervalMin < 5) intervalMin = 5;

            await using var con = await _ds.OpenConnectionAsync(ct);
            var rows = await con.QueryAsync("""
            SELECT
                date_trunc('minute', time) +
                (floor(EXTRACT(MINUTE FROM time) / @Interval) * @Interval)
                    * INTERVAL '1 minute' AS time,
                AVG(temp_act)        AS temp_act,
                AVG(temp_ref)        AS temp_ref,
                AVG(t1)              AS t1,
                AVG(t2)              AS t2,
                AVG(t_average_furn)  AS t_average_furn,
                AVG(act_time_total)  AS act_time_total,
                AVG(time_to_proc_end) AS time_to_proc_end,
                BOOL_OR(proc_run)    AS proc_run,
                BOOL_OR(proc_end)    AS proc_end,
                BOOL_OR(proc_fault)  AS proc_fault,
                AVG(furn_prs)        AS furn_prs,
                AVG(burn1_air_prs)   AS burn1_air_prs,
                AVG(burn1_gas_prs)   AS burn1_gas_prs,
                AVG(burn1_te_lower)  AS burn1_te_lower,
                AVG(burn1_te_upper)  AS burn1_te_upper,
                AVG(burn2_air_prs)   AS burn2_air_prs,
                AVG(burn2_gas_prs)   AS burn2_gas_prs,
                AVG(burn2_te_lower)  AS burn2_te_lower,
                AVG(burn2_te_upper)  AS burn2_te_upper
            FROM plc.tempering_data
            WHERE furnace_no = @FurnaceNo
              AND time BETWEEN @From AND @To
            GROUP BY 1
            ORDER BY 1
            """,
                new
                {
                    FurnaceNo = furnaceNo,
                    From = DateTime.SpecifyKind(from, DateTimeKind.Utc),
                    To = DateTime.SpecifyKind(to, DateTimeKind.Utc),
                    Interval = intervalMin,
                });
            return Ok(rows);
        }

        // GET /api/tempering/sessions?furnaceNo=1&from=...&to=...
        // Завершённые циклы отпуска (proc_end = true)
        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions(
            [FromQuery] int? furnaceNo = null,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            CancellationToken ct = default)
        {
            await using var con = await _ds.OpenConnectionAsync(ct);

            // Находим моменты завершения цикла: proc_end = true
            var sessions = await con.QueryAsync("""
            WITH proc_ends AS (
                SELECT
                    furnace_no, time AS ended_at,
                    temp_act, act_time_total, act_time_heat_acc,
                    point_ref_1, time_proc_set,
                    cassette_no, cass_day, cass_month, cass_year, cass_hour,
                    cass1_no, cass2_no,
                    ROW_NUMBER() OVER (PARTITION BY furnace_no ORDER BY time DESC) AS rn
                FROM plc.tempering_data
                WHERE proc_end = TRUE
                  AND (@FurnaceNo IS NULL OR furnace_no = @FurnaceNo)
                  AND (@From IS NULL OR time >= @From)
                  AND (@To   IS NULL OR time <= @To)
            )
            SELECT * FROM proc_ends
            ORDER BY ended_at DESC
            LIMIT @PageSize OFFSET @Offset
            """,
                new
                {
                    FurnaceNo = furnaceNo,
                    From = from.HasValue ? DateTime.SpecifyKind(from.Value, DateTimeKind.Utc) : (DateTime?)null,
                    To = to.HasValue ? DateTime.SpecifyKind(to.Value, DateTimeKind.Utc) : (DateTime?)null,
                    PageSize = pageSize,
                    Offset = (page - 1) * pageSize,
                });
            return Ok(sessions);
        }


        // GET /api/tempering/report/heat?furnaceNo=1&from=...&to=...
        [HttpGet("report/heat")]
        public async Task<IActionResult> GetHeatReport(
            [FromQuery] int furnaceNo,
            [FromQuery] DateTime from,
            [FromQuery] DateTime to,
            [FromQuery] int? sessionId = null,
            CancellationToken ct = default)
        {
            if (from >= to)
                return BadRequest(new { error = "from должен быть меньше to" });

            await using var con = await _ds.OpenConnectionAsync(ct);

            if (sessionId.HasValue)
            {
                // Получение конкретной сессии по её времени начала
                var session = await con.QueryFirstOrDefaultAsync("""
            WITH session_boundaries AS (
                SELECT 
                    furnace_no,
                    time AS session_start,
                    LEAD(time) OVER (PARTITION BY furnace_no ORDER BY time) AS session_end
                FROM plc.tempering_data
                WHERE furnace_no = @FurnaceNo
                  AND proc_end = TRUE
                ORDER BY time DESC
                LIMIT 1 OFFSET @SessionOffset
            )
            SELECT 
                sb.session_start,
                COALESCE(sb.session_end, @To::timestamptz) AS session_end,
                td.*
            FROM session_boundaries sb
            JOIN plc.tempering_data td ON td.furnace_no = sb.furnace_no
                AND td.time BETWEEN sb.session_start AND COALESCE(sb.session_end, @To::timestamptz)
            ORDER BY td.time
            """, new { FurnaceNo = furnaceNo, SessionOffset = sessionId.Value - 1, To = to });

                return Ok(session);
            }

            // Статистика по всем сессиям в периоде
            var sessionsStats = await con.QueryAsync("""
        WITH session_groups AS (
            SELECT 
                furnace_no,
                time AS session_start,
                LEAD(time) OVER (PARTITION BY furnace_no ORDER BY time) AS session_end
            FROM plc.tempering_data
            WHERE furnace_no = @FurnaceNo
              AND proc_end = TRUE
              AND time BETWEEN @From AND @To
        )
        SELECT 
            ROW_NUMBER() OVER (ORDER BY sg.session_start DESC) AS session_num,
            sg.session_start,
            sg.session_end,
            MIN(td.temp_act) AS temp_min,
            MAX(td.temp_act) AS temp_max,
            AVG(td.temp_act) AS temp_avg,
            MAX(td.time_proc_set) AS target_time_min,
            MAX(td.point_ref_1) AS target_temp,
            MAX(td.cassette_no) AS cassette_no,
            MAX(td.cass1_no) AS cass1_no,
            MAX(td.cass2_no) AS cass2_no,
            MAX(td.cass_day) AS cass_day,
            MAX(td.cass_month) AS cass_month,
            MAX(td.cass_year) AS cass_year,
            MAX(td.cass_hour) AS cass_hour,
            COUNT(*) AS data_points
        FROM session_groups sg
        JOIN plc.tempering_data td ON td.furnace_no = sg.furnace_no
            AND td.time BETWEEN sg.session_start AND COALESCE(sg.session_end, @To::timestamptz)
        GROUP BY sg.session_start, sg.session_end
        ORDER BY sg.session_start DESC
        """, new { FurnaceNo = furnaceNo, From = from, To = to });

            return Ok(sessionsStats);
        }

        // GET /api/tempering/report/heat/details
        [HttpGet("report/heat/details")]
        public async Task<IActionResult> GetHeatReportDetails(
            [FromQuery] int furnaceNo,
            [FromQuery] DateTime from,
            [FromQuery] DateTime to,
            [FromQuery] int intervalMin = 1,
            CancellationToken ct = default)
        {
                if (from >= to)
                    return BadRequest(new { error = "from должен быть меньше to" });

                await using var con = await _ds.OpenConnectionAsync(ct);

                var data = await con.QueryAsync("""
            SELECT 
                time,
                temp_act,
                temp_ref,
                t1,
                t2,
                t_average_furn,
                act_time_total,
                act_time_heat_acc,
                act_time_heat_wait,
                time_to_proc_end,
                proc_run,
                proc_end,
                proc_fault,
                cassette_no,
                cass1_no,
                cass2_no
            FROM plc.tempering_data
            WHERE furnace_no = @FurnaceNo
            AND time BETWEEN @From AND @To
            ORDER BY time ASC
            """, new { FurnaceNo = furnaceNo, From = from, To = to });

                return Ok(data);
        }

        [HttpGet("sessions-legacy")]
        public async Task<IActionResult> GetSessions([FromQuery] TemperingSessionFilter filter, CancellationToken ct)
        {
             var result = await _furnaceRepo.GetTemperingSessionsAsync(filter, ct);
             return Ok(result);
        }

        [HttpGet("sessions/{id:long}")]
        public async Task<IActionResult> GetSessionById(long id, CancellationToken ct)
        {
            var session = await _furnaceRepo.GetTemperingSessionByIdAsync(id, ct);
            if (session == null)
                return NotFound();

            var details = session.EndedAt.HasValue
                ? await _furnaceRepo.GetTemperingSessionDetailsAsync(session.FurnaceNo, session.StartedAt, session.EndedAt.Value, ct)
                : Enumerable.Empty<TemperingDetailDto>();

            return Ok(new { Session = session, Details = details });
        }

        // GET: /api/tempering/active-sessions
        [HttpGet("active-sessions")]
        public async Task<IActionResult> GetActiveSessions(CancellationToken ct)
        {
            var sessions = await _context.FurnaceCassetteSessions
                .Include(s => s.Cassette)
                .Where(s => s.UnloadedAt == null)
                .OrderBy(s => s.LoadedAt)
                .ToListAsync(ct);

            return Ok(sessions.Select(s => new
            {
                s.Id,
                s.FurnaceNumber,
                s.CassetteId,
                s.LoadedAt,
                s.LoadedBy,
                cassette_status = s.Cassette?.Status
            }));
        }

        // GET: /api/tempering/session-history/{cassetteId}
        [HttpGet("session-history/{cassetteId}")]
        public async Task<IActionResult> GetSessionHistory(string cassetteId, CancellationToken ct)
        {
            var sessions = await _context.FurnaceCassetteSessions
                .Where(s => s.CassetteId == cassetteId)
                .OrderByDescending(s => s.LoadedAt)
                .ToListAsync(ct);

            return Ok(sessions);
        }

        // POST: /api/tempering/load
        [HttpPost("load")]
        public async Task<IActionResult> LoadCassette([FromBody] LoadCassetteRequest request, CancellationToken ct)
        {
            // 1. Находим кассету
            var cassetteId = $"CAS{request.CassetteNumber:D7}";
            var cassette = await _context.Cassettes.FindAsync(new object[] { cassetteId }, ct);

            if (cassette == null)
                return NotFound(new { message = $"Кассета {cassetteId} не найдена" });

            if (cassette.Status != "Готова к отправке")
                return BadRequest(new { message = $"Кассета имеет статус '{cassette.Status}'" });

            // 2. Проверяем, не занята ли печь (по данным из БД сессий)
            var existingSession = await _context.FurnaceCassetteSessions
                .FirstOrDefaultAsync(s => s.FurnaceNumber == request.FurnaceNo && s.UnloadedAt == null, ct);

            if (existingSession != null)
                return Conflict(new { message = $"Печь {request.FurnaceNo} уже занята кассетой {existingSession.CassetteId}" });

            // 3. Создаём сессию
            var session = new FurnaceCassetteSession
            {
                FurnaceNumber = request.FurnaceNo,
                CassetteId = cassetteId,
                LoadedAt = DateTime.UtcNow,
                LoadedBy = User.Identity?.Name ?? "system",
                Source = "HMI"
            };

            cassette.Status = "Отправлена в печь";

            // Обновляем статусы листов в кассете
            var sheetLinks = await _context.SheetCassetteLinks
                .Where(l => l.CassetteId == cassetteId)
                .Select(l => l.MatId)
                .ToListAsync(ct);

            var sheets = await _context.InputData
                .Where(s => sheetLinks.Contains(s.MatId))
                .ToListAsync(ct);

            foreach (var sheet in sheets)
            {
                sheet.Status = "В печи отпуска";
            }

            _context.FurnaceCassetteSessions.Add(session);
            await _context.SaveChangesAsync(ct);

            _logger.LogInformation("Кассета {CassetteId} загружена в печь {FurnaceNo} оператором {User}",
                cassetteId, request.FurnaceNo, User.Identity?.Name ?? "system");

            return Ok(new
            {
                message = $"Кассета {cassetteId} загружена в печь {request.FurnaceNo}",
                sessionId = session.Id
            });
        }

        // POST: /api/tempering/unload
        [HttpPost("unload")]
        public async Task<IActionResult> UnloadCassette([FromBody] UnloadCassetteRequest request, CancellationToken ct)
        {
            var session = await _context.FurnaceCassetteSessions
                .Include(s => s.Cassette)
                .FirstOrDefaultAsync(s => s.FurnaceNumber == request.FurnaceNo && s.UnloadedAt == null, ct);

            if (session == null)
                return NotFound(new { message = $"Нет активной сессии для печи {request.FurnaceNo}" });

            session.UnloadedAt = DateTime.UtcNow;
            session.UnloadedBy = User.Identity?.Name ?? "system";

            if (session.Cassette != null)
            {
                session.Cassette.Status = "Отпуск завершён";

                // Обновляем статусы листов
                var sheetLinks = await _context.SheetCassetteLinks
                    .Where(l => l.CassetteId == session.CassetteId)
                    .Select(l => l.MatId)
                    .ToListAsync(ct);

                var sheets = await _context.InputData
                    .Where(s => sheetLinks.Contains(s.MatId))
                    .ToListAsync(ct);

                foreach (var sheet in sheets)
                {
                    sheet.Status = "Отпуск пройден";
                }
            }

            await _context.SaveChangesAsync(ct);

            _logger.LogInformation("Кассета {CassetteId} выгружена из печи {FurnaceNo} оператором {User}",
                session.CassetteId, request.FurnaceNo, User.Identity?.Name ?? "system");

            return Ok(new
            {
                message = $"Кассета {session.CassetteId} выгружена из печи {request.FurnaceNo}",
                sessionId = session.Id
            });
        }

        // GET: /api/tempering/furnace/{no}/status
        [HttpGet("furnace/{no}/status")]
        public async Task<IActionResult> GetFurnaceStatus(int no, CancellationToken ct)
        {
            // Получаем текущие данные печи из PLC
            await using var con = await _ds.OpenConnectionAsync(ct);
            var plcData = await con.QueryFirstOrDefaultAsync("""
                SELECT furnace_no, proc_run, proc_end, proc_fault,
                       cassette_no, cass1_no, cass2_no
                FROM plc.tempering_data
                WHERE furnace_no = @FurnaceNo
                ORDER BY time DESC
                LIMIT 1
                """, new { FurnaceNo = no });

            // Получаем активную сессию из БД
            var activeSession = await _context.FurnaceCassetteSessions
                .FirstOrDefaultAsync(s => s.FurnaceNumber == no && s.UnloadedAt == null, ct);

            return Ok(new
            {
                furnace_no = no,
                plc = plcData,
                active_session = activeSession == null ? null : new
                {
                    activeSession.CassetteId,
                    activeSession.LoadedAt,
                    activeSession.LoadedBy
                }
            });
        }
    }
    // DTOs
    public class LoadCassetteRequest
    {
        public int FurnaceNo { get; set; }
        public int CassetteNumber { get; set; }
    }

    public class UnloadCassetteRequest
    {
        public int FurnaceNo { get; set; }
    }

}
