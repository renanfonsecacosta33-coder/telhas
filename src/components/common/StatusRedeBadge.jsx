import React from "react";
import { useConectividadeRede } from "@/hooks/useConectividadeRede";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

export default function StatusRedeBadge({ className = "", compact = false }) {
  const { isOnline, qualidade, latenciaMs, testarLatencia } = useConectividadeRede();

  if (!isOnline) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 border border-red-500/40 text-red-600 dark:text-red-400 animate-pulse ${className}`}
        title="O tablet perdeu a conexão com o servidor. Ações estão sendo salvas localmente."
      >
        <WifiOff className="w-3.5 h-3.5" />
        <span>{compact ? "Offline" : "Offline (Modo Local)"}</span>
      </div>
    );
  }

  if (qualidade === "lenta") {
    return (
      <div
        onClick={testarLatencia}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-500/25 transition-colors ${className}`}
        title={`Conexão lenta (${latenciaMs}ms). Clique para retestar.`}
      >
        <Wifi className="w-3.5 h-3.5 text-amber-500" />
        <span>{compact ? `${latenciaMs}ms` : `Wi-Fi Instável (${latenciaMs}ms)`}</span>
      </div>
    );
  }

  return (
    <div
      onClick={testarLatencia}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 cursor-pointer hover:bg-emerald-500/20 transition-colors ${className}`}
      title={`Rede operando em alta velocidade (${latenciaMs || "<50"}ms). Clique para retestar.`}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      <span>{compact ? `${latenciaMs || 40}ms` : `Conectado (${latenciaMs ? `${latenciaMs}ms` : "Estável"})`}</span>
    </div>
  );
}
