using System;

namespace MES_ME.Server.DTOs
{
    public class WriteEntryRequest 
    {
        public Int32 EntrPlateData_Melt { get; set; } 
        public Int32 EntrPlateData_PartNo { get; set; } 
        public Int32 EntrPlateData_Pack { get; set; } 
        public Int32 EntrPlateData_Sheet { get; set; } 
        public string EntrPlateData_AlloyCodeText {get;set;} = "";
        public Int16 EntrPlateData_SheetInPack {get;set;} 
        public Int32 EntrPlateData_Slab {get;set;}
        public string EntrPlateData_ThiknessText{get;set;} ="";
        public string EntrPlateData_SubSheet{get;set;}="";
        public bool? EntrPlateData_InsertToE1{get;set;}=false;
        public Int16 ModeLen{get;set;}=0;


        public string UniqueId { get; set; } = ""; // MatId
    }
}

