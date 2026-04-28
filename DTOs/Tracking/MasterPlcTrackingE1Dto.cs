using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.DTOs.Tracking;


    public class MasterPlcTrackingE1Dto
    {
        public DateTimeOffset? Time { get; set; }
        public double? Slab { get; set; }
        public int? Melt { get; set; }
        public int? PartNo { get; set; }
        public int? Pack { get; set; }
        public int? SheetNo { get; set; }
        public double? Thickness { get; set; }
        public double? Width { get; set; }
        public double? Length { get; set; }
        public double? Weight { get; set; }
        public string? AlloyCodeText { get; set; }
        public short? SeqState { get; set; }
        public double? SeqPosition { get; set; }
        public double? SeqSpeed { get; set; }
        public string? Quality { get; set; }
    }
