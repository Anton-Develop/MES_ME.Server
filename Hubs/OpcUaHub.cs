using MES_ME.Server.OpcUa;
using Microsoft.AspNetCore.SignalR;

namespace MES_ME.Server.Hubs;

/// <summary>
/// Клиент подписывается на группу тегов (или "all").
/// Сервер присылает обновления при каждом изменении значения.
/// </summary>
public sealed class OpcUaHub : Hub
{
    private readonly IOpcUaService _opc;

    public OpcUaHub(IOpcUaService opc) => _opc = opc;

    // Клиент подключился — сразу отдаём все текущие значения
    public override async Task OnConnectedAsync()
    {
        await Clients.Caller.SendAsync("Snapshot", _opc.GetAllValues());
        await base.OnConnectedAsync();
    }

    // Клиент просит подписаться только на конкретные алиасы
    // Вызов: connection.invoke("Subscribe", ["f1_occup", "f1_sheet", "z1_1_te"])
    public async Task Subscribe(IEnumerable<string> aliases)
    {
        foreach (var alias in aliases)
            await Groups.AddToGroupAsync(Context.ConnectionId, $"tag:{alias}");
    }

    public async Task Unsubscribe(IEnumerable<string> aliases)
    {
        foreach (var alias in aliases)
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"tag:{alias}");
    }

    // Запись значения в тег прямо из браузера
    // Вызов: connection.invoke("Write", "alias", 925)
    public async Task<bool> Write(string alias, object value)
    {
        return await _opc.WriteByAliasAsync(alias, value);
    }
}