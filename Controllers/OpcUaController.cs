using MES_ME.Server.OpcUa;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MES_ME.Server.Controllers
{
    [ApiController]
    [Route("api/opc")]
public class OpcUaController : ControllerBase
{
    private readonly IOpcUaService _opc;
    public OpcUaController(IOpcUaService opc) => _opc = opc;

    // GET /api/opc/values — все теги
    [HttpGet("values")]
    public IActionResult GetAll() => Ok(new
    {
        connected = _opc.IsConnected,
        values    = _opc.GetAllValues()
    });

    // GET /api/opc/values/f1_occup
    [HttpGet("values/{alias}")]
    public IActionResult Get(string alias)
    {
        var val = _opc.GetValue(alias);
        return val == null ? NotFound() : Ok(val);
    }

    // POST /api/opc/write
    // Body: { "nodeId": "ns=2;s=...", "value": 925 }
    [HttpPost("write")]
    public async Task<IActionResult> Write(
        [FromBody] OpcWriteRequest req, CancellationToken ct)
    {
        var ok = await _opc.WriteAsync(req.NodeId, req.Value, ct);
        return ok ? Ok() : StatusCode(503, "Write failed");
    }
}

public record OpcWriteRequest(string NodeId, object Value);
}
