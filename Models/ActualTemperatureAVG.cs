using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace MES_ME.Server.Models;


[Table("termokoupler_reftemp_actual_avg", Schema = "telegraf")]
public class ActualTemperatureAVG
{
        [Key]
        [Column("zone1_te_avg")]
        public double? Zone_1_TE_avg { get; set; } = 0;
        [Key]
        [Column("zone1_reft_avg")]
        public double? Zone_1_RefTE_avg { get; set; } = 0;
        [Key]
        [Column("zone2_te_avg")]
        public double? Zone_2_TE_avg { get; set; } = 0;
        [Key]
        [Column("zone2_reft_avg")]
        public double? Zone_2_RefTE_avg { get; set; } = 0;
        [Key]
        [Column("zone3_te_avg")]
        public double? Zone_3_TE_avg { get; set; } = 0;
        [Key]
        [Column("zone3_reft_avg")]
        public double? Zone_3_RefTE_avg { get; set; } = 0;
        [Key]
        [Column("zone4_te_avg")]
        public double? Zone_4_TE_avg { get; set; } = 0;
        [Key]
        [Column("zone4_reft_avg")]
        public double? Zone_4_RefTE_avg { get; set; } = 0;

}
