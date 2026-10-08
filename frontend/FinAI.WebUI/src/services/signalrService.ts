import * as signalR from "@microsoft/signalr";

const HUB_URL = "http://localhost:5023/hubs/invoice"; // Backend adresin ve portun

export class SignalRService {
    private connection: signalR.HubConnection | null = null;

    public startConnection = async (userId?: string) => {
        if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
            if (userId) {
                await this.connection.invoke("JoinUserGroup", userId).catch(console.error);
            }
            return;
        }

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(HUB_URL)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        try {
            await this.connection.start();
            console.log("SignalR Bağlantısı Başarılı!");
            if (userId) {
                await this.connection.invoke("JoinUserGroup", userId).catch(console.error);
            }
        } catch (err) {
            console.error("SignalR Bağlantı Hatası:", err);
        }
    };

    public subscribeToInvoiceProcessed = (callback: (data: any) => void) => {
        if (this.connection) {
            this.connection.on("InvoiceNotification", (data) => {
                callback(data);
            });
            this.connection.on("ReceiveInvoiceNotification", (data) => {
                callback(data);
            });
        }
    };

    public stopConnection = async () => {
        if (this.connection) {
            await this.connection.stop();
        }
    };
}

export const signalRService = new SignalRService();