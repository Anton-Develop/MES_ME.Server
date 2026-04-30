using System;

namespace MES_ME.Server.DTOs;

public sealed record ZoneHistoryFilter
{
    public DateTime From     { get; init; }
    public DateTime To       { get; init; }
    public string?  Zone     { get; init; }   // null = все зоны
    public int?     Sheet    { get; init; }
    public int      Limit    { get; init; } = 500;
}
