// Models/AnnealingBatchPlanSheet.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models // Замените на ваше пространство имён
{
    [Table("annealing_batch_plan_sheets", Schema = "mes")]
    public class AnnealingBatchPlanSheet
    {
        [Key]
        [Column("link_id")]
        public int LinkId { get; set; } // Уникальный ID связи

        [Column("plan_id")]
        public int PlanId { get; set; } // Ссылка на план

        [Column("matid")]
        [MaxLength(10)]
        [Required]
        public string MatId { get; set; } = null!; // Ссылка на лист

        [Column("sequence_number")]
        public int? SequenceNumber { get; set; } // Порядковый номер листа в плане (опционально)

        [Column("status_override")]
        [MaxLength(50)]
        public string? StatusOverride { get; set; } // Переопределение статуса для листа (опционально)

        [Column("execution_comment")]
        public string? ExecutionComment { get; set; } // Комментарий для листа (опционально)

        // Навигационное свойство для плана (многие к одному)
        public virtual AnnealingBatchPlan? BatchPlan { get; set; }
        // Навигационное свойство для листа (многие к одному)
        public virtual InputDatum? Sheet { get; set; }
    }
}