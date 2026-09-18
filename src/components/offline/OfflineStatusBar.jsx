import React from "react";
import { useOffline } from "@/contexts/OfflineContext";
import { WifiOff, RefreshCw, CheckCircle2, CloudUpload, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflineStatusBar() {
  const { isOnline, isSyncing, itensPendentes, forcarSincronizacao } = useOffline();

  // Se estiver 100% online e sem fila pendente e sem sincronizar, não exibe nada
  if (isOnline && itensPendentes === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      className={`w-full px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between shadow-md transition-all duration-300 z-50 sticky top-0 ${
        !isOnline
          ? "bg-amber-500 text-amber-950 border-b border-amber-600 shadow-amber-500/20"
          : isSyncing
          ? "bg-blue-600 text-white border-b border-blue-700 shadow-blue-500/20"
          : "bg-emerald-600 text-white border-b border-emerald-700"
      }`}
    >
      <div className="flex items-center gap-2 max-w-[85%] truncate">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 shrink-0 text-amber-950 animate-pulse" />
            <span className="font-bold">Modo Offline Ativo:</span>
            <span className="truncate">
              Sem internet. Seus apontamentos estão sendo gravados na memória do tablet.
            </span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 shrink-0 text-white animate-spin" />
            <span className="font-bold">Sincronizando:</span>
            <span className="truncate">
              Enviando apontamentos gravados no tablet para a nuvem Base44...
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
            <span className="font-bold">Conexão Restabelecida:</span>
            <span className="truncate">
              {itensPendentes} item(ns) aguardando sincronização.
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {itensPendentes > 0 && (
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
              !isOnline
                ? "bg-amber-700 text-white"
                : isSyncing
                ? "bg-blue-800 text-white"
                : "bg-emerald-800 text-white"
            }`}
            title="Itens salvos na fila local do tablet"
          >
            <HardDrive className="w-3 h-3" />
            {itensPendentes} pendente{itensPendentes > 1 ? "s" : ""}
          </span>
        )}

        {isOnline && itensPendentes > 0 && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2.5 text-xs font-bold bg-white text-blue-900 hover:bg-slate-100 shadow-sm"
            onClick={() => forcarSincronizacao()}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <CloudUpload className="w-3.5 h-3.5 mr-1" />
                Sincronizar Agora
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
