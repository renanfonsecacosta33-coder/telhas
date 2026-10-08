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
  let s = String(str).trim().toLowerCase().replace(/[\\\/]+$/, "").trim();
  const u = rawUnidade.toLowerCase().trim();

  // Tratamento de milhar brasileiro com ponto: "2.000", "6.000", "12.000" (com ou sem mm no final)
  // Ex: "6.000mm", "6.000 mm", "6.000"
  if (/^\d{1,2}\.\d{3}(?:\s*mm)?$/.test(s)) {
    const mm = parseInt(s.replace("mm", "").replace(".", "").trim(), 10);
    return { mm, m: +(mm / 1000).toFixed(3) };
  }

  // Ex: "2000mm" ou unidade explícita "mm"
  if (s.endsWith("mm") || u === "mm") {
    const limpo = s.replace("mm", "").trim();
    // Se ainda tiver ponto de milhar brasileiro ex: "2.000"
    const semPontoMilhar = /^\d{1,2}\.\d{3}$/.test(limpo) ? limpo.replace(".", "") : limpo.replace(",", ".");
    const num = parseFloat(semPontoMilhar);
    if (isNaN(num) || num <= 0) return { mm: null, m: null };
    return { mm: Math.round(num), m: +(num / 1000).toFixed(3) };
  }

  // Ex: "2,00m", "2m", "6,5m", "2 metros"
  if (/(?:m|mts|metros?)$/.test(s) || u === "m" || u === "metros") {
    const limpo = s.replace(/(?:m|mts|metros?)$/, "").trim();
    const semPontoMilhar = /^\d{1,2}\.\d{3}$/.test(limpo) ? limpo.replace(".", "") : limpo.replace(",", ".");
    const num = parseFloat(semPontoMilhar);
    if (isNaN(num) || num <= 0) return { mm: null, m: null };
    // Se o valor for grande (ex: 2000 m que na verdade era 2000 mm mas digitaram m por engano, ou milhar)
    if (num >= 500) {
      return { mm: Math.round(num), m: +(num / 1000).toFixed(3) };
    }
    return { mm: Math.round(num * 1000), m: +num.toFixed(3) };
  }

  // Se tiver vírgula ou ponto decimal para metros (ex: 6,5 ou 6.5)
  if (/^\d{1,2}[,\.]\d{1,2}$/.test(s)) {
    const valM = parseFloat(s.replace(",", "."));
    if (!isNaN(valM) && valM > 0 && valM < 50) {
      return { mm: Math.round(valM * 1000), m: +valM.toFixed(3) };
    }
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

function extrairCorEEspessura(t, out) {
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

export function extrairEspecificacao(texto, qtdOdoo = null, unidadeOdoo = "") {
  const t = String(texto || "").trim();
  const out = {
    quantidade: null,
    pecas: null,
    comprimento_mm: null,
    comprimento_m: null,
    largura_mm: null,
    dimensoes_fmt: null,
    tipo_conformacao: null, // "chapa_lisa" | "perfil_dobrado" | "linear"
    tipo_label: null,
    abas: null,
    desenvolvimento_mm: null,
    metragem_total: null,
    cor: null,
    variacoes: [],
    resumo_formatado: null,
    tem_especificacao: false
  };
  if (!t) return out;

  // ═══════════════════════════════════════════════════════════════════════════
  // A. DETECÇÃO INTELIGENTE DE CHAPA LISA / BLANK (Ex: 1200X3000 - 10 PÇS)
  // ═══════════════════════════════════════════════════════════════════════════
  // Padrão 1: "1200X3000 - 10 PÇS" ou "1200 x 3000 c/ 10 pcs" ou "1000X2000 5 PCS"
  const regexChapaQtdFim = /\b(\d{3,4})\s*[xX*]\s*(\d{3,4})(?:\s*mm)?\s*(?:[-–—:]|\s+c\/|\s+com|\s+de)?\s*(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|chapas?|unidades?|un\.?|pc\.?)\b/i;
  // Padrão 2: "10 PÇS 1200X3000" ou "10 chapas 1200 x 3000"
  const regexChapaQtdInicio = /\b(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|chapas?|unidades?|un\.?|pc\.?)\s*(?:de|com|c\/|[-–—:])?\s*(\d{3,4})\s*[xX*]\s*(\d{3,4})(?:\s*mm)?\b/i;
  // Padrão 3: Apenas as medidas "1200X3000" ou "CHAPA 1200X3000" (usa quantidade do Odoo se disponível)
  const regexChapaApenasMedida = /(?:chapa|blank)?\s*(\d{3,4})\s*[xX*]\s*(\d{3,4})(?:\s*mm)?/i;

  let matchChapa = t.match(regexChapaQtdFim);
  let larguraChapa = null;
  let compChapa = null;
  let qtdChapa = null;

  if (matchChapa) {
    larguraChapa = parseInt(matchChapa[1], 10);
    compChapa = parseInt(matchChapa[2], 10);
    qtdChapa = parseInt(matchChapa[3], 10);
  } else {
    matchChapa = t.match(regexChapaQtdInicio);
    if (matchChapa) {
      qtdChapa = parseInt(matchChapa[1], 10);
      larguraChapa = parseInt(matchChapa[2], 10);
      compChapa = parseInt(matchChapa[3], 10);
    } else {
      matchChapa = t.match(regexChapaApenasMedida);
      if (matchChapa) {
        const w = parseInt(matchChapa[1], 10);
        const l = parseInt(matchChapa[2], 10);
        // Validar se está na escala típica de chapa (>= 400x800)
        if (w >= 400 && l >= 800) {
          larguraChapa = w;
          compChapa = l;
          qtdChapa = Number(qtdOdoo) || 1;
        }
      }
    }
  }

  // Se detectou medidas de chapa lisa válidas (ex: 1200x3000, 1000x2000, 1250x3000, etc.)
  if (larguraChapa && compChapa && larguraChapa >= 300 && compChapa >= 500) {
    const q = qtdChapa || Number(qtdOdoo) || 1;
    const lM = +(compChapa / 1000).toFixed(3);
    const totalM = +(q * lM).toFixed(2);

    out.tipo_conformacao = "chapa_lisa";
    out.tipo_label = "Chapa Lisa / Blank";
    out.largura_mm = larguraChapa;
    out.comprimento_mm = compChapa;
    out.comprimento_m = lM;
    out.quantidade = q;
    out.pecas = q;
    out.metragem_total = totalM;
    out.dimensoes_fmt = `${larguraChapa} × ${compChapa} mm`;
    out.resumo_formatado = `${q} pçs de ${larguraChapa}×${compChapa}mm (Chapa Lisa)`;
    out.tem_especificacao = true;
    out.variacoes.push({
      qty: q,
      mm: compChapa,
      m: lM,
      total_m: totalM,
      largura_mm: larguraChapa,
      tipo: "chapa_lisa"
    });
    return extrairCorEEspessura(t, out);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // B. DETECÇÃO DE PERFIL DOBRADO (Ex: 40x75x40 - 10 PÇS ou 127X50X17X50X17MM 6000MM)
  // ═══════════════════════════════════════════════════════════════════════════
  // Padrão 3 a 5 abas (U simples, U enrijecido com 5 abas):
  // Ex: "127X50X17X50X17MM", "75X40X17X40X17MM", "127X50X17", "75x40x17"
  const regexPerfilMultiAbas = /\b(\d{1,3})\s*[xX*]\s*(\d{1,3})\s*[xX*]\s*(\d{1,3})(?:\s*[xX*]\s*(\d{1,3}))?(?:\s*[xX*]\s*(\d{1,3}))?(?:\s*mm)?(?![0-9a-z])/i;
  const matchPerfilMulti = t.match(regexPerfilMultiAbas);

  // Padrão 2 abas pequenas: "92x30", "125x50", "75x40", "50x50" (onde abas <= 350)
  const regexPerfil2Abas = /\b(\d{1,3})\s*[xX*]\s*(\d{1,3})(?:\s*mm)?(?![0-9a-z])/i;
  const matchPerfil2 = !matchPerfilMulti ? t.match(regexPerfil2Abas) : null;

  if (matchPerfilMulti || (matchPerfil2 && parseInt(matchPerfil2[1], 10) <= 350 && parseInt(matchPerfil2[2], 10) <= 350)) {
    const abas = [];
    if (matchPerfilMulti) {
      abas.push(parseInt(matchPerfilMulti[1], 10));
      abas.push(parseInt(matchPerfilMulti[2], 10));
      abas.push(parseInt(matchPerfilMulti[3], 10));
      if (matchPerfilMulti[4]) abas.push(parseInt(matchPerfilMulti[4], 10));
      if (matchPerfilMulti[5]) abas.push(parseInt(matchPerfilMulti[5], 10));
    } else if (matchPerfil2) {
      abas.push(parseInt(matchPerfil2[1], 10));
      abas.push(parseInt(matchPerfil2[2], 10));
    }

    const desenvTotal = abas.reduce((acc, a) => acc + a, 0);

    // Buscar quantidade de peças/barras no texto (ex: "70 PCS", "10 PÇS", "5 barras", "10 UN")
    const matchQtd = t.match(/\b(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|barras?|brs?|unidades?|un\.?|pc\.?)\b/i);
    let q = matchQtd ? parseInt(matchQtd[1], 10) : null;
    if (!q || q <= 0) {
      if (unidadeOdoo === "KG" && Number(qtdOdoo) > 50) {
        q = 1;
      } else {
        q = Number(qtdOdoo) || 1;
      }
    }

    // Buscar comprimento de barra com prioridade para milímetros explícitos ou metros industriais
    const matchCompForte =
      t.match(/\b([2-9]\d{3}|1[0-2]\d{3})\s*mm\b/i) ||
      t.match(/(?:c\/|com|de)\s*(\d{1,2}\.\d{3}|\d{3,5}\s*mm|\d+(?:[.,]\d+)?\s*(?:m\b|mts?\b|metros?\b))/i) ||
      t.match(/(?:c\/|com|de)\s*([2-9]\d{3}|1[0-2]\d{3})\b/i) ||
      t.match(/\b([2-9]\d{3}|1[0-2]\d{3})\b/) ||
      t.match(/\b(\d+(?:[.,]\d+)?)\s*(?:m\b|mts?\b|metros?\b)/i);

    let compMm = 6000; // padrão industrial
    let compM = 6.0;
    if (matchCompForte) {
      const parsed = parseComprimento(matchCompForte[1]);
      if (parsed.mm) {
        compMm = parsed.mm;
        compM = parsed.m;
      }
    }

    const totalM = +(q * compM).toFixed(2);
    const labelBarra = (q === 1) ? "barra" : "barras";
    const compFmt = (compMm >= 1000) ? compMm.toLocaleString("pt-BR") + " mm" : `${compM}m`;
    const perfilNome = abas.length >= 5 ? "Perfil U Enrijecido" : "Perfil U";

    out.tipo_conformacao = "perfil_dobrado";
    out.tipo_label = `${perfilNome} (${abas.join("×")})`;
    out.abas = abas;
    out.desenvolvimento_mm = desenvTotal;
    out.dimensoes_fmt = `${abas.join("×")} mm`;
    out.comprimento_mm = compMm;
    out.comprimento_m = compM;
    out.quantidade = q;
    out.pecas = q;
    out.metragem_total = totalM;
    out.resumo_formatado = `${q} ${labelBarra} c/ ${compFmt} (${perfilNome} ${abas.join("×")})`;
    out.tem_especificacao = true;
    out.variacoes.push({
      qty: q,
      mm: compMm,
      m: compM,
      total_m: totalM,
      abas,
      desenvolvimento_mm: desenvTotal,
      tipo: "perfil_dobrado"
    });
    return extrairCorEEspessura(t, out);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C. CORTES COMPOSTOS LINEARES TRADICIONAIS (Telhas e Barras Simples)
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Regex para cortes compostos: QTD + (palavra de peça opcional) + (separador opcional c/, com, de, -, :, x) + COMPRIMENTO
  const regexCorteComposto = /(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|barras?|telhas?|chapas?|unidades?|un\.?|pc\.?)?\s*(?:c\/|com|de|x|\*|\:|-|–|—)\s*(\d+(?:[.,]\d+)?\s*(?:mm|mts?|metros?|m\b)?)[\\\/]*/gi;

  let match;
  while ((match = regexCorteComposto.exec(t)) !== null) {
    const q = parseInt(match[1], 10);
    const compRaw = match[2];
    if (!q || isNaN(q)) continue;

    // Se o separador foi 'x' ou '*' e não tem unidade explícita (m ou mm) e comp < 500,
    // trata-se de seção transversal dimensional (ex: 50x50, 92x30), NÃO de corte linear!
    const temUnidadeLinear = /(?:mm|mts?|metros?|m\b)/i.test(compRaw);
    const numComp = parseFloat(compRaw.replace(",", "."));
    if (/[x*]/i.test(match[0].replace(compRaw, "")) && !temUnidadeLinear && numComp < 500) {
      continue;
    }

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

  // 2. Se não encontrou no formato composto acima, tenta padrão NxM grande
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
    // 3. Peças isoladas sem comprimento na descrição (ex: '60 peças', '60 pcs', '60 pçs', '60 barras', '7 telhas')
    const regexPecasIsoladas = /(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|barras?|telhas?|unidades?|un\.?)\b/i;
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
        // Prioriza o comprimento explícito da descrição (ex: 'C/5150mm') em vez de dividir metros do Odoo
        let mUnit = null;
        const matchCompDesc = t.match(/(?:c\/|com|de|-|–|—)\s*(\d{1,2}\.\d{3}|\d{3,5}\s*mm|\d+(?:[.,]\d+)?\s*(?:m|mts?|metros?))\b/i);
        if (matchCompDesc) {
          const parsedComp = parseComprimento(matchCompDesc[1]);
          if (parsedComp.mm && parsedComp.mm >= 300) mUnit = parsedComp.m;
        }
        if (!mUnit) mUnit = +(qOdoo / q).toFixed(3);
        const mmUnit = Math.round(mUnit * 1000);
        out.comprimento_m = mUnit;
        out.comprimento_mm = mmUnit;
        out.metragem_total = qOdoo;
        out.resumo_formatado = `${q} pçs c/ ${mmUnit.toLocaleString("pt-BR")} mm`;
        out.variacoes.push({ qty: q, mm: mmUnit, m: mUnit, total_m: qOdoo });
      }
    } else {
      // 4. Medida isolada na descrição com quantidade vindo do Odoo (ex: "6000mm", "c/ 6000", "6m", "- 6.000")
      const regexMedidaIsolada = /(?:c\/|com|de|-|–|—)?\s*(\d{1,2}\.\d{3}|\d{3,5}\s*mm|\d+(?:[.,]\d+)?\s*(?:m|mts?|metros?))\b/i;
      const matchMedida = t.match(regexMedidaIsolada);
      if (matchMedida) {
        const { mm, m } = parseComprimento(matchMedida[1]);
        if (mm && mm >= 300) {
          const qOdoo = Number(qtdOdoo) || 1;
          // Se o Odoo veio em metros lineares, a metragem NÃO é contagem de peças:
          // calcula as peças dividindo pelos metros de cada peça
          const uOdoo4 = String(unidadeOdoo || "").toLowerCase();
          const emMetros = ["m", "mt", "mts", "metro", "metros"].includes(uOdoo4);
          const qtyPecas = emMetros ? Math.max(1, Math.round(qOdoo / m)) : qOdoo;
          const totalMetros = emMetros ? qOdoo : +(qOdoo * m).toFixed(2);
          out.quantidade = qtyPecas;
          out.pecas = qtyPecas;
          out.comprimento_mm = mm;
          out.comprimento_m = m;
          out.metragem_total = totalMetros;
          out.tem_especificacao = true;
          out.resumo_formatado = `${qtyPecas} pçs c/ ${mm.toLocaleString("pt-BR")} mm`;
          out.variacoes.push({ qty: qtyPecas, mm: mm, m: m, total_m: totalMetros });
        }
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