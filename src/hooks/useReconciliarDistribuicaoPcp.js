import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reconciliarDistribuicaoPendentes } from "@/lib/reconciliarDistribuicaoPcp";

/**
 * Toda vez que a Central PCP carrega, OFs gravadas como pendentes mas que já
 * têm OP viva nas máquinas voltam para "distribuido" automaticamente.
 */
export default function useReconciliarDistribuicaoPcp({ pedidos = [], pedidosProducao = [], ordensCD = [], queryKey }) {
  const queryClient = useQueryClient();
  const rodando = useRef(false);
  const chaveFila = useRef(queryKey);
  chaveFila.current = queryKey;

  const assinatura = pedidos
    .filter(p => p.status_pcp === "pendente_distribuicao" && !p.retirado_manualmente_ts)
    .map(p => p.id)
    .join(",");

  useEffect(() => {
    if (rodando.current || !assinatura) return;
    rodando.current = true;
    (async () => {
      try {
        const { ids } = await reconciliarDistribuicaoPendentes({ pedidos, pedidosProducao, ordensCD });
        if (ids.length) {
          queryClient.setQueryData(chaveFila.current, (antigos = []) =>
            antigos.map(p => (ids.includes(p.id) ? { ...p, status_pcp: "distribuido" } : p))
          );
          queryClient.invalidateQueries({ queryKey: ["resumo-pcp"] });
        }
      } catch {
        // nova tentativa na próxima sincronização
      } finally {
        rodando.current = false;
      }
    })();
  }, [assinatura, pedidos, pedidosProducao, ordensCD, queryClient]);
}