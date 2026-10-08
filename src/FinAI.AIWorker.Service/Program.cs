using FinAI.AIWorker.Service.Consumers;
using FinAI.AIWorker.Service.Services;
using MassTransit;
using MongoDB.Driver;

var builder = Host.CreateApplicationBuilder(args);

// 1. MongoDB DI Kaydı
var mongoConnectionString = builder.Configuration.GetConnectionString("MongoDB") 
    ?? "mongodb://admin:admin_password@localhost:27017";
var mongoClient = new MongoClient(mongoConnectionString);
var mongoDatabase = mongoClient.GetDatabase("FinAILogsDb");
builder.Services.AddSingleton<IMongoDatabase>(mongoDatabase);

// 2. Ollama Service Kaydı (HttpClient Entegrasyonu)
builder.Services.AddHttpClient<IOllamaService, OllamaService>(client =>
{
    // Ollama varsayılan lokal adresi (appsettings.json'dan okunur, yoksa localhost:11434)
    var ollamaUrl = builder.Configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
    client.BaseAddress = new Uri(ollamaUrl);
    client.Timeout = TimeSpan.FromMinutes(2); // AI yanıtları için zaman aşımı süresi
});

// 3. MassTransit & RabbitMQ Konfigürasyonu
builder.Services.AddMassTransit(x =>
{
    // Fatura yüklendiğinde tetiklenecek Consumer
    x.AddConsumer<InvoiceUploadedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        var rabbitHost = builder.Configuration["RabbitMQ:Host"] ?? "localhost";
        var rabbitUser = builder.Configuration["RabbitMQ:Username"] ?? "guest";
        var rabbitPass = builder.Configuration["RabbitMQ:Password"] ?? "guest";

        cfg.Host(rabbitHost, "/", h =>
        {
            h.Username(rabbitUser);
            h.Password(rabbitPass);
        });

        // Kuyruk adı ve dinleyici eşleştirmesi
        cfg.ReceiveEndpoint("invoice-uploaded-queue", e =>
        {
            e.ConfigureConsumer<InvoiceUploadedConsumer>(context);
        });
    });
});

var host = builder.Build();
host.Run();