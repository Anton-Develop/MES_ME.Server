using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models.Tracking;

[Table("master_plc_tracking_x2_view", Schema = "telegraf")]
    public class MasterPlcTrackingX2
    {
        [Column("time")]
        public DateTimeOffset? Time { get; set; }

        [Column("x2_slab")] public double? X2Slab { get; set; }
        [Column("x2_melt")] public int? X2Melt { get; set; }
        [Column("x2_partno")] public int? X2PartNo { get; set; }
        [Column("x2_pack")] public int? X2Pack { get; set; }
        [Column("x2_sheetno")] public int? X2SheetNo { get; set; }
        [Column("x2_thickness")] public double? X2Thickness { get; set; }
        [Column("x2_width")] public double? X2Width { get; set; }
        [Column("x2_length")] public double? X2Length { get; set; }
        [Column("x2_weight")] public double? X2Weight { get; set; }
        [Column("x2_alloycodetext")] public string? X2AlloyCodeText { get; set; }
        [Column("x2_seqstate")] public short? X2SeqState { get; set; }
        [Column("x2_seqposition")] public double? X2SeqPosition { get; set; }
        [Column("x2_seqspeed")] public double? X2SeqSpeed { get; set; }
        [Column("quality")] public string? Quality { get; set; }
    }
