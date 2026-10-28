// =====================================================================
// HELPER DE SELEÇÃO AUTOMÁTICA E MINUCIOSA DE BOBINAS & ROTEAMENTO
// EXCLUSIVO PARA O BARRACÃO DE TELHAS (NÃO ALTERA NADA NO CORTE & DOBRA)
// =====================================================================

import { base44 } from "@/api/base44Client";
import {
  detectarTipoProdutoTelha,
  extrairCortesBobininha,
  detectarMaquinaTelha,
  detectarEspessura,
  detectarOrigemAco,
  detectarEPSTelha,
  getItens,
  itensPorGrupo,
  computePercentual,
  statusPcpPorPercentual,
  buildItensJson
} from "@/lib/pedidoOdooHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { extrairCroquiPedido } from "@/lib/croquiExtractor";
import { isEspessuraCompatible, isOrigemCompatible, removerAcentos, detectarCorTelha, isCorCompativel, isMesmaFilial } from "@/lib/bobinaValidation";
import { isBobinaAberta, isBobinaNatural } from "@/lib/bobinaStatusHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { calcularDataPrometidaSLA, toISODate } from "@/lib/sla";
import { getPrioridadeNivel } from "@/lib/prioridadeHelper";
import { extrairRotuloBobinaSimplificado, extrairRotuloFaceInferior } from "@/lib/bobinaRotuloHelper";
import { filtrarOpsDasOfsExatas } from "@/lib/conciliacaoPcpMaquinasHelper";
import { hojeLocalISO } from "@/lib/dataLocal";

export { removerAcentos, detectarCorTelha, isCorCompativel };
export const LOCAL_STORAGE_KEY_AUTO_TELHAS = "pcp_auto_roteamento_telhas";

/**
 * Executa uma operação com retentativas — resistente a erros transitórios
 * (limite de tráfego 429, falha de rede). Essencial para não criar OPs
 * duplicadas nem deixar pedidos "meio distribuídos".
 */
export async function comRetry(fn, tentativas = 3, delayMs = 1500) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoErro = e;
      // Respeita a janela "Retry after N seconds" do servidor (limite de tráfego),
      // com teto de 30s por espera para não travar a interface
      const msg = String(e?.message || e?.detail || e || "");
      const m = msg.match(/Retry after (\d+) seconds/i);
      const espera = m ? Math.min(Number(m[1]) * 1000 + 2000, 30000) : delayMs * (i + 1);
      await new Promise((r) => setTimeout(r, espera));
    }
  }
  throw ultimoErro;
}

/**
 * Consulta o estado do toggle (Liga/Desliga) do auto-roteamento de telhas.
 * Default: true (ligado por conveniência, pode ser desligado a qualquer momento).
 */
export function isAutoRoteamentoTelhasAtivo() {
  try {
    const val = localStorage.getItem(LOCAL_STORAGE_KEY_AUTO_TELHAS);
    if (val === null) return true; // Ativo por padrão se não configurado
    return val === "true" || val === "1";
  } catch {
    return true;
  }
}

/**
 * Salva o estado do toggle (Liga/Desliga) do auto-roteamento de telhas.
 */
export function setAutoRoteamentoTelhasAtivo(ativo) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_AUTO_TELHAS, ativo ? "true" : "false");
  } catch (e) {
    console.error("[AutoBobinaTelhas] Erro ao salvar estado:", e);
  }
}


/**
 * Detecta as cores independentes da chapa superior e chapa inferior para telhas duplas (sanduíche).
 * Suporta formatos explícitos como:
 * - "EXTERNA CERAMICA / INTERNA BRANCA"
 * - "EXT: CERAMICA / INT: BRANCA"
 * - "SUPERIOR CERAMICA / INFERIOR BRANCA"
 * - "CERAMICA / BRANCA"
 */
export function detectarCoresDuplaTelha(produtoTexto = "", descricaoTexto = "") {
  const combined = removerAcentos(`${produtoTexto || ""} ${descricaoTexto || ""}`);
  
  let corSup = "NATURAL";
  let corInf = "NATURAL";

  // 1. Padrão explícito com EXTERNA ... INTERNA (ex: "EXTERNA CERAMICA / INTERNA BRANCA", "EXT: BRANCA / INT: PRETA")
  const matchExtInt = combined.match(/(?:EXTERNA|EXT|FACE\s*SUPERIOR|SUPERIOR|CHAPA\s*SUPERIOR)\s*[:=-]?\s*([A-Z]+)[^A-Z]*(?:INTERNA|INT|FACE\s*INFERIOR|INFERIOR|CHAPA\s*INFERIOR|BANDEJA)\s*[:=-]?\s*([A-Z]+)/i);
  if (matchExtInt) {
    corSup = normalizarCorDupla(matchExtInt[1]);
    corInf = normalizarCorDupla(matchExtInt[2]);
    return { corSuperior: corSup, corInferior: corInf };
  }

  // Padrão inverso: INTERNA ... EXTERNA (ex: "INTERNA BRANCA / EXTERNA CERAMICA")
  const matchIntExt = combined.match(/(?:INTERNA|INT|FACE\s*INFERIOR|INFERIOR|CHAPA\s*INFERIOR)\s*[:=-]?\s*([A-Z]+)[^A-Z]*(?:EXTERNA|EXT|FACE\s*SUPERIOR|SUPERIOR|CHAPA\s*SUPERIOR)\s*[:=-]?\s*([A-Z]+)/i);
  if (matchIntExt) {
    corInf = normalizarCorDupla(matchIntExt[1]);
    corSup = normalizarCorDupla(matchIntExt[2]);
    return { corSuperior: corSup, corInferior: corInf };
  }

  // 2. Formato com barra: "NATURAL / PRETA", "CERAMICA / BRANCA", "BRANCA / PRETA"
  const matchBarra = combined.match(/(NATURAL|GALVALUME|BRANC[OA]|PRET[OA]|AZUL|BEGE|CINZA|CERAMIC[OA]|TERRACOTA|VERMELH[OA]|MARROM|VERDE|AMAREL[OA])\s*[\/|\\]\s*(NATURAL|GALVALUME|BRANC[OA]|PRET[OA]|AZUL|BEGE|CINZA|CERAMIC[OA]|TERRACOTA|VERMELH[OA]|MARROM|VERDE|AMAREL[OA])/i);
  if (matchBarra) {
    corSup = normalizarCorDupla(matchBarra[1]);
    corInf = normalizarCorDupla(matchBarra[2]);
    return { corSuperior: corSup, corInferior: corInf };
  }

  // 3. Menção explícita à parte interna / chapa inferior (inclui "BANDEJA <cor>" da Telha Bandeja)
  const matchBandejaCor = combined.match(/BANDEJA\s*[:=-]?\s*(NATURAL|GALVALUME|AMADEIRAD[AO]|PRET[OA]|BRANC[OA]|AZUL|BEGE|CINZA|CERAMIC[OA]|TERRACOTA|VERMELH[OA]|MARROM|VERDE|AMAREL[OA])/i);
  if (matchBandejaCor) {
    corInf = normalizarCorDupla(matchBandejaCor[1]);
  } else if (/PRE\s*PINTADA\s*PRET[OA]\s*PARTE\s*INTERNA|PARTE\s*INTERNA\s*PRET[OA]|FACE\s*INFERIOR\s*PRET[OA]|INFERIOR\s*PRET[OA]|CHAPA\s*INFERIOR\s*PRET[OA]/i.test(combined)) {
    corInf = "PRETO";
  } else if (/PRE\s*PINTADA\s*BRANC[OA]\s*PARTE\s*INTERNA|PARTE\s*INTERNA\s*BRANC[OA]|FACE\s*INFERIOR\s*BRANC[OA]|INFERIOR\s*BRANC[OA]|CHAPA\s*INFERIOR\s*BRANC[OA]/i.test(combined)) {
    corInf = "BRANCO";
  } else if (/PARTE\s*INTERNA\s*AZUL|FACE\s*INFERIOR\s*AZUL/i.test(combined)) {
    corInf = "AZUL";
  } else if (/PARTE\s*INTERNA\s*CERAMIC|FACE\s*INFERIOR\s*CERAMIC/i.test(combined)) {
    corInf = "CERAMICA";
  } else if (/PARTE\s*INTERNA\s*NATURAL|FACE\s*INFERIOR\s*NATURAL/i.test(combined)) {
    corInf = "NATURAL";
  }

  // 4. Menção explícita à parte externa / chapa superior
  if (/PARTE\s*EXTERNA\s*PRET[OA]|FACE\s*SUPERIOR\s*PRET[OA]|SUPERIOR\s*PRET[OA]|CHAPA\s*SUPERIOR\s*PRET[OA]/i.test(combined)) {
    corSup = "PRETO";
  } else if (/PARTE\s*EXTERNA\s*BRANC[OA]|FACE\s*SUPERIOR\s*BRANC[OA]|SUPERIOR\s*BRANC[OA]|CHAPA\s*SUPERIOR\s*BRANC[OA]/i.test(combined)) {
    corSup = "BRANCO";
  } else if (/PARTE\s*EXTERNA\s*CERAMIC|FACE\s*SUPERIOR\s*CERAMIC/i.test(combined)) {
    corSup = "CERAMICA";
  } else if (/NATURAL|GALVALUME|GV|GL/i.test(combined)) {
    corSup = "NATURAL";
  } else {
    corSup = detectarCorTelha(produtoTexto, descricaoTexto) || "NATURAL";
  }

  return { corSuperior: corSup, corInferior: corInf };
}

function normalizarCorDupla(c = "") {
  const norm = removerAcentos(c);
  if (/PRET/i.test(norm)) return "PRETO";
  if (/BRANC/i.test(norm)) return "BRANCO";
  if (/AZUL/i.test(norm)) return "AZUL";
  if (/BEGE|AREIA/i.test(norm)) return "BEGE";
  if (/GRAFIT/i.test(norm)) return "GRAFITE";
  if (/CINZA/i.test(norm)) return "CINZA";
  if (/CERAMIC/i.test(norm)) return "CERAMICA";
  if (/TERRACOT/i.test(norm)) return "TERRACOTA";
  if (/VERMELH/i.test(norm)) return "VERMELHO";
  if (/MARROM/i.test(norm)) return "MARROM";
  if (/VERD/i.test(norm)) return "VERDE";
  if (/AMAREL/i.test(norm)) return "AMARELO";
  if (/AMADEIRAD|MADEIR/i.test(norm)) return "AMADEIRADA";
  return "NATURAL";
}

/**
 * Estima a metragem restante utilizável de uma bobina.
 */
function calcularMetragemDisponivel(bobina) {
  if (bobina?.metragem_restante != null && !isNaN(Number(bobina.metragem_restante))) {
    return Number(bobina.metragem_restante);
  }
  if (bobina?.metragem != null && !isNaN(Number(bobina.metragem))) {
    return Number(bobina.metragem);
  }
  // Estimativa pelo peso: telha 0.43 consome ~ 3.8 a 4.2 kg por metro linear
  const peso = Number(bobina?.peso_kg) || 0;
  if (peso > 0) {
    const esp = parseFloat(String(bobina?.chapa || "0.43").replace(",", ".")) || 0.43;
    const kgPorMetro = Math.max(1, esp * 8.5); // densidade aproximada por largura
    return Math.round(peso / kgPorMetro);
  }
  return 0;
}

/**
 * SELETOR MINUCIOSO DE BOBINA PARA TELHAS
 * Localiza e elege a melhor bobina no estoque da filial com base em:
 * 1. Setor: Telhas
 * 2. Unidade: Filial do pedido
 * 3. Espessura exigida pelo Odoo (com tolerâncias aceitáveis)
 * 4. Procedência do aço (Nacional vs Importado)
 * 5. Cor / RVM compatível (Natural vs Pré-pintada)
 * 6. Status da bobina: Aberta > Em Uso > Fechada
 * 7. Metragem suficiente para o pedido (evita cortes parciais se houver saldo)
 */
