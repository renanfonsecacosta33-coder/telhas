/**
 * Módulo central de cálculo de metragem linear de pedidos de telhas
 * e conversão precisa de KG <-> Metros lineares de bobinas.
 * 
 * Garante que a metragem mostrada no Painel da Máquina (ex: 101,7m)
 * bata exatamente com a Visão Admin, Dashboards e Cards.
 */

/**
 * 🛡️ Detecta anomalias matemáticas conhecidas de pedidos de telhas
 * (ex: metros ao quadrado, cumeeiras com 60m, telhas com 69m por erro de escala de float no Odoo).
 */
export function sanitizarMetrosAnormais(p) {
  if (!p) return null;

  // 1. Decisão manual expressa tem prioridade
  if (Number(p.metros_retificados) > 0) return Number(p.metros_retificados);
  if (p.retificado_manualmente && Number(p.metros_totais) > 0) return Number(p.metros_totais);

  let mm = Number(p.metragem_mm) || 0;
  let pecas = Number(p.metros) || Number(p.quantidade) || 0;
  const qtdTelhasLinear = Number(p.quantidade_telhas || p.metragem_planejada || 0);
  const produtoStr = String(p.produto || p.modelo || "").toUpperCase();

  // Caso A: Cumeeira com comprimento absurdo (ex: 60.000mm = 60 metros por peça)
  // Cumeeiras industriais são sempre de 1000mm (1.0m) a 3000mm (3.0m).
  if ((produtoStr.includes("CUMEEIRA") || p.maquina === "CUMEEIRA") && mm >= 10000) {
    return pecas > 0 ? pecas * 1.0 : (mm / 1000);
  }

  // Caso B: Telha com comprimento individual absurdo (>= 15.000 mm = 15 metros)
  // Caminhões não transportam telhas > 14m. Valores como 69.000mm, 38.400mm vieram de formatação float.
  if (mm >= 15000) {
    // Subcaso B1: Se mm / 1000 é exatamente igual a pecas (ex: mm=38400 e pecas=38.4)
    if (pecas > 0 && Math.abs(pecas - (mm / 1000)) < 0.1) {
      return pecas;
    }
    // Subcaso B2: mm tem um zero a mais por erro de digitação/export (ex: 69000 -> 6900mm = 6.9m)
    if (mm % 10 === 0 && (mm / 10) <= 14000) {
      const mmCorrigido = mm / 10;
      return (pecas * mmCorrigido) / 1000;
    }
  }

  // Caso C: Metragem total do Odoo multiplicada pelo comprimento (Metros ao quadrado)
  // Exemplo: pecas = 387.5 (que é decimal e veio de metros) e mm = 6000 (6m).
  // Ninguém pede "387.5 peças" de telha. O 387.5 é a metragem total linear!
  if (pecas > 0 && mm > 1000) {
    const isPecasFracionada = pecas % 1 !== 0; // tem casas decimais (ex: 387.5, 38.4, 121.6)
    const totalCalculado = (pecas * mm) / 1000;

    if (totalCalculado >= 500 && isPecasFracionada) {
      return pecas;
    }

    if (qtdTelhasLinear > 0 && Math.abs(qtdTelhasLinear - pecas) < 0.01 && totalCalculado > qtdTelhasLinear * 1.5) {
      return pecas;
    }
  }

  // Caso D: Bobininha no desbobinador com comprimento excessivo
  if (produtoStr.includes("BOBININHA") || p.maquina === "DESBOBINADOR") {
    const totalCalculado = mm > 0 && pecas > 0 ? (pecas * mm) / 1000 : 0;
    if (totalCalculado >= 1000 && mm === 500000) {
      return pecas * 0.5;
    }
    if (totalCalculado >= 2000 && mm >= 50000) {
      // Ex: 10 pçs c/ 500mm computado como 500m -> 50m
      return pecas * (mm / 100000);
    }
  }

  return null;
}

