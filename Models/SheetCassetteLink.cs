
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models 
{
    [Table("sheet_cassette_links", Schema = "mes")]
    public class SheetCassetteLink
    {
        [Key]
        [Column("link_id")]
        public int LinkId { get; set; } // Уникальный ID связи

        [Column("matid")]
        [MaxLength(10)] // Длина matid
        [Required]
        public string MatId { get; set; } = null!; // Ссылка на лист

        [Column("cassette_id")]
        [MaxLength(10)] // Длина cassette_id
        [Required]
        public string CassetteId { get; set; } = null!; // Ссылка на кассету

        [Column("assigned_at")]
        public DateTimeOffset AssignedAt { get; set; } = DateTimeOffset.UtcNow; // Когда добавлен

        [Column("assigned_by")]
        [MaxLength(255)] // Длина имени пользователя
        public string? AssignedBy { get; set; } // Кто добавил

        // Навигационные свойства (опционально, если планируете использовать)
         public virtual InputDatum? Sheet { get; set; }
         public virtual Cassette? Cassette { get; set; }
    }
}