using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models
{
    [Table("cassette_status_log", Schema = "mes")]
    public class CassetteStatusLog
    {
        [Key]
        [Column("log_id")]
        public int LogId { get; set; } // Уникальный ID лога

        [Column("cassette_id")]
        [MaxLength(10)] // Длина cassette_id
        public string CassetteId { get; set; } = null!; // Ссылка на кассету

        [Column("old_status")]
        [MaxLength(50)] // Соответствует VARCHAR(50) в БД
        public string? OldStatus { get; set; } // Предыдущий статус

        [Column("new_status")]
        [Required]
        [MaxLength(50)] // Соответствует VARCHAR(50) в БД
        public string NewStatus { get; set; } = null!; // Новый статус

        [Column("changed_by")]
        [Required]
        [MaxLength(255)] // Соответствует VARCHAR(255) в БД
        public string ChangedBy { get; set; } = null!; // Кто изменил

        [Column("change_timestamp")]
        public DateTimeOffset ChangeTimestamp { get; set; } = DateTimeOffset.UtcNow; // Когда изменено

        [Column("comment")]
        public string? Comment { get; set; } // Комментарий

        // Навигационное свойство для кассеты (опционально)
        // public virtual Cassette? Cassette { get; set; }
    }
}