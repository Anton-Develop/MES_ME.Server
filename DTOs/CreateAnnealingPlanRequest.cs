using System;
using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs;

public class CreateAnnealingPlanRequest
{
            [Required]
            [StringLength(255)]
            public string PlanName { get; set; } = string.Empty;

            public DateTime? ScheduledStartTime { get; set; }
            public DateTime? ScheduledEndTime { get; set; }
            public string? FurnaceNumber { get; set; }
            public string? Notes { get; set; }
             public List<string>? CassettesToInclude { get; set; } = new List<string>();
}
