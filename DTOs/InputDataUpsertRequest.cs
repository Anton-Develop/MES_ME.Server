using System.ComponentModel.DataAnnotations;

namespace MES_ME.Server.DTOs
{
    public class InputDataUpsertRequest
    {
        // Обязательные поля по вашему INSERT-примеру

        [Required(ErrorMessage = "Статус обязателен.")]
        public string? Status { get; set; }

        [Required(ErrorMessage = "Дата поступления проката обязательна.")]
        public DateTime? RollDate { get; set; }

        [Required(ErrorMessage = "Номер плавки обязателен.")]
        public string? MeltNumber { get; set; }

        [Required(ErrorMessage = "Номер партии обязателен.")]
        public string? BatchNumber { get; set; }

        [Required(ErrorMessage = "Номер пачки обязателен.")]
        public string? PackNumber { get; set; }

        [Required(ErrorMessage = "Номер пачки в системе обязателен.")]
        public string? PackSystemNumber { get; set; }

        [Required(ErrorMessage = "Марка стали обязательна.")]
        public string? SteelGrade { get; set; }

        // В текущей версии используем sheet_dimensions как "Толщина".
        // Если добавите отдельное поле thickness_mm, добавьте:
        // public decimal? ThicknessMm { get; set; }
        public string? SheetDimensions { get; set; }

        [Required(ErrorMessage = "Номер сляба обязателен.")]
        public string? SlabNumber { get; set; }

        public decimal? ActualNetWeightKg { get; set; }

        public decimal? CertificateNetWeightKg { get; set; }

        [Required(ErrorMessage = "Количество листов обязательно.")]
        public int? SheetsCount { get; set; }

        public decimal? SheetWeightKg { get; set; }

        public decimal? RawMaterialKg { get; set; }

        [Required(ErrorMessage = "Номер листа обязателен.")]
        public string? SheetNumber { get; set; }

        [Required(ErrorMessage = "Дата закалки обязательна.")]
        public DateTime? QuenchingDate { get; set; }

        [Required(ErrorMessage = "Статус закалки обязателен.")]
        public string? QuenchingStatus { get; set; }

        // Необязательные поля

        public string? CertificateNumber { get; set; }
        public string? ShortOrderNumber { get; set; }
        public string? CommercialOrderNumber { get; set; }
        public string? Marking { get; set; }
        public DateTime? RepeatedToDate { get; set; }

        public string? GpAcceptanceStatusWeight { get; set; }
        public string? NpAcceptanceStatusWeight { get; set; }
        public string? ScrapAcceptanceStatusWeight { get; set; }

        public decimal? ActualWeight { get; set; }
        public decimal? NonReturnScrap { get; set; }
        public decimal? Trimming { get; set; }
        public decimal? FlatnessMm { get; set; }

        public string? Defect { get; set; }
        public string? Note { get; set; }
        public string? NpAct { get; set; }
        public string? MmkClaimReason { get; set; }
        public string? NpDecision { get; set; }

        public string? SampleCardsSelection { get; set; }
        public string? SampleNumberVk { get; set; }

        public DateTime? BallisticsSampleSendDate1 { get; set; }
        public DateTime? BallisticsSampleSendDate2 { get; set; }
        public DateTime? BallisticsSampleSendDate3 { get; set; }

        public DateTime? MetallographySampleSendDate1 { get; set; }
        public DateTime? MetallographySampleSendDate2 { get; set; }

        public DateTime? HardnessSampleSendDate1 { get; set; }
        public DateTime? HardnessSampleSendDate2 { get; set; }
        public DateTime? HardnessSampleSendDate3 { get; set; }

        public string? OrderLink { get; set; }
        public string? IgkLink { get; set; }
        public string? TestingStatus { get; set; }

        public DateTime? GpVpPresentationDate { get; set; }
        public DateTime? ShipmentDate { get; set; }

        public string? OrderNumber { get; set; }
        public string? CertificateNumber2 { get; set; }

        public decimal? ShippedSheetsWeightKg { get; set; }
        public decimal? SheetWeightAfterToStorageKg { get; set; }
        public decimal? PostShipDiff { get; set; }
    }
}