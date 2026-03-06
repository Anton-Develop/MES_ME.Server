using System;

namespace MES_ME.Server.DTOs;

public class AnnealingPlanDetailsDto
{

    public int PlanId { get; set; }
    public string PlanName { get; set; }
    public string FurnaceNumber { get; set; }
    public DateTimeOffset? ScheduledStartTime { get; set; }
    public DateTimeOffset? ScheduledEndTime { get; set; }
    public string Status { get; set; }
    public string Notes { get; set; }
    
    // Список листов
    public List<PlanSheetDetailDto> Sheets { get; set; } = new();
    
    // Итоговые суммы
    public int TotalSheetsCount { get; set; }
    public decimal TotalWeight { get; set; }

}
