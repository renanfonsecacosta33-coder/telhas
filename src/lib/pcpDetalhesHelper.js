import { getItens, itensPorGrupo, detectarEspessura } from "@/lib/pedidoOdooHelper";
import { detectarCorTelha } from "@/lib/autoBobinaTelhasHelper";
import { diasUteisRestantes } from "@/lib/sla";

/**
 * Calcula a urgência detalhada do prazo fabril ou prometido.
 */
export function calcularUrgenciaDetalhada(pedido) {
  const dataAlvo = pedido?.data_previsao_fabrica || pedido?.data_entrega;
  const d = diasUteisRestantes(dataAlvo);

  if (d == null || isNaN(d)) {
    return {
      dias: null,
      status: "sem_prazo",
      isAtrasado: false,
      isCritico: false,
      isModerado: false,
      isHoje: false,
      isAmanha: false,
      label: "Sem Prazo",
      classeBg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    };
  }

  if (d < 0) {
    const diasAtraso = Math.abs(d);
    const isCritico = diasAtraso >= 5;
    return {
      dias: d,
      diasAtraso,
      status: isCritico ? "atraso_critico" : "atraso_moderado",
      isAtrasado: true,
      isCritico,
      isModerado: !isCritico,
      isHoje: false,
      isAmanha: false,
      label: isCritico ? `🚨 ATRASADO ${diasAtraso}d (Crítico)` : `⚠️ Atrasado ${diasAtraso}d`,
      classeBg: isCritico
        ? "bg-red-600 text-white border-red-700 animate-pulse font-black"
        : "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 font-bold",
    };
  }

  if (d === 0) {
    return {
      dias: 0,
      diasAtraso: 0,
      status: "hoje",
      isAtrasado: false,
      isCritico: false,
      isModerado: false,
      isHoje: true,
      isAmanha: false,
      label: "⏳ Vence Hoje",
      classeBg: "bg-amber-500 text-white border-amber-600 font-bold",
    };
  }

  if (d === 1) {
    return {
      dias: 1,
      diasAtraso: 0,
      status: "amanha",
      isAtrasado: false,
      isCritico: false,
      isModerado: false,
      isHoje: false,
      isAmanha: true,
      label: "⏰ Vence Amanhã",
      classeBg: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold",
    };
  }

  return {
    dias: d,
    diasAtraso: 0,
    status: "no_prazo",
    isAtrasado: false,
    isCritico: false,
    isModerado: false,
    isHoje: false,
    isAmanha: false,
    label: `Restam ${d} dias`,
    classeBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-medium",
  };
}

/**
 * Resumo de Metragem e Peso Estimado do pedido.
 */
export function resumoMetragemEPeso(pedido) {
  const itens = getItens(pedido);
  const telhas = itensPorGrupo(itens, "telha");

  let totalMetros = 0;
  let totalPecas = 0;

  telhas.forEach((it) => {
    const qtd = Number(it.quantidade) || 1;
    let met = Number(it.metragem_total) || 0;

    if (!met) {
      const compMm = parseFloat(String(it.medida || "").replace(/\D/g, ""));
      if (compMm && compMm > 100) {
        met = +( (compMm / 1000) * qtd ).toFixed(2);
      } else {
        met = Number(it.quantidade) || 0;
      }
    }

    totalMetros += met;
    totalPecas += qtd;
  });

  if (totalMetros === 0 && pedido._isOpAvulsa && pedido._opOrigem) {
    const op = pedido._opOrigem;
    totalMetros = Number(op.metros) || (Number(op.metragem_mm) ? +(Number(op.metragem_mm) / 1000).toFixed(2) : 1);
    totalPecas = Number(op.qtd_telhas || op.quantidade) || 1;
  }

  // Fator médio Galvalume / Aço Telhas: ~3.85 kg por metro linear em chapa 0.43mm
  const pesoEstimadoKg = Math.round(totalMetros * 3.85);

  return {
    totalMetros: +totalMetros.toFixed(1),
    totalPecas,
    pesoEstimadoKg,
    textoResumo: `${totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m · ~${pesoEstimadoKg.toLocaleString("pt-BR")} kg`,
  };
}

/**
 * Resumo de Disponibilidade de Bobinas de Estoque para o pedido.
 */
