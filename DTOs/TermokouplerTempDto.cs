using System;

namespace MES_ME.Server.DTOs;

public class TermokouplerAllValuesDto
    {
        public DateTimeOffset? Time { get; set; }

        // Зона 1, Печь 1 (HTR1)
        public double? Htr1Zone11Te { get; set; }
        public double? Htr1Zone11RefT { get; set; }
        public double? Htr1Zone12Te { get; set; }
        public double? Htr1Zone12RefT { get; set; }

        // Зона 1, Печь 2 (HTR2)
        public double? Htr2Zone13Te { get; set; }
        public double? Htr2Zone13RefT { get; set; }
        public double? Htr2Zone14Te { get; set; }
        public double? Htr2Zone14RefT { get; set; }

        // Зона 2, Печь 3 (HTR3)
        public double? Htr3Zone21Te { get; set; }
        public double? Htr3Zone21RefT { get; set; }
        public double? Htr3Zone22Te { get; set; }
        public double? Htr3Zone22RefT { get; set; }

        // Зона 2, Печь 4 (HTR4)
        public double? Htr4Zone23Te { get; set; }
        public double? Htr4Zone23RefT { get; set; }
        public double? Htr4Zone24Te { get; set; }
        public double? Htr4Zone24RefT { get; set; }

        // Зоны 3 и 4, Печь Master (HTRM)
        // Зона 3
        public double? HtrmZone31Te { get; set; }
        public double? HtrmZone31RefT { get; set; }
        public double? HtrmZone32Te { get; set; }
        public double? HtrmZone32RefT { get; set; }
        public double? HtrmZone33Te { get; set; }
        public double? HtrmZone33RefT { get; set; }
        public double? HtrmZone34Te { get; set; }
        public double? HtrmZone34RefT { get; set; }
        // Зона 4
        public double? HtrmZone41Te { get; set; }
        public double? HtrmZone41RefT { get; set; }
        public double? HtrmZone42Te { get; set; }
        public double? HtrmZone42RefT { get; set; }
        public double? HtrmZone43Te { get; set; }
        public double? HtrmZone43RefT { get; set; }
        public double? HtrmZone44Te { get; set; }
        public double? HtrmZone44RefT { get; set; }
    }