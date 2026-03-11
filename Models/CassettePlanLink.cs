using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models;

[Table("cassette_annealing_plan_links", Schema = "mes")] // Указываем имя таблицы в БД
    public class CassettePlanLink
    {
       [Key]
        [Column("id")] // Указываем имя столбца в БД
        public int Id { get; set; } // Первичный ключ для связи (если нужен)

        [Required]
        [StringLength(50)] // Длина ID кассеты (например, CAS####)
        [Column("cassette_id")] // Указываем имя столбца в БД
        public string CassetteId { get; set; } = null!;

        [Required]
        [StringLength(50)] // Длина ID плана (например, AP####)
        [Column("plan_id")] // Указываем имя столбца в БД
        public string PlanId { get; set; } = null!;

        // Порядковый номер кассеты в плане (опционально)
        [Column("cassette_number_in_plan")] // Указываем имя столбца в БД
        public int? CassetteNumberInPlan { get; set; }

        // Навигационные свойства (опционально, для удобства запросов)
        // public virtual Cassette Cassette { get; set; } = null!;
        // public virtual AnnealingPlan AnnealingPlan { get; set; } = null!;
    }
