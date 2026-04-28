using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models.Tracking;

[Table("master_plc_tracking_f2_view", Schema = "telegraf")]
    public class MasterPlcTrackingF2
    {
        [Column("time")]
        public DateTimeOffset? Time { get; set; }

        [Column("f2_slab")] public double? F2Slab { get; set; }
        [Column("f2_melt")] public int? F2Melt { get; set; }
        [Column("f2_partno")] public int? F2PartNo { get; set; }
        [Column("f2_pack")] public int? F2Pack { get; set; }
        [Column("f2_sheetno")] public int? F2SheetNo { get; set; }
        [Column("f2_thickness")] public double? F2Thickness { get; set; }
        [Column("f2_width")] public double? F2Width { get; set; }
        [Column("f2_length")] public double? F2Length { get; set; }
        [Column("f2_weight")] public double? F2Weight { get; set; }
        [Column("f2_alloycodetext")] public string? F2AlloyCodeText { get; set; }
        [Column("f2_seqstate")] public short? F2SeqState { get; set; }
        [Column("f2_seqposition")] public double? F2SeqPosition { get; set; }
        [Column("f2_seqspeed")] public double? F2SeqSpeed { get; set; }
        [Column("quality")] public string? Quality { get; set; }
    }
