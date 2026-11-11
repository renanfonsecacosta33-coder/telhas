import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pedidoJaProduzido, fecharPedidosProduzidos } from "@/lib/reconciliacaoProducaoFinalizada";

/**
 * Fecha no PCP (persistindo status_pcp = "concluido") toda OF cuja produção
 * real nas máquinas já chegou a 100%. Sem isso a OF continua na Fila Ativa
 * exibindo "Concluído 100%".
 */
export default function useFecharProduzidosPcp({ pedidos = [], pedidosProducao = [], ordensCD = [], queryKey }) {
  const queryClient = useQueryClient();
  const rodando = useRef(false);

  useEffect(() => {
    if (rodando.current || !pedidos.length) return;
    const produzidos = pedidos.filter(
      (p) => !["concluido", "cancelado"].includes(p.status_pcp) && pedidoJaProduzido(p, pedidosProducao, ordensCD)
    );
    if (!produzidos.length) return;

    rodando.current = true;
    (async () => {
      try {
        const { ids } = await fecharPedidosProduzidos({
          pedidos: produzidos,
          opsTelhas: pedidosProducao,
          opsCD: ordensCD,
          usuario: "Conciliação Automática PCP"
        });
        if (ids.length) {
          queryClient.setQueryData(queryKey, (antigos = []) => antigos.filter((p) => !ids.includes(p.id)));
          queryClient.invalidateQueries({ queryKey: [...queryKey, "total"] });
          queryClient.invalidateQueries({ queryKey: ["resumo-pcp"] });
        }
      } catch {
        // nova tentativa na próxima sincronização
      } finally {
        rodando.current = false;
      }
    })();
  }, [pedidos, pedidosProducao, ordensCD, queryClient, queryKey]);
}