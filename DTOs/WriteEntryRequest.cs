using System;

namespace MES_ME.Server.DTOs
{
    public class WriteEntryRequest
    {
        public string? EntrPlateData_Melt { get; set; } = "";
        public string? EntrPlateData_PartNo { get; set; } = "";
        public string? EntrPlateData_Pack { get; set; } = "";
        public string? EntrPlateData_Sheet { get; set; } = "";
        public string? EntrPlateData_AlloyCodeText {get;set;} = "";
         public string? EntrPlateData_SheetInPack {get;set;} = "";
        public string? EntrPlateData_Slab {get;set;} = "";
        public string? EntrPlateData_ThiknessText{get;set;} ="";
        public string? EntrPlateData_SubSheet{get;set;}="";
        public bool? EntrPlateData_InsertToE1{get;set;}=false;
        public int? ModeLen{get;set;}=0;


        public string UniqueId { get; set; } = ""; // MatId
    }
}

