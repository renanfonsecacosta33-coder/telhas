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

