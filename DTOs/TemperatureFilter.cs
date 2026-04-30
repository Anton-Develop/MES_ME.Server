using System;

namespace MES_ME.Server.DTOs;

public sealed record TemperatureFilter
{
    public DateTime From            { get; init; }
    public DateTime To              { get; init; }
    public int      IntervalMinutes { get; init; } = 1;  // даунсемплинг
}
