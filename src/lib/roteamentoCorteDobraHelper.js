import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { normalizarUnidadeMedidaItem, getItens, classGrupo } from "@/lib/pedidoOdooHelper";
import { extrairEspessuraDoTexto } from "@/lib/estoqueMaterialHelper";
import { identificarRoteiroDoPedido } from "@/lib/roteiroEtapasProducaoHelper";
import { finalizarOpsDoPedido } from "@/lib/conciliacaoPcpMaquinasHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { payloadLimpo, textoOuNulo } from "@/lib/payloadLimpo";

/**
 * Normaliza qualquer variação de nome de máquina de Corte & Dobra
 * para a chave canônica reconhecida pelos painéis das máquinas:
 * - "DOBRA 3M"
 * - "CORTE 3M"
 * - "CORTE 6M"
 * - "DOBRA FUNDO 6M"
 * - "DOBRA INICIO 6M"
 * - "DOBRADEIRA 4M"
 * - "PERFILADEIRA"
 * - "DESBOBINADEIRA 01"
 * - "DESBOBINADEIRA 02"
 * - "LASER"
 */
export function normalizarChaveMaquinaCD(nome) {
  if (!nome) return "";
  const s = String(nome)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Desbobinadeiras
  if (s.includes("DESBOBINAD")) {
    if (s.includes("02") || s.includes(" 2")) return "DESBOBINADEIRA 02";
    return "DESBOBINADEIRA 01";
  }

  // Dobradeiras 6m (Fundo vs Início)
  if ((s.includes("DOBRA") || s.includes("DOBRADEIRA")) && s.includes("6")) {
    if (s.includes("FUNDO")) return "DOBRA FUNDO 6M";
    if (s.includes("INICIO") || s.includes("INIC")) return "DOBRA INICIO 6M";
    return "DOBRA FUNDO 6M";
  }

  // Dobra 4m
  if ((s.includes("DOBRA") || s.includes("DOBRADEIRA")) && s.includes("4")) {
    return "DOBRADEIRA 4M";
  }

  // Dobra 3m / Dobradeira 3m
  if ((s.includes("DOBRA") || s.includes("DOBRADEIRA")) && s.includes("3")) {
    return "DOBRA 3M";
  }

  // Corte 6m / Guilhotina 6m
  if ((s.includes("CORTE") || s.includes("GUILHOTINA")) && s.includes("6")) {
    return "CORTE 6M";
  }

  // Corte 3m / Guilhotina 3m
  if ((s.includes("CORTE") || s.includes("GUILHOTINA")) && s.includes("3")) {
    return "CORTE 3M";
  }

  // Perfiladeira
  if (s.includes("PERFIL")) return "PERFILADEIRA";

  // Laser
  if (s.includes("LASER")) return "LASER";

  return s;
}

/**
 * Compara se duas identificações de máquinas de Corte & Dobra se referem
 * à mesma máquina física na fábrica, resolvendo variações como:
 * "DOBRA 3M" vs "DOBRADEIRA 3M" vs "Dobradeira 3m"
 * "CORTE 3M" vs "GUILHOTINA 3M" vs "Guilhotina 3m"
 */
export function ehMesmaMaquinaCD(maqA, maqB) {
  if (!maqA || !maqB) return false;
  if (maqA === maqB) return true;
  const kA = normalizarChaveMaquinaCD(maqA);
  const kB = normalizarChaveMaquinaCD(maqB);
  if (kA && kB && kA === kB) return true;

  const cleanA = String(maqA).toUpperCase().trim();
  const cleanB = String(maqB).toUpperCase().trim();
  return cleanA === cleanB;
}

/**
 * Roteia diretamente os itens de Corte & Dobra do pedido para o chão de fábrica
 * criando a OP na 1ª máquina do roteiro escolhido pelo PCP.
 *
 * @param {Object} params
 * @param {Object} params.pedido - PedidoOdoo
 * @param {Array} params.itensCD - Itens do pedido classificados como C&D
 * @param {Object} params.roteiroFinalPorItem - { [itemIdx]: { maquinas: string[], maquinaInicial: string } }
 * @param {string} params.filialAtiva - Filial de destino
 * @param {Array} params.bobinasEstoque - Bobinas do estoque já carregadas pelo PCP
 * @returns {Promise<{ opsCriadas: Array, itensAtualizadosMap: Object }>}
 */
