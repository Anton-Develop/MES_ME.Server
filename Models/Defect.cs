using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models;

[Table("defects", Schema = "mes")]
public class Defect
{
    [Key]
    [Column("id")]
    public long Id { get; set; }

    [Column("mat_id")]
    [Required]
    [MaxLength(50)]
    public string MatId { get; set; } = string.Empty;

    [Column("defect_type_id")]
    public int? DefectTypeId { get; set; }

    [Column("defect_code")]
    [MaxLength(50)]
    public string? DefectCode { get; set; }

    [Column("defect_description")]
    public string? DefectDescription { get; set; }

    [Column("severity")]
    public int Severity { get; set; } = 1;

    [Column("detected_at_zone")]
    [MaxLength(10)]
    public string? DetectedAtZone { get; set; }

    [Column("detected_by_process")]
    [MaxLength(50)]
    public string? DetectedByProcess { get; set; }

    [Column("detected_by")]
    [Required]
    [MaxLength(100)]
    public string DetectedBy { get; set; } = string.Empty;

    [Column("detected_at")]
    public DateTime DetectedAt { get; set; }

    [Column("status")]
    [MaxLength(50)]
    public string Status { get; set; } = "open";

    [Column("resolved_at")]
    public DateTime? ResolvedAt { get; set; }

    [Column("resolved_by")]
    [MaxLength(100)]
    public string? ResolvedBy { get; set; }

    [Column("resolution_notes")]
    public string? ResolutionNotes { get; set; }

    [Column("metadata", TypeName = "jsonb")]
    public string? Metadata { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [ForeignKey(nameof(DefectTypeId))]
    public DefectType? DefectType { get; set; }

    [ForeignKey(nameof(MatId))]
    public InputDatum? Sheet { get; set; }
}

[Table("defect_types", Schema = "mes")]
public class DefectType
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("code")]
    [Required]
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;

    [Column("name")]
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("severity")]
    public int Severity { get; set; } = 1;

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
     public ICollection<Defect>? Defects { get; set; }
}