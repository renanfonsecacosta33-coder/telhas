/**
 * Módulo central de cálculo de metragem linear de pedidos de telhas
 * e conversão precisa de KG <-> Metros lineares de bobinas.
 * 
 * Garante que a metragem mostrada no Painel da Máquina (ex: 101,7m)
 * bata exatamente com a Visão Admin, Dashboards e Cards.
 */

/**
 * 🛡️ Detecta e corrige anomalias matemáticas conhecidas de pedidos de telhas
 * utilizando VALIDAÇÃO FÍSICA INDUSTRIAL (relação direta entre KG de Aço e Metros Lineares).
 *
 * Princípio: 180 toneladas de aço NÃO produzem 7.600 metros de telhas.
 * Em chapa 0.43 (1200mm de largura), cada metro consome ~4,05 kg de aço.
 * Se o pedido possui peso registrado (balança ou Odoo), a física valida a metragem.
 */
export function sanitizarMetrosAnormais(p) {
  if (!p) return null;

  let mm = Number(p.metragem_mm) || 0;
  let pecas = Number(p.metros) || Number(p.quantidade) || 0;
  const qtdTelhasLinear = Number(p.quantidade_telhas || p.metragem_planejada || 0);
  const produtoStr = String(p.produto || p.modelo || "").toUpperCase();
  const maquinaStr = String(p.maquina || "").toUpperCase();

  // 1. Decisão manual expressa do usuário:
  // Só é mantida se NÃO for uma distorção física gritante gerada por auto-reparo antigo
  const pesoKg = Number(p.peso_kg || p.kg_total || p.peso_real || 0);
  const espessura = parseFloat(p.espessura || p.chapa) || 0.43;
  const isBobininha = /(bobininha|bobina|fita|desbobinador)/i.test(`${produtoStr} ${maquinaStr}`);
  const largMm = isBobininha ? 300 : 1200;

  if (Number(p.metros_retificados) > 0) {
    const mRet = Number(p.metros_retificados);
    // Se o pedido tem peso real registrado (ex: 9.400 kg) e mRet foi achatado para 387m (peso equivaleria a ~1.500kg),
    // o mRet foi corrompido por auto-reparo anterior e deve ser liberado para validação física.
    if (pesoKg >= 1000) {
      const kgEstimadoMRet = calcKgDeMetros(mRet, espessura, largMm);
      if (kgEstimadoMRet > 0 && pesoKg > kgEstimadoMRet * 2.5) {
        // Ignora retificação antiga corrompida e continua para cálculo físico
      } else {
        return mRet;
      }
    } else {
      return mRet;
    }
  }

  // Caso A: Cumeeira com comprimento absurdo (ex: 60.000mm = 60 metros por peça)
  // Cumeeiras industriais são sempre de 1000mm (1.0m) a 3000mm (3.0m).
  if ((produtoStr.includes("CUMEEIRA") || maquinaStr === "CUMEEIRA") && mm >= 10000) {
    return pecas > 0 ? pecas * 1.0 : (mm / 1000);
  }

  // Caso B: Telha com comprimento individual absurdo (>= 15.000 mm = 15 metros)
  // Caminhões não transportam telhas > 14m. Valores como 69.000mm vieram de formatação float com zero extra.
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

  // Caso C: Desbobinador / Bobininhas com comprimento excessivo
  if (isBobininha) {
    const totalCalculado = mm > 0 && pecas > 0 ? (pecas * mm) / 1000 : 0;
    if (totalCalculado >= 1000 && mm === 500000) {
      return pecas * 0.5;
    }
    if (totalCalculado >= 2000 && mm >= 50000) {
      return pecas * (mm / 100000);
    }
  }

  // Caso D: VALIDAÇÃO FÍSICA INTELIGENTE VIA PESO DE AÇO (KG)
  // Se o pedido possui peso registrado (Odoo ou balança):
  if (pesoKg > 0 && pecas > 0 && mm > 0) {
    const totalCalculado = (pecas * mm) / 1000;
    const mEsperadoPeloPeso = calcMetrosDeKg(pesoKg, espessura, largMm);

    if (mEsperadoPeloPeso > 0) {
      // D1. Se o total calculado bate com o peso em KG (entre 0.4x e 2.2x), é 100% LEGÍTIMO!
      // Exemplo: 2.325m calculados para 9.416 kg de aço (que pedem ~2.322m).
      // Jamais cortar pedidos grandes de construtoras/barracões!
      if (totalCalculado >= mEsperadoPeloPeso * 0.4 && totalCalculado <= mEsperadoPeloPeso * 2.2) {
        return totalCalculado;
      }

      // D2. Se o total calculado for absurdamente maior que o peso (ex: 2.325m para apenas 1.500kg de aço),
      // houve erro de multiplicação (metros ao quadrado). Se 'pecas' bate com o peso esperado, usa 'pecas'.
      if (totalCalculado > mEsperadoPeloPeso * 2.5) {
        if (pecas >= mEsperadoPeloPeso * 0.6 && pecas <= mEsperadoPeloPeso * 1.5) {
          return pecas;
        }
        return Number(mEsperadoPeloPeso.toFixed(2));
      }

      // D3. Se o total calculado foi achatado (ex: 387m para 9.400kg de aço),
      // a física restaura a produção real correspondente ao aço consumido.
      if (totalCalculado < mEsperadoPeloPeso * 0.35) {
        return Number(mEsperadoPeloPeso.toFixed(2));
      }
    }
  }

  // Caso E: Metros ao quadrado sem peso cadastrado
  if (pecas > 0 && mm > 1000 && pesoKg <= 0) {
    const totalCalculado = (pecas * mm) / 1000;
    if (qtdTelhasLinear > 0 && Math.abs(qtdTelhasLinear - pecas) < 0.01 && totalCalculado > qtdTelhasLinear * 3) {
      return pecas;
    }
  }

  return null;
}

