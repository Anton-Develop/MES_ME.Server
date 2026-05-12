using System;

namespace MES_ME.Server.DTOs
{
    public class WriteEntryRequest
    {
        public string Melt { get; set; } = "";
        public string PartNo { get; set; } = "";
        public string Pack { get; set; } = "";
        public string Sheet { get; set; } = "";
        public string UniqueId { get; set; } = ""; // MatId
    }
}

