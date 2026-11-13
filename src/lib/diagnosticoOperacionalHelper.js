import { base44 } from "@/api/base44Client";
import { normalizarNumeroPedido } from "@/lib/conciliacaoPcpMaquinasHelper";
import { toast } from "sonner";

/**
 * Normaliza textos e modelos para comparação precisa
 */
function normalizarTexto(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Verifica se um produto é uma Telha Simples pura (não vai para Colagem)
 */
export function ehTelhaSimplesPura(pedido) {
  if (!pedido) return false;
  const prod = normalizarTexto(pedido.produto);
  const modelo = normalizarTexto(pedido.modelo || pedido.item_produto || "");
  const obs = normalizarTexto(pedido.observacoes_odoo || pedido.observacoes || "");
  const rotulo = normalizarTexto(pedido.produto_rotulo_pcp || "");
  const textoCompleto = `${prod} ${modelo} ${obs} ${rotulo}`;

  const ehTelha = prod.includes("telha") || textoCompleto.includes("telha");
  const temIsolamento =
    Boolean(pedido.eps) ||
    /\b(eps|isopor|sanduiche|sanduiche|manta|bandeja|pir|pur|termoacustica|termoacustico|semi[- ]?sanduiche)\b/i.test(textoCompleto);

  return ehTelha && !temIsolamento;
}

/**
 * Executa uma análise diagnóstica 360° em tempo real sobre os pedidos do PCP e OPs das máquinas
 */
export async function rodarDiagnosticoOperacional({ pedidosPcp = [] } = {}) {
  const diagnostico = {
    timestamp: new Date().toISOString(),
    totalPedidosAnalisados: 0,
    totalDuplicadosPcp: 0,
    totalDuplicadosChaoFabrica: 0,
    totalDuplicadosGeral: 0,
    indiceDuplicados: 0, // %
    totalDescompassoColagem: 0,
    totalDescompassoMaquinas: 0,
    totalDescompassoGeral: 0,
    indiceDescompasso: 0, // %
    scoreIntegridade: 100, // %
    totalInconsistencias: 0,
    listaInconsistencias: [],
    resumoPorTipo: {
      duplicado_pcp: 0,
      duplicado_maquina: 0,
      descompasso_colagem: 0,
      op_fantasma: 0,
      finalizado_preso_pcp: 0
    }
  };

  try {
    // 1. Obter pedidos do PCP caso não tenham sido passados
    let listaPcp = pedidosPcp;
    if (!listaPcp || listaPcp.length === 0) {
      listaPcp = await base44.entities.PedidoOdoo.list("-data_recebimento", 1500).catch(() => []);
    }

    // 2. Obter ordens de chão de fábrica (Telhas, C&D e Desbobinadeira)
    const [opsTelhas, opsCD, opsDesbob] = await Promise.all([
      base44.entities.Pedido.list("-data", 1000).catch(() => []),
      base44.entities.OrdemMaquinaCD.list("-data", 1000).catch(() => []),
      base44.entities.OrdemDesbobinadeira.list("-data", 500).catch(() => [])
    ]);

    diagnostico.totalPedidosAnalisados = listaPcp.length;
    if (listaPcp.length === 0) return diagnostico;

    // Mapas para cruzamento rápido de chão de fábrica
    const opsAtivasTelhasPorNum = new Map();
    const todasOpsTelhasPorNum = new Map();
    (opsTelhas || []).forEach(op => {
      const num = normalizarNumeroPedido(op.numero_pedido);
      if (!num) return;
      if (!todasOpsTelhasPorNum.has(num)) todasOpsTelhasPorNum.set(num, []);
      todasOpsTelhasPorNum.get(num).push(op);

      const status = String(op.status || "").toLowerCase();
      if (status !== "cancelado") {
        if (!opsAtivasTelhasPorNum.has(num)) opsAtivasTelhasPorNum.set(num, []);
        opsAtivasTelhasPorNum.get(num).push(op);
      }
    });

    const opsAtivasCDPorNum = new Map();
    (opsCD || []).forEach(op => {
      const num = normalizarNumeroPedido(op.numero_pedido);
      if (!num) return;
      const status = String(op.status || "").toLowerCase();
      if (status !== "cancelado") {
        if (!opsAtivasCDPorNum.has(num)) opsAtivasCDPorNum.set(num, []);
        opsAtivasCDPorNum.get(num).push(op);
      }
    });

    // ─────────────────────────────────────────────────────────────
    // TESTE 1: DUPLICIDADES NO PCP (Mesma OF ou mesmo Nº de Pedido duplicado)
    // ─────────────────────────────────────────────────────────────
    const mapaPcpPorNumero = new Map();
    const mapaPcpPorOF = new Map();

    listaPcp.forEach(p => {
      const num = normalizarNumeroPedido(p.numero_pedido);
      const of = String(p.of_nome || p.of_odoo_id || "").trim().toUpperCase();

      if (num) {
        if (!mapaPcpPorNumero.has(num)) mapaPcpPorNumero.set(num, []);
        mapaPcpPorNumero.get(num).push(p);
      }
      if (of && of !== "—" && of !== "SEMOF") {
        if (!mapaPcpPorOF.has(of)) mapaPcpPorOF.set(of, []);
        mapaPcpPorOF.get(of).push(p);
      }
    });

    const idsRegistradosDuplicados = new Set();

    // Checar duplicidades exatas de OF
    mapaPcpPorOF.forEach((pedidos, of) => {
      if (pedidos.length > 1) {
        // Mesma OF importada mais de uma vez
        pedidos.slice(1).forEach(p => {
          if (!idsRegistradosDuplicados.has(p.id)) {
            idsRegistradosDuplicados.add(p.id);
            diagnostico.listaInconsistencias.push({
              id: `dup_of_${p.id}`,
              pedidoId: p.id,
              numeroPedido: p.numero_pedido,
              ofNome: of,
              cliente: p.cliente_nome || "Cliente",
              vendedor: p.vendedor_nome || "—",
              tipo: "duplicado_pcp",
              categoria: "Duplicidade de Importação",
              criticidade: "alta",
              descricao: `OF ${of} importada ${pedidos.length} vezes no PCP (registro repetido)`,
              ondeDizEstar: p.status || "Fila PCP",
              situacaoReal: `Existe outro registro ativo com mesmo código de OF (${pedidos[0].id})`,
              acaoSugerida: "Remover registro duplicado e manter o original",
              entidade: "PedidoOdoo",
              dadosOriginal: p
            });
            diagnostico.resumoPorTipo.duplicado_pcp++;
          }
        });
      }
    });

    // Checar pedidos com mesmo número e produtos/metragens 100% idênticas
    mapaPcpPorNumero.forEach((pedidos, num) => {
      if (pedidos.length > 1) {
        const porAssinatura = new Map();
        pedidos.forEach(p => {
          const itens = Array.isArray(p.itens) ? p.itens : [];
          const sig = `${p.cliente_nome}_${p.largura_mm || p.largura}_${itens.length}_${itens.map(i => `${i.comprimento || i.tamanho}_${i.quantidade}`).join("|")}`;
          if (!porAssinatura.has(sig)) porAssinatura.set(sig, []);
          porAssinatura.get(sig).push(p);
        });

        porAssinatura.forEach((grupo, sig) => {
          if (grupo.length > 1 && sig.length > 5) {
            grupo.slice(1).forEach(p => {
              if (!idsRegistradosDuplicados.has(p.id)) {
                idsRegistradosDuplicados.add(p.id);
                diagnostico.listaInconsistencias.push({
                  id: `dup_num_${p.id}`,
                  pedidoId: p.id,
                  numeroPedido: p.numero_pedido,
                  ofNome: p.of_nome || "—",
                  cliente: p.cliente_nome || "Cliente",
                  vendedor: p.vendedor_nome || "—",
                  tipo: "duplicado_pcp",
                  categoria: "Duplicidade de Pedido",
                  criticidade: "alta",
                  descricao: `Pedido #${p.numero_pedido} com mesmos itens e cliente duplicado na fila`,
                  ondeDizEstar: p.status || "Fila PCP",
                  situacaoReal: `Duplicidade detectada com ID ${grupo[0].id}`,
                  acaoSugerida: "Consolidar ou cancelar a cópia duplicada",
                  entidade: "PedidoOdoo",
                  dadosOriginal: p
                });
                diagnostico.resumoPorTipo.duplicado_pcp++;
              }
            });
          }
        });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // TESTE 2: DUPLICIDADES NO CHÃO DE FÁBRICA (Mesmo pedido em 2 OPs ativas na mesma máquina)
    // ─────────────────────────────────────────────────────────────
    opsAtivasTelhasPorNum.forEach((ops, num) => {
      const porMaquina = new Map();
      ops.forEach(op => {
        const m = String(op.maquina || "").trim().toUpperCase();
        if (!m) return;
        if (!porMaquina.has(m)) porMaquina.set(m, []);
        porMaquina.get(m).push(op);
      });

      porMaquina.forEach((listaOps, maquina) => {
        // Se tem 2 ou mais OPs não-finalizadas e não-canceladas na mesma máquina para o mesmo número
        const ativas = listaOps.filter(o => o.status !== "finalizado" && o.status !== "cancelado");
        if (ativas.length > 1) {
          ativas.slice(1).forEach(opDuplicada => {
            diagnostico.listaInconsistencias.push({
              id: `dup_op_${opDuplicada.id}`,
              opId: opDuplicada.id,
              numeroPedido: opDuplicada.numero_pedido,
              cliente: opDuplicada.cliente || "Cliente",
              tipo: "duplicado_maquina",
              categoria: "OP Duplicada no Chão",
              criticidade: "media",
              descricao: `Máquina ${maquina} possui ${ativas.length} ordens ativas para o Pedido #${opDuplicada.numero_pedido}`,
              ondeDizEstar: `Máquina ${maquina}`,
              situacaoReal: `Ordem duplicada no chão de fábrica gerando risco de corte duplo`,
              acaoSugerida: "Cancelar OP excedente na máquina",
              entidade: "Pedido",
              dadosOriginal: opDuplicada
            });
            diagnostico.resumoPorTipo.duplicado_maquina++;
          });
        }
      });
    });

    // ─────────────────────────────────────────────────────────────
    // TESTE 3: DESCOMPASSO NA COLAGEM (Telha simples pura ou presa indevidamente)
    // ─────────────────────────────────────────────────────────────
    listaPcp.forEach(p => {
      const num = normalizarNumeroPedido(p.numero_pedido);
      const statusPcp = String(p.status || "").toLowerCase();
      const ondeEsta = String(p.onde_esta || p.maquina || "").toUpperCase();

      // Caso 3.1: Telha simples pura que foi parar na Colagem
      const ehSimples = ehTelhaSimplesPura(p);
      const estaApontadoColagem =
        statusPcp === "aguardando_colagem" ||
        ondeEsta.includes("COLAGEM") ||
        p.maquina === "COLAGEM";

      if (ehSimples && estaApontadoColagem) {
        diagnostico.listaInconsistencias.push({
          id: `desc_col_${p.id}`,
          pedidoId: p.id,
          numeroPedido: p.numero_pedido,
          cliente: p.cliente_nome || "Cliente",
          vendedor: p.vendedor_nome || "—",
          tipo: "descompasso_colagem",
          categoria: "Erro na Colagem",
          criticidade: "alta",
          descricao: `Telha simples pura (sem EPS/sanduíche) direcionada à Colagem`,
          ondeDizEstar: "Fila da Colagem / Aguardando Colagem",
          situacaoReal: "Produto simples não requer processo de colagem",
          acaoSugerida: "Remover da Colagem e direcionar apenas para a perfiladeira correspondente",
          entidade: "PedidoOdoo",
          dadosOriginal: p
        });
        diagnostico.resumoPorTipo.descompasso_colagem++;
      }

      // Caso 3.2: OP de chão de fábrica marcada na Colagem para telha simples
      const opsTelhaDeste = opsAtivasTelhasPorNum.get(num) || [];
      opsTelhaDeste.forEach(op => {
        if (op.maquina === "COLAGEM" || op.status === "aguardando_colagem") {
          if (ehSimples) {
            diagnostico.listaInconsistencias.push({
              id: `desc_op_col_${op.id}`,
              opId: op.id,
              numeroPedido: op.numero_pedido,
              cliente: op.cliente || p.cliente_nome || "Cliente",
              tipo: "descompasso_colagem",
              categoria: "Erro na Colagem",
              criticidade: "alta",
              descricao: `OP no chão de fábrica apontada para COLAGEM em telha simples`,
              ondeDizEstar: "Painel da Colagem",
              situacaoReal: "Ordem simples aberta na colagem indevidamente",
              acaoSugerida: "Ajustar máquina para TP-40/TP-25 e liberar colagem",
              entidade: "Pedido",
              dadosOriginal: op
            });
            diagnostico.resumoPorTipo.descompasso_colagem++;
          }
        }
      });
    });

    // ─────────────────────────────────────────────────────────────
    // TESTE 4: PEDIDO QUE DIZ QUE ESTÁ NA MÁQUINA MAS NÃO ESTÁ (OP Fantasma / Não existe)
    // ─────────────────────────────────────────────────────────────
    listaPcp.forEach(p => {
      const num = normalizarNumeroPedido(p.numero_pedido);
      const statusPcp = String(p.status || "").toLowerCase();
      const ondeEsta = String(p.onde_esta || "").toUpperCase();

      // Se o PCP diz que o pedido está na máquina ou em produção:
      const pcpDizNaMaquina =
        statusPcp === "em_producao" ||
        statusPcp === "distribuido" ||
        ondeEsta.includes("MÁQUINA") ||
        ondeEsta.includes("GALPÃO") ||
        ondeEsta.includes("PRODUÇÃO");

      if (pcpDizNaMaquina && num) {
        const opsTelhasDeste = opsAtivasTelhasPorNum.get(num) || [];
        const opsCdDeste = opsAtivasCDPorNum.get(num) || [];
        const totalOpsAtivas = opsTelhasDeste.length + opsCdDeste.length;

        // Se no chão de fábrica não tem NENHUMA OP ativa:
        if (totalOpsAtivas === 0) {
          const todasOps = todasOpsTelhasPorNum.get(num) || [];
          const foiCancelada = todasOps.some(o => o.status === "cancelado");
          const foiFinalizada = todasOps.some(o => o.status === "finalizado");

          diagnostico.listaInconsistencias.push({
            id: `fantasma_${p.id}`,
            pedidoId: p.id,
            numeroPedido: p.numero_pedido,
            cliente: p.cliente_nome || "Cliente",
            vendedor: p.vendedor_nome || "—",
            tipo: "op_fantasma",
            categoria: "Máquina Fantasma / Descompasso",
            criticidade: "media",
            descricao: foiFinalizada
              ? `PCP diz 'Na Máquina', mas a OP já foi 100% finalizada na fábrica`
              : foiCancelada
              ? `PCP diz 'Na Máquina', mas a OP foi cancelada no chão`
              : `PCP diz 'Na Máquina / Em Produção', mas não há nenhuma OP aberta nas máquinas`,
            ondeDizEstar: p.onde_esta || "Fila de Produção (Galpão)",
            situacaoReal: foiFinalizada ? "Produção Concluída no Chão" : "Nenhuma OP ativa encontrada",
            acaoSugerida: foiFinalizada
              ? "Marcar pedido como concluído no PCP"
              : "Retornar pedido para 'Pendente para Distribuição'",
            entidade: "PedidoOdoo",
            dadosOriginal: p
          });
          diagnostico.resumoPorTipo.op_fantasma++;
        }
      }
    });

    // ─────────────────────────────────────────────────────────────
    // CONSOLIDAÇÃO DOS ÍNDICES
    // ─────────────────────────────────────────────────────────────
    diagnostico.totalDuplicadosPcp = diagnostico.resumoPorTipo.duplicado_pcp;
    diagnostico.totalDuplicadosChaoFabrica = diagnostico.resumoPorTipo.duplicado_maquina;
    diagnostico.totalDuplicadosGeral =
      diagnostico.totalDuplicadosPcp + diagnostico.totalDuplicadosChaoFabrica;

    diagnostico.totalDescompassoColagem = diagnostico.resumoPorTipo.descompasso_colagem;
    diagnostico.totalDescompassoMaquinas = diagnostico.resumoPorTipo.op_fantasma;
    diagnostico.totalDescompassoGeral =
      diagnostico.totalDescompassoColagem + diagnostico.totalDescompassoMaquinas;

    diagnostico.totalInconsistencias = diagnostico.listaInconsistencias.length;

    // Cálculo percentual com 1 casa decimal
    if (diagnostico.totalPedidosAnalisados > 0) {
      diagnostico.indiceDuplicados = Number(
        ((diagnostico.totalDuplicadosGeral / diagnostico.totalPedidosAnalisados) * 100).toFixed(1)
      );
      diagnostico.indiceDescompasso = Number(
        ((diagnostico.totalDescompassoGeral / diagnostico.totalPedidosAnalisados) * 100).toFixed(1)
      );
    }

    // Score de Integridade (100% menos penalidades)
    const penalidadeDuplicados = Math.min(40, diagnostico.totalDuplicadosGeral * 3);
    const penalidadeDescompasso = Math.min(40, diagnostico.totalDescompassoGeral * 2.5);
    diagnostico.scoreIntegridade = Math.max(0, 100 - penalidadeDuplicados - penalidadeDescompasso);

  } catch (err) {
    console.error("Erro ao rodar diagnóstico operacional:", err);
  }

  return diagnostico;
}

/**
 * Corrige uma inconsistência específica identificada pelo diagnóstico
 */
export async function corrigirInconsistenciaOperacional({ item, queryClient, usuario = "PCP" }) {
  if (!item) return { sucesso: false, erro: "Item inválido" };

  try {
    const todayIso = new Date().toISOString().slice(0, 10);

    // 1. DUPLICADO NO PCP: Remove registro duplicado mantendo histórico
    if (item.tipo === "duplicado_pcp" && item.pedidoId) {
      await base44.entities.PedidoOdoo.update(item.pedidoId, {
        status: "cancelado",
        motivo_cancelamento: `Cancelado via Diagnóstico Operacional: Pedido Duplicado (#${item.numeroPedido}) por ${usuario}`,
        data_cancelamento: todayIso
      });
      toast.success(`Pedido duplicado #${item.numeroPedido} cancelado no PCP com sucesso.`);
    }

    // 2. DUPLICADO NA MÁQUINA: Cancela OP excedente
    else if (item.tipo === "duplicado_maquina" && item.opId) {
      await base44.entities.Pedido.update(item.opId, {
        status: "cancelado",
        observacoes: `OP cancelada via Diagnóstico Operacional: Duplicidade na máquina por ${usuario}`
      });
      toast.success(`OP duplicada #${item.numeroPedido} cancelada na máquina com sucesso.`);
    }

    // 3. DESCOMPASSO NA COLAGEM: Ajusta telha simples removendo bloqueio de colagem
    else if (item.tipo === "descompasso_colagem") {
      if (item.pedidoId) {
        await base44.entities.PedidoOdoo.update(item.pedidoId, {
          status: "aguardando_distribuicao",
          onde_esta: "Mesa PCP (Pendente)",
          maquina: null,
          bloqueado_colagem: false
        });
      }
      if (item.opId) {
        await base44.entities.Pedido.update(item.opId, {
          maquina: "TP - 40",
          status: "pendente",
          bloqueado_colagem: false
        });
      }
      toast.success(`Pedido #${item.numeroPedido} removido da Colagem e reajustado com sucesso.`);
    }

    // 4. OP FANTASMA / STATUS DESCOMPASSADO
    else if (item.tipo === "op_fantasma" && item.pedidoId) {
      if (item.situacaoReal.includes("Concluída")) {
        // Se já foi finalizada no chão, finaliza no PCP
        await base44.entities.PedidoOdoo.update(item.pedidoId, {
          status: "concluido",
          percentual_concluido: 100,
          onde_esta: "Expedição / Concluído",
          data_conclusao: todayIso
        });
        toast.success(`Pedido #${item.numeroPedido} marcado como concluído no PCP.`);
      } else {
        // Se a OP sumiu ou foi cancelada, devolve para pendente de distribuição
        await base44.entities.PedidoOdoo.update(item.pedidoId, {
          status: "aguardando_distribuicao",
          onde_esta: "Mesa PCP (Pendente)",
          maquina: null
        });
        toast.success(`Pedido #${item.numeroPedido} retornado para Fila Pendente no PCP.`);
      }
    }

    // Invalidar caches para atualizar telas
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"] });
    }

    return { sucesso: true };
  } catch (err) {
    console.error("Erro ao corrigir inconsistência:", err);
    toast.error(`Falha ao corrigir pedido #${item.numeroPedido}: ${err.message}`);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Executa auto-correção em lote de todas as inconsistências identificadas
 */
export async function autoCorrigirTodasInconsistencias({ listaInconsistencias = [], queryClient, usuario = "PCP" }) {
  if (!listaInconsistencias || listaInconsistencias.length === 0) {
    return { total: 0, sucessos: 0 };
  }

  let sucessos = 0;
  for (const item of listaInconsistencias) {
    const res = await corrigirInconsistenciaOperacional({ item, queryClient: null, usuario });
    if (res.sucesso) sucessos++;
  }

  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
    queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"] });
  }

  return { total: listaInconsistencias.length, sucessos };
}
