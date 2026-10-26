import { base44 } from "@/api/base44Client";

/**
 * Normaliza o número de pedido para comparação resiliente:
 * Remove prefixos como '#', 'SO-', 'S0', 'S', zeros à esquerda e caracteres não numéricos.
 * Exemplo: '#S01493' -> '1493', 'SO-283427' -> '283427', '1493' -> '1493'
 */
export function normalizarNumeroPedido(num) {
  if (!num) return "";
  const s = String(num).trim().toUpperCase();
  const semPrefixo = s.replace(/^(SO[-_\s]*|S0*|#)/i, "");
  const semZeros = semPrefixo.replace(/^0+/, "");
  const digitos = semZeros.replace(/\D/g, "");
  return digitos || semZeros || s;
}

/**
 * Verifica se dois números de pedidos são equivalentes
 */
export function numerosSaoEquivalentes(numA, numB) {
  if (!numA || !numB) return false;
  const strA = String(numA).trim().toUpperCase();
  const strB = String(numB).trim().toUpperCase();
  if (strA === strB) return true;
  const normA = normalizarNumeroPedido(strA);
  const normB = normalizarNumeroPedido(strB);
  if (normA && normB && normA === normB) return true;
  return false;
}

/**
 * Verifica se uma OP de máquina (Pedido ou OrdemMaquinaCD) pertence a um PedidoOdoo
 */
export function opPertenceAoPedido(op, pedido) {
  if (!op || !pedido) return false;

  // 1. Vínculo direto por ID único de registro
  if (op.pedido_odoo_id && pedido.id && String(op.pedido_odoo_id) === String(pedido.id)) {
    return true;
  }

  // 2. Vínculo por ID da OF do Odoo
  const ofIdPed = String(pedido.of_odoo_id || pedido.odoo_id || "").trim().toUpperCase();
  const ofIdOp = String(op.of_odoo_id || "").trim().toUpperCase();
  if (ofIdPed && ofIdOp && ofIdPed === ofIdOp) {
    return true;
  }

  // 3. Vínculo por Nome visível da OF (ex: WH/MO/406632)
  const ofNomePed = String(pedido.of_nome || "").trim().toUpperCase();
  const ofNomeOp = String(op.of_nome || "").trim().toUpperCase();
  if (ofNomePed && ofNomeOp && ofNomePed === ofNomeOp) {
    return true;
  }

  // 4. Se a OP pertence comprovadamente a outro pedido_odoo_id diferente, não confunde:
  if (op.pedido_odoo_id && pedido.id && String(op.pedido_odoo_id) !== String(pedido.id)) {
    return false;
  }

  // 5. Comparação normalizada por número de pedido de venda (SO)
  if (pedido.numero_pedido && op.numero_pedido) {
    if (numerosSaoEquivalentes(op.numero_pedido, pedido.numero_pedido)) {
      return true;
    }
  }

  // 6. Comparação por número de OC
  if (pedido.numero_oc && op.numero_oc) {
    if (numerosSaoEquivalentes(op.numero_oc, pedido.numero_oc)) {
      return true;
    }
  }

  return false;
}

/**
 * Finaliza imediatamente todas as OPs locais vinculadas ao pedido (Telhas, C&D e Desbobinador)
 */
export async function finalizarOpsDoPedido({ pedido, todayIso = new Date().toISOString().slice(0, 10), usuario = "Central PCP" }) {
  if (!pedido) return { telhas: 0, cd: 0 };
  let countTelhas = 0;
  let countCD = 0;

  try {
    const numRaw = pedido.numero_pedido;
    const numNorm = normalizarNumeroPedido(numRaw);
    const pedId = pedido.id;

    // Busca ampla de OPs ativas de Telhas
    const filtroTelhas = { status: { $ne: "finalizado" } };
    const todasTelhas = await base44.entities.Pedido.filter(filtroTelhas, "-data", 1000).catch(() => []);
    const telhasDoPedido = todasTelhas.filter(op => op.status !== "cancelado" && opPertenceAoPedido(op, pedido));

    for (const op of telhasDoPedido) {
      try {
        const hist = (() => { try { return JSON.parse(op.historico_alteracoes || "[]"); } catch { return []; } })();
        hist.push({
          data: new Date().toISOString(),
          usuario,
          acao: "finalizado",
          acao_label: "Finalizado via Central PCP",
          detalhes: `Baixa automática disparada pela conclusão do Pedido #${pedido.numero_pedido || pedido.id} no PCP.`
        });

        await base44.entities.Pedido.update(op.id, {
          status: "finalizado",
          data_finalizacao: todayIso,
          historico_alteracoes: JSON.stringify(hist)
        });
        countTelhas++;
      } catch (err) {
        console.warn("[Conciliacao] Erro ao finalizar OP Telha:", op.id, err);
      }
    }

    // Busca ampla de OPs ativas de Corte e Dobra
    const todasCD = await base44.entities.OrdemMaquinaCD.filter({ status: { $ne: "finalizado" } }, "-data", 1000).catch(() => []);
    const cdDoPedido = todasCD.filter(op => op.status !== "cancelado" && opPertenceAoPedido(op, pedido));

    for (const op of cdDoPedido) {
      try {
        await base44.entities.OrdemMaquinaCD.update(op.id, {
          status: "finalizado",
          data_finalizacao: todayIso
        });
        countCD++;
      } catch (err) {
        console.warn("[Conciliacao] Erro ao finalizar OP CD:", op.id, err);
      }
    }

    // Desbobinadeira
    if (base44.entities.OrdemDesbobinadeira) {
      const todasDesb = await base44.entities.OrdemDesbobinadeira.filter({ status: { $ne: "finalizado" } }, "-data", 500).catch(() => []);
      const desbDoPedido = todasDesb.filter(op => op.status !== "cancelado" && opPertenceAoPedido(op, pedido));
      for (const op of desbDoPedido) {
        await base44.entities.OrdemDesbobinadeira.update(op.id, {
          status: "finalizado",
          data_finalizacao: todayIso
        }).catch(() => {});
      }
    }
  } catch (errGeral) {
    console.error("[Conciliacao] Erro em finalizarOpsDoPedido:", errGeral);
  }

  return { telhas: countTelhas, cd: countCD };
}

/**
 * Cancela imediatamente todas as OPs locais vinculadas ao pedido (Telhas, C&D e Desbobinador)
 */
export async function cancelarOpsDoPedido({ pedido, todayIso = new Date().toISOString().slice(0, 10), usuario = "Central PCP", motivo = "" }) {
  if (!pedido) return { telhas: 0, cd: 0 };
  let countTelhas = 0;
  let countCD = 0;

  try {
    // 1. Telhas
    const todasTelhas = await base44.entities.Pedido.filter({ status: { $ne: "cancelado" } }, "-data", 1000).catch(() => []);
    const telhasDoPedido = todasTelhas.filter(op => opPertenceAoPedido(op, pedido));

    for (const op of telhasDoPedido) {
      try {
        const hist = (() => { try { return JSON.parse(op.historico_alteracoes || "[]"); } catch { return []; } })();
        hist.push({
          data: new Date().toISOString(),
          usuario,
          acao: "cancelado",
          acao_label: "Cancelado via Central PCP",
          detalhes: motivo ? `Motivo: ${motivo}` : `Cancelamento sincronizado do Pedido #${pedido.numero_pedido || pedido.id} no PCP.`
        });

        await base44.entities.Pedido.update(op.id, {
          status: "cancelado",
          data_finalizacao: todayIso,
          historico_alteracoes: JSON.stringify(hist)
        });
        countTelhas++;
      } catch (err) {
        console.warn("[Conciliacao] Erro ao cancelar OP Telha:", op.id, err);
      }
    }

    // 2. Corte e Dobra
    const todasCD = await base44.entities.OrdemMaquinaCD.filter({ status: { $ne: "cancelado" } }, "-data", 1000).catch(() => []);
    const cdDoPedido = todasCD.filter(op => opPertenceAoPedido(op, pedido));

    for (const op of cdDoPedido) {
      try {
        await base44.entities.OrdemMaquinaCD.update(op.id, {
          status: "cancelado",
          data_finalizacao: todayIso
        });
        countCD++;
      } catch (err) {
        console.warn("[Conciliacao] Erro ao cancelar OP CD:", op.id, err);
      }
    }

    // 3. Desbobinadeira
    if (base44.entities.OrdemDesbobinadeira) {
      const todasDesb = await base44.entities.OrdemDesbobinadeira.filter({ status: { $ne: "cancelado" } }, "-data", 500).catch(() => []);
      const desbDoPedido = todasDesb.filter(op => opPertenceAoPedido(op, pedido));
      for (const op of desbDoPedido) {
        await base44.entities.OrdemDesbobinadeira.update(op.id, {
          status: "cancelado",
          data_finalizacao: todayIso
        }).catch(() => {});
      }
    }
  } catch (errGeral) {
    console.error("[Conciliacao] Erro em cancelarOpsDoPedido:", errGeral);
  }

  return { telhas: countTelhas, cd: countCD };
}

/**
 * Varredura completa e conciliação em lote:
 * Compara todos os pedidos da Central PCP com as tabelas das máquinas (Pedido e OrdemMaquinaCD).
 * Baixa qualquer OP que já esteja 100% concluída ou cancelada no PCP!
 */
export async function executarVarreduraEConciliacaoGeral({ pedidosPcp = [], queryClient = null, usuario = "Auditoria Automática PCP" }) {
  const resultado = {
    telhasFinalizadas: 0,
    telhasCanceladas: 0,
    cdFinalizadas: 0,
    cdCanceladas: 0,
    totalProcessadas: 0
  };

  try {
    const todayIso = new Date().toISOString().slice(0, 10);

    // Carrega a base atual do PCP se não foi fornecida
    const listaPcp = pedidosPcp && pedidosPcp.length > 0
      ? pedidosPcp
      : await base44.entities.PedidoOdoo.list("-data_recebimento", 5000).catch(() => []);

    if (!listaPcp || listaPcp.length === 0) return resultado;

    // Mapas rápidos de consulta para PCP
    const pcpConcluidos = new Map();
    const pcpCancelados = new Map();

    for (const p of listaPcp) {
      const isConc = p.status_pcp === "concluido" || (p.percentual_concluido != null && p.percentual_concluido >= 100);
      const isCanc = p.status_pcp === "cancelado" || String(p.status || "").toLowerCase() === "cancelado";

      if (isConc) {
        if (p.id) pcpConcluidos.set(`ID_${p.id}`, p);
        if (p.of_odoo_id) pcpConcluidos.set(`OF_${String(p.of_odoo_id).trim().toUpperCase()}`, p);
        if (p.of_nome) pcpConcluidos.set(`OFN_${String(p.of_nome).trim().toUpperCase()}`, p);
        const norm = normalizarNumeroPedido(p.numero_pedido);
        if (norm) pcpConcluidos.set(`NUM_${norm}`, p);
      } else if (isCanc) {
        if (p.id) pcpCancelados.set(`ID_${p.id}`, p);
        if (p.of_odoo_id) pcpCancelados.set(`OF_${String(p.of_odoo_id).trim().toUpperCase()}`, p);
        if (p.of_nome) pcpCancelados.set(`OFN_${String(p.of_nome).trim().toUpperCase()}`, p);
        const norm = normalizarNumeroPedido(p.numero_pedido);
        if (norm) pcpCancelados.set(`NUM_${norm}`, p);
      }
    }

    // ── 1. VARREDURA EM FÁBRICA DE TELHAS (Entidade: Pedido) ──
    const todasOpsTelhas = await base44.entities.Pedido.list("-data", 5000).catch(() => []);
    const promessasTelhas = [];

    for (const op of todasOpsTelhas) {
      if (!op || op.status === "finalizado" || op.status === "cancelado") continue;

      const normOp = normalizarNumeroPedido(op.numero_pedido);
      const ofIdOp = String(op.of_odoo_id || "").trim().toUpperCase();
      const ofNomeOp = String(op.of_nome || "").trim().toUpperCase();
      const pedIdOp = op.pedido_odoo_id ? `ID_${op.pedido_odoo_id}` : null;

      // Checa se está concluído no PCP
      const pedPcpConcluido = (pedIdOp && pcpConcluidos.get(pedIdOp))
        || (ofIdOp && pcpConcluidos.get(`OF_${ofIdOp}`))
        || (ofNomeOp && pcpConcluidos.get(`OFN_${ofNomeOp}`))
        || (normOp && pcpConcluidos.get(`NUM_${normOp}`));

      if (pedPcpConcluido) {
        promessasTelhas.push(
          (async () => {
            try {
              const hist = (() => { try { return JSON.parse(op.historico_alteracoes || "[]"); } catch { return []; } })();
              hist.push({
                data: new Date().toISOString(),
                usuario,
                acao: "finalizado",
                acao_label: "Conciliação Automática PCP",
                detalhes: `Baixa automática: Pedido #${pedPcpConcluido.numero_pedido || op.numero_pedido} já está 100% concluído na Central PCP.`
              });
              await base44.entities.Pedido.update(op.id, {
                status: "finalizado",
                data_finalizacao: todayIso,
                historico_alteracoes: JSON.stringify(hist)
              });
              resultado.telhasFinalizadas++;
            } catch (e) {
              console.warn("[Varredura Telhas] Erro ao finalizar OP:", op.id, e);
            }
          })()
        );
        continue;
      }

      // Checa se está cancelado no PCP
      const pedPcpCancelado = (pedIdOp && pcpCancelados.get(pedIdOp))
        || (ofIdOp && pcpCancelados.get(`OF_${ofIdOp}`))
        || (ofNomeOp && pcpCancelados.get(`OFN_${ofNomeOp}`))
        || (normOp && pcpCancelados.get(`NUM_${normOp}`));

      if (pedPcpCancelado) {
        promessasTelhas.push(
          (async () => {
            try {
              const hist = (() => { try { return JSON.parse(op.historico_alteracoes || "[]"); } catch { return []; } })();
              hist.push({
                data: new Date().toISOString(),
                usuario,
                acao: "cancelado",
                acao_label: "Conciliação Automática PCP",
                detalhes: `Cancelamento automático: Pedido #${pedPcpCancelado.numero_pedido || op.numero_pedido} cancelado na Central PCP.`
              });
              await base44.entities.Pedido.update(op.id, {
                status: "cancelado",
                data_finalizacao: todayIso,
                historico_alteracoes: JSON.stringify(hist)
              });
              resultado.telhasCanceladas++;
            } catch (e) {
              console.warn("[Varredura Telhas] Erro ao cancelar OP:", op.id, e);
            }
          })()
        );
      }
    }

    // ── 2. VARREDURA EM CORTE E DOBRA (Entidade: OrdemMaquinaCD) ──
    const todasOpsCD = await base44.entities.OrdemMaquinaCD.list("-data", 5000).catch(() => []);
    const promessasCD = [];

    for (const op of todasOpsCD) {
      if (!op || op.status === "finalizado" || op.status === "cancelado") continue;

      const normOp = normalizarNumeroPedido(op.numero_pedido);
      const ofIdOp = String(op.of_odoo_id || "").trim().toUpperCase();
      const ofNomeOp = String(op.of_nome || "").trim().toUpperCase();
      const pedIdOp = op.pedido_odoo_id ? `ID_${op.pedido_odoo_id}` : null;

      // Checa se está concluído no PCP
      const pedPcpConcluido = (pedIdOp && pcpConcluidos.get(pedIdOp))
        || (ofIdOp && pcpConcluidos.get(`OF_${ofIdOp}`))
        || (ofNomeOp && pcpConcluidos.get(`OFN_${ofNomeOp}`))
        || (normOp && pcpConcluidos.get(`NUM_${normOp}`));

      if (pedPcpConcluido) {
        promessasCD.push(
          (async () => {
            try {
              await base44.entities.OrdemMaquinaCD.update(op.id, {
                status: "finalizado",
                data_finalizacao: todayIso
              });
              resultado.cdFinalizadas++;
            } catch (e) {
              console.warn("[Varredura CD] Erro ao finalizar OP:", op.id, e);
            }
          })()
        );
        continue;
      }

      // Checa se está cancelado no PCP
      const pedPcpCancelado = (pedIdOp && pcpCancelados.get(pedIdOp))
        || (ofIdOp && pcpCancelados.get(`OF_${ofIdOp}`))
        || (ofNomeOp && pcpCancelados.get(`OFN_${ofNomeOp}`))
        || (normOp && pcpCancelados.get(`NUM_${normOp}`));

      if (pedPcpCancelado) {
        promessasCD.push(
          (async () => {
            try {
              await base44.entities.OrdemMaquinaCD.update(op.id, {
                status: "cancelado",
                data_finalizacao: todayIso
              });
              resultado.cdCanceladas++;
            } catch (e) {
              console.warn("[Varredura CD] Erro ao cancelar OP:", op.id, e);
            }
          })()
        );
      }
    }

    // Aguarda execução em lotes
    await Promise.allSettled([...promessasTelhas, ...promessasCD]);
    resultado.totalProcessadas = resultado.telhasFinalizadas + resultado.telhasCanceladas + resultado.cdFinalizadas + resultado.cdCanceladas;

    if (queryClient && resultado.totalProcessadas > 0) {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    }
  } catch (err) {
    console.error("[Varredura Conciliação Geral] Falha:", err);
  }

  return resultado;
}
