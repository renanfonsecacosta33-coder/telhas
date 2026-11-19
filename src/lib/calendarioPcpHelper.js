import { format, isBefore, startOfDay, parseISO } from "date-fns";
import { getItens, classGrupo, calcularProgressoRealPedido } from "@/lib/pedidoOdooHelper";
import { extrairDemandaItem, calcularPesoEstimadoItem } from "@/lib/estoqueMaterialHelper";
import { isPedidoRetiraAgora, isPedidoRota } from "@/lib/prioridadeHelper";

/**
 * Limite de capacidade padrão diária (em Toneladas e Metros).
 * Pode ser ajustado pelo PCP.
 */
export const LIMITE_CAPACIDADE_TON_PADRAO = 15;
export const LIMITE_CAPACIDADE_METROS_PADRAO = 3500;

/**
 * Normaliza qualquer formato de data para ISO yyyy-MM-dd.
 */
export function normalizarDataIso(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (str.includes("T")) return str.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${y}-${m}-${d}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return format(d, "yyyy-MM-dd");
    }
  } catch {}
  return null;
}

/**
 * Formata data ISO para dd/MM amigável
 */
export function formatarDataCurtaBR(raw) {
  const iso = normalizarDataIso(raw);
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * Extrai a data ISO (yyyy-MM-dd) que posiciona o pedido no Calendário.
 * Prioridade:
 * 1. data_programada_pcp
 * 2. data_carregamento_rota
 * 3. data_prontidao
 * 4. data_entrega (SLA Odoo)
 */
export function extrairDataCalendario(pedido) {
  if (!pedido) return null;
  const raw =
    pedido.data_programada_pcp ||
    pedido.data_carregamento_rota ||
    pedido.data_prontidao ||
    pedido.data_entrega ||
    pedido.data_previsao_fabrica ||
    pedido.data;

  return normalizarDataIso(raw);
}

/**
 * Calcula os totais de Metros, Peso em KG/Ton, e status consolidado do Pedido (ou Grupo de OFs).
 */
export function calcularMetricasDoPedidoGrupo(grupoOuPedido, { pedidosProducao = [], ordensCD = [] } = {}) {
  const ofs = grupoOuPedido.ofs || [grupoOuPedido];
  let metrosTotal = 0;
  let pesoKgTotal = 0;
  let pecasTotal = 0;
  const maquinasSet = new Set();

  ofs.forEach(p => {
    const itens = getItens(p);
    itens.forEach(it => {
      try {
        const dem = extrairDemandaItem(it);
        const m = Number(dem?.metros) || 0;
        metrosTotal += m;
        pecasTotal += Number(dem?.pecas) || 1;

        const setor = classGrupo(it);
        const prodStr = String(it.produto || it.descricao || "");
        const isSanduiche = /(sandu[ií]che|termoac[uú]stica|eps|isopor|pir|pu)/i.test(prodStr);
        const calcPeso = calcularPesoEstimadoItem({
          setor,
          espessura: it.espessura,
          demanda: dem,
          isSanduiche,
          prod: it.produto || "",
          desc: it.descricao || ""
        });
        const kg = Number(calcPeso?.pesoKg) || Number(it.peso_kg) || Number(it.kg_estimado) || 0;
        pesoKgTotal += kg;
      } catch {
        const m = Number(it.quantidade) || 0;
        metrosTotal += m;
      }
    });

    if (p.maquina) maquinasSet.add(p.maquina);
    if (p.maquinas_json) {
      try {
        const maqs = JSON.parse(p.maquinas_json);
        if (Array.isArray(maqs)) maqs.forEach(m => maquinasSet.add(m));
      } catch {}
    }
  });

  // Metragem e peso do grupo direto (se existir)
  if (metrosTotal === 0) {
    metrosTotal = Number(grupoOuPedido.metragem_total) || Number(grupoOuPedido.metros) || Number(grupoOuPedido.comprimento_total_metros) || Number(grupoOuPedido.quantidade) || 0;
  }
  if (pesoKgTotal === 0) {
    pesoKgTotal = Number(grupoOuPedido.peso_total_kg) || Number(grupoOuPedido.peso_kg) || Number(grupoOuPedido.kg_estimado) || Number(grupoOuPedido.peso) || 0;
  }

  // Progresso real do chão de fábrica
  let progresso = 0;
  if (grupoOuPedido.status === "finalizado" || grupoOuPedido.status === "concluido") {
    progresso = 100;
  } else {
    const somaProgressos = ofs.reduce((acc, p) => {
      return acc + calcularProgressoRealPedido(p, pedidosProducao, ordensCD);
    }, 0);
    progresso = ofs.length > 0 ? Math.round(somaProgressos / ofs.length) : (grupoOuPedido.percentual_concluido || 0);
  }

  // Status de conclusão
  const isConcluido =
    progresso >= 100 ||
    grupoOuPedido.status === "finalizado" ||
    grupoOuPedido.status === "concluido" ||
    grupoOuPedido.status_pcp === "concluido" ||
    grupoOuPedido.status_pcp === "entregue" ||
    (ofs.length > 0 && ofs.every(p => p.status === "finalizado" || p.status === "concluido" || p.status_pcp === "concluido" || p.status_pcp === "entregue"));

  // Tipo de prioridade / categoria
  const isRota = isPedidoRota(grupoOuPedido) || ofs.some(p => isPedidoRota(p));
  const isRetiraAgora = isPedidoRetiraAgora(grupoOuPedido) || ofs.some(p => isPedidoRetiraAgora(p));
  const isPrioridade = Boolean(grupoOuPedido.prioridade || ofs.some(p => p.prioridade || p.prioridade_nivel));

  // Data Prometida Original (SLA Odoo) vs Data Programada (PCP)
  const dataPrometidaIso = normalizarDataIso(
    grupoOuPedido.data_entrega ||
    grupoOuPedido.data ||
    ofs.find(p => p.data_entrega)?.data_entrega
  );
  const dataProgramadaIso = normalizarDataIso(
    grupoOuPedido.data_programada_pcp ||
    grupoOuPedido.data_carregamento_rota ||
    grupoOuPedido.data_prontidao ||
    grupoOuPedido.data ||
    ofs.find(p => p.data_programada_pcp)?.data_programada_pcp
  );
  const dataAlvoStr = dataProgramadaIso || dataPrometidaIso || extrairDataCalendario(grupoOuPedido);

  // Atraso ou adiamento em relação à promessa original do Odoo
  const reagendadoAposPrometido = Boolean(
    dataPrometidaIso && dataProgramadaIso && dataProgramadaIso > dataPrometidaIso
  );

  let isAtrasado = false;
  if (dataAlvoStr && !isConcluido) {
    try {
      const dataAlvo = parseISO(dataAlvoStr);
      const hoje = startOfDay(new Date());
      if (isBefore(dataAlvo, hoje)) {
        isAtrasado = true;
      }
    } catch {}
  }

  return {
    metrosTotal: Math.round(metrosTotal * 10) / 10,
    pesoKgTotal: Math.round(pesoKgTotal),
    toneladasTotal: Math.round((pesoKgTotal / 1000) * 10) / 10,
    pecasTotal,
    progresso,
    isConcluido,
    isRota,
    isRetiraAgora,
    isPrioridade,
    isAtrasado,
    dataPrometidaIso,
    dataPrometidaFormatada: formatarDataCurtaBR(dataPrometidaIso),
    dataProgramadaIso,
    dataProgramadaFormatada: formatarDataCurtaBR(dataProgramadaIso),
    reagendadoAposPrometido,
    maquinas: Array.from(maquinasSet),
    dataAlvo: dataAlvoStr
  };
}

/**
 * Agrupa todos os pedidos do PCP por data de calendário.
 * Retorna:
 * - mapaDias: { '2026-11-20': { rotas: [], prontidoes: [], concluidos: [], atrasados: [], todos: [], metros, kg, tons, sobrecarregado } }
 * - semData: [ pedidos/grupos sem data ]
 */
export function agruparPedidosPorCalendario(gruposOuPedidos, {
  pedidosProducao = [],
  ordensCD = [],
  limiteTon = LIMITE_CAPACIDADE_TON_PADRAO,
  limiteMetros = LIMITE_CAPACIDADE_METROS_PADRAO
} = {}) {
  const mapaDias = new Map();
  const semData = [];

  const lista = Array.isArray(gruposOuPedidos) ? gruposOuPedidos : [];

  lista.forEach(item => {
    const dataIso = extrairDataCalendario(item);
    const metricas = calcularMetricasDoPedidoGrupo(item, { pedidosProducao, ordensCD });
    const itemComMetricas = { ...item, _metricas: metricas };

    if (!dataIso) {
      semData.push(itemComMetricas);
      return;
    }

    if (!mapaDias.has(dataIso)) {
      mapaDias.set(dataIso, {
        dataIso,
        todos: [],
        rotas: [],
        prontidoes: [],
        concluidos: [],
        atrasados: [],
        reagendados: [],
        metrosTotal: 0,
        pesoKgTotal: 0,
        toneladasTotal: 0,
        sobrecarregado: false
      });
    }

    const diaInfo = mapaDias.get(dataIso);
    diaInfo.todos.push(itemComMetricas);
    diaInfo.metrosTotal += metricas.metrosTotal;
    diaInfo.pesoKgTotal += metricas.pesoKgTotal;

    if (metricas.reagendadoAposPrometido) {
      diaInfo.reagendados.push(itemComMetricas);
    }

    if (metricas.isConcluido) {
      diaInfo.concluidos.push(itemComMetricas);
    } else {
      if (metricas.isRota) {
        diaInfo.rotas.push(itemComMetricas);
      } else if (metricas.isRetiraAgora || metricas.isPrioridade) {
        diaInfo.prontidoes.push(itemComMetricas);
      } else {
        // Pedido normal com data programada
        diaInfo.prontidoes.push(itemComMetricas);
      }

      if (metricas.isAtrasado) {
        diaInfo.atrasados.push(itemComMetricas);
      }
    }
  });

  // Calcula tonelagem consolidada e verificação de sobrecarga
  mapaDias.forEach(dia => {
    dia.metrosTotal = Math.round(dia.metrosTotal * 10) / 10;
    dia.toneladasTotal = Math.round((dia.pesoKgTotal / 1000) * 10) / 10;
    dia.sobrecarregado = dia.toneladasTotal > limiteTon || dia.metrosTotal > limiteMetros;
  });

  return {
    mapaDias,
    semData
  };
}
