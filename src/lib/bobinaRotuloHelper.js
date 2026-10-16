// =====================================================================
// HELPER DE RÓTULOS SIMPLIFICADOS DE BOBINA DE PRODUÇÃO
// Padroniza e simplifica o texto da bobina para o chão de fábrica:
// "NACIONAL", "IMPORTADA", "BRANCA", "GRAFITE", "PRETA SUPERIOR NACIONAL INFERIOR", etc.
// Sem códigos de estoque físico nem pesos em kg na visualização da máquina.
// =====================================================================

function removerAcentos(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Cores pré-pintadas padronizadas no formato adjetivo feminino (linguagem fabril da AJL).
 */
const CORES_FABRIL = {
  PRETA: ["PRETA", "PRETO", "BLACK"],
  BRANCA: ["BRANCA", "BRANCO", "WHITE"],
  GRAFITE: ["GRAFITE", "GRAFIT"],
  AZUL: ["AZUL", "BLUE"],
  BEGE: ["BEGE", "AREIA"],
  CINZA: ["CINZA", "GRAY", "GREY"],
  TERRACOTA: ["TERRACOTA", "CERAMICA", "CERÂMICA"],
  VERMELHA: ["VERMELHA", "VERMELHO", "RED"],
  MARROM: ["MARROM", "BROWN"],
  VERDE: ["VERDE", "GREEN"],
  AMARELA: ["AMARELA", "AMARELO", "YELLOW"],
  LARANJA: ["LARANJA", "ORANGE"]
};

/**
 * Detecta se o trecho possui menção a uma cor pré-pintada.
 */
export function extrairCorFace(texto = "") {
  const t = removerAcentos(String(texto || "")).toUpperCase();
  for (const [corNorm, termos] of Object.entries(CORES_FABRIL)) {
    for (const termo of termos) {
      const regex = new RegExp(`\\b${removerAcentos(termo)}\\b`, "i");
      if (regex.test(t)) {
        return corNorm;
      }
    }
  }
  return null;
}

/**
 * Detecta se o trecho possui menção a origem do aço (Nacional / Importada / Natural).
 */
export function extrairOrigemFace(texto = "") {
  const t = removerAcentos(String(texto || "")).toUpperCase();
  if (/\b(IMPORTAD[OA]|IMP|GL\s*\(IMP\)|GL\s*IMP)\b/i.test(t)) return "IMPORTADA";
  if (/\b(NACIONA[L]|NAC)\b/i.test(t)) return "NACIONAL";
  if (/\b(NATURAL|GALVALUME|GV|GL)\b/i.test(t)) return "NATURAL";
  return null;
}

/**
 * Extrai a especificação simplificada de uma única chapa (face).
 * Prioridade: Cor pré-pintada (ex: PRETA, BRANCA) > Origem (NACIONAL, IMPORTADA) > Fallback.
 */
export function extrairEspecificacaoFace(texto = "", fallback = "NACIONAL") {
  const t = removerAcentos(String(texto || "")).toUpperCase();

  // 1. Cor pré-pintada
  const cor = extrairCorFace(t);
  if (cor) return cor;

  // 2. Origem do aço
  const origem = extrairOrigemFace(t);
  if (origem) {
    if (origem === "NATURAL") {
      // Se menciona "Natural/Galvalume", verifica se no texto há especificação de Nacional ou Importada
      if (/\b(IMPORTAD[OA]|IMP)\b/i.test(t)) return "IMPORTADA";
      if (/\b(NACIONA[L]|NAC)\b/i.test(t)) return "NACIONAL";
      return "NATURAL";
    }
    return origem;
  }

  return fallback;
}

/**
 * Retorna o rótulo principal simplificado para o campo "Bobina" da OP.
 * Telha Simples / Bobininha: "NACIONAL", "IMPORTADA", "BRANCA", "GRAFITE", etc.
 * Telha Dupla (Sanduíche): "<COR_OU_ORIGEM_SUP> SUPERIOR <COR_OU_ORIGEM_INF> INFERIOR"
 * Ex: "PRETA SUPERIOR NACIONAL INFERIOR", "BRANCA SUPERIOR NACIONAL INFERIOR", etc.
 */
export function extrairRotuloBobinaSimplificado(textoCompleto = "", ehDupla = false) {
  const raw = String(textoCompleto || "").trim();
  if (!raw) return "NACIONAL";

  const t = removerAcentos(raw).toUpperCase();

  // Verifica se é telha dupla / sanduíche
  const isDupla = ehDupla ||
    /(DUPLA|SANDUICHE|\+\s*TELHA|2[ªA]\s*TELHA|CHAPA\s*INFERIOR|PARTE\s*INTERNA|FACE\s*INFERIOR)/i.test(t);

  // Se não for telha dupla, extrai direto
  if (!isDupla) {
    return extrairEspecificacaoFace(t, "NACIONAL");
  }

  // ── CASO TELHA DUPLA / SANDUÍCHE ──

  // 1. Divisão explícita por barra: "PRETA / NACIONAL", "BRANCA / PRETA", etc.
  const matchBarra = raw.match(/^(.*?)\s*[\/|\\]\s*(.*?)$/);
  if (matchBarra) {
    const parteSup = matchBarra[1];
    const parteInf = matchBarra[2];
    const sup = extrairEspecificacaoFace(parteSup, "");
    const inf = extrairEspecificacaoFace(parteInf, "");
    if (sup && inf) {
      return `${sup} SUPERIOR ${inf} INFERIOR`;
    }
  }

  // 2. Termos explícitos de Superior/Externa e Inferior/Interna
  let sup = null;
  let inf = null;

  const matchSupExp = raw.match(/(?:SUPERIOR|EXTERNA|FACE\s*SUPERIOR|PARTE\s*EXTERNA)[^a-zA-Z0-9]*([^\n\r,\.;]+)/i) ||
    raw.match(/([^\n\r,\.;]+)[^a-zA-Z0-9]*(?:SUPERIOR|EXTERNA|FACE\s*SUPERIOR|PARTE\s*EXTERNA)/i);
  if (matchSupExp) {
    sup = extrairEspecificacaoFace(matchSupExp[0], null);
  }

  const matchInfExp = raw.match(/(?:INFERIOR|INTERNA|FACE\s*INFERIOR|PARTE\s*INTERNA|2[ªA]\s*TELHA)[^a-zA-Z0-9]*([^\n\r,\.;]+)/i) ||
    raw.match(/([^\n\r,\.;]+)[^a-zA-Z0-9]*(?:INFERIOR|INTERNA|FACE\s*INFERIOR|PARTE\s*INTERNA|2[ªA]\s*TELHA)/i);
  if (matchInfExp) {
    inf = extrairEspecificacaoFace(matchInfExp[0], null);
  }

  if (sup && inf) {
    return `${sup} SUPERIOR ${inf} INFERIOR`;
  }

  if (sup && !inf) {
    // Face superior informada e inferior padrão
    inf = "NACIONAL";
    return `${sup} SUPERIOR ${inf} INFERIOR`;
  }

  if (!sup && inf) {
    sup = "NACIONAL";
    return `${sup} SUPERIOR ${inf} INFERIOR`;
  }

  // 3. Procura múltiplas cores ou cor + origem no texto
  const todasCores = [];
  for (const [corNorm, termos] of Object.entries(CORES_FABRIL)) {
    for (const termo of termos) {
      const regex = new RegExp(`\\b${removerAcentos(termo)}\\b`, "gi");
      if (regex.test(t)) {
        if (!todasCores.includes(corNorm)) {
          todasCores.push(corNorm);
        }
      }
    }
  }

  if (todasCores.length >= 2) {
    return `${todasCores[0]} SUPERIOR ${todasCores[1]} INFERIOR`;
  } else if (todasCores.length === 1) {
    const origem = extrairOrigemFace(t) || "NACIONAL";
    return `${todasCores[0]} SUPERIOR ${origem} INFERIOR`;
  }

  // Sem cores pré-pintadas: checa origens (ex: Nacional / Importada)
  const temNacional = /\b(NACIONA[L]|NAC)\b/i.test(t);
  const temImportada = /\b(IMPORTAD[OA]|IMP)\b/i.test(t);

  if (temImportada && !temNacional) {
    return "IMPORTADA SUPERIOR IMPORTADA INFERIOR";
  }
  return "NACIONAL SUPERIOR NACIONAL INFERIOR";
}

/**
 * Retorna o rótulo da face inferior para telhas duplas (campo bobina_inferior da OP).
 */
export function extrairRotuloFaceInferior(textoCompleto = "", fallback = "NACIONAL") {
  const rotuloDuplo = extrairRotuloBobinaSimplificado(textoCompleto, true);
  const match = rotuloDuplo.match(/SUPERIOR\s+(.*?)\s+INFERIOR/);
  if (match) {
    return match[1].trim();
  }
  return extrairEspecificacaoFace(textoCompleto, fallback);
}

/**
 * Identifica se uma string de bobina foi gerada no formato antigo de estoque físico
 * (ex: "CD0247 0,43 (GV) - Galvanizado - 4080.0kg", "TE0212 ... · 5308.5kg", etc.)
 * e deve ser limpa e reajustada para o formato simplificado da fábrica.
 */
export function ehRotuloAntigoEstoque(rotulo = "") {
  if (!rotulo || rotulo === "Bobina não definida") return true;
  const str = String(rotulo).trim();

  // Contém peso em kg de estoque físico (ex: "4080.0kg", "5308.5kg", "4080kg")
  if (/\d+([,\.]\d+)?\s*kg/i.test(str)) return true;

  // Contém separador bullet "·" do gerador antigo
  if (str.includes("·")) return true;

  // Contém qualidade de chapa entre parênteses: "(GV)", "(GL)", "(GL (IMP))"
  if (/\((GV|GL|GL\s*\(IMP\)|GALV)\)/i.test(str)) return true;

  // Começa com código de bobina física: "CD0247", "TE0212", "BO0123"
  if (/^[A-Z]{2}\d{4}\b/i.test(str)) return true;

  // Contém formato "CD0247 - Natural (Chapa 0.43)"
  if (/^[A-Z]{2}\d{4}\s*-\s*/i.test(str)) return true;

  return false;
}
