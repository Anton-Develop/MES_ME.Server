namespace MES_ME.Server.DTOs
{
    public class UpdateAnnealingBatchPlanRequest
    {
        public string? PlanName { get; set; }
        public string? FurnaceNumber { get; set; }
        public DateTime? ScheduledStartTime { get; set; }
        public DateTime? ScheduledEndTime { get; set; }
        public string? Notes { get; set; }
        
        public List<string> MatIds { get; set; } = new(); // По умолчанию пустой список
    }
}
