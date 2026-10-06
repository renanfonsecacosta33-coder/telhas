// =====================================================================
// HELPER DE SELEÇÃO AUTOMÁTICA E MINUCIOSA DE BOBINAS & ROTEAMENTO
// EXCLUSIVO PARA O BARRACÃO DE TELHAS (NÃO ALTERA NADA NO CORTE & DOBRA)
// =====================================================================

import { base44 } from "@/api/base44Client";
import {
  detectarTipoProdutoTelha,
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
import { isEspessuraCompatible, isOrigemCompatible } from "@/lib/bobinaValidation";
import { isBobinaAberta, isBobinaNatural } from "@/lib/bobinaStatusHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { calcularDataPrometidaSLA, toISODate } from "@/lib/sla";

export const LOCAL_STORAGE_KEY_AUTO_TELHAS = "pcp_auto_roteamento_telhas";

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
 * Remove acentuação e caracteres especiais para normalização
 */
function removerAcentos(str = "") {
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
  if (/(TERRACOTA|CERAMICA)/i.test(combined)) return "TERRACOTA";
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
  if (!corExigida) return true;
  const corBobina = removerAcentos(bobina?.cor || "");
  const rvmBobina = removerAcentos(bobina?.rvm || "");
  const qualBobina = removerAcentos(bobina?.qualidade || "");
  const corAlvo = removerAcentos(corExigida);

  // Caso 1: Pedido exige NATURAL / GALVALUME
  if (corAlvo === "NATURAL" || corAlvo === "GALVALUME") {
    // Bobina NÃO pode ser pré-pintada colorida (Branca, Preta, etc.)
    const ehColorida = /(BRANC|PRET|AZUL|BEGE|GRAFIT|CINZA|TERRACOT|VERMELH|MARROM|VERD)/i.test(corBobina);
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
  if (corAlvo === "TERRACOTA") {
    return /(TERRACOTA|CERAMICA)/i.test(corBobina) || /(TERRACOTA)/i.test(rvmBobina);
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

  // Fallback: substring
  return corBobina.includes(corAlvo) || rvmBobina.includes(corAlvo);
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
  const espTec = extrairEspecificacao(descTexto, item?.quantidade, item?.unidade);
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

    // Unidade deve corresponder à filial (ou matriz padrão)
    if (b.unidade && filialAlvo && b.unidade !== filialAlvo) return false;

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

  const produtoNome = item.produto || item.descricao || "";
  const prodTipo = detectarTipoProdutoTelha(produtoNome);
  let maquina = item.maquina || detectarMaquinaTelha(produtoNome);
  if (!maquina) maquina = "TP - 40"; // Padrão de fábrica de telhas

  const esp = item.espessura ? String(item.espessura) : detectarEspessura(produtoNome);
  const origem = item.origem || detectarOrigemAco(produtoNome);
  const cor = detectarCorTelha(produtoNome, item.descricao || "");

  // 1. Busca a melhor bobina com o algoritmo minucioso
  const bobinaEleita = selecionarMelhorBobinaTelhas({
    item,
    pedido,
    todasBobinas,
    filialAtiva,
    tolerancias
  });

  // 2. Extração de especificações físicas (peças, mm, metros lineares)
  const descTexto = item.descricao || item.observacao || pedido.observacoes || "";
  const espTec = extrairEspecificacao(descTexto, item.quantidade, item.unidade);

  let qtdChapas = item.quantidade || 1;
  let metragemMm = "";
  let metragemTotalLinear = item.quantidade || 1;
  let variacoesTelhasJson = "";

  if (espTec.tem_especificacao) {
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

  // 3. Monta os dados da Ordem de Produção (tabela Pedido)
  const dadosOp = {
    data: dataReceb,
    data_pedido: dataReceb,
    data_prevista: dataPrevista,
    numero_pedido: pedido.numero_pedido || "",
    cliente: pedido.cliente_nome || pedido.cliente || "",
    vendedor: pedido.vendedor_nome || pedido.vendedor || "",
    unidade: unidadeOp,
    produto: prodTipo,
    modelo: `${maquina} ${cor !== "NATURAL" ? cor : "Galvalume"}`,
    maquina: maquina,
    status: "pendente",
    espessura_exigida: esp || "0.43",
    origem_exigida: origem || "ambas",
    rvm_superior: bobinaEleita?.cor || (cor !== "NATURAL" ? cor : "Natural"),
    bobina_superior_id: bobinaEleita?.bobina_id || null,
    bobina_superior: bobinaEleita?.descricao || "",
    metros: Number(qtdChapas) || 1,
    metragem_mm: Number(metragemMm) || null,
    quantidade_telhas: Number(metragemTotalLinear) || 1,
    metragem_planejada: Number(metragemTotalLinear) || 1,
    variacoes_telhas: variacoesTelhasJson,
    observacoes: `Auto-Roteado PCP (Barracão Telhas) — ${descTexto}`.trim(),
    pedido_odoo_id: pedido.id,
    of_odoo_id: pedido.of_odoo_id || "",
    of_nome: pedido.of_nome || "",
    item_idx: itemIdx,
    item_produto: produtoNome,
    foto_pedido_url: item.foto_url || item.imagem_url || pedido.foto_pedido_url || extrairCroquiPedido(pedido) || ""
  };

  // 4. Verificação anti-duplicação: checa se já existe OP ativa para este mesmo item
  let opCriada = null;
  try {
    const opsExistentes = await base44.entities.Pedido.filter({
      pedido_odoo_id: pedido.id,
      item_idx: itemIdx
    });
    const opValida = opsExistentes.find(o => o.status !== "cancelado");
    if (opValida) {
      // Atualiza com a bobina selecionada se ainda estava vazia
      if (!opValida.bobina_superior_id && bobinaEleita?.bobina_id) {
        opCriada = await base44.entities.Pedido.update(opValida.id, {
          bobina_superior_id: bobinaEleita.bobina_id,
          bobina_superior: bobinaEleita.descricao,
          rvm_superior: bobinaEleita.cor,
          maquina: maquina
        });
      } else {
        opCriada = opValida;
      }
    }
  } catch (errCheck) {
    console.warn("[AutoBobinaTelhas] Verificação de OP:", errCheck);
  }

  // Se não existe, cria a nova OP na máquina
  if (!opCriada) {
    opCriada = await base44.entities.Pedido.create(dadosOp);
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
      // Apenas itens de telha não concluídos e não distribuídos
      const ehTelha = telhas.some(t => (t._idx != null ? t._idx === i : t.produto === it.produto));
      if (!ehTelha) continue;
      if (it.status === "concluido") continue;
      if (it.distribuido && it.maquina) continue;

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
