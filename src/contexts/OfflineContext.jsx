import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { enfileirarAcaoOffline, obterFilaPendente } from "@/lib/offlineStorage";
import { sincronizarFilaOffline } from "@/lib/offlineSyncEngine";
import { toast } from "sonner";

const OfflineContext = createContext({
  isOnline: true,
  isSyncing: false,
  itensPendentes: 0,
  forcarSincronizacao: async () => {},
  executarComFallbackOffline: async () => {}
});

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [itensPendentes, setItensPendentes] = useState(0);

  // Atualiza a contagem de itens na fila
  const atualizarContagemFila = useCallback(async () => {
    try {
      const fila = await obterFilaPendente();
      setItensPendentes(fila ? fila.length : 0);
    } catch {
      setItensPendentes(0);
    }
  }, []);

  // Heartbeat de checagem real de internet
  const testarConexaoReal = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      // Ping com HEAD para o favicon ou index sem carregar dados pesados
      const res = await fetch(`/favicon.png?_hb=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res.ok || res.status === 304;
    } catch {
      return false;
    }
  }, []);

  // Força uma sincronização manual ou reativa
  const forcarSincronizacao = useCallback(async () => {
    setIsSyncing(true);
    try {
      await sincronizarFilaOffline();
    } finally {
      setIsSyncing(false);
      await atualizarContagemFila();
    }
  }, [atualizarContagemFila]);

  // Listener para status de sync emitido pelo engine
  useEffect(() => {
    const handleSyncStatus = (e) => {
      const { status } = e.detail || {};
      if (status === "sincronizando") {
        setIsSyncing(true);
      } else {
        setIsSyncing(false);
        atualizarContagemFila();
      }
    };

    const handleSyncConcluido = () => {
      atualizarContagemFila();
    };

    window.addEventListener("ajl-sync-status", handleSyncStatus);
    window.addEventListener("ajl-sync-concluido", handleSyncConcluido);

    // Contagem inicial
    atualizarContagemFila();

    return () => {
      window.removeEventListener("ajl-sync-status", handleSyncStatus);
      window.removeEventListener("ajl-sync-concluido", handleSyncConcluido);
    };
  }, [atualizarContagemFila]);

  // Detecção de conectividade (listeners nativos + heartbeat)
  useEffect(() => {
    let timer = null;

    const verificarConexao = async () => {
      const realOnline = await testarConexaoReal();
      setIsOnline((prev) => {
        if (!prev && realOnline) {
          // Conexão voltou! Dispara sincronização em segundo plano automaticamente
          console.log("[OfflineContext] Conexão restabelecida. Sincronizando fila...");
          sincronizarFilaOffline();
        }
        return realOnline;
      });
    };

    const handleOnline = async () => {
      const realOnline = await testarConexaoReal();
      setIsOnline(realOnline);
      if (realOnline) {
        sincronizarFilaOffline();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Polling de heartbeat periódico (15s se online, 6s se offline)
    const intervaloMs = isOnline ? 15000 : 6000;
    timer = setInterval(verificarConexao, intervaloMs);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timer) clearInterval(timer);
    };
  }, [isOnline, testarConexaoReal]);

  /**
   * Executa uma ação de gravação/atualização.
   * Se a internet estiver ativa, tenta chamar `acaoOnline()`.
   * Se estiver offline ou a chamada de rede falhar, enfileira localmente no IndexedDB.
   */
  const executarComFallbackOffline = useCallback(async ({
    tipo = "GENERIC_UPDATE",
    entidade = "Pedido",
    registroId = "",
    dados = {},
    descricao = "Ação do operador",
    acaoOnline = null
  }) => {
    // 1. Se estiver online e houver função online, tenta rodar online primeiro
    if (isOnline && typeof acaoOnline === "function") {
      try {
        const resultado = await acaoOnline();
        return { offline: false, sucesso: true, resultado };
      } catch (err) {
        console.warn(`[OfflineContext] Falha na chamada online de ${tipo}. Salvando offline...`, err);
        // Se falhou por motivo de rede, continua para o fluxo offline abaixo
      }
    }

    // 2. Fluxo Offline: Salva na fila do IndexedDB
    try {
      await enfileirarAcaoOffline({
        tipo,
        entidade,
        registroId,
        dados,
        descricao,
        timestamp: new Date().toISOString()
      });

      await atualizarContagemFila();

      toast.info(`Salvo localmente no tablet (Modo Offline)`, {
        description: `Será sincronizado com a nuvem assim que a internet voltar.`,
        duration: 3500
      });

      return { offline: true, sucesso: true };
    } catch (saveErr) {
      console.error("[OfflineContext] Erro fatal ao salvar offline:", saveErr);
      toast.error("Erro ao salvar localmente no tablet.");
      return { offline: true, sucesso: false, erro: saveErr };
    }
  }, [isOnline, atualizarContagemFila]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        itensPendentes,
        forcarSincronizacao,
        executarComFallbackOffline
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}
