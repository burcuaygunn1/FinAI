using System.Text;
using System.Text.Json;

namespace FinAI.AIWorker.Service.Services;

public class OllamaService : IOllamaService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OllamaService> _logger;

    public OllamaService(HttpClient httpClient, ILogger<OllamaService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<string> AnalyzeInvoiceTextAsync(string invoiceText)
    {
        // LLM'e cevabı SADECE geçerli bir JSON formatında dönmesini tembihleyen Prompt
        var systemPrompt = @"Sen finansal fatura analiz uzmanı bir yapay zekasın. 
Sana verilen fatura metnini analiz et ve SADECE aşağıdaki JSON formatında yanıt ver. 
Başka hiçbir açıklama, markdown etiketi veya ekstra metin yazma!

JSON Formatı:
{
  ""merchantName"": ""Şirket veya Mağaza Adı"",
  ""amount"": 0.00,
  ""category"": ""Market | Eğlence | Fatura | Ulaşım | Diğer"",
  ""aiAdvice"": ""Kullanıcıya özel kısa Türkçe finansal tavsiye""
}";

        var requestBody = new
        {
            model = "llama3", // Bilgisayarında yüklü model adı (ör: llama3.2, mistral vb.)
            prompt = $"{systemPrompt}\n\nFatura Metni:\n{invoiceText}",
            stream = false,
            format = "json"
        };

        var jsonContent = new StringContent(
            JsonSerializer.Serialize(requestBody), 
            Encoding.UTF8, 
            "application/json"
        );

        try
        {
            _logger.LogInformation("--> Ollama'ya fatura analizi için istek atılıyor...");
            var response = await _httpClient.PostAsync("http://localhost:11434/api/generate", jsonContent);
            response.EnsureSuccessStatusCode();

            var responseString = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseString);
            
            string rawResponse = doc.RootElement.GetProperty("response").GetString() ?? "{}";
            _logger.LogInformation("--> Ollama Yanıtı Alındı: {Response}", rawResponse);

            return rawResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "--> Ollama isteği sırasında hata oluştu!");
            throw;
        }
    }
}