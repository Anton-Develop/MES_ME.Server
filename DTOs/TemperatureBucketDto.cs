using System;

namespace MES_ME.Server.DTOs;

public sealed record TemperatureBucketDto
{
    public DateTime Time          { get; init; }
    // Zone 1
    public float?   Z1_1_Te       { get; init; }
    public float?   Z1_1_Ref      { get; init; }
    public float?   Z1_2_Te       { get; init; }
    public float?   Z1_3_Te       { get; init; }
    public float?   Z1_4_Te       { get; init; }
    // Zone 2
    public float?   Z2_1_Te       { get; init; }
    public float?   Z2_1_Ref      { get; init; }
    public float?   Z2_2_Te       { get; init; }
    public float?   Z2_3_Te       { get; init; }
    public float?   Z2_4_Te       { get; init; }
    // Zone 3
    public float?   Z3_1_Te       { get; init; }
    public float?   Z3_1_Ref      { get; init; }
    public float?   Z3_2_Te       { get; init; }
    public float?   Z3_3_Te       { get; init; }
    public float?   Z3_4_Te       { get; init; }
    // Zone 4
    public float?   Z4_1_Te       { get; init; }
    public float?   Z4_1_Ref      { get; init; }
    public float?   Z4_2_Te       { get; init; }
    public float?   Z4_3_Te       { get; init; }
    public float?   Z4_4_Te       { get; init; }
}

