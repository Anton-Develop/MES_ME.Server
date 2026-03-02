// Models/AnnealingSchedule.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models // Замените на ваше пространство имён
{
    [Table("annealing_schedule", Schema = "mes")]
    public class AnnealingSchedule
    {
        [Key]
        [Column("annealing_plan_id")]
        public int AnnealingPlanId { get; set; } // Уникальный ID записи плана закалки

        [Column("matid")]
        [MaxLength(10)] // Длина matid
        [Required]
        public string MatId { get; set; } = null!; // Ссылка на лист

        [Column("sequence_number")]
        public int? SequenceNumber { get; set; } // Порядковый номер (опционально)

        [Column("furnace_type")]
        [MaxLength(50)]
        public string? FurnaceType { get; set; } = "Закалочная"; // Тип печи

        [Column("furnace_number")]
        [MaxLength(50)]
        public string? FurnaceNumber { get; set; } // Номер печи

        [Column("scheduled_start_time")]
        public DateTimeOffset? ScheduledStartTime { get; set; } // Запланированное начало

        [Column("scheduled_end_time")]
        public DateTimeOffset? ScheduledEndTime { get; set; } // Запланированное окончание

        [Column("actual_start_time")]
        public DateTimeOffset? ActualStartTime { get; set; } // Фактическое начало

        [Column("actual_end_time")]
        public DateTimeOffset? ActualEndTime { get; set; } // Фактическое окончание

        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "Запланировано"; // Статус выполнения

        [Column("execution_comment")]
        public string? ExecutionComment { get; set; } // Комментарий

        [Column("executed_by")]
        [MaxLength(255)]
        public string? ExecutedBy { get; set; } // Кто выполнил

        [Column("executed_at")]
        public DateTimeOffset? ExecutedAt { get; set; } // Когда выполнено

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; // Создано

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow; // Обновлено

        [Column("created_by")]
        [MaxLength(255)]
        public string? CreatedBy { get; set; } // Кто создал

        [Column("notes")]
        public string? Notes { get; set; } // Примечания

        // Навигационное свойство для листа (опционально)
         public virtual InputDatum? Sheet { get; set; }
    }
}