export async function rotearItensCorteDobraDireto({
  pedido,
  itensCD = [],
  roteiroFinalPorItem = {},
  filialAtiva = "Matriz AJL",
  bobinasEstoque = []
}) {
  const opsCriadas = [];
  const itensAtualizadosMap = {};
  const dataHoje = format(new Date(), "yyyy-MM-dd");

  const UNIDADES_VALIDAS = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];
  let filialValida = pedido.unidade || (filialAtiva !== "todas" ? filialAtiva : null) || "Matriz AJL";
  if (!UNIDADES_VALIDAS.includes(filialValida)) {
    filialValida = "Matriz AJL";
  }

  // Carrega lista de bobinas abertas para vincular caso a 1ª etapa seja Desbobinador
  let listaBobinas = Array.isArray(bobinasEstoque) && bobinasEstoque.length > 0 ? bobinasEstoque : [];
  if (listaBobinas.length === 0) {
    try {
      listaBobinas = await base44.entities.Bobina.list();
    } catch (eBob) {
      console.warn("[rotearItensCorteDobraDireto] Consulta de bobinas no banco:", eBob);
    }
  }

  const mapaRoteiro = roteiroFinalPorItem?.roteiroFinalPorItem || roteiroFinalPorItem || {};

  for (const it of itensCD) {
    const itemIdx = it._idx != null ? it._idx : 0;
    const roteiroCfg = mapaRoteiro[itemIdx];
    if (!roteiroCfg || !roteiroCfg.maquinas || roteiroCfg.maquinas.length === 0) {
      continue;
    }

    const maquinas = roteiroCfg.maquinas;
    const maquinaInicial = maquinas[0];
    const textoCompletoItem = [it.produto, it.descricao, it.observacao, it.name].filter(Boolean).join(" ");
    const descItem = it.descricao || it.produto || "";
    const unid = normalizarUnidadeMedidaItem(it, "cd");
    const isKg = unid === "KG";
    const qtdOdoo = Number(it.quantidade) || 0;
    const spec = extrairEspecificacao(textoCompletoItem, it.quantidade, unid) || {};
    const espDetectada = extrairEspessuraDoTexto(textoCompletoItem);

    // 🛡️ Regra Estrita de Unidade de Medida (AJL):
    // Quando vier em KG: a grandeza comercial é peso em KG (ex: 1000 kg).
    // Se o vendedor indicou peças na descrição (ex: 10 PÇS 1200x3000), quantidade_pecas = 10, peso_kg = 1000 kg.
    // Se NÃO indicou peças, quantidade = 1000 kg, peso_kg = 1000 kg.
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

    // Detecta a espessura da chapa do pedido com prioridade máxima
    const espAlvoStr = String(espDetectada || spec?.espessura_mm || it.espessura || it.chapa || "").replace(",", ".").replace("mm", "").trim();
    const espAlvo = parseFloat(espAlvoStr);

    if (isDesbInicial) {
      // ── 1. Se a 1ª etapa for DESBOBINADEIRA: cria em OrdemDesbobinadeira ──
      // 🛡️ REGRA DE OURO (AJL):
      // No Corte & Dobra, BOBINAS SÓ SÃO USADAS nas máquinas DESBOBINADEIRA 01 e DESBOBINADEIRA 02.
      // E SE O USUÁRIO / PCP NÃO SELECIONOU UMA BOBINA, NUNCA ATRIBUIR AUTOMATICAMENTE!
      const bobinaManualId = it.bobina_id || roteiroCfg?.bobina_id || null;
      let bobinaIdFinal = "";
      let bobinaDescFinal = "";
      let espUtilizadaFinal = espAlvoStr || null;

      if (bobinaManualId) {
        // Usuário escolheu explicitamente uma bobina
        const bobinaEscolhida = (listaBobinas || []).find(b => b.id === bobinaManualId || b.codigo === bobinaManualId);
        bobinaIdFinal = bobinaEscolhida?.id || bobinaManualId;
        bobinaDescFinal = bobinaEscolhida
          ? `[${bobinaEscolhida.codigo || "CD"}] ${bobinaEscolhida.qualidade || "Galvanizado"} · ${bobinaEscolhida.espessura_utilizada || espAlvoStr || ""}mm`
          : (it.bobina_descricao || "");
        espUtilizadaFinal = bobinaEscolhida?.espessura_utilizada || espAlvoStr || null;
      } else {
        // 🛡️ Nenhuma bobina selecionada: fica limpa para o operador definir na máquina
        bobinaIdFinal = "";
        bobinaDescFinal = "";
        espUtilizadaFinal = espAlvoStr || null;
      }

      const payloadDesb = {
        data: dataHoje,
        maquina: maquinaInicial,
        maquina_inicial: maquinaInicial,
        unidade: filialValida,
        bobina_id: bobinaIdFinal,
        bobina_descricao: bobinaDescFinal,
        espessura_utilizada: espUtilizadaFinal,
        espessura_exigida: espAlvoStr || null,
        material_espessura: espAlvoStr || null,
        origem_exigida: "ambas",
        numero_pedido: String(pedido.numero_pedido || "").replace(/^#/, "").trim(),
        numero_oc: pedido.numero_oc || "",
        cliente: pedido.cliente_nome || "",
        vendedor: pedido.vendedor_nome || "",
        tipo_peca: it.produto || "Blank / Chapa Cortada",
        produto: it.produto || descItem,
        descricao: descItem,
        instrucao: it.instrucao || it.observacao || pedido.observacao_vendedor || descItem,
        observacao_vendedor: pedido.observacao_vendedor || it.observacao || "",
        chapa_descricao: it.chapa_descricao || descItem,
        dimensoes_livres: dimensoes,
        comprimento_mm: Number(compMm) || 3000,
        quantidade: qtdOp,
        quantidade_pecas: qtdPecasOp,
        peso_kg: pesoKgOp,
        kg_estimado: pesoKgOp,
        destino: "pedido_direto",
        status: "pendente",
        prioridade: Boolean(pedido.prioridade),
        prioridade_nivel: pedido.prioridade_nivel || null,
        tipo_prioridade: textoOuNulo(pedido.tipo_prioridade) || textoOuNulo(pedido.prioridade_logistica),
        prioridade_logistica: textoOuNulo(pedido.prioridade_logistica),
        prioridade_selecionada: true,
        cliente_retira_agora: Boolean(pedido.cliente_retira_agora || pedido.retira_agora),
        is_rota: Boolean(pedido.is_rota || pedido.rota),
        rota: Boolean(pedido.is_rota || pedido.rota),
        data_programada_pcp: pedido.data_programada_pcp || pedido.data_carregamento_rota || pedido.data_prontidao || null,
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
        opCriada = await base44.entities.OrdemDesbobinadeira.create(payloadLimpo(payloadDesb));
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
        unidade: filialValida,
        numero_pedido: String(pedido.numero_pedido || "").replace(/^#/, "").trim(),
        numero_oc: pedido.numero_oc || "",
        cliente: pedido.cliente_nome || "",
        vendedor: pedido.vendedor_nome || "",
        tipo_peca: it.produto || "Corte & Dobra",
        produto: it.produto || descItem,
        descricao: descItem,
        instrucao: it.instrucao || it.observacao || pedido.observacao_vendedor || descItem,
        observacao_vendedor: pedido.observacao_vendedor || it.observacao || "",
        chapa_descricao: it.chapa_descricao || descItem,
        dimensoes_livres: dimensoes,
        comprimento_mm: Number(compMm) || 3000,
        desenvolvimento_mm: Number(desenvMm) || null,
        quantidade: qtdOp,
        quantidade_pecas: qtdPecasOp,
        peso_kg: pesoKgOp,
        espessura_exigida: espAlvoStr || null,
        material_espessura: espAlvoStr || null,
        status: "pendente",
        prioridade: Boolean(pedido.prioridade),
        prioridade_nivel: pedido.prioridade_nivel || null,
        tipo_prioridade: textoOuNulo(pedido.tipo_prioridade) || textoOuNulo(pedido.prioridade_logistica),
        prioridade_logistica: textoOuNulo(pedido.prioridade_logistica),
        prioridade_selecionada: true,
        cliente_retira_agora: Boolean(pedido.cliente_retira_agora || pedido.retira_agora),
        is_rota: Boolean(pedido.is_rota || pedido.rota),
        rota: Boolean(pedido.is_rota || pedido.rota),
        data_programada_pcp: pedido.data_programada_pcp || pedido.data_carregamento_rota || pedido.data_prontidao || null,
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
        opCriada = await base44.entities.OrdemMaquinaCD.create(payloadLimpo(payloadMaquina));
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
 * quando o operador finaliza a etapa atual, atualizando automaticamente
 * tanto a fila do chão de fábrica quanto o PedidoOdoo e o status na Central PCP.
 *
 * @param {Object} ordemAtual - Ordem finalizada (OrdemMaquinaCD ou OrdemDesbobinadeira)
 * @param {string} entidadeOrigem - "OrdemMaquinaCD" | "OrdemDesbobinadeira"
 * @returns {Promise<{ avancou: boolean, proximaMaquina?: string, novaOp?: Object, concluido?: boolean }>}
 */
export async function avancarProximaEtapaRoteiroCD(ordemAtual, entidadeOrigem = "OrdemMaquinaCD") {
  if (!ordemAtual) return { avancou: false };

  const dataHoje = format(new Date(), "yyyy-MM-dd");
  const numPedLimpo = String(ordemAtual.numero_pedido || "").replace(/^#/, "").trim();

  // 1. Localiza o PedidoOdoo correspondente
  let pedOdoo = null;
  try {
    if (ordemAtual.pedido_odoo_id) {
      pedOdoo = await base44.entities.PedidoOdoo.get(ordemAtual.pedido_odoo_id).catch(() => null);
    }
    if (!pedOdoo && numPedLimpo) {
      const peds = await base44.entities.PedidoOdoo.filter({ numero_pedido: numPedLimpo }, "-created_date", 1).catch(() => []);
      pedOdoo = peds?.[0] || null;
      if (!pedOdoo) {
        const pedsHash = await base44.entities.PedidoOdoo.filter({ numero_pedido: `#${numPedLimpo}` }, "-created_date", 1).catch(() => []);
        pedOdoo = pedsHash?.[0] || null;
      }
    }
  } catch (ePed) {
    console.warn("[avancarProximaEtapaRoteiroCD] Falha ao consultar PedidoOdoo:", ePed);
  }

  // 2. Lê o roteiro de máquinas gravado na ordem ou recupera no pedido / itens
  let roteiro = [];
  try {
    roteiro = typeof ordemAtual.roteiro_maquinas === "string"
      ? JSON.parse(ordemAtual.roteiro_maquinas || "[]")
      : (Array.isArray(ordemAtual.roteiro_maquinas) ? ordemAtual.roteiro_maquinas : []);
  } catch (e) {
    roteiro = [];
  }

  if (!Array.isArray(roteiro) || roteiro.length === 0) {
    if (pedOdoo?.roteiro_maquinas) {
      try {
        roteiro = typeof pedOdoo.roteiro_maquinas === "string"
          ? JSON.parse(pedOdoo.roteiro_maquinas)
          : (Array.isArray(pedOdoo.roteiro_maquinas) ? pedOdoo.roteiro_maquinas : []);
      } catch {}
    }
    if (!roteiro || roteiro.length === 0) {
      const itensPed = pedOdoo ? getItens(pedOdoo) : [];
      const itemComRoteiro = itensPed.find(i => i.roteiro_maquinas && i.roteiro_maquinas.length > 0);
      if (itemComRoteiro) {
        roteiro = Array.isArray(itemComRoteiro.roteiro_maquinas)
          ? itemComRoteiro.roteiro_maquinas
          : (typeof itemComRoteiro.roteiro_maquinas === "string" ? JSON.parse(itemComRoteiro.roteiro_maquinas) : []);
      }
    }
    // Se ainda assim não encontrar, gera pelo helper ou usa o roteiro padrão de Corte e Dobra
    if (!roteiro || roteiro.length === 0) {
      if (pedOdoo) {
        const etapasPed = identificarRoteiroDoPedido(pedOdoo, null, []);
        roteiro = etapasPed.filter(e => e.ativo !== false).map(e => e.maquina);
      }
    }
    if (!roteiro || roteiro.length === 0) {
      roteiro = ["DESBOBINADEIRA 01", "GUILHOTINA 3M", "DOBRADEIRA 3M"];
    }
  }

  // 3. Determina o índice da etapa atual com normalização inteligente
  const maqAtualNorm = String(ordemAtual.maquina || ordemAtual.maquina_inicial || "").toUpperCase().trim();
  let indiceAtual = typeof ordemAtual.indice_etapa_atual === "number" ? ordemAtual.indice_etapa_atual : -1;

  if (indiceAtual < 0 || indiceAtual >= roteiro.length) {
    indiceAtual = roteiro.findIndex(m => String(m || "").toUpperCase().trim() === maqAtualNorm);
  }

  if (indiceAtual < 0) {
    if (entidadeOrigem === "OrdemDesbobinadeira" || maqAtualNorm.includes("DESBOBINADEIRA")) {
      indiceAtual = roteiro.findIndex(m => String(m || "").toUpperCase().includes("DESBOBINADEIRA"));
      if (indiceAtual < 0) indiceAtual = 0;
    } else if (maqAtualNorm.includes("GUILHOTINA") || maqAtualNorm.includes("CORTE")) {
      indiceAtual = roteiro.findIndex(m => {
        const s = String(m || "").toUpperCase();
        return s.includes("GUILHOTINA") || s.includes("CORTE");
      });
      if (indiceAtual < 0) indiceAtual = 1;
    } else if (maqAtualNorm.includes("DOBRA")) {
      indiceAtual = roteiro.findIndex(m => String(m || "").toUpperCase().includes("DOBRA"));
      if (indiceAtual < 0) indiceAtual = 2;
    } else {
      indiceAtual = 0;
    }
  }

  const proximoIndice = indiceAtual + 1;

  // 4. Se já era a última etapa do roteiro (ex.: Dobradeira finalizada), CONCLUI O PEDIDO EM 100%
  if (proximoIndice >= roteiro.length) {
    if (pedOdoo) {
      try {
        const itensPed = getItens(pedOdoo);
        const novosItens = itensPed.map(it => {
          if (classGrupo(it) === "cd") {
            return {
              ...it,
              status: "concluido",
              concluido: true,
              percentual_concluido: 100,
              onde_esta: "Expedição / Concluído"
            };
          }
          return it;
        });

        // Etapas concluídas salvas
        const etapasFinais = roteiro.map((maq, idx) => ({
          id: `etapa_${idx + 1}`,
          nome: `${idx + 1}. ${maq}`,
          maquina: maq,
          ativo: true,
          concluida: true
        }));

        await base44.entities.PedidoOdoo.update(pedOdoo.id, {
          status_pcp: "concluido",
          status: "concluido",
          percentual_concluido: 100,
          onde_esta: "Expedição / Concluído",
          data_conclusao: dataHoje,
          itens_json: JSON.stringify(novosItens),
          etapas_concluidas_json: JSON.stringify(etapasFinais)
        });

        // Notifica o Odoo ERP e finaliza OPs locais
        await notificarStatus(pedOdoo.id, "concluido", { usuario: "Chão de Fábrica" }).catch(() => {});
        await finalizarOpsDoPedido(pedOdoo.numero_pedido).catch(() => {});
      } catch (errConcluir) {
        console.error("[avancarProximaEtapaRoteiroCD] Erro ao concluir PedidoOdoo 100%:", errConcluir);
      }
    }
    return { avancou: false, concluido: true, motivo: "roteiro_concluido" };
  }

  // 5. Há próxima máquina no roteiro (ex.: Desbobinadeira ➔ Guilhotina, ou Guilhotina ➔ Dobradeira)
  const proximaMaquina = roteiro[proximoIndice];
  const maquinaCanonica = normalizarChaveMaquinaCD(proximaMaquina) || proximaMaquina;
  const UNIDADES_VALIDAS = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];
  let filialValida = ordemAtual.unidade;
  if (!UNIDADES_VALIDAS.includes(filialValida)) {
    filialValida = pedOdoo?.unidade || "Matriz AJL";
  }

  // 🛡️ REGRA AJL A DESCRIÇÃO NUNCA MUDA, ELA É FIXA:
  // Preserva integralmente a descrição, instrução e especificações da peça através de todas as etapas de produção
  const itensPedOdoo = pedOdoo ? getItens(pedOdoo) : [];
  const itemCorrespondente = (ordemAtual.item_idx != null ? itensPedOdoo[ordemAtual.item_idx] : null) || itensPedOdoo[0] || null;

  const descricaoFixa = ordemAtual.descricao || itemCorrespondente?.descricao || ordemAtual.tipo_peca || pedOdoo?.descricao || "";
  const instrucaoFixa = ordemAtual.instrucao || itemCorrespondente?.instrucao || itemCorrespondente?.observacao || pedOdoo?.observacao_vendedor || "";
  const produtoFixo = ordemAtual.produto || itemCorrespondente?.produto || pedOdoo?.produto || ordemAtual.tipo_peca || "Corte & Dobra";
  const tipoPecaFixo = ordemAtual.tipo_peca || produtoFixo || "Corte & Dobra";
  const chapaDescFixa = ordemAtual.chapa_descricao || itemCorrespondente?.chapa_descricao || ordemAtual.bobina_descricao || "";
  const desenvIdFixo = ordemAtual.desenvolvimento_id || itemCorrespondente?.desenvolvimento_id || null;
  const desenvDescFixo = ordemAtual.desenvolvimento_descricao || itemCorrespondente?.desenvolvimento_descricao || null;

  const payloadProxima = {
    data: dataHoje,
    maquina: maquinaCanonica,
    maquina_inicial: normalizarChaveMaquinaCD(roteiro[0]) || roteiro[0] || maquinaCanonica,
    unidade: filialValida,
    numero_pedido: numPedLimpo,
    numero_oc: ordemAtual.numero_oc || pedOdoo?.numero_oc || "",
    cliente: ordemAtual.cliente || pedOdoo?.cliente_nome || "",
    vendedor: ordemAtual.vendedor || pedOdoo?.vendedor_nome || "",
    tipo_peca: tipoPecaFixo,
    produto: produtoFixo,
    descricao: descricaoFixa,
    instrucao: instrucaoFixa,
    chapa_descricao: chapaDescFixa,
    desenvolvimento_id: desenvIdFixo,
    desenvolvimento_descricao: desenvDescFixo,
    dimensoes_livres: ordemAtual.dimensoes_livres || "",
    comprimento_mm: ordemAtual.comprimento_mm || 3000,
    desenvolvimento_mm: ordemAtual.desenvolvimento_mm || null,
    largura_mm: ordemAtual.largura_mm || null,
    quantidade: ordemAtual.quantidade || 1,
    quantidade_pecas: ordemAtual.quantidade_pecas || null,
    peso_kg: ordemAtual.peso_kg || null,
    espessura_exigida: ordemAtual.espessura_exigida || null,
    material_espessura: ordemAtual.material_espessura || ordemAtual.espessura_utilizada || null,
    status: "pendente", // ⚡ Entra pronta para ser executada na próxima máquina
    chapa_origem: ordemAtual.chapa_origem || "chaparia",
    chapa_cd_id: ordemAtual.chapa_cd_id || null,
    prioridade: Boolean(ordemAtual.prioridade || pedOdoo?.prioridade),
    prioridade_nivel: ordemAtual.prioridade_nivel || pedOdoo?.prioridade_nivel || null,
    tipo_prioridade: textoOuNulo(ordemAtual.tipo_prioridade) || textoOuNulo(pedOdoo?.tipo_prioridade),
    cliente_retira_agora: Boolean(ordemAtual.cliente_retira_agora || pedOdoo?.cliente_retira_agora),
    is_rota: Boolean(ordemAtual.is_rota || pedOdoo?.is_rota),
    data_programada_pcp: ordemAtual.data_programada_pcp || pedOdoo?.data_programada_pcp || null,
    foto_pedido_url: ordemAtual.foto_pedido_url || null,
    foto_material_url: ordemAtual.foto_finalizacao_url || ordemAtual.foto_material_url || null,
    observacoes: ordemAtual.observacoes || pedOdoo?.observacoes || "",
    observacao_vendedor: ordemAtual.observacao_vendedor || pedOdoo?.observacao_vendedor || "",
    veio_de: `${ordemAtual.maquina || entidadeOrigem}`,
    historico_etapa: `Etapa ${proximoIndice + 1} de ${roteiro.length}: ${roteiro.join(" ➔ ")}`,
    roteiro_maquinas: JSON.stringify(roteiro),
    indice_etapa_atual: proximoIndice,
    pedido_odoo_id: pedOdoo?.id || ordemAtual.pedido_odoo_id || null,
    of_odoo_id: pedOdoo?.of_odoo_id || ordemAtual.of_odoo_id || null,
    of_nome: pedOdoo?.of_nome || ordemAtual.of_nome || null,
    item_idx: ordemAtual.item_idx != null ? ordemAtual.item_idx : null,
    ordem_anterior_id: ordemAtual.id,
    ordem_corte_id: ordemAtual.id
  };

  let novaOp = null;
  try {
    novaOp = await base44.entities.OrdemMaquinaCD.create(payloadLimpo(payloadProxima));
  } catch (errProxima) {
    console.error("[avancarProximaEtapaRoteiroCD] Falha ao criar OP da próxima etapa:", errProxima);
    return { avancou: false, erro: errProxima };
  }

  // 6. Atualiza imediatamente o PedidoOdoo e os Itens no Banco para o PCP sincronizar em tempo real
  if (pedOdoo) {
    try {
      const proxNorm = proximaMaquina.toUpperCase();
      let novoPct = 45;
      if (proxNorm.includes("DOBRA")) {
        novoPct = 75;
      } else if (proxNorm.includes("GUILHOTINA") || proxNorm.includes("CORTE")) {
        novoPct = 45;
      } else {
        novoPct = Math.min(95, Math.round(((proximoIndice + 0.5) / roteiro.length) * 100));
      }

      const itensPed = getItens(pedOdoo);
      const novosItens = itensPed.map(it => {
        if (classGrupo(it) === "cd") {
          return {
            ...it,
            maquina: proximaMaquina,
            status: "pendente",
            status_detalhado: `Fila da Máquina: ${proximaMaquina}`,
            onde_esta: `Fila da Máquina: ${proximaMaquina}`,
            percentual_concluido: novoPct,
            roteiro_maquinas: roteiro
          };
        }
        return it;
      });

      // Etapas concluídas até o momento
      const etapasSalvas = roteiro.map((maq, idx) => ({
        id: `etapa_${idx + 1}`,
        nome: `${idx + 1}. ${maq}`,
        maquina: maq,
        ativo: true,
        concluida: idx < proximoIndice
      }));

      await base44.entities.PedidoOdoo.update(pedOdoo.id, {
        maquina: proximaMaquina,
        onde_esta: `Fila da Máquina: ${proximaMaquina}`,
        status_pcp: "em_producao",
        status: "pendente",
        percentual_concluido: novoPct,
        itens_json: JSON.stringify(novosItens),
        etapas_concluidas_json: JSON.stringify(etapasSalvas),
        roteiro_maquinas: JSON.stringify(roteiro)
      });
    } catch (errPedSync) {
      console.warn("[avancarProximaEtapaRoteiroCD] Aviso ao atualizar PedidoOdoo:", errPedSync);
    }
  }

  return { avancou: true, proximaMaquina, novaOp };
}