import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const TEMPO_INATIVIDADE_MS = 2 * 60 * 1000; // 2 minutos (120.000 ms)

/**
 * AutoRefreshInactivity
 * Monitora a inatividade do usuário em todo o app.
 * Se passar 2 minutos sem nenhuma interação (mouse, clique, teclado, touch, scroll),
 * executa a atualização automática (F5 / reload suave) para garantir que
 * vendedores e operadores sempre vejam o estoque e as OPs 100% atualizados.
 */
export default function AutoRefreshInactivity() {
  const queryClient = useQueryClient();
  const timerRef = useRef(null);
  const ultimoRefreshRef = useRef(Date.now());

  useEffect(() => {
    const executarRefresh = () => {
      // Evita múltiplos refreshes em sequência
      if (Date.now() - ultimoRefreshRef.current < 20000) return;
      ultimoRefreshRef.current = Date.now();

      // Invalida cache de dados para atualização em segundo plano sem recarregar a janela
      queryClient.invalidateQueries();
    };

    const resetarTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(executarRefresh, TEMPO_INATIVIDADE_MS);
    };

    const eventos = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click", "wheel"];
    eventos.forEach((evt) => window.addEventListener(evt, resetarTimer, { passive: true }));

    // Inicia o timer inicial de 2 minutos
    resetarTimer();

    // Quando o usuário volta para a aba do navegador após 2+ minutos fora
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const tempoOcioso = Date.now() - ultimoRefreshRef.current;
        if (tempoOcioso >= TEMPO_INATIVIDADE_MS) {
          executarRefresh();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      eventos.forEach((evt) => window.removeEventListener(evt, resetarTimer));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient]);

  return null;
}
