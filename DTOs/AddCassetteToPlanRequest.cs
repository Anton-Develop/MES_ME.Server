using System;
using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs;

public class AddCassetteToPlanRequest
{
            [Required]
            public string CassetteId { get; set; } = string.Empty;
            public int? CassetteNumberInPlan { get; set; }
}
