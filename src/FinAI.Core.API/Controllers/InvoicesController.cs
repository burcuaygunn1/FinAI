using FinAI.BuildingBlocks.Events;
using MassTransit;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace FinAI.Core.API.Controllers;

public class InvoiceUploadDto
{
    public IFormFile File { get; set; } = null!;
    public Guid UserId { get; set; }
}

[ApiController]
[Route("api/[controller]")]
[EnableCors("AllowReactApp")]
public class InvoicesController : ControllerBase
{
    private readonly IPublishEndpoint _publishEndpoint;

    public InvoicesController(IPublishEndpoint publishEndpoint)
    {
        _publishEndpoint = publishEndpoint;
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadInvoice([FromForm] InvoiceUploadDto request)
    {
        if (request.File == null || request.File.Length == 0)
            return BadRequest("Lütfen geçerli bir fatura dosyası yükleyin.");

        // Dosyayı geçici olarak yerel klasöre kaydet
        var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        if (!Directory.Exists(uploadsFolder))
            Directory.CreateDirectory(uploadsFolder);

        var invoiceId = Guid.NewGuid().ToString();
        var filePath = Path.Combine(uploadsFolder, $"{invoiceId}_{request.File.FileName}");

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await request.File.CopyToAsync(stream);
        }

        // RabbitMQ'ya InvoiceUploadedEvent Fırlatıyoruz!
        await _publishEndpoint.Publish(new InvoiceUploadedEvent
        {
            InvoiceId = invoiceId,
            UserId = request.UserId,
            FilePath = filePath,
            UploadedAt = DateTime.UtcNow
        });

        return Ok(new
        {
            Message = "Faturanız alındı ve analiz kuyruğuna eklendi.",
            InvoiceId = invoiceId
        });
    }
}