import { base44 } from "@/api/base44Client";
import { getItens, classGrupo, localizarOpDoItem, buildItensJson, calcularProgressoRealPedido } from "@/lib/pedidoOdooHelper";
import { opDaMesmaOf } from "@/lib/opVinculoSeguro";

/**
 * Auto-cura do PCP para OFs "meio distribuídas":
 * a OP já existe na máquina, mas o salvamento da OF falhou (queda de conexão /
 * limite de tráfego logo após criar a OP) e o status_pcp ficou gravado como
 * "pendente_distribuicao" — a OF reaparecia no filtro Pendentes PCP mesmo com a
 * produção já enviada ao galpão.
 *
 * Só corrige quando TODOS os itens em aberto já têm OP: distribuição parcial
 * real continua pendente, sem mascarar nada.
 */
export async function reconciliarDistribuicaoPendentes({ pedidos = [], pedidosProducao = [], ordensCD = [], usuario = "Conciliação Automática PCP" } = {}) {
  const candidatos = (pedidos || []).filter(p => p && p.status_pcp === "pendente_distribuicao" && !p.retirado_manualmente_ts);
  const ids = [];

  for (const pedido of candidatos) {
    const itens = getItens(pedido);
    if (!itens.length) continue;

    const telhas = (pedidosProducao || []).filter(op => opDaMesmaOf(op, pedido));
    const cd = (ordensCD || []).filter(op => opDaMesmaOf(op, pedido));
    if (!telhas.length && !cd.length) continue;

    const opDoItem = (it) => localizarOpDoItem(it, classGrupo(it) === "telha" ? telhas : cd, itens);
    const coberto = (it) => Boolean(it.concluido || it.status === "concluido" || opDoItem(it));
    if (!itens.every(coberto)) continue;

    const finais = itens.map(it => {
      if (it.distribuido || it.concluido || it.status === "concluido") return it;
      const op = opDoItem(it);
      if (!op) return it;
      return { ...it, distribuido: true, status: "distribuido", maquina: it.maquina || op.maquina || op.maquina_inicial || "" };
    });

    const jsonFinal = buildItensJson(finais);
    let log = [];
    try { log = JSON.parse(pedido.historico_log || "[]"); } catch { log = []; }
    log.push({ data: new Date().toISOString(), usuario, acao: "distribuicao", detalhes: "Status corrigido para distribuído: OPs já estavam nas máquinas." });

    await base44.entities.PedidoOdoo.update(pedido.id, {
      itens_json: jsonFinal,
      status_pcp: "distribuido",
      percentual_concluido: calcularProgressoRealPedido({ ...pedido, itens_json: jsonFinal }, telhas, cd),
      historico_log: JSON.stringify(log)
    });
    ids.push(pedido.id);
  }

  return { ids, total: ids.length };
}