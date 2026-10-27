import { base44 } from "@/api/base44Client";
import { cancelarOpsDasOfsExatas, comRetryLimite } from "@/lib/conciliacaoPcpMaquinasHelper";
import { parseItensPedido } from "@/lib/regrasFabrica";
import { notificarStatus } from "@/lib/biNotificador";

const invalidarQueriesPcp = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
  queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
  queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
  queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
};

// ── DEVOLVER PEDIDOS SELECIONADOS À CENTRAL PCP EM MASSA ──
// Cancela as OPs ativas nos galpões (Telhas + Corte & Dobra), zera os itens
// e devolve os pedidos para "Pendente de Distribuição" (0%).
// Retorna true se executou, false se o usuário cancelou.
export const devolverPedidosPCPLote = async ({ lista, queryClient, toast }) => {
  const listaValida = (lista || []).filter(Boolean);
  if (!listaValida.length) return false;
  const qtd = listaValida.length;

  if (!window.confirm(
    `↩️ DEVOLVER ${qtd} PEDIDO(S) À CENTRAL PCP\n\n` +
    "As OPs ativas destes pedidos nos galpões (Telhas e Corte & Dobra) serão canceladas e os itens voltarão para \"Pendente de Distribuição\" (0%).\n\n" +
    "Deseja confirmar?"
  )) return false;

  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const agoraIso = new Date().toISOString();
    // 1. Cancela SOMENTE as OPs das OFs selecionadas — uma venda pode ter várias OFs
    //    irmãs no Odoo, e casar apenas pelo numero_pedido cancelaria a produção da
    //    OF irmã. A produção já finalizada permanece intocada.
    await cancelarOpsDasOfsExatas({ pedidos: listaValida, todayIso });

    // 2. Zera os itens de cada pedido selecionado e devolve à fila do PCP (lote único)
    const updates = listaValida.map(pedido => {
      const itensZerados = parseItensPedido(pedido.itens_json).map(i => ({
        ...i,
        status: "pendente",
        status_detalhado: "Pendente de Distribuição",
        concluido: false,
        distribuido: false,
        maquina: ""
      }));
      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: agoraIso,
        usuario: "PCP",
        acao: "devolucao_massa_pcp",
        detalhes: `Pedido devolvido à Central PCP em massa (${qtd} pedidos) — OPs dos galpões canceladas.`
      }];
      return {
        id: pedido.id,
        status_pcp: "pendente_distribuicao",
        retirado_manualmente_ts: agoraIso,
        percentual_concluido: 0,
        maquinas_json: "[]",
        etapas_telha_json: "[]",
        itens_json: JSON.stringify(itensZerados),
        historico_log: JSON.stringify(novoLog)
      };
    });
    // bulkUpdate aceita até 500 por chamada
    for (let i = 0; i < updates.length; i += 500) {
      await comRetryLimite(() => base44.entities.PedidoOdoo.bulkUpdate(updates.slice(i, i + 500)));
    }

    // 3. Mini BI — evento por pedido (fire-and-forget)
    listaValida.forEach(p =>
      notificarStatus(p, "devolvido_pcp", { status_novo: "pendente_distribuicao", percentual_concluido: 0, operador: "PCP" }).catch(() => {})
    );

    invalidarQueriesPcp(queryClient);
    toast({
      title: `↩️ ${qtd} pedido(s) devolvido(s) à Central PCP!`,
      description: "OPs dos galpões canceladas. Pedidos voltaram para Pendente de Distribuição (0%).",
      className: "border-amber-500/40"
    });
    return true;
  } catch (e) {
    toast({ title: "Erro ao devolver pedidos ao PCP", description: e.message, variant: "destructive" });
    return false;
  }
};