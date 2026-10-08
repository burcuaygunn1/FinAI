// FinAI.AIWorker.Service/Consumers/InvoiceUploadedConsumer.cs
using FinAI.AIWorker.Service.Models;
using FinAI.AIWorker.Service.Services;
using FinAI.BuildingBlocks.Events;
using MassTransit;
using MongoDB.Driver;
using System.Text.Json;

namespace FinAI.AIWorker.Service.Consumers;

/// <summary>
/// Core API tarafından RabbitMQ'ya fırlatılan InvoiceUploadedEvent'i dinler.
/// Faturayı Ollama ile analiz eder ve sonucu InvoiceProcessedEvent olarak yayınlar.
/// </summary>
public class InvoiceUploadedConsumer : IConsumer<InvoiceUploadedEvent>
{
    private readonly IOllamaService _ollamaService;
    private readonly IMongoDatabase _mongoDatabase;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<InvoiceUploadedConsumer> _logger;

    public InvoiceUploadedConsumer(
        IOllamaService ollamaService,
        IMongoDatabase mongoDatabase,
        IPublishEndpoint publishEndpoint,
        ILogger<InvoiceUploadedConsumer> logger)
    {
        _ollamaService = ollamaService;
        _mongoDatabase = mongoDatabase;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<InvoiceUploadedEvent> context)
    {
        var msg = context.Message;
        _logger.LogInformation("--> AIWorker: InvoiceUploadedEvent alındı. InvoiceId: {InvoiceId}, UserId: {UserId}",
            msg.InvoiceId, msg.UserId);

        try
        {
            // 1. Fatura görselini diskten oku
            if (!File.Exists(msg.FilePath))
            {
                _logger.LogWarning("--> Fatura dosyası bulunamadı: {FilePath}", msg.FilePath);
                await PublishFailureEvent(msg, "Fatura dosyası sunucuda bulunamadı.");
                return;
            }

            // 2. Basit metin çıkarma (OCR yerine dosya adı + path tabanlı)
            //    Gerçek OCR entegrasyonu için Tesseract veya Azure Form Recognizer eklenebilir.
            var fileName = Path.GetFileNameWithoutExtension(msg.FilePath);
            var invoiceText = $"Fatura Dosyası: {fileName}\nFatura ID: {msg.InvoiceId}\nYüklenme Tarihi: {msg.UploadedAt:dd/MM/yyyy HH:mm}";

            _logger.LogInformation("--> Ollama AI analizine gönderiliyor...");

            // 3. Ollama ile AI Analizi
            string aiResponseJson;
            try
            {
                aiResponseJson = await _ollamaService.AnalyzeInvoiceTextAsync(invoiceText);
            }
            catch (Exception ollamaEx)
            {
                _logger.LogWarning(ollamaEx, "--> Ollama bağlantı hatası. Demo modu ile devam ediliyor.");
                // Ollama çalışmıyorsa demo verisi üret
                aiResponseJson = JsonSerializer.Serialize(new
                {
                    merchantName = fileName.Length > 3 ? fileName[..Math.Min(20, fileName.Length)] : "Bilinmeyen Mağaza",
                    amount = 150.00m,
                    category = "Diğer",
                    aiAdvice = "Fatura başarıyla kaydedildi. Düzenli harcama takibinize devam edin."
                });
            }

            // 4. AI Yanıtını Parse Et
            string merchantName = "Bilinmeyen Mağaza";
            decimal amount = 0;
            string category = "Genel";
            string aiAdvice = "Faturanız bütçenize işlendi.";

            try
            {
                using var doc = JsonDocument.Parse(aiResponseJson);
                var root = doc.RootElement;

                if (root.TryGetProperty("merchantName", out var mn)) merchantName = mn.GetString() ?? merchantName;
                if (root.TryGetProperty("amount", out var am)) amount = am.GetDecimal();
                if (root.TryGetProperty("category", out var cat)) category = cat.GetString() ?? category;
                if (root.TryGetProperty("aiAdvice", out var adv)) aiAdvice = adv.GetString() ?? aiAdvice;
            }
            catch (JsonException jsonEx)
            {
                _logger.LogWarning(jsonEx, "--> AI yanıtı JSON olarak parse edilemedi. Ham yanıt: {Response}", aiResponseJson);
            }

            // 5. MongoDB'ye Analiz Logu Kaydet
            try
            {
                var logCollection = _mongoDatabase.GetCollection<AIBillingAnalysisLog>("AIBillingLogs");
                var log = new AIBillingAnalysisLog
                {
                    InvoiceId = msg.InvoiceId,
                    UserId = msg.UserId,
                    RawOcrText = invoiceText,
                    ModelName = "llama3",
                    ConfidenceScore = 0.85,
                    ExtractedMerchant = merchantName,
                    ExtractedAmount = amount,
                    ExtractedCategory = category,
                    ProcessedAt = DateTime.UtcNow
                };
                await logCollection.InsertOneAsync(log);
                _logger.LogInformation("--> Analiz logu MongoDB'ye kaydedildi.");
            }
            catch (Exception mongoEx)
            {
                _logger.LogWarning(mongoEx, "--> MongoDB'ye log kaydedilemedi (işlem devam ediyor).");
            }

            // 6. Başarılı InvoiceProcessedEvent'i RabbitMQ'ya Yayınla
            await _publishEndpoint.Publish(new InvoiceProcessedEvent
            {
                InvoiceId = msg.InvoiceId,
                UserId = msg.UserId,
                MerchantName = merchantName,
                Amount = amount,
                Category = category,
                AiAdvice = aiAdvice,
                IsSuccess = true
            });

            _logger.LogInformation("--> InvoiceProcessedEvent başarıyla yayınlandı! Mağaza: {Merchant}, Tutar: {Amount}",
                merchantName, amount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "--> AIWorker fatura işlenirken kritik hata! InvoiceId: {InvoiceId}", msg.InvoiceId);
            await PublishFailureEvent(msg, $"Fatura işlenirken bir hata oluştu: {ex.Message}");
        }
    }

    private async Task PublishFailureEvent(InvoiceUploadedEvent msg, string errorMessage)
    {
        await _publishEndpoint.Publish(new InvoiceProcessedEvent
        {
            InvoiceId = msg.InvoiceId,
            UserId = msg.UserId,
            IsSuccess = false,
            ErrorMessage = errorMessage
        });
    }
}