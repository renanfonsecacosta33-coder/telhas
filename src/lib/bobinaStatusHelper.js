// Helper universal para cálculo de status e metragens em tempo real das bobinas no ERP AJL

export function getBobinaStatus(bobina, ordensAtivas = [], statusMap = {}) {
  if (!bobina) return null;

  const bId = bobina.id;

  // 1. Checa se o statusMap (do usePreBaixaBobinas) já tem o estado resolvido
  const mapStatus = statusMap[bId];
  if (mapStatus) {
    const nomeAmigavel = formatNomeMaquina(mapStatus.maquina);
    if (mapStatus.status === "em_producao") {
      return {
        label: `⚡ Em uso no ${nomeAmigavel}`,
        shortLabel: `⚡ ${nomeAmigavel}`,
        bgClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
        dotColor: "bg-amber-500 animate-pulse",
        badgeType: "em_uso"
      };
    } else {
      return {
        label: `📅 Programada no ${nomeAmigavel}`,
        shortLabel: `📅 Prog. ${nomeAmigavel}`,
        bgClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
        dotColor: "bg-blue-500",
        badgeType: "programada"
      };
    }
  }

  // 2. Busca na lista de ordens ativas recebidas
  const isBobinaMatch = (o) => {
    if (o.bobina_id === bId || o.bobina_superior === bId || o.bobina_superior_id === bId || o.bobina_inferior === bId || o.bobina_inferior_id === bId) return true;
    try {
      const vars = JSON.parse(o.variacoes_telhas || "[]");
      if (Array.isArray(vars) && vars.some(v => v.bobina_id === bId || v.bobina_inf_id === bId)) return true;
    } catch {}
    return false;
  };

  const ordemEmProducao = ordensAtivas.find(o => isBobinaMatch(o) && ["em_producao", "produzindo", "iniciado"].includes(o.status?.toLowerCase()));

  if (ordemEmProducao) {
    const maq = ordemEmProducao.maquina || ordemEmProducao.maquina_inicial || "Linha";
    const nomeAmigavel = formatNomeMaquina(maq);
    return {
      label: `⚡ Em uso no ${nomeAmigavel}`,
      shortLabel: `⚡ ${nomeAmigavel}`,
      bgClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
      dotColor: "bg-amber-500 animate-pulse",
      badgeType: "em_uso"
    };
  }

  const ordemProgramada = ordensAtivas.find(o => isBobinaMatch(o) && ["pendente", "pausado", "programado", "aguardando"].includes(o.status?.toLowerCase()));

  if (ordemProgramada) {
    const maq = ordemProgramada.maquina || ordemProgramada.maquina_inicial || "Linha";
    const nomeAmigavel = formatNomeMaquina(maq);
    return {
      label: `📅 Programada no ${nomeAmigavel}`,
      shortLabel: `📅 Prog. ${nomeAmigavel}`,
      bgClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
      dotColor: "bg-blue-500",
      badgeType: "programada"
    };
  }

  // 3. Reserva ativa por vendedor ou pedido
  if (bobina.reservada) {
    const numPed = bobina.reserva_numero_pedido ? `#${bobina.reserva_numero_pedido}` : "";
    return {
      label: `🔒 Reservada ${numPed}`,
      shortLabel: `🔒 Reservada`,
      bgClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40",
      dotColor: "bg-purple-500",
      badgeType: "reservada"
    };
  }

  // 4. Bobina livre no pátio — diferencia Fechada / Aberta conforme cadastro
  const statusSalvo = (bobina.status || "").trim().toLowerCase();
  const ehFechada = statusSalvo === "fechada" || statusSalvo === "fechado" || statusSalvo === "encerrada" || statusSalvo === "encerrado";

  if (ehFechada) {
    return {
      label: "🔒 Fechada",
      shortLabel: "🔒 Fechada",
      bgClass: "bg-slate-400/20 text-slate-700 dark:text-slate-300 border-slate-400/40",
      dotColor: "bg-slate-500",
      badgeType: "fechada"
    };
  }

  return {
    label: "🟢 Aberta",
    shortLabel: "🟢 Aberta",
    bgClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    dotColor: "bg-emerald-500",
    badgeType: "disponivel"
  };
}

