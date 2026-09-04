/**
 * Módulo central de cálculo de metragem linear de pedidos de telhas
 * e conversão precisa de KG <-> Metros lineares de bobinas.
 * 
 * Garante que a metragem mostrada no Painel da Máquina (ex: 101,7m)
 * bata exatamente com a Visão Admin, Dashboards e Cards.
 */

export function calcularMetrosPedido(p) {
  if (!p) return 0;

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
      (sum, v) => sum + (Number(v.qty) || 0) * (Number(v.mm) || 0),
      0
    ) / 1000;
    if (totalM > 0) return totalM;
  }

  // 2. Se tiver metragem_mm e metros/quantidade (onde p.metros é a quantidade de peças)
  const mm = Number(p.metragem_mm) || 0;
  const pecas = Number(p.metros) || Number(p.quantidade_telhas) || 0;
  if (mm > 0 && pecas > 0) {
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
