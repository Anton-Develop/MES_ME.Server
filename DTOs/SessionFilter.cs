using System;

namespace MES_ME.Server.DTOs;

public sealed record SessionFilter
{
    public DateTime? From      { get; init; }
    public DateTime? To        { get; init; }
    public int?      Slab      { get; init; }
    public int?      Melt      { get; init; }
    public int?      AlloyCode { get; init; }
    public int       Page      { get; init; } = 1;
    public int       PageSize  { get; init; } = 50;
}