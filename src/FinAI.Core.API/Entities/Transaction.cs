namespace FinAI.Core.API.Entities;

public class Transaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    
    public string Title { get; set; } = string.Empty; // Örn: Migros, Netflix, Elektrik Faturası
    
    // Finansal hesaplama hassasiyeti için decimal
    public decimal Amount { get; set; }
    public string Category { get; set; } = string.Empty; // Örn: Market, Eğlence, Fatura, Kahve
    public DateTime Date { get; set; } = DateTime.UtcNow;
    
    public string? InvoiceId { get; set; } // Faturadan geldiyse faturanın benzersiz ID'si
    public string? AiAdvice { get; set; }  // AI tarafından faturaya özel verilen finansal tavsiye
}