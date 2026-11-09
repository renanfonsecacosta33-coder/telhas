import { base44 } from "@/api/base44Client";
import { getItens, itensPorGrupo, classGrupo, buildItensJson, calcularProgressoRealPedido } from "@/lib/pedidoOdooHelper";
import { buscarOpsDasOfs } from "@/lib/consultaFilaPcp";
import { isAutoRoteamentoTelhasAtivo, rotearLoteTelhasAgrupadas, comRetry } from "@/lib/autoBobinaTelhasHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { carregarOpsDosPedidos, pedidoJaProduzido, fecharPedidosProduzidos } from "@/lib/reconciliacaoProducaoFinalizada";

// Pedidos processados simultaneamente na distribuição em lote.
// (Cada pedido já roda seus grupos de telha em paralelo — 2 pedidos mantêm a
// pressão no servidor equivalente à de antes, sem estourar o limite 429.)
const CONCORRENCIA = 2;

/**
 * Pré-busca TODAS as OPs existentes dos pedidos-alvo em 1-2 chamadas de rede.
 * (Antes: 2 chamadas POR GRUPO de telha, dentro do loop serial — o grande gargalo.)
 * Retorna um Map pedidoId -> OPs válidas (não canceladas).
 */
async function preBuscarOpsExistentes(alvo) {
  const opsPorPedido = new Map(alvo.map(p => [p.id, []]));
  const ops = await buscarOpsDasOfs(base44, "Pedido", alvo);
  for (const op of ops) {
    if (opsPorPedido.has(op.pedido_odoo_id)) opsPorPedido.get(op.pedido_odoo_id).push(op);
  }
  return opsPorPedido;
}

/**
 * DISTRIBUIÇÃO EM LOTE OTIMIZADA (Central PCP).
 * - Pré-busca única das OPs existentes (anti-duplicação) para todos os pedidos
 * - Processa pedidos em paralelo (lotes de CONCORRENCIA) em vez de 1 a 1
 * - Notificações de BI disparam em segundo plano sem bloquear
 * Retorna { sucesso, telhasCount, preservadosManual, falhas }
 */
export async function distribuirLotePedidos({ pedidos = [], opcoes = {}, bobinasEstoque = [], filialAtiva = "todas" }) {
  const preSelecionados = pedidos.filter(p => !(opcoes.pularDevolvidosManualmente && p.retirado_manualmente_ts));
  // Pedido cuja produção já foi finalizada nas máquinas é FECHADO, nunca redistribuído.
  const { fechados } = await fecharPedidosProduzidos({ pedidos: preSelecionados }).catch(() => ({ fechados: [] }));
  const idsFechados = new Set((fechados || []).map(p => p.id));
  const alvo = preSelecionados.filter(p => !idsFechados.has(p.id));
  const resumo = { sucesso: 0, telhasCount: 0, preservadosManual: pedidos.length - alvo.length, fechados: idsFechados.size, falhas: 0, ultimoErro: "", idsSucesso: [], idsFalha: [] };
  const ops = await preBuscarOpsExistentes(alvo);
  let cursor = 0;
  const worker = async () => {
    while (cursor < alvo.length) {
      const pedido = alvo[cursor++];
      try {
        const resultado = await distribuirPedidoPCP({ pedido, bobinasEstoque, filialAtiva, opsExistentesPre: ops.get(pedido.id) });
        resumo.sucesso++;
        resumo.telhasCount += resultado.telhasAutoRoteadas;
        resumo.idsSucesso.push(pedido.id);
      } catch (e) {
        resumo.falhas++;
        resumo.idsFalha.push(pedido.id);
        resumo.ultimoErro = e.message;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, alvo.length) }, worker));
  return resumo;
}

/**
 * DISTRIBUIÇÃO INDIVIDUAL À PROVA DE FALHAS (Central PCP).
 * Piloto Automático de Telhas com agrupamento de itens idênticos e
 * gravação do pedido com retry — uma falha transitória (ex: limite de
 * tráfego 429) nunca deixa OP órfã no galpão nem deixa o pedido
 * "meio distribuído" na fila do PCP.
 * Retorna { atualizado, telhasAutoRoteadas, bobinasVinculadas }.
 */