export function selecionarMelhorBobinaTelhas({
  item,
  pedido,
  todasBobinas = [],
  filialAtiva = "Matriz AJL",
  statusMap = {},
  tolerancias = []
}) {
  if (!todasBobinas || todasBobinas.length === 0) return null;

  const produtoNome = item?.produto || item?.descricao || "";
  const descTexto = item?.descricao || item?.observacao || pedido?.observacoes || "";

  // 1. Extração de requisitos do Odoo
  const espessuraExigida = item?.espessura ? String(item.espessura) : detectarEspessura(produtoNome);
  const origemExigida = item?.origem || detectarOrigemAco(produtoNome);
  const corExigida = detectarCorTelha(produtoNome, descTexto);
  const filialAlvo = filialAtiva && filialAtiva !== "todas" ? filialAtiva : (pedido?.unidade || "Matriz AJL");

  // Metragem necessária estimada
  const textoCompleto = `${produtoNome} ${descTexto}`.trim();
  let espTec = descTexto ? extrairEspecificacao(descTexto, item?.quantidade, item?.unidade) : null;
  if (!espTec || !espTec.tem_especificacao || (!espTec.pecas && !espTec.comprimento_mm)) {
    espTec = extrairEspecificacao(textoCompleto, item?.quantidade, item?.unidade);
  }
  const metragemNecessaria = Number(espTec?.metragem_total || item?.quantidade || 0);

  // 2. Filtro preliminar de elegibilidade
  const elegiveis = todasBobinas.filter(b => {
    if (!b || !b.id) return false;
    // Não pode estar arquivada nem descartada
    const statusClean = String(b.status || "").toLowerCase().trim();
    if (["arquivada", "arquivado", "descartada", "descartado", "encerrada", "encerrado", "zerada"].includes(statusClean)) {
      return false;
    }
    // Setor deve ser telhas ou não restrito
    if (b.setor && b.setor !== "telhas") return false;

    // Unidade deve corresponder estritamente à filial do pedido (ex: Matriz só usa Matriz)
    if (!isMesmaFilial(b.unidade, filialAlvo)) return false;

    // Não pode estar reservada para outro pedido
    if (b.reservada) {
      const numPed = String(pedido?.numero_pedido || "").trim();
      const resPed = String(b.reserva_numero_pedido || "").trim();
      if (resPed && numPed && !resPed.includes(numPed) && !numPed.includes(resPed)) {
        return false;
      }
    }

    // Validação estrita de Espessura (com suporte a faixa de tolerância)
    const validEsp = isEspessuraCompatible(b, espessuraExigida, tolerancias);
    if (!validEsp.ok) return false;

    // Validação estrita de Origem (Nacional vs Importado)
    const validOrigem = isOrigemCompatible(b, origemExigida);
    if (!validOrigem.ok) return false;

    // Validação de Cor / RVM
    if (!isCorCompativel(b, corExigida)) return false;

    return true;
  });

  if (elegiveis.length === 0) {
    return null;
  }

  // 3. Ordenação e pontuação minuciosa
  // Prioridade:
  // - Aberta com saldo >= metragemNecessaria (SCORE 100)
  // - Em produção / uso compatível (SCORE 90)
  // - Aberta com saldo menor mas utilizável (SCORE 70)
  // - Fechada com saldo >= metragemNecessaria (SCORE 50)
  // - Fechada geral (SCORE 30)
  // Desempate: Maior saldo de metros e FIFO (data de recebimento mais antiga / código menor)

  const pontuadas = elegiveis.map(b => {
    const aberta = isBobinaAberta(b, statusMap);
    const metrosDisp = calcularMetragemDisponivel(b);
    const cobreTudo = metragemNecessaria > 0 ? metrosDisp >= metragemNecessaria : metrosDisp > 10;

    let score = 0;
    if (aberta && cobreTudo) score = 100;
    else if (aberta && metrosDisp > 0) score = 80;
    else if (!aberta && cobreTudo) score = 50;
    else if (!aberta && metrosDisp > 0) score = 30;
    else score = 10;

    return {
      bobina: b,
      score,
      metrosDisp,
      aberta,
      cobreTudo
    };
  });

  pontuadas.sort((a, b) => {
    // 1º Maior score
    if (b.score !== a.score) return b.score - a.score;

    // 2º Se ambas cobrem ou ambas não cobrem, prefere a que tem mais saldo
    if (b.metrosDisp !== a.metrosDisp) return b.metrosDisp - a.metrosDisp;

    // 3º Código menor (ordem de chegada / FIFO)
    return String(a.bobina.codigo || "").localeCompare(String(b.bobina.codigo || ""), undefined, { numeric: true });
  });

  const melhor = pontuadas[0]?.bobina;
  if (!melhor) return null;

  return {
    bobina: melhor,
    bobina_id: melhor.id,
    codigo: melhor.codigo,
    descricao: `${melhor.codigo} - ${melhor.cor || 'Natural'} (Chapa ${melhor.chapa || espessuraExigida || '0.43'})`,
    cor: melhor.cor || "Natural",
    espessura: melhor.chapa || espessuraExigida,
    origem: melhor.origem || "Nacional",
    peso_kg: melhor.peso_kg,
    metragem_restante: calcularMetragemDisponivel(melhor)
  };
}

/**
 * ROTEIA AUTOMATICAMENTE UM ITEM DE TELHA DIRETO PARA A MÁQUINA
 * Cria a Ordem de Produção (entidade Pedido) com bobina já vinculada e atualiza o PedidoOdoo.
 */
export async function rotearPedidoTelhaDiretoParaMaquina({
  pedido,
  item,
  itemIdx = 0,
  todasBobinas = [],
  filialAtiva = "Matriz AJL",
  tolerancias = []
}) {
  if (!pedido || !item) {
    throw new Error("Pedido ou Item inválido para auto-roteamento.");
  }

  const descTexto = item.descricao || item.observacao || pedido.observacoes || "";
  const produtoNome = item.produto || item.descricao || "";
  const textoCompleto = `${produtoNome} ${descTexto}`.trim();
  const prodTipo = detectarTipoProdutoTelha(produtoNome, descTexto);
  let maquina = (prodTipo === "CUMEEIRA" || /\bCUMEEIRA\b/i.test(textoCompleto))
    ? "CUMEEIRA"
    : (prodTipo === "BOBININHA" || /\b(BOBININHA|BOBININHAS|BOBININA|SLITTER|DESBOBINADOR)\b/i.test(textoCompleto))
    ? "DESBOBINADOR"
    : (prodTipo === "TELHA BANDEJA")
    ? (detectarMaquinaTelha(textoCompleto) || "TP - 40")
    : (item.maquina || detectarMaquinaTelha(textoCompleto) || "");

  // Se o modelo da telha não foi especificado, não roteia automaticamente!
  if (!maquina) {
    throw new Error(`Modelo de telha não especificado no pedido #${pedido.numero_pedido || ""}. Defina a máquina manualmente no PCP.`);
  }

  const esp = item.espessura ? String(item.espessura) : (detectarEspessura(textoCompleto) || "0.43");
  const origem = item.origem || detectarOrigemAco(textoCompleto);
  const cor = detectarCorTelha(produtoNome, descTexto);
  const temIndicioEps = /(eps|manta|sanduiche|isopor|termoacustica|pir|pur|bandeja)/i.test(textoCompleto);
  const eps = (["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(prodTipo) && temIndicioEps)
    ? detectarEPSTelha(textoCompleto, maquina)
    : "";

  // Se for TELHA + EPS + TELHA ou TELHA BANDEJA, prepara bobinas independentes para cada face
  // (a bandeja inferior da Telha Bandeja tem cor própria, ex: "bandeja amadeirada")
  const isDuplaTelha = prodTipo === "TELHA + EPS + TELHA" || prodTipo === "TELHA BANDEJA";
  const coresDupla = isDuplaTelha
    ? detectarCoresDuplaTelha(produtoNome, descTexto)
    : { corSuperior: cor || "NATURAL", corInferior: null };

  // 1. Busca a melhor bobina com o algoritmo minucioso para a face superior
  const bobinaEleita = selecionarMelhorBobinaTelhas({
    item: { ...item, cor: coresDupla.corSuperior },
    pedido,
    todasBobinas,
    filialAtiva,
    tolerancias
  });

  // Bobina para a face inferior (ex: face interna pré-pintada preta ou branca)
  const bobinaInferiorEleita = isDuplaTelha
    ? selecionarMelhorBobinaTelhas({
        item: { ...item, cor: coresDupla.corInferior },
        pedido,
        todasBobinas,
        filialAtiva,
        tolerancias
      })
    : null;

  // 2. Extração de especificações físicas (peças, mm, metros lineares)
  const espTec = extrairEspecificacao(textoCompleto, item.quantidade, item.unidade);

  let qtdChapas = item.quantidade || 1;
  let metragemMm = "";
  let metragemTotalLinear = item.quantidade || 1;
  let variacoesTelhasJson = "";

  if (espTec.tipo_conformacao === "bobininha" || prodTipo === "BOBININHA") {
    // 🛡️ Regra Bobininha AJL: Se não especificado múltiplos rolos na descrição, SEMPRE 1 bobininha com a metragem total do Odoo em Corte 1200
    const qFinal = espTec.pecas || espTec.quantidade || 1;
    const totalLinearFinal = espTec.metragem_total || Number(item.quantidade) || 1;
    const compMmFinal = espTec.comprimento_mm || Math.round((totalLinearFinal / qFinal) * 1000);

    qtdChapas = qFinal;
    metragemMm = compMmFinal;
    metragemTotalLinear = totalLinearFinal;

    const cortesDetectados = extrairCortesBobininha(textoCompleto);
    const corteVal = cortesDetectados.length > 0 ? cortesDetectados.join(" - ") : "1200";

    const varsFinal = (espTec.variacoes && espTec.variacoes.length > 0)
      ? espTec.variacoes
      : [{
          qty: qFinal,
          mm: compMmFinal,
          m: +(compMmFinal / 1000).toFixed(3),
          total_m: totalLinearFinal,
          largura_mm: 1200,
          corte: corteVal,
          cortes: cortesDetectados,
          tipo: "bobininha"
        }];

    variacoesTelhasJson = JSON.stringify(varsFinal);
  } else if (espTec.tem_especificacao) {
    if (espTec.variacoes && espTec.variacoes.length > 1) {
      qtdChapas = espTec.quantidade;
      metragemMm = espTec.comprimento_mm || "";
      metragemTotalLinear = espTec.metragem_total || item.quantidade || 1;
      variacoesTelhasJson = JSON.stringify(espTec.variacoes);
    } else if (espTec.comprimento_mm && espTec.quantidade) {
      qtdChapas = espTec.quantidade;
      metragemMm = espTec.comprimento_mm;
      metragemTotalLinear = espTec.metragem_total || item.quantidade || 1;
    } else if (espTec.quantidade) {
      qtdChapas = espTec.quantidade;
      if (espTec.comprimento_mm) metragemMm = espTec.comprimento_mm;
      metragemTotalLinear = espTec.metragem_total || item.quantidade || 1;
    }
  }

  const dataReceb = pedido.data_recebimento
    ? String(pedido.data_recebimento).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const dataPrevista = pedido.data_entrega
    ? String(pedido.data_entrega).slice(0, 10)
    : toISODate(calcularDataPrometidaSLA(dataReceb, 7));

  const unidadeOp = filialAtiva && filialAtiva !== "todas" ? filialAtiva : (pedido.unidade || "Matriz AJL");
  const modeloFinal = item.modelo || (detectarMaquinaTelha(textoCompleto) || maquina);

  const espNumOp = parseFloat(String(esp || "0.43").replace(",", ".")) || 0.43;
  const pesoEstimadoOpKg = Math.round(Number(metragemTotalLinear) * (espNumOp * 7.85 * 1.2) * (isDuplaTelha ? 2 : 1));

  // 3. Monta os dados da Ordem de Produção (tabela Pedido)
  const dadosOp = {
    data: item.data_programada || hojeLocalISO(),
    data_pedido: dataReceb,
    data_prevista: dataPrevista,
    numero_pedido: pedido.numero_pedido || "",
    numero_oc: pedido.numero_oc || item.numero_oc || "",
    cliente: pedido.cliente_nome || pedido.cliente || "",
    vendedor: pedido.vendedor_nome || pedido.vendedor || "",
    unidade: unidadeOp,
    produto: prodTipo,
    modelo: modeloFinal,
    maquina: maquina,
    maquina_origem: maquina,
    status: "pendente",
    espessura_exigida: esp || "0.43",
    origem_exigida: origem || "ambas",
    cor_exigida: cor || "NATURAL",
    eps: eps,
    rvm_superior: bobinaEleita?.cor || (coresDupla.corSuperior !== "NATURAL" ? coresDupla.corSuperior : "Natural"),
    bobina_superior_id: bobinaEleita?.bobina_id || null,
    bobina_superior: extrairRotuloBobinaSimplificado(textoCompleto, isDuplaTelha),
    rvm_inferior: isDuplaTelha ? (bobinaInferiorEleita?.cor || (coresDupla.corInferior !== "NATURAL" ? coresDupla.corInferior : "Natural")) : null,
    bobina_inferior_id: isDuplaTelha ? (bobinaInferiorEleita?.bobina_id || null) : null,
    bobina_inferior: isDuplaTelha ? extrairRotuloFaceInferior(textoCompleto, coresDupla.corInferior) : null,
    metros: Number(qtdChapas) || 1,
    quantidade_telhas: Number(qtdChapas) || 1,
    metragem_mm: Number(metragemMm) || null,
    metragem_planejada: Number(metragemTotalLinear) || 1,
    kg_total: pesoEstimadoOpKg,
    variacoes_telhas: variacoesTelhasJson,
    observacoes: `Auto-Roteado PCP (Barracão Telhas) — ${descTexto}`.trim(),
    pedido_odoo_id: pedido.id,
    of_odoo_id: pedido.of_odoo_id || "",
    of_nome: pedido.of_nome || "",
    item_idx: itemIdx,
    item_produto: produtoNome,
    foto_pedido_url: item.foto_url || item.imagem_url || pedido.foto_pedido_url || extrairCroquiPedido(pedido) || ""
  };

  // 4. Verificação anti-duplicação estrita: checa se já existe OP ativa para este mesmo item/medida
  let opCriada = null;
  let foiAtualizada = false;
  try {
    let opsExistentes = [];
    if (pedido?.id) {
      opsExistentes = await comRetry(() => base44.entities.Pedido.filter({ pedido_odoo_id: pedido.id }));
    }
    if ((!opsExistentes || opsExistentes.length === 0) && pedido?.numero_pedido) {
      opsExistentes = await comRetry(() => base44.entities.Pedido.filter({ numero_pedido: pedido.numero_pedido }));
    }
    const opsValidas = filtrarOpsDasOfsExatas(opsExistentes, [pedido]);
    const opValida = opsValidas.find(o => {
      if (itemIdx != null && o.item_idx != null && String(o.item_idx) === String(itemIdx)) return true;
      const mesmaMaq = !o.maquina || String(o.maquina).trim().toUpperCase() === String(maquina).trim().toUpperCase();
      const mmMatch = Number(metragemMm) && Number(o.metragem_mm) === Number(metragemMm);
      const qtdMatch = Number(qtdChapas) && (Number(o.metros) === Number(qtdChapas) || Number(o.quantidade_telhas) === Number(qtdChapas));
      return mesmaMaq && mmMatch && qtdMatch;
    });
    if (opValida) {
      // PRESERVAÇÃO TOTAL: OP existente NUNCA tem suas bobinas ou modelo sobrescritos se já foram alterados manualmente!
      const updates = {};
      // Só preenche bobinas se estavam vazias
      if (!opValida.bobina_superior && !opValida.bobina_superior_manual) {
        updates.bobina_superior = extrairRotuloBobinaSimplificado(textoCompleto, isDuplaTelha);
        if (bobinaEleita?.bobina_id) updates.bobina_superior_id = bobinaEleita.bobina_id;
        updates.rvm_superior = bobinaEleita?.cor || "Natural";
      }
      if (isDuplaTelha && !opValida.bobina_inferior && !opValida.bobina_inferior_manual) {
        updates.bobina_inferior = extrairRotuloFaceInferior(textoCompleto, coresDupla.corInferior);
        if (bobinaInferiorEleita?.bobina_id) updates.bobina_inferior_id = bobinaInferiorEleita.bobina_id;
        updates.rvm_inferior = bobinaInferiorEleita?.cor || "Natural";
      }
      if (Object.keys(updates).length > 0) {
        opCriada = await base44.entities.Pedido.update(opValida.id, updates);
      } else {
        opCriada = opValida;
      }
    }
  } catch (errCheck) {
    console.warn("[AutoBobinaTelhas] Verificação de OP:", errCheck);
  }

  // Se não existe, cria a nova OP na máquina — TRAVA NO SERVIDOR:
  // se outra OP da MESMA OF já cobre este item (ou uma corrida concorrente criar
  // ao mesmo tempo), o servidor devolve a OP existente em vez de duplicar.
  if (!opCriada) {
    try {
      const resGar = await comRetry(() => base44.functions.invoke("garantirOpUnica", {
        dadosOp,
        dedup: {
          pedido_odoo_id: pedido.id || "",
          of_odoo_id: pedido.of_odoo_id || "",
          of_nome: pedido.of_nome || "",
          numero_pedido: pedido.numero_pedido || "",
          indices: [itemIdx],
          item_produto: produtoNome,
          maquina
        }
      }), 2, 800);
      opCriada = resGar?.data?.op || resGar?.op || null;
    } catch (errFunc) {
      console.warn("[AutoBobinaTelhas] Aviso na chamada serverless de garantirOpUnica:", errFunc?.message || errFunc);
    }

    // Fallback direto e resiliente caso a Cloud Function falhe ou esteja offline
    if (!opCriada || !opCriada.id) {
      try {
        const opsCheck = await base44.entities.Pedido.filter({
          numero_pedido: pedido.numero_pedido || "",
          status: { $ne: "cancelado" }
        }).catch(() => []);

        const existenteLocal = opsCheck.find(o =>
          (o.pedido_odoo_id && o.pedido_odoo_id === pedido.id) ||
          (o.of_odoo_id && pedido.of_odoo_id && o.of_odoo_id === pedido.of_odoo_id) ||
          (o.of_nome && pedido.of_nome && o.of_nome === pedido.of_nome)
        );

        if (existenteLocal) {
          opCriada = existenteLocal;
        } else {
          opCriada = await comRetry(() => base44.entities.Pedido.create(dadosOp), 2, 800);
        }
      } catch (errDirect) {
        console.error("[AutoBobinaTelhas] Erro no fallback de criação de OP:", errDirect);
      }
    }
  }

  // 🛡️ NUNCA FINGIR ENVIO: sem OP com ID confirmado, o item NÃO é marcado como
  // "em_producao"/distribuído — a OF não mente para o PCP com a máquina vazia.
  if (!opCriada || !opCriada.id) {
    throw new Error(`OP não confirmada na fila da ${maquina} — envio abortado (OF ${pedido.of_nome || pedido.numero_pedido || ""}). Nada foi marcado como enviado.`);
  }

  // 5. Atualiza o item no PedidoOdoo para refletir o status distribuído e a máquina
  const itens = getItens(pedido);
  if (itens[itemIdx]) {
    itens[itemIdx] = {
      ...itens[itemIdx],
      distribuido: true,
      status: "em_producao",
      maquina: maquina,
      bobina_superior_id: bobinaEleita?.bobina_id || itens[itemIdx].bobina_superior_id || "",
      bobina_superior: bobinaEleita?.codigo || itens[itemIdx].bobina_superior || ""
    };

    const percentual = Math.max(pedido.percentual_concluido || 0, computePercentual(itens), 15);
    const status_pcp = statusPcpPorPercentual(percentual, "distribuido");

    const logExistente = (() => {
      try { return JSON.parse(pedido.historico_log || "[]"); }
      catch { return []; }
    })();

    const novoLog = [...logExistente, {
      data: new Date().toISOString(),
      usuario: "PCP (Piloto Automático)",
      acao: "auto_roteamento_telhas",
      detalhes: `Item "${produtoNome}" enviado direto para a máquina ${maquina}. Bobina vinculada: ${bobinaEleita ? bobinaEleita.codigo : "Aguardando seleção"}.`
    }];

    await base44.entities.PedidoOdoo.update(pedido.id, {
      itens_json: buildItensJson(itens),
      percentual_concluido: percentual,
      status_pcp,
      historico_log: JSON.stringify(novoLog)
    });

    // Notifica em segundo plano
    notificarStatus({ ...pedido, percentual_concluido: percentual, status_pcp }, "maquina_inicio", {
      maquina_atual: maquina,
      item_nome: produtoNome,
      bobina_selecionada: bobinaEleita?.codigo || "N/A"
    }).catch(() => {});
  }

  return {
    op: opCriada,
    foiAtualizada,
    maquina,
    bobina: bobinaEleita
  };
}

/**
 * PROCESSA EM LOTE TODOS OS ITENS DE TELHA PENDENTES
 * Executa o roteamento direto com bobina automática para todos os pedidos de telha da lista.
 */
export async function processarLoteAutoRoteamentoTelhas({
  pedidos = [],
  todasBobinas = [],
  filialAtiva = "Matriz AJL",
  tolerancias = []
}) {
  const resultados = {
    totalItens: 0,
    sucessos: 0,
    comBobina: 0,
    semBobina: 0,
    erros: []
  };

  for (const ped of pedidos) {
    const itens = getItens(ped);
    const telhas = itensPorGrupo(itens, "telha");

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      // Apenas itens de telha não concluídos
      const ehTelha = telhas.some(t => (t._idx != null ? t._idx === i : (t.produto === it.produto || t.descricao === it.descricao)));
      if (!ehTelha) continue;
      if (it.status === "concluido") continue;

      resultados.totalItens++;

      try {
        const res = await rotearPedidoTelhaDiretoParaMaquina({
          pedido: ped,
          item: it,
          itemIdx: i,
          todasBobinas,
          filialAtiva,
          tolerancias
        });

        resultados.sucessos++;
        if (res.bobina) resultados.comBobina++;
        else resultados.semBobina++;
      } catch (errItem) {
        resultados.erros.push({
          pedido: ped.numero_pedido,
          item: it.produto,
          erro: errItem.message
        });
      }
    }
  }

  return resultados;
}

/**
 * ROTEIA AUTOMATICAMENTE ITENS DE TELHA DE UM PEDIDO PARA AS MÁQUINAS,
 * CONSOLIDANDO ITENS IDÊNTICOS (mesma máquina, mesmo tipo, espessura e cor)
 * EM UMA ÚNICA OP NA MÁQUINA COM MÚLTIPLOS CORTES (variacoes_telhas).
 */
export async function rotearLoteTelhasAgrupadas({
  pedido,
  itensTelhas = [],
  todasBobinas = [],
  filialAtiva = "Matriz AJL",
  tolerancias = [],
  opsExistentesPre = null
}) {
  if (!pedido || !itensTelhas || itensTelhas.length === 0) {
    return { opsCriadas: [], itensAtualizadosMap: {} };
  }

  // 1. Agrupar itens de telha por modelo idêntico
  // Chave: maquina__prodTipo__espessura__cor
  const grupos = new Map();

  for (const it of itensTelhas) {
    const descTexto = it.descricao || it.observacao || "";
    const produtoNome = it.produto || it.descricao || "";
    const textoCompleto = `${produtoNome} ${descTexto} ${it.observacoes || ""}`.trim();
    const prodTipo = detectarTipoProdutoTelha(produtoNome, descTexto);
    const maquinaDetectada = detectarMaquinaTelha(textoCompleto) || "TP - 40";
    let maquina = (prodTipo === "CUMEEIRA" || /\bCUMEEIRA\b/i.test(textoCompleto))
      ? "CUMEEIRA"
      : (it.maquina && it.maquina !== "COLAGEM" && it.maquina !== "DESBOBINADOR" ? it.maquina : maquinaDetectada);
    const esp = it.espessura ? String(it.espessura) : (detectarEspessura(textoCompleto) || "0.43");
    const cor = detectarCorTelha(produtoNome, descTexto) || "NATURAL";
    const chave = `${maquina}___${prodTipo}___${esp}___${cor}`.toUpperCase();

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        maquina,
        prodTipo,
        esp,
        cor,
        itens: []
      });
    }
    grupos.get(chave).itens.push(it);
  }

  const opsCriadas = [];
  const itensAtualizadosMap = {}; // idx -> dados atualizados

  // 2. Cada grupo de modelo idêntico = 1 OP independente (máquina/medida/cor).
  const processarGrupo = async (g) => {
    const itensDoGrupo = g.itens;
    const primeiroItem = itensDoGrupo[0];
    const itemPrincipalIdx = primeiroItem._idx != null ? primeiroItem._idx : 0;
    const todosIndices = itensDoGrupo.map(it => (it._idx != null ? it._idx : 0));

    // Consolidar cortes / variações e metragens
    const variacoesConsolidadas = [];
    let somaPecas = 0;
    let somaMetrosLineares = 0;
    let textoObservacoes = [];

    itensDoGrupo.forEach(it => {
      const descTexto = it.descricao || it.observacao || "";
      if (descTexto) textoObservacoes.push(descTexto);
      const prodTexto = it.produto || "";
      const espTec = extrairEspecificacao(`${prodTexto} ${descTexto}`.trim(), it.quantidade, it.unidade);

      if (espTec.tem_especificacao && espTec.variacoes && espTec.variacoes.length > 0) {
        espTec.variacoes.forEach(v => {
          const qty = Number(v.qty) || 1;
          const mm = Number(v.mm) || 0;
          const m = Number(v.m) || (mm ? +(mm / 1000).toFixed(3) : 0);
          const total_m = +(qty * m).toFixed(2);
          variacoesConsolidadas.push({ qty, mm, m, total_m });
          somaPecas += qty;
          somaMetrosLineares += total_m;
        });
      } else {
        // Corte único ou item sem quebra em variações
        const qty = Number(espTec?.quantidade || it.quantidade) || 1;
        const mm = Number(espTec?.comprimento_mm) || null;
        const m = mm ? +(mm / 1000).toFixed(3) : (Number(espTec?.metragem_total || it.quantidade) || 1);
        const total_m = +(qty * m).toFixed(2);
        variacoesConsolidadas.push({
          qty,
          mm: mm || (m ? Math.round(m * 1000) : null),
          m,
          total_m
        });
        somaPecas += qty;
        somaMetrosLineares += total_m;
      }
    });

    if (somaPecas === 0) somaPecas = itensDoGrupo.reduce((acc, it) => acc + (Number(it.quantidade) || 1), 0);
    if (somaMetrosLineares === 0) somaMetrosLineares = somaPecas;

    // Item representativo para seleção da melhor bobina com a metragem total acumulada
    const itemVirtualParaBobina = {
      ...primeiroItem,
      quantidade: somaMetrosLineares,
      metragem_total: somaMetrosLineares
    };

    const isDuplaTelha = g.prodTipo === "TELHA + EPS + TELHA" || g.prodTipo === "TELHA BANDEJA";
    const coresDupla = isDuplaTelha
      ? detectarCoresDuplaTelha(primeiroItem.produto || primeiroItem.descricao || "", textoObservacoes.join(" "))
      : { corSuperior: g.cor || "NATURAL", corInferior: null };

    const bobinaEleita = selecionarMelhorBobinaTelhas({
      item: { ...itemVirtualParaBobina, cor: coresDupla.corSuperior },
      pedido,
      todasBobinas,
      filialAtiva,
      tolerancias
    });

    const bobinaInferiorEleita = isDuplaTelha
      ? selecionarMelhorBobinaTelhas({
          item: { ...itemVirtualParaBobina, cor: coresDupla.corInferior },
          pedido,
          todasBobinas,
          filialAtiva,
          tolerancias
        })
      : null;

    const dataReceb = pedido.data_recebimento
      ? String(pedido.data_recebimento).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const dataPrevista = pedido.data_entrega
      ? String(pedido.data_entrega).slice(0, 10)
      : toISODate(calcularDataPrometidaSLA(dataReceb, 7));

    const unidadeOp = filialAtiva && filialAtiva !== "todas" ? filialAtiva : (pedido.unidade || "Matriz AJL");
    const temIndicioEpsNoGrupo = /(eps|manta|sanduiche|isopor|termoacustica|pir|pur|bandeja)/i.test(`${primeiroItem.produto || ""} ${primeiroItem.descricao || ""}`);
    const eps = (["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(g.prodTipo) && temIndicioEpsNoGrupo)
      ? detectarEPSTelha(primeiroItem.produto || primeiroItem.descricao || "", g.maquina)
      : "";

    const nivelPrioridade = getPrioridadeNivel(pedido);
    // 🛡️ A prioridade da OP é NUMÉRICA (1..5). "RETIRA_AGORA" e "ROTA" são
    // rótulos de fila: sem esta conversão o servidor recusa a criação da OP
    // ("Input should be a valid number") e a telha nunca chega à máquina.
    const ehRetiraAgora = nivelPrioridade === "RETIRA_AGORA";
    const ehRota = nivelPrioridade === "ROTA";
    const nivelPrioridadeNumerico = typeof nivelPrioridade === "number"
      ? nivelPrioridade
      : (ehRetiraAgora ? 1 : ehRota ? 2 : null);
    const textoPrimeiro = `${primeiroItem.produto || ""} ${primeiroItem.descricao || ""} ${textoObservacoes.join(" ")}`.trim();
    const modeloFinal = primeiroItem.modelo || (detectarMaquinaTelha(textoPrimeiro) || g.maquina);

    const dadosOp = {
      data: primeiroItem?.data_programada || hojeLocalISO(),
      data_pedido: dataReceb,
      data_prevista: dataPrevista,
      numero_pedido: pedido.numero_pedido || "",
      numero_oc: pedido.numero_oc || primeiroItem.numero_oc || "",
      cliente: pedido.cliente_nome || pedido.cliente || "",
      vendedor: pedido.vendedor_nome || pedido.vendedor || "",
      unidade: unidadeOp,
      produto: g.prodTipo,
      modelo: modeloFinal,
      maquina: g.maquina,
      maquina_origem: g.maquina,
      status: "pendente",
      prioridade_nivel: nivelPrioridadeNumerico,
      prioridade: Boolean(nivelPrioridade),
      is_rota: ehRota,
      rota: ehRota,
      cliente_retira_agora: ehRetiraAgora,
      espessura_exigida: g.esp || "0.43",
      origem_exigida: primeiroItem.origem || detectarOrigemAco(primeiroItem.produto || "") || "ambas",
      cor_exigida: g.cor || "NATURAL",
      eps: eps,
      rvm_superior: bobinaEleita?.cor || (coresDupla.corSuperior !== "NATURAL" ? coresDupla.corSuperior : "Natural"),
      bobina_superior_id: bobinaEleita?.bobina_id || null,
      bobina_superior: bobinaEleita?.descricao || "",
      rvm_inferior: isDuplaTelha ? (bobinaInferiorEleita?.cor || (coresDupla.corInferior !== "NATURAL" ? coresDupla.corInferior : "Natural")) : null,
      bobina_inferior_id: isDuplaTelha ? (bobinaInferiorEleita?.bobina_id || null) : null,
      bobina_inferior: isDuplaTelha ? (bobinaInferiorEleita?.descricao || "") : null,
      metros: Number(somaPecas) || 1,
      quantidade_telhas: Number(somaPecas) || 1,
      metragem_mm: variacoesConsolidadas.length === 1 ? (variacoesConsolidadas[0].mm || null) : null,
      metragem_planejada: Number(somaMetrosLineares) || 1,
      kg_total: Math.round(Number(somaMetrosLineares) * ((parseFloat(String(g.esp || "0.43").replace(",", ".")) || 0.43) * 7.85 * 1.2) * (isDuplaTelha ? 2 : 1)),
      variacoes_telhas: JSON.stringify(variacoesConsolidadas),
      observacoes: `Auto-Roteado PCP (${itensDoGrupo.length > 1 ? `${itensDoGrupo.length} itens agrupados — ` : ""}${g.maquina}) — ${textoObservacoes.join(" | ")}`.trim(),
      pedido_odoo_id: pedido.id,
      of_odoo_id: pedido.of_odoo_id || "",
      of_nome: pedido.of_nome || "",
      item_idx: itemPrincipalIdx,
      itens_indices: JSON.stringify(todosIndices),
      item_produto: primeiroItem.produto || primeiroItem.descricao || "",
      foto_pedido_url: primeiroItem.foto_url || primeiroItem.imagem_url || pedido.foto_pedido_url || extrairCroquiPedido(pedido) || ""
    };

    // Verificação anti-duplicação estrita de lote:
    let opCriada = null;
    let foiAtualizada = false;
    try {
      let opsValidas;
      if (Array.isArray(opsExistentesPre)) {
        // Lote: OPs já pré-buscadas em massa pelo chamador (evita 2 chamadas de rede por grupo)
        opsValidas = filtrarOpsDasOfsExatas(opsExistentesPre, [pedido]);
      } else {
        let opsExistentes = [];
        if (pedido?.id) {
          opsExistentes = await comRetry(() => base44.entities.Pedido.filter({ pedido_odoo_id: pedido.id }));
        }
        if ((!opsExistentes || opsExistentes.length === 0) && pedido?.numero_pedido) {
          opsExistentes = await comRetry(() => base44.entities.Pedido.filter({ numero_pedido: pedido.numero_pedido }));
        }
        opsValidas = filtrarOpsDasOfsExatas(opsExistentes, [pedido]);
      }
      const opValida = opsValidas.find(o => {
        if (o.item_idx != null && String(o.item_idx) === String(itemPrincipalIdx)) return true;
        if (o.itens_indices) {
          try {
            const list = Array.isArray(o.itens_indices) ? o.itens_indices : JSON.parse(o.itens_indices);
            if (Array.isArray(list) && todosIndices.some(idx => list.includes(idx))) return true;
          } catch {}
        }
        return false;
      });
      if (opValida) {
        // PRESERVAÇÃO TOTAL: OP existente NUNCA tem suas bobinas ou modelo sobrescritos!
        const updates = {};
        if (!opValida.bobina_superior_id && bobinaEleita?.bobina_id) {
          updates.bobina_superior_id = bobinaEleita.bobina_id;
          updates.bobina_superior = bobinaEleita.descricao;
          updates.rvm_superior = bobinaEleita.cor;
        }
        if (isDuplaTelha && !opValida.bobina_inferior_id && bobinaInferiorEleita?.bobina_id) {
          updates.bobina_inferior_id = bobinaInferiorEleita.bobina_id;
          updates.bobina_inferior = bobinaInferiorEleita.descricao;
          updates.rvm_inferior = bobinaInferiorEleita.cor;
        }
        if (Object.keys(updates).length > 0) {
          opCriada = await base44.entities.Pedido.update(opValida.id, updates);
        } else {
          opCriada = opValida;
        }
      }
    } catch (errCheck) {
      console.warn("[AutoBobinaTelhas Lote] Erro checagem anti-duplicidade:", errCheck);
    }

    if (!opCriada) {
      // 1. Tenta a função serverless com deduplicação atômica no servidor
      try {
        const resGar = await comRetry(() => base44.functions.invoke("garantirOpUnica", {
          dadosOp,
          dedup: {
            pedido_odoo_id: pedido.id || "",
            of_odoo_id: pedido.of_odoo_id || "",
            of_nome: pedido.of_nome || "",
            numero_pedido: pedido.numero_pedido || "",
            indices: todosIndices,
            item_produto: primeiroItem.produto || primeiroItem.descricao || "",
            maquina: g.maquina
          }
        }), 2, 800);
        opCriada = resGar?.data?.op || resGar?.op || null;
      } catch (errFunc) {
        console.warn("[AutoBobinaTelhas Lote] Aviso na chamada serverless de garantirOpUnica:", errFunc?.message || errFunc);
      }

      // 2. Fallback direto e resiliente caso a Cloud Function falhe ou esteja offline
      if (!opCriada || !opCriada.id) {
        try {
          const opsCheck = await base44.entities.Pedido.filter({
            numero_pedido: pedido.numero_pedido || "",
            status: { $ne: "cancelado" }
          }).catch(() => []);

          const existenteLocal = opsCheck.find(o =>
            (o.pedido_odoo_id && o.pedido_odoo_id === pedido.id) ||
            (o.of_odoo_id && pedido.of_odoo_id && o.of_odoo_id === pedido.of_odoo_id) ||
            (o.of_nome && pedido.of_nome && o.of_nome === pedido.of_nome)
          );

          if (existenteLocal) {
            opCriada = existenteLocal;
          } else {
            opCriada = await comRetry(() => base44.entities.Pedido.create(dadosOp), 2, 800);
          }
        } catch (errDirect) {
          console.error("[AutoBobinaTelhas Lote] Erro no fallback de criação de OP:", errDirect);
        }
      }
    }
    // 🛡️ NUNCA FINGIR ENVIO: sem OP criada/recuperada com ID real, a distribuição
    // falha aqui — o PCP NÃO marca a OF como distribuída com a máquina vazia.
    if (!opCriada || !opCriada.id) {
      throw new Error(`OP não confirmada na fila da ${g.maquina} — envio abortado (OF ${pedido.of_nome || pedido.numero_pedido || ""}). A OF continua no PCP.`);
    }
    opsCriadas.push(opCriada);

    // Mapear atualizações para todos os itens do grupo
    itensDoGrupo.forEach(it => {
      const idx = it._idx != null ? it._idx : 0;
      itensAtualizadosMap[idx] = {
        distribuido: true,
        status: "em_producao",
        maquina: g.maquina,
        bobina_superior_id: bobinaEleita?.bobina_id || "",
        bobina_superior: bobinaEleita?.codigo || "",
        op_agrupada_id: opCriada.id
      };
    });
  };

  // 3. Grupos EM PARALELO (pool de 3): antes cada OP esperava a anterior terminar
  //    no servidor (3-5s cada), somando o tempo total do envio da OF.
  const listaGrupos = Array.from(grupos.values());
  const erros = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < listaGrupos.length) {
      const g = listaGrupos[cursor++];
      try {
        await processarGrupo(g);
      } catch (errGrupo) {
        erros.push(errGrupo);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(3, listaGrupos.length) }, worker)
  );

  // Se algum grupo não conseguiu gerar OP, a OF não é marcada como distribuída
  if (erros.length > 0) throw erros[0];

  return { opsCriadas, itensAtualizadosMap };
}