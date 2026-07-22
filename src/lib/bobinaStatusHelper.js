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

  // 4. Bobina livre no pátio da fábrica
  return {
    label: "🟢 Disponível no Pátio",
    shortLabel: "🟢 Disponível",
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
