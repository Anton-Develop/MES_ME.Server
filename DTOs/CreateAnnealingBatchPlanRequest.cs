// DTOs/CreateAnnealingBatchPlanRequest.cs
using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs 
{
    public class CreateAnnealingBatchPlanRequest
    {
        [Required(ErrorMessage = "Название плана обязательно.")]
        public string PlanName { get; set; } = null!;

        public string? FurnaceNumber { get; set; } 
        public DateTimeOffset? ScheduledStartTime { get; set; }
        public DateTimeOffset? ScheduledEndTime { get; set; }
        public string? Notes { get; set; }
        // created_by будет получен из контекста запроса

        // Список MatId для добавления в план
        public List<string> MatIds { get; set; } = new List<string>();
    }
}