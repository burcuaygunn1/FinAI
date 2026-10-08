using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FinAI.AIWorker.Service.Models;

public class AIBillingAnalysisLog
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string InvoiceId { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.String)]
    public Guid UserId { get; set; }

    public string RawOcrText { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty; // Örn: GPT-4o, Ollama-Vision vb.
    public double ConfidenceScore { get; set; }
    public string ExtractedMerchant { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.Decimal128)]
    public decimal ExtractedAmount { get; set; }

    public string ExtractedCategory { get; set; } = string.Empty;
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}