export function resumoBobinaPedido(pedido, bobinasEstoque = []) {
  if (!bobinasEstoque || bobinasEstoque.length === 0) {
    return {
      status: "indefinido",
      pesoTotal: 0,
      qtdBobinas: 0,
      label: "Estoque n/d",
      classe: "bg-slate-100 text-slate-600 border-slate-200",
    };
  }

  const itens = getItens(pedido);
  const telhas = itensPorGrupo(itens, "telha");

  // Coleta todas as especificações de espessura e cor exigidas
  let espessuras = new Set();
  let cores = new Set();

  telhas.forEach((it) => {
    const txt = `${it.produto || ""} ${it.descricao || ""} ${it.observacao || ""}`;
    const esp = it.espessura || detectarEspessura(txt) || "0.43";
    const cor = it.cor || detectarCorTelha(txt) || "NATURAL";
    if (esp) espessuras.add(String(esp).replace(",", "."));
    if (cor) cores.add(String(cor).toUpperCase());
  });

  if (espessuras.size === 0) {
    espessuras.add("0.43");
  }

  // Filtra bobinas compatíveis
  const espArray = Array.from(espessuras);
  const unidadePedido = pedido?.unidade || "Matriz AJL";

  const compativeis = bobinasEstoque.filter((b) => {
    if (b.status === "esgotada") return false;
    const peso = Number(b.peso_atual || b.peso_liquido || b.peso_restante || 0);
    if (peso <= 0) return false;

    // Se a filial da bobina for diferente da do pedido (quando especificada)
    if (b.unidade && b.unidade !== unidadePedido && unidadePedido !== "todas") {
      return false;
    }

    const espB = String(b.espessura || "").replace(",", ".");
    const matchEsp = espArray.some((e) => espB.includes(e) || e.includes(espB) || Math.abs(parseFloat(espB) - parseFloat(e)) <= 0.03);
    if (!matchEsp) return false;

    return true;
  });

  const pesoTotal = compativeis.reduce((s, b) => s + (Number(b.peso_atual || b.peso_liquido || 0) || 0), 0);
  const qtdBobinas = compativeis.length;

  if (qtdBobinas === 0 || pesoTotal <= 0) {
    return {
      status: "falta",
      pesoTotal: 0,
      qtdBobinas: 0,
      label: "🔴 Sem Bobina",
      detalhe: "Nenhuma bobina compatível em estoque",
      classe: "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800",
    };
  }

  if (pesoTotal < 150) {
    return {
      status: "baixo",
      pesoTotal,
      qtdBobinas,
      label: `🟡 Bobina Baixa (${Math.round(pesoTotal)} kg)`,
      detalhe: `${qtdBobinas} bobina(s) com estoque reduzido`,
      classe: "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    };
  }

  return {
    status: "ok",
    pesoTotal,
    qtdBobinas,
    label: `🟢 Bobina OK (${Math.round(pesoTotal).toLocaleString("pt-BR")} kg)`,
    detalhe: `${qtdBobinas} bobina(s) compatível(is)`,
    classe: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
  };
}

/**
 * Resumo de Logística e Modalidade de Frete / Rota do pedido.
 */
export function resumoLogistica(pedido) {
  const txt = `${pedido?.tipo_frete || ""} ${pedido?.modalidade_frete || ""} ${pedido?.observacoes || ""} ${pedido?.cliente_nome || ""}`.toUpperCase();
  const isRetirada = /(RETIRADA|FOB|BALCAO|CLIENTE RETIRA|RETIRA NA LOJA|RETIRA NA FABRICA)/i.test(txt);

  if (isRetirada) {
    return {
      tipo: "retirada",
      label: "🏬 Retirada na Fábrica",
      detalhe: "Cliente Retira (FOB)",
      classe: "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-bold",
    };
  }

  const rota = pedido?.rota || pedido?.caminhao || pedido?.transportadora || "";
  return {
    tipo: "entrega",
    label: rota ? `🚚 Rota: ${rota}` : "🚚 Entrega (Rota)",
    detalhe: pedido?.data_entrega ? `SLA: ${pedido.data_entrega}` : "Entrega agendada",
    classe: "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-bold",
  };
}

/**
 * Resumo de Máquina e Operador em Chão de Fábrica.
 */
export function resumoMaquinaEOperador(pedido, opsDoPedido = []) {
  if (opsDoPedido && opsDoPedido.length > 0) {
    const maquinas = Array.from(new Set(opsDoPedido.map((op) => op.maquina || "TP - 40").filter(Boolean)));
    const statusOp = opsDoPedido.some((op) => op.status === "em_producao")
      ? "em_producao"
      : opsDoPedido.every((op) => op.status === "finalizado")
      ? "finalizado"
      : "aguardando";

    const operadores = Array.from(
      new Set(
        opsDoPedido
          .map((op) => op.operador || op.operadores)
          .flat()
          .filter(Boolean)
      )
    );

    return {
      maquinas,
      maquinaTexto: maquinas.join(", ") || "TP - 40",
      statusOp,
      operadores: operadores.join(", "),
      temOp: true,
    };
  }

  // Itens com máquina preenchida
  const itens = getItens(pedido);
  const maqItens = Array.from(new Set(itens.map((it) => it.maquina).filter(Boolean)));
  return {
    maquinas: maqItens,
    maquinaTexto: maqItens.join(", ") || "Aguardando Máquina",
    statusOp: "pendente",
    operadores: "",
    temOp: false,
  };
}
