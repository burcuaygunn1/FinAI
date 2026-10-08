using System.Text.Json;
using FinAI.Core.API.Data;
using FinAI.Core.API.Entities;
using FinAI.Core.API.Models.DTOs;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace FinAI.Core.API.Controllers;

public record CreateManualTransactionDto(Guid UserId, string Title, decimal Amount, string Category);

[ApiController]
[Route("api/[controller]")]
[EnableCors("AllowReactApp")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IDistributedCache _cache;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        AppDbContext context, 
        IDistributedCache cache,
        ILogger<DashboardController> logger)
    {
        _context = context;
        _cache = cache;
        _logger = logger;
    }

    // ---------------------------------------------------------------------
    // MEVCUT ENDPOINT: Genel Dashboard Özeti (Son İşlemler & Bakiye)
    // ---------------------------------------------------------------------
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetDashboardSummary(Guid userId)
    {
        string cacheKey = $"dashboard:{userId}";

        // 1. Önce Redis Cache'e bak (Redis yoksa PostgreSQL'e geç)
        try
        {
            var cachedData = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrEmpty(cachedData))
            {
                var resultFromCache = JsonSerializer.Deserialize<object>(cachedData);
                return Ok(new { Source = "Redis Cache", Data = resultFromCache });
            }
        }
        catch (Exception cacheEx)
        {
            _logger.LogWarning("Redis okuma hatası (PostgreSQL'e geçiliyor): {Message}", cacheEx.Message);
        }

        // 2. Cache'te yoksa PostgreSQL'den çek
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return NotFound("Kullanıcı bulunamadı.");

        var recentTransactions = await _context.Transactions
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.Date)
            .Take(10)
            .ToListAsync();

        var summary = new
        {
            user.FullName,
            user.Balance,
            user.MonthlyBudgetLimit,
            RecentTransactions = recentTransactions.Select(t => new
            {
                t.Id,
                t.Title,
                t.Amount,
                t.Category,
                t.InvoiceId,
                t.AiAdvice,
                t.Date
            })
        };

        // 3. Veriyi Redis'e 10 dakikalığına kaydet (Redis yoksa devam et)
        try
        {
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            };
            await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(summary), cacheOptions);
        }
        catch (Exception cacheEx)
        {
            _logger.LogWarning("Redis yazma hatası (veri yine de dönülüyor): {Message}", cacheEx.Message);
        }

        return Ok(new { Source = "PostgreSQL Database", Data = summary });
    }

    // ---------------------------------------------------------------------
    // MEVCUT ENDPOINT (FAZ 4): Aylık Harcama Özeti (Pie Chart Verisi)
    // Cache-Aside Pattern & Dynamic Invalidation uyumlu
    // ---------------------------------------------------------------------
    [HttpGet("monthly-summary/{userId}")]
    public async Task<IActionResult> GetMonthlySummary(Guid userId)
    {
        string cacheKey = $"user:{userId}:monthly_summary";

        // 1. Önce Redis Cache'e bak (Redis yoksa PostgreSQL'e geç)
        try
        {
            var cachedData = await _cache.GetStringAsync(cacheKey);
            if (!string.IsNullOrEmpty(cachedData))
            {
                var resultFromCache = JsonSerializer.Deserialize<List<MonthlySummaryDto>>(cachedData);
                return Ok(new { Source = "Redis Cache", Data = resultFromCache });
            }
        }
        catch (Exception cacheEx)
        {
            _logger.LogWarning("Redis okuma hatası (PostgreSQL'e geçiliyor): {Message}", cacheEx.Message);
        }

        // 2. Cache'te yoksa PostgreSQL'den bu ayın kategorisel harcamalarını çek
        var monthlySummary = await _context.Transactions
            .Where(t => t.UserId == userId && t.Date.Month == DateTime.UtcNow.Month && t.Date.Year == DateTime.UtcNow.Year)
            .GroupBy(t => t.Category)
            .Select(g => new MonthlySummaryDto
            {
                CategoryName = g.Key ?? "Diğer",
                TotalAmount = g.Sum(t => t.Amount)
            })
            .ToListAsync();

        // 3. Veriyi Redis'e 1 saatliğine kaydet (Redis yoksa devam et)
        try
        {
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1)
            };
            await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(monthlySummary), cacheOptions);
        }
        catch (Exception cacheEx)
        {
            _logger.LogWarning("Redis yazma hatası (veri yine de dönülüyor): {Message}", cacheEx.Message);
        }

        return Ok(new { Source = "PostgreSQL Database", Data = monthlySummary });
    }

    // ---------------------------------------------------------------------
    // YENİ ENDPOINT: Manuel Harcama Ekleme (DashboardController Üzerinden)
    // Otomatik Kullanıcı Oluşturma + Redis Invalidation Koruması
    // ---------------------------------------------------------------------
    [HttpPost("manual-entry")]
    public async Task<IActionResult> AddManualTransaction([FromBody] CreateManualTransactionDto dto)
    {
        try
        {
            if (dto.Amount <= 0)
                return BadRequest(new { success = false, message = "Tutar 0'dan büyük olmalıdır." });

            // 1. Kullanıcıyı bul, veritabanında yoksa otomatik oluştur
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
                _logger.LogInformation("--> Yeni kullanıcı PostgreSQL üzerinde oluşturuldu: {UserId}", dto.UserId);
            }

            // 2. Yeni Harcamayı Veritabanına Kaydet
            var transaction = new Transaction
            {
                Id = Guid.NewGuid(),
                UserId = dto.UserId,
                Title = dto.Title,
                Amount = dto.Amount,
                Category = string.IsNullOrWhiteSpace(dto.Category) ? "Diğer" : dto.Category,
                Date = DateTime.UtcNow,
                AiAdvice = $"{dto.Title} harcamanız başarıyla kaydedildi."
            };

            user.Balance -= dto.Amount;

            await _context.Transactions.AddAsync(transaction);
            await _context.SaveChangesAsync();

            // 3. Redis Önbelleğini Temizle (Grafiklerin ve bakiyenin hemen güncellenmesi için)
            try
            {
                await _cache.RemoveAsync($"user:{dto.UserId}:monthly_summary");
                await _cache.RemoveAsync($"dashboard:{dto.UserId}");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Redis cache temizlenirken hata oluştu (işlem devam etti): {Message}", ex.Message);
            }

            return Ok(new 
            { 
                success = true, 
                message = "Harcama başarıyla kaydedildi!", 
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
            _logger.LogError(ex, "DashboardController üzerinden harcama eklenirken hata oluştu! Hata tipi: {ExType}, Mesaj: {ExMsg}",
                ex.GetType().Name, ex.Message);
            return StatusCode(500, new { success = false, message = $"Sunucu Hatası ({ex.GetType().Name}): {ex.Message}" });
        }
    }
}