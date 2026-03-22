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

        public DbSet<RoutePermission> RoutePermissions { get; set; }

        // public DbSet<Sheet> Sheets { get; set; }

        public DbSet<InputDatum> InputData { get; set; }

        public DbSet<Cassette> Cassettes { get; set; } // Добавляем DbSet для кассет
        public DbSet<CassetteStatusLog> CassetteStatusLogs { get; set; } // Добавляем DbSet для лога
        public DbSet<SheetCassetteLink> SheetCassetteLinks { get; set; }
        public DbSet<AnnealingSchedule> AnnealingSchedules { get; set; }
        public DbSet<AnnealingBatchPlan> AnnealingBatchPlans { get; set; }
        public DbSet<AnnealingBatchPlanSheet> AnnealingBatchPlanSheets { get; set; } 

        public DbSet<AnnealingPlan> AnnealingPlans { get; set; }
        public DbSet<CassettePlanLink> CassettePlanLinks { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
             base.OnModelCreating(modelBuilder);


            modelBuilder.Entity<RoutePermission>(entity =>
                 {
                     entity.HasKey(e => e.Id);
                     entity.HasIndex(e => e.Path).IsUnique();
                     entity.Property(e => e.Path).IsRequired().HasMaxLength(200);
                     entity.Property(e => e.Label).IsRequired().HasMaxLength(100);
                     entity.Property(e => e.IconName).HasMaxLength(50).HasDefaultValue("Dashboard");
                     entity.Property(e => e.RequiredPermission).IsRequired().HasMaxLength(100);
                 });

            // --- НОВОЕ: Конфигурация новых сущностей ---
            modelBuilder.Entity<AnnealingPlan>(entity =>
            {
                entity.HasKey(e => e.PlanId);
                // entity.Property(e => e.PlanId).ValueGeneratedOnAdd(); // Если ID генерируется вручную, уберите это
                entity.Property(e => e.TotalWeightKg).HasColumnType("decimal(18,2)"); // Убедитесь, что БД поддерживает этот тип
                // Добавьте другие настройки, если нужно
            });

            modelBuilder.Entity<CassettePlanLink>(entity =>
            {
                entity.HasKey(e => e.Id);

                // Опционально: настройка внешних ключей (требует навигационных свойств)
                // entity.HasOne(d => d.Cassette) // Только если есть навигационное свойство
                //     .WithMany(p => p.CassettePlanLinks)
                //     .HasForeignKey(d => d.CassetteId)
                //     .OnDelete(DeleteBehavior.ClientSetNull);

                // entity.HasOne(d => d.AnnealingPlan) // Только если есть навигационное свойство
                //     .WithMany(p => p.CassettePlanLinks)
                //     .HasForeignKey(d => d.PlanId)
                //     .OnDelete(DeleteBehavior.ClientSetNull);

                // Уникальность пары (PlanId, CassetteId), если кассета может быть только в одном плане отпуска одновременно
                entity.HasIndex(e => new { e.PlanId, e.CassetteId }).IsUnique();

                // Опционально: ограничение, чтобы CassetteNumberInPlan было уникальным в рамках одного PlanId
                // entity.HasIndex(e => new { e.PlanId, e.CassetteNumberInPlan }).IsUnique()
                //     .HasFilter("[CassetteNumberInPlan] IS NOT NULL");
            });
            // --- КОНЕЦ НОВОГО ---


 // Настройка связи AnnealingBatchPlanSheet -> AnnealingBatchPlan (Many-to-One)
            modelBuilder.Entity<AnnealingBatchPlanSheet>()
                .HasOne(s => s.BatchPlan) // У AnnealingBatchPlanSheet есть свойство BatchPlan
                .WithMany(bp => bp.LinkedSheets) // У AnnealingBatchPlan есть свойство LinkedSheets
                .HasForeignKey(s => s.PlanId) // Внешний ключ в AnnealingBatchPlanSheet
                .OnDelete(DeleteBehavior.Cascade); // При удалении плана - удаляются связи

            // Настройка связи AnnealingBatchPlanSheet -> InputDatum (Many-to-One)
            modelBuilder.Entity<AnnealingBatchPlanSheet>()
                .HasOne(s => s.Sheet) // У AnnealingBatchPlanSheet есть свойство Sheet
                .WithMany()          // У InputDatum НЕТ свойства, указывающего на список связей
                .HasForeignKey(s => s.MatId) // Внешний ключ в AnnealingBatchPlanSheet
                .OnDelete(DeleteBehavior.Cascade); // При удалении InputDatum - удаляется связь

            // Настройка связи AnnealingSchedule -> InputDatum (Many-to-One)
            modelBuilder.Entity<AnnealingSchedule>()
                .HasOne(s => s.Sheet) // У AnnealingSchedule есть свойство Sheet (если добавлено)
                .WithMany()          // У InputDatum НЕТ свойства, указывающего на список планов закалки
                .HasForeignKey(s => s.MatId) // Внешний ключ в AnnealingSchedule
                .OnDelete(DeleteBehavior.Cascade); // При удалении InputDatum - удаляется план закалки

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


            modelBuilder.Entity<LoginLog>()
                .HasOne(l => l.User)
                .WithMany() // или .WithMany(u => u.LoginLogs) если навигационное свойство определено
                .HasForeignKey(l => l.UserId)
                .OnDelete(DeleteBehavior.Cascade);

          // --- Добавьте этот блок ---
            modelBuilder.Entity<AuditLog>()
                .HasOne(a => a.User) // Предполагается, что у AuditLog есть свойство User
                .WithMany() // или .WithMany(u => u.AuditLogs) если навигационное свойство определено
                .HasForeignKey(a => a.UserId) // Предполагается, что внешний ключ называется UserId
                .OnDelete(DeleteBehavior.Cascade); // Каскадное удаление для AuditLog


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