export function calcMetrosDisponiveis(bobina, dispKg) {
  if (!bobina || dispKg === undefined || dispKg === null) return null;
  const disp = Math.max(0, Number(dispKg) || 0);
  if (disp <= 0) return 0;

  // Se o cadastro da bobina possui metragem_restante direta
  if (bobina.metragem_restante && Number(bobina.peso_kg) > 0) {
    const ratio = disp / Number(bobina.peso_kg);
    return Math.round(Number(bobina.metragem_restante) * ratio);
  }

  // Senão, calcula com base na chapa/espessura (densidade 7.85 kg/m² por mm x 1.2m)
  const esp = Number(bobina.chapa || bobina.espessura_mm || bobina.espessura_utilizada) || 0.43;
  const largM = (Number(bobina.largura_mm) || 1200) / 1000;
  const kgPorMetro = esp * 7.85 * largM;

  if (kgPorMetro > 0) {
    return Math.round(disp / kgPorMetro);
  }

  return null;
}

function formatNomeMaquina(nome) {
  if (!nome) return "Linha";
  const n = nome.toUpperCase();
  if (n.includes("DESBOBINAD")) return "Desbobinador";
  if (n.includes("TP40") || n.includes("TP - 40")) return "TP-40";
  if (n.includes("TP25") || n.includes("TP - 25")) return "TP-25";
  if (n.includes("ONDULADA")) return "Ondulada";
  if (n.includes("COLONIAL")) return "Colonial";
  if (n.includes("BANDEJA")) return "Bandeja";
  if (n.includes("DOBRA 3M") || n.includes("DOBRA3M")) return "Dobra 3M";
  if (n.includes("DOBRA 6M") || n.includes("DOBRA6M")) return "Dobra 6M";
  if (n.includes("CORTE 3M") || n.includes("CORTE3M")) return "Corte 3M";
  if (n.includes("CORTE 6M") || n.includes("CORTE6M")) return "Corte 6M";
  if (n.includes("PERFILADEIRA")) return "Perfiladeira";
  if (n.includes("SLITTER")) return "Slitter";
  return nome;
}

/**
 * Extrai o timestamp numérico (ms) para ordenação de bobinas arquivadas.
 * Prioridade:
 * 1. data_encerramento (definida no arquivamento)
 * 2. updated_date (quando o registro foi arquivado no Base44)
 * 3. created_date
 * 4. data_recebimento
 */