export async function distribuirPedidoPCP({ pedido, bobinasEstoque = [], filialAtiva = "todas", opsExistentesPre = null, indicesAlvo = null, itensProgramados = null, forcarRoteamento = false }) {
  const atual = await base44.entities.PedidoOdoo.get(pedido.id);
  if (atual.status_pcp === "concluido") return { atualizado: atual, telhasAutoRoteadas: 0, bobinasVinculadas: 0 };
  // Trava anti-pedido-zumbi: se as OPs das máquinas já estão finalizadas, o pedido
  // é concluído no PCP em vez de voltar para a fábrica.
  const opsReais = await carregarOpsDosPedidos([atual]);
  if (pedidoJaProduzido(atual, opsReais.opsTelhas, opsReais.opsCD)) {
    await fecharPedidosProduzidos({ pedidos: [atual], ...opsReais });
    return { atualizado: { ...atual, status_pcp: "concluido", percentual_concluido: 100 }, telhasAutoRoteadas: 0, bobinasVinculadas: 0 };
  }
  const itens = getItens(atual).map((it, idx) => itensProgramados?.[idx] ? { ...it, maquina: itensProgramados[idx].maquina, data_programada: itensProgramados[idx].data_programada } : it);
  if (!itens.length) throw new Error("Esta OF não possui itens válidos para distribuir.");
  const alvo = itens.filter(it => (!indicesAlvo || indicesAlvo.includes(it._idx)) && !it.concluido && it.status !== "concluido");
  const telhas = itensPorGrupo(alvo, "telha");
  const auto = forcarRoteamento || isAutoRoteamentoTelhasAtivo();
  let resultado = { opsCriadas: [], itensAtualizadosMap: {}, erros: [] };
  if (auto && telhas.length) resultado = await rotearLoteTelhasAgrupadas({ pedido: atual, itensTelhas: telhas, todasBobinas: bobinasEstoque, filialAtiva: atual.unidade || filialAtiva, opsExistentesPre });
  if (resultado.erros?.length && !resultado.opsCriadas.length) throw new Error(resultado.erros.map(e => e.message).join("; "));
  const frescos = await base44.entities.PedidoOdoo.get(atual.id);
  if (frescos.retirado_manualmente_ts && frescos.retirado_manualmente_ts !== atual.retirado_manualmente_ts) throw new Error("A OF foi devolvida ao PCP durante o envio. Revise as OPs criadas antes de continuar.");
  const indices = new Set(alvo.map(it => it._idx));
  const finais = getItens(frescos).map((it, idx) => {
    if (!indices.has(idx) || it.concluido || it.status === "concluido") return it;
    const programacao = itensProgramados?.[idx] ? { maquina: itensProgramados[idx].maquina, data_programada: itensProgramados[idx].data_programada } : {};
    if (auto && classGrupo(it) === "telha") return { ...it, ...programacao, ...(resultado.itensAtualizadosMap[idx] || { distribuido: false, status: "pendente" }) };
    return { ...it, ...programacao, distribuido: true, status: it.status === "em_producao" ? "em_producao" : "distribuido" };
  });
  const pendente = finais.some(it => !it.concluido && it.status !== "concluido" && !it.distribuido);
  const concluido = finais.every(it => it.concluido || it.status === "concluido");
  const status = concluido ? "concluido" : pendente ? "pendente_distribuicao" : resultado.opsCriadas.some(o => ["em_producao", "pausado", "aguardando_colagem"].includes(o.status)) ? "em_producao" : "distribuido";
  const percentual = calcularProgressoRealPedido({ ...frescos, itens: finais }, resultado.opsCriadas);
  const log = JSON.parse(frescos.historico_log || "[]");
  log.push({ data: new Date().toISOString(), usuario: "PCP", acao: pendente ? "distribuicao_parcial" : "distribuicao", detalhes: `${resultado.opsCriadas.length} OP(s) confirmada(s).${resultado.erros?.length ? ` Pendências: ${resultado.erros.map(e => e.message).join("; ")}` : ""}` });
  const atualizado = await comRetry(() => base44.entities.PedidoOdoo.update(atual.id, { itens_json: buildItensJson(finais), status_pcp: status, percentual_concluido: percentual, retirado_manualmente_ts: "", historico_log: JSON.stringify(log) }));
  notificarStatus(atualizado, "distribuido", { status_novo: status, percentual_concluido: percentual }).catch(() => {});
  if (resultado.erros?.length) throw new Error(`Envio parcial preservado. ${resultado.erros.map(e => e.message).join("; ")}`);
  return { atualizado, telhasAutoRoteadas: resultado.opsCriadas.length, bobinasVinculadas: resultado.opsCriadas.filter(o => o.bobina_superior_id).length };
}