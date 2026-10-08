using FinAI.BuildingBlocks.Events;
using FinAI.Core.API.Data;
using FinAI.Core.API.Entities;
using FinAI.Core.API.Hubs;
using FinAI.Core.API.Services;
using MassTransit;
using Microsoft.AspNetCore.SignalR;

namespace FinAI.Core.API.Consumers;

public class InvoiceProcessedConsumer : IConsumer<InvoiceProcessedEvent>
{
    private readonly AppDbContext _context;
    private readonly IHubContext<InvoiceHub> _hubContext;
    private readonly ICacheService _cacheService;
    private readonly ILogger<InvoiceProcessedConsumer> _logger;

    public InvoiceProcessedConsumer(
        AppDbContext context,
        IHubContext<InvoiceHub> hubContext,
        ICacheService cacheService,
        ILogger<InvoiceProcessedConsumer> logger)
    {
        _context = context;
        _hubContext = hubContext;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<InvoiceProcessedEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("--> Core API: InvoiceProcessedEvent alındı. UserId: {UserId}", msg.UserId);

        // 1. PostgreSQL Veritabanını Güncelleme
        var user = await _context.Users.FindAsync(msg.UserId);
        if (user != null && msg.IsSuccess)
        {
            user.Balance -= msg.Amount; // Bakiyeden düş

            var transaction = new Transaction
            {
                UserId = msg.UserId,
                Title = msg.MerchantName,
                Amount = msg.Amount,
                Category = msg.Category,
                InvoiceId = msg.InvoiceId,
                AiAdvice = msg.AiAdvice,
                Date = DateTime.UtcNow
            };

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            // 2. Redis Cache Invalidation (İlgili kullanıcının aylık özet/dashboard önbelleğini temizle)
            string cacheKey = $"user:{msg.UserId}:monthly_summary";
            await _cacheService.RemoveAsync(cacheKey);
            _logger.LogInformation("--> Redis Cache temizlendi: {CacheKey}", cacheKey);

            // 3. SignalR Canlı Bildirim (Frontend WebSocket push)
            await _hubContext.Clients.Group(msg.UserId.ToString())
                .SendAsync("InvoiceNotification", new
                {
                    Status = "Success",
                    Title = msg.MerchantName,
                    Amount = msg.Amount,
                    Category = msg.Category,
                    Advice = msg.AiAdvice
                });

            _logger.LogInformation("--> SignalR bildirimi kullanıcıya gönderildi!");
        }
    }
}