using System;

namespace MES_ME.Server.DTOs;

public class PlanSheetDetailDto
{

    public string? MatId { get; set; }
    public string? MeltNumber { get; set; }      // Номер плавки
    public string? BatchNumber { get; set; }     // Номер партии
    public string? PackNumber { get; set; }      // Номер пачки
    public string? SteelGrade { get; set; }      // Марка стали
    public string? Dimensions { get; set; }      // Размеры (Толщина х Ширина х Длина)
    public string? SlabNumber { get; set; }      // Номер сляба
    public string? SheetNumber { get; set; }        // Номер листа в пачке/плане
    public decimal NetWeight { get; set; }      // Масса нетто
    public DateTimeOffset? QuenchingDate { get; set; } // Дата закалки
    public string? Status { get; set; }          // Статус
}
