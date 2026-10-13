import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { getItens } from "@/lib/pedidoOdooHelper";

/**
 * Formata datas ISO ou strings no padrão brasileiro completo.
 */
export function formatDataHoraBR(dataStr) {
  if (!dataStr) return "—";
  try {
    const d = new Date(dataStr.includes("T") ? dataStr : dataStr + "T12:00:00");
    if (isNaN(d.getTime())) return dataStr;
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dataStr;
  }
}

/**
 * Recompõe a linha do tempo inteligente de qualquer pedido de Telhas ou Corte & Dobra,
 * cruzando dados de PedidoOdoo, Pedido (fábrica), Ordens de CD, Bobinas e Pesagens.
 */
export async function reconstruirLinhaDoTempoPedido({
  pedidoId,
  numeroPedido,
  pedidoObj = null,
  setor = "telhas", // "telhas" | "corte_dobra"
}) {
  const timeline = [];

  let pedFabrica = null;
  let pedOdoo = null;
  let ordensCD = [];
  let ordensDesb = [];

  const numLimpo = String(numeroPedido || pedidoObj?.numero_pedido || "").trim().toUpperCase();

  try {
    // 1. Busca Pedido de Fábrica
    if (pedidoObj && pedidoObj.maquina && !pedidoObj._isOpAvulsa && !pedidoObj.itens_json) {
      pedFabrica = pedidoObj;
    } else if (pedidoId && !String(pedidoId).startsWith("op_")) {
      pedFabrica = await base44.entities.Pedido.get(pedidoId).catch(() => null);
    }

    if (!pedFabrica && numLimpo) {
      const listaPed = await base44.entities.Pedido.filter({ numero_pedido: numLimpo }, "-data", 10).catch(() => []);
      pedFabrica = listaPed[0] || null;
    }

    // 2. Busca Pedido Odoo
    if (pedidoObj && (pedidoObj.itens_json || pedidoObj.odoo_id || pedidoObj.cliente_nome)) {
      pedOdoo = pedidoObj;
    } else if (pedFabrica?.pedido_odoo_id) {
      pedOdoo = await base44.entities.PedidoOdoo.get(pedFabrica.pedido_odoo_id).catch(() => null);
    } else if (numLimpo) {
      const listaOdoo = await base44.entities.PedidoOdoo.filter({ numero_pedido: numLimpo }, "-created_date", 5).catch(() => []);
      pedOdoo = listaOdoo[0] || null;
    }

    // 3. Se for Corte e Dobra, busca ordens de desbobinadeira e corte/dobra
    if (setor === "corte_dobra" || (!pedFabrica && !pedOdoo)) {
      if (numLimpo) {
        const [desb, maq] = await Promise.all([
          base44.entities.OrdemDesbobinadeira.filter({ numero_pedido: numLimpo }, "data", 20).catch(() => []),
          base44.entities.OrdemMaquinaCD.filter({ numero_pedido: numLimpo }, "data", 20).catch(() => []),
        ]);
        ordensDesb = desb || [];
        ordensCD = maq || [];
      }
    }
  } catch (err) {
    console.warn("[reconstruirLinhaDoTempo] Erro ao buscar registros:", err);
  }

  // ── ETAPA 1: ENTRADA / CADASTRO DO PEDIDO ──
  const dataEntrada = pedOdoo?.data_recebimento || pedOdoo?.created_date || pedFabrica?.created_date || pedFabrica?.data;
  const cliente = pedOdoo?.cliente_nome || pedFabrica?.cliente || "Cliente";
  const vendedor = pedOdoo?.vendedor_nome || pedFabrica?.vendedor || "—";
  const numExibir = numLimpo || pedFabrica?.numero_pedido || pedOdoo?.numero_pedido || "S/N";

  timeline.push({
    id: "entrada",
    tipo: "entrada",
    titulo: "Pedido Registrado no Sistema",
    subtitulo: `Entrada via ${pedOdoo ? "Odoo ERP" : "Chão de Fábrica"}`,
    data: dataEntrada,
    dataFmt: formatDataHoraBR(dataEntrada),
    usuario: vendedor !== "—" ? `Vendedor: ${vendedor}` : "Sistema AJL",
    status: "concluido",
    cor: "blue",
    detalhes: [
      `Cliente: ${cliente}`,
      `Número do Pedido: #${numExibir}`,
      pedOdoo?.of_nome ? `Ordem de Fabricação (OF): ${pedOdoo.of_nome}` : null,
      pedOdoo?.loja_venda ? `Unidade de Venda: ${pedOdoo.loja_venda}` : null,
    ].filter(Boolean),
  });

  // ── ETAPA 2: PROGRAMAÇÃO E ROTEAMENTO NO PCP ──
  const maquinaAlocada = pedFabrica?.maquina || ordensCD[0]?.maquina || ordensDesb[0]?.maquina || "Aguardando Máquina";
  const dataPcp = pedOdoo?.data_distribuicao_pcp || pedFabrica?.created_date || dataEntrada;

  timeline.push({
    id: "pcp",
    tipo: "pcp",
    titulo: "Triagem & Programação PCP",
    subtitulo: `Roteado para ${maquinaAlocada}`,
    data: dataPcp,
    dataFmt: formatDataHoraBR(dataPcp),
    usuario: "PCP Central AJL",
    status: "concluido",
    cor: "indigo",
    detalhes: [
      `Máquina Destino: ${maquinaAlocada}`,
      pedOdoo?.data_entrega ? `Previsão Prometida (SLA): ${pedOdoo.data_entrega}` : null,
      pedFabrica?.unidade ? `Filial de Produção: ${pedFabrica.unidade}` : null,
      pedFabrica?.prioridade ? "Marcado como PRIORITÁRIO / URGENTE" : null,
    ].filter(Boolean),
  });

  // ── ETAPA 3: MATÉRIA-PRIMA & BOBINA VINCULADA ──
  const bobinaCod = pedFabrica?.bobina_superior || pedFabrica?.bobina_inferior || ordensDesb[0]?.bobina_codigo || ordensDesb[0]?.bobina_descricao;
  if (bobinaCod) {
    timeline.push({
      id: "materia_prima",
      tipo: "bobina",
      titulo: "Matéria-Prima Vinculada",
      subtitulo: `Bobina ${bobinaCod}`,
      data: pedFabrica?.created_date || dataPcp,
      dataFmt: formatDataHoraBR(pedFabrica?.created_date || dataPcp),
      usuario: pedFabrica?.operador || "Controle de Estoque",
      status: "concluido",
      cor: "amber",
      detalhes: [
        `Bobina Superior: ${pedFabrica?.bobina_superior || bobinaCod}`,
        pedFabrica?.bobina_inferior ? `Bobina Inferior (Sanduíche): ${pedFabrica.bobina_inferior}` : null,
        pedFabrica?.espessura ? `Espessura do Aço: ${pedFabrica.espessura}` : null,
        pedFabrica?.cor_exigida ? `Cor Exigida: ${pedFabrica.cor_exigida}` : null,
        pedFabrica?.rvm_superior ? `RVM Bobina: ${pedFabrica.rvm_superior}` : null,
      ].filter(Boolean),
    });
  }

  // ── ETAPA 4: INÍCIO DA PRODUÇÃO NA MÁQUINA ──
  const inicioTs = pedFabrica?.inicio_producao_ts || ordensCD[0]?.inicio_producao_ts || ordensDesb[0]?.inicio_producao_ts;
  const operadores = pedFabrica?.operador || ordensCD[0]?.operadores || ordensDesb[0]?.operadores || pedFabrica?.operadores_json;
  const emProducao = pedFabrica?.status === "em_producao" || ordensCD.some(o => o.status === "em_producao") || ordensDesb.some(o => o.status === "em_producao");

  if (inicioTs || emProducao) {
    timeline.push({
      id: "inicio_producao",
      tipo: "producao",
      titulo: "Produção Iniciada na Máquina",
      subtitulo: `Perfilação / Corte na máquina ${maquinaAlocada}`,
      data: inicioTs || dataPcp,
      dataFmt: formatDataHoraBR(inicioTs || dataPcp),
      usuario: operadores ? `Operador(es): ${operadores}` : "Operador da Máquina",
      status: emProducao ? "em_andamento" : "concluido",
      cor: "orange",
      detalhes: [
        `Máquina: ${maquinaAlocada}`,
        operadores ? `Equipe / Operadores: ${operadores}` : null,
        pedFabrica?.metros ? `Metragem Programada: ${pedFabrica.metros}m` : null,
        pedFabrica?.qtd_telhas ? `Quantidade de Peças: ${pedFabrica.qtd_telhas}` : null,
      ].filter(Boolean),
    });
  }

  // ── ETAPA 5: PAUSAS E INTERRUPÇÕES (SE HOUVER) ──
  const pausas = pedFabrica?.pausas_historico || ordensCD[0]?.pausas || [];
  if (Array.isArray(pausas) && pausas.length > 0) {
    pausas.forEach((p, idx) => {
      timeline.push({
        id: `pausa_${idx}`,
        tipo: "pausa",
        titulo: `Interrupção na Máquina (${p.motivo || "Pausa operacional"})`,
        subtitulo: p.duracao_fmt || "Pausa registrada",
        data: p.inicio || p.data,
        dataFmt: formatDataHoraBR(p.inicio || p.data),
        usuario: p.operador || "Operador",
        status: "concluido",
        cor: "purple",
        detalhes: [
          `Motivo: ${p.motivo || "Almoço / Troca de Bobina / Manutenção"}`,
          p.fim ? `Término da Pausa: ${formatDataHoraBR(p.fim)}` : "Em pausa",
        ],
      });
    });
  }

  // ── ETAPA 6: CONCLUSÃO, PESAGEM E FOTOS ──
  const isFinalizado = pedFabrica?.status === "finalizado" || pedOdoo?.status_pcp === "concluido" || pedOdoo?.percentual_concluido >= 100 || ordensCD.some(o => o.status === "finalizado");
  const fimTs = pedFabrica?.fim_producao_ts || pedFabrica?.data_finalizacao || ordensCD[0]?.data_finalizacao || ordensDesb[0]?.data_finalizacao;

  if (isFinalizado) {
    const fotos = [
      pedFabrica?.foto_balanca_url,
      pedFabrica?.foto_etiqueta_url,
      pedFabrica?.foto_peca_url,
      ordensCD[0]?.foto_balanca_url,
      ordensCD[0]?.foto_peca_url,
    ].filter(Boolean);

    timeline.push({
      id: "finalizacao",
      tipo: "finalizado",
      titulo: "Ordem Concluída & Inspecionada",
      subtitulo: "100% Finalizado na Fábrica",
      data: fimTs || pedFabrica?.data,
      dataFmt: formatDataHoraBR(fimTs || pedFabrica?.data),
      usuario: pedFabrica?.operador_finalizacao || pedFabrica?.operador || "Operador da Máquina",
      status: "concluido",
      cor: "emerald",
      fotos,
      detalhes: [
        pedFabrica?.peso_balanca_kg ? `Peso Aferido na Balança: ${pedFabrica.peso_balanca_kg} kg` : null,
        pedFabrica?.metros ? `Metros Totais Finalizados: ${pedFabrica.metros}m` : null,
        pedFabrica?.qtd_telhas ? `Peças Produzidas: ${pedFabrica.qtd_telhas} peças` : null,
        pedFabrica?.data_finalizacao ? `Data de Conclusão: ${pedFabrica.data_finalizacao}` : null,
      ].filter(Boolean),
    });
  }

  // Se houver histórico de alterações manual gravado em JSON no pedido, mescla respeitando a ordem cronológica
  if (pedFabrica?.historico_alteracoes) {
    try {
      const logs = JSON.parse(pedFabrica.historico_alteracoes);
      if (Array.isArray(logs)) {
        logs.forEach((log, idx) => {
          timeline.push({
            id: `manual_${idx}`,
            tipo: log.acao || "edicao",
            titulo: log.acao_label || "Alteração Registrada",
            subtitulo: log.detalhes || "",
            data: log.data,
            dataFmt: formatDataHoraBR(log.data),
            usuario: log.usuario || "Usuário",
            status: "concluido",
            cor: "slate",
            detalhes: [log.detalhes].filter(Boolean),
          });
        });
      }
    } catch {}
  }

  // Ordena a timeline cronologicamente (do mais recente para o mais antigo ou vice-versa)
  return {
    timeline: timeline.sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0)),
    pedido: pedFabrica || pedOdoo || pedidoObj,
    pedFabrica,
    pedOdoo,
    ordensCD,
    ordensDesb,
    cliente,
    vendedor,
    numeroPedido: numExibir,
    isFinalizado,
  };
}
