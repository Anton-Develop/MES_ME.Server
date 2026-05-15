using System;

namespace MES_ME.Server.DTOs;

public class TemperingSessionDTO
{
    public class TemperingSessionFilter
    {
        public int? FurnaceNo { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class TemperingSessionDto
{
    public long Id { get; set; }               // bigserial
    public int FurnaceNo { get; set; }         // int2
    public DateTime StartedAt { get; set; }    // timestamptz
    public DateTime? EndedAt { get; set; }     // timestamptz, может быть NULL, если сессия ещё не завершена (но в отчётах обычно завершённые)
    public float? DurationMin { get; set; }    // float4

    // Температурные характеристики
    public float? TempMin { get; set; }
    public float? TempMax { get; set; }
    public float? TempAvg { get; set; }
    public float? TempRef { get; set; }        // задание температуры (среднее/максимальное)
    public float? TargetTemp { get; set; }     // целевая температура (point_ref_1)
    public float? TargetTime { get; set; }     // целевое время цикла (time_proc_set)

    // Параметры программы нагрева
    public float? PointRef1 { get; set; }
    public float? PointTime1 { get; set; }
    public float? PointDtime2 { get; set; }

    // Кассета для печей 1-2
    public int? CassetteNo { get; set; }
    public int? CassDay { get; set; }
    public int? CassMonth { get; set; }
    public int? CassYear { get; set; }
    public int? CassHour { get; set; }

    // Кассета 1 для печей 3-4
    public int? Cass1No { get; set; }
    public int? Cass1Day { get; set; }
    public int? Cass1Month { get; set; }
    public int? Cass1Year { get; set; }
    public int? Cass1Hour { get; set; }

    // Кассета 2 для печей 3-4
    public int? Cass2No { get; set; }
    public int? Cass2Day { get; set; }
    public int? Cass2Month { get; set; }
    public int? Cass2Year { get; set; }
    public int? Cass2Hour { get; set; }

    // Флаги
    public bool HadFault { get; set; }
}

        public class TemperingDetailDto
        {
            public DateTime Time { get; set; }
            public float? TempAct { get; set; }
            public float? TempRef { get; set; }
            public float? T1 { get; set; }
            public float? T2 { get; set; }
            public float? TAverageFurn { get; set; }
            public float? ActTimeTotal { get; set; }
            public float? TimeToProcEnd { get; set; }
        }

}
