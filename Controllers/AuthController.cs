using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MES_ME.Server.Data;
using MES_ME.Server.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCryptNet = BCrypt.Net.BCrypt;

namespace MES_ME.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("register")]
        public async Task<ActionResult> Register([FromBody] RegisterRequest model)
        {
            if (await _context.Users.AnyAsync(u => u.Username == model.Username))
            {
                return BadRequest("Username already exists.");
            }

            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == model.Role);
            if (role == null)
            {
                return BadRequest($"Роль '{model.Role}' не найдена.");
            }

            var user = new User
            {
                Username = model.Username,
                Email = model.Email,
                PasswordHash = BCryptNet.HashPassword(model.Password),
                RoleId = role.Id
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "User registered successfully." });
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest model)
        {
            try
            {

                var user = await _context.Users
                    .Include(u => u.Role)
                    .ThenInclude(r => r.RolePermissions)
                    .ThenInclude(rp => rp.Permission)
                    .FirstOrDefaultAsync(u => u.Username == model.Username);

                if (user == null || !BCryptNet.Verify(model.Password, user.PasswordHash))
                {
                    return Unauthorized("Invalid credentials.");
                }

                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Key"]!);

                var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.Name),
            new Claim("UserId", user.Id.ToString())
        };

                if (user.Role.RolePermissions != null)
                {
                    foreach (var rp in user.Role.RolePermissions)
                    {
                        claims.Add(new Claim("permission", rp.Permission.Name));
                    }
                }

                var tokenDescriptor = new SecurityTokenDescriptor
                {
                    Subject = new ClaimsIdentity(claims),
                    Expires = DateTime.UtcNow.AddMinutes(int.Parse(_configuration["Jwt:ExpireMinutes"]!)),
                    Issuer = _configuration["Jwt:Issuer"],
                    Audience = _configuration["Jwt:Audience"],
                    SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
                };

                var token = tokenHandler.CreateToken(tokenDescriptor);
                var tokenString = tokenHandler.WriteToken(token);

                var permissions = user.Role.RolePermissions?.Select(rp => rp.Permission.Name).ToList() ?? new List<string>();

                // Логируем успешный вход
                var loginLog = new LoginLog
                {
                    UserId = user.Id,
                    IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = Request.Headers["User-Agent"].ToString()
                };
                _context.LoginLogs.Add(loginLog);
                await _context.SaveChangesAsync();

                return Ok(new LoginResponse
                {
                    Token = tokenString,
                    UserId = user.Id,
                    Username = user.Username,
                    Role = user.Role.Name,
                    Permissions = permissions
                });
            }
            catch (Exception ex)
            {

                return Unauthorized();
            }
        }
    }

    public class RegisterRequest
    {
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string? Role { get; set; }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = null!;
        public string Password { get; set; } = null!;
    }

    public class LoginResponse
    {
        public string Token { get; set; } = null!;
        public int UserId { get; set; }
        public string Username { get; set; } = null!;
        public string Role { get; set; } = null!;
        public List<string> Permissions { get; set; } = new List<string>();
    }
}
