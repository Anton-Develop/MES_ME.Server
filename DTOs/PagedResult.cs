using System;

namespace MES_ME.Server.DTOs;

public sealed record PagedResult<T>
{
    public IEnumerable<T> Items     { get; init; } = Enumerable.Empty<T>();
    public int            Total     { get; init; }
    public int            Page      { get; init; }
    public int            PageSize  { get; init; }
    public int            TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)Total / PageSize) : 0;
}
