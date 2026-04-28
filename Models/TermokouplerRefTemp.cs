// Models/TermokouplerRefTemp.cs
using System.ComponentModel.DataAnnotations.Schema;

namespace MES_ME.Server.Models
{
    /// <summary>
    /// Модель для представления telegraf.termokoupler_reftemp.
    /// Содержит данные о температуре с термопар (TE) и эталонной температуре (RefT) по зонам.
    /// </summary>
    [Table("termokoupler_reftemp", Schema = "telegraf")]
    public class TermokouplerRefTemp
    {
        [Column("time")]
        public DateTimeOffset? Time { get; set; }

        // Зона 1, Печь 1 (HTR1)
        [Column("htr1_zone_1_1_te")] public double? Htr1Zone11Te { get; set; }
        [Column("htr1_zone_1_1_reft")] public double? Htr1Zone11RefT { get; set; }
        [Column("htr1_zone_1_2_te")] public double? Htr1Zone12Te { get; set; }
        [Column("htr1_zone_1_2_reft")] public double? Htr1Zone12RefT { get; set; }

        // Зона 1, Печь 2 (HTR2)
        [Column("htr2_zone_1_3_te")] public double? Htr2Zone13Te { get; set; }
        [Column("htr2_zone_1_3_reft")] public double? Htr2Zone13RefT { get; set; }
        [Column("htr2_zone_1_4_te")] public double? Htr2Zone14Te { get; set; }
        [Column("htr2_zone_1_4_reft")] public double? Htr2Zone14RefT { get; set; }

        // Зона 2, Печь 3 (HTR3)
        [Column("htr3_zone_2_1_te")] public double? Htr3Zone21Te { get; set; }
        [Column("htr3_zone_2_1_reft")] public double? Htr3Zone21RefT { get; set; }
        [Column("htr3_zone_2_2_te")] public double? Htr3Zone22Te { get; set; }
        [Column("htr3_zone_2_2_reft")] public double? Htr3Zone22RefT { get; set; }

        // Зона 2, Печь 4 (HTR4)
        [Column("htr4_zone_2_3_te")] public double? Htr4Zone23Te { get; set; }
        [Column("htr4_zone_2_3_reft")] public double? Htr4Zone23RefT { get; set; }
        [Column("htr4_zone_2_4_te")] public double? Htr4Zone24Te { get; set; }
        [Column("htr4_zone_2_4_reft")] public double? Htr4Zone24RefT { get; set; }

        // Зоны 3 и 4, Печь Master (HTRM)
        // Зона 3
        [Column("htrm_zone_3_1_te")] public double? HtrmZone31Te { get; set; }
        [Column("htrm_zone_3_1_reft")] public double? HtrmZone31RefT { get; set; }
        [Column("htrm_zone_3_2_te")] public double? HtrmZone32Te { get; set; }
        [Column("htrm_zone_3_2_reft")] public double? HtrmZone32RefT { get; set; }
        [Column("htrm_zone_3_3_te")] public double? HtrmZone33Te { get; set; }
        [Column("htrm_zone_3_3_reft")] public double? HtrmZone33RefT { get; set; }
        [Column("htrm_zone_3_4_te")] public double? HtrmZone34Te { get; set; }
        [Column("htrm_zone_3_4_reft")] public double? HtrmZone34RefT { get; set; }
        // Зона 4
        [Column("htrm_zone_4_1_te")] public double? HtrmZone41Te { get; set; }
        [Column("htrm_zone_4_1_reft")] public double? HtrmZone41RefT { get; set; }
        [Column("htrm_zone_4_2_te")] public double? HtrmZone42Te { get; set; }
        [Column("htrm_zone_4_2_reft")] public double? HtrmZone42RefT { get; set; }
        [Column("htrm_zone_4_3_te")] public double? HtrmZone43Te { get; set; }
        [Column("htrm_zone_4_3_reft")] public double? HtrmZone43RefT { get; set; }
        [Column("htrm_zone_4_4_te")] public double? HtrmZone44Te { get; set; }
        [Column("htrm_zone_4_4_reft")] public double? HtrmZone44RefT { get; set; }
    }
}