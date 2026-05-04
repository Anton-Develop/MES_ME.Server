using System;

namespace MES_ME.Server.DTOs;

public sealed record HeatingReportDto
{
    // Идентификация листа
    public int      Sheet          { get; init; }
    public int?     Slab           { get; init; }
    public int?     Melt           { get; init; }
    public int?     PartNo         { get; init; }
    public int?     AlloyCode      { get; init; }
    public string?  AlloyCodeText  { get; init; }
    public float?   Thickness      { get; init; }
    // Маршрут и времена
    public string?  ZonesPath      { get; init; }
    public DateTime? EnteredAt     { get; init; }
    public DateTime? ExitedAt      { get; init; }
    public float?   TotalMin       { get; init; }
    // Время в каждой зоне
    public float?   F1Min          { get; init; }
    public float?   F2Min          { get; init; }
    public float?   F3Min          { get; init; }
    public float?   F4Min          { get; init; }
    // Средние температуры за нагрев
    public float?   AvgZ1_1        { get; init; }

    public float?   AvgZ1_2        { get; init; }
    public float?   AvgZ1_3        { get; init; }

    public float?   AvgZ1_4        { get; init; }

    public float?   AvgZ2_1        { get; init; }

    public float?   AvgZ2_2        { get; init; }
    public float?   AvgZ2_3        { get; init; }

    public float?   AvgZ2_4        { get; init; }

    public float?   AvgZ3_1        { get; init; }
    public float?   AvgZ3_2        { get; init; }
    public float?   AvgZ3_3        { get; init; }
    public float?   AvgZ3_4        { get; init; }
    public float?   AvgZ4_1        { get; init; }
    public float?   AvgZ4_2        { get; init; }
    public float?   AvgZ4_3        { get; init; }
    public float?   AvgZ4_4        { get; init; }
    public bool     HadAlarm       { get; init; }
    // Детальный трек зон и температуры — заполняются отдельными запросами
    public List<ZoneHistoryDto>      ZoneTrack    { get; init; } = new();
    public List<TemperatureBucketDto> Temperatures { get; init; } = new();
}
