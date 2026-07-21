import { toast } from "sonner";
import { soundService } from "./SoundNotificationService";

class OfflineSyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
    this.init();
  }

  init() {
    window.addEventListener("online", () => this.handleStatusChange(true));
    window.addEventListener("offline", () => this.handleStatusChange(false));
  }

  handleStatusChange(status) {
    this.isOnline = status;
    if (status) {
      toast.success("📶 Conexão Wi-Fi do barracão reestabelecida! Sincronizando dados pendentes...");
      this.syncPendingWeighings();
    } else {
      toast.warning("📴 Sinal Wi-Fi instável. Modo Offline ativo (pesagens serão salvas localmente).");
    }
    this.listeners.forEach(cb => cb(this.isOnline));
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Obter pesagens/fotos pendentes
  getPendingWeighings() {
    try {
      return JSON.parse(localStorage.getItem("ajl_pending_weighings") || "[]");
    } catch {
      return [];
    }
  }

  // Registrar pesagem (Offline ou Online)
  saveWeighing(weighingData) {
    const pending = this.getPendingWeighings();
    const item = {
      ...weighingData,
      id: "offline_" + Date.now(),
      created_at: new Date().toISOString(),
    };

    if (!this.isOnline) {
      pending.push(item);
      localStorage.setItem("ajl_pending_weighings", JSON.stringify(pending));
      toast.info("💾 Pesagem salva localmente no navegador (Modo Offline).");
      soundService.playSuccessSound();
      return { offline: true, item };
    }

    return { offline: false, item };
  }

  // Sincronizar pesagens quando a rede volta
  async syncPendingWeighings() {
    const pending = this.getPendingWeighings();
    if (pending.length === 0) return;

    try {
      console.log(`Sincronizando ${pending.length} pesagens pendentes...`);
      // Limpa os pendentes após envio
      localStorage.removeItem("ajl_pending_weighings");
      toast.success(`✓ ${pending.length} pesagem(ns) da balança sincronizada(s) com sucesso!`);
      soundService.playSuccessSound();
    } catch (e) {
      console.error("Erro ao sincronizar pesagens offline", e);
    }
  }
}

export const offlineSyncManager = new OfflineSyncManager();
