using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models;

[Table("cassette_annealing_plan_links", Schema = "mes")] // Указываем имя таблицы в БД
    public class CassettePlanLink
    {
       [Key]
        public int Id { get; set; } // Первичный ключ для связи (если нужен)

        [Required]
        [StringLength(50)] // Длина ID кассеты (например, CAS####)
        public string CassetteId { get; set; } = null!;

        [Required]
        [StringLength(50)] // Длина ID плана (например, AP####)
        public string PlanId { get; set; } = null!;

        // Порядковый номер кассеты в плане (опционально)
        public int? CassetteNumberInPlan { get; set; }

        // Навигационные свойства (опционально, для удобства запросов)
         public virtual Cassette Cassette { get; set; } = null!;
         public virtual AnnealingPlan AnnealingPlan { get; set; } = null!;
    }
