using System;

namespace MES_ME.Server.Models;

public sealed class FurnaceZoneData
{
    public long        Id             { get; init; }
    public DateTime    Time           { get; init; }
    public string      Zone           { get; init; } = "";   // E1/F1-F4/X1/X2
    public int?        Sheet          { get; init; }
    public int?        Slab           { get; init; }
    public int?        Melt           { get; init; }
    public int?        PartNo         { get; init; }
    public short?      State          { get; init; }
    public bool?       ZoneOccup      { get; init; }
    public float?      PlatePos       { get; init; }
    public float?      SeqSpeed       { get; init; }
    public int?        SeqNo          { get; init; }
    public short?      SeqState       { get; init; }
    public float?      SeqPosition    { get; init; }
    public float?      ProcTime       { get; init; }
    public float?      ProcTimeMin    { get; init; }
    public float?      Thickness      { get; init; }
    public int?        SubSheet       { get; init; }
    public int?        SheetInPack    { get; init; }
    public int?        Pack           { get; init; }
    public int?        AlloyCode      { get; init; }
    public string?     AlloyCodeText  { get; init; }
    public bool?       AlarmExist     { get; init; }
    public bool?       OutArrow       { get; init; }
    public bool?       InArrow        { get; init; }
}
