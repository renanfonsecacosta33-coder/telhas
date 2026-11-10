import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Assina uma entidade em tempo real com THROTTLE.
 * A fábrica grava várias OPs em rajada e cada evento disparava um refetch completo
 * da fila (mais contagem e consultas de OPs), estourando o limite de requisições
 * por minuto (429). Aqui, uma rajada inteira vira UM refetch a cada `ms`.
 * `chaveSecundaria` (ex.: totais agregados) é atualizada bem menos vezes.
 */
export default function useRealtimeThrottled({
  entidade,
  queryKey,
  ms = 8000,
  chaveSecundaria = null,
  msSecundaria = 60000,
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!base44?.entities?.[entidade]?.subscribe) return undefined;
    let timer = null;
    let ultimoSecundario = 0;

    const unsubscribe = base44.entities[entidade].subscribe(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey });
        if (chaveSecundaria && Date.now() - ultimoSecundario > msSecundaria) {
          ultimoSecundario = Date.now();
          queryClient.invalidateQueries({ queryKey: chaveSecundaria });
        }
      }, ms);
    });

    return () => {
      if (timer) clearTimeout(timer);
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [entidade, JSON.stringify(queryKey), JSON.stringify(chaveSecundaria), ms, msSecundaria, queryClient]);
}