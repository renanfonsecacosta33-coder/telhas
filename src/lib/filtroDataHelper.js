import { diasUteisRestantes } from "@/lib/sla";

/**
 * Converte qualquer formato de data (ISO string, DD/MM/YYYY, Timestamp) em YYYY-MM-DD para comparação precisa.
 */
export function extrairDataISO(val) {
  if (!val) return "";
  const s = String(val).trim();
  // Formato YYYY-MM-DD...
  const matchISO = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchISO) return `${matchISO[1]}-${matchISO[2]}-${matchISO[3]}`;

  // Formato DD/MM/YYYY...
  const matchBR = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchBR) {
    const dia = matchBR[1].padStart(2, "0");
    const mes = matchBR[2].padStart(2, "0");
    const ano = matchBR[3];
    return `${ano}-${mes}-${dia}`;
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }
  return "";
}

/**
 * Calcula as datas de Início e Fim para os presets rápidos (YYYY-MM-DD).
 */
export function calcularIntervaloPreset(preset) {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);

  if (preset === "hoje") {
    return { inicio: hojeStr, fim: hojeStr };
  }
  if (preset === "ontem") {
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10);
    return { inicio: ontemStr, fim: ontemStr };
  }
  if (preset === "ultimos_7d") {
    const d7 = new Date(hoje);
    d7.setDate(d7.getDate() - 7);
    return { inicio: d7.toISOString().slice(0, 10), fim: hojeStr };
  }
  if (preset === "este_mes") {
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { inicio: primeiroDia.toISOString().slice(0, 10), fim: hojeStr };
  }
  return { inicio: "", fim: "" };
}

/**
 * Extrai o valor da data relevante do pedido conforme o campo selecionado.
 */
export function obterDataCampoPedido(pedido, campo = "data_recebimento") {
  if (!pedido) return "";
  if (campo === "data_recebimento") {
    return pedido.data_recebimento || "";
  }
  if (campo === "data_previsao_fabrica") {
    return pedido.data_previsao_fabrica || pedido.data_entrega || "";
  }
  // Padrão: data_entrega
  return pedido.data_entrega || pedido.data_previsao_fabrica || "";
}

/**
 * Aplica ordenação avançada com foco em Mais Atrasados, Menor Prazo SLA, Data de Entrega ou FIFO de Entrada.
 */
export function ordenarPedidosPCP(lista, criterio = "mais_atrasados") {
  const arr = [...lista];

  arr.sort((a, b) => {
    // Pedidos prioritários têm peso adicional no topo
    if (a.prioridade && !b.prioridade) return -1;
    if (!a.prioridade && b.prioridade) return 1;

    const dataAlvoA = a.data_previsao_fabrica || a.data_entrega;
    const dataAlvoB = b.data_previsao_fabrica || b.data_entrega;
    const dA = diasUteisRestantes(dataAlvoA) ?? 999;
    const dB = diasUteisRestantes(dataAlvoB) ?? 999;

    if (criterio === "mais_atrasados") {
      // Quanto menor o número (ex: -10 dias vs -2 dias), mais atrasado está!
      // Portanto ordem crescente de dias úteis restantes: -15, -10, -2, 0, 1, 5
      if (dA !== dB) return dA - dB;
      return new Date(a.data_recebimento || 0) - new Date(b.data_recebimento || 0);
    }

    if (criterio === "urgencia_sla") {
      if (dA !== dB) return dA - dB;
      return new Date(a.data_recebimento || 0) - new Date(b.data_recebimento || 0);
    }

    if (criterio === "data_entrega_asc") {
      const dtA = extrairDataISO(dataAlvoA) || "9999-99-99";
      const dtB = extrairDataISO(dataAlvoB) || "9999-99-99";
      if (dtA !== dtB) return dtA.localeCompare(dtB);
      return new Date(a.data_recebimento || 0) - new Date(b.data_recebimento || 0);
    }

    if (criterio === "data_entrada_desc") {
      // Mais recentes primeiro
      return new Date(b.data_recebimento || 0) - new Date(a.data_recebimento || 0);
    }

    if (criterio === "data_entrada_asc") {
      // FIFO: mais antigos primeiro
      return new Date(a.data_recebimento || 0) - new Date(b.data_recebimento || 0);
    }

    return 0;
  });

  return arr;
}
