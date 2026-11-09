import { base44 } from "@/api/base44Client";
import { getItens, buildItensJson, calcularProgressoRealPedido } from "@/lib/pedidoOdooHelper";
import { buscarOpsDasOfs } from "@/lib/consultaFilaPcp";
import { notificarStatus } from "@/lib/biNotificador";

/**
 * RECONCILIAÇÃO MÁQUINAS → CENTRAL PCP
 *
 * Toda OP finalizada nas máquinas precisa fechar o pedido no PCP. Sem isso o
 * pedido continua na fila ("Em Produção"/"Aguardando Distribuição") mesmo com a
 * produção já pronta — e uma devolução/distribuição posterior o reenvia para a
 * fábrica (pedido "zumbi").
 *
 * Estas funções fecham automaticamente qualquer pedido cuja produção real
 * (OPs finalizadas no galpão) já esteja 100% concluída.
 */

const naoEncerrado = (p) =>
  Boolean(p && p.id) &&
  String(p.status_pcp || "") !== "concluido" &&
  String(p.status_pcp || "") !== "cancelado";

const comRetry = async (fn, tentativas = 3) => {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      const m = String(e?.message || e || "").match(/Retry after (\d+) seconds/i);
      await new Promise((r) => setTimeout(r, m ? Math.min(Number(m[1]) * 1000 + 2000, 45000) : 1500 * (i + 1)));
    }
  }
  throw ultimo;
};

/** Busca em 2 chamadas as OPs (Telhas + Corte&Dobra) de todos os pedidos informados. */
export async function carregarOpsDosPedidos(pedidos = []) {
  const lista = (pedidos || []).filter((p) => p && p.id);
  if (!lista.length) return { opsTelhas: [], opsCD: [] };
  const [opsTelhas, opsCD] = await Promise.all([
    buscarOpsDasOfs(base44, "Pedido", lista).catch(() => []),
    buscarOpsDasOfs(base44, "OrdemMaquinaCD", lista).catch(() => [])
  ]);
  return { opsTelhas, opsCD };
}

/** true quando a produção real do pedido já chegou a 100% nas máquinas. */
export function pedidoJaProduzido(pedido, opsTelhas = [], opsCD = []) {
  if (!pedido) return false;
  const itens = getItens(pedido);
  if (!itens.length) return false;
  return Number(calcularProgressoRealPedido(pedido, opsTelhas, opsCD) || 0) >= 100;
}

/**
 * Fecha no PCP todos os pedidos já produzidos nas máquinas.
 * Retorna { fechados, ids }.
 */
export async function fecharPedidosProduzidos({ pedidos = [], opsTelhas = null, opsCD = null, usuario = "Conciliação Automática PCP" } = {}) {
  const lista = (pedidos || []).filter(naoEncerrado);
  if (!lista.length) return { fechados: [], ids: [] };

  const ops = opsTelhas && opsCD ? { opsTelhas, opsCD } : await carregarOpsDosPedidos(lista);
  const agora = new Date().toISOString();
  const updates = [];
  const fechados = [];

  for (const pedido of lista) {
    if (!pedidoJaProduzido(pedido, ops.opsTelhas, ops.opsCD)) continue;
    const itens = getItens(pedido).map((it) => ({
      ...it,
      concluido: true,
      status: "concluido",
      status_detalhado: "Concluído",
      percentual: 100
    }));
    const log = (() => {
      try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; }
    })();
    log.push({
      data: agora,
      usuario,
      acao: "conclusao_automatica",
      detalhes: "Pedido fechado automaticamente: toda a produção das OPs já foi finalizada nas máquinas."
    });
    updates.push({
      id: pedido.id,
      status_pcp: "concluido",
      percentual_concluido: 100,
      retirado_manualmente_ts: "",
      itens_json: buildItensJson(itens),
      historico_log: JSON.stringify(log)
    });
    fechados.push(pedido);
  }

  if (!updates.length) return { fechados: [], ids: [] };

  for (let i = 0; i < updates.length; i += 500) {
    await comRetry(() => base44.entities.PedidoOdoo.bulkUpdate(updates.slice(i, i + 500)));
  }

  fechados.forEach((p) =>
    notificarStatus({ ...p, status_pcp: "concluido" }, "concluido", {
      status_novo: "concluido",
      percentual_concluido: 100
    }).catch(() => {})
  );

  return { fechados, ids: fechados.map((p) => p.id) };
}