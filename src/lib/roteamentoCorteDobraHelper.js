import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { normalizarUnidadeMedidaItem } from "@/lib/pedidoOdooHelper";

/**
 * Roteia diretamente os itens de Corte & Dobra do pedido para o chão de fábrica
 * criando a OP na 1ª máquina do roteiro escolhido pelo PCP.
 *
 * @param {Object} params
 * @param {Object} params.pedido - PedidoOdoo
 * @param {Array} params.itensCD - Itens do pedido classificados como C&D
 * @param {Object} params.roteiroFinalPorItem - { [itemIdx]: { maquinas: string[], maquinaInicial: string } }
 * @param {string} params.filialAtiva - Filial de destino
 * @returns {Promise<{ opsCriadas: Array, itensAtualizadosMap: Object }>}
 */
export async function rotearItensCorteDobraDireto({
  pedido,
  itensCD = [],
  roteiroFinalPorItem = {},
  filialAtiva = "Matriz AJL"
}) {
  const opsCriadas = [];
  const itensAtualizadosMap = {};
  const dataHoje = format(new Date(), "yyyy-MM-dd");
  const unidadeFinal = pedido.unidade || filialAtiva || "Matriz AJL";

  for (const it of itensCD) {
    const itemIdx = it._idx != null ? it._idx : 0;
    const roteiroCfg = roteiroFinalPorItem[itemIdx];
    if (!roteiroCfg || !roteiroCfg.maquinas || roteiroCfg.maquinas.length === 0) {
      continue;
    }

    const maquinas = roteiroCfg.maquinas;
    const maquinaInicial = maquinas[0];
    const descItem = it.descricao || it.produto || "";
    const unid = normalizarUnidadeMedidaItem(it, "cd");
    const isKg = unid === "KG";
    const qtdOdoo = Number(it.quantidade) || 0;
    const spec = extrairEspecificacao(descItem, it.quantidade, unid) || {};

    // 🛡️ Regra Estrita de Unidade de Medida (AJL):
    // Quando vier em KG: a grandeza comercial é peso em KG (ex: 1000 kg).
    // Se o vendedor indicou peças na descrição (ex: 10 PÇS 1200x3000), quantidade_pecas = 10, peso_kg = 1000 kg.
    // Se NÃO indicou peças, quantidade = 1000 kg, peso_kg = 1000 kg, unidade = KG.
    // Quando vier em PC / Peça / Barra:
    // A grandeza é quantidade de peças mesmo (ex: 32 pçs).
    let qtdOp = 1;
    let qtdPecasOp = null;
    let pesoKgOp = null;

    if (isKg) {
      pesoKgOp = qtdOdoo > 0 ? qtdOdoo : null;
      if (spec?.pecas && spec.pecas > 0) {
        qtdPecasOp = Number(spec.pecas);
        qtdOp = qtdPecasOp;
      } else {
        qtdOp = qtdOdoo > 0 ? qtdOdoo : 1;
      }
    } else {
      qtdOp = Number(spec?.pecas || spec?.quantidade || it.quantidade_pecas || qtdOdoo || 1);
      qtdPecasOp = qtdOp;
      pesoKgOp = spec?.peso_kg || (it.peso_kg ? Number(it.peso_kg) : null);
    }

    const compMm = spec?.comprimento_mm || it.comprimento_mm || 3000;
    const desenvMm = spec?.desenvolvimento_mm || it.desenvolvimento_mm || null;
    const dimensoes = spec?.dimensoes_fmt || it.medida || `${compMm}mm`;

    const isDesbInicial = maquinaInicial.startsWith("DESBOBINADEIRA");

    let opCriada = null;

    if (isDesbInicial) {
      // ── 1. Se a 1ª etapa for DESBOBINADEIRA: cria em OrdemDesbobinadeira ──
      const payloadDesb = {
        data: dataHoje,
        maquina: maquinaInicial,
        maquina_inicial: maquinaInicial,
        unidade: unidadeFinal,
        numero_pedido: String(pedido.numero_pedido || "").replace(/^#/, "").trim(),
        numero_oc: pedido.numero_oc || "",
        cliente: pedido.cliente_nome || "",
        vendedor: pedido.vendedor_nome || "",
        tipo_peca: it.produto || "Blank / Chapa Cortada",
        dimensoes_livres: dimensoes,
        comprimento_mm: Number(compMm) || 3000,
        quantidade: qtdOp,
        quantidade_pecas: qtdPecasOp,
        peso_kg: pesoKgOp,
        kg_estimado: pesoKgOp,
        unidade: isKg ? "KG" : (unid === "BR" ? "BR" : "PC"),
        destino: "pedido_direto",
        status: "pendente",
        foto_pedido_url: pedido.foto_pedido_url || it.foto_pedido_url || null,
        observacoes: [
          descItem,
          `Unidade: ${isKg ? `KG (${pesoKgOp} kg${qtdPecasOp ? ` - ${qtdPecasOp} pçs` : ""})` : `${unid === "BR" ? "BR (Barras)" : "PC (Peças)"}: ${qtdOp}`}`,
          `Roteiro PCP: ${maquinas.join(" ➔ ")}`,
          pedido.observacao_vendedor ? `Instrução: ${pedido.observacao_vendedor}` : ""
        ].filter(Boolean).join(" | "),
        // Metadados do Roteiro Dinâmico
        roteiro_maquinas: JSON.stringify(maquinas),
        indice_etapa_atual: 0,
        pedido_odoo_id: pedido.id,
        of_odoo_id: pedido.of_odoo_id || null,
        of_nome: pedido.of_nome || null,
        item_idx: itemIdx,
      };

      try {
        opCriada = await base44.entities.OrdemDesbobinadeira.create(payloadDesb);
      } catch (errDesb) {
        console.error("[rotearItensCorteDobraDireto] Erro ao criar OrdemDesbobinadeira:", errDesb);
        throw new Error(`Falha ao criar OP no ${maquinaInicial}: ${errDesb?.message || errDesb}`);
      }
    } else {
      // ── 2. Se a 1ª etapa for CORTE, DOBRA ou PERFILADEIRA: cria em OrdemMaquinaCD ──
      const payloadMaquina = {
        data: dataHoje,
        maquina: maquinaInicial,
        maquina_inicial: maquinaInicial,
        unidade: unidadeFinal,
        numero_pedido: String(pedido.numero_pedido || "").replace(/^#/, "").trim(),
        cliente: pedido.cliente_nome || "",
        vendedor: pedido.vendedor_nome || "",
        tipo_peca: it.produto || "Corte & Dobra",
        dimensoes_livres: dimensoes,
        comprimento_mm: Number(compMm) || 3000,
        desenvolvimento_mm: Number(desenvMm) || null,
        quantidade: qtdOp,
        quantidade_pecas: qtdPecasOp,
        peso_kg: pesoKgOp,
        unidade: isKg ? "KG" : (unid === "BR" ? "BR" : "PC"),
        status: "pendente",
        chapa_origem: "chaparia",
        foto_pedido_url: pedido.foto_pedido_url || it.foto_pedido_url || null,
        observacoes: [
          descItem,
          `Unidade: ${isKg ? `KG (${pesoKgOp} kg${qtdPecasOp ? ` - ${qtdPecasOp} pçs` : ""})` : `${unid === "BR" ? "BR (Barras)" : "PC (Peças)"}: ${qtdOp}`}`,
          `Roteiro PCP: ${maquinas.join(" ➔ ")}`,
          pedido.observacao_vendedor ? `Instrução: ${pedido.observacao_vendedor}` : ""
        ].filter(Boolean).join(" | "),
        // Metadados do Roteiro Dinâmico
        roteiro_maquinas: JSON.stringify(maquinas),
        indice_etapa_atual: 0,
        pedido_odoo_id: pedido.id,
        of_odoo_id: pedido.of_odoo_id || null,
        of_nome: pedido.of_nome || null,
        item_idx: itemIdx,
      };

      try {
        opCriada = await base44.entities.OrdemMaquinaCD.create(payloadMaquina);
      } catch (errMaq) {
        console.error("[rotearItensCorteDobraDireto] Erro ao criar OrdemMaquinaCD:", errMaq);
        throw new Error(`Falha ao criar OP no ${maquinaInicial}: ${errMaq?.message || errMaq}`);
      }
    }

    if (opCriada && opCriada.id) {
      opsCriadas.push(opCriada);
      itensAtualizadosMap[itemIdx] = {
        status: "distribuido",
        distribuido: true,
        maquina: maquinaInicial,
        roteiro_maquinas: maquinas,
        op_cd_id: opCriada.id
      };
    }
  }

  return { opsCriadas, itensAtualizadosMap };
}

/**
 * Função responsável por avançar a OP para a próxima máquina do roteiro
 * quando o operador finaliza a etapa atual.
 *
 * @param {Object} ordemAtual - Ordem finalizada (OrdemMaquinaCD ou OrdemDesbobinadeira)
 * @param {string} entidadeOrigem - "OrdemMaquinaCD" | "OrdemDesbobinadeira"
 * @returns {Promise<{ avancou: boolean, proximaMaquina?: string, novaOp?: Object }>}
 */
export async function avancarProximaEtapaRoteiroCD(ordemAtual, entidadeOrigem = "OrdemMaquinaCD") {
  if (!ordemAtual) return { avancou: false };

  // Lê o roteiro de máquinas gravado na ordem
  let roteiro = [];
  try {
    roteiro = typeof ordemAtual.roteiro_maquinas === "string"
      ? JSON.parse(ordemAtual.roteiro_maquinas || "[]")
      : (Array.isArray(ordemAtual.roteiro_maquinas) ? ordemAtual.roteiro_maquinas : []);
  } catch (e) {
    roteiro = [];
  }

  if (!Array.isArray(roteiro) || roteiro.length <= 1) {
    return { avancou: false, motivo: "sem_proxima_etapa" };
  }

  const indiceAtual = typeof ordemAtual.indice_etapa_atual === "number"
    ? ordemAtual.indice_etapa_atual
    : roteiro.indexOf(ordemAtual.maquina || ordemAtual.maquina_inicial);

  const proximoIndice = indiceAtual + 1;

  // Se já era a última etapa do roteiro, encerra o ciclo
  if (proximoIndice >= roteiro.length) {
    return { avancou: false, motivo: "roteiro_concluido" };
  }

  const proximaMaquina = roteiro[proximoIndice];
  const dataHoje = format(new Date(), "yyyy-MM-dd");

  const payloadProxima = {
    data: dataHoje,
    maquina: proximaMaquina,
    maquina_inicial: roteiro[0] || proximaMaquina,
    unidade: ordemAtual.unidade || "Matriz AJL",
    numero_pedido: ordemAtual.numero_pedido || "",
    cliente: ordemAtual.cliente || "",
    vendedor: ordemAtual.vendedor || "",
    tipo_peca: ordemAtual.tipo_peca || "Corte & Dobra",
    dimensoes_livres: ordemAtual.dimensoes_livres || "",
    comprimento_mm: ordemAtual.comprimento_mm || 3000,
    desenvolvimento_mm: ordemAtual.desenvolvimento_mm || null,
    quantidade: ordemAtual.quantidade || 1,
    quantidade_pecas: ordemAtual.quantidade_pecas || null,
    peso_kg: ordemAtual.peso_kg || null,
    unidade: ordemAtual.unidade || "PC",
    status: "pendente", // ⚡ Entra pronta para ser executada na próxima máquina
    chapa_origem: "chaparia",
    foto_pedido_url: ordemAtual.foto_pedido_url || null,
    foto_material_url: ordemAtual.foto_finalizacao_url || ordemAtual.foto_material_url || null,
    observacoes: `Veio de ${ordemAtual.maquina || entidadeOrigem} (Etapa ${proximoIndice + 1} de ${roteiro.length}: ${roteiro.join(" ➔ ")})`,
    roteiro_maquinas: JSON.stringify(roteiro),
    indice_etapa_atual: proximoIndice,
    pedido_odoo_id: ordemAtual.pedido_odoo_id || null,
    of_odoo_id: ordemAtual.of_odoo_id || null,
    of_nome: ordemAtual.of_nome || null,
    item_idx: ordemAtual.item_idx != null ? ordemAtual.item_idx : null,
    ordem_anterior_id: ordemAtual.id,
    ordem_corte_id: ordemAtual.id
  };

  try {
    const novaOp = await base44.entities.OrdemMaquinaCD.create(payloadProxima);
    return { avancou: true, proximaMaquina, novaOp };
  } catch (errProxima) {
    console.error("[avancarProximaEtapaRoteiroCD] Falha ao criar OP da próxima etapa:", errProxima);
    return { avancou: false, erro: errProxima };
  }
}
