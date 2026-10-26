import { useState, useEffect, useCallback } from "react";

/**
 * Hook profissional de monitoramento de conectividade para o chão de fábrica
 * Detecta quedas de Wi-Fi instantaneamente e mede latência real com o servidor.
 */
export function useConectividadeRede() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [latenciaMs, setLatenciaMs] = useState(null);
  const [qualidade, setQualidade] = useState("boa"); // "excelente" | "boa" | "lenta" | "offline"
  const [ultimaVerificacao, setUltimaVerificacao] = useState(() => new Date());

  const testarLatencia = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      setQualidade("offline");
      setLatenciaMs(null);
      return;
    }

    const inicio = performance.now();
    try {
      // Ping ultraleve no favicon ou timestamp para medir RTT real
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      await fetch(`/favicon.ico?_ping=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const fim = performance.now();
      const rtt = Math.round(fim - inicio);

      setIsOnline(true);
      setLatenciaMs(rtt);
      setUltimaVerificacao(new Date());

      if (rtt < 120) setQualidade("excelente");
      else if (rtt < 400) setQualidade("boa");
      else setQualidade("lenta");
    } catch {
      // Se o fetch falhar mesmo o navigator dizendo online, a rede está congelada
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        setQualidade("offline");
      } else {
        setQualidade("lenta");
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      testarLatencia();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setQualidade("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Teste inicial e heartbeat a cada 30 segundos
    testarLatencia();
    const interval = setInterval(testarLatencia, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [testarLatencia]);

  return {
    isOnline,
    qualidade,
    latenciaMs,
    ultimaVerificacao,
    testarLatencia
  };
}
