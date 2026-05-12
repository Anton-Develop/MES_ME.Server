// DTOs/SheetMeasurementDto.cs
namespace MES_ME.Server.DTOs
{
    public class SheetMeasurementDto
    {
        public long? Id { get; set; }
        public int? Sheet { get; set; }
        public int? Melt { get; set; }
        public int? Slab { get; set; }
        public int? PartNo { get; set; }
        public int? Pack { get; set; }
        public int? SheetInPack { get; set; }
        public int? SheetsInPack { get; set; }
        public float? Thickness { get; set; }
        public string? AlloyCodeText { get; set; }
        public DateTime? EnteredX2At { get; set; }
        public float? H1Before { get; set; }
        public float? H2Before { get; set; }
        public float? H3Before { get; set; }
        public float? H4Before { get; set; }
        public float? H5Before { get; set; }
        public float? H6Before { get; set; }
        public float? H7Before { get; set; }
        public float? H8Before { get; set; }
        public float? H1After { get; set; }
        public float? H2After { get; set; }
        public float? H3After { get; set; }
        public float? H4After { get; set; }
        public float? H5After { get; set; }
        public float? H6After { get; set; }
        public float? H7After { get; set; }
        public float? H8After { get; set; }
        public DateTime? MeasuredAt { get; set; }
        public string? MeasuredBy { get; set; }
        public DateTime? CreatedAt { get; set; }
    }

    public class CreateMeasurementRequest
    {
        public int? Sheet { get; set; }
        public int? Melt { get; set; }
        public int? Slab { get; set; }
        public int? PartNo { get; set; }
        public int? Pack { get; set; }
        public int? SheetInPack { get; set; }
        public int? SheetsInPack { get; set; }
        public float? Thickness { get; set; }
        public string? AlloyCodeText { get; set; }
        public DateTime? EnteredX2At { get; set; }
    }

    public class SaveMeasurementsRequest
    {
        public float? H1Before { get; set; }
        public float? H2Before { get; set; }
        public float? H3Before { get; set; }
        public float? H4Before { get; set; }
        public float? H5Before { get; set; }
        public float? H6Before { get; set; }
        public float? H7Before { get; set; }
        public float? H8Before { get; set; }
        public float? H1After { get; set; }
        public float? H2After { get; set; }
        public float? H3After { get; set; }
        public float? H4After { get; set; }
        public float? H5After { get; set; }
        public float? H6After { get; set; }
        public float? H7After { get; set; }
        public float? H8After { get; set; }
        public string? MeasuredBy { get; set; }
        public DateTime? MeasuredAt { get; set; }
    }
}