using FinAI.Core.API.Consumers;
using FinAI.Core.API.Data;
using FinAI.Core.API.Hubs;
using FinAI.Core.API.Services; // ICacheService ve CacheService için gerekli namespace
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// 1. DbContext Servis Kaydı (PostgreSQL)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("PostgreSQL")));

// 2. Redis Cache Servis Kaydı
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "FinAI_";
});

// Redis konfigürasyonunun hemen altında Custom Cache Service DI Kaydı
builder.Services.AddScoped<ICacheService, CacheService>();

// 3. CORS Politikasını Ekle (React 5173 Portu için SignalR ve HTTP Erişimi)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173") // React adresi
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // SignalR (WebSocket) için zorunludur!
    });
});

// 4. SignalR Servis Kaydı
builder.Services.AddSignalR();

// 5. MassTransit & RabbitMQ Konfigürasyonu
builder.Services.AddMassTransit(x =>
{
    // RabbitMQ'dan gelen 'InvoiceProcessedEvent' olayını dinleyecek Consumer
    x.AddConsumer<InvoiceProcessedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMQ:Host"] ?? "localhost", "/", h =>
        {
            h.Username(builder.Configuration["RabbitMQ:Username"] ?? "guest");
            h.Password(builder.Configuration["RabbitMQ:Password"] ?? "guest");
        });

        cfg.ReceiveEndpoint("invoice-processed-queue", e =>
        {
            e.ConfigureConsumer<InvoiceProcessedConsumer>(context);
        });
    });
});

// 6. Controller ve Swagger Servisleri
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// 7. HTTP Request Pipeline Konfigürasyonu
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "FinAI API v1");
    });
}
else
{
    app.UseHttpsRedirection();
}

app.UseRouting();

// CORS Middleware'ini Aktifleştir (UseRouting'den sonra, UseAuthorization ve Endpoint eşleştirmelerinden önce olmalı)
app.UseCors("AllowReactApp");

// Yüklenen fatura görsellerinin sunucudan statik olarak sunulabilmesi için
app.UseStaticFiles();

app.UseAuthorization();

// 8. Endpoint Eşleştirmeleri
app.MapGet("/", () => Results.Redirect("/swagger"));

app.MapControllers();

// SignalR Real-Time Bildirim Hub Endpoint'i
app.MapHub<InvoiceHub>("/hubs/invoice").RequireCors("AllowReactApp");

app.Run();