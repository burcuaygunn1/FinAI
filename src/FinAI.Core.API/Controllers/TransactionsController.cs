// FinAI.Core.API/Controllers/TransactionsController.cs
using FinAI.Core.API.Data;
using FinAI.Core.API.Entities;
using FinAI.Core.API.Services;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace FinAI.Core.API.Controllers;

public record CreateTransactionDto(Guid UserId, string Title, decimal Amount, string Category);
public record UpdateBudgetDto(Guid UserId, decimal MonthlyBudgetLimit);

[ApiController]
[Route("api/[controller]")]
[EnableCors("AllowReactApp")]
public class TransactionsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ICacheService _cacheService;
    private readonly ILogger<TransactionsController> _logger;

    public TransactionsController(
        AppDbContext context, 
        ICacheService cacheService, 
        ILogger<TransactionsController> logger)
    {
        _context = context;
        _cacheService = cacheService;
        _logger = logger;
    }

    [HttpPost("manual-entry")]
    public async Task<IActionResult> AddManualTransaction([FromBody] CreateTransactionDto dto)
    {
        try
        {
            if (dto.Amount <= 0)
                return BadRequest(new { success = false, message = "Tutar 0'dan büyük olmalıdır." });

            // 1. Kullanıcıyı bul, veritabanında yoksa otomatik oluştur (Foreign Key hatasını önler)
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null)
            {
                user = new User
                {
                    Id = dto.UserId,
                    FullName = "Burcu Aygün",
                    Email = "burcu@finai.com",
                    Balance = 50000,
                    MonthlyBudgetLimit = 40000
                };
                await _context.Users.AddAsync(user);
                await _context.SaveChangesAsync();
                _logger.LogInformation("--> Yeni kullanıcı otomatik olarak oluşturuldu: {UserId}", dto.UserId);
            }

            // 2. Harcamayı ekle ve bakiyeyi güncelle
            var transaction = new Transaction
            {
                Id = Guid.NewGuid(),
                UserId = dto.UserId,
                Title = dto.Title,
                Amount = dto.Amount,
                Category = string.IsNullOrWhiteSpace(dto.Category) ? "Diğer" : dto.Category,
                Date = DateTime.UtcNow,
                AiAdvice = $"{dto.Title} harcamanız kaydedildi. Bütçe limitinizi aşmamaya özen gösterin."
            };

            user.Balance -= dto.Amount;

            await _context.Transactions.AddAsync(transaction);
            await _context.SaveChangesAsync();

            // 3. Redis Cache temizleme (Redis kapalı olsa dahi işlemin aksamaması için try-catch içinde)
            try
            {
                await _cacheService.RemoveAsync($"user:{dto.UserId}:monthly_summary");
                await _cacheService.RemoveAsync($"dashboard:{dto.UserId}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Redis cache temizlenirken hata oluştu (önemsiz): {Message}", ex.Message);
            }

            return Ok(new 
            { 
                success = true, 
                message = "Harcama başarıyla eklendi!", 
                transaction = new
                {
                    transaction.Id,
                    transaction.UserId,
                    transaction.Title,
                    transaction.Amount,
                    transaction.Category,
                    transaction.Date,
                    transaction.AiAdvice
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Harcama eklenirken beklenmeyen bir hata oluştu!");
            return StatusCode(500, new { success = false, message = "Sunucu hatası: " + ex.Message });
        }
    }

    [HttpPut("update-budget")]
    public async Task<IActionResult> UpdateBudget([FromBody] UpdateBudgetDto dto)
    {
        try
        {
            if (dto.MonthlyBudgetLimit <= 0)
                return BadRequest(new { success = false, message = "Bütçe limiti 0'dan büyük olmalıdır." });

            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null)
            {
                // Kullanıcı yoksa oluşturup bütçesini atayalım
                user = new User
                {
                    Id = dto.UserId,
                    FullName = "Burcu Aygün",
                    Email = "burcu@finai.com",
                    Balance = 50000,
                    MonthlyBudgetLimit = dto.MonthlyBudgetLimit
                };
                await _context.Users.AddAsync(user);
            }
            else
            {
                user.MonthlyBudgetLimit = dto.MonthlyBudgetLimit;
            }

            await _context.SaveChangesAsync();

            // Cache temizleme
            try
            {
                await _cacheService.RemoveAsync($"dashboard:{dto.UserId}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Redis cache temizlenirken hata oluştu: {Message}", ex.Message);
            }

            return Ok(new { success = true, message = "Bütçe limiti güncellendi.", limit = user.MonthlyBudgetLimit });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bütçe güncellenirken hata oluştu!");
            return StatusCode(500, new { success = false, message = "Sunucu hatası: " + ex.Message });
        }
    }
}