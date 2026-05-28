using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models;

[Table("cassette_sheets", Schema = "mes")]
public class CassetteSheet
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("cassette_business_key")]
    [Required]
    [MaxLength(100)]
    public string CassetteBusinessKey { get; set; } = string.Empty;

    [Column("mat_id")]
    [Required]
    [MaxLength(50)]
    public string MatId { get; set; } = string.Empty;

    [Column("added_at")]
    public DateTime AddedAt { get; set; }

    [Column("added_by")]
    [Required]
    [MaxLength(100)]
    public string AddedBy { get; set; } = string.Empty;

    [Column("sort_order")]
    public int SortOrder { get; set; }

    [Column("edited_at")]
    public DateTime? EditedAt { get; set; }

    [Column("edited_by")]
    [MaxLength(100)]
    public string? EditedBy { get; set; }

    [Column("edit_reason")]
    public string? EditReason { get; set; }

    // Navigation
    [ForeignKey(nameof(MatId))]
    public InputDatum? Sheet { get; set; }
}