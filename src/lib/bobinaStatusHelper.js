// Helper universal para cálculo de status em tempo real das bobinas no ERP AJL

export function getBobinaStatus(bobina, ordensAtivas = []) {
  if (!bobina) return null;

  // 1. Procura se a bobina está montada ou sendo cortada em alguma máquina ("em_producao")
  const ordemEmProducao = ordensAtivas.find(o => 
    (o.bobina_id === bobina.id || o.bobina_superior === bobina.id || o.bobina_inferior === bobina.id) &&
    o.status === "em_producao"
  );

  if (ordemEmProducao) {
    const maq = ordemEmProducao.maquina || ordemEmProducao.maquina_inicial || "Linha";
    const nomeAmigavel = formatNomeMaquina(maq);
    return {
      label: `⚡ Em uso na ${nomeAmigavel}`,
      shortLabel: `⚡ ${nomeAmigavel}`,
      bgClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
      dotColor: "bg-amber-500 animate-pulse",
      badgeType: "em_uso"
    };
  }

  // 2. Procura se a bobina está alocada para uma ordem em fila ("pendente", "pausado", "programado")
  const ordemProgramada = ordensAtivas.find(o => 
    (o.bobina_id === bobina.id || o.bobina_superior === bobina.id || o.bobina_inferior === bobina.id) &&
    ["pendente", "pausado", "programado", "aguardando"].includes(o.status)
  );

  if (ordemProgramada) {
    const maq = ordemProgramada.maquina || ordemProgramada.maquina_inicial || "Linha";
    const nomeAmigavel = formatNomeMaquina(maq);
    return {
      label: `📅 Programada na ${nomeAmigavel}`,
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

function formatNomeMaquina(nome) {
  if (!nome) return "Linha";
  const n = nome.toUpperCase();
  if (n.includes("DESBOBINAD")) return "Bobininha / Desbobinador";
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
