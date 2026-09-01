// Helper compartilhado para itens de PedidoOdoo com status por peça.
// Normaliza itens_json garantindo campos de status por item.

const STATUS_DEFAULTS = {
  status: "pendente",        // pendente | em_producao | concluido
  maquina: "",               // máquina selecionada (CD)
  quantidade_produzida: 0,   // peças já produzidas (CD)
  medicao: ""                // medição conferida (CD)
};

export function getItens(pedido) {
  let arr = [];
  try { arr = JSON.parse(pedido?.itens_json || "[]"); } catch { arr = []; }
  return arr.map((it, idx) => ({ ...STATUS_DEFAULTS, ...it, _idx: idx }));
}

// Aceita item completo (obj) ou categoria + produto (strings)
export function classGrupo(itemOrCat, produtoNome = "") {
  let cat = "";
  let prod = "";
  if (typeof itemOrCat === "object" && itemOrCat !== null) {
    cat = String(itemOrCat.categoria || "").trim().toLowerCase();
    prod = String(itemOrCat.produto || itemOrCat.descricao || "").trim().toLowerCase();
  } else {
    cat = String(itemOrCat || "").trim().toLowerCase();
    prod = String(produtoNome || "").trim().toLowerCase();
  }

  if (["telhas", "telha", "bandeja", "bobininha"].includes(cat)) return "telha";
  if (/(telha|tp\s*25|tp\s*40|eps|manta|cumeeira|ondulada|colonial)/i.test(prod)) return "telha";
  if (["frisadas", "frisada"].includes(cat)) return "frisada";
  if (["chapa", "perfil", "barra", "tubo", "zincado", "corte e dobra", "corte_dobra"].some((k) => cat.includes(k))) return "cd";

  // Fallback por nome do produto/descrição
  if (["telha", "tp-", "tp ", "eps", "manta"].some((k) => prod.includes(k))) return "telha";
  if (["chapa", "perfil", "barra", "tubo", "zincado"].some((k) => prod.includes(k))) return "cd";
  return "cd"; // corte e dobra, perfis, chapas (fallback seguro p/ produção C&D)
}

export function itensPorGrupo(itens, grupo) {
  return itens.filter((i) => classGrupo(i) === grupo);
}

// Percentual global baseado em TODOS os itens do pedido
export function computePercentual(itens) {
  if (!itens || itens.length === 0) return 0;
  const concluidos = itens.filter((i) => i.status === "concluido").length;
  return Math.round((concluidos / itens.length) * 100);
}

// Percentual de um sub-pacote (ex: só telhas)
export function computePercentualGrupo(itens, grupo) {
  const sub = itensPorGrupo(itens, grupo);
  if (sub.length === 0) return 0;
  const concluidos = sub.filter((i) => i.status === "concluido").length;
  return Math.round((concluidos / sub.length) * 100);
}

export function buildItensJson(itens) {
  return JSON.stringify(
    itens.map(({ _idx, ...rest }) => rest)
  );
}

// Determina o status_pcp do pedido com base no percentual
export function statusPcpPorPercentual(percentual, atual) {
  if (percentual >= 100) return "concluido";
  if (percentual > 0) return "em_producao";
  return atual === "distribuido" ? "distribuido" : (atual || "distribuido");
}