export function calcularMetrosPedido(p) {
  if (!p) return 0;

  // 0. Prioridade absoluta para retificação manual expressa
  if (Number(p.metros_retificados) > 0) {
    return Number(p.metros_retificados);
  }
  if (p.retificado_manualmente && Number(p.metros_totais) > 0) {
    return Number(p.metros_totais);
  }

  // 0.1 Sanitização inteligente de anomalias matemáticas
  const metrosSanitizados = sanitizarMetrosAnormais(p);
  if (metrosSanitizados !== null && metrosSanitizados >= 0) {
    return Number(metrosSanitizados.toFixed(2));
  }

  // 1. Se tiver variações de telhas salvas (modo de medidas múltiplas)
  let variacoes = [];
  try {
    variacoes = typeof p.variacoes_telhas === "string"
      ? JSON.parse(p.variacoes_telhas || "[]")
      : (p.variacoes_telhas || []);
  } catch {
    variacoes = [];
  }

  if (Array.isArray(variacoes) && variacoes.length > 0) {
    const totalM = variacoes.reduce(
      (sum, v) => {
        let vMm = Number(v.mm) || 0;
        let vQty = Number(v.qty) || 0;
        // Sanitiza se a variação individual tiver erro de zero extra (ex: 69000mm)
        if (vMm >= 15000 && vMm % 10 === 0 && (vMm / 10) <= 14000) {
          vMm = vMm / 10;
        }
        return sum + (vQty * vMm);
      },
      0
    ) / 1000;
    if (totalM > 0) return totalM;
  }

  // 2. Se tiver metragem_mm e metros/quantidade (onde p.metros é a quantidade de peças)
  let mm = Number(p.metragem_mm) || 0;
  let pecas = Number(p.metros) || Number(p.quantidade_telhas) || 0;
  if (mm > 0 && pecas > 0) {
    if (mm >= 15000 && mm % 10 === 0 && (mm / 10) <= 14000) {
      mm = mm / 10;
    }
    return (pecas * mm) / 1000;
  }

  // 3. Se tiver metros_totais explicitamente gravados
  if (Number(p.metros_totais) > 0) {
    return Number(p.metros_totais);
  }

  // 4. Fallback: p.metros
  return Number(p.metros) || 0;
}

/**
 * Converte KG de aço em metros lineares de telhas.
 * Fórmula: Metros = KG / (espessura_mm * 7.85 * largura_m)
 * Padrão: 1200mm de largura, chapa 0.43 (ou chapa informada).
 */
export function calcMetrosDeKg(kg, chapa = 0.43, larguraMm = 1200) {
  const k = Number(kg) || 0;
  if (k <= 0) return 0;

  const esp = Number(chapa) > 0 ? Number(chapa) : 0.43;
  const largM = (Number(larguraMm) || 1200) / 1000;
  const kgPorMetro = esp * 7.85 * largM;

  return kgPorMetro > 0 ? k / kgPorMetro : 0;
}

/**
 * Converte metros lineares de telha para KG estimado de aço.
 */
export function calcKgDeMetros(metros, chapa = 0.43, larguraMm = 1200) {
  const m = Number(metros) || 0;
  if (m <= 0) return 0;

  const esp = Number(chapa) > 0 ? Number(chapa) : 0.43;
  const largM = (Number(larguraMm) || 1200) / 1000;
  return m * (esp * 7.85 * largM);
}

/**
 * Calcula os KG de um pedido/ordem de telhas ou bobininhas.
 * 1. Prioridade para peso real/registrado na balança ou kg_total (se > 0)
 * 2. Fallback inteligente: calcula teoricamente com base nos metros lineares e na espessura da chapa.
 */
export function calcularKgPedido(p) {
  if (!p) return 0;

  // 1. Se tem peso real da balança ou kg_total gravado
  const pesoGravado = Number(p.kg_total || p.peso_kg || p.peso_real || 0);
  if (pesoGravado > 0) {
    return pesoGravado;
  }

  // 2. Se tem metragem, calcula o peso teórico
  const metros = calcularMetrosPedido(p);
  if (metros <= 0) return 0;

  // Extrair espessura (padrão 0.43 se não encontrada)
  let esp = Number(p.espessura || p.chapa) || 0;
  if (!esp || isNaN(esp)) {
    const textoCompleto = `${p.chapa || ""} ${p.espessura || ""} ${p.bobina_descricao || ""} ${p.produto || ""} ${p.descricao || ""}`;
    const mEsp = textoCompleto.match(/\b(0[,\.]\d{2})\b/);
    if (mEsp) {
      esp = parseFloat(mEsp[1].replace(",", "."));
    }
  }
  if (!esp || esp <= 0) esp = 0.43;

  // Largura da chapa: bobina padrão de telha tem 1200mm de largura.
  // Se for bobininha ou fita de corte, tem largura reduzida (média ~300mm).
  let largMm = 1200;
  const isBobininha = /(bobininha|bobina|fita|desbobinador)/i.test(`${p.produto || ""} ${p.maquina || ""}`);
  if (isBobininha) {
    const textoCompleto = `${p.produto || ""} ${p.descricao || ""} ${p.bobina_descricao || ""}`;
    const mLarg = textoCompleto.match(/\b(100|150|200|250|300|400|500)\s*mm\b/i);
    largMm = mLarg ? parseInt(mLarg[1], 10) : 300;
  }

  return Math.round(calcKgDeMetros(metros, esp, largMm));
}
