import { calcularMetrosPedido, calcularKgPedido } from "@/lib/metrosHelper";

/**
 * 🏭 MÓDULO INDUSTRIAL DE APURAÇÃO DE CUSTO REAL POR PEDIDO / ORDEM
 * 
 * Calcula detalhadamente o gasto de fabricação de cada pedido de telhas e corte & dobra:
 * 1. Matéria-prima de Aço (Bobina consumida: KG x R$/kg)
 * 2. EPS / Isopor (Metragem x Espessura x R$/m)
 * 3. Insumos Químicos (Cola PU bi-componente)
 * 4. Custo Operacional (Tempo de Máquina / Mão de Obra)
 * 
 * Prepara e padroniza os campos para sincronização contábil/MRP com o Odoo ERP.
 */

// Custos médios padrão de mercado/indústria caso a bobina não tenha custo lançado na NF
export const CUSTOS_ACO_PADRAO = {
  GL: 7.20,       // Galvalume / Zincalume
  GV: 7.10,       // Galvanizado
  PP: 8.65,       // Pré-pintado
  FF: 6.80,       // Fina a Frio
  FQ: 6.70,       // Fina a Quente
  PADRAO: 7.20,   // Média geral
};

export const CUSTOS_INSUMOS_PADRAO = {
  EPS_30MM_M: 13.50,    // R$ por metro linear de EPS 30mm (densidade F1/ISO)
  EPS_50MM_M: 19.50,    // R$ por metro linear de EPS 50mm
  EPS_PADRAO_M: 14.50,  // R$ por metro médio de EPS
  COLA_PU_M: 4.20,      // R$ por metro linear de cola bi-componente PU
  MANTA_M: 6.50,        // Manta térmica / filme
  OPERACIONAL_MINUTO: 1.00, // R$ 60,00/hora de operação de perfiladeira
  OPERACIONAL_METRO_EST: 0.85, // R$ 0,85/m quando não há apontamento de cronômetro
};

/**
 * Identifica o custo por KG de aço mais preciso para a ordem:
 * 1º: Custo cadastrado na Bobina vinculada (R$/kg)
 * 2º: Custo médio das bobinas ativas no estoque
 * 3º: Custo tabelado padrão por qualidade do aço
 */