export const STATUS_ITEM = {
  pendente: { label: "Pendente", cls: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400" },
  em_producao: { label: "Em Produção", cls: "bg-amber-100 text-amber-700 border-amber-300", dot: "bg-amber-500" },
  concluido: { label: "Concluído", cls: "bg-emerald-100 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" }
};

export const MAQUINAS_CD = [
  "Dobradeira 3m",
  "Dobradeira 6m",
  "Guilhotina 3m",
  "Guilhotina 6m",
  "Perfiladeira"
];

// Detecta o tipo exato de produto para Telhas (compatível com PRODUTOS do formulário)
export function detectarTipoProdutoTelha(produtoTexto = "") {
  const p = String(produtoTexto || "").toUpperCase();
  if (p.includes("MANTA") || p.includes("EPS50+MANTA") || p.includes("EPS+MANTA") || p.includes("EPS + MANTA")) {
    return "TELHA + EPS + MANTA";
  }
  if (p.includes("EPS+TELHA") || p.includes("EPS + TELHA") || p.includes("TELHA+EPS+TELHA") || p.includes("TELHA + EPS + TELHA")) {
    return "TELHA + EPS + TELHA";
  }
  if (p.includes("BANDEJA")) {
    return "TELHA BANDEJA";
  }
  if (p.includes("EPS")) {
    return "TELHA + EPS";
  }
  if (p.includes("BOBININHA")) {
    return "BOBININHA";
  }
  if (p.includes("CUMEEIRA")) {
    return "CUMEEIRA";
  }
  if (p.includes("PAINEL")) {
    return "PAINEL";
  }
  return "TELHA";
}

// Detecta a máquina sugerida para Telhas
export function detectarMaquinaTelha(produtoTexto = "") {
  const p = String(produtoTexto || "").toUpperCase();
  if (p.includes("TP 25") || p.includes("TP-25") || p.includes("TP25")) return "TP - 25";
  if (p.includes("TP 40") || p.includes("TP-40") || p.includes("TP40")) return "TP - 40";
  if (p.includes("ONDULAD")) return "ONDULADA";
  if (p.includes("COLONIAL")) return "COLONIAL";
  if (p.includes("BANDEJA")) return "BANDEJA";
  if (p.includes("DESBOBINADOR") || p.includes("BOBININHA")) return "DESBOBINADOR";
  if (p.includes("CUMEEIRA")) return "CUMEEIRA";
  return "";
}

// Detecta a espessura exigida a partir do texto do produto
export function detectarEspessura(produtoTexto = "") {
  const p = String(produtoTexto || "").toLowerCase().replace(",", ".").replace(/\s/g, "");
  const match = p.match(/(\d{1,2}[.,]?\d{0,2})\s*(mm)?/);
  if (!match) return "";
  let esp = match[1].replace(".", ",");
  // Heurística: valores baixos (ex: 0,43 / 0,50 / 0,65) são espessuras reais
  const num = parseFloat(match[1]);
  if (num > 0 && num < 10) return esp;
  return "";
}

// Detecta a origem do aço exigida (Nacional / Importado / ambas)
export function detectarOrigemAco(produtoTexto = "") {
  const p = String(produtoTexto || "").toLowerCase();
  if (p.includes("nacional") || p.includes("nac")) return "Nacional";
  if (p.includes("importad") || p.includes("imp")) return "Importado";
  return "ambas";
}

// Monta o preset completo de Nova Ordem para Telhas
export function prepararPresetNovaOrdemTelhas(pedido, item, filialAtiva) {
  const produtoNome = item?.produto || item?.descricao || "";
  const prodTipo = detectarTipoProdutoTelha(produtoNome);
  const maq = detectarMaquinaTelha(produtoNome);
  const esp = item?.espessura ? String(item.espessura) : detectarEspessura(produtoNome);
  const origem = item?.origem || detectarOrigemAco(produtoNome);

  return {
    _presets: {
      data: new Date().toISOString().slice(0, 10),
      numero_pedido: pedido?.numero_pedido || "",
      cliente: pedido?.cliente_nome || "",
      vendedor: pedido?.vendedor_nome || "",
      unidade: filialAtiva || pedido?.unidade || "Matriz AJL",
      produto: prodTipo,
      produto_rotulo_pcp: produtoNome,
      maquina: maq,
      espessura_exigida: esp,
      origem_exigida: origem,
      quantidade_telhas: item?.quantidade || "",
      metros: item?.quantidade || "",
      trava_produto_pcp: true,
    }
  };
}