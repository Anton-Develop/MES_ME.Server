using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data;
using MES_ME.Server.Models;

namespace MES_ME.Server.Controllers
{
    [Authorize(Roles = "superadmin,developer")]
    [ApiController]
    [Route("api/[controller]")]
    public class RolesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RolesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Role>>> GetRoles()
        {
            var roles = await _context.Roles.ToListAsync();
            return Ok(roles);
        }

        [HttpPost]
        public async Task<ActionResult<Role>> CreateRole(CreateRoleRequest request)
        {
            if (await _context.Roles.AnyAsync(r => r.Name == request.Name))
            {
                return BadRequest("Роль с таким именем уже существует.");
            }

            var role = new Role
            {
                Name = request.Name,
                Description = request.Description
            };

            _context.Roles.Add(role);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRoles), new { id = role.Id }, role);
        }

        [Authorize(Roles = "superadmin")]
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteRole(int id)
        {
            var role = await _context.Roles.FindAsync(id);
            if (role == null) return NotFound();

            var hasUsers = await _context.Users.AnyAsync(u => u.RoleId == id);
            if (hasUsers)
            {
                return BadRequest("Нельзя удалить роль, пока к ней привязаны пользователи.");
            }

            _context.Roles.Remove(role);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Роль удалена." });
        }
    }

    public class CreateRoleRequest
    {
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
    }
}
