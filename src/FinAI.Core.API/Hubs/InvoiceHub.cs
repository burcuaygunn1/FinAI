using Microsoft.AspNetCore.SignalR;

namespace FinAI.Core.API.Hubs;

public class InvoiceHub : Hub
{
    // Frontend istemcileri belirli bir kullanıcı grubuna katılır
    public async Task JoinUserGroup(string userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, userId);
    }
}