export function getTimestampArquivamento(bobina) {
  if (!bobina) return 0;
  if (bobina.data_encerramento) {
    const t = new Date(bobina.data_encerramento).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (bobina.updated_date) {
    const t = new Date(bobina.updated_date).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (bobina.created_date) {
    const t = new Date(bobina.created_date).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (bobina.data_recebimento) {
    const t = new Date(bobina.data_recebimento).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Formata a data de arquivamento para exibição no card.
 * Ex: "Arquivada em 14/09/2026"
 */
export function formatarDataArquivamento(bobina) {
  if (!bobina) return "Arquivada";
  const dStr = bobina.data_encerramento || bobina.updated_date || bobina.created_date;
  if (!dStr) return "Arquivada";
  try {
    if (/^\d{4}-\d{2}-\d{2}/.test(dStr)) {
      const partes = dStr.split("T")[0].split("-");
      if (partes.length === 3) {
        return `Arquivada em ${partes[2]}/${partes[1]}/${partes[0]}`;
      }
    }
    const dt = new Date(dStr);
    if (!isNaN(dt.getTime())) {
      return `Arquivada em ${dt.toLocaleDateString("pt-BR")}`;
    }
  } catch {}
  return `Arquivada em ${dStr}`;
}

/**
 * Extrai a data ISO "YYYY-MM-DD" de arquivamento da bobina
 */
export function getDataArquivamentoISO(bobina) {
  if (!bobina) return "";
  const dStr = bobina.data_encerramento || bobina.updated_date || bobina.created_date;
  if (!dStr) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(dStr)) {
    return dStr.split("T")[0];
  }
  const dt = new Date(dStr);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().split("T")[0];
  }
  return "";
}

/**
 * Extrai a data ISO "YYYY-MM-DD" de recebimento da bobina
 */
export function getDataRecebimentoISO(bobina) {
  if (!bobina) return "";
  const dStr = bobina.data_recebimento || bobina.created_date;
  if (!dStr) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(dStr)) {
    return dStr.split("T")[0];
  }
  const dt = new Date(dStr);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().split("T")[0];
  }
  return "";
}

/**
 * Retorna uma lista de strings de busca (formatos variados) para uma data "YYYY-MM-DD" ou ISO
 */
export function gerarVariacoesDataBusca(dateStr) {
  if (!dateStr) return [];
  const iso = String(dateStr).split("T")[0].trim();
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return [iso.toLowerCase()];

  const [_, yyyy, mm, dd] = m;
  const meses = [
    "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  const mesNome = meses[parseInt(mm, 10)] || "";

  return [
    iso,                               // "2026-09-14"
    `${dd}/${mm}/${yyyy}`,             // "14/09/2026"
    `${dd}/${mm}`,                     // "14/09"
    `${mm}/${yyyy}`,                   // "09/2026"
    `${dd}-${mm}-${yyyy}`,             // "14-09-2026"
    `${dd}.${mm}.${yyyy}`,             // "14.09.2026"
    `${dd}.${mm}`,                     // "14.09"
    `${dd}-${mm}`,                     // "14-09"
    `${yyyy}-${mm}`,                   // "2026-09"
    `${dd} de ${mesNome}`,             // "14 de setembro"
    mesNome,                           // "setembro"
  ].filter(Boolean).map(s => s.toLowerCase());
}

/**
 * Verifica se a bobina corresponde ao termo de busca por data ou texto
 */
export function matchBobinaBuscaData(bobina, query, showArquivadas = false) {
  if (!bobina || !query) return false;
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const datasParaVerificar = [];
  if (showArquivadas) {
    if (bobina.data_encerramento) datasParaVerificar.push(bobina.data_encerramento);
    if (bobina.updated_date) datasParaVerificar.push(bobina.updated_date);
    if (bobina.created_date) datasParaVerificar.push(bobina.created_date);
  }
  if (bobina.data_recebimento) datasParaVerificar.push(bobina.data_recebimento);
  if (bobina.created_date) datasParaVerificar.push(bobina.created_date);

  for (const d of datasParaVerificar) {
    const variacoes = gerarVariacoesDataBusca(d);
    for (const v of variacoes) {
      if (v.includes(q)) return true;
    }
  }

  // Também checa se o termo digitado está contido no texto "Arquivada em DD/MM/AAAA"
  if (bobina.arquivada) {
    const txtArq = formatarDataArquivamento(bobina).toLowerCase();
    if (txtArq.includes(q)) return true;
  }

  return false;
}

/**
 * Verifica correspondência exata para o filtro input type="date" ("YYYY-MM-DD")
 */
export function matchBobinaFiltroDataExata(bobina, dataIso, showArquivadas = false) {
  if (!bobina || !dataIso) return true;
  const target = dataIso.trim();

  if (showArquivadas) {
    const arqIso = getDataArquivamentoISO(bobina);
    if (arqIso === target) return true;
  }
  const recIso = getDataRecebimentoISO(bobina);
  if (recIso === target) return true;

  return false;
}