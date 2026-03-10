using System;
using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs;

public class UpdateAnnealingPlanStatusRequest
{
            [Required]
            public string NewStatus { get; set; } = string.Empty;
            public string? Comment { get; set; }
}
