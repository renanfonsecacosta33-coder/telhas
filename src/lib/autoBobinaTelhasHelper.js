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
import { isEspessuraCompatible, isOrigemCompatible, removerAcentos, detectarCorTelha, isCorCompativel, isMesmaFilial } from "@/lib/bobinaValidation";
import { isBobinaAberta, isBobinaNatural } from "@/lib/bobinaStatusHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { calcularDataPrometidaSLA, toISODate } from "@/lib/sla";
import { getPrioridadeNivel } from "@/lib/prioridadeHelper";

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

export { removerAcentos, detectarCorTelha, isCorCompativel };

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
  const prodTipo = detectarTipoProdutoTelha(produtoNome, descTexto);
  let maquina = (prodTipo === "CUMEEIRA" || /\bCUMEEIRA\b/i.test(`${produtoNome} ${descTexto}`))
    ? "CUMEEIRA"
    : (item.maquina || detectarMaquinaTelha(produtoNome) || "TP - 40");

  const esp = item.espessura ? String(item.espessura) : detectarEspessura(produtoNome);
  const origem = item.origem || detectarOrigemAco(produtoNome);
  const cor = detectarCorTelha(produtoNome, descTexto);
  const temIndicioEps = /(eps|manta|sanduiche|isopor|termoacustica|pir|pur|bandeja)/i.test(`${produtoNome} ${descTexto}`);
  const eps = (["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(prodTipo) && temIndicioEps)
    ? detectarEPSTelha(produtoNome, maquina)
    : "";

  // 1. Busca a melhor bobina com o algoritmo minucioso
  const bobinaEleita = selecionarMelhorBobinaTelhas({
    item,
    pedido,
    todasBobinas,
    filialAtiva,
    tolerancias
  });

  // 2. Extração de especificações físicas (peças, mm, metros lineares)
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

  // Se for TELHA + EPS + TELHA, prepara bobina inferior
  const isDuplaTelha = prodTipo === "TELHA + EPS + TELHA";

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
    cor_exigida: cor || "NATURAL",
    eps: eps,
    rvm_superior: bobinaEleita?.cor || (cor !== "NATURAL" ? cor : "Natural"),
    bobina_superior_id: bobinaEleita?.bobina_id || null,
    bobina_superior: bobinaEleita?.descricao || "",
    rvm_inferior: isDuplaTelha ? (bobinaEleita?.cor || (cor !== "NATURAL" ? cor : "Natural")) : null,
    bobina_inferior_id: isDuplaTelha ? (bobinaEleita?.bobina_id || null) : null,
    bobina_inferior: isDuplaTelha ? (bobinaEleita?.descricao || "") : null,
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
      const updates = {};
      // Atualiza com a bobina selecionada se ainda estava vazia
      if (!opValida.bobina_superior_id && bobinaEleita?.bobina_id) {
        updates.bobina_superior_id = bobinaEleita.bobina_id;
        updates.bobina_superior = bobinaEleita.descricao;
        updates.rvm_superior = bobinaEleita.cor;
      }
      // Corrige o produto se estava divergente do Odoo
      if (opValida.produto !== prodTipo) {
        updates.produto = prodTipo;
        if (isDuplaTelha) {
          updates.bobina_inferior_id = opValida.bobina_inferior_id || bobinaEleita?.bobina_id || null;
          updates.bobina_inferior = opValida.bobina_inferior || bobinaEleita?.descricao || "";
          updates.rvm_inferior = opValida.rvm_inferior || bobinaEleita?.cor || "Natural";
        }
      }
      if (eps) {
        if (!opValida.eps || opValida.eps !== eps) updates.eps = eps;
      } else if (opValida.eps) {
        // Se a telha não tem EPS, limpa o EPS da OP anterior
        updates.eps = "";
        updates.eps_status = null;
      }
      if (cor && (!opValida.cor_exigida || opValida.cor_exigida !== cor)) {
        updates.cor_exigida = cor;
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
  tolerancias = []
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
    const prodTipo = detectarTipoProdutoTelha(produtoNome, descTexto);
    let maquina = (prodTipo === "CUMEEIRA" || /\bCUMEEIRA\b/i.test(`${produtoNome} ${descTexto}`))
      ? "CUMEEIRA"
      : (it.maquina || detectarMaquinaTelha(produtoNome) || "TP - 40");
    const esp = it.espessura ? String(it.espessura) : (detectarEspessura(produtoNome) || "0.43");
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

  // 2. Para cada grupo de modelo idêntico:
  for (const g of grupos.values()) {
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
      const espTec = extrairEspecificacao(descTexto, it.quantidade, it.unidade);

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

    const bobinaEleita = selecionarMelhorBobinaTelhas({
      item: itemVirtualParaBobina,
      pedido,
      todasBobinas,
      filialAtiva,
      tolerancias
    });

    const dataReceb = pedido.data_recebimento
      ? String(pedido.data_recebimento).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const dataPrevista = pedido.data_entrega
      ? String(pedido.data_entrega).slice(0, 10)
      : toISODate(calcularDataPrometidaSLA(dataReceb, 7));

    const unidadeOp = filialAtiva && filialAtiva !== "todas" ? filialAtiva : (pedido.unidade || "Matriz AJL");
    const isDuplaTelha = g.prodTipo === "TELHA + EPS + TELHA";
    const temIndicioEpsNoGrupo = /(eps|manta|sanduiche|isopor|termoacustica|pir|pur|bandeja)/i.test(`${primeiroItem.produto || ""} ${primeiroItem.descricao || ""}`);
    const eps = (["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(g.prodTipo) && temIndicioEpsNoGrupo)
      ? detectarEPSTelha(primeiroItem.produto || primeiroItem.descricao || "", g.maquina)
      : "";

    const nivelPrioridade = getPrioridadeNivel(pedido);

    const dadosOp = {
      data: dataReceb,
      data_pedido: dataReceb,
      data_prevista: dataPrevista,
      numero_pedido: pedido.numero_pedido || "",
      cliente: pedido.cliente_nome || pedido.cliente || "",
      vendedor: pedido.vendedor_nome || pedido.vendedor || "",
      unidade: unidadeOp,
      produto: g.prodTipo,
      modelo: `${g.maquina} ${g.cor !== "NATURAL" ? g.cor : "Galvalume"}`,
      maquina: g.maquina,
      status: "pendente",
      prioridade_nivel: nivelPrioridade,
      prioridade: Boolean(nivelPrioridade),
      is_rota: nivelPrioridade === "ROTA",
      espessura_exigida: g.esp || "0.43",
      origem_exigida: primeiroItem.origem || detectarOrigemAco(primeiroItem.produto || "") || "ambas",
      cor_exigida: g.cor || "NATURAL",
      eps: eps,
      rvm_superior: bobinaEleita?.cor || (g.cor !== "NATURAL" ? g.cor : "Natural"),
      bobina_superior_id: bobinaEleita?.bobina_id || null,
      bobina_superior: bobinaEleita?.descricao || "",
      rvm_inferior: isDuplaTelha ? (bobinaEleita?.cor || (g.cor !== "NATURAL" ? g.cor : "Natural")) : null,
      bobina_inferior_id: isDuplaTelha ? (bobinaEleita?.bobina_id || null) : null,
      bobina_inferior: isDuplaTelha ? (bobinaEleita?.descricao || "") : null,
      metros: Number(somaPecas) || 1,
      metragem_mm: variacoesConsolidadas.length === 1 ? (variacoesConsolidadas[0].mm || null) : null,
      quantidade_telhas: Number(somaMetrosLineares) || 1,
      metragem_planejada: Number(somaMetrosLineares) || 1,
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

    // Verificação anti-duplicação:
    let opCriada = null;
    try {
      const opsExistentes = await base44.entities.Pedido.filter({
        pedido_odoo_id: pedido.id,
        item_idx: itemPrincipalIdx
      });
      const opValida = opsExistentes.find(o => o.status !== "cancelado");
      if (opValida) {
        opCriada = await base44.entities.Pedido.update(opValida.id, {
          ...dadosOp,
          status: opValida.status || "pendente"
        });
      }
    } catch (errCheck) {
      console.warn("[AutoBobinaTelhas Lote] Erro checagem anti-duplicidade:", errCheck);
    }

    if (!opCriada) {
      opCriada = await base44.entities.Pedido.create(dadosOp);
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
  }

  return { opsCriadas, itensAtualizadosMap };
}