export function calcularMetrosPedido(p) {
  if (!p) return 0;

  // 0. Prioridade absoluta para retificação manual expressa válida
  const pesoKg = Number(p.peso_kg || p.kg_total || p.peso_real || 0);
  const espessura = parseFloat(p.espessura || p.chapa) || 0.43;
  const isBobininha = /(bobininha|bobina|fita|desbobinador)/i.test(`${p.produto || ""} ${p.maquina || ""}`);
  const largMm = isBobininha ? 300 : 1200;

  if (Number(p.metros_retificados) > 0) {
    const mRet = Number(p.metros_retificados);
    // Se o pedido tem peso real de 1+ ton de aço e o mRet foi achatado para menos de 40% do peso,
    // libera para validação física
    const kgEstimadoMRet = calcKgDeMetros(mRet, espessura, largMm);
    if (!(pesoKg >= 1000 && kgEstimadoMRet > 0 && pesoKg > kgEstimadoMRet * 2.5)) {
      return mRet;
    }
  }

  if (p.retificado_manualmente && Number(p.metros_totais) > 0) {
    const mTot = Number(p.metros_totais);
    const kgEstimadoMTot = calcKgDeMetros(mTot, espessura, largMm);
    if (!(pesoKg >= 1000 && kgEstimadoMTot > 0 && pesoKg > kgEstimadoMTot * 2.5)) {
      return mTot;
    }
  }

  // 0.1 Sanitização física de anomalias
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

  // 2. Se tiver metragem_mm e metros/quantidade
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

  // 4. Se tiver peso em KG cadastrado, estima os metros reais
  if (pesoKg > 0) {
    const mEstimado = calcMetrosDeKg(pesoKg, espessura, largMm);
    if (mEstimado > 0) return Number(mEstimado.toFixed(2));
  }

  // 5. Fallback: p.metros
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
