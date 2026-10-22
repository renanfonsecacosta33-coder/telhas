import { base44 } from "@/api/base44Client";
import { parseItensPedido } from "@/lib/regrasFabrica";
import { itensPorGrupo } from "@/lib/pedidoOdooHelper";
import { isAutoRoteamentoTelhasAtivo, rotearLoteTelhasAgrupadas } from "@/lib/autoBobinaTelhasHelper";
import { notificarStatus } from "@/lib/biNotificador";

// Número de pedidos processados simultaneamente na distribuição em lote
const CONCORRENCIA = 5;

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
      ? await base44.entities.Pedido.filter({ pedido_odoo_id: { $in: idsPedidos } })
      : [];
    for (const op of todasOps || []) {
      if (String(op.status || "").toLowerCase() === "cancelado") continue;
      if (!opsPorPedido.has(op.pedido_odoo_id)) opsPorPedido.set(op.pedido_odoo_id, []);
      opsPorPedido.get(op.pedido_odoo_id).push(op);
    }
    // Fallback por numero_pedido apenas para pedidos sem OP encontrada por ID
    const faltantes = alvo.filter(p => !opsPorPedido.has(p.id) && p.numero_pedido);
    if (faltantes.length > 0) {
      const opsPorNumero = await base44.entities.Pedido.filter({ numero_pedido: { $in: faltantes.map(p => p.numero_pedido) } });
      const porNumero = new Map();
      for (const op of opsPorNumero || []) {
        if (String(op.status || "").toLowerCase() === "cancelado") continue;
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
  if (!pedidos || pedidos.length === 0) return { sucesso: 0, telhasCount: 0, preservadosManual: 0, falhas: 0 };

  const autoTelhasAtivo = isAutoRoteamentoTelhasAtivo();
  const alvo = pedidos.filter(ped => !(opcoes.pularDevolvidosManualmente && ped.retirado_manualmente_ts));
  const preservadosManual = pedidos.length - alvo.length;

  let sucesso = 0;
  let telhasCount = 0;
  let falhas = 0;

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
          try {
            const resAgrupado = await rotearLoteTelhasAgrupadas({
              pedido: ped,
              itensTelhas: telhasParaRoteamento,
              todasBobinas: bobinasEstoque,
              filialAtiva: ped.unidade || filialAtiva,
              // ── OTIMIZAÇÃO 2: OPs já pré-buscadas em massa (sem filtro por grupo) ──
              opsExistentesPre: opsPorPedido.has(ped.id) ? opsPorPedido.get(ped.id) : null
            });

            telhasCount += telhasParaRoteamento.length;

            Object.entries(resAgrupado.itensAtualizadosMap || {}).forEach(([idxStr, dadosItem]) => {
              const i = Number(idxStr);
              if (itens[i]) {
                itens[i] = { ...itens[i], ...dadosItem };
              }
            });
          } catch (errAuto) {
            console.warn("[DistribuicaoLote] Falha no auto-roteamento de telha:", errAuto);
          }
        }
      }

      const itensDistribuidos = itens.map(it => ({ ...it, status: it.status === "concluido" ? "concluido" : (it.status === "em_producao" ? "em_producao" : "distribuido"), distribuido: true }));

      const logExistente = (() => { try { return JSON.parse(ped.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: "distribuicao_lote",
        detalhes: autoTelhasAtivo
          ? "Pedido distribuído em lote com Piloto Automático de Telhas direto para as perfiladeiras."
          : "Pedido distribuído em lote para os galpões de produção (Telhas, C&D e Frisada)."
      }];

      const atualizado = await base44.entities.PedidoOdoo.update(ped.id, {
        itens_json: JSON.stringify(itensDistribuidos),
        status_pcp: "distribuido", percentual_concluido: 15, retirado_manualmente_ts: "",
        historico_log: JSON.stringify(novoLog)
      });

      // Notificação em segundo plano sem bloquear o lote
      notificarStatus(atualizado, "distribuido", { status_novo: "distribuido", percentual_concluido: 15 }).catch(() => {});
      sucesso++;
    } catch (err) {
      falhas++;
      console.error("[DistribuicaoLote] falha ao distribuir pedido:", ped.numero_pedido, err);
    }
  };

  // ── OTIMIZAÇÃO 3: pool de concorrência em vez de loop serial ──
  let idx = 0;
  const worker = async () => {
    while (idx < alvo.length) {
      const ped = alvo[idx++];
      await processarPedido(ped);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA, Math.max(alvo.length, 1)) }, worker)
  );

  return { sucesso, telhasCount, preservadosManual, falhas };
}