using System;

namespace MES_ME.Server.DTOs;

public class AnnealingReportItem
{
    public int PlanId { get; set; }
    public string PlanName { get; set; }
    public string Status { get; set; }
    public string FurnaceNumber { get; set; }
    public DateTimeOffset? ScheduledStartTime { get; set; }
    public DateTimeOffset? ScheduledEndTime { get; set; }
    public DateTimeOffset? ActualStartTime { get; set; }
    public DateTimeOffset? ActualEndTime { get; set; }
    public string Notes { get; set; }
    public int SheetsCount { get; set; }
    public decimal TotalWeightKg { get; set; }
    public string SheetDetails { get; set; } // Опционально: список MatID через запятую
}