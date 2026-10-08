# 🚀 FinAI – Yapay Zeka Destekli Kişisel Finans ve Bütçe Yönetimi

FinAI, kullanıcıların yüklediği faturaları/fişleri arka planda yapay zeka süreçlerinden geçirerek otomatik kategorize eden, harcama alışkanlıklarına göre kişiselleştirilmiş bütçe tavsiyeleri sunan ve tüm finansal verileri canlı grafiklerle sunan **Full-Stack / Mikroservis** mimarili bir finans yönetim platformudur.

---

## 🛠️ Mimari ve Teknolojik Altyapı

Proje; yüksek performans, ölçeklenebilirlik ve gerçek zamanlı kullanıcı deneyimi hedeflenerek modern yazılım mimarileriyle tasarlanmıştır:

* **Backend Framework:** .NET Core API (Mikroservis Mimarisi)
* **Asenkron Mesajlaşma (Event-Driven):** RabbitMQ & MassTransit *(Fatura işleme akışları için)*
* **Veri Tabanı Yapısı:** 
  * **PostgreSQL:** İlişkisel finansal veriler, kullanıcı bütçeleri ve kategori takibi
  * **MongoDB:** Yapay zeka tarafından üretilen analitik öneriler ve metinsel fatura özetleri
* **Önbellekleme (Caching):** Redis 
* **Gerçek Zamanlı İletişim:** SignalR / WebSockets *(Arka planda işlenen faturaların ve güncellenen grafiklerin anlık arayüze yansıtılması)*
* **Frontend:** React, TypeScript, Tailwind CSS, Recharts, Framer Motion 

---

## 💡 Sistem Nasıl Çalışır? (İşleyiş Akışı)

1. **Fatura Yükleme:** Kullanıcı arayüz veya API üzerinden yeni bir fatura/harcama verisi yükler.
2. **Event Publishing:** API, bu işlemi bir event olarak **RabbitMQ** mesaj kuyruğuna iletir.
3. **Background Processing & AI Workflows:** Arka planda çalışan worker servisler mesajı alarak veriyi işler, harcamayı kategorize eder ve yapay zeka tavsiyesi oluşturur.
4. **Veri Kalıcılığı:** İlişkisel veriler **PostgreSQL**'e, AI çıktıları **MongoDB**'ye kaydedilir. Performans için özet veriler **Redis** üzerinde önbelleğe alınır.
5. **Real-time Push Notification:** İşlem tamamlandığı anda **SignalR Hub** üzerinden React frontend uygulamasına bildirim gönderilir ve grafikler sayfayı yenilemeye gerek kalmadan canlı olarak güncellenir.

---

## ⚙️ Kurulum ve Çalıştırma

### Gereksinimler
* .NET 8.0 SDK veya üzeri
* Node.js (v18+) & npm
* Docker & Docker Compose *(PostgreSQL, MongoDB, Redis ve RabbitMQ için)*

### 1. Servislerin Başlatılması (Docker)
Bağımlı servisleri (PostgreSQL, MongoDB, Redis, RabbitMQ) ayağa kaldırmak için:
```bash
docker-compose up -d
```

### 2. Backend API & Worker Kurulumu
Ana dizindeyken Backend API'yi başlatmak için:
```bash
cd src/FinAI.Core.API
dotnet restore
dotnet run
```
* API `http://localhost:5023` adresinde, Swagger arayüzü ise `http://localhost:5023/swagger` adresinde çalışacaktır.

Yeni bir terminal açıp AI Worker Service'i başlatmak için:
```bash
cd src/FinAI.AIWorker.Service
dotnet restore
dotnet run
```

### 3. Frontend (React + Vite)
Yeni bir terminal açıp arayüzü başlatmak için:
```bash
cd frontend/FinAI.WebUI
npm install
npm run dev
```
* Dashboard `http://localhost:5173` adresinde yayında olacaktır.

---

## 🔌 API Uç Noktaları (Özet)

| HTTP Metodu | Uç Nokta | Açıklama |
| :--- | :--- | :--- |
| **POST** | `/api/Invoices/upload` | Fatura yükler ve RabbitMQ analiz kuyruğuna iletir |
| **POST** | `/api/Dashboard/manual-entry` | Yeni harcama kalemi kaydeder ve cache'i temizler |
| **GET** | `/api/Dashboard/{userId}` | Kullanıcı bakiye ve son işlemlerini döner (Redis destekli) |
| **GET** | `/api/Dashboard/monthly-summary/{userId}` | Aylık kategorisel harcama dökümünü getirir |
| **PUT** | `/api/Transactions/update-budget` | Kullanıcının aylık tavan bütçe limitini günceller |
| **WS** | `/hubs/invoice` | SignalR WebSocket canlı bildirim bağlantısı |
