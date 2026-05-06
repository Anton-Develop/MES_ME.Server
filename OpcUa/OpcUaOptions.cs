namespace MES_ME.Server.OpcUa;

public sealed class OpcUaOptions
{
    public string  EndpointUrl    { get; set; } = "opc.tcp://localhost:4840";
    public string? Username       { get; set; }
    public string? Password       { get; set; }
    public bool    AnonymousAuth  { get; set; } = true;
    public int     PublishInterval    { get; set; } = 1000;  // мс — как часто сервер присылает пакет
    public int     SamplingInterval   { get; set; } = 2000;  // мс — с какой частотой сервер опрашивает тег
    public List<OpcUaNodeConfig> Nodes { get; set; } = new();
}

public sealed class OpcUaNodeConfig
{
    public string NodeId     { get; set; } = "";  // ns=2;s=Furnace.Zone.F1.ZoneOccup
    public string Alias      { get; set; } = "";  // удобное имя: f1_zone_occup
}