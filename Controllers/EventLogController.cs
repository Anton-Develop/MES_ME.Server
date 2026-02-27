using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data;

namespace MES_ME.Server.Controllers
{
    [Authorize(Roles = "superadmin,developer")]
    [ApiController]
    [Route("api/events")]
    public class EventLogController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EventLogController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("logins")]
        public async Task<ActionResult<IEnumerable<object>>> GetLoginLogs()
        {
            var logs = await _context.LoginLogs
                .Include(l => l.User)
                .OrderByDescending(l => l.Timestamp)
                .Take(100)
                .Select(l => new
                {
                    l.Id,
                    Username = l.User!.Username,
                    l.IpAddress,
                    l.UserAgent,
                    l.Timestamp
                })
                .ToListAsync();

            return Ok(logs);
        }

        [HttpGet("audit")]
        public async Task<ActionResult<IEnumerable<object>>> GetAuditLogs()
        {
            var logs = await _context.AuditLogs
                .Include(a => a.User)
                .OrderByDescending(a => a.Timestamp)
                .Take(100)
                .Select(a => new
                {
                    a.Id,
                    Username = a.User!.Username,
                    a.Action,
                    a.EntityType,
                    a.EntityId,
                    a.OldValues,
                    a.NewValues,
                    a.Timestamp
                })
                .ToListAsync();

            return Ok(logs);
        }
    }
}
