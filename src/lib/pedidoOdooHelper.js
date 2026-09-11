import { stripHtml } from "@/lib/stripHtml";

// Helper compartilhado para itens de PedidoOdoo com status por peça.
// Normaliza itens_json garantindo campos de status por item.

const STATUS_DEFAULTS = {
  status: "pendente",        // pendente | em_producao | concluido
  maquina: "",               // máquina selecionada (CD)
  quantidade_produzida: 0,   // peças já produzidas (CD)
  medicao: ""                // medição conferida (CD)
};

export function getItens(pedido) {
  if (!pedido) return [];
  let arr = [];
  if (Array.isArray(pedido.itens)) {
    arr = pedido.itens;
  } else if (typeof pedido.itens_json === "string" && pedido.itens_json.trim()) {
    try { arr = JSON.parse(pedido.itens_json); } catch { arr = []; }
  } else if (Array.isArray(pedido.itens_json)) {
    arr = pedido.itens_json;
  }
  return arr.map((it, idx) => ({ ...STATUS_DEFAULTS, ...it, _idx: idx }));
}

// Aceita item individual (obj), Pedido/OF completo (obj com itens_json) ou categoria + produto (strings)
export function classGrupo(itemOrCat, produtoNome = "") {
  let cat = "";
  let prod = "";
  let itens = [];

  if (typeof itemOrCat === "object" && itemOrCat !== null) {
    // Se for objeto Pedido ou OF, tenta inspecionar itens_json / itens
    if (Array.isArray(itemOrCat.itens)) {
      itens = itemOrCat.itens;
    } else if (typeof itemOrCat.itens_json === "string" && itemOrCat.itens_json.trim()) {
      try { itens = JSON.parse(itemOrCat.itens_json); } catch {}
    } else if (Array.isArray(itemOrCat.itens_json)) {
      itens = itemOrCat.itens_json;
    }

    if (itens.length > 0) {
      // Prioridade: inspeciona os itens reais da ordem de fabricação
      const first = itens[0] || {};
      cat = String(first.categoria || itemOrCat.categoria || "").trim().toLowerCase();
      prod = String(first.produto || first.descricao || first.observacao || itemOrCat.produto || itemOrCat.descricao || itemOrCat.of_nome || "").trim().toLowerCase();
    } else {
      cat = String(itemOrCat.categoria || "").trim().toLowerCase();
      prod = String(itemOrCat.produto || itemOrCat.descricao || itemOrCat.observacao || itemOrCat.of_nome || "").trim().toLowerCase();
    }

    // Se o pedido tiver contagens de itens pré-computadas e nenhum item detalhado
    if (itens.length === 0 && !prod) {
      if ((itemOrCat.itens_telha_count || 0) > 0 && !(itemOrCat.itens_cd_count > 0) && !(itemOrCat.itens_frisada_count > 0)) return "telha";
      if ((itemOrCat.itens_frisada_count || 0) > 0 && !(itemOrCat.itens_cd_count > 0) && !(itemOrCat.itens_telha_count > 0)) return "frisada";
      if ((itemOrCat.itens_cd_count || 0) > 0 && !(itemOrCat.itens_telha_count > 0) && !(itemOrCat.itens_frisada_count > 0)) return "cd";
    }
  } else {
    cat = String(itemOrCat || "").trim().toLowerCase();
    prod = String(produtoNome || "").trim().toLowerCase();
  }

  // 1. Frisadas / Lambris (prioridade sobre C&D genérico)
  if (["frisadas", "frisada"].includes(cat) || /(frisad|lambri)/i.test(prod) || /(frisad|lambri)/i.test(cat)) return "frisada";

  // 2. Telhas e acessórios de telhas
  if (["telhas", "telha", "bandeja", "bobininha"].includes(cat)) return "telha";
  if (/(telha|tp\s*-?\s*25|tp\s*-?\s*40|termoac[uú]stica|sandu[ií]che|eps|manta|cumeeira|ondulada|colonial|bandeja|bobininha)/i.test(prod)) return "telha";

  // 3. Corte & Dobra / Perfis / Chapas
  if (["chapa", "perfil", "barra", "tubo", "zincado", "corte e dobra", "corte_dobra", "cd"].some((k) => cat.includes(k))) return "cd";
  if (["chapa", "perfil", "barra", "tubo", "zincado", "cantoneira", "ferro", "dobra"].some((k) => prod.includes(k))) return "cd";

  // Fallbacks adicionais por texto
  if (["telha", "tp-", "tp ", "eps", "manta"].some((k) => prod.includes(k))) return "telha";
  return "cd"; // fallback seguro p/ produção C&D
}

