using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data;
using MES_ME.Server.Models;
using Microsoft.AspNetCore.Http.HttpResults;

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
            try
            {
            var role = await _context.Roles
                .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
                .FirstOrDefaultAsync(r => r.Id == roleId);

            if (role == null)
                {
                    return NotFound($"Роль с Id {roleId} не найдена.");
                }

            var permissions = role.RolePermissions.Select(rp => rp.Permission).ToList();
            return Ok(permissions);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Ошибка при загрузки права." });
                
            }
        }

        // Назначить право роли
        [HttpPost]
        public async Task<ActionResult> AssignPermissionToRole(AssignPermissionRequest request)
        {
            var role = await _context.Roles.FindAsync(request.RoleId);
            var permission = await _context.Permissions.FindAsync(request.PermissionId);

            if (role == null || permission == null)
            {
                return NotFound("Роль или разрешение не найдены.");
            }

            // Проверяем, не назначено ли уже такое разрешение
            var existingAssignment = await _context.RolePermissions
                .AnyAsync(rp => rp.RoleId == request.RoleId && rp.PermissionId == request.PermissionId);

            if (existingAssignment)
            {
                 return BadRequest("Разрешение уже назначено для данной роли.");
            }

            var rolePermission = new RolePermission
            {
                RoleId = request.RoleId,
                PermissionId = request.PermissionId
            };

            _context.RolePermissions.Add(rolePermission);
            await _context.SaveChangesAsync();

            // Возвращаем успешный ответ без тела или с минимальным сообщением
            // Это также помогает избежать циклов при сериализации ответа.
            return Ok(new { Message = "Permission assigned successfully." });
        }

        // Отозвать право у роли
        [HttpDelete]
        public async Task<ActionResult> RemovePermissionFromRole([FromBody] AssignPermissionRequest request)
        {
            // Используем [FromBody], чтобы получать объект из тела DELETE-запроса
            var rolePermission = await _context.RolePermissions
                .FirstOrDefaultAsync(rp => rp.RoleId == request.RoleId && rp.PermissionId == request.PermissionId);

            if (rolePermission == null)
            {
                return NotFound("Связь между ролью и разрешением не найдена.");
            }

            _context.RolePermissions.Remove(rolePermission);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Permission removed successfully." });
        }
    }

    public class AssignPermissionRequest
    {
        public int RoleId { get; set; }
        public int PermissionId { get; set; }
    }
}
