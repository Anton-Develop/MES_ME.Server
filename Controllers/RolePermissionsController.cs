using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data;
using MES_ME.Server.Models;

namespace MES_ME.Server.Controllers
{
    [Authorize(Roles = "superadmin,developer")]
    [ApiController]
    [Route("api/[controller]")]
    public class RolePermissionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RolePermissionsController(AppDbContext context)
        {
            _context = context;
        }

        // Получить все права у роли
        [HttpGet("role/{roleId}")]
        public async Task<ActionResult<IEnumerable<Permission>>> GetPermissionsByRole(int roleId)
        {
            var role = await _context.Roles
                .Include(r => r.RolePermissions)
                .FirstOrDefaultAsync(r => r.Id == roleId);

            if (role == null) return NotFound();

            return Ok(role.RolePermissions);
        }

        // Назначить право роли
        [HttpPost]
        public async Task<ActionResult> AssignPermissionToRole(AssignPermissionRequest request)
        {
            var role = await _context.Roles.FindAsync(request.RoleId);
            var permission = await _context.Permissions.FindAsync(request.PermissionId);

            if (role == null || permission == null) return NotFound();

            var rolePermission = new RolePermission
            {
                RoleId = request.RoleId,
                PermissionId = request.PermissionId
            };

            _context.RolePermissions.Add(rolePermission);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Permission assigned." });
        }

        // Отозвать право у роли
        [HttpDelete]
        public async Task<ActionResult> RemovePermissionFromRole(AssignPermissionRequest request)
        {
            var rolePermission = await _context.RolePermissions
                .FirstOrDefaultAsync(rp => rp.RoleId == request.RoleId && rp.PermissionId == request.PermissionId);

            if (rolePermission == null) return NotFound();

            _context.RolePermissions.Remove(rolePermission);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Permission removed." });
        }
    }

    public class AssignPermissionRequest
    {
        public int RoleId { get; set; }
        public int PermissionId { get; set; }
    }
}
