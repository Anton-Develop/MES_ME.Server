using System;

namespace MES_ME.Server.DTOs;

public class HmiPlanDto
{
    public int Id { get; set; }
    public string PlanName { get; set; } = string.Empty;
    public string Furnace { get; set; } = string.Empty;
    public string Date { get; set; }  = string.Empty; // Преобразовать из ScheduledStartTime
    public string? Time { get; set; } = string.Empty; // Преобразовать из ScheduledStartTime
    public string Status { get; set; } = string.Empty;
    public int SheetCount { get; set; }
}
