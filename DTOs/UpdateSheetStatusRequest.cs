using System;
using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs;

public class UpdateSheetStatusRequest
{
     [Required(ErrorMessage = "Новый статус обязателен.")]
    public string NewStatus { get; set; } = null!;

}
