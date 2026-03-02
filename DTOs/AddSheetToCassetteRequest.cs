using System;
using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs;

public class AddSheetToCassetteRequest
{
        [Required(ErrorMessage = "Идентификатор листа (MatId) обязателен.")]
        public string MatId { get; set; } = null!;
}
