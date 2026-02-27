using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.Models
{
    public class Permission
    {
        public int Id { get; set; }
        [Required]
        public string Name { get; set; } = null!;
        public string? Description { get; set; }

        public ICollection<RolePermission>? RolePermissions { get; set; }
    }
}
