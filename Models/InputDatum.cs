
    using System.ComponentModel.DataAnnotations.Schema; // Для атрибутов ORM
    using System.ComponentModel.DataAnnotations;       // Для Data Annotations (например, Key)

    namespace MES_ME.Server.Models // Замените на ваше пространство имён
    {
        [Table("inputdata", Schema = "mes")] // Указывает имя таблицы и схемы
        public class InputDatum // Имя класса может отличаться, если вы используете InputData
        {
            // Уникальный идентификатор листа (MatID) - Primary Key
            [Key]
             [Required]
            [Column("matid")]
            public string MatId { get; set; } = null!; // Используем null-forgiving operator (!), если свойство обязательно для заполнения

            // Статус листа
            [Column("status")]
            public string? Status { get; set; } // ? делает тип nullable, если в БД может быть NULL

            // Остальные поля из Excel, соответствующие столбцам в таблице inputdata
            [Column("certificate_number")]
            public string? CertificateNumber { get; set; }

            [Column("short_order_number")]
            public string? ShortOrderNumber { get; set; }

            [Column("commercial_order_number")]
            public string? CommercialOrderNumber { get; set; }

            [Column("roll_date")]
            public DateTime? RollDate { get; set; }

            [Column("melt_number")]
            public string? MeltNumber { get; set; }

            [Column("batch_number")]
            public string? BatchNumber { get; set; }

            [Column("pack_number")]
            public string? PackNumber { get; set; }

            [Column("pack_system_number")]
            public string? PackSystemNumber { get; set; }

            [Column("steel_grade")]
            public string? SteelGrade { get; set; }

            [Column("sheet_dimensions")]
            public string? SheetDimensions { get; set; }

            [Column("slab_number")]
            public string? SlabNumber { get; set; }

            [Column("actual_net_weight_kg")]
            public decimal? ActualNetWeightKg { get; set; }

            [Column("certificate_net_weight_kg")]
            public decimal? CertificateNetWeightKg { get; set; }

            [Column("sheets_count")]
            public int? SheetsCount { get; set; }

            [Column("sheet_weight_kg")]
            public decimal? SheetWeightKg { get; set; }

            [Column("raw_material_kg")]
            public decimal? RawMaterialKg { get; set; }

            [Column("sheet_number")]
            public string? SheetNumber { get; set; }

            [Column("quenching_date")]
            public DateTime? QuenchingDate { get; set; }

            [Column("quenching_status")]
            public string? QuenchingStatus { get; set; }

            [Column("marking")]
            public string? Marking { get; set; }

            [Column("repeated_to_date")]
            public DateTime? RepeatedToDate { get; set; }

            [Column("gp_acceptance_status_weight")]
            public string? GpAcceptanceStatusWeight { get; set; }

            [Column("np_acceptance_status_weight")]
            public string? NpAcceptanceStatusWeight { get; set; }

            [Column("scrap_acceptance_status_weight")]
            public string? ScrapAcceptanceStatusWeight { get; set; }

            [Column("actual_weight")]
            public decimal? ActualWeight { get; set; }

            [Column("non_return_scrap")]
            public decimal? NonReturnScrap { get; set; }

            [Column("trimming")]
            public decimal? Trimming { get; set; }

            [Column("flatness_mm")]
            public decimal? FlatnessMm { get; set; }

            [Column("defect")]
            public string? Defect { get; set; }

            [Column("note")]
            public string? Note { get; set; }

            [Column("np_act")]
            public string? NpAct { get; set; }

            [Column("mmk_claim_reason")]
            public string? MmkClaimReason { get; set; }

            [Column("np_decision")]
            public string? NpDecision { get; set; }

            [Column("sample_cards_selection")]
            public string? SampleCardsSelection { get; set; }

            [Column("sample_number_vk")]
            public string? SampleNumberVk { get; set; }

            [Column("ballistics_sample_send_date_1")]
            public DateTime? BallisticsSampleSendDate1 { get; set; }

            [Column("ballistics_sample_send_date_2")]
            public DateTime? BallisticsSampleSendDate2 { get; set; }

            [Column("ballistics_sample_send_date_3")]
            public DateTime? BallisticsSampleSendDate3 { get; set; }

            [Column("metallography_sample_send_date_1")]
            public DateTime? MetallographySampleSendDate1 { get; set; }

            [Column("metallography_sample_send_date_2")]
            public DateTime? MetallographySampleSendDate2 { get; set; }

            [Column("hardness_sample_send_date_1")]
            public DateTime? HardnessSampleSendDate1 { get; set; }

            [Column("hardness_sample_send_date_2")]
            public DateTime? HardnessSampleSendDate2 { get; set; }

            [Column("hardness_sample_send_date_3")]
            public DateTime? HardnessSampleSendDate3 { get; set; }

            [Column("order_link")]
            public string? OrderLink { get; set; }

            [Column("igk_link")]
            public string? IgkLink { get; set; }

            [Column("testing_status")]
            public string? TestingStatus { get; set; }

            [Column("gp_vp_presentation_date")]
            public DateTime? GpVpPresentationDate { get; set; }

            [Column("shipment_date")]
            public DateTime? ShipmentDate { get; set; }

            [Column("order_number")]
            public string? OrderNumber { get; set; }

            [Column("certificate_number_2")]
            public string? CertificateNumber2 { get; set; }

            [Column("shipped_sheets_weight_kg")]
            public decimal? ShippedSheetsWeightKg { get; set; }

            [Column("sheet_weight_after_to_storage_kg")]
            public decimal? SheetWeightAfterToStorageKg { get; set; }

            [Column("post_ship_diff")]
            public decimal? PostShipDiff { get; set; }

        // Навигационное свойство для связи с кассетой (опционально)
        public virtual SheetCassetteLink? SheetCassetteLink { get; set; }
    }
    }

