// Models/SheetMeasurement.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models
{
    [Table("sheet_measurements", Schema = "plc")]
    public class SheetMeasurement
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("sheet")]
        public int Sheet { get; set; }

        [Column("melt")]
        public int? Melt { get; set; }

        [Column("slab")]
        public int? Slab { get; set; }

        [Column("part_no")]
        public int? PartNo { get; set; }

        [Column("pack")]
        public int? Pack { get; set; }

        [Column("sheet_in_pack")]
        public int? SheetInPack { get; set; }

        [Column("sheets_in_pack")]
        public int? SheetsInPack { get; set; }

        [Column("thickness")]
        public float? Thickness { get; set; }

        [Column("alloy_code_text")]
        public string? AlloyCodeText { get; set; }

        [Column("entered_x2_at")]
        public DateTime? EnteredX2At { get; set; }

        // 8 точек до кантовки
        [Column("h1_before")] public float? H1Before { get; set; }
        [Column("h2_before")] public float? H2Before { get; set; }
        [Column("h3_before")] public float? H3Before { get; set; }
        [Column("h4_before")] public float? H4Before { get; set; }
        [Column("h5_before")] public float? H5Before { get; set; }
        [Column("h6_before")] public float? H6Before { get; set; }
        [Column("h7_before")] public float? H7Before { get; set; }
        [Column("h8_before")] public float? H8Before { get; set; }

        // 8 точек после кантовки
        [Column("h1_after")] public float? H1After { get; set; }
        [Column("h2_after")] public float? H2After { get; set; }
        [Column("h3_after")] public float? H3After { get; set; }
        [Column("h4_after")] public float? H4After { get; set; }
        [Column("h5_after")] public float? H5After { get; set; }
        [Column("h6_after")] public float? H6After { get; set; }
        [Column("h7_after")] public float? H7After { get; set; }
        [Column("h8_after")] public float? H8After { get; set; }

        [Column("measured_at")]
        public DateTime? MeasuredAt { get; set; }

        [Column("measured_by")]
        public string? MeasuredBy { get; set; }

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; } = DateTime.UtcNow;
    }
}