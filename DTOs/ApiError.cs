using System;

namespace MES_ME.Server.DTOs;

public sealed record ApiError
{
    public string  Code    { get; init; } = "";
    public string  Message { get; init; } = "";
    public string? Detail  { get; init; }
}
