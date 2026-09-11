// Extrai especificações técnicas (qtd de peças, comprimento unitário, metragem total, cor e espessura)
// da descrição livre da linha do pedido Odoo (campo 'observacao' / 'name' / 'descricao').
// Suporta padrões industriais brasileiros:
// - "50 PÇS c/ 2000\" → { quantidade: 50, comprimento_mm: 2000, comprimento_m: 2, metragem_total: 100 }
// - "60 peças" → { quantidade: 60, comprimento_mm: null, metragem_total: null }
// - "50 pcs c/ 2.000 mm" → { quantidade: 50, comprimento_mm: 2000, comprimento_m: 2, metragem_total: 100 }
// - "50 pçs de 2,00m" → { quantidade: 50, comprimento_mm: 2000, comprimento_m: 2, metragem_total: 100 }
// - "50 c/ 2000 + 20 c/ 3000" → variações múltiplas
// - "50 peças" (com 100m no Odoo) → calcula comprimento unitário 2000mm

const CORES = [
  "preto", "branca", "branco", "vermelho", "vermelha", "cinza", "bege",
  "marrom", "verde", "azul", "grafite", "terracota", "amarelo", "natural",
  "chocolate", "tabaco", "bronze", "dourado"
];

function capitalizar(s) {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Normaliza string de comprimento para { mm, m }
export function parseComprimento(str, rawUnidade = "") {
  if (!str) return { mm: null, m: null };
  const s = String(str).trim().toLowerCase().replace(/[\\\/]+$/, "").trim();
  const u = rawUnidade.toLowerCase().trim();

  // Ex: "2000mm" ou unidade explícita "mm"
  if (s.endsWith("mm") || u === "mm") {
    const num = parseFloat(s.replace("mm", "").trim().replace(",", "."));
    if (isNaN(num) || num <= 0) return { mm: null, m: null };
    return { mm: Math.round(num), m: +(num / 1000).toFixed(3) };
  }

  // Ex: "2,00m", "2m", "2 metros"
  if (/(?:m|mts|metros?)$/.test(s) || u === "m" || u === "metros") {
    const num = parseFloat(s.replace(/(?:m|mts|metros?)$/, "").trim().replace(",", "."));
    if (isNaN(num) || num <= 0) return { mm: null, m: null };
    return { mm: Math.round(num * 1000), m: +num.toFixed(3) };
  }

  // Notação brasileira de milhar: "2.000" ou "3.500" (ponto com exatamente 3 dígitos após)
  if (/^\d{1,2}\.\d{3}$/.test(s)) {
    const mm = parseInt(s.replace(".", ""), 10);
    return { mm, m: +(mm / 1000).toFixed(3) };
  }

  const val = parseFloat(s.replace(",", "."));
  if (isNaN(val) || val <= 0) return { mm: null, m: null };

  // Heurística industrial:
  // Se val >= 100 (ex: 500, 1000, 2000, 3200, 6000), a unidade é milímetros (mm).
  // Se val < 50 (ex: 2, 2.5, 3, 6, 12), a unidade é metros (m).
  if (val >= 100) {
    return { mm: Math.round(val), m: +(val / 1000).toFixed(3) };
  } else {
    return { mm: Math.round(val * 1000), m: +val.toFixed(3) };
  }
}

export function extrairEspecificacao(texto, qtdOdoo = null, unidadeOdoo = "") {
  const t = String(texto || "").trim();
  const out = {
    quantidade: null,
    pecas: null,
    comprimento_mm: null,
    comprimento_m: null,
    metragem_total: null,
    cor: null,
    variacoes: [],
    resumo_formatado: null,
    tem_especificacao: false
  };
  if (!t) return out;

  // 1. Regex para cortes compostos: QTD + PALAVRA DE PEÇA + COMPRIMENTO
  // Ex: 50 PÇS c/ 2000\, 50 pcs c/ 2.000 mm, 50 pçs de 2,00m, 50 pçs x 2000
  const regexCorteComposto = /(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|barras?|telhas?|chapas?|unidades?|un\.?|pc\.?)\s*(?:c\/|com|de|x|\*|\:)?\s*(\d+(?:[.,]\d+)?\s*(?:mm|mts?|metros?|m\b)?)[\\\/]*/gi;

  let match;
  while ((match = regexCorteComposto.exec(t)) !== null) {
    const q = parseInt(match[1], 10);
    const compRaw = match[2];
    const { mm, m } = parseComprimento(compRaw);
    if (q > 0 && mm) {
      out.variacoes.push({
        qty: q,
        mm: mm,
        m: m,
        total_m: +(q * m).toFixed(2)
      });
    }
  }

  // 2. Se não encontrou no formato composto com unidade/palavra de peça, tenta padrão NxM grande
  // Ex: 50x2000, 50 x 2000mm, 50*3000 (exige M >= 500 para não confundir com perfil 75x40)
  if (out.variacoes.length === 0) {
    const regexNxM = /(\d+)\s*[xX*]\s*(\d{3,5}\s*(?:mm)?|\d+[.,]\d+\s*(?:m|mts?|metros?)?)[\\\/]*/g;
    while ((match = regexNxM.exec(t)) !== null) {
      const q = parseInt(match[1], 10);
      const compRaw = match[2];
      const { mm, m } = parseComprimento(compRaw);
      if (q > 0 && mm && mm >= 500) {
        out.variacoes.push({
          qty: q,
          mm: mm,
          m: m,
          total_m: +(q * m).toFixed(2)
        });
      }
    }
  }

  // Se encontrou variações com comprimento
  if (out.variacoes.length > 0) {
    const totalQtd = out.variacoes.reduce((acc, v) => acc + v.qty, 0);
    const totalMetros = +(out.variacoes.reduce((acc, v) => acc + v.total_m, 0)).toFixed(2);
    out.quantidade = totalQtd;
    out.pecas = totalQtd;
    out.comprimento_mm = out.variacoes[0].mm;
    out.comprimento_m = out.variacoes[0].m;
    out.metragem_total = totalMetros;
    out.tem_especificacao = true;

    if (out.variacoes.length === 1) {
      const v = out.variacoes[0];
      out.resumo_formatado = `${v.qty} pçs c/ ${v.mm.toLocaleString("pt-BR")} mm`;
    } else {
      out.resumo_formatado = out.variacoes.map(v => `${v.qty} c/ ${v.mm}mm`).join(" + ") + ` (${totalMetros}m)`;
    }
  } else {
    // 3. Peças isoladas sem comprimento na descrição (ex: '60 peças', '60 pcs', '60 pçs', '60 barras')
    const regexPecasIsoladas = /(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|barras?|unidades?|un\.?)\b/i;
    const matchPecas = t.match(regexPecasIsoladas);
    if (matchPecas) {
      const q = parseInt(matchPecas[1], 10);
      out.quantidade = q;
      out.pecas = q;
      out.tem_especificacao = true;
      out.resumo_formatado = `${q} peças`;

      // Se o pedido do Odoo veio em metros lineares (ex: 100m) e temos a quantidade de peças:
      const uOdoo = String(unidadeOdoo || "").toLowerCase();
      const qOdoo = Number(qtdOdoo) || 0;
      if (qOdoo > 0 && ["m", "mt", "mts", "metro", "metros"].includes(uOdoo)) {
        const mUnit = +(qOdoo / q).toFixed(3);
        const mmUnit = Math.round(mUnit * 1000);
        out.comprimento_m = mUnit;
        out.comprimento_mm = mmUnit;
        out.metragem_total = qOdoo;
        out.resumo_formatado = `${q} pçs c/ ${mmUnit.toLocaleString("pt-BR")} mm`;
        out.variacoes.push({ qty: q, mm: mmUnit, m: mUnit, total_m: qOdoo });
      }
    }
  }

  // Cor: "pré pintada em preto", "pintada em branco", ou menção direta da cor
  const mCor = t.match(/(?:pr[eé]\s*)?pintad[oa]s?\s+em\s+([a-zç]{3,})/i);
  if (mCor) {
    out.cor = capitalizar(mCor[1]);
  } else {
    const tLower = t.toLowerCase();
    for (const c of CORES) {
      if (new RegExp(`\\b${c}\\b`, "i").test(tLower)) {
        out.cor = capitalizar(c);
        break;
      }
    }
  }

  return out;
}

// Extrai espessura do nome do produto Odoo, ex: "Telha TP 40 (0,43) Importada" → "0.43"
export function extrairEspessuraProduto(produtoName) {
  if (!produtoName) return null;
  const m = String(produtoName).match(/\((\d+[.,]\d+)\s*\)/);
  if (m) return m[1].replace(",", ".");
  return null;
}

// Extrai peso explícito em kg da descrição livre do pedido (ex: "KG = 850", "850 kg", "peso: 420.5kg")
export function extrairPesoDoTexto(texto) {
  if (!texto) return null;
  const t = String(texto);
  // Padrão 1: "KG = 850", "KG: 850", "peso = 850kg"
  const m1 = t.match(/(?:kg|peso|quilos?)\s*[:=]?\s*([\d]+(?:[.,]\d+)?)\s*(?:kg|kgs|quilos?)?/i);
  if (m1 && m1[1]) {
    const val = parseFloat(m1[1].replace(",", "."));
    if (!isNaN(val) && val > 0) return val;
  }
  // Padrão 2: "850 kg", "850.5kg", "850,5 kg"
  const m2 = t.match(/\b([\d]+(?:[.,]\d+)?)\s*(?:kg|kgs|quilos)\b/i);
  if (m2 && m2[1]) {
    const val = parseFloat(m2[1].replace(",", "."));
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

// Extrai dimensões de perfil dobrado em U (ex: "Perfil U 75x40", "U 100x50") ou Tubo Retangular/Quadrado (ex: "Tubo Ret 40x60")
export function extrairDimensoesPerfil(texto) {
  if (!texto) return null;
  const t = String(texto);
  const isTubo = /(tubo|metalom|ret\b|quad\b)/i.test(t);
  const m = t.match(/(\d{2,3})\s*[xX]\s*(\d{2,3})/);
  if (m) {
    const base = parseFloat(m[1]);
    const aba = parseFloat(m[2]);
    if (base > 0 && aba > 0) {
      // Perímetro fechado para tubos: 2 * (base + aba); Para perfil aberto em U: base + 2 * aba
      const desenv = isTubo ? (2 * (base + aba)) : (base + (2 * aba));
      return {
        tipo: isTubo ? "tubo" : "perfil_u",
        base_mm: base,
        aba_mm: aba,
        desenvolvimento_mm: desenv,
        desenvolvimento_m: +(desenv / 1000).toFixed(4)
      };
    }
  }
  return null;
}

// Extrai quantidade de peças explicitada na observação livre do vendedor/pedido
export function extrairPecasDaObs(texto) {
  if (!texto) return null;
  const t = String(texto).trim();

  // 1. Regex de peças/chapas/barras/tubos: "1 chapa", "2 pçs", "5 peças", "10 barras", "1 un", "2 tubos"
  const mPecas = t.match(/\b(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|barras?|chapas?|unidades?|un\.?|pc\.?|tubos?|folhas?)\b/i);
  if (mPecas) {
    const q = parseInt(mPecas[1], 10);
    if (q > 0) return q;
  }

  // 2. Notação "qtd: 2" ou "quantidade: 2" ou "qtd = 2"
  const mQtd = t.match(/(?:qtd|quantidade|quant)\s*[:=]\s*(\d+)\b/i);
  if (mQtd) {
    const q = parseInt(mQtd[1], 10);
    if (q > 0) return q;
  }

  // 3. Número isolado caso a observação seja apenas o número de peças
  if (/^\d+$/.test(t)) {
    const q = parseInt(t, 10);
    if (q > 0 && q < 10000) return q;
  }

  return null;
}

// Extrai dimensões de chapas planas (ex: "Chapa 1200x3000", "1200×3000", "1000x2000")
export function extrairDimensoesChapa(texto) {
  if (!texto) return null;
  const str = String(texto);
  // Aceita x, X, × (unicode \u00D7), *
  const m = str.match(/(\d{3,4})\s*[xX×*\u00D7]\s*(\d{3,4})/);
  if (m) {
    const d1 = parseInt(m[1], 10);
    const d2 = parseInt(m[2], 10);
    if (d1 >= 300 && d2 >= 500) {
      const largMm = Math.min(d1, d2);
      const compMm = Math.max(d1, d2);
      return {
        largura_mm: largMm,
        comprimento_mm: compMm,
        largura_m: +(largMm / 1000).toFixed(3),
        comprimento_m: +(compMm / 1000).toFixed(3),
        area_m2: +((largMm / 1000) * (compMm / 1000)).toFixed(3)
      };
    }
  }
  return null;
}