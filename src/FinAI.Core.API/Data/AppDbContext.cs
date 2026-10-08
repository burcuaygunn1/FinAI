using FinAI.Core.API.Entities;
using Microsoft.EntityFrameworkCore;

namespace FinAI.Core.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Transaction> Transactions => Set<Transaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Precision Konfigürasyonu: Finansal hesaplamalarda küsurat hatalarını önlemek için (18 basamak, 2 ondalık)
        modelBuilder.Entity<User>()
            .Property(u => u.Balance)
            .HasPrecision(18, 2);

        modelBuilder.Entity<User>()
            .Property(u => u.MonthlyBudgetLimit)
            .HasPrecision(18, 2);

        modelBuilder.Entity<Transaction>()
            .Property(t => t.Amount)
            .HasPrecision(18, 2);

        // Seed Data: Test yapabilmemiz için varsayılan bir kullanıcı ekleyelim
        var defaultUserId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        modelBuilder.Entity<User>().HasData(new User
        {
            Id = defaultUserId,
            FullName = "Burcu Aygün",
            Email = "burcu@finai.com",
            Balance = 50000.00m,
            MonthlyBudgetLimit = 15000.00m
        });
    }
}