export function getCustoKgAco(ordem, bobinaMap = {}) {
  if (!ordem) return CUSTOS_ACO_PADRAO.PADRAO;

  // 1. Bobina vinculada diretamente
  const bobId = ordem.bobina_id || ordem.bobina_superior_id || ordem.bobina_inferior_id;
  if (bobId && bobinaMap[bobId]) {
    const b = bobinaMap[bobId];
    const raw = b.custo ?? b.custo_kg;
    if (raw !== undefined && raw !== null && raw !== "") {
      const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
      if (!isNaN(num) && num > 0) return num;
    }
    if (b.custo_total && b.peso_kg && Number(b.peso_kg) > 0) {
      const num = Number(b.custo_total) / Number(b.peso_kg);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  // 2. Qualidade identificada no produto/modelo
  const texto = `${ordem.produto || ""} ${ordem.modelo || ""} ${ordem.bobina_descricao || ""}`.toUpperCase();
  if (texto.includes("PINTAD") || texto.includes("BRANC") || texto.includes("PRE-PINT") || texto.includes("PP")) {
    return CUSTOS_ACO_PADRAO.PP;
  }
  if (texto.includes("GALVALUME") || texto.includes("GL") || texto.includes("ZINCALUME")) {
    return CUSTOS_ACO_PADRAO.GL;
  }
  if (texto.includes("GALVANIZAD") || texto.includes("GV")) {
    return CUSTOS_ACO_PADRAO.GV;
  }
  if (texto.includes("FF")) return CUSTOS_ACO_PADRAO.FF;
  if (texto.includes("FQ")) return CUSTOS_ACO_PADRAO.FQ;

  return CUSTOS_ACO_PADRAO.PADRAO;
}

/**
 * Calcula a composição completa de custo de fabricação de uma Ordem de Produção (OP)
 */
export function calcularCustoOrdem(ordem, bobinaMap = {}) {
  if (!ordem) {
    return {
      custoTotal: 0,
      custoAco: 0,
      custoEps: 0,
      custoCola: 0,
      custoOperacional: 0,
      kgAco: 0,
      custoKgAco: CUSTOS_ACO_PADRAO.PADRAO,
      metros: 0,
      custoPorMetro: 0,
      custoPorKg: 0,
      bobinaCodigo: "",
      isTermoacustica: false,
    };
  }

  const metros = calcularMetrosPedido(ordem);
  const kgGravado = calcularKgPedido(ordem);
  const custoKgAco = getCustoKgAco(ordem, bobinaMap);

  // Análise física da largura e espessura da chapa
  const prod = String(ordem.produto || ordem.modelo || "").toUpperCase();
  const maq = String(ordem.maquina || "").toUpperCase();
  const isBobininha = /(bobininha|bobina|fita|desbobinador)/i.test(`${prod} ${maq}`);
  const isCumeeira = prod.includes("CUMEEIRA") || maq === "CUMEEIRA";
  const largMm = isBobininha ? 300 : isCumeeira ? 600 : 1200;
  const espessura = parseFloat(ordem.espessura || ordem.chapa) || 0.43;

  // Peso teórico exato derivado da física do aço (Densidade 7,85 g/cm³)
  const kgTeorico = metros > 0 ? Math.round(metros * (espessura * 7.85 * (largMm / 1000)) * 10) / 10 : 0;

  // Detecção de discrepância física extrema (ex: 60m com 14.582 kg herdados por erro de digitação antigo)
  let discrepanciaPeso = false;
  let kgAco = kgGravado;

  if (metros > 0 && kgTeorico > 0) {
    if (kgGravado > kgTeorico * 2.5 || (kgGravado > 0 && kgGravado < kgTeorico * 0.35)) {
      discrepanciaPeso = true;
      // Se não houver confirmação manual expressa de peso pesado na balança, usa o peso físico real
      if (!ordem.peso_confirmado_balanca) {
        kgAco = kgTeorico;
      }
    }
  }

  // Se o peso gravado for zero, adota o peso teórico
  if (kgAco <= 0 && kgTeorico > 0) {
    kgAco = kgTeorico;
  }

  // 1. Custo Matéria-Prima: Aço
  const custoAco = Math.round(kgAco * custoKgAco * 100) / 100;

  // 2. Custo Insumos: EPS / Isopor (Telhas Termoacústicas)
  const isTermoacustica = /(EPS|ISOPOR|SANDU|TERMO|MANTA|COLAGEM)/i.test(prod) || ordem.maquina === "COLAGEM";

  let custoEps = 0;
  let custoCola = 0;

  if (isTermoacustica && metros > 0) {
    // Detecta espessura do EPS
    const is50mm = prod.includes("50MM") || prod.includes("50 MM") || prod.includes("EPS50") || prod.includes("EPS 50");
    const is30mm = prod.includes("30MM") || prod.includes("30 MM") || prod.includes("EPS30") || prod.includes("EPS 30");
    const valorMetroEps = is50mm ? CUSTOS_INSUMOS_PADRAO.EPS_50MM_M : is30mm ? CUSTOS_INSUMOS_PADRAO.EPS_30MM_M : CUSTOS_INSUMOS_PADRAO.EPS_PADRAO_M;

    custoEps = Math.round(metros * valorMetroEps * 100) / 100;

    // Se é sanduíche com colagem, consome cola PU bi-componente
    const isColagem = prod.includes("SANDU") || prod.includes("COLAGEM") || prod.includes("TELHA + EPS + TELHA") || ordem.maquina === "COLAGEM";
    if (isColagem) {
      custoCola = Math.round(metros * CUSTOS_INSUMOS_PADRAO.COLA_PU_M * 100) / 100;
    }
  }

  // 3. Custo Operacional (Tempo de Máquina / Operadores)
  let custoOperacional = 0;
  const tempoSegundos = Number(ordem.tempo_producao_segundos || 0);
  if (tempoSegundos > 0) {
    const minutos = tempoSegundos / 60;
    custoOperacional = Math.round(minutos * CUSTOS_INSUMOS_PADRAO.OPERACIONAL_MINUTO * 100) / 100;
  } else if (metros > 0) {
    // Estimativa fabril média caso o operador não tenha acionado o cronômetro
    custoOperacional = Math.round(metros * CUSTOS_INSUMOS_PADRAO.OPERACIONAL_METRO_EST * 100) / 100;
  }

  // 4. Custo Total Consolidado
  const custoTotal = Math.round((custoAco + custoEps + custoCola + custoOperacional) * 100) / 100;
  const custoPorMetro = metros > 0 ? Math.round((custoTotal / metros) * 100) / 100 : 0;
  const custoPorKg = kgAco > 0 ? Math.round((custoTotal / kgAco) * 100) / 100 : 0;

  // Código da bobina vinculada (para rastreabilidade)
  const bobId = ordem.bobina_id || ordem.bobina_superior_id || ordem.bobina_inferior_id;
  const bobObj = bobId ? bobinaMap[bobId] : null;
  const bobinaCodigo = bobObj?.codigo || ordem.bobina_numero || ordem.bobina_descricao || "";

  // Preço de venda (se importado do Odoo) e Margem Bruta
  const precoVenda = Number(ordem.valor_total || ordem.total_geral || ordem.valor_venda || 0);
  const lucroBruto = precoVenda > 0 ? Math.round((precoVenda - custoTotal) * 100) / 100 : null;
  const margemBrutaPct = precoVenda > 0 ? Math.round(((precoVenda - custoTotal) / precoVenda) * 1000) / 10 : null;

  return {
    custoTotal,
    custoAco,
    custoEps,
    custoCola,
    custoOperacional,
    custoMateriaPrima: Math.round((custoAco + custoEps + custoCola) * 100) / 100,
    kgAco,
    kgGravado,
    kgTeorico,
    discrepanciaPeso,
    espessura,
    largMm,
    tempoSegundos,
    custoKgAco,
    metros,
    custoPorMetro,
    custoPorKg,
    bobinaCodigo,
    bobinaObj: bobObj,
    isTermoacustica,
    precoVenda,
    lucroBruto,
    margemBrutaPct,
  };
}

/**
 * Formata moeda BRL
 */
export function formatarMoeda(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Monta o pacote de dados de custos pronto para ser enviado ao Odoo ERP
 */
export function prepararCustoParaOdoo(ordem, bobinaMap = {}) {
  const c = calcularCustoOrdem(ordem, bobinaMap);
  return {
    custo_total: c.custoTotal,
    custo_materia_prima: c.custoMateriaPrima,
    custo_aco: c.custoAco,
    custo_eps: c.custoEps,
    custo_cola: c.custoCola,
    custo_operacional: c.custoOperacional,
    custo_unitario_metro: c.custoPorMetro,
    custo_unitario_kg: c.custoPorKg,
    kg_consumido: c.kgAco,
    bobina_codigo: c.bobinaCodigo,
    bobina_custo_kg: c.custoKgAco,
    tempo_producao_segundos: Number(ordem.tempo_producao_segundos || 0),
  };
}
