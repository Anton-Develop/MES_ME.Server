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

    // alias → nodeId
    private readonly Dictionary<string, string> _aliasToNodeId = new();

    // ✅ НОВОЕ: alias → controllerName (для корректной маршрутизации записи)
    private readonly Dictionary<string, string> _aliasToController = new();

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

                // ✅ Запоминаем, какому контроллеру принадлежит этот алиас
                _aliasToController[node.Alias] = controller.Name;
            }
        }
    }

    public bool IsControllerConnected(string controllerName) =>
        _sessions.TryGetValue(controllerName, out var s) && s?.Connected == true;

    internal void OnDataChange(string controllerName, string alias, DataValue dv)
    {
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

    internal void SetSession(string controllerName, Session? session) =>
        _sessions[controllerName] = session;

    public OpcUaValue? GetValue(string aliasOrNodeId)
    {
        if (_values.TryGetValue(aliasOrNodeId, out var v)) return v;

        // Если передали NodeId, пробуем найти по нему алиас (только для чтения)
        foreach (var kvp in _aliasToNodeId)
        {
            if (kvp.Value == aliasOrNodeId && _values.TryGetValue(kvp.Key, out var v2))
                return v2;
        }
        return null;
    }

    public IReadOnlyDictionary<string, OpcUaValue> GetAllValues() => _values;

    public IReadOnlyDictionary<string, OpcUaValue> GetControllerValues(string controllerName)
    {
        var prefix = $"{controllerName}.";
        return _values
            .Where(kv => kv.Key.StartsWith(prefix))
            .ToDictionary(kv => kv.Key, kv => kv.Value);
    }

    /// <summary>
    /// Запись по алиасу. Теперь маршрутизирует корректно, даже если NodeId в разных контроллерах совпадают.
    /// </summary>
    public async Task<bool> WriteByAliasAsync(string alias, object value, CancellationToken ct = default)
    {
        // 1. Находим NodeId по алиасу
        if (!_aliasToNodeId.TryGetValue(alias, out var nodeId))
        {
            _log.LogWarning("OPC UA write: alias not found: {Alias}", alias);
            return false;
        }

        // 2. ✅ Находим контроллер НАПРЯМУЮ по алиасу (обход проблемы с одинаковыми NodeId)
        if (!_aliasToController.TryGetValue(alias, out var controllerName))
        {
            _log.LogWarning("OPC UA write: controller not found for alias: {Alias}", alias);
            return false;
        }

        // 3. Получаем сессию нужного контроллера
        if (!_sessions.TryGetValue(controllerName, out var session) || session == null || !session.Connected)
        {
            _log.LogWarning("OPC UA write failed: controller '{Controller}' not connected. Alias={Alias}", controllerName, alias);
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
                _log.LogWarning("OPC UA write bad status: {Status} Alias={Alias}", response.Results[0], alias);

            return ok;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "OPC UA write error: Alias={Alias}, Controller={Controller}", alias, controllerName);
            return false;
        }
    }

    /// <summary>
    /// Прямая запись по NodeId (оставлена для совместимости, но используйте WriteByAliasAsync)
    /// </summary>
    public async Task<bool> WriteAsync(string nodeId, object value, CancellationToken ct = default)
    {
        // Пытаемся найти алиас, чтобы определить контроллер
        string? alias = null;
        foreach (var kvp in _aliasToNodeId)
        {
            if (kvp.Value == nodeId)
            {
                alias = kvp.Key;
                break;
            }
        }

        if (alias == null || !_aliasToController.TryGetValue(alias, out var controllerName))
        {
            _log.LogWarning("OPC UA write failed: cannot resolve controller for NodeId={NodeId}", nodeId);
            return false;
        }

        if (!_sessions.TryGetValue(controllerName, out var session) || session == null || !session.Connected)
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
            return StatusCode.IsGood(response.Results[0]);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "OPC UA write error: NodeId={NodeId}", nodeId);
            return false;
        }
    }
}