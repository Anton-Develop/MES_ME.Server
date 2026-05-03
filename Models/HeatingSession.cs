using MES_ME.Server.DTOs;
using System;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace MES_ME.Server.Models;

public sealed class HeatingSession
{
    public long        Id             { get; init; }
    public int         Sheet          { get; init; }
    public int?        Slab           { get; init; }
    public string? BusinessKey { get; init; }

    public int?        Melt           { get; init; }
    public int?        PartNo         { get; init; }
    public int? Pack { get; init; }
    public int?        AlloyCode      { get; init; }
    public string?     AlloyCodeText  { get; init; }
    public float?      Thickness      { get; init; }
    public string?     ZonesPath      { get; init; }
    public DateTime?   EnteredAt      { get; init; }
    public DateTime?   ExitedAt       { get; init; }
    public float?      TotalMin       { get; init; }
    public float?      F1Min          { get; init; }
    public float?      F2Min          { get; init; }
    public float?      F3Min          { get; init; }
    public float?      F4Min          { get; init; }
    public float?      AvgZ1_1        { get; init; }
    public float?      AvgZ1_2        { get; init; }
    public float?      AvgZ2_1        { get; init; }
    public float?      AvgZ2_2        { get; init; }
    public float?      AvgZ3_1        { get; init; }
    public float?      AvgZ3_2        { get; init; }
    public float?      AvgZ3_3        { get; init; }
    public float?      AvgZ3_4        { get; init; }
    public float?      AvgZ4_1        { get; init; }
    public float?      AvgZ4_2        { get; init; }
    public float?      AvgZ4_3        { get; init; }
    public float?      AvgZ4_4        { get; init; }
    public bool        HadAlarm       { get; init; }
    public DateTime    CreatedAt      { get; init; }
    public string? TempsZ1 { get; init; }  // JSON строка
    public string? TempsZ2 { get; init; }  // JSON строка
    public string? TempsZ3 { get; init; }  // JSON строка
    public string? TempsZ4 { get; init; }  // JSON строка
    public string? TempsTime { get; init; } // JSON строка временных меток

    // Вычисляемые свойства для удобного доступа
    [NotMapped]
    public List<ZoneTemperatures>? Z1Temperatures =>
        string.IsNullOrEmpty(TempsZ1) ? new List<ZoneTemperatures>() :
        JsonSerializer.Deserialize<List<ZoneTemperatures>>(TempsZ1);

    [NotMapped]
    public List<ZoneTemperatures>? Z2Temperatures =>
        string.IsNullOrEmpty(TempsZ2) ? new List<ZoneTemperatures>() :
        JsonSerializer.Deserialize<List<ZoneTemperatures>>(TempsZ2);

    [NotMapped]
    public List<ZoneTemperatures>? Z3Temperatures =>
        string.IsNullOrEmpty(TempsZ3) ? new List<ZoneTemperatures>() :
        JsonSerializer.Deserialize<List <ZoneTemperatures>>(TempsZ3);

    [NotMapped]
    public List<ZoneTemperatures>? Z4Temperatures =>
        string.IsNullOrEmpty(TempsZ4) ? new List<ZoneTemperatures>() :
        JsonSerializer.Deserialize<List<ZoneTemperatures>>(TempsZ4);

    [NotMapped]
    public List<DateTime>? TimePoints =>
        string.IsNullOrEmpty(TempsTime) ? new List<DateTime>() :
        JsonSerializer.Deserialize<List<DateTime>>(TempsTime);
}
