using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models.Tracking;

[Table("master_plc_tracking_f1_view", Schema = "telegraf")]
    public class MasterPlcTrackingF1
    {
        [Column("time")]
        public DateTimeOffset? Time { get; set; }

        [Column("f1_slab")] public double? F1Slab { get; set; }
        [Column("f1_melt")] public int? F1Melt { get; set; }
        [Column("f1_partno")] public int? F1PartNo { get; set; }
        [Column("f1_pack")] public int? F1Pack { get; set; }
        [Column("f1_sheetno")] public int? F1SheetNo { get; set; }
        [Column("f1_thickness")] public double? F1Thickness { get; set; }
        [Column("f1_width")] public double? F1Width { get; set; }
        [Column("f1_length")] public double? F1Length { get; set; }
        [Column("f1_weight")] public double? F1Weight { get; set; }
        [Column("f1_alloycodetext")] public string? F1AlloyCodeText { get; set; }
        [Column("f1_seqstate")] public short? F1SeqState { get; set; }
        [Column("f1_seqposition")] public double? F1SeqPosition { get; set; }
        [Column("f1_seqspeed")] public double? F1SeqSpeed { get; set; }
        [Column("quality")] public string? Quality { get; set; }
    }
