// DTOs/UpdateAnnealingBatchPlanStatusRequest.cs
using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs 
{
    public class UpdateAnnealingBatchPlanStatusRequest
    {
        [Required(ErrorMessage = "Статус плана обязателен.")]
        public string Status { get; set; } = null!; // Новый статус плана

        public string? Comment { get; set; } // Комментарий (можно добавить в Notes или в отдельное поле в будущем)
        // executed_by будет получен из контекста запроса
        // executed_at будет установлен сервером
    }
}