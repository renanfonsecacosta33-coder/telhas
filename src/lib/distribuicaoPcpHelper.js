import { base44 } from "@/api/base44Client";
import { parseItensPedido } from "@/lib/regrasFabrica";
import { itensPorGrupo } from "@/lib/pedidoOdooHelper";
import { isAutoRoteamentoTelhasAtivo, rotearLoteTelhasAgrupadas, comRetry } from "@/lib/autoBobinaTelhasHelper";
import { notificarStatus } from "@/lib/biNotificador";

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
  const opsPorPedido = new Map();
  try {
    const idsPedidos = alvo.map(p => p.id).filter(Boolean);
    const todasOps = idsPedidos.length > 0
      ? await comRetry(() => base44.entities.Pedido.filter({ pedido_odoo_id: { $in: idsPedidos } }))
      : [];
    for (const op of todasOps || []) {
      if (String(op.status || "").toLowerCase() === "cancelado") continue;
      if (!opsPorPedido.has(op.pedido_odoo_id)) opsPorPedido.set(op.pedido_odoo_id, []);
      opsPorPedido.get(op.pedido_odoo_id).push(op);
    }
    // Fallback por numero_pedido apenas para pedidos sem OP encontrada por ID
    const faltantes = alvo.filter(p => !opsPorPedido.has(p.id) && p.numero_pedido);
    if (faltantes.length > 0) {
      const opsPorNumero = await comRetry(() => base44.entities.Pedido.filter({ numero_pedido: { $in: faltantes.map(p => p.numero_pedido) } }));
      const porNumero = new Map();
      for (const op of opsPorNumero || []) {
        if (String(op.status || "").toLowerCase() === "cancelado") continue;
        // OP com vínculo explícito de OF pertence a uma OF específica:
        // nunca tratá-la como OP de outra OF irmã da mesma venda
        if (op.pedido_odoo_id || op.of_odoo_id || op.of_nome) continue;
        if (!porNumero.has(op.numero_pedido)) porNumero.set(op.numero_pedido, []);
        porNumero.get(op.numero_pedido).push(op);
      }
      for (const p of faltantes) {
        if (porNumero.has(p.numero_pedido)) opsPorPedido.set(p.id, porNumero.get(p.numero_pedido));
      }
    }
  } catch (errPre) {
    console.warn("[DistribuicaoLote] Pré-busca de OPs falhou, usando checagem individual:", errPre);
    opsPorPedido.clear();
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
  if (!pedidos || pedidos.length === 0) {
    return { sucesso: 0, telhasCount: 0, preservadosManual: 0, falhas: 0, ultimoErro: "", idsSucesso: [], idsFalha: [] };
  }

  const autoTelhasAtivo = isAutoRoteamentoTelhasAtivo();
  const alvo = pedidos.filter(ped => !(opcoes.pularDevolvidosManualmente && ped.retirado_manualmente_ts));
  const preservadosManual = pedidos.length - alvo.length;

  let sucesso = 0;
  let telhasCount = 0;
  let falhas = 0;
  let ultimoErro = "";
  const idsSucesso = [];
  const idsFalha = [];

  // ── OTIMIZAÇÃO 1: pré-busca única das OPs existentes ──
  const opsPorPedido = autoTelhasAtivo && alvo.length > 0
    ? await preBuscarOpsExistentes(alvo)
    : new Map();

  const processarPedido = async (ped) => {
    try {
      const itens = parseItensPedido(ped.itens_json);
      const telhas = itensPorGrupo(itens, "telha");

      if (autoTelhasAtivo && telhas.length > 0) {
        const telhasParaRoteamento = itens
          .map((it, idx) => ({ ...it, _idx: idx }))
          .filter((it, idx) => {
            const ehTelha = telhas.some(t => (t._idx != null ? t._idx === idx : t.produto === it.produto));
            return ehTelha && it.status !== "concluido";
          });

        if (telhasParaRoteamento.length > 0) {
          const resAgrupado = await rotearLoteTelhasAgrupadas({
            pedido: ped,
            itensTelhas: telhasParaRoteamento,
            todasBobinas: bobinasEstoque,
            filialAtiva: ped.unidade || filialAtiva,
            // ── OTIMIZAÇÃO 2: OPs já pré-buscadas em massa (sem filtro por grupo) ──
            opsExistentesPre: opsPorPedido.has(ped.id) ? opsPorPedido.get(ped.id) : null
          });

          const opsConfirmadas = (resAgrupado.opsCriadas || []).filter(op => op?.id);
          // 🛡️ NUNCA FINGIR ENVIO: sem OP confirmada na perfiladeira a OF não pode
          // ser marcada como distribuída — ela permanece pendente na Central PCP.
          if (opsConfirmadas.length === 0) {
            throw new Error(`Nenhuma OP foi criada na perfiladeira (OF ${ped.of_nome || ped.numero_pedido}).`);
          }
          telhasCount += telhasParaRoteamento.length;

          Object.entries(resAgrupado.itensAtualizadosMap || {}).forEach(([idxStr, dadosItem]) => {
            const i = Number(idxStr);
            if (itens[i]) {
              itens[i] = { ...itens[i], ...dadosItem };
            }
          });
        }
      }

      const itensDistribuidos = itens.map(it => ({
        ...it,
        status: it.status === "concluido" ? "concluido" : (it.status === "em_producao" ? "em_producao" : "distribuido"),
        distribuido: true
      }));

      const logExistente = (() => { try { return JSON.parse(ped.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: "distribuicao_lote",
        detalhes: autoTelhasAtivo
          ? "Pedido distribuído em lote com Piloto Automático de Telhas direto para as perfiladeiras."
          : "Pedido distribuído em lote para os galpões de produção (Telhas, C&D e Frisada)."
      }];

      // Retry: se a gravação falhar (ex: limite de tráfego), a OP já criada não fica órfã
      const atualizado = await comRetry(() => base44.entities.PedidoOdoo.update(ped.id, {
        itens_json: JSON.stringify(itensDistribuidos),
        status_pcp: "distribuido",
        percentual_concluido: 15,
        retirado_manualmente_ts: "",
        historico_log: JSON.stringify(novoLog)
      }));

      // Notificação em segundo plano sem bloquear o lote
      notificarStatus(atualizado, "distribuido", { status_novo: "distribuido", percentual_concluido: 15 }).catch(() => {});
      sucesso++;
      idsSucesso.push(ped.id);
    } catch (err) {
      falhas++;
      idsFalha.push(ped.id);
      ultimoErro = err?.message || String(err);
      console.error("[DistribuicaoLote] falha ao distribuir pedido:", ped.numero_pedido, err);
    }
  };

  // ── OTIMIZAÇÃO 3: pool de concorrência com throttle para evitar rate limit ──
  let idx = 0;
  const worker = async () => {
    while (idx < alvo.length) {
      const ped = alvo[idx++];
      await processarPedido(ped);
      if (idx < alvo.length) {
        await new Promise(r => setTimeout(r, 60));
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA, Math.max(alvo.length, 1)) }, worker)
  );

  return { sucesso, telhasCount, preservadosManual, falhas, ultimoErro, idsSucesso, idsFalha };
}

/**
 * DISTRIBUIÇÃO INDIVIDUAL À PROVA DE FALHAS (Central PCP).
 * Piloto Automático de Telhas com agrupamento de itens idênticos e
 * gravação do pedido com retry — uma falha transitória (ex: limite de
 * tráfego 429) nunca deixa OP órfã no galpão nem deixa o pedido
 * "meio distribuído" na fila do PCP.
 * Retorna { atualizado, telhasAutoRoteadas, bobinasVinculadas }.
 */
export async function distribuirPedidoPCP({ pedido, bobinasEstoque = [], filialAtiva = "todas" }) {
  const autoTelhasAtivo = isAutoRoteamentoTelhasAtivo();
  let telhasAutoRoteadas = 0;
  let bobinasVinculadas = 0;

  const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
  const novoLog = [...logExistente, {
    data: new Date().toISOString(),
    usuario: "PCP",
    acao: autoTelhasAtivo ? "distribuicao_automatica_telhas_bobina" : "distribuicao_automatica",
    detalhes: autoTelhasAtivo
      ? "Pedido distribuído com Piloto Automático de Telhas (encaminhado direto às perfiladeiras com bobina selecionada pelo Odoo)."
      : "Pedido distribuído automaticamente para os galpões (Telhas→Barracão Telhas, C&D→Barracão C&D, Frisada→Expedição)."
  }];

  const itens = parseItensPedido(pedido.itens_json);
  const telhas = itensPorGrupo(itens, "telha");

  if (autoTelhasAtivo && telhas.length > 0) {
    const telhasParaRoteamento = itens
      .map((it, idx) => ({ ...it, _idx: idx }))
      .filter((it, idx) => {
        const ehTelha = telhas.some(t => (t._idx != null ? t._idx === idx : t.produto === it.produto));
        return ehTelha && it.status !== "concluido";
      });

    if (telhasParaRoteamento.length > 0) {
      const resAgrupado = await rotearLoteTelhasAgrupadas({
        pedido,
        itensTelhas: telhasParaRoteamento,
        todasBobinas: bobinasEstoque,
        filialAtiva: pedido.unidade || filialAtiva
      });

      const opsConfirmadas = (resAgrupado.opsCriadas || []).filter(op => op?.id);
      // 🛡️ NUNCA FINGIR ENVIO: sem OP confirmada na perfiladeira a OF não é
      // marcada como distribuída — o erro sobe para o PCP avisar o operador.
      if (opsConfirmadas.length === 0) {
        throw new Error(`Nenhuma OP foi criada na perfiladeira (OF ${pedido.of_nome || pedido.numero_pedido}).`);
      }
      telhasAutoRoteadas = telhasParaRoteamento.length;
      bobinasVinculadas = opsConfirmadas.filter(op => op.bobina_superior_id).length;

      Object.entries(resAgrupado.itensAtualizadosMap || {}).forEach(([idxStr, dadosItem]) => {
        const i = Number(idxStr);
        if (itens[i]) {
          itens[i] = { ...itens[i], ...dadosItem };
        }
      });
    }
  }

  const itensDistribuidos = itens.map(it => ({
    ...it,
    status: it.status === "concluido" ? "concluido" : (it.status === "em_producao" ? "em_producao" : "distribuido"),
    distribuido: true
  }));

  // Retry: se a gravação falhar, tenta de novo — a OP já criada não fica órfã
  const atualizado = await comRetry(() => base44.entities.PedidoOdoo.update(pedido.id, {
    itens_json: JSON.stringify(itensDistribuidos),
    status_pcp: "distribuido", percentual_concluido: 15, retirado_manualmente_ts: "",
    historico_log: JSON.stringify(novoLog)
  }));

  // Mini BI — notificação em segundo plano (não trava a interface do operador)
  notificarStatus(atualizado, "distribuido", { status_novo: "distribuido", percentual_concluido: 15 }).catch(() => {});

  return { atualizado, telhasAutoRoteadas, bobinasVinculadas };
}