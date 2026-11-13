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
 * Formata data/hora para exibição legível
 */
export function formatarDataHora(dataIso) {
  if (!dataIso) return "—";
  try {
    const d = new Date(dataIso);
    if (isNaN(d.getTime())) return String(dataIso).slice(0, 16);
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return String(dataIso).slice(0, 16);
  }
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
    /\b(eps|isopor|sanduiche|sanduíche|manta|bandeja|pir|pur|termoacustica|termoacústica|semi[- ]?sanduiche)\b/i.test(textoCompleto);

  return ehTelha && !temIsolamento;
}

/**
 * Identifica o setor do pedido (Telha ou Corte e Dobra)
 */
export function detectarSetorPedido(p) {
  if (!p) return "telha";
  if (p.setor === "corte_dobra" || p.setor === "cd") return "cd";
  const str = normalizarTexto(`${p.produto || ""} ${p.modelo || ""} ${p.item_produto || ""} ${p.observacoes || ""}`);
  if (/\b(dobra|dobradeira|guilhotina|desbobinadeira|chapa|perfil dobrado|rufo|calha)\b/i.test(str)) {
    return "cd";
  }
  return "telha";
}

/**
 * Gera uma assinatura física estrita da peça para saber se são rigorosamente iguais
 */
function extrairAssinaturaPeca(op) {
  const comp = parseFloat(String(op.comprimento || op.tamanho || op.medida || "0").replace(",", ".")) || 0;
  const qtd = parseInt(String(op.quantidade || op.pecas || op.qtd || "0"), 10) || 0;
  const esp = String(op.espessura || op.chapa || "").trim().replace(",", ".");
  const mod = normalizarTexto(op.modelo || op.produto || op.tipo || "");
  return `${comp.toFixed(2)}m_${qtd}pcs_${esp}mm_${mod}`;
}

/**
 * Executa uma análise diagnóstica 360° em tempo real sobre os pedidos do PCP e OPs das máquinas
 * COM A REGRA ESTRITA DE DUPLICIDADE (ignora itens diferentes de um mesmo pedido).
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
    // TESTE 1: DUPLICIDADES NO PCP (Apenas código individual da OF repetido)
    // ─────────────────────────────────────────────────────────────
    const mapaPcpPorOF = new Map();
    const idsRegistradosDuplicados = new Set();

    listaPcp.forEach(p => {
      const of = String(p.of_nome || p.of_odoo_id || "").trim().toUpperCase();
      if (of && of !== "—" && of !== "SEMOF" && of !== "UNDEFINED" && of.length > 3) {
        if (!mapaPcpPorOF.has(of)) mapaPcpPorOF.set(of, []);
        mapaPcpPorOF.get(of).push(p);
      }
    });

    // Checar duplicidades estritas por código individual de OF
    mapaPcpPorOF.forEach((pedidos, of) => {
      // Filtra apenas registros ativos (não cancelados)
      const ativos = pedidos.filter(p => String(p.status || "").toLowerCase() !== "cancelado");
      if (ativos.length > 1) {
        const original = ativos[0];
        ativos.slice(1).forEach(duplicado => {
          if (!idsRegistradosDuplicados.has(duplicado.id)) {
            idsRegistradosDuplicados.add(duplicado.id);
            const setor = detectarSetorPedido(duplicado);
            const loja = duplicado.unidade || duplicado.filial || "Matriz AJL";
            const dataChegada = formatarDataHora(duplicado.data_recebimento || duplicado.created_date);

            diagnostico.listaInconsistencias.push({
              id: `dup_of_${duplicado.id}`,
              pedidoId: duplicado.id,
              numeroPedido: duplicado.numero_pedido,
              ofNome: of,
              codigoIndividual: of,
              cliente: duplicado.cliente_nome || "Cliente",
              vendedor: duplicado.vendedor_nome || "—",
              setor,
              loja,
              dataChegada,
              tipo: "duplicado_pcp",
              categoria: "Duplicidade de OF no PCP",
              criticidade: "alta",
              descricao: `Código individual de OF repetido: ${of}`,
              motivoExato: `O código individual da OF (${of}) foi importado ${ativos.length} vezes na fila do PCP com o mesmo cliente e produtos.`,
              ondeDizEstar: duplicado.status || "Fila PCP",
              situacaoReal: `Existe outro registro ativo idêntico (ID ${original.id}) mantido como original.`,
              acaoSugerida: "Cancelar esta cópia excedente mantendo o registro original",
              entidade: "PedidoOdoo",
              ordemOriginal: original,
              ordemDuplicada: duplicado,
              dadosOriginal: duplicado
            });
            diagnostico.resumoPorTipo.duplicado_pcp++;
          }
        });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // TESTE 2: DUPLICIDADES NO CHÃO DE FÁBRICA (REGRA ESTRITA)
    // Mesma máquina com exatamente o mesmo produto, medida e quantidade gerados em dobro!
    // ─────────────────────────────────────────────────────────────
    opsAtivasTelhasPorNum.forEach((ops, num) => {
      // Agrupa por máquina
      const porMaquina = new Map();
      ops.forEach(op => {
        const m = String(op.maquina || "").trim().toUpperCase();
        if (!m) return;
        if (!porMaquina.has(m)) porMaquina.set(m, []);
        porMaquina.get(m).push(op);
      });

      porMaquina.forEach((listaOps, maquina) => {
        // Apenas ordens ativas
        const ativas = listaOps.filter(o => o.status !== "finalizado" && o.status !== "cancelado");
        if (ativas.length > 1) {
          // Agrupa por assinatura física estrita da peça: (comprimento + quantidade + espessura + modelo)
          const porAssinatura = new Map();
          ativas.forEach(op => {
            const sig = extrairAssinaturaPeca(op);
            if (!porAssinatura.has(sig)) porAssinatura.set(sig, []);
            porAssinatura.get(sig).push(op);
          });

          // Apenas se tiver mais de uma ordem com A MESMA ASSINATURA FÍSICA E QUANTIDADE!
          porAssinatura.forEach((grupoIguais, sig) => {
            if (grupoIguais.length > 1) {
              const original = grupoIguais[0];
              grupoIguais.slice(1).forEach(opDuplicada => {
                const loja = opDuplicada.unidade || opDuplicada.filial || "Matriz AJL";
                const dataChegada = formatarDataHora(opDuplicada.data || opDuplicada.created_date);
                const compFormatado = opDuplicada.comprimento ? `${opDuplicada.comprimento}m` : "mesma medida";
                const qtdFormatada = opDuplicada.quantidade ? `${opDuplicada.quantidade} peças` : "mesma quantidade";
                const espFormatada = opDuplicada.espessura ? `chapa ${opDuplicada.espessura}mm` : "";

                diagnostico.listaInconsistencias.push({
                  id: `dup_op_${opDuplicada.id}`,
                  opId: opDuplicada.id,
                  numeroPedido: opDuplicada.numero_pedido,
                  ofNome: opDuplicada.of_nome || "—",
                  codigoIndividual: opDuplicada.of_nome || `OP #${opDuplicada.id.slice(0, 8)}`,
                  cliente: opDuplicada.cliente || "Cliente",
                  vendedor: opDuplicada.vendedor || "—",
                  setor: "telha",
                  loja,
                  dataChegada,
                  tipo: "duplicado_maquina",
                  categoria: "OP Duplicada no Chão",
                  criticidade: "alta",
                  descricao: `Máquina ${maquina} com 2 ordens idênticas (${compFormatado} · ${qtdFormatada})`,
                  motivoExato: `A máquina ${maquina} possui ${grupoIguais.length} ordens rigorosamente idênticas para a mesma venda: ${qtdFormatada} c/ ${compFormatado} (${espFormatada}).`,
                  ondeDizEstar: `Máquina ${maquina}`,
                  situacaoReal: `Ordem duplicada no chão de fábrica gerando risco de corte duplo (Original OP #${original.id.slice(0, 8)}).`,
                  acaoSugerida: "Cancelar esta OP duplicada na máquina",
                  entidade: "Pedido",
                  ordemOriginal: original,
                  ordemDuplicada: opDuplicada,
                  dadosOriginal: opDuplicada
                });
                diagnostico.resumoPorTipo.duplicado_maquina++;
              });
            }
          });
        }
      });
    });

    // Mesma checagem estrita para Corte e Dobra
    opsAtivasCDPorNum.forEach((ops, num) => {
      const porMaquina = new Map();
      ops.forEach(op => {
        const m = String(op.maquina || "").trim().toUpperCase();
        if (!m) return;
        if (!porMaquina.has(m)) porMaquina.set(m, []);
        porMaquina.get(m).push(op);
      });

      porMaquina.forEach((listaOps, maquina) => {
        const ativas = listaOps.filter(o => o.status !== "finalizado" && o.status !== "cancelado");
        if (ativas.length > 1) {
          const porAssinatura = new Map();
          ativas.forEach(op => {
            const sig = extrairAssinaturaPeca(op);
            if (!porAssinatura.has(sig)) porAssinatura.set(sig, []);
            porAssinatura.get(sig).push(op);
          });

          porAssinatura.forEach((grupoIguais, sig) => {
            if (grupoIguais.length > 1) {
              const original = grupoIguais[0];
              grupoIguais.slice(1).forEach(opDuplicada => {
                const loja = opDuplicada.unidade || opDuplicada.filial || "Matriz AJL";
                const dataChegada = formatarDataHora(opDuplicada.data || opDuplicada.created_date);
                diagnostico.listaInconsistencias.push({
                  id: `dup_op_cd_${opDuplicada.id}`,
                  opId: opDuplicada.id,
                  numeroPedido: opDuplicada.numero_pedido,
                  ofNome: opDuplicada.of_nome || "—",
                  codigoIndividual: opDuplicada.of_nome || `OP #${opDuplicada.id.slice(0, 8)}`,
                  cliente: opDuplicada.cliente || "Cliente",
                  vendedor: opDuplicada.vendedor || "—",
                  setor: "cd",
                  loja,
                  dataChegada,
                  tipo: "duplicado_maquina",
                  categoria: "OP Duplicada no Chão",
                  criticidade: "alta",
                  descricao: `Máquina ${maquina} com 2 ordens idênticas de corte e dobra`,
                  motivoExato: `A máquina ${maquina} possui ${grupoIguais.length} ordens de corte e dobra rigorosamente idênticas para a mesma venda.`,
                  ondeDizEstar: `Máquina ${maquina}`,
                  situacaoReal: `Risco de corte duplo em C&D (Original mantida OP #${original.id.slice(0, 8)}).`,
                  acaoSugerida: "Cancelar esta OP duplicada na máquina",
                  entidade: "OrdemMaquinaCD",
                  ordemOriginal: original,
                  ordemDuplicada: opDuplicada,
                  dadosOriginal: opDuplicada
                });
                diagnostico.resumoPorTipo.duplicado_maquina++;
              });
            }
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

      const ehSimples = ehTelhaSimplesPura(p);
      const estaApontadoColagem =
        statusPcp === "aguardando_colagem" ||
        ondeEsta.includes("COLAGEM") ||
        p.maquina === "COLAGEM";

      const loja = p.unidade || p.filial || "Matriz AJL";
      const dataChegada = formatarDataHora(p.data_recebimento || p.created_date);

      if (ehSimples && estaApontadoColagem) {
        diagnostico.listaInconsistencias.push({
          id: `desc_col_${p.id}`,
          pedidoId: p.id,
          numeroPedido: p.numero_pedido,
          ofNome: p.of_nome || "—",
          codigoIndividual: p.of_nome || `OF #${p.id.slice(0, 8)}`,
          cliente: p.cliente_nome || "Cliente",
          vendedor: p.vendedor_nome || "—",
          setor: "telha",
          loja,
          dataChegada,
          tipo: "descompasso_colagem",
          categoria: "Erro na Colagem",
          criticidade: "alta",
          descricao: `Telha simples pura (sem EPS/sanduíche) direcionada à Colagem`,
          motivoExato: `O pedido contém apenas telha simples trapezoidal ou ondulada sem recheio termoacústico, mas está marcado com status 'aguardando_colagem'.`,
          ondeDizEstar: "Fila da Colagem / Aguardando Colagem",
          situacaoReal: "Produto simples não requer processo de colagem na fábrica.",
          acaoSugerida: "Remover da Colagem e direcionar apenas para a perfiladeira correspondente",
          entidade: "PedidoOdoo",
          dadosOriginal: p
        });
        diagnostico.resumoPorTipo.descompasso_colagem++;
      }
    });

    // ─────────────────────────────────────────────────────────────
    // TESTE 4: PEDIDO QUE DIZ QUE ESTÁ NA MÁQUINA MAS NÃO ESTÁ (OP Fantasma / Não existe)
    // ─────────────────────────────────────────────────────────────
    listaPcp.forEach(p => {
      const num = normalizarNumeroPedido(p.numero_pedido);
      const statusPcp = String(p.status || "").toLowerCase();
      const ondeEsta = String(p.onde_esta || "").toUpperCase();

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

        if (totalOpsAtivas === 0) {
          const todasOps = todasOpsTelhasPorNum.get(num) || [];
          const foiCancelada = todasOps.some(o => o.status === "cancelado");
          const foiFinalizada = todasOps.some(o => o.status === "finalizado");
          const loja = p.unidade || p.filial || "Matriz AJL";
          const dataChegada = formatarDataHora(p.data_recebimento || p.created_date);
          const setor = detectarSetorPedido(p);

          diagnostico.listaInconsistencias.push({
            id: `fantasma_${p.id}`,
            pedidoId: p.id,
            numeroPedido: p.numero_pedido,
            ofNome: p.of_nome || "—",
            codigoIndividual: p.of_nome || `OF #${p.id.slice(0, 8)}`,
            cliente: p.cliente_nome || "Cliente",
            vendedor: p.vendedor_nome || "—",
            setor,
            loja,
            dataChegada,
            tipo: "op_fantasma",
            categoria: "Máquina Fantasma / Descompasso",
            criticidade: "media",
            descricao: foiFinalizada
              ? `PCP diz 'Na Máquina', mas a OP já foi 100% finalizada na fábrica`
              : foiCancelada
              ? `PCP diz 'Na Máquina', mas a OP foi cancelada no chão`
              : `PCP diz 'Na Máquina / Em Produção', mas não há nenhuma OP aberta nas máquinas`,
            motivoExato: foiFinalizada
              ? `A fábrica já concluiu a fabricação física desta ordem, mas o PCP não recebeu o encerramento.`
              : `A ordem foi distribuída no PCP, porém não possui ordem de produção ativa nos painéis das máquinas.`,
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

    // Cálculo percentual com 1 casa decimal (Limitado no máximo a 100%)
    if (diagnostico.totalPedidosAnalisados > 0) {
      diagnostico.indiceDuplicados = Number(
        Math.min(100, (diagnostico.totalDuplicadosGeral / diagnostico.totalPedidosAnalisados) * 100).toFixed(1)
      );
      diagnostico.indiceDescompasso = Number(
        Math.min(100, (diagnostico.totalDescompassoGeral / diagnostico.totalPedidosAnalisados) * 100).toFixed(1)
      );
    }

    // Score de Integridade (100% menos penalidades)
    const penalidadeDuplicados = Math.min(40, diagnostico.totalDuplicadosGeral * 4);
    const penalidadeDescompasso = Math.min(40, diagnostico.totalDescompassoGeral * 3);
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

    // 1. DUPLICADO NO PCP: Cancela a cópia excedente mantendo o registro original
    if (item.tipo === "duplicado_pcp" && item.pedidoId) {
      await base44.entities.PedidoOdoo.update(item.pedidoId, {
        status: "cancelado",
        motivo_cancelamento: `Cancelado via Diagnóstico Operacional: Cópia Duplicada mantendo original #${item.ordemOriginal?.id || ""} por ${usuario}`,
        data_cancelamento: todayIso
      });
      toast.success(`Cópia duplicada #${item.numeroPedido} cancelada no PCP com sucesso. Ordem original mantida.`);
    }

    // 2. DUPLICADO NA MÁQUINA: Cancela OP excedente
    else if (item.tipo === "duplicado_maquina" && item.opId) {
      const entidade = item.entidade || "Pedido";
      await base44.entities[entidade].update(item.opId, {
        status: "cancelado",
        observacoes: `OP cancelada via Diagnóstico Operacional: Duplicidade física na máquina por ${usuario}. Original mantida OP #${item.ordemOriginal?.id || ""}`
      });
      toast.success(`OP duplicada #${item.numeroPedido} cancelada na máquina com sucesso.`);
    }

    // 3. DESCOMPASSO NA COLAGEM: Remove telha simples da colagem
    else if (item.tipo === "descompasso_colagem") {
      if (item.pedidoId) {
        await base44.entities.PedidoOdoo.update(item.pedidoId, {
          status: "aguardando_distribuicao",
          onde_esta: "Mesa PCP (Pendente)",
          maquina: null,
          bloqueado_colagem: false
        });
      }
      toast.success(`Pedido #${item.numeroPedido} removido da Colagem e reajustado com sucesso.`);
    }

    // 4. OP FANTASMA / STATUS DESCOMPASSADO
    else if (item.tipo === "op_fantasma" && item.pedidoId) {
      if (item.situacaoReal.includes("Concluída")) {
        await base44.entities.PedidoOdoo.update(item.pedidoId, {
          status: "concluido",
          percentual_concluido: 100,
          onde_esta: "Expedição / Concluído",
          data_conclusao: todayIso
        });
        toast.success(`Pedido #${item.numeroPedido} marcado como concluído no PCP.`);
      } else {
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
