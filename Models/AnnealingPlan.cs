using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MES_ME.Server.Models;

[Table("annealing_plans", Schema = "mes")] // Указываем имя таблицы в БД
public class AnnealingPlan
{
    [Key]
        public string PlanId { get; set; } = null!; // Уникальный ID плана (например, AP####)

        [Required]
        [StringLength(255)]
        public string PlanName { get; set; } = string.Empty; // Название плана

        public DateTime? ScheduledStartTime { get; set; } // Планируемое время начала
        public DateTime? ScheduledEndTime { get; set; }   // Планируемое время окончания
        public DateTime? ActualStartTime { get; set; }    // Фактическое время начала
        public DateTime? ActualEndTime { get; set; }      // Фактическое время окончания

        [Required]
        [StringLength(50)] // Установите подходящую длину для статуса
        public string Status { get; set; } = "Создан"; // Текущий статус плана

        [StringLength(50)] // Установите подходящую длину для номера печи
        public string? FurnaceNumber { get; set; } // Номер печи

        public string? Notes { get; set; } // Заметки

        public int CassettesCount { get; set; } = 0; // Количество кассет в плане
        public decimal TotalWeightKg { get; set; } = 0; // Общий вес кассет (или листов в них)

}
