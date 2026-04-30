using System;

namespace MES_ME.Server.Models;

public sealed class HeatingSession
{
    public long        Id             { get; init; }
    public int         Sheet          { get; init; }
    public int?        Slab           { get; init; }
    public int?        Melt           { get; init; }
    public int?        PartNo         { get; init; }
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
}
