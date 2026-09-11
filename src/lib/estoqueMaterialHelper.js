import {
  extrairEspecificacao,
  extrairPesoDoTexto,
  extrairDimensoesPerfil,
  extrairDimensoesChapa,
  extrairPecasDaObs
} from "./descricaoExtractor.js";
import { getItens, classGrupo } from "./pedidoOdooHelper.js";

/**
 * Normaliza espessura para formato numérico float.
 * Aceita "0,43", "0.43", "1,95", etc.
 */
export function parseEspessuraToNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const s = String(value).replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Normaliza espessura em string formatada brasileira (ex: "0,43", "1,95").
 */
export function normalizeEspessura(val) {
  if (val == null || val === "") return "";
  const n = parseEspessuraToNumber(val);
  if (n == null) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ESPESSURAS_COMERCIAIS = [
  0.35, 0.38, 0.40, 0.43, 0.45, 0.47, 0.50, 0.65, 0.70, 0.75, 0.80, 0.90, 0.95,
  1.00, 1.06, 1.11, 1.20, 1.25, 1.50, 1.55, 1.80, 1.90, 1.95, 2.00, 2.20, 2.22,
  2.25, 2.30, 2.50, 2.65, 2.70, 2.75, 3.00, 3.17, 3.18, 3.35, 3.75, 4.00, 4.25,
  4.75, 5.00, 6.00, 6.35, 7.93, 8.00, 9.52, 12.70
];

/**
 * Extrai a espessura da descrição ou nome do produto se não houver campo explícito.
 */
export function extrairEspessuraDoTexto(texto) {
  if (!texto) return null;
  const str = String(texto);
  
  // 1. Regex entre parênteses: (0,43) ou (1.95) ou (1,95mm)
  const mPar = str.match(/\((\d+[.,]\d+)(?:\s*mm)?\)/i);
  if (mPar) return mPar[1].replace(".", ",");

  // 2. Notação com unidade ou sigla metalúrgica logo após o número:
  // Ex: 1,95mm, 1,95 mm, 1,95 GI, 1,95 GL, 1,95 GALV, 1,95 FF, 1,95 FQ, 1,95 ZN, 1,95 CH, 1,95 CHAPA
  const mSigla = str.match(/\b(\d+[.,]\d+)\s*(?:mm\b|gi\b|gl\b|galv\b|galvalume\b|zinc\b|zn\b|ff\b|fq\b|ch\b|ch\.|chapa\b)/i);
  if (mSigla) return mSigla[1].replace(".", ",");

  // 3. Notação de chapa/espessura antes do número: ch 1,95 ou ch. 1.95 ou chapa 1,95 ou esp 1,95
  const mCh = str.match(/(?:ch\b|ch\.|chapa|esp\b|esp\.|espessura)\s*[:=]?\s*(\d+[.,]\d+)/i);
  if (mCh) return mCh[1].replace(".", ",");

  // 4. Dimensões seguidas de espessura (tubos e perfis: 40x60 1,95 ou 40x60x1,95 ou 75x40 1,95 ou 100x50x2,00)
  const mDimEsp = str.match(/\d+\s*[xX]\s*\d+\s*(?:[xX\s])\s*(\d+[.,]\d+)/);
  if (mDimEsp) return mDimEsp[1].replace(".", ",");

  // 5. Polegadas fracionárias comuns na metalurgia
  if (str.includes("5/16")) return "7,93";
  if (str.includes("1/4")) return "6,35";
  if (str.includes("3/16")) return "4,75";
  if (str.includes("1/8")) return "3,17";
  if (str.includes("1/2")) return "12,70";

  // 6. Bitolas/calibres comerciais comuns na metalurgia (#14, chapa #16, MSG 14, etc.)
  const GAUGE_MAP = {
    "12": "2,65",
    "13": "2,25",
    "14": "1,95",
    "16": "1,55",
    "18": "1,25",
    "19": "1,11",
    "20": "0,90",
    "22": "0,75",
    "24": "0,65",
    "26": "0,45",
    "28": "0,40"
  };
  const mGauge = str.match(/(?:#|msg\s*#?|ch\s*#)\s*(1[2-9]|2[0-8])\b/i);
  if (mGauge && GAUGE_MAP[mGauge[1]]) return GAUGE_MAP[mGauge[1]];

  // 7. Número decimal isolado que corresponda a uma espessura padrão comercial de aço/chapa
  const mDec = str.match(/\b(\d+[.,]\d+)\b/g);
  if (mDec) {
    for (const d of mDec) {
      const num = parseFloat(d.replace(",", "."));
      if (!isNaN(num) && ESPESSURAS_COMERCIAIS.some((ec) => Math.abs(ec - num) < 0.02)) {
        return d.replace(".", ",");
      }
    }
  }

  return null;
}

/**
 * Extrai a cor do texto do produto ou descrição.
 */
export function extrairCorDoTexto(texto) {
  if (!texto) return null;
  const CORES = [
    { nome: "Branca", regex: /\b(branc[ao]|white)\b/i },
    { nome: "Preto", regex: /\b(pret[ao]|black)\b/i },
    { nome: "Azul", regex: /\b(azul|blue)\b/i },
    { nome: "Cinza", regex: /\b(cinza|gray|grey)\b/i },
    { nome: "Vermelha", regex: /\b(vermelh[ao]|red)\b/i },
    { nome: "Verde", regex: /\b(verde|green)\b/i },
    { nome: "Bege", regex: /\b(bege|beige)\b/i },
    { nome: "Grafite", regex: /\b(grafite)\b/i },
    { nome: "Terracota", regex: /\b(terracota)\b/i },
    { nome: "Marrom", regex: /\b(marrom|brown)\b/i }
  ];
  for (const c of CORES) {
    if (c.regex.test(texto)) return c.nome;
  }
  return null;
}

/**
 * Retorna lista de espessuras numéricas suportadas por uma bobina.
 */
export function getBobinaEspessuras(bobina) {
  const vals = [];
  const add = (v) => {
    const n = parseEspessuraToNumber(v);
    if (n != null && !vals.includes(n)) vals.push(n);
  };
  if (bobina.espessura_utilizada) {
    String(bobina.espessura_utilizada).split("/").forEach((p) => add(p));
  }
  add(bobina.espessura_real);
  add(bobina.chapa);
  add(bobina.espessura_mm);
  return vals;
}

/**
 * Verifica se a bobina atende à espessura nominal solicitada (tolerância estrita de até 0,03mm).
 * IMPORTANTE: Se espNominal for nula/indefinida, retorna estritamente FALSE!
 */
export function isEspCompativel(b, espNominal) {
  const reqNum = parseEspessuraToNumber(espNominal);
  if (reqNum == null) return false;
  const bList = getBobinaEspessuras(b);
  if (bList.length === 0) return false;
  return bList.some((e) => Math.abs(e - reqNum) < 0.03);
}

/**
 * Verifica compatibilidade de cor da bobina.
 */
export function isCorCompativel(bCor, itemCor) {
  const ic = (itemCor || "Natural").trim().toLowerCase();
  const bc = (bCor || "Natural").trim().toLowerCase();
  if (ic === "natural" || ic === "galvalume" || ic === "gv" || ic === "gl") {
    return (
      bc.includes("natural") ||
      bc.includes("galv") ||
      bc.includes("gv") ||
      bc.includes("gl") ||
      bc === ""
    );
  }
  return bc.includes(ic) || ic.includes(bc);
}

/**
 * Extrai a demanda em metros lineares, peças e peso de um item.
 * Suporta Odoo onde a quantidade vem em KG e a quantidade real de peças está nas OBS,
 * ou estima automaticamente a quantidade de peças a partir do peso em KG caso não informado.
 */
export function extrairDemandaItem(item) {
  const prod = String(item.produto || item.descricao || item.name || "").trim();
  const desc = item.descricao || item.observacao || item.obs || "";
  const obs = item.observacao || item.obs || "";
  const qtdOdoo = Number(item.quantidade || item.qtd || 1);
  const unid = String(item.unidade || "UN").toUpperCase();

  const isKg = unid === "KG" || unid === "KGS" || unid === "QUILOS";
  const setor = classGrupo(item);

  // Espessura para cálculos físicos
  let rawEsp =
    item.espessura ||
    item.chapa ||
    item.thickness ||
    item.espessura_mm ||
    item.esp ||
    extrairEspessuraDoTexto(prod) ||
    extrairEspessuraDoTexto(desc) ||
    extrairEspessuraDoTexto(obs);
  const espNum = parseEspessuraToNumber(rawEsp) || (setor === "telha" ? 0.43 : 0.50);

  let pecas = qtdOdoo;
  let pecasOrigem = "odoo"; // "odoo" | "obs" | "estimado"
  let metros = 0;
  let compMm = 0;

  // 1. Tentar extrair especificação completa (ex: 2 pcs de 3000mm)
  const spec = extrairEspecificacao(desc, qtdOdoo, unid) || extrairEspecificacao(obs, qtdOdoo, unid);
  const pecasObs = extrairPecasDaObs(obs) || extrairPecasDaObs(desc);

  const isContagemDireta = ["UN", "UND", "UNID", "UNIDADE", "UNIDADES", "BR", "BARRA", "BARRAS", "PC", "PCS", "PECA", "PECAS", "FL", "FOLHA"].includes(unid);

  if (isKg) {
    // Quando vem em KG do Odoo (conforme conversão feita pelo Gui):
    // Prioridade 1: Quantidade de barras/peças informada pelo vendedor na OBS/descrição
    if (pecasObs != null) {
      pecas = pecasObs;
      pecasOrigem = "obs";
      if (spec && spec.metragem_total) metros = spec.metragem_total;
      if (spec && spec.comprimento_mm) compMm = spec.comprimento_mm;
    } else if (spec && spec.tem_especificacao && spec.pecas) {
      pecas = spec.pecas;
      pecasOrigem = "obs";
      metros = spec.metragem_total || 0;
      compMm = spec.comprimento_mm || 0;
    } else {
      // Prioridade 2: Estimativa física dimensional pelo peso em KG
      let pesoUnitario = 0;
      const dimChapa = extrairDimensoesChapa(prod) || extrairDimensoesChapa(desc) || extrairDimensoesChapa(obs);
      const dimPerfil = extrairDimensoesPerfil(prod) || extrairDimensoesPerfil(desc) || extrairDimensoesPerfil(obs);

      if (dimChapa) {
        pesoUnitario = +(dimChapa.largura_m * dimChapa.comprimento_m * espNum * 7.85).toFixed(2);
        compMm = dimChapa.comprimento_mm;
      } else if (dimPerfil) {
        const compM = 6.0; // Padrão barra 6 metros
        pesoUnitario = +(dimPerfil.desenvolvimento_m * compM * espNum * 7.85).toFixed(2);
        compMm = 6000;
      } else if (setor === "cd") {
        pesoUnitario = +(1.2 * 3.0 * espNum * 7.85).toFixed(2); // Padrão chapa 1200x3000
        compMm = 3000;
      } else if (setor === "telha") {
        const kgM = +(espNum * 7.85 * 1.2).toFixed(2);
        metros = +(qtdOdoo / (kgM || 4.05)).toFixed(1);
        pesoUnitario = +(kgM * 6.0).toFixed(2); // Padrão telha 6m
        compMm = 6000;
      }

      if (pesoUnitario > 0) {
        pecas = Math.max(1, Math.round(qtdOdoo / pesoUnitario));
        pecasOrigem = "estimado";
      } else {
        pecas = 1;
        pecasOrigem = "estimado";
      }
    }
  } else if (isContagemDireta) {
    // Unidade explícita de contagem no Odoo (BR, UN, PC, etc.)
    pecas = qtdOdoo;
    pecasOrigem = "odoo";
    if (spec && spec.metragem_total) metros = spec.metragem_total;
    if (spec && spec.comprimento_mm) compMm = spec.comprimento_mm;
  } else if (unid.startsWith("M")) {
    metros = qtdOdoo;
    pecas = (spec && spec.pecas) ? spec.pecas : 1;
    pecasOrigem = (spec && spec.pecas) ? "obs" : "odoo";
  } else if (pecasObs != null) {
  }

  // Extração de peso explícito se existir no pedido ou na descrição
  const pesoDireto = Number(item.peso_kg || item.kg_estimado || item.peso) || null;
  const pesoTexto = extrairPesoDoTexto(desc) || extrairPesoDoTexto(prod) || extrairPesoDoTexto(obs);
  const pesoKgInformado = pesoDireto || (isKg ? qtdOdoo : pesoTexto);

  return {
    pecas,
    pecasOrigem,
    metros,
    compMm,
    spec,
    pesoKgInformado,
    isKg,
    qtdOdoo,
    unidade: unid
  };
}

/**
 * Calcula o peso estimado rigoroso (em kg) que um item consumirá de matéria-prima.
 * Considera densidade do aço (7.85 kg/m² por mm), largura da bobina (1.20m para telhas),
 * faces duplas em telhas sanduíche e desenvolvimento de perfis em Corte & Dobra.
 */
export function calcularPesoEstimadoItem({ setor, espessura, demanda, isSanduiche, prod, desc }) {
  // 1. Se veio peso informado no Odoo ou descrição explícita:
  if (demanda.pesoKgInformado && demanda.pesoKgInformado > 0) {
    const origemTexto = demanda.pecasOrigem === "estimado"
      ? ` (${demanda.pecas} pç${demanda.pecas > 1 ? "s" : ""} est. de ${demanda.pesoKgInformado}kg)`
      : demanda.pecasOrigem === "obs"
      ? ` (${demanda.pecas} pç${demanda.pecas > 1 ? "s" : ""} conf. OBS)`
      : "";
    return {
      pesoKg: Math.round(demanda.pesoKgInformado),
      kgPorMetro: null,
      metodo: "informado_odoo",
      formula: `Peso informado no Odoo: ${demanda.pesoKgInformado} kg${origemTexto}`
    };
  }

  const espNum = parseEspessuraToNumber(espessura) || (setor === "telha" ? 0.43 : 1.95);

  // 2. Telhas e Frisadas: base na metragem linear da bobina (1.20m de largura padrão)
  if (setor === "telha" || setor === "frisada") {
    // Fórmula física: Espessura (mm) × Largura (1.20m) × 7.85 kg/m³ = kg/m
    const kgPorMetro = +(espNum * 7.85 * 1.2).toFixed(2);
    const metros = isSanduiche ? (demanda.metros * 2 || demanda.pecas * 4) : (demanda.metros || demanda.pecas * 2);
    const pesoKg = Math.max(1, Math.round(metros * kgPorMetro));
    return {
      pesoKg,
      kgPorMetro,
      metros,
      metodo: isSanduiche ? "formula_sanduiche_dupla_face" : "formula_telha_linear",
      formula: isSanduiche
        ? `${metros}m (${demanda.metros}m × 2 faces) × ${kgPorMetro} kg/m (${espNum}mm)`
        : `${metros}m × ${kgPorMetro} kg/m (${espNum}mm)`
    };
  }

  // 3. Corte & Dobra (C&D):
  if (setor === "cd") {
    const dimPerfil = extrairDimensoesPerfil(prod) || extrairDimensoesPerfil(desc);
    if (dimPerfil) {
      const compM = demanda.compMm > 0 ? (demanda.compMm / 1000) : 6.0; // Padrão barra de 6 metros
      const kgPorBarra = +(dimPerfil.desenvolvimento_m * compM * espNum * 7.85).toFixed(2);
      const pesoKg = Math.max(1, Math.round(demanda.pecas * kgPorBarra));
      const tipoNome = dimPerfil.tipo === "tubo" ? "tubos" : "barras";
      const tipoSingular = dimPerfil.tipo === "tubo" ? "tubo" : "barra";
      return {
        pesoKg,
        kgPorBarra,
        dimPerfil,
        compM,
        metodo: dimPerfil.tipo === "tubo" ? "formula_tubo_fechado" : "formula_perfil_dobrado",
        formula: `${demanda.pecas} ${tipoNome} de ${compM}m (${dimPerfil.base_mm}x${dimPerfil.aba_mm}mm #${espessura}mm) × ${kgPorBarra} kg/${tipoSingular}`
      };
    }

    // Se é chapa padrão sem perfil definido:
    const compM = demanda.compMm > 0 ? (demanda.compMm / 1000) : 3.0; // 3000mm padrão
    const largM = 1.2; // 1200mm padrão
    const kgPorChapa = +(largM * compM * espNum * 7.85).toFixed(2);
    const pesoKg = Math.max(1, Math.round(demanda.pecas * kgPorChapa));
    return {
      pesoKg,
      kgPorChapa,
      metodo: "formula_chapa_padrao",
      formula: `${demanda.pecas} peças × ${kgPorChapa} kg/peça (${espNum}mm)`
    };
  }

  return { pesoKg: 0, metodo: "desconhecido", formula: "—" };
}

/**
 * Avalia a disponibilidade de matéria-prima de um item específico do PCP
 * e SIMULA o peso e metragem antes vs depois do uso em cada bobina ou lote de chapa.
 */
export function verificarEstoqueItem(item, { bobinas = [], chapas = [], slitters = [] } = {}, pedido = null) {
  const prod = String(item.produto || item.descricao || item.name || "").trim();
  const desc = item.descricao || item.observacao || item.obs || "";
  const setor = classGrupo(item);

  // Espessura exigida: busca exaustiva em todos os campos e textos possíveis
  let rawEsp =
    item.espessura ||
    item.chapa ||
    item.thickness ||
    item.espessura_mm ||
    item.esp ||
    extrairEspessuraDoTexto(prod) ||
    extrairEspessuraDoTexto(desc) ||
    extrairEspessuraDoTexto(item.observacao) ||
    extrairEspessuraDoTexto(item.obs) ||
    extrairEspessuraDoTexto(item.name);

  // Fallback caso venha no pedido
  if (!rawEsp && pedido) {
    if (pedido.espessura) {
      rawEsp = pedido.espessura;
    } else if (Array.isArray(pedido.espessuras_tags) && pedido.espessuras_tags.length === 1) {
      rawEsp = pedido.espessuras_tags[0];
    }
  }

  // Telhas: se omitido e for fábrica de telhas, padrão do mercado é 0,43mm
  if (!rawEsp && setor === "telha") {
    rawEsp = "0,43";
  }

  const espessura = normalizeEspessura(rawEsp);
  const espNum = parseEspessuraToNumber(espessura);

  // Cor exigida
  const cor = item.cor || extrairCorDoTexto(desc) || extrairCorDoTexto(prod) || "Natural";

  // Demanda de peças e metros
  const demanda = extrairDemandaItem(item);

  // Telhas Termoacústicas (sanduíche com EPS/PU) exigem 2 chapas (superior e inferior)
  const isSanduiche = /(sandu[ií]che|termoac[uú]stica|eps|isopor|pir|pu)/i.test(prod);
  const metrosNecessarios = isSanduiche ? demanda.metros * 2 : demanda.metros;

  // Se a espessura for nula ou não puder ser determinada (especialmente em Corte & Dobra):
  // NUNCA fazer match cego com bobinas ou chapas de outras espessuras!
  if (!espessura || espNum == null) {
    return {
      setor,
      produto: prod,
      descricao: desc,
      itemOriginal: item,
      espessura: "",
      cor,
      status: "indisponivel",
      tipoMaterial: "nenhum",
      demanda: { ...demanda, metrosNecessarios, isSanduiche },
      calculoPeso: { pesoKg: 0, pesoPorPecaKg: 0, formula: "Espessura não identificada" },
      saldo: { metros: 0, kg: 0, bobinasCount: 0, chapasUn: 0, bobinasKg: 0 },
      bobinasSimuladas: [],
      chapasSimuladas: [],
      materiais: [],
      badgeText: "⚪ Espessura Indefinida",
      shortBadge: "⚪ S/ Espessura",
      detalhe: `Não foi possível identificar a espessura da matéria-prima no item "${prod}".`,
      opaMensagem: `Espessura não identificada no item "${prod}". Defina a espessura no Odoo para simular o estoque.`
    };
  }

  // Cálculo rigoroso do peso necessário em kg
  const calculoPeso = calcularPesoEstimadoItem({ setor, espessura, demanda, isSanduiche, prod, desc });
  const pesoNecessarioKg = calculoPeso.pesoKg;

  // ─────────────────────────────────────────────────────────────
  // 1. FÁBRICA DE TELHAS: Verifica e Simula Bobinas
  // ─────────────────────────────────────────────────────────────
  if (setor === "telha") {
    const bobsCompativeis = bobinas.filter((b) => {
      if (b.arquivada) return false;
      // Isolamento estrito de setor: NUNCA permitir bobinas de Corte & Dobra (CD...)
      const bSetor = String(b.setor || "").toLowerCase().trim();
      const bCod = String(b.codigo || b.codigo_bobina || "").toUpperCase().trim();
      if (bSetor === "cd" || bSetor === "corte_dobra" || bCod.startsWith("CD")) return false;
      if (bSetor && bSetor !== "telhas" && bSetor !== "telha") return false;

      const espOk = isEspCompativel(b, espessura);
      const corOk = isCorCompativel(b.cor, cor);
      const saldoOk = (b.peso_kg || 0) > 0 || (b.metragem_restante || 0) > 0;
      return espOk && corOk && saldoOk;
    });

    const saldoMetros = bobsCompativeis.reduce((acc, b) => {
      if (b.metragem_restante > 0) return acc + b.metragem_restante;
      if (b.metragem > 0) return acc + b.metragem;
      if (b.peso_kg > 0) return acc + Math.round(b.peso_kg / (calculoPeso.kgPorMetro || 4.05));
      return acc;
    }, 0);

    const saldoKg = bobsCompativeis.reduce((acc, b) => acc + (b.peso_kg || 0), 0);

    let status = "indisponivel";
    if (bobsCompativeis.length > 0) {
      if (saldoMetros >= metrosNecessarios || metrosNecessarios === 0) {
        status = "disponivel";
      } else {
        status = "parcial";
      }
    }

    // Simulação detalhada de cada bobina candidata (Antes vs Depois)
    const bobinasSimuladas = bobsCompativeis.map((b) => {
      let bPeso = Number(b.peso_kg) || 0;
      let bMetros = Number(b.metragem_restante) || Number(b.metragem) || 0;
      if (bMetros === 0 && bPeso > 0 && calculoPeso.kgPorMetro > 0) {
        bMetros = Math.round(bPeso / calculoPeso.kgPorMetro);
      }
      if (bPeso === 0 && bMetros > 0 && calculoPeso.kgPorMetro > 0) {
        bPeso = Math.round(bMetros * calculoPeso.kgPorMetro);
      }
      const pesoApos = Math.max(0, bPeso - pesoNecessarioKg);
      const metrosApos = Math.max(0, bMetros - metrosNecessarios);
      const sobraKg = bPeso - pesoNecessarioKg;
      const sobraMetros = bMetros - metrosNecessarios;
      const daParaFazer = (bPeso >= pesoNecessarioKg || pesoNecessarioKg === 0) && (bMetros >= metrosNecessarios || metrosNecessarios === 0);
      const pctUso = bPeso > 0 ? Math.min(100, Math.round((pesoNecessarioKg / bPeso) * 100)) : 100;

      return {
        id: b.id,
        codigo: b.codigo || b.codigo_bobina || (b.id ? b.id.slice(0, 8) : "BOB"),
        chapa: b.chapa || espessura,
        cor: b.cor || cor,
        status: b.status || "Disponível",
        unidade: b.unidade || "Fábrica Telhas",
        pesoAtualKg: bPeso,
        pesoConsumoKg: pesoNecessarioKg,
        pesoAposUsoKg: pesoApos,
        sobraKg,
        metrosAtual: bMetros,
        metrosConsumo: metrosNecessarios,
        metrosAposUso: metrosApos,
        sobraMetros,
        daParaFazer,
        pctUso
      };
    });

    const bPrincipal = bobinasSimuladas[0];
    let badgeText = "";
    let shortBadge = "";
    let detalhe = "";
    let opaMensagem = "";

    if (status === "disponivel") {
      opaMensagem = `Opa, temos sim bobina na espessura ${espessura}mm para fazer este pedido! Usará ${pesoNecessarioKg} kg (restarão ${bPrincipal?.pesoAposUsoKg?.toLocaleString() || 0} kg na bobina principal).`;
      badgeText = `🟢 Temos Bobina (${espessura}mm) • Usa ${pesoNecessarioKg}kg (Agora: ${bPrincipal?.pesoAtualKg?.toLocaleString()}kg ➔ Sobram: ${bPrincipal?.pesoAposUsoKg?.toLocaleString()}kg)`;
      shortBadge = `🟢 Bobina OK (${pesoNecessarioKg}kg)`;
      detalhe = `Matéria-prima 100% disponível: ${bobsCompativeis.length} bobina(s) em estoque somando ${saldoMetros.toLocaleString()}m (${saldoKg.toLocaleString()}kg). Necessário para o pedido: ${metrosNecessarios || demanda.pecas}m (${pesoNecessarioKg}kg).`;
    } else if (status === "parcial") {
      opaMensagem = `Atenção: Saldo parcial de bobina. O pedido necessita de ${pesoNecessarioKg} kg (${metrosNecessarios}m), mas o estoque atual tem apenas ${saldoMetros}m (${saldoKg}kg).`;
      badgeText = `🟡 Bobina Parcial: ${saldoMetros}m (${saldoKg}kg) disp. (Nec: ${pesoNecessarioKg}kg)`;
      shortBadge = `🟡 Parcial (${pesoNecessarioKg}kg)`;
      detalhe = `Saldo insuficiente: Temos ${saldoMetros}m (${saldoKg}kg) disponíveis, mas o pedido necessita de ${metrosNecessarios}m (${pesoNecessarioKg}kg) de chapa.`;
    } else {
      opaMensagem = `Falta bobina: Nenhuma bobina compatível de ${espessura || "0,43"}mm na cor ${cor} no estoque. Necessário: ${pesoNecessarioKg} kg (${metrosNecessarios}m).`;
      badgeText = `🔴 Falta Bobina: ${espessura ? espessura + "mm" : ""} ${cor} (Nec: ${pesoNecessarioKg}kg)`;
      shortBadge = `🔴 Sem Bobina (${espessura || "0,43"}mm)`;
      detalhe = `Nenhuma bobina compatível de ${espessura || "0,43"}mm na cor ${cor} encontrada no estoque de Telhas.`;
    }

    return {
      setor: "telha",
      produto: prod,
      descricao: desc,
      itemOriginal: item,
      espessura,
      cor,
      status,
      demanda: { ...demanda, metrosNecessarios, isSanduiche },
      calculoPeso,
      saldo: { metros: saldoMetros, kg: saldoKg, bobinasCount: bobsCompativeis.length },
      bobinasSimuladas,
      chapasSimuladas: [],
      materiais: bobinasSimuladas,
      badgeText,
      shortBadge,
      detalhe,
      opaMensagem
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. FRISADAS: Verifica e Simula Bobinas de Frisada / Expedição
  // ─────────────────────────────────────────────────────────────
  if (setor === "frisada") {
    const bobsCompativeis = bobinas.filter((b) => {
      if (b.arquivada) return false;
      const bSetor = String(b.setor || "").toLowerCase().trim();
      const bCod = String(b.codigo || b.codigo_bobina || "").toUpperCase().trim();
      if (bSetor === "cd" || bSetor === "corte_dobra" || bCod.startsWith("CD")) return false;
      const espOk = isEspCompativel(b, espessura);
      const saldoOk = (b.peso_kg || 0) > 0 || (b.metragem_restante || 0) > 0;
      return espOk && saldoOk;
    });

    const saldoMetros = bobsCompativeis.reduce((acc, b) => {
      if (b.metragem_restante > 0) return acc + b.metragem_restante;
      if (b.metragem > 0) return acc + b.metragem;
      if (b.peso_kg > 0) return acc + Math.round(b.peso_kg / (calculoPeso.kgPorMetro || 4.05));
      return acc;
    }, 0);

    const saldoKg = bobsCompativeis.reduce((acc, b) => acc + (b.peso_kg || 0), 0);

    const status =
      bobsCompativeis.length > 0 && (saldoMetros >= demanda.metros || demanda.metros === 0)
        ? "disponivel"
        : bobsCompativeis.length > 0
        ? "parcial"
        : "indisponivel";

    const bobinasSimuladas = bobsCompativeis.map((b) => {
      let bPeso = Number(b.peso_kg) || 0;
      let bMetros = Number(b.metragem_restante) || Number(b.metragem) || 0;
      if (bMetros === 0 && bPeso > 0 && calculoPeso.kgPorMetro > 0) {
        bMetros = Math.round(bPeso / calculoPeso.kgPorMetro);
      }
      if (bPeso === 0 && bMetros > 0 && calculoPeso.kgPorMetro > 0) {
        bPeso = Math.round(bMetros * calculoPeso.kgPorMetro);
      }
      const pesoApos = Math.max(0, bPeso - pesoNecessarioKg);
      const metrosApos = Math.max(0, bMetros - demanda.metros);
      const sobraKg = bPeso - pesoNecessarioKg;
      const sobraMetros = bMetros - demanda.metros;
      const daParaFazer = (bPeso >= pesoNecessarioKg || pesoNecessarioKg === 0) && (bMetros >= demanda.metros || demanda.metros === 0);
      const pctUso = bPeso > 0 ? Math.min(100, Math.round((pesoNecessarioKg / bPeso) * 100)) : 100;

      return {
        id: b.id,
        codigo: b.codigo || b.codigo_bobina || (b.id ? b.id.slice(0, 8) : "FRIS"),
        chapa: b.chapa || espessura,
        cor: b.cor || cor,
        status: b.status || "Disponível",
        unidade: b.unidade || "Expedição",
        pesoAtualKg: bPeso,
        pesoConsumoKg: pesoNecessarioKg,
        pesoAposUsoKg: pesoApos,
        sobraKg,
        metrosAtual: bMetros,
        metrosConsumo: demanda.metros,
        metrosAposUso: metrosApos,
        sobraMetros,
        daParaFazer,
        pctUso
      };
    });

    const bPrincipal = bobinasSimuladas[0];
    let badgeText = "";
    let shortBadge = "";
    let detalhe = "";
    let opaMensagem = "";

    if (status === "disponivel") {
      opaMensagem = `Opa, temos sim bobinas de frisada na espessura ${espessura}mm! Usará ${pesoNecessarioKg} kg (restarão ${bPrincipal?.pesoAposUsoKg?.toLocaleString() || 0} kg).`;
      badgeText = `🟢 Temos Bobina Frisada • Usa ${pesoNecessarioKg}kg (Agora: ${bPrincipal?.pesoAtualKg?.toLocaleString()}kg ➔ Sobram: ${bPrincipal?.pesoAposUsoKg?.toLocaleString()}kg)`;
      shortBadge = `🟢 Frisada OK (${pesoNecessarioKg}kg)`;
      detalhe = `Bobinas para frisada disponíveis: ${saldoMetros.toLocaleString()}m (${saldoKg.toLocaleString()}kg) em estoque. Necessário: ${demanda.metros || demanda.pecas}m (${pesoNecessarioKg}kg).`;
    } else if (status === "parcial") {
      opaMensagem = `Atenção: Saldo parcial de bobina para frisada. Necessário: ${pesoNecessarioKg} kg (${demanda.metros}m), disponível: ${saldoMetros}m (${saldoKg}kg).`;
      badgeText = `🟡 Frisada Parcial: ${saldoMetros}m (${saldoKg}kg) disp. (Nec: ${pesoNecessarioKg}kg)`;
      shortBadge = `🟡 Parcial (${pesoNecessarioKg}kg)`;
      detalhe = `Saldo parcial de bobina para frisada: ${saldoMetros}m disponíveis para ${demanda.metros}m necessários.`;
    } else {
      opaMensagem = `Falta bobina de frisada: Nenhuma bobina de ${espessura}mm no estoque de Frisada. Necessário: ${pesoNecessarioKg} kg.`;
      badgeText = `🔴 Falta Bobina Frisada: ${espessura ? espessura + "mm" : ""} (Nec: ${pesoNecessarioKg}kg)`;
      shortBadge = `🔴 Sem Bobina Frisada`;
      detalhe = `Nenhuma bobina de frisada encontrada no estoque para a espessura ${espessura}mm.`;
    }

    return {
      setor: "frisada",
      produto: prod,
      descricao: desc,
      itemOriginal: item,
      espessura,
      cor,
      status,
      demanda,
      calculoPeso,
      saldo: { metros: saldoMetros, kg: saldoKg, bobinasCount: bobsCompativeis.length },
      bobinasSimuladas,
      chapasSimuladas: [],
      materiais: bobinasSimuladas,
      badgeText,
      shortBadge,
      detalhe,
      opaMensagem
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CORTE & DOBRA (C&D): Verifica e Simula Chapas E Bobinas
  // ─────────────────────────────────────────────────────────────
  const chapasCompativeis = chapas.filter((c) => {
    if (c.status === "cancelado") return false;
    const cEspNum = parseEspessuraToNumber(c.espessura_mm || c.chapa || c.espessura);
    if (espNum == null || cEspNum == null) return false;
    // Tolerância estrita de até 0,03mm (1,95 só aceita 1,95)
    const matchEsp = Math.abs(espNum - cEspNum) < 0.03;
    const qtdDisp = c.quantidade_disponivel != null ? c.quantidade_disponivel : c.quantidade_total;
    return matchEsp && qtdDisp > 0;
  });

  const bobsCDCompativeis = bobinas.filter((b) => {
    if (b.arquivada) return false;
    // Isolamento estrito de setor: NUNCA permitir bobinas de Telhas nem Frisadas (TE...)
    const bSetor = String(b.setor || "").toLowerCase().trim();
    const bCod = String(b.codigo || b.codigo_bobina || "").toUpperCase().trim();
    if (bSetor === "telhas" || bSetor === "telha" || bSetor === "frisadas" || bSetor === "frisada" || bCod.startsWith("TE")) {
      return false;
    }
    const espOk = isEspCompativel(b, espessura);
    return espOk && (b.peso_kg || 0) > 0;
  });

  const slittersCompativeis = slitters.filter((s) => {
    const sSetor = String(s.setor || "").toLowerCase().trim();
    const sCod = String(s.codigo || s.codigo_bobina || "").toUpperCase().trim();
    if (sSetor === "telhas" || sSetor === "telha" || sCod.startsWith("TE")) return false;
    const espOk = isEspCompativel(s, espessura);
    return espOk && (s.peso_kg || 0) > 0;
  });

  const totalChapasDisp = chapasCompativeis.reduce(
    (acc, c) => acc + (c.quantidade_disponivel != null ? c.quantidade_disponivel : c.quantidade_total || 0),
    0
  );
  const totalKgBobinas =
    bobsCDCompativeis.reduce((acc, b) => acc + (b.peso_kg || 0), 0) +
    slittersCompativeis.reduce((acc, s) => acc + (s.peso_kg || 0), 0);

  // Simulação de Chapas Prontas (Antes vs Depois)
  const espNumCD = parseEspessuraToNumber(espessura) || 1.95;
  const chapasSimuladas = chapasCompativeis.map((c) => {
    const cQtd = Number(c.quantidade_disponivel != null ? c.quantidade_disponivel : c.quantidade_total) || 0;
    const cEsp = parseEspessuraToNumber(c.espessura_mm) || espNumCD;
    const largM = (Number(c.largura_mm) || 1200) / 1000;
    const compM = (Number(c.comprimento_mm) || 3000) / 1000;
    const kgUnit = +(largM * compM * cEsp * 7.85).toFixed(2);
    const pesoTotalChapa = Math.round(cQtd * kgUnit);
    const pecasApos = Math.max(0, cQtd - demanda.pecas);
    const sobraPecas = cQtd - demanda.pecas;
    const pesoApos = Math.max(0, Math.round(pecasApos * kgUnit));
    const daParaFazer = cQtd >= demanda.pecas;
    const pctUso = cQtd > 0 ? Math.min(100, Math.round((demanda.pecas / cQtd) * 100)) : 100;

    return {
      id: c.id,
      codigo: c.codigo || (c.id ? c.id.slice(0, 8) : "CHP"),
      espessura_mm: c.espessura_mm || espessura,
      largura_mm: c.largura_mm || 1200,
      comprimento_mm: c.comprimento_mm || 3000,
      pecasAtual: cQtd,
      pecasConsumo: demanda.pecas,
      pecasAposUso: pecasApos,
      sobraPecas,
      pesoAtualKg: pesoTotalChapa,
      pesoConsumoKg: pesoNecessarioKg,
      pesoAposUsoKg: pesoApos,
      sobraKg: pesoTotalChapa - pesoNecessarioKg,
      daParaFazer,
      pctUso
    };
  });

  // Simulação de Bobinas de C&D para Desbobinadeira (Antes vs Depois)
  const bobinasSimuladas = bobsCDCompativeis.map((b) => {
    const bPeso = Number(b.peso_kg) || 0;
    const pesoApos = Math.max(0, bPeso - pesoNecessarioKg);
    const sobraKg = bPeso - pesoNecessarioKg;
    const daParaFazer = bPeso >= pesoNecessarioKg;
    const pctUso = bPeso > 0 ? Math.min(100, Math.round((pesoNecessarioKg / bPeso) * 100)) : 100;

    return {
      id: b.id,
      codigo: b.codigo || b.codigo_bobina || (b.id ? b.id.slice(0, 8) : "BOB-CD"),
      chapa: b.chapa || espessura,
      cor: b.cor || "Natural",
      status: b.status || "Disponível",
      unidade: b.unidade || "Corte & Dobra",
      pesoAtualKg: bPeso,
      pesoConsumoKg: pesoNecessarioKg,
      pesoAposUsoKg: pesoApos,
      sobraKg,
      daParaFazer,
      pctUso
    };
  });

  let statusCD = "indisponivel";
  let tipoMaterial = "nenhum";
  let badgeText = "";
  let shortBadge = "";
  let detalhe = "";
  let opaMensagem = "";

  const chPrincipal = chapasSimuladas[0];
  const bPrincipal = bobinasSimuladas[0];

  const totalChapasDispInt = Math.round(totalChapasDisp);
  const pecasTexto = demanda.pecasOrigem === "estimado"
    ? `${demanda.pecas} pç${demanda.pecas > 1 ? "s" : ""} (est.)`
    : `${demanda.pecas} pç${demanda.pecas > 1 ? "s" : ""}`;

  if (totalChapasDisp >= demanda.pecas && totalChapasDisp > 0) {
    statusCD = "disponivel";
    tipoMaterial = "chapa";
    opaMensagem = `Opa, temos sim chapas cortadas prontas (${totalChapasDispInt.toLocaleString("pt-BR")} un) na espessura ${espessura}mm para fazer este pedido! Usará ${pecasTexto} (~${pesoNecessarioKg} kg).`;
    badgeText = `🟢 Temos Chapa Pronta (${totalChapasDispInt.toLocaleString("pt-BR")} un) • Usa ${pecasTexto} (~${pesoNecessarioKg}kg)`;
    shortBadge = `🟢 Chapa OK (~${pesoNecessarioKg}kg)`;
    detalhe = `Chapas cortadas disponíveis na chaparia: ${totalChapasDispInt.toLocaleString("pt-BR")} peças prontas para guilhotina/dobradeira.`;
  } else if (totalKgBobinas >= pesoNecessarioKg && totalKgBobinas > 0) {
    statusCD = "parcial"; // Necessita desbobinar
    tipoMaterial = "bobina";
    opaMensagem = `Opa, temos sim bobinas de ${espessura}mm no estoque para fazer este pedido desbobinando! Usará ${pesoNecessarioKg} kg [${pecasTexto}] (Bobina atual: ${bPrincipal?.pesoAtualKg?.toLocaleString("pt-BR")}kg ➔ Restarão: ${bPrincipal?.pesoAposUsoKg?.toLocaleString("pt-BR")}kg).`;
    badgeText = `🟡 Temos Bobina (${espessura}mm) — Desbobinar ${pesoNecessarioKg}kg [${pecasTexto}] (Agora: ${bPrincipal?.pesoAtualKg?.toLocaleString("pt-BR")}kg ➔ Sobram: ${bPrincipal?.pesoAposUsoKg?.toLocaleString("pt-BR")}kg)`;
    shortBadge = `🟡 Desbobinar (${pesoNecessarioKg}kg)`;
    detalhe = `Sem chapas cortadas suficientes na chaparia, mas temos ${bobsCDCompativeis.length} bobina(s) (${totalKgBobinas.toLocaleString("pt-BR")}kg) prontas para desbobinar.`;
  } else if (totalChapasDisp > 0 || totalKgBobinas > 0) {
    statusCD = "parcial";
    tipoMaterial = "insuficiente";
    opaMensagem = `Atenção: Saldo insuficiente de chapas e bobinas para ${espessura}mm. Necessário: ${pesoNecessarioKg} kg (${demanda.pecas} peças).`;
    badgeText = `🟡 Saldo Parcial C&D: ${totalChapasDisp} chp / ${totalKgBobinas}kg (Nec: ${pesoNecessarioKg}kg)`;
    shortBadge = `🟡 Parcial C&D (${pesoNecessarioKg}kg)`;
    detalhe = `Estoque insuficiente de Corte & Dobra para atender integralmente este item (${pesoNecessarioKg}kg necessários).`;
  } else {
    statusCD = "indisponivel";
    tipoMaterial = "nenhum";
    opaMensagem = `Falta chapa e bobina: Nenhuma chapa cortada nem bobina de ${espessura}mm encontrada no estoque. Necessário: ${pesoNecessarioKg} kg.`;
    badgeText = `🔴 Falta Chapa e Bobina ${espessura ? espessura + "mm" : ""} (Nec: ${pesoNecessarioKg}kg)`;
    shortBadge = `🔴 Falta Chapa/Bobina`;
    detalhe = `Falta matéria-prima: Nenhuma chapa cortada nem bobina de ${espessura}mm encontrada no estoque de Corte e Dobra.`;
  }

  return {
    setor: "cd",
    produto: prod,
    descricao: desc,
    itemOriginal: item,
    espessura,
    cor,
    status: statusCD,
    tipoMaterial,
    demanda,
    calculoPeso,
    saldo: {
      chapasUn: totalChapasDisp,
      bobinasKg: totalKgBobinas,
      chapasCount: chapasCompativeis.length,
      bobinasCount: bobsCDCompativeis.length
    },
    chapasSimuladas,
    bobinasSimuladas,
    materiais: [...chapasSimuladas, ...bobinasSimuladas],
    badgeText,
    shortBadge,
    detalhe,
    opaMensagem
  };
}

/**
 * Avalia todos os itens de uma Ordem de Fabricação (OF) ou Pedido individual.
 * Consolida peso total do pedido e agrega simulações de bobinas e chapas.
 */
export function verificarEstoquePedido(pedido, { bobinas = [], chapas = [], slitters = [] } = {}) {
  if (!pedido) {
    return {
      statusGeral: "indisponivel",
      totalItens: 0,
      itensOk: 0,
      itensParcial: 0,
      itensFalta: 0,
      pesoTotalKg: 0,
      metrosTotal: 0,
      badgeGeral: "🔴 Sem Itens",
      shortBadge: "🔴 Sem Itens",
      opaMensagemGeral: "Nenhum item informado.",
      analises: []
    };
  }

  const itens = getItens(pedido);
  if (itens.length === 0) {
    const single = verificarEstoqueItem(pedido, { bobinas, chapas, slitters }, pedido);
    return {
      statusGeral: single.status,
      totalItens: 1,
      itensOk: single.status === "disponivel" ? 1 : 0,
      itensParcial: single.status === "parcial" ? 1 : 0,
      itensFalta: single.status === "indisponivel" ? 1 : 0,
      pesoTotalKg: single.calculoPeso?.pesoKg || 0,
      metrosTotal: single.demanda?.metros || 0,
      badgeGeral: single.badgeText,
      shortBadge: single.shortBadge,
      opaMensagemGeral: single.opaMensagem,
      analises: [single]
    };
  }

  const analises = itens.map((it) => verificarEstoqueItem(it, { bobinas, chapas, slitters }, pedido));

  const totalItens = analises.length;
  const itensOk = analises.filter((a) => a.status === "disponivel").length;
  const itensParcial = analises.filter((a) => a.status === "parcial").length;
  const itensFalta = analises.filter((a) => a.status === "indisponivel").length;

  const pesoTotalKg = analises.reduce((acc, a) => acc + (a.calculoPeso?.pesoKg || 0), 0);
  const metrosTotal = analises.reduce((acc, a) => acc + (a.demanda?.metros || a.demanda?.metrosNecessarios || 0), 0);

  let statusGeral = "disponivel";
  let badgeGeral = "";
  let shortBadge = "";
  let opaMensagemGeral = "";

  if (itensFalta > 0) {
    statusGeral = "indisponivel";
    badgeGeral = `🔴 Falta Matéria-Prima (${itensFalta}/${totalItens} sem estoque) • ${pesoTotalKg.toLocaleString()}kg`;
    shortBadge = `🔴 Sem Estoque (${pesoTotalKg}kg)`;
    opaMensagemGeral = `Atenção: Falta matéria-prima para ${itensFalta} item(ns). Peso total estimado: ${pesoTotalKg.toLocaleString()} kg.`;
  } else if (itensParcial > 0) {
    statusGeral = "parcial";
    badgeGeral = `🟡 MP Parcial / Desbobinar (${pesoTotalKg.toLocaleString()}kg necessários)`;
    shortBadge = `🟡 Desbobinar (${pesoTotalKg}kg)`;
    opaMensagemGeral = `Opa, temos bobinas no estoque para desbobinar (${pesoTotalKg.toLocaleString()} kg necessários para este pedido).`;
  } else {
    statusGeral = "disponivel";
    badgeGeral = `🟢 Temos Matéria-Prima! 100% OK (${pesoTotalKg.toLocaleString()}kg)`;
    shortBadge = `🟢 MP 100% OK (${pesoTotalKg}kg)`;
    opaMensagemGeral = `Opa, temos sim bobinas e chapas na espessura para fazer este pedido! Peso total estimado: ${pesoTotalKg.toLocaleString()} kg.`;
  }

  return {
    statusGeral,
    totalItens,
    itensOk,
    itensParcial,
    itensFalta,
    pesoTotalKg,
    metrosTotal,
    badgeGeral,
    shortBadge,
    opaMensagemGeral,
    analises
  };
}

/**
 * Avalia todas as Ordens de Fabricação (OFs) pertencentes a um Pedido Consolidado (Grupo).
 * Retorna o diagnóstico global de matéria-prima do pedido consolidado com peso agregado.
 */
export function verificarEstoqueGrupo(grupo, { bobinas = [], chapas = [], slitters = [] } = {}) {
  const ofs = Array.isArray(grupo) ? grupo : (grupo?.ofs || []);
  if (ofs.length === 0) {
    return {
      statusGeral: "indisponivel",
      totalOfs: 0,
      ofsOk: 0,
      ofsParcial: 0,
      ofsFalta: 0,
      pesoTotalGrupoKg: 0,
      badgeGeral: "Sem OFs",
      resumoSetores: { telha: { ok: 0, total: 0 }, cd: { ok: 0, total: 0 }, frisada: { ok: 0, total: 0 } },
      analisesOfs: []
    };
  }

  const analisesOfs = ofs.map((ofItem) => {
    return {
      of: ofItem,
      diagnostico: verificarEstoquePedido(ofItem, { bobinas, chapas, slitters })
    };
  });

  const totalOfs = analisesOfs.length;
  const ofsOk = analisesOfs.filter((a) => a.diagnostico.statusGeral === "disponivel").length;
  const ofsParcial = analisesOfs.filter((a) => a.diagnostico.statusGeral === "parcial").length;
  const ofsFalta = analisesOfs.filter((a) => a.diagnostico.statusGeral === "indisponivel").length;
  const pesoTotalGrupoKg = analisesOfs.reduce((acc, a) => acc + (a.diagnostico.pesoTotalKg || 0), 0);

  let statusGeral = "disponivel";
  let badgeGeral = "";
  let shortBadge = "";

  if (ofsFalta > 0) {
    statusGeral = "indisponivel";
    badgeGeral = `🔴 Falta MP (${ofsFalta} OFs) • ${pesoTotalGrupoKg.toLocaleString()}kg`;
    shortBadge = `🔴 Falta MP (${pesoTotalGrupoKg}kg)`;
  } else if (ofsParcial > 0) {
    statusGeral = "parcial";
    badgeGeral = `🟡 MP Parcial / Desbobinar (${pesoTotalGrupoKg.toLocaleString()}kg)`;
    shortBadge = `🟡 Desbobinar (${pesoTotalGrupoKg}kg)`;
  } else {
    statusGeral = "disponivel";
    badgeGeral = `🟢 Estoque MP: 100% OK (${pesoTotalGrupoKg.toLocaleString()}kg)`;
    shortBadge = `🟢 MP OK (${pesoTotalGrupoKg}kg)`;
  }

  // Resumo por setor
  const resumoSetores = {
    telha: { total: 0, ok: 0, falta: 0 },
    cd: { total: 0, ok: 0, falta: 0 },
    frisada: { total: 0, ok: 0, falta: 0 }
  };

  analisesOfs.forEach(({ of: p, diagnostico }) => {
    const g = classGrupo(p);
    if (!resumoSetores[g]) resumoSetores[g] = { total: 0, ok: 0, falta: 0 };
    resumoSetores[g].total++;
    if (diagnostico.statusGeral === "disponivel") resumoSetores[g].ok++;
    else if (diagnostico.statusGeral === "indisponivel") resumoSetores[g].falta++;
  });

  return {
    statusGeral,
    totalOfs,
    ofsOk,
    ofsParcial,
    ofsFalta,
    pesoTotalGrupoKg,
    badgeGeral,
    shortBadge,
    resumoSetores,
    analisesOfs
  };
}
