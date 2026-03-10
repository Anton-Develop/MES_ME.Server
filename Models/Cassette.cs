using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MES_ME.Server.Models
{
    [Table("cassettes", Schema = "mes")]
    public class Cassette
    {
        [Key]
        [Column("cassette_id")]
        public string CassetteId { get; set; } = null!; // Уникальный идентификатор кассеты

        [Column("status")]
        [MaxLength(50)] // Соответствует VARCHAR(50) в БД
        public string Status { get; set; } = "Создана"; // Статус по умолчанию

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; // Дата создания

        [Column("created_by")]
        [MaxLength(255)]
        public string? CreatedBy { get; set; } // Кто создал

        [Column("current_operator_id")]
        [MaxLength(255)]
        public string? CurrentOperatorId { get; set; } // Текущий оператор

        [Column("current_master_id")]
        [MaxLength(255)]
        public string? CurrentMasterId { get; set; } // Текущий мастер

        [Column("notes")]
        public string? Notes { get; set; } // Заметки

        // Навигационное свойство для лога статусов (опционально, если планируете использовать)
        // public virtual ICollection<CassetteStatusLog> StatusLogs { get; set; } = new List<CassetteStatusLog>();
        // Навигационное свойство для связанных листов (опционально)
        public virtual ICollection<SheetCassetteLink> LinkedSheets { get; set; } = new List<SheetCassetteLink>();
         // --- НОВОЕ: Навигационное свойство ---
        [JsonIgnore] // Игнорировать при сериализации в JSON (API), если не нужно возвращать сразу все связи
        public virtual ICollection<CassettePlanLink> CassettePlanLinks { get; set; } = new List<CassettePlanLink>();
        // --- КОНЕЦ НОВОГО ---
    }
    
}
