using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs
{
    public class UpdateAnnealingScheduleExecutionRequest
    {
        [Required(ErrorMessage = "Статус выполнения обязателен.")]
        public string Status { get; set; } = null!; // Новый статус выполнения

        public string? Comment { get; set; } // Комментарий
        // executed_by будет получен из контекста запроса
        // executed_at будет установлен сервером
    }
}
