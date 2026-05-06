using System.Collections.Concurrent;
using MES_ME.Server.Hubs;
using Microsoft.AspNetCore.SignalR;
using Opc.Ua;
using Opc.Ua.Client;

namespace MES_ME.Server.OpcUa;

/// <summary>
/// Хранит последние значения тегов и умеет в них писать.
/// Сессию держит OpcUaBackgroundService.
/// </summary>
public sealed class OpcUaService : IOpcUaService
{
    private readonly OpcUaOptions _opts;
    private readonly ILogger<OpcUaService> _log;

    private readonly IHubContext<OpcUaHub> _hub;
    
    // alias → value
    private readonly ConcurrentDictionary<string, OpcUaValue> _values = new();
    // alias → nodeId и обратно
    private readonly Dictionary<string, string> _aliasToNodeId = new();
    private readonly Dictionary<string, string> _nodeIdToAlias = new();

    private Session? _session;

    public bool IsConnected => _session?.Connected == true;

    public event Action<string, OpcUaValue>? ValueChanged;

    public OpcUaService(OpcUaOptions opts, IHubContext<OpcUaHub> hub, ILogger<OpcUaService> log)
    {
        _opts = opts;
        _hub  = hub;
        _log  = log;

        foreach (var node in opts.Nodes)
        {
            _aliasToNodeId[node.Alias]  = node.NodeId;
            _nodeIdToAlias[node.NodeId] = node.Alias;
        }
    }

    // Вызывается из BackgroundService когда приходят новые данные
    internal void OnDataChange(string nodeId, DataValue dv)
    {
        var alias = _nodeIdToAlias.GetValueOrDefault(nodeId, nodeId);

        var val = new OpcUaValue
        {
            Value      = dv.Value,
            Timestamp  = dv.SourceTimestamp == DateTime.MinValue
                            ? DateTime.UtcNow
                            : DateTime.SpecifyKind(dv.SourceTimestamp, DateTimeKind.Utc),
            IsGood     = StatusCode.IsGood(dv.StatusCode),
            StatusCode = dv.StatusCode.Code,
        };

        _values[alias] = val;
        ValueChanged?.Invoke(alias, val);

         // Отправляем в SignalR — всем в группе этого тега + всем в "all"
        // Fire-and-forget: не блокируем OPC UA поток
        _ = Task.Run(async () =>
        {
            try
            {
                var payload = new { alias, value = val };
                await Task.WhenAll(
                    _hub.Clients.Group($"tag:{alias}").SendAsync("TagUpdate", payload),
                    _hub.Clients.Group("all").SendAsync("TagUpdate", payload)
                );
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "SignalR send failed for alias={Alias}", alias);
            }
        });
    }

    // BackgroundService регистрирует сессию чтобы мы могли писать
    internal void SetSession(Session? session) => _session = session;

    public OpcUaValue? GetValue(string aliasOrNodeId)
    {
        if (_values.TryGetValue(aliasOrNodeId, out var v)) return v;
        // Пробуем как NodeId → alias
        var alias = _nodeIdToAlias.GetValueOrDefault(aliasOrNodeId);
        return alias != null && _values.TryGetValue(alias, out var v2) ? v2 : null;
    }

    public IReadOnlyDictionary<string, OpcUaValue> GetAllValues() => _values;

    public async Task<bool> WriteAsync(string nodeId, object value, CancellationToken ct = default)
    {
        if (_session == null || !_session.Connected)
        {
            _log.LogWarning("OPC UA write failed: not connected. NodeId={NodeId}", nodeId);
            return false;
        }

        try
        {
            var nodesToWrite = new WriteValueCollection
            {
                new WriteValue
                {
                    NodeId      = NodeId.Parse(nodeId),
                    AttributeId = Attributes.Value,
                    Value       = new DataValue(new Variant(value)),
                }
            };

            var response = await _session.WriteAsync(
                null, nodesToWrite, ct);

            var ok = StatusCode.IsGood(response.Results[0]);
            if (!ok)
                _log.LogWarning("OPC UA write bad status: {Status} NodeId={NodeId}",
                    response.Results[0], nodeId);

            return ok;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "OPC UA write error: NodeId={NodeId}", nodeId);
            return false;
        }
    }

    public Task<bool> WriteByAliasAsync(string alias, object value, CancellationToken ct = default)
    {
        if (!_aliasToNodeId.TryGetValue(alias, out var nodeId))
        {
            _log.LogWarning("OPC UA write: alias not found: {Alias}", alias);
            return Task.FromResult(false);
        }
        return WriteAsync(nodeId, value, ct);
    }
}