namespace FinAI.AIWorker.Service.Services;

public interface IOllamaService
{
    Task<string> AnalyzeInvoiceTextAsync(string invoiceText);
}