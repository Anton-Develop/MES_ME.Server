using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.Models
{
    public class Role
    {
        public int Id { get; set; }
        [Required]
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<User>? Users { get; set; }

        // Только эта коллекция используется EF
        public ICollection<RolePermission>? RolePermissions { get; set; }
    }
}
