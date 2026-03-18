using System;

namespace MES_ME.Server.DTOs;

public class BulkStatusUpdateRequest
{

    public List<string>? MatIds { get; set; } // Используйте тип, соответствующий MatId в вашей модели
    public string? NewStatus { get; set; }
}