export function itensPorGrupo(itens, grupo) {
  return itens.filter((i) => classGrupo(i) === grupo);
}

// Percentual global baseado em TODOS os itens do pedido (considerando etapas reais de produção)
export function computePercentual(itens) {
  if (!itens || itens.length === 0) return 0;
  let totalPontos = 0;
  for (const it of itens) {
    if (it.status === "concluido" || it.status === "finalizado") {
      totalPontos += 1.0;
    } else if (it.status === "aguardando_colagem") {
      totalPontos += 0.85;
    } else if (it.status === "em_producao") {
      totalPontos += 0.50; // OP criada na máquina / em produção
    } else if (it.maquina) {
      totalPontos += 0.50; // Máquina atribuída
    } else {
      totalPontos += 0.15; // Distribuído na fila
    }
  }
  return Math.min(100, Math.round((totalPontos / itens.length) * 100));
}

// Percentual de um sub-pacote (ex: só telhas)
export function computePercentualGrupo(itens, grupo) {
  const sub = itensPorGrupo(itens, grupo);
  if (sub.length === 0) return 0;
  return computePercentual(sub);
}

// Calcula o progresso real e dinâmico consultando as OPs de produção nas máquinas
export function calcularProgressoRealPedido(pedido, pedidosProducao = [], ordensCD = []) {
  if (!pedido) return 0;
  const itens = getItens(pedido);
  if (!itens || itens.length === 0) return pedido.percentual_concluido || 0;

  const numPed = String(pedido.numero_pedido || "").trim().toUpperCase();
  const ofId = String(pedido.of_odoo_id || pedido.odoo_id || "").trim().toUpperCase();
  const ofNome = String(pedido.of_nome || "").trim().toUpperCase();

  const matchOp = (op) => {
    if (!op || op.status === "cancelado") return false;
    if (ofId && op.of_odoo_id && String(op.of_odoo_id).trim().toUpperCase() === ofId) return true;
    if (ofNome && op.of_nome && String(op.of_nome).trim().toUpperCase() === ofNome) return true;
    if (op.pedido_odoo_id && op.pedido_odoo_id === pedido.id) return true;
    if (op.numero_pedido && String(op.numero_pedido).trim().toUpperCase() === numPed) return true;
    return false;
  };

  const opsTelha = (pedidosProducao || []).filter(matchOp);
  const opsCD = (ordensCD || []).filter(matchOp);

  let soma = 0;
  for (const it of itens) {
    const grupo = classGrupo(it);
    let opReal = null;

    if (grupo === "telha") {
      opReal = opsTelha.find(o =>
        String(o.produto || "").toUpperCase().includes(String(it.produto || "").toUpperCase())
      ) || opsTelha[0];
    } else {
      opReal = opsCD.find(o =>
        String(o.produto || "").toUpperCase().includes(String(it.produto || "").toUpperCase())
      ) || opsCD[0];
    }

    if (opReal) {
      if (opReal.status === "finalizado") {
        soma += 100;
      } else if (opReal.status === "aguardando_colagem") {
        soma += 85;
      } else if (opReal.status === "em_producao") {
        soma += 75; // Operador deu Play / máquina rodando!
      } else if (opReal.status === "pausado") {
        soma += 60;
      } else if (opReal.status === "pendente") {
        soma += 50; // OP criada na máquina (ex: TP - 25)!
      } else if (opReal.status === "aguardando_corte" || opReal.status === "aguardando_material") {
        soma += 25;
      } else {
        soma += 0;
      }
    } else if (it.status === "concluido") {
      soma += 100;
    } else if (it.status === "em_producao" || it.maquina) {
      soma += 50;
    } else if (pedido.status_pcp === "distribuido") {
      soma += 15; // Distribuído para galpão
    } else {
      soma += 0;
    }
  }

  return Math.min(100, Math.round(soma / itens.length));
}

// Retorna status descritivo e claro para cada item (ex: "Aguardando Início (TP - 25)", "Aguardando Revisão (C&D)")
export function obterStatusDescritivoItem(it, pedido, pedidosProducao = [], ordensCD = []) {
  const g = classGrupo(it);
  const numPed = String(pedido?.numero_pedido || "").trim().toUpperCase();
  const ofId = String(pedido?.of_odoo_id || pedido?.odoo_id || "").trim().toUpperCase();
  const ofNome = String(pedido?.of_nome || "").trim().toUpperCase();

  const matchOp = (op) => {
    if (!op || op.status === "cancelado") return false;
    if (ofId && op.of_odoo_id && String(op.of_odoo_id).trim().toUpperCase() === ofId) return true;
    if (ofNome && op.of_nome && String(op.of_nome).trim().toUpperCase() === ofNome) return true;
    if (op.pedido_odoo_id && op.pedido_odoo_id === pedido?.id) return true;
    if (op.numero_pedido && String(op.numero_pedido).trim().toUpperCase() === numPed) return true;
    return false;
  };

  const opsTelha = (pedidosProducao || []).filter(matchOp);
  const opsCD = (ordensCD || []).filter(matchOp);

  let opReal = null;
  if (g === "telha") {
    opReal = opsTelha.find(o =>
      String(o.produto || "").toUpperCase().includes(String(it.produto || "").toUpperCase())
    ) || opsTelha[0];
  } else {
    opReal = opsCD.find(o =>
      String(o.produto || "").toUpperCase().includes(String(it.produto || "").toUpperCase())
    ) || opsCD[0];
  }

  const isSanduiche = /(eps|manta|sanduiche|isopor|termoacustica)/i.test(
    String(it.produto || it.descricao || "")
  );

  if (opReal) {
    const maquinaNome = opReal.maquina || it.maquina || (g === "telha" ? "Perfiladeira" : "C&D");
    if (opReal.status === "finalizado") {
      return {
        status: "Concluído",
        status_detalhado: "100% Concluído",
        pct: 100,
        maquina: maquinaNome,
        fase: "concluido",
        etapaAtiva: 4
      };
    }
    if (opReal.status === "aguardando_colagem") {
      return {
        status: "Aguardando Colagem",
        status_detalhado: "Telha Cortada — Aguardando Colagem",
        pct: 85,
        maquina: "Bancada Colagem",
        fase: "colagem",
        etapaAtiva: 3
      };
    }
    if (opReal.status === "em_producao") {
      return {
        status: `Em Produção (${maquinaNome})`,
        status_detalhado: `Em Produção na Máquina ${maquinaNome}`,
        pct: 75,
        maquina: maquinaNome,
        fase: "em_producao",
        etapaAtiva: 1
      };
    }
    if (opReal.status === "pausado") {
      return {
        status: `Pausado (${maquinaNome})`,
        status_detalhado: `Produção Pausada na Máquina ${maquinaNome}`,
        pct: 60,
        maquina: maquinaNome,
        fase: "pausado",
        etapaAtiva: 1
      };
    }
    if (opReal.status === "pendente") {
      return {
        status: `Aguardando Início (${maquinaNome})`,
        status_detalhado: `Na Máquina ${maquinaNome} — Aguardando Início`,
        pct: 50,
        maquina: maquinaNome,
        fase: "aguardando_inicio",
        etapaAtiva: 1
      };
    }
  }

  // Se não foi criada OP na máquina ainda
  if (it.status === "concluido") {
    return {
      status: "Concluído",
      status_detalhado: "100% Concluído",
      pct: 100,
      maquina: it.maquina || "",
      fase: "concluido",
      etapaAtiva: 4
    };
  }
  if (it.status === "em_producao" || it.maquina) {
    const maq = it.maquina || (g === "telha" ? "Telhas" : "C&D");
    return {
      status: `Aguardando Início (${maq})`,
      status_detalhado: `Na Máquina ${maq} — Aguardando Início`,
      pct: 50,
      maquina: maq,
      fase: "aguardando_inicio",
      etapaAtiva: 1
    };
  }
  if (pedido?.status_pcp === "distribuido") {
    const setorNome = g === "telha" ? "Fila Telhas" : "Fila Corte & Dobra";
    return {
      status: `Aguardando Revisão (${setorNome})`,
      status_detalhado: `Aguardando Revisão do Encarregado (${setorNome})`,
      pct: 15,
      maquina: "",
      fase: "aguardando_revisao",
      etapaAtiva: 1
    };
  }

  return {
    status: "Aguardando Distribuição (PCP)",
    status_detalhado: "Aguardando Distribuição na Central PCP",
    pct: 0,
    maquina: "",
    fase: "pendente_pcp",
    etapaAtiva: 1
  };
}

export function enriquecerItensComStatusReal(pedido, pedidosProducao = [], ordensCD = []) {
  const itens = getItens(pedido);
  return itens.map((it) => {
    const info = obterStatusDescritivoItem(it, pedido, pedidosProducao, ordensCD);
    return {
      ...it,
      status: info.status,
      status_detalhado: info.status_detalhado,
      percentual: info.pct,
      maquina: info.maquina || it.maquina || ""
    };
  });
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

// Detecta a espessura no texto (ex: "(0,43)", "0.43", "0,50", "0.65", "1,25", etc.)
export function detectarEspessura(produtoTexto = "") {
  const p = String(produtoTexto || "");
  const matchPar = p.match(/\((\d+[.,]\d+)\s*\)/);
  if (matchPar) return matchPar[1].replace(".", ",");
  const match = p.match(/(0[,.]\d{1,3}|1[,.]\d{1,3}|2[,.]\d{1,3})/);
  return match ? match[1].replace(".", ",") : "";
}

// Detecta a origem do aço exigida (Nacional / Importado / ambas)
export function detectarOrigemAco(produtoTexto = "") {
  const p = String(produtoTexto || "").toLowerCase();
  if (p.includes("nacional") || p.includes("nac")) return "Nacional";
  if (p.includes("importad") || p.includes("imp")) return "Importado";
  return "ambas";
}

// Detecta o tipo de EPS a partir do texto do produto, modelo ou da máquina da telha
export function detectarEPSTelha(produtoTexto = "", maquina = "") {
  const p = String(produtoTexto || "").toUpperCase();
  const m = String(maquina || "").toUpperCase();

  // 1. Verifica no nome da máquina da telha
  if (m.includes("COLONIAL") && (m.includes("BANDEJA") || p.includes("BANDEJA"))) return "EPS - COLONIAL BANDEJA";
  if (m.includes("COLONIAL")) return "EPS - COLONIAL";
  if (m.includes("BANDEJA")) return "EPS - TP 40 BANDEJA";
  if (m.includes("TP 25") || m.includes("TP-25") || m.includes("TP25")) return "EPS - TP 25";
  if (m.includes("TP 40") || m.includes("TP-40") || m.includes("TP40")) return "EPS - TP 40";
  if (m.includes("ONDULAD")) return "EPS - ONDULADO";

  // 2. Verifica no texto do produto / rótulo PCP
  if (p.includes("COLONIAL") && p.includes("BANDEJA")) return "EPS - COLONIAL BANDEJA";
  if (p.includes("COLONIAL")) return "EPS - COLONIAL";
  if (p.includes("BANDEJA") || p.includes("TP 40 BANDEJA") || p.includes("TP-40 BANDEJA")) return "EPS - TP 40 BANDEJA";
  if (p.includes("TP 25") || p.includes("TP-25") || p.includes("TP25")) return "EPS - TP 25";
  if (p.includes("TP 40") || p.includes("TP-40") || p.includes("TP40")) return "EPS - TP 40";
  if (p.includes("ONDULAD")) return "EPS - ONDULADO";

  return "";
}

import { calcularDataPrometidaSLA, toISODate } from "@/lib/sla";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { extrairCroquiPedido } from "@/lib/croquiExtractor";

// Monta o preset completo de Nova Ordem para Telhas
export function prepararPresetNovaOrdemTelhas(pedido, item, filialAtiva) {
  const produtoNome = item?.produto || item?.descricao || "";
  const prodTipo = detectarTipoProdutoTelha(produtoNome);
  const maq = detectarMaquinaTelha(produtoNome);
  const esp = item?.espessura ? String(item.espessura) : detectarEspessura(produtoNome);
  const origem = item?.origem || detectarOrigemAco(produtoNome);
  const isComEps = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(prodTipo) ||
    /(eps|manta|sanduiche|isopor|termoacustica)/i.test(produtoNome);
  const eps = isComEps ? detectarEPSTelha(produtoNome, maq) : "";

  const dataReceb = pedido?.data_recebimento ? String(pedido.data_recebimento).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const dataPrevista = pedido?.data_entrega
    ? String(pedido.data_entrega).slice(0, 10)
    : toISODate(calcularDataPrometidaSLA(dataReceb, 7));

  // Extrai especificação inteligente da descrição (ex: "50 PÇS c/ 2000\")
  const descTexto = item?.descricao || item?.observacao || pedido?.observacoes || "";
  const espTec = extrairEspecificacao(descTexto, item?.quantidade, item?.unidade);

  // No formulário de Telhas:
  // - metros = quantidade de chapas / peças a cortar (ex: 50)
  // - metragem_mm = comprimento unitário da telha em mm (ex: 2000)
  // - quantidade_telhas = metragem linear total do pedido em metros (ex: 100m)
  let qtdChapas = item?.quantidade || "";
  let metragemMm = "";
  let metragemTotalLinear = item?.quantidade || "";
  let variacoesTelhasJson = "";

  if (espTec.tem_especificacao) {
    if (espTec.variacoes && espTec.variacoes.length > 1) {
      qtdChapas = espTec.quantidade;
      metragemMm = espTec.comprimento_mm || "";
      metragemTotalLinear = espTec.metragem_total || item?.quantidade || "";
      variacoesTelhasJson = JSON.stringify(espTec.variacoes);
    } else if (espTec.comprimento_mm && espTec.quantidade) {
      qtdChapas = espTec.quantidade; // ex: 50 peças
      metragemMm = espTec.comprimento_mm; // ex: 2000 mm
      metragemTotalLinear = espTec.metragem_total || item?.quantidade || ""; // ex: 100 metros
    } else if (espTec.quantidade) {
      qtdChapas = espTec.quantidade;
      if (espTec.comprimento_mm) metragemMm = espTec.comprimento_mm;
      metragemTotalLinear = espTec.metragem_total || item?.quantidade || "";
    }
  }

  return {
    _presets: {
      data: dataReceb,
      data_pedido: dataReceb,
      data_prevista: dataPrevista,
      numero_pedido: pedido?.numero_pedido || "",
      cliente: pedido?.cliente_nome || "",
      vendedor: pedido?.vendedor_nome || "",
      unidade: filialAtiva || pedido?.unidade || "Matriz AJL",
      produto: prodTipo,
      produto_rotulo_pcp: produtoNome,
      maquina: maq,
      eps: eps,
      espessura_exigida: esp,
      origem_exigida: origem,
      quantidade_telhas: metragemTotalLinear,
      metros: qtdChapas,
      metragem_mm: metragemMm,
      metragem_planejada: metragemTotalLinear,
      variacoes_telhas: variacoesTelhasJson,
      observacoes_odoo: descTexto,
      observacoes_encarregado: "",
      foto_pedido_url: item?.foto_url || item?.imagem_url || pedido?.foto_pedido_url || extrairCroquiPedido(pedido) || "",
      trava_produto_pcp: true,
    }
  };
}

// Normaliza número de pedido para comparação consistente (remove '#', prefixos, espaços e símbolos)
export function normalizarNumPedido(num) {
  if (num === null || num === undefined) return "";
  return String(num)
    .replace(/^(pedido|ped|op|ordem)\s*#?/i, "")
    .replace(/^#+/, "")
    .trim()
    .toUpperCase();
}

// Compara se dois números de pedido são equivalentes
export function saoPedidosIguais(num1, num2) {
  if (!num1 || !num2) return false;
  const s1 = normalizarNumPedido(num1);
  const s2 = normalizarNumPedido(num2);
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;

  // Comparação sem pontuação ou caracteres não alfanuméricos
  const clean1 = s1.replace(/[^a-zA-Z0-9]/g, "");
  const clean2 = s2.replace(/[^a-zA-Z0-9]/g, "");
  return Boolean(clean1 && clean2 && clean1 === clean2);
}

/**
 * Extrai a anotação/instrução real do vendedor para um item do pedido Odoo.
 * Elimina falsos positivos onde o Odoo envia o próprio nome do produto, modelo base
 * ou variantes (ex: "(Padrão KG)", "Chapa 1,25 GV") no campo de observação.
 * Se houver anotação real (ex: "1 Chapa 1,25 GV (Padrão KG) - Teste de anotação"),
 * remove o prefixo do nome do produto e retorna apenas o texto da anotação: "Teste de anotação".
 */
export function extrairAnotacaoItem(item) {
  if (!item) return "";
  const prodRaw = stripHtml(item.produto || "").trim();
  const obsRaw = stripHtml(item.observacao || "").trim();
  const descRaw = stripHtml(item.descricao || "").trim();

  // Candidato prioritário: observacao. Se não houver, usa descricao se diferente de produto
  let texto = obsRaw || (descRaw !== prodRaw ? descRaw : "");
  if (!texto) return "";

  // Helper de canonicidade para desconsiderar acentos, pontuações, variações de código
  const canonico = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\[\d+\]/g, "")
      .replace(/^\s*\d+\s*[-–]?\s*/g, "")
      .replace(/\(padr[aã]o[^)]*\)/gi, "")
      .replace(/[^\w\d]/g, "")
      .trim();

  const cProd = canonico(prodRaw);
  const cTexto = canonico(texto);

  // Se o texto for idêntico ao produto ou vazio após normalização
  if (!cTexto || cTexto === cProd) {
    return "";
  }

  // Se for uma substring do produto com 6+ caracteres (ex: "Chapa 1,25 GV" dentro de "1 Chapa 1,25 GV (Padrão KG)")
  if (cProd && cProd.includes(cTexto) && cTexto.length >= 6) {
    return "";
  }

  // Se contiver quebras de linha e a primeira linha for apenas o nome do produto
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length > 1) {
    const primeiraLinhaCanon = canonico(linhas[0]);
    if (primeiraLinhaCanon === cProd || (cProd && cProd.includes(primeiraLinhaCanon))) {
      const resto = linhas.slice(1).join("\n").trim();
      if (resto && canonico(resto) !== cProd) {
        return resto;
      }
    }
  }

  // Se o texto começar com o nome do produto ou a versão base dele seguido de anotação:
  // Ex: "1 Chapa 1,25 GV (Padrão KG) - Teste de anotação"
  let resto = texto;
  const separadorRegex = /^[\s\-–—:;,\/]+/;

  if (prodRaw && resto.toLowerCase().startsWith(prodRaw.toLowerCase())) {
    resto = resto.slice(prodRaw.length).replace(separadorRegex, "").trim();
  } else {
    const prodBase = prodRaw
      .replace(/^\[\d+\]\s*/, "")
      .replace(/^\d+\s*[-–]\s*/, "")
      .replace(/\s*\(padr[aã]o[^)]*\)/i, "")
      .trim();

    if (prodBase && prodBase.length >= 4 && resto.toLowerCase().startsWith(prodBase.toLowerCase())) {
      resto = resto.slice(prodBase.length).replace(separadorRegex, "").trim();
    }
  }

  const cResto = canonico(resto);
  if (!cResto || cResto === cProd || (cProd && cProd.includes(cResto) && cResto.length >= 6)) {
    return "";
  }

  return resto;
}