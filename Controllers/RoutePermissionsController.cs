// Controllers/RoutePermissionsController.cs
// CRUD для управления маршрутами и их правами доступа.
// Только superadmin и developer могут изменять маршруты.
// Получение списка маршрутов для конкретной роли доступно всем авторизованным.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data;
using MES_ME.Server.Models;

namespace MES_ME.Server.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class RoutePermissionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RoutePermissionsController(AppDbContext context)
        {
            _context = context;
        }

        // Получить все маршруты (для экрана управления)
        [HttpGet]
        [Authorize(Roles = "superadmin,developer")]
        public async Task<ActionResult<IEnumerable<RoutePermission>>> GetAll()
        {
            var routes = await _context.RoutePermissions
                .OrderBy(r => r.SortOrder)
                .ThenBy(r => r.Label)
                .ToListAsync();
            return Ok(routes);
        }

        // Получить маршруты, доступные для конкретной роли пользователя.
        // Вызывается фронтендом после логина — возвращает только те маршруты,
        // на которые у текущей роли есть соответствующее право.
        [HttpGet("for-role/{roleName}")]
        public async Task<ActionResult<IEnumerable<RoutePermissionDto>>> GetForRole(string roleName)
        {
            // Получаем права данной роли из БД
            var role = await _context.Roles
                .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
                .FirstOrDefaultAsync(r => r.Name == roleName);

            if (role == null)
                return NotFound($"Роль '{roleName}' не найдена.");

            var rolePermissionNames = role.RolePermissions
                .Select(rp => rp.Permission.Name)
                .ToHashSet();

            // Возвращаем только активные маршруты, право на которые есть у роли
            var allowedRoutes = await _context.RoutePermissions
                .Where(r => r.IsActive && rolePermissionNames.Contains(r.RequiredPermission))
                .OrderBy(r => r.SortOrder)
                .ThenBy(r => r.Label)
                .Select(r => new RoutePermissionDto
                {
                    Path = r.Path,
                    Label = r.Label,
                    IconName = r.IconName,
                    SortOrder = r.SortOrder
                })
                .ToListAsync();

            return Ok(allowedRoutes);
        }

        // Создать новый маршрут
        [HttpPost]
        [Authorize(Roles = "superadmin,developer")]
        public async Task<ActionResult<RoutePermission>> Create(CreateRoutePermissionRequest request)
        {
            // Проверяем, что такое право существует
            var permissionExists = await _context.Permissions
                .AnyAsync(p => p.Name == request.RequiredPermission);

            if (!permissionExists)
                return BadRequest($"Право '{request.RequiredPermission}' не найдено в системе.");

            // Проверяем уникальность пути
            var pathExists = await _context.RoutePermissions
                .AnyAsync(r => r.Path == request.Path);

            if (pathExists)
                return BadRequest($"Маршрут '{request.Path}' уже существует.");

            var route = new RoutePermission
            {
                Path = request.Path.Trim(),
                Label = request.Label.Trim(),
                IconName = request.IconName?.Trim() ?? "Dashboard",
                RequiredPermission = request.RequiredPermission.Trim(),
                SortOrder = request.SortOrder,
                IsActive = true
            };

            _context.RoutePermissions.Add(route);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), new { id = route.Id }, route);
        }

        // Обновить маршрут (label, icon, permission, sortOrder, isActive)
        [HttpPut("{id}")]
        [Authorize(Roles = "superadmin,developer")]
        public async Task<ActionResult> Update(int id, UpdateRoutePermissionRequest request)
        {
            var route = await _context.RoutePermissions.FindAsync(id);
            if (route == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(request.RequiredPermission))
            {
                var permissionExists = await _context.Permissions
                    .AnyAsync(p => p.Name == request.RequiredPermission);

                if (!permissionExists)
                    return BadRequest($"Право '{request.RequiredPermission}' не найдено.");

                route.RequiredPermission = request.RequiredPermission.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.Label))
                route.Label = request.Label.Trim();

            if (!string.IsNullOrWhiteSpace(request.IconName))
                route.IconName = request.IconName.Trim();

            if (!string.IsNullOrWhiteSpace(request.Path))
            {
                var pathTaken = await _context.RoutePermissions
                    .AnyAsync(r => r.Path == request.Path && r.Id != id);
                if (pathTaken)
                    return BadRequest($"Путь '{request.Path}' уже используется другим маршрутом.");
                route.Path = request.Path.Trim();
            }

            route.SortOrder = request.SortOrder ?? route.SortOrder;
            route.IsActive = request.IsActive ?? route.IsActive;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Маршрут обновлён." });
        }

        // Удалить маршрут
        [HttpDelete("{id}")]
        [Authorize(Roles = "superadmin,developer")]
        public async Task<ActionResult> Delete(int id)
        {
            var route = await _context.RoutePermissions.FindAsync(id);
            if (route == null) return NotFound();

            _context.RoutePermissions.Remove(route);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Маршрут удалён." });
        }
    }

    // DTO для отдачи фронтенду (без лишних полей)
    public class RoutePermissionDto
    {
        public string Path { get; set; } = null!;
        public string Label { get; set; } = null!;
        public string IconName { get; set; } = null!;
        public int SortOrder { get; set; }
    }

    public class CreateRoutePermissionRequest
    {
        public string Path { get; set; } = null!;
        public string Label { get; set; } = null!;
        public string IconName { get; set; } = "Dashboard";
        public string RequiredPermission { get; set; } = null!;
        public int SortOrder { get; set; } = 0;
    }

    public class UpdateRoutePermissionRequest
    {
        public string? Path { get; set; }
        public string? Label { get; set; }
        public string? IconName { get; set; }
        public string? RequiredPermission { get; set; }
        public int? SortOrder { get; set; }
        public bool? IsActive { get; set; }
    }
}
