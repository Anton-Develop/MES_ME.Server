using MES_ME.Server.Models;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.EntityFrameworkCore;

namespace MES_ME.Server.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<Permission> Permissions => Set<Permission>();
        public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
        public DbSet<LoginLog> LoginLogs => Set<LoginLog>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

       // public DbSet<Sheet> Sheets { get; set; }

        public DbSet<InputDatum> InputData { get; set; }

        public DbSet<Cassette> Cassettes { get; set; } // Добавляем DbSet для кассет
        public DbSet<CassetteStatusLog> CassetteStatusLogs { get; set; } // Добавляем DbSet для лога
        public DbSet<SheetCassetteLink> SheetCassetteLinks { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
             base.OnModelCreating(modelBuilder);

            // Настройка связи SheetCassetteLink -> InputDatum (Many-to-One)
            modelBuilder.Entity<SheetCassetteLink>()
                .HasOne(scl => scl.Sheet) // У SheetCassetteLink есть свойство Sheet
                .WithMany()               // У InputDatum НЕТ свойства, указывающего на список связей
                .HasForeignKey(scl => scl.MatId) // Внешний ключ в SheetCassetteLink
                .OnDelete(DeleteBehavior.Cascade); // При удалении InputDatum - удаляется связь

            // Настройка связи SheetCassetteLink -> Cassette (Many-to-One)
            modelBuilder.Entity<SheetCassetteLink>()
                .HasOne(scl => scl.Cassette) // У SheetCassetteLink есть свойство Cassette
                .WithMany(c => c.LinkedSheets) // У Cassette есть свойство LinkedSheets
                .HasForeignKey(scl => scl.CassetteId) // Внешний ключ в SheetCassetteLink
                .OnDelete(DeleteBehavior.Cascade); // При удалении Cassette - удаляются связи

            // Убедимся, что UNIQUE ограничение на matid в sheet_cassette_links задано
            modelBuilder.Entity<SheetCassetteLink>()
                .HasIndex(scl => scl.MatId)
                .IsUnique();


            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            modelBuilder.Entity<Role>()
                .HasIndex(r => r.Name)
                .IsUnique();

            modelBuilder.Entity<Permission>()
                .HasIndex(p => p.Name)
                .IsUnique();

            modelBuilder.Entity<RolePermission>()
                .HasKey(rp => new { rp.RoleId, rp.PermissionId });

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Role)
                .WithMany(r => r.RolePermissions)
                .HasForeignKey(rp => rp.RoleId);

            modelBuilder.Entity<RolePermission>()
                .HasOne(rp => rp.Permission)
                .WithMany(p => p.RolePermissions)
                .HasForeignKey(rp => rp.PermissionId);

            // Заготовка ролей
            modelBuilder.Entity<Role>().HasData(
                new Role { Id = 1, Name = "superadmin", Description = "Полный доступ", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new Role { Id = 2, Name = "developer", Description = "Доступ к разработке", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new Role { Id = 3, Name = "master", Description = "Мастер производства", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
                new Role { Id = 4, Name = "operator", Description = "Оператор", CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
            );

            // Заготовка прав
            modelBuilder.Entity<Permission>().HasData(
                new Permission { Id = 1, Name = "view_dashboard", Description = "Просмотр главной страницы" },
                new Permission { Id = 2, Name = "view_users", Description = "Просмотр списка пользователей" },
                new Permission { Id = 3, Name = "manage_users", Description = "Управление пользователями" },
                new Permission { Id = 4, Name = "manage_roles", Description = "Управление ролями" },
                new Permission { Id = 5, Name = "view_control_panel", Description = "Просмотр панели управления" }
            );

            modelBuilder.Entity<User>()
                .HasOne(u => u.Role)
                .WithMany(r => r.Users)
                .HasForeignKey(u => u.RoleId);
        }
    }
}
