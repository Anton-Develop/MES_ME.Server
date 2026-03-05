
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.VisualBasic;

namespace MES_ME.Server.Models // Замените на ваше пространство имён
{
    [Table("annealing_batch_plans", Schema = "mes")]
    public class AnnealingBatchPlan
    {
        [Key]
        [Column("plan_id")]
        public int PlanId { get; set; } // Уникальный ID плана

        [Column("plan_name")]
        [MaxLength(255)]
        [Required]
        public string PlanName { get; set; } = null!; // Имя/описание плана

        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Создан"; // Статус выполнения всего плана

        [Column("furnace_number")]
        [MaxLength(50)]
        public string? FurnaceNumber { get; set; } = "1";// Номер печи

        [Column("scheduled_start_time")]
        public DateTimeOffset? ScheduledStartTime { get; set; } = DateAndTime.Now; // Запланированное начало

        [Column("scheduled_end_time")]
        public DateTimeOffset? ScheduledEndTime { get; set; } // Запланированное окончание

        [Column("actual_start_time")]
        public DateTimeOffset? ActualStartTime { get; set; } // Фактическое начало (устанавливается мастером)

        [Column("actual_end_time")]
        public DateTimeOffset? ActualEndTime { get; set; } // Фактическое окончание ( мастером)

        [Column("notes")]
        public string? Notes { get; set; } // Примечания

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; // Создано

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow; // Обновлено

        [Column("created_by")]
        [MaxLength(255)]
        public string? CreatedBy { get; set; } // Кто создал

        // Навигационное свойство для связанных листов (один ко многим)
        public virtual ICollection<AnnealingBatchPlanSheet> LinkedSheets { get; set; } = new List<AnnealingBatchPlanSheet>();
    }
}