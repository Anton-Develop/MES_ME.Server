using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MES_ME.Server.Data;
using MES_ME.Server.Models;

namespace MES_ME.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public UsersController(AppDbContext context)
        {
            _context = context;
        }

        [Authorize(Roles = "superadmin,developer")]
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            var users = await _context.Users
                .Include(u => u.Role)
               // .Where(u => u.IsActive)
                .Select(u => new
                {
                    u.Id,
                    u.Username,
                    u.Email,
                    Role = u.Role.Name,
                    u.IsActive,
                    u.CreatedAt,
                    u.UpdatedAt
                })
                .ToListAsync();

            return Ok(users);
        }

        [Authorize(Roles = "superadmin,developer")]
        [HttpPost]
        public async Task<ActionResult> CreateUser(CreateUserRequest request)
        {
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
            {
                return BadRequest("Username already exists.");
            }

            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == request.Role);
            if (role == null)
            {
                return BadRequest($"Роль '{request.Role}' не найдена.");
            }

            var user = new User
            {
                Username = request.Username,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                RoleId = role.Id
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "User created successfully." });
        }

        [Authorize(Roles = "superadmin,developer")]
        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateUser(int id, UpdateUserRequest request)
        {
            var user = await _context.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Id == id);
            if (user == null || !user.IsActive) return NotFound();

            user.Username = request.Username;
            user.Email = request.Email;

            if (!string.IsNullOrEmpty(request.NewPassword))
            {
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            }

            if (!string.IsNullOrEmpty(request.Role))
            {
                var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == request.Role);
                if (role == null)
                {
                    return BadRequest($"Роль '{request.Role}' не найдена.");
                }
                user.RoleId = role.Id;
            }

            await _context.SaveChangesAsync();

            return Ok(new { Message = "User updated successfully." });
        }

        [Authorize(Roles = "superadmin,developer")]
        [HttpPut("{id}/toggle-active")]
        public async Task<ActionResult> ToggleUserActive(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.IsActive = !user.IsActive;
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { Message = $"Пользователь {(user.IsActive ? "активирован" : "деактивирован")}.", IsActive = user.IsActive });
        }

        [Authorize(Roles = "superadmin,developer")]
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.IsActive = false; // soft delete
            await _context.SaveChangesAsync();

            return Ok(new { Message = "User deactivated successfully." });
        }

        [Authorize(Roles = "superadmin,developer")]
        [HttpDelete("{id}/hard")]
        public async Task<ActionResult> HardDeleteUser(int id)
        {
            
            // Удаляем сначала связанные LoginLogs
            var loginLogs = await _context.LoginLogs.Where(ll => ll.UserId == id).ToListAsync();
            _context.LoginLogs.RemoveRange(loginLogs);
            // Затем удаляем пользователя
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();
            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "User permanently deleted." });
        }

        [Authorize(Roles = "superadmin,developer")]
        [HttpPut("{id}/password")]
        public async Task<ActionResult> ChangeUserPassword(int id, ChangePasswordRequest request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound();

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Password changed." });
        }
    }

    public class CreateUserRequest
    {
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string Role { get; set; } = "operator";
    }

    public class UpdateUserRequest
    {
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string? NewPassword { get; set; }
        public string? Role { get; set; }
    }

    public class ChangePasswordRequest
    {
        public string NewPassword { get; set; } = null!;
    }
}
