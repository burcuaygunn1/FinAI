namespace FinAI.Core.API.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    
    // Kullanıcının mevcut bakiye bilgisi (Decimal hassasiyeti)
    public decimal Balance { get; set; }
    public decimal MonthlyBudgetLimit { get; set; }
    
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}