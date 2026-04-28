using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.DTOs.Tracking;

[Table("master_plc_tracking_e1_view", Schema = "telegraf")]
    public class MasterPlcTrackingE1
    {
        [Column("time")]
        public DateTimeOffset? Time { get; set; } 

        [Column("e1_slab")] public double? E1Slab { get; set; }
        [Column("e1_melt")] public int? E1Melt { get; set; }
        [Column("e1_partno")] public int? E1PartNo { get; set; }
        [Column("e1_pack")] public int? E1Pack { get; set; }
        [Column("e1_sheetno")] public int? E1SheetNo { get; set; }
        [Column("e1_thickness")] public double? E1Thickness { get; set; }
        [Column("e1_width")] public double? E1Width { get; set; }
        [Column("e1_length")] public double? E1Length { get; set; }
        [Column("e1_weight")] public double? E1Weight { get; set; }
        [Column("e1_alloycodetext")] public string? E1AlloyCodeText { get; set; }
        [Column("e1_seqstate")] public short? E1SeqState { get; set; }
        [Column("e1_seqposition")] public double? E1SeqPosition { get; set; }
        [Column("e1_seqspeed")] public double? E1SeqSpeed { get; set; }
        [Column("quality")] public string? Quality { get; set; }
    }
