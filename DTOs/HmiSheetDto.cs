using System;

namespace MES_ME.Server.DTOs;

public class HmiSheetDto
{
    public int Id { get; set; } // Это будет ID из InputDatum (matid -> int преобразовать или использовать строку)
    public string UniqueId { get; set; } = string.Empty; // matid из InputDatum
    public string Melt { get; set; } = string.Empty; // melt_number из InputDatum
    public string Batch { get; set; } = string.Empty; // batch_number из InputDatum
    public string Pack { get; set; } = string.Empty;  // pack_number из InputDatum
    public string Sheet { get; set; } = string.Empty; // sheet_number из InputDatum
    public string Grade { get; set; } = string.Empty; // steel_grade из InputDatum
    public double Thick { get; set; } // нужно будет вычислить или получить из sheet_dimensions
    public int Width { get; set; }    // нужно будет вычислить или получить из sheet_dimensions
    public int Len { get; set; }      // нужно будет вычислить или получить из sheet_dimensions
    public double Wt { get; set; }    // actual_net_weight_kg из InputDatum
    public string Status { get; set; } = string.Empty; // quenching_status или status из InputDatum
    public string Loc { get; set; } = string.Empty;    // Текущее положение, которое пока может быть пустым или установленным в "В плане"
}
