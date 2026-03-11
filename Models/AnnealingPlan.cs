using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MES_ME.Server.Models;

[Table("annealing_plans", Schema = "mes")] // Указываем имя таблицы в БД
public class AnnealingPlan
{
     [Key]
        [Column("plan_id")] // Указываем имя столбца в БД
        public string PlanId { get; set; } = null!; // Уникальный ID плана (например, AP####)

        [Required]
        [StringLength(255)]
        [Column("plan_name")] // Указываем имя столбца в БД
        public string PlanName { get; set; } = string.Empty; // Название плана

        [Column("scheduled_start_time")] // Указываем имя столбца в БД
        public DateTime? ScheduledStartTime { get; set; } // Планируемое время начала

        [Column("scheduled_end_time")] // Указываем имя столбца в БД
        public DateTime? ScheduledEndTime { get; set; }   // Планируемое время окончания

        [Column("actual_start_time")] // Указываем имя столбца в БД
        public DateTime? ActualStartTime { get; set; }    // Фактическое время начала

        [Column("actual_end_time")] // Указываем имя столбца в БД
        public DateTime? ActualEndTime { get; set; }      // Фактическое время окончания

        [Required]
        [StringLength(50)] // Установите подходящую длину для статуса
        [Column("status")] // Указываем имя столбца в БД
        public string Status { get; set; } = "Создан"; // Текущий статус плана

        [StringLength(50)] // Установите подходящую длину для номера печи
        [Column("furnace_number")] // Указываем имя столбца в БД
        public string? FurnaceNumber { get; set; } // Номер печи

        [Column("notes")] // Указываем имя столбца в БД
        public string? Notes { get; set; } // Заметки

        [Column("cassettes_count")] // Указываем имя столбца в БД
        public int CassettesCount { get; set; } = 0; // Количество кассет в плане

        [Column("total_weight_kg")] // Указываем имя столбца в БД
        public decimal TotalWeightKg { get; set; } = 0; // Общий вес кассет (или листов в них)
}
