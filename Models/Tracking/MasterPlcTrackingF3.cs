using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models.Tracking;

[Table("master_plc_tracking_f3_view", Schema = "telegraf")]
    public class MasterPlcTrackingF3
    {
        [Column("time")]
        public DateTimeOffset? Time { get; set; }

        [Column("f3_slab")] public double? F3Slab { get; set; }
        [Column("f3_melt")] public int? F3Melt { get; set; }
        [Column("f3_partno")] public int? F3PartNo { get; set; }
        [Column("f3_pack")] public int? F3Pack { get; set; }
        [Column("f3_sheetno")] public int? F3SheetNo { get; set; }
        [Column("f3_thickness")] public double? F3Thickness { get; set; }
        [Column("f3_width")] public double? F3Width { get; set; }
        [Column("f3_length")] public double? F3Length { get; set; }
        [Column("f3_weight")] public double? F3Weight { get; set; }
        [Column("f3_alloycodetext")] public string? F3AlloyCodeText { get; set; }
        [Column("f3_seqstate")] public short? F3SeqState { get; set; }
        [Column("f3_seqposition")] public double? F3SeqPosition { get; set; }
        [Column("f3_seqspeed")] public double? F3SeqSpeed { get; set; }
        [Column("quality")] public string? Quality { get; set; }
    }
