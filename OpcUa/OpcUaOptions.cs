namespace MES_ME.Server.OpcUa;

public sealed class OpcUaOptions
{
    // Общие настройки
    public int PublishInterval { get; set; } = 1000;  // мс — как часто сервер присылает пакет
    public int SamplingInterval { get; set; } = 2000; // мс — с какой частотой сервер опрашивает тег

    // Список контроллеров (PLC)
    public List<OpcUaControllerConfig> Controllers { get; set; } = new();
}

public sealed class OpcUaControllerConfig
{
    public string Name { get; set; } = "";           // "PLC210", "PLC211" и т.д.
    public string EndpointUrl { get; set; } = "";    // opc.tcp://192.168.9.1:4840
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool AnonymousAuth { get; set; } = true;
    public List<OpcUaNodeConfig> Nodes { get; set; } = new();
}

public sealed class OpcUaNodeConfig
{
    public string NodeId { get; set; } = "";  // ns=4;s=|var|PLC210 OPC-UA...
    public string Alias { get; set; } = "";   // "T_F1_MedAct" или "PLC210.T_F1_MedAct"
}