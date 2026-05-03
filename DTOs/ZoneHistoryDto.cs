using System;

namespace MES_ME.Server.DTOs;
/// <summary>
/// For Response 
/// </summary>
public sealed record ZoneHistoryDto
{
    public DateTime Time          { get; init; }
    public string   Zone          { get; init; } = "";
    public int?     Sheet         { get; init; }
    public int?     Slab          { get; init; }
    public int?     Melt          { get; init; }
    public int?     Pack          { get; init; }
    public int?     PartNo        { get; init; }
    public short?   State         { get; init; }
    public bool?    ZoneOccup     { get; init; }
    public float?   PlatePos      { get; init; }
    public float?   SeqSpeed      { get; init; }
    public float?   ProcTimeMin   { get; init; }
    public float?   Thickness     { get; init; }
    public bool?    AlarmExist    { get; init; }
}
