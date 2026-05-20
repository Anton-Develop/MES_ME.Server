using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models
{
    [Table("furnace_cassette_sessions", Schema = "mes")]
    public class FurnaceCassetteSession
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("furnace_number")]
        public int FurnaceNumber { get; set; }

        [Column("cassette_id")]
        [MaxLength(10)]
        public string CassetteId { get; set; } = string.Empty;

        [Column("loaded_at")]
        public DateTime LoadedAt { get; set; }

        [Column("unloaded_at")]
        public DateTime? UnloadedAt { get; set; }

        [Column("loaded_by")]
        [MaxLength(100)]
        public string? LoadedBy { get; set; }

        [Column("unloaded_by")]
        [MaxLength(100)]
        public string? UnloadedBy { get; set; }

        [Column("source")]
        [MaxLength(20)]
        public string Source { get; set; } = "HMI";

        [Column("completed_by_plc")]
        public bool CompletedByPLC { get; set; }

        // Navigation properties
        [ForeignKey(nameof(CassetteId))]
        public virtual Cassette? Cassette { get; set; }
    }
}