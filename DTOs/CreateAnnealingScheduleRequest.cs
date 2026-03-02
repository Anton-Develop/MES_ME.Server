using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs
{
    public class CreateAnnealingScheduleRequest
    {
        [Required(ErrorMessage = "Идентификатор листа (MatId) обязателен.")]
        public string MatId { get; set; } = null!;

        public int? SequenceNumber { get; set; }
        public string? FurnaceNumber { get; set; }
        public DateTimeOffset? ScheduledStartTime { get; set; }
        public DateTimeOffset? ScheduledEndTime { get; set; }
        public string? Notes { get; set; }
        // created_by будет получен из контекста запроса
    }
}
