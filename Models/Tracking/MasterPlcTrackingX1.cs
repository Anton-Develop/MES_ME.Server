using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models.Tracking;

[Table("master_plc_tracking_x1_view", Schema = "telegraf")]
    public class MasterPlcTrackingX1
    {
        [Column("time")]
        public DateTimeOffset? Time { get; set; }

        [Column("x1_slab")] public double? X1Slab { get; set; }
        [Column("x1_melt")] public int? X1Melt { get; set; }
        [Column("x1_partno")] public int? X1PartNo { get; set; }
        [Column("x1_pack")] public int? X1Pack { get; set; }
        [Column("x1_sheetno")] public int? X1SheetNo { get; set; }
        [Column("x1_thickness")] public double? X1Thickness { get; set; }
        [Column("x1_width")] public double? X1Width { get; set; }
        [Column("x1_length")] public double? X1Length { get; set; }
        [Column("x1_weight")] public double? X1Weight { get; set; }
        [Column("x1_alloycodetext")] public string? X1AlloyCodeText { get; set; }
        [Column("x1_seqstate")] public short? X1SeqState { get; set; }
        [Column("x1_seqposition")] public double? X1SeqPosition { get; set; }
        [Column("x1_seqspeed")] public double? X1SeqSpeed { get; set; }
        [Column("quality")] public string? Quality { get; set; }
    }
