namespace MES_ME.Server.OpcUa;

public interface IOpcUaService
{
    // Состояние соединения (все контроллеры подключены)
    bool IsConnected { get; }

    // Проверка конкретного контроллера
    bool IsControllerConnected(string controllerName);

    // Получить последнее значение тега по алиасу или NodeId
    OpcUaValue? GetValue(string aliasOrNodeId);

    // Получить все последние значения
    IReadOnlyDictionary<string, OpcUaValue> GetAllValues();

    // Получить значения только для конкретного контроллера
    IReadOnlyDictionary<string, OpcUaValue> GetControllerValues(string controllerName);

    // Запись значения в тег
    Task<bool> WriteAsync(string nodeId, object value, CancellationToken ct = default);
    Task<bool> WriteByAliasAsync(string alias, object value, CancellationToken ct = default);

    // Событие при получении новых данных
    event Action<string, OpcUaValue>? ValueChanged;
}

public sealed record OpcUaValue
{
    public object? Value { get; init; }
    public DateTime Timestamp { get; init; }
    public bool IsGood { get; init; }
    public uint StatusCode { get; init; }
}