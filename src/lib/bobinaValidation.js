// Shared validation for bobina selection against Odoo-required espessura + origem.
// Used across all bobina selection points (Nova Ordem, validação etiqueta, retrabalho, vinculação).

export function parseEspessuraToNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  // Extrai o primeiro número decimal da string (suporta "0,43", "0.43", "0.43mm", "0,43 mm", etc.)
  const match = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const numStr = match[1].replace(",", ".");
  const n = parseFloat(numStr);
  return isNaN(n) ? null : n;
}

// Returns array of numeric espessuras from a bobina (utilizada OR real OR chapa/espessura_mm).
export function getBobinaEspessuras(bobina) {
  if (!bobina) return [];
  const vals = [];
  const add = (v) => {
    if (v == null) return;
    const parts = String(v).split("/");
    for (const p of parts) {
      const n = parseEspessuraToNumber(p);
      if (n != null && !vals.includes(n)) vals.push(n);
    }
  };
  add(bobina.espessura_utilizada);
  add(bobina.espessura_real);
  add(bobina.chapa);
  add(bobina.espessura_mm); // Slitter
  return vals;
}

function normalizeEsp(s) {
  if (s == null) return "";
  return String(s).replace(/\s/g, "").replace(".", ",");
}

// Find tolerance config matching the required espessura (by nominal string or numeric).
export function findTolerancia(espessuraExigida, tolerancias) {
  if (!espessuraExigida || !tolerancias || !tolerancias.length) return null;
  const reqNum = parseEspessuraToNumber(espessuraExigida);
  const reqNorm = normalizeEsp(espessuraExigida);
  return (
    tolerancias.find((t) => normalizeEsp(t.espessura_nominal) === reqNorm && t.ativo !== false) ||
    tolerancias.find((t) => {
      if (t.ativo === false) return false;
      const tn = parseEspessuraToNumber(t.espessura_nominal);
      return reqNum != null && tn != null && Math.abs(tn - reqNum) < 1e-4;
    }) ||
    null
  );
}

export function isEspessuraCompatible(bobina, espessuraExigida, tolerancias) {
  if (!espessuraExigida) return { ok: true, reason: null };
  const bobEspessuras = getBobinaEspessuras(bobina);
  if (bobEspessuras.length === 0) {
    return { ok: false, reason: "espessura", detail: "Bobina sem espessura cadastrada" };
  }
  const tol = findTolerancia(espessuraExigida, tolerancias);
  if (tol && tol.min_aceitavel != null && tol.max_aceitavel != null) {
    const minVal = parseEspessuraToNumber(tol.min_aceitavel) ?? tol.min_aceitavel;
    const maxVal = parseEspessuraToNumber(tol.max_aceitavel) ?? tol.max_aceitavel;
    const within = bobEspessuras.some((e) => e >= (minVal - 0.005) && e <= (maxVal + 0.005));
    return within
      ? { ok: true, reason: null }
      : {
          ok: false,
          reason: "espessura",
          detail: `Espessura da bobina (${bobEspessuras.join(" / ")}mm) fora da faixa aceitável (${tol.min_aceitavel}–${tol.max_aceitavel}mm) para o pedido de ${espessuraExigida}mm`,
        };
  }
  // No tolerance configured → exact match (com tolerância de ponto flutuante)
  const reqNum = parseEspessuraToNumber(espessuraExigida);
  if (reqNum != null) {
    const match = bobEspessuras.some((e) => Math.abs(e - reqNum) < 0.02);
    return match
      ? { ok: true, reason: null }
      : {
          ok: false,
          reason: "espessura",
          detail: `Espessura da bobina (${bobEspessuras.join(" / ")}mm) ≠ exigida pelo pedido (${espessuraExigida}mm)`,
        };
  }
  return { ok: true, reason: null };
}

function normalizeOrigem(val) {
  const s = String(val || "").toLowerCase().trim();
  if (!s || s === "ambas" || s === "todas" || s === "qualquer") return "ambas";
  if (s.includes("nac")) return "nacional";
  if (s.includes("imp")) return "importado";
  return s;
}

export function isOrigemCompatible(bobina, origemExigida) {
  const reqNorm = normalizeOrigem(origemExigida);
  if (reqNorm === "ambas") return { ok: true, reason: null };
  const bobOrigem = bobina?.origem || (String(bobina?.qualidade || "").toUpperCase().includes("IMP") ? "Importado" : "Nacional");
  const bobNorm = normalizeOrigem(bobOrigem);
  if (bobNorm === reqNorm) return { ok: true, reason: null };
  return {
    ok: false,
    reason: "origem",
    detail: `Origem da bobina (${bobOrigem}) incompatível com o pedido Odoo (${origemExigida})`,
  };
}

export function removerAcentos(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Detecta a cor/RVM exigida pelo pedido de telha com base no texto do produto e observações.
 * Retorna uma chave padronizada (ex: "NATURAL", "BRANCO", "PRETO", "AZUL", "CINZA", etc.).
 */
export function detectarCorTelha(produtoTexto = "", descricaoTexto = "") {
  const combined = removerAcentos(`${produtoTexto} ${descricaoTexto}`);

  // 1. Cores Pré-Pintadas Específicas
  if (/(PRETO\s*9005|PRETO|PRETA|BLACK)/i.test(combined)) return "PRETO";
  if (/(BRANCO|BRANCA|WHITE)/i.test(combined)) return "BRANCO";
  if (/(AZUL|BLUE)/i.test(combined)) return "AZUL";
  if (/(BEGE|AREIA|BEIGE)/i.test(combined)) return "BEGE";
  if (/(GRAFITE)/i.test(combined)) return "GRAFITE";
  if (/(CINZA\s*ESCURO|CINZA)/i.test(combined)) return "CINZA";
  if (/CERAMICA/i.test(combined)) return "CERAMICA";
  if (/TERRACOTA/i.test(combined)) return "TERRACOTA";
  if (/(VERMELHO|VERMELHA|RED)/i.test(combined)) return "VERMELHO";
  if (/(MARROM|BROWN)/i.test(combined)) return "MARROM";
  if (/(VERDE|GREEN)/i.test(combined)) return "VERDE";
  if (/(AMARELO|AMARELA|YELLOW)/i.test(combined)) return "AMARELO";

  // 2. Cores Naturais / Galvalume / Galvanizadas
  if (/(NATURAL|GALVALUME|GALVANIZAD|GL|GV|CRU|SEM\s*PINTURA)/i.test(combined)) {
    return "NATURAL";
  }

  // Padrão de fábrica de telhas quando não menciona cor pré-pintada é Galvalume Natural
  return "NATURAL";
}

/**
 * Avalia se a cor e qualidade de uma bobina física atendem à cor exigida pelo pedido.
 */
export function isCorCompativel(bobina, corExigida) {
  if (!corExigida || corExigida === "todas" || corExigida === "qualquer" || corExigida === "ambas") return true;
  const corBobina = removerAcentos(bobina?.cor || "");
  const rvmBobina = removerAcentos(bobina?.rvm || "");
  const qualBobina = removerAcentos(bobina?.qualidade || "");
  const corAlvo = removerAcentos(corExigida);

  // Caso 1: Pedido exige NATURAL / GALVALUME
  if (corAlvo === "NATURAL" || corAlvo === "GALVALUME") {
    // Bobina NÃO pode ser pré-pintada colorida (Branca, Preta, etc.)
    const ehColorida = /(BRANC|PRET|AZUL|BEGE|GRAFIT|CINZA|TERRACOT|VERMELH|MARROM|VERD|AMAREL)/i.test(corBobina);
    if (ehColorida) return false;
    // Se for qualidade PP (pré-pintada) com cor definida, não serve para natural
    if (qualBobina === "PP" && corBobina) return false;
    return true;
  }

  // Caso 2: Pedido exige cor pré-pintada (ex: BRANCO, PRETO, etc.)
  if (corAlvo === "PRETO") {
    return /(PRETO|PRETA|9005|BLACK)/i.test(corBobina) || /(PRETO|PRETA|9005)/i.test(rvmBobina);
  }
  if (corAlvo === "BRANCO") {
    return /(BRANCO|BRANCA|WHITE)/i.test(corBobina) || /(BRANCO|BRANCA)/i.test(rvmBobina);
  }
  if (corAlvo === "AZUL") {
    return /(AZUL|BLUE)/i.test(corBobina) || /(AZUL)/i.test(rvmBobina);
  }
  if (corAlvo === "BEGE") {
    return /(BEGE|AREIA|BEIGE)/i.test(corBobina) || /(BEGE|AREIA)/i.test(rvmBobina);
  }
  if (corAlvo === "GRAFITE") {
    return /(GRAFITE)/i.test(corBobina) || /(GRAFITE)/i.test(rvmBobina);
  }
  if (corAlvo === "CINZA") {
    return /(CINZA)/i.test(corBobina) || /(CINZA)/i.test(rvmBobina);
  }
  if (corAlvo === "TERRACOTA" || corAlvo === "CERAMICA") {
    return /(TERRACOTA|CERAMICA)/i.test(corBobina) || /(TERRACOTA|CERAMICA)/i.test(rvmBobina);
  }
  if (corAlvo === "VERMELHO") {
    return /(VERMELHO|VERMELHA|RED)/i.test(corBobina) || /(VERMELHO)/i.test(rvmBobina);
  }
  if (corAlvo === "MARROM") {
    return /(MARROM|BROWN)/i.test(corBobina) || /(MARROM)/i.test(rvmBobina);
  }
  if (corAlvo === "VERDE") {
    return /(VERDE|GREEN)/i.test(corBobina) || /(VERDE)/i.test(rvmBobina);
  }
  if (corAlvo === "AMARELO") {
    return /(AMARELO|AMARELA|YELLOW)/i.test(corBobina) || /(AMARELO)/i.test(rvmBobina);
  }

  // Fallback: substring
  return corBobina.includes(corAlvo) || rvmBobina.includes(corAlvo);
}

export function validarBobina(bobina, { espessuraExigida, origemExigida, corExigida, tolerancias } = {}) {
  const esp = isEspessuraCompatible(bobina, espessuraExigida, tolerancias);
  if (!esp.ok) return esp;
  const ori = isOrigemCompatible(bobina, origemExigida);
  if (!ori.ok) return ori;
  if (corExigida && corExigida !== "todas" && corExigida !== "qualquer" && corExigida !== "ambas") {
    const corOk = isCorCompativel(bobina, corExigida);
    if (!corOk) {
      const corReal = bobina?.cor || bobina?.rvm || "Natural";
      return {
        ok: false,
        reason: "cor",
        detail: `Cor da bobina (${corReal}) incompatível com a cor exigida (${corExigida})`,
      };
    }
  }
  return { ok: true, reason: null };
}

export function filtrarBobinasCompativeis(bobinas, opts) {
  if (!bobinas || !Array.isArray(bobinas)) return [];
  const temFiltro = opts && (
    opts.espessuraExigida ||
    (opts.origemExigida && opts.origemExigida !== "ambas") ||
    (opts.corExigida && opts.corExigida !== "todas" && opts.corExigida !== "qualquer" && opts.corExigida !== "ambas")
  );
  if (!temFiltro) return bobinas;
  return bobinas.filter((b) => validarBobina(b, opts).ok);
}

/**
 * Normaliza e compara filiais de forma rigorosa:
 * - Vazio, null, "Matriz" ou "Matriz AJL" -> "matriz"
 * - "Pinhais" -> "pinhais"
 * - "Ivaiporã" / "Ivaipora" -> "ivaipora"
 * - "Ponta Grossa" / "PG" -> "pontagrossa"
 */
export function isMesmaFilial(unidadeA, unidadeB) {
  const norm = (u) => {
    const s = String(u || "Matriz AJL").trim().toLowerCase();
    if (s.includes("matriz")) return "matriz";
    if (s.includes("pinhais")) return "pinhais";
    if (s.includes("ivaipor")) return "ivaipora";
    if (s.includes("ponta grossa") || s.includes("pg")) return "pontagrossa";
    return s;
  };
  return norm(unidadeA) === norm(unidadeB);
}