using Microsoft.AspNetCore.SignalR;

namespace MES_ME.Server.Hubs;

public sealed class MeasurementHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "queue");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "queue");
        await base.OnDisconnectedAsync(exception);
    }
}