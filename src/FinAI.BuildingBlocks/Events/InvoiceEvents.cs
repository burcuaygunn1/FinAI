namespace FinAI.BuildingBlocks.Events;

// Fatura yüklendiğinde Core.API tarafından RabbitMQ'ya fırlatılacak event
public record InvoiceUploadedEvent
{
    public string InvoiceId { get; init; } = string.Empty;
    public Guid UserId { get; init; }
    public string FilePath { get; init; } = string.Empty;
    public DateTime UploadedAt { get; init; }
}

// AI faturayı işleyip analiz ettikten sonra fırlatılacak event
public record InvoiceProcessedEvent
{
    public string InvoiceId { get; init; } = string.Empty;
    public Guid UserId { get; init; }
    public string MerchantName { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string Category { get; init; } = string.Empty; // Örn: Market, Eğlence, Fatura
    public string AiAdvice { get; init; } = string.Empty; // Örn: "Bu ay kahve harcaman yüksek!"
    public bool IsSuccess { get; init; }
    public string? ErrorMessage { get; init; }
}