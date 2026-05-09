namespace MES_ME.Server.Models;

public sealed class QuenchingSession
{
    public long Id { get; init; }
    public string? BusinessKey { get; init; }
    public int Sheet { get; init; }
    public int? Slab { get; init; }
    public int? Melt { get; init; }
    public int? PartNo { get; init; }
    public int? Pack { get; init; }
    public int? ReheatNum { get; init; }
    public int? AlloyCode { get; init; }
    public string? AlloyCodeText { get; init; }
    public float? Thickness { get; init; }
    public DateTime EnteredAt { get; init; }
    public DateTime ExitedAt { get; init; }
    public float? TotalSec { get; init; }
    public string? Valves1Unlock { get; init; }
    public string? Valves2Unlock { get; init; }
    public string? Valves1Mnat { get; init; }
    public string? Valves2Mnat { get; init; }

    public float? Press9 { get; init; }
    public float? Press10 { get; init; }
    public float? Press11 { get; init; }
    public float? Press12 { get; init; }
    public float? PressTopLamin1 { get; init; }
    public float? PressBotLamin1 { get; init; }
    public float? PressTopLamin2 { get; init; }
    public float? PressBotLamin2 { get; init; }
    public float? PressTopZak { get; init; }
    public float? PressBotZak { get; init; }
    public float? LevelHaccum { get; init; }
    public float? LevelTank { get; init; }
    public float? AirPrs { get; init; }
    public float? TempGrad { get; init; }
    public float? TempTopLam1 { get; init; }
    public float? TempBotLam1 { get; init; }
    public float? TempTopLam2 { get; init; }
    public float? TempBotLam2 { get; init; }
    public float? TempHaccum { get; init; }
    public float? ValveX1UpPosRef { get; init; }
    public float? ValveX1UpPosFbk { get; init; }
    public float? ValveX1DownPosRef { get; init; }
    public float? ValveX1DownPosFbk { get; init; }
    public float? ValveX2_1UpPosRef { get; init; }
    public float? ValveX2_1UpPosFbk { get; init; }
    public float? ValveX2_1DownPosRef { get; init; }
    public float? ValveX2_1DownPosFbk { get; init; }
    public float? ValveX2_2UpPosRef { get; init; }
    public float? ValveX2_2UpPosFbk { get; init; }
    public float? ValveX2_2DownPosRef { get; init; }
    public float? ValveX2_2DownPosFbk { get; init; }

    public bool HadAlarm { get; init; }
    public DateTime CreatedAt { get; init; }
}