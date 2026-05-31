using System.Collections.Concurrent;
using MES_ME.Server.Hubs;
using Microsoft.AspNetCore.SignalR;
using Opc.Ua;
using Opc.Ua.Client;

namespace MES_ME.Server.OpcUa;

/// <summary>
/// Хранит последние значения тегов и умеет в них писать.
/// Сессии держит OpcUaBackgroundService.
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

    // controllerName → session
    private readonly ConcurrentDictionary<string, Session?> _sessions = new();

    public bool IsConnected => _sessions.Values.All(s => s?.Connected == true);

    public event Action<string, OpcUaValue>? ValueChanged;

    public OpcUaService(OpcUaOptions opts, IHubContext<OpcUaHub> hub, ILogger<OpcUaService> log)
    {
        _opts = opts;
        _hub = hub;
        _log = log;

        foreach (var controller in opts.Controllers)
        {
            _sessions[controller.Name] = null;

            foreach (var node in controller.Nodes)
            {
                _aliasToNodeId[node.Alias] = node.NodeId;
                _nodeIdToAlias[node.NodeId] = node.Alias;
            }
        }
    }

    public bool IsControllerConnected(string controllerName) =>
        _sessions.TryGetValue(controllerName, out var s) && s?.Connected == true;

    // Вызывается из BackgroundService когда приходят новые данные
   /* internal void OnDataChange(string controllerName, string nodeId, DataValue dv)
    {
        var alias = _nodeIdToAlias.GetValueOrDefault(nodeId, nodeId);

        var val = new OpcUaValue
        {
            Value = dv.Value,
            Timestamp = dv.SourceTimestamp == DateTime.MinValue
                ? DateTime.UtcNow
                : DateTime.SpecifyKind(dv.SourceTimestamp, DateTimeKind.Utc),
            IsGood = StatusCode.IsGood(dv.StatusCode),
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
                var payload = new { controller = controllerName, alias, value = val };
                await Task.WhenAll(
                    _hub.Clients.Group($"tag:{alias}").SendAsync("TagUpdate", payload),
                    _hub.Clients.Group($"controller:{controllerName}").SendAsync("TagUpdate", payload),
                    _hub.Clients.Group("all").SendAsync("TagUpdate", payload)
                );
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "SignalR send failed for alias={Alias}", alias);
            }
        });
    }*/
    internal void OnDataChange(string controllerName, string alias, DataValue dv)
{
    // Больше не нужно искать alias через _nodeIdToAlias!
    var val = new OpcUaValue
    {
        Value = dv.Value,
        Timestamp = dv.SourceTimestamp == DateTime.MinValue
             ? DateTime.UtcNow
            : DateTime.SpecifyKind(dv.SourceTimestamp, DateTimeKind.Utc),
        IsGood = StatusCode.IsGood(dv.StatusCode),
        StatusCode = dv.StatusCode.Code,
    };

    _values[alias] = val;
    ValueChanged?.Invoke(alias, val);

    _ = Task.Run(async () =>
    {
        try
        {
            var payload = new { controller = controllerName, alias, value = val };
            await Task.WhenAll(
                _hub.Clients.Group($"tag:{alias}").SendAsync("TagUpdate", payload),
                _hub.Clients.Group($"controller:{controllerName}").SendAsync("TagUpdate", payload),
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
    internal void SetSession(string controllerName, Session? session) =>
        _sessions[controllerName] = session;

    public OpcUaValue? GetValue(string aliasOrNodeId)
    {
        if (_values.TryGetValue(aliasOrNodeId, out var v)) return v;
        // Пробуем как NodeId → alias
        var alias = _nodeIdToAlias.GetValueOrDefault(aliasOrNodeId);
        return alias != null && _values.TryGetValue(alias, out var v2) ? v2 : null;
    }

    public IReadOnlyDictionary<string, OpcUaValue> GetAllValues() => _values;

    public IReadOnlyDictionary<string, OpcUaValue> GetControllerValues(string controllerName)
    {
        var prefix = $"{controllerName}.";
        return _values
            .Where(kv => kv.Key.StartsWith(prefix))
            .ToDictionary(kv => kv.Key, kv => kv.Value);
    }

    public async Task<bool> WriteAsync(string nodeId, object value, CancellationToken ct = default)
    {
        // Ищем контроллер по NodeId
        var alias = _nodeIdToAlias.GetValueOrDefault(nodeId);
        var controllerName = alias?.Split('.').FirstOrDefault();

        if (controllerName == null || !_sessions.TryGetValue(controllerName, out var session)
            || session == null || !session.Connected)
        {
            _log.LogWarning("OPC UA write failed: controller not connected. NodeId={NodeId}", nodeId);
            return false;
        }

        try
        {
            var nodesToWrite = new WriteValueCollection
            {
                new WriteValue
                {
                    NodeId = NodeId.Parse(nodeId),
                    AttributeId = Attributes.Value,
                    Value = new DataValue(new Variant(value)),
                }
            };

            var response = await session.WriteAsync(null, nodesToWrite, ct);

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