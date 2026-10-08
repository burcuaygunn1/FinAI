// src/components/Dashboard.tsx
import React, { useEffect, useState, useRef } from "react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import {
    Sparkles,
    TrendingUp,
    CheckCircle2,
    RefreshCw,
    Wallet,
    UploadCloud,
    Tv,
    Music,
    ShieldCheck,
    Sliders,
    Bot,
    Flame,
    PieChart as PieIcon,
    BarChart3,
    PlusCircle,
    X,
    AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signalRService } from "../services/signalrService";

export interface MonthlySummaryDto {
    categoryName: string;
    totalAmount: number;
}

export interface AiFeedItem {
    id: string;
    title: string;
    message: string;
    category?: string;
    amount?: number;
    timestamp: string;
    type: "alert" | "advice" | "success" | "error";
}

interface DashboardProps {
    userId: string;
}

const CATEGORY_COLORS = ["#6366F1", "#EC4899", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4"];

export const Dashboard: React.FC<DashboardProps> = ({ userId }) => {
    // Sekme & Görünüm Yönetimi
    const [monthlyData, setMonthlyData] = useState<MonthlySummaryDto[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<"pie" | "bar">("pie");
    const [activeNavItem, setActiveNavItem] = useState<string>("dashboard");

    // Finansal Bakiye ve Tavan Limit
    const [totalBudget, setTotalBudget] = useState<number>(40000);
    const [totalSpent, setTotalSpent] = useState<number>(0);

    // Dropzone & Fatura Yükleme
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Bildirim Rozeti ve AI Akışı
    const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
    const [aiFeed, setAiFeed] = useState<AiFeedItem[]>([]);

    // Manuel Harcama Ekleme Modal Durumu
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [manualTitle, setManualTitle] = useState<string>("");
    const [manualAmount, setManualAmount] = useState<string>("");
    const [manualCategory, setManualCategory] = useState<string>("Market & Mutfak");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [modalError, setModalError] = useState<string | null>(null);

    // Ayarlar Sekmesi: Bütçe Limiti Değiştirme
    const [newBudgetInput, setNewBudgetInput] = useState<string>("40000");

    // Gerçek API'den Dashboard Verilerini Getir
    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Kategorisel Harcama Özeti
            const resSummary = await fetch(`http://localhost:5023/api/Dashboard/monthly-summary/${userId}`);
            if (resSummary.ok) {
                const summaryJson = await resSummary.json();
                if (summaryJson.data && summaryJson.data.length > 0) {
                    setMonthlyData(summaryJson.data);
                    const calculatedSpent = summaryJson.data.reduce(
                        (acc: number, curr: MonthlySummaryDto) => acc + curr.totalAmount,
                        0
                    );
                    setTotalSpent(calculatedSpent);
                } else {
                    setMonthlyData([]);
                    setTotalSpent(0);
                }
            }

            // 2. Kullanıcı Bütçe Limiti
            const resUser = await fetch(`http://localhost:5023/api/Dashboard/${userId}`);
            if (resUser.ok) {
                const userJson = await resUser.json();
                if (userJson.data?.monthlyBudgetLimit) {
                    setTotalBudget(userJson.data.monthlyBudgetLimit);
                    setNewBudgetInput(userJson.data.monthlyBudgetLimit.toString());
                }
            }
        } catch (err) {
            console.error("Dashboard verileri sunucudan çekilemedi:", err);
        } finally {
            setLoading(false);
        }
    };

    // SignalR Canlı Dinleyicisi
    useEffect(() => {
        fetchDashboardData();
        signalRService.startConnection(userId);

        signalRService.subscribeToInvoiceProcessed((data: any) => {
            setIsUploading(false);
            setUploadProgress(null);

            // Başarısız / Okunamayan Görsel Durumu
            if (data.status === "Failed" || data.Status === "Failed") {
                const errorMsg =
                    data.errorMessage ||
                    data.ErrorMessage ||
                    "Yüklenen görsel net değil ya da geçerli bir fatura/fiş algılanamadı. Lütfen daha net bir fotoğraf yükleyin.";

                setNotification({ message: errorMsg, type: "error" });

                setAiFeed((prev) => [
                    {
                        id: `err-${Date.now()}`,
                        title: "⚠️ Fatura Okunamadı",
                        message: errorMsg,
                        timestamp: "Az önce",
                        type: "error",
                    },
                    ...prev,
                ]);

                setTimeout(() => setNotification(null), 7000);
                return;
            }

            // Başarılı Fatura Analiz Durumu
            const merchant = data.title || data.Title || "Fatura";
            const amount = Number(data.amount || data.Amount || 0);
            const advice = data.advice || data.Advice || "Fatura harcamanız bütçenize işlendi.";
            const category = data.category || data.Category || "Genel";

            setAiFeed((prev) => [
                {
                    id: `invoice-${Date.now()}`,
                    title: `💡 FinAI Analizi: ${merchant}`,
                    message: advice,
                    category,
                    amount,
                    timestamp: "Az önce",
                    type: "success",
                },
                ...prev,
            ]);

            setNotification({
                message: `Fatura başarıyla işlendi: ${merchant} (₺${amount.toLocaleString()})`,
                type: "success",
            });
            setTimeout(() => setNotification(null), 5000);

            // Verileri yeniden sorgula ve güncelle
            fetchDashboardData();
        });

        return () => {
            signalRService.stopConnection();
        };
    }, [userId]);

    // Fatura Yükleme (Gerçek API İsteği)
    const uploadInvoiceFile = async (file: File) => {
        setIsUploading(true);
        setUploadedFileName(file.name);
        setUploadProgress("Fatura işlem kuyruğuna aktarılıyor...");

        const formData = new FormData();
        formData.append("File", file);
        formData.append("UserId", userId);

        try {
            const res = await fetch("http://localhost:5023/api/Invoices/upload", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                setUploadProgress("AI Worker fatura görselini inceliyor...");
            } else {
                setIsUploading(false);
                setNotification({ message: "Dosya sunucuya iletilemedi.", type: "error" });
                setTimeout(() => setNotification(null), 5000);
            }
        } catch (error) {
            setIsUploading(false);
            setNotification({
                message: "Sunucu bağlantı hatası. Backend servislerinin çalıştığından emin olun.",
                type: "error",
            });
            setTimeout(() => setNotification(null), 5000);
        }
    };

    // Manuel Harcama Ekleme (DashboardController.cs adresine yönlendirildi)
    const handleAddManualExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualTitle || !manualAmount) return;

        setIsSubmitting(true);
        setModalError(null);

        try {
            const res = await fetch("http://localhost:5023/api/Dashboard/manual-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: userId,
                    title: manualTitle,
                    amount: parseFloat(manualAmount),
                    category: manualCategory || "Diğer",
                }),
            });

            const data = await res.json().catch(() => null);

            if (res.ok) {
                // Başarılı: Modalı kapat, formu sıfırla, verileri tazele
                setIsModalOpen(false);
                setManualTitle("");
                setManualAmount("");
                setNotification({
                    message: `Harcama kaydedildi: ${manualTitle} (₺${manualAmount})`,
                    type: "success",
                });
                setTimeout(() => setNotification(null), 4000);

                // Grafikleri ve bütçeyi anında güncelle
                await fetchDashboardData();
            } else {
                // Backend hata döndürdüyse modal içinde göster
                setModalError(data?.message || `Sunucu hatası (${res.status}). Endpoint bulunamadı.`);
            }
        } catch (err: any) {
            console.error("Harcama ekleme hatası:", err);
            setModalError("Backend API'ye bağlanılamadı! Backend projenizin (port 5023) açık olduğundan emin olun.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Bütçe Limiti Güncelleme
    const handleUpdateBudget = async () => {
        try {
            const res = await fetch("http://localhost:5023/api/Transactions/update-budget", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    monthlyBudgetLimit: parseFloat(newBudgetInput),
                }),
            });

            if (res.ok) {
                setTotalBudget(parseFloat(newBudgetInput));
                setNotification({ message: "Aylık bütçe limiti başarıyla güncellendi!", type: "success" });
                setTimeout(() => setNotification(null), 4000);
            } else {
                setNotification({ message: "Bütçe güncellenirken hata oluştu.", type: "error" });
            }
        } catch (err) {
            setNotification({ message: "Bütçe sunucuya iletilemedi.", type: "error" });
        }
    };

    const spentPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-indigo-500 selection:text-white">
            {/* ========================================================= */}
            {/* 1. SOL PANEL: Menü & Fatura Dropzone */}
            {/* ========================================================= */}
            <aside className="w-full lg:w-72 lg:min-h-screen glass-panel border-r border-slate-800/80 p-5 flex flex-col justify-between shrink-0 shadow-2xl relative z-20">
                <div>
                    {/* Logo & Başlık */}
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/30">
                            <Bot className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h1 className="text-xl font-black bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                                    FinAI
                                </h1>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                    PRO
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium">Akıllı Finansal Kokpit</p>
                        </div>
                    </div>

                    {/* Navigasyon Linkleri */}
                    <nav className="space-y-1.5 mb-8">
                        {[
                            { id: "dashboard", label: "Genel Bakış", icon: PieIcon },
                            { id: "analytics", label: "Harcama Analitiği", icon: BarChart3 },
                            { id: "subscriptions", label: "Abonelikler & Fatura", icon: Tv },
                            { id: "advisor", label: "AI Danışman Akışı", icon: Sparkles },
                            { id: "settings", label: "Ayarlar & Limitler", icon: Sliders },
                        ].map((item) => {
                            const Icon = item.icon;
                            const isActive = activeNavItem === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveNavItem(item.id)}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${isActive
                                            ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                                    <span>{item.label}</span>
                                    {isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ml-auto shadow-[0_0_8px_#818cf8]" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Sürükle Bırak (Dropzone) Fatura Yükleme */}
                <div className="mt-auto pt-4 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                            Hızlı Fatura Yükle
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            RabbitMQ Canlı
                        </span>
                    </div>

                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            if (e.dataTransfer.files?.[0]) uploadInvoiceFile(e.dataTransfer.files[0]);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`group relative overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-300 ${isDragging
                                ? "border-indigo-400 bg-indigo-500/20 shadow-[0_0_25px_rgba(99,102,241,0.4)]"
                                : isUploading
                                    ? "border-purple-500 bg-purple-950/20 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                                    : "border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/50"
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && uploadInvoiceFile(e.target.files[0])}
                        />

                        <div className="flex flex-col items-center justify-center gap-2">
                            <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${isUploading
                                        ? "bg-purple-500/20 text-purple-400 animate-spin"
                                        : "bg-slate-800/80 text-indigo-400 border border-slate-700/60 shadow-inner"
                                    }`}
                            >
                                {isUploading ? <RefreshCw className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                            </div>

                            {isUploading ? (
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-purple-300 truncate max-w-[200px]">
                                        {uploadedFileName}
                                    </p>
                                    <p className="text-[10px] text-slate-400">{uploadProgress}</p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs font-semibold text-slate-200">Faturayı Sürükle veya Seç</p>
                                    <p className="text-[10px] text-slate-400">PNG, JPG, PDF (Net Görsel)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/70 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                                AI
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-200">FinAI Kullanıcısı</p>
                                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 inline" /> Doğrulanmış Oturum
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ========================================================= */}
            {/* 2. ANA İÇERİK ALANI */}
            {/* ========================================================= */}
            <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
                {/* Üst Karşılama ve Aksiyon Butonları */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-white">Finansal Kontrol Paneli</h2>
                        <p className="text-xs md:text-sm text-slate-400 mt-1">
                            Yapay zeka bütçe optimizasyonu, otomatik fatura ayrıştırma ve harcama takibi
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setIsModalOpen(true);
                                setModalError(null);
                            }}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                        >
                            <PlusCircle className="w-4 h-4" />
                            Harcama Ekle
                        </button>
                        <button
                            onClick={fetchDashboardData}
                            disabled={loading}
                            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 shadow-md"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
                            Yenile
                        </button>
                    </div>
                </div>

                {/* Dinamik Bildirim Toast'ı (Hata vs Başarı) */}
                <AnimatePresence>
                    {notification && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`p-4 rounded-xl border flex items-center justify-between shadow-xl ${notification.type === "success"
                                    ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
                                    : "bg-red-950/60 border-red-500/50 text-red-200"
                                }`}
                        >
                            <div className="flex items-center gap-3 text-xs font-semibold">
                                {notification.type === "success" ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                                )}
                                <span>{notification.message}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ===================================================== */}
                {/* 1. SEKME: GENEL BAKIŞ (DASHBOARD) */}
                {/* ===================================================== */}
                {activeNavItem === "dashboard" && (
                    <>
                        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Toplam Aylık Bütçe
                                    </span>
                                    <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                                        <Wallet className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-white">₺{totalBudget.toLocaleString()}</div>
                                <p className="text-[11px] text-slate-400 mt-2">Maksimum planlanan limit</p>
                            </div>

                            <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Bu Ay Harcanan
                                    </span>
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                                        <TrendingUp className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-3xl font-extrabold text-slate-100">
                                    ₺{totalSpent.toLocaleString()}
                                </div>
                                <p className="text-[11px] text-emerald-400 mt-2">
                                    Kalan: ₺{Math.max(0, totalBudget - totalSpent).toLocaleString()}
                                </p>
                            </div>

                            <div className="glass-card rounded-2xl p-5 border border-slate-800 shadow-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Bütçe Tüketimi
                                    </span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                        <Flame className="w-3 h-3" /> %{spentPercentage}
                                    </span>
                                </div>
                                <div className="text-3xl font-extrabold text-white mb-3">%{spentPercentage}</div>
                                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                                    <div
                                        style={{ width: `${spentPercentage}%` }}
                                        className={`h-full transition-all duration-700 ${spentPercentage > 85
                                                ? "bg-red-500"
                                                : spentPercentage > 65
                                                    ? "bg-amber-500"
                                                    : "bg-emerald-500"
                                            }`}
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Harcama Grafiği */}
                            <div className="lg:col-span-7 glass-card rounded-2xl p-6 border border-slate-800 space-y-6 shadow-xl">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                    <div>
                                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                                            <PieIcon className="w-4 h-4 text-indigo-400" /> Harcama Dağılımı
                                        </h3>
                                        <p className="text-xs text-slate-400">Güncel harcamaların kategorilere göre dökümü</p>
                                    </div>
                                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                                        <button
                                            onClick={() => setActiveTab("pie")}
                                            className={`px-3 py-1 rounded-lg ${activeTab === "pie" ? "bg-indigo-600 text-white" : "text-slate-400"
                                                }`}
                                        >
                                            Simit
                                        </button>
                                        <button
                                            onClick={() => setActiveTab("bar")}
                                            className={`px-3 py-1 rounded-lg ${activeTab === "bar" ? "bg-indigo-600 text-white" : "text-slate-400"
                                                }`}
                                        >
                                            Sütun
                                        </button>
                                    </div>
                                </div>

                                <div className="h-64 w-full flex items-center justify-center">
                                    {monthlyData.length === 0 ? (
                                        <p className="text-xs text-slate-500">Henüz harcama verisi bulunmuyor.</p>
                                    ) : activeTab === "pie" ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={monthlyData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={65}
                                                    outerRadius={95}
                                                    paddingAngle={3}
                                                    dataKey="totalAmount"
                                                    nameKey="categoryName"
                                                >
                                                    {monthlyData.map((_, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value: any) => [
                                                        `₺${Number(value).toLocaleString()}`,
                                                        "Harcama",
                                                    ]}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                <XAxis dataKey="categoryName" stroke="#64748b" fontSize={11} />
                                                <YAxis stroke="#64748b" fontSize={11} />
                                                <Tooltip
                                                    formatter={(value: any) => [
                                                        `₺${Number(value).toLocaleString()}`,
                                                        "Tutar",
                                                    ]}
                                                />
                                                <Bar dataKey="totalAmount" fill="#6366F1" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* AI Akış Alanı */}
                            <div className="lg:col-span-5 glass-card rounded-2xl p-6 border border-slate-800 space-y-4 shadow-xl">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <Bot className="w-5 h-5 text-indigo-400" />
                                        <h3 className="text-base font-bold text-white">AI Danışman Akışı</h3>
                                    </div>
                                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                        Canlı
                                    </span>
                                </div>

                                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                                    {aiFeed.length === 0 ? (
                                        <div className="text-center py-10 text-slate-500 text-xs">
                                            Fatura yükleyerek veya harcama ekleyerek analiz başlatabilirsiniz.
                                        </div>
                                    ) : (
                                        aiFeed.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`p-3.5 rounded-xl border text-xs ${item.type === "error"
                                                        ? "bg-red-950/40 border-red-500/50 text-red-200"
                                                        : "bg-slate-900/60 border-slate-800 text-slate-300"
                                                    }`}
                                            >
                                                <div className="flex justify-between font-bold mb-1">
                                                    <span className={item.type === "error" ? "text-red-400" : "text-indigo-300"}>
                                                        {item.title}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">{item.timestamp}</span>
                                                </div>
                                                <p className="text-slate-300 mt-1">{item.message}</p>
                                                {item.amount && (
                                                    <div className="mt-2 text-right font-bold text-indigo-400">
                                                        ₺{item.amount.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ===================================================== */}
                {/* 2. SEKME: HARCAMA ANALİTİĞİ */}
                {/* ===================================================== */}
                {activeNavItem === "analytics" && (
                    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 shadow-xl">
                        <h3 className="text-lg font-bold text-white">Detaylı Kategori Analitiği</h3>
                        <p className="text-xs text-slate-400">Veritabanına kaydedilen tüm harcama kalemleri ve toplamları</p>
                        <div className="divide-y divide-slate-800 mt-4">
                            {monthlyData.length === 0 ? (
                                <p className="text-xs text-slate-500 py-4">Kayıtlı harcama bulunamadı.</p>
                            ) : (
                                monthlyData.map((cat, idx) => (
                                    <div key={idx} className="py-3 flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                                            />
                                            <span className="font-semibold text-slate-200">{cat.categoryName}</span>
                                        </div>
                                        <div className="font-bold text-white">₺{cat.totalAmount.toLocaleString()}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ===================================================== */}
                {/* 3. SEKME: ABONELİKLER & FATURA */}
                {/* ===================================================== */}
                {activeNavItem === "subscriptions" && (
                    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 shadow-xl">
                        <h3 className="text-lg font-bold text-white">Tespit Edilen Düzenli Harcamalar & Abonelikler</h3>
                        <p className="text-xs text-slate-400">
                            Yüklenen faturalardan yapay zeka tarafından tespit edilen periyodik abonelikler
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                                <div className="flex items-center justify-between mb-2">
                                    <Tv className="w-5 h-5 text-red-400" />
                                    <span className="text-[10px] text-slate-500">Aylık</span>
                                </div>
                                <h4 className="text-sm font-bold text-white">Dijital Medya Servisleri</h4>
                                <p className="text-xs text-slate-400 mt-1">Video & Dizi Abonelikleri</p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                                <div className="flex items-center justify-between mb-2">
                                    <Music className="w-5 h-5 text-emerald-400" />
                                    <span className="text-[10px] text-slate-500">Aylık</span>
                                </div>
                                <h4 className="text-sm font-bold text-white">Müzik Platformları</h4>
                                <p className="text-xs text-slate-400 mt-1">Ses & Podcast Abonelikleri</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===================================================== */}
                {/* 4. SEKME: AI DANIŞMAN TAM AKIŞ */}
                {/* ===================================================== */}
                {activeNavItem === "advisor" && (
                    <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-4 shadow-xl">
                        <h3 className="text-lg font-bold text-white">Tüm AI Finansal Bildirimleri</h3>
                        <p className="text-xs text-slate-400">
                            Geçmiş fatura analizleri ve yapay zekanın sağladığı tasarruf tavsiyeleri
                        </p>
                        <div className="space-y-3 pt-2">
                            {aiFeed.length === 0 ? (
                                <p className="text-xs text-slate-500">Henüz bildirim geçmişi yok.</p>
                            ) : (
                                aiFeed.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-xl border text-xs ${item.type === "error"
                                                ? "bg-red-950/30 border-red-500/40"
                                                : "bg-slate-900/60 border-slate-800"
                                            }`}
                                    >
                                        <div className="flex justify-between font-bold">
                                            <span className={item.type === "error" ? "text-red-400" : "text-indigo-400"}>
                                                {item.title}
                                            </span>
                                            <span className="text-slate-500">{item.timestamp}</span>
                                        </div>
                                        <p className="text-slate-300 mt-2">{item.message}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ===================================================== */}
                {/* 5. SEKME: AYARLAR & LİMİTLER */}
                {/* ===================================================== */}
                {activeNavItem === "settings" && (
                    <div className="glass-card rounded-2xl p-6 border border-slate-800 max-w-xl space-y-4 shadow-xl">
                        <h3 className="text-lg font-bold text-white">Finansal Limit Ayarları</h3>
                        <p className="text-xs text-slate-400">Aylık tavan harcama limitinizi buradan düzenleyebilirsiniz.</p>
                        <div className="space-y-3 pt-2">
                            <div>
                                <label className="text-xs text-slate-300 block mb-1">Aylık Bütçe Limiti (₺)</label>
                                <input
                                    type="number"
                                    value={newBudgetInput}
                                    onChange={(e) => setNewBudgetInput(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <button
                                onClick={handleUpdateBudget}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/30"
                            >
                                Limiti Kaydet
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* ========================================================= */}
            {/* MANUEL HARCAMA EKLEME MODAL'I */}
            {/* ========================================================= */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => {
                                setIsModalOpen(false);
                                setModalError(null);
                            }}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-lg font-bold text-white mb-1">Yeni Harcama Ekle</h3>
                        <p className="text-xs text-slate-400 mb-4">Manuel olarak yeni bir harcama kalemi girin.</p>

                        {modalError && (
                            <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-300 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                                <span>{modalError}</span>
                            </div>
                        )}

                        <form onSubmit={handleAddManualExpense} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-300 mb-1 font-medium">Harcama Başlığı / İşyeri</label>
                                <input
                                    type="text"
                                    placeholder="Örn: Kahve Dünyası, Migros"
                                    value={manualTitle}
                                    onChange={(e) => setManualTitle(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-medium">Tutar (₺)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={manualAmount}
                                    onChange={(e) => setManualAmount(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-slate-300 mb-1 font-medium">Kategori</label>
                                <select
                                    value={manualCategory}
                                    onChange={(e) => setManualCategory(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="Eğlence">Eğlence</option>
                                    <option value="Market & Mutfak">Market & Mutfak</option>
                                    <option value="Faturalar">Faturalar</option>
                                    <option value="Ulaşım">Ulaşım</option>
                                    <option value="Abonelikler">Abonelikler</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Kaydediliyor...
                                    </>
                                ) : (
                                    "Harcamayı Kaydet"
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};