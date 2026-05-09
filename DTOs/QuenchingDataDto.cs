namespace MES_ME.Server.DTOs;

public class QuenchingDataDto
{
    // Все свойства теперь string? – сырой JSON из БД
    public string? Times { get; set; }

    // Unlock group 1
    public string? V1_U1 { get; set; }
    public string? V1_U2 { get; set; }
    public string? V1_U3 { get; set; }
    public string? V1_U4 { get; set; }
    public string? V1_U5 { get; set; }
    public string? V1_U6 { get; set; }
    public string? V1_U7 { get; set; }
    public string? V1_U8 { get; set; }
    public string? V1_U9 { get; set; }
    public string? V1_U10 { get; set; }

    // Unlock group 2
    public string? V2_U1 { get; set; }
    public string? V2_U2 { get; set; }
    public string? V2_U3 { get; set; }
    public string? V2_U4 { get; set; }
    public string? V2_U5 { get; set; }
    public string? V2_U6 { get; set; }
    public string? V2_U7 { get; set; }
    public string? V2_U8 { get; set; }
    public string? V2_U9 { get; set; }
    public string? V2_U10 { get; set; }

    // Mnat group 1
    public string? V1_M1 { get; set; }
    public string? V1_M2 { get; set; }
    public string? V1_M3 { get; set; }
    public string? V1_M4 { get; set; }
    public string? V1_M5 { get; set; }
    public string? V1_M6 { get; set; }
    public string? V1_M7 { get; set; }
    public string? V1_M8 { get; set; }
    public string? V1_M9 { get; set; }
    public string? V1_M10 { get; set; }

    // Mnat group 2
    public string? V2_M1 { get; set; }
    public string? V2_M2 { get; set; }
    public string? V2_M3 { get; set; }
    public string? V2_M4 { get; set; }
    public string? V2_M5 { get; set; }
    public string? V2_M6 { get; set; }
    public string? V2_M7 { get; set; }
    public string? V2_M8 { get; set; }
    public string? V2_M9 { get; set; }
    public string? V2_M10 { get; set; }

    // Давления
    public string? Press9 { get; set; }
    public string? Press10 { get; set; }
    public string? Press11 { get; set; }
    public string? Press12 { get; set; }
    public string? PressTopLamin1 { get; set; }
    public string? PressBotLamin1 { get; set; }
    public string? PressTopLamin2 { get; set; }
    public string? PressBotLamin2 { get; set; }
    public string? PressTopZak { get; set; }
    public string? PressBotZak { get; set; }

    // Уровни и воздух
    public string? LevelHaccum { get; set; }
    public string? LevelTank { get; set; }
    public string? AirPrs { get; set; }

    // Температуры
    public string? TempGrad { get; set; }
    public string? TempTopLam1 { get; set; }
    public string? TempBotLam1 { get; set; }
    public string? TempTopLam2 { get; set; }
    public string? TempBotLam2 { get; set; }
    public string? TempHaccum { get; set; }

    // Позиции клапанов
    public string? ValveX1UpPosRef { get; set; }
    public string? ValveX1UpPosFbk { get; set; }
    public string? ValveX1DownPosRef { get; set; }
    public string? ValveX1DownPosFbk { get; set; }
    public string? ValveX2_1UpPosRef { get; set; }
    public string? ValveX2_1UpPosFbk { get; set; }
    public string? ValveX2_1DownPosRef { get; set; }
    public string? ValveX2_1DownPosFbk { get; set; }
    public string? ValveX2_2UpPosRef { get; set; }
    public string? ValveX2_2UpPosFbk { get; set; }
    public string? ValveX2_2DownPosRef { get; set; }
    public string? ValveX2_2DownPosFbk { get; set; }
}