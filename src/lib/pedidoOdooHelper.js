import { stripHtml } from "@/lib/stripHtml";

// Helper compartilhado para itens de PedidoOdoo com status por peça.
// Normaliza itens_json garantindo campos de status por item.

const STATUS_DEFAULTS = {
  status: "pendente",        // pendente | em_producao | concluido
  maquina: "",               // máquina selecionada (CD)
  quantidade_produzida: 0,   // peças já produzidas (CD)
  medicao: ""                // medição conferida (CD)
};

export function getItens(pedido) {
  if (!pedido) return [];
  let arr = [];
  if (Array.isArray(pedido.itens)) {
    arr = pedido.itens;
  } else if (typeof pedido.itens_json === "string" && pedido.itens_json.trim()) {
    try { arr = JSON.parse(pedido.itens_json); } catch { arr = []; }
  } else if (Array.isArray(pedido.itens_json)) {
    arr = pedido.itens_json;
  }
  return arr.map((it, idx) => {
    const unid = normalizarUnidadeMedidaItem(it);
    return {
      ...STATUS_DEFAULTS,
      ...it,
      unidade: unid,
      _idx: idx
    };
  });
}

// Aceita item individual (obj), Pedido/OF completo (obj com itens_json) ou categoria + produto (strings)
export function classGrupo(itemOrCat, produtoNome = "") {
  let cat = "";
  let prod = "";
  let itens = [];

  if (typeof itemOrCat === "object" && itemOrCat !== null) {
    // Se for objeto Pedido ou OF, tenta inspecionar itens_json / itens
    if (Array.isArray(itemOrCat.itens)) {
      itens = itemOrCat.itens;
    } else if (typeof itemOrCat.itens_json === "string" && itemOrCat.itens_json.trim()) {
      try { itens = JSON.parse(itemOrCat.itens_json); } catch {}
    } else if (Array.isArray(itemOrCat.itens_json)) {
      itens = itemOrCat.itens_json;
    }

    if (itens.length > 0) {
      // Prioridade: inspeciona os itens reais da ordem de fabricação
      const first = itens[0] || {};
      cat = String(first.categoria || itemOrCat.categoria || "").trim().toLowerCase();
      prod = String(first.produto || first.descricao || first.observacao || itemOrCat.produto || itemOrCat.descricao || itemOrCat.of_nome || "").trim().toLowerCase();
    } else {
      cat = String(itemOrCat.categoria || "").trim().toLowerCase();
      prod = String(itemOrCat.produto || itemOrCat.descricao || itemOrCat.observacao || itemOrCat.of_nome || "").trim().toLowerCase();
    }

    // Se o pedido tiver contagens de itens pré-computadas e nenhum item detalhado
    if (itens.length === 0 && !prod) {
      if ((itemOrCat.itens_telha_count || 0) > 0 && !(itemOrCat.itens_cd_count > 0) && !(itemOrCat.itens_frisada_count > 0)) return "telha";
      if ((itemOrCat.itens_frisada_count || 0) > 0 && !(itemOrCat.itens_cd_count > 0) && !(itemOrCat.itens_telha_count > 0)) return "frisada";
      if ((itemOrCat.itens_cd_count || 0) > 0 && !(itemOrCat.itens_telha_count > 0) && !(itemOrCat.itens_frisada_count > 0)) return "cd";
    }
  } else {
    cat = String(itemOrCat || "").trim().toLowerCase();
    prod = String(produtoNome || "").trim().toLowerCase();
  }

  // 1. Frisadas / Lambris (prioridade exclusiva de Frisada/Expedição)
  if (["frisadas", "frisada"].includes(cat) || /(frisad|lambri)/i.test(prod) || /(frisad|lambri)/i.test(cat)) return "frisada";

  // 2. CORTE E DOBRA (100% Perfis, Cantoneiras, Chapas/Chaparia e serviços de C&D)
  // Regra de ouro da fábrica: tudo que for PERFIL e CANTONEIRA é CORTE E DOBRA 100%!
  if (
    /(perfil|cantoneir|chapa|chaparia|corte\s*e\s*dobra|corte_dobra|\bcd\b)/i.test(cat) ||
    /(perfil|cantoneir|chapa|chaparia|corte\s*e\s*dobra|corte_dobra)/i.test(prod)
  ) {
    return "cd";
  }

  // 3. TELHAS (Bobininhas, Telhas, Cumeeiras, Calhas, Rufos, Bandejas, etc.)
  // Regra de ouro da fábrica: Bobininha (e variações: bobinina, fita, desbobinamento) vai SEMPRE para Telhas (máquina DESBOBINADOR),
  // assim como Telhas, Cumeeiras, Calhas, Rufos e todo o restante!
  return "telha";
}

/**
 * Normaliza e auto-corrige a unidade de medida do item (KG, BR, UN, MT)
 * Regra de Negócio AJL:
 * - CORTE E DOBRA e FRISADAS: NUNCA usam MT (metros é exclusivo de Telhas!).
 * - O padrão em Corte e Dobra é KG.
 * - Perfis e barras (Padrão - BR, PERFIL, TRILHO, CANTONEIRA, BARRA, c/ 3000, c/ 6000, etc.) são BR.
 * - Itens de contagem unitária (Padrão - UN, acessórios) são UN.
 * - Se o Odoo enviar a unidade errada (ex: MT ou vazia para C&D/Perfis/Frisadas), auto-corrige para BR ou KG.
 */
export function normalizarUnidadeMedidaItem(item, setorHint = null) {
  if (!item) return "UN";

  const prod = String(item.produto || item.product || item.product_name || item.of_nome || "").trim();
  const desc = String(item.descricao || item.description || item.observacao || item.obs || item.name || "").trim();
  const textoCompleto = `${prod} ${desc}`.toUpperCase();
  const rawUnidade = String(item.unidade || item.uom || item.product_uom || "").trim().toUpperCase();

  // 0. Soberania da unidade comercial do Odoo: se a cotação/pedido veio expressamente em KG, respeitar KG!
  if (["KG", "KGS", "QUILO", "QUILOS"].includes(rawUnidade)) {
    return "KG";
  }

  // 1. Detecção explícita no texto do produto/descrição (padrão oficial de cadastro no Odoo AJL)
  // Ex: "Frisada V Ch 28 (0,43) POR METRO (Padrão - BR)"
  // Ex: "576 - Perfil 06 C/ 3000 Ch 1,25 (Trilho Lateral da porta de aço) (Padrão - BR)"
  // Ex: "Perfil ... (Padrão - BR)"
  if (
    /\(PADR[AÃ]O\s*-\s*BR\)/i.test(textoCompleto) ||
    /\[PADR[AÃ]O\s*-\s*BR\]/i.test(textoCompleto) ||
    /\bPADR[AÃ]O\s*-\s*BR\b/i.test(textoCompleto) ||
    /\bPOR\s+METRO\s*\(PADR[AÃ]O\s*-\s*BR\)/i.test(textoCompleto) ||
    /\b\(BR\)/i.test(textoCompleto) ||
    /\/BR\b/i.test(textoCompleto)
  ) {
    return "BR";
  }

  if (
    /\(PADR[AÃ]O\s*-\s*UN\)/i.test(textoCompleto) ||
    /\[PADR[AÃ]O\s*-\s*UN\]/i.test(textoCompleto) ||
    /\bPADR[AÃ]O\s*-\s*UN\b/i.test(textoCompleto) ||
    /\(PADR[AÃ]O\s*-\s*P[EÇ]A\)/i.test(textoCompleto) ||
    /\[PADR[AÃ]O\s*-\s*P[EÇ]A\]/i.test(textoCompleto)
  ) {
    return "UN";
  }

  if (
    /\(PADR[AÃ]O\s*-\s*KG\)/i.test(textoCompleto) ||
    /\[PADR[AÃ]O\s*-\s*KG\]/i.test(textoCompleto) ||
    /\bPADR[AÃ]O\s*-\s*KG\b/i.test(textoCompleto)
  ) {
    return "KG";
  }

  const setor = setorHint || classGrupo(item);

  // 2. CORTE E DOBRA e FRISADAS:
  // Regra inviolável: CORTE E DOBRA E FRISADAS NUNCA TRABALHAM COM "MT"
  if (setor === "cd" || setor === "corte_dobra" || setor === "frisada") {
    // Se a unidade já informada for BR ou se o produto indicar barra/perfil:
    if (
      ["BR", "BARRA", "BARRAS"].includes(rawUnidade) ||
      /\bPERFIL\b/i.test(textoCompleto) ||
      /\bTRILHO\b/i.test(textoCompleto) ||
      /\bCANTONEIRA\b/i.test(textoCompleto) ||
      /\bBARRA\b/i.test(textoCompleto) ||
      /\bc\/\s*3000\b/i.test(textoCompleto) ||
      /\bc\/\s*6000\b/i.test(textoCompleto) ||
      /\bc\/\s*2000\b/i.test(textoCompleto) ||
      /\b3000\s*MM\b/i.test(textoCompleto) ||
      /\b6000\s*MM\b/i.test(textoCompleto)
    ) {
      return "BR";
    }

    // Se indicar expressamente UN / peça
    if (["UN", "UND", "UNID", "UNIDADE", "UNIDADES", "PC", "PCS", "PÇ", "PÇS", "PECA", "PECAS"].includes(rawUnidade)) {
      return "UN";
    }

    // Se a unidade informada for KG
    if (["KG", "KGS", "QUILO", "QUILOS"].includes(rawUnidade)) {
      return "KG";
    }

    // Frisadas (se não capturado acima)
    if (setor === "frisada") {
      if (/\bc\/\s*\d{3,4}\b/i.test(textoCompleto)) return "BR";
      return "BR";
    }

    // PADRÃO DE CORTE E DOBRA: KG!
    return "KG";
  }

  // 3. TELHAS:
  if (setor === "telha") {
    // Acessórios de telhas (cumeeira, parafuso, fita, vedação, calha, rufo avulso) são UN ou PC
    if (
      /\b(CUMEEIRA|PARAFUSO|FITA|VEDACAO|VEDA[CÇ][AÃ]O|PU\s*40|SILICONE|SOQUETE|BROCA)\b/i.test(textoCompleto)
    ) {
      if (["UN", "UND", "UNID", "UNIDADE", "UNIDADES", "PC", "PCS", "PÇ", "PÇS", "PECA", "PECAS"].includes(rawUnidade)) return "UN";
      return "UN";
    }
    // Bobininha / Bobina em KG
    if (["KG", "KGS"].includes(rawUnidade)) {
      return "KG";
    }
    // Telhas perfiladas usam MT
    if (["MT", "M", "METRO", "METROS"].includes(rawUnidade) || !rawUnidade) {
      return "MT";
    }
    if (["UN", "PC", "BR"].includes(rawUnidade)) {
      return rawUnidade;
    }
    return "MT";
  }

  // Fallback geral:
  if (["BR", "BARRA", "BARRAS"].includes(rawUnidade)) return "BR";
  if (["KG", "KGS", "QUILO", "QUILOS"].includes(rawUnidade)) return "KG";
  if (["UN", "UND", "UNID", "UNIDADE", "UNIDADES", "PC", "PCS", "PÇ", "PÇS", "PECA", "PECAS"].includes(rawUnidade)) return "UN";
  if (["MT", "M", "METRO", "METROS"].includes(rawUnidade)) return "MT";

  return rawUnidade || "UN";
}

export function itensPorGrupo(itens, grupo) {
  return itens.filter((i) => classGrupo(i) === grupo);
}

// Percentual global baseado em TODOS os itens do pedido (considerando etapas reais de produção)
export function computePercentual(itens) {
  if (!itens || itens.length === 0) return 0;
  let totalPontos = 0;
  for (const it of itens) {
    if (it.status === "concluido" || it.status === "finalizado") {
      totalPontos += 1.0;
    } else if (it.status === "aguardando_colagem") {
      totalPontos += 0.85;
    } else if (it.status === "em_producao") {
      totalPontos += 0.50; // OP criada na máquina / em produção
    } else if (it.maquina) {
      totalPontos += 0.50; // Máquina atribuída
    } else {
      totalPontos += 0.15; // Distribuído na fila
    }
  }
  return Math.min(100, Math.round((totalPontos / itens.length) * 100));
}

// Percentual de um sub-pacote (ex: só telhas)
export function computePercentualGrupo(itens, grupo) {
  const sub = itensPorGrupo(itens, grupo);
  if (sub.length === 0) return 0;
  return computePercentual(sub);
}

// Localiza a OP correspondente a um item específico de forma estrita,
// evitando que OPs de outros itens ou outras OFs do mesmo pedido de venda
// contaminem este item.
export function localizarOpDoItem(it, opsList = [], todosItens = []) {
  if (!opsList || opsList.length === 0 || !it) return null;

  // 1. Vínculo exato por índice do item se a OP registrou item_idx ou itens_indices agrupados
  if (it._idx != null) {
    const opPorIdx = opsList.find(o => {
      if (o.item_idx != null && o.item_idx === it._idx) return true;
      const rawIndices = o.itens_indices || o.item_indices;
      if (rawIndices) {
        try {
          const list = Array.isArray(rawIndices) ? rawIndices : JSON.parse(rawIndices);
          if (Array.isArray(list) && list.includes(it._idx)) return true;
        } catch {}
      }
      return false;
    });
    if (opPorIdx) return opPorIdx;
  }

  // 2. Vínculo por correspondência de produto E medida/quantidade (evita colisão entre itens do mesmo produto)
  const prodItem = String(it.produto || it.descricao || "").toUpperCase().trim();
  const codItem = (prodItem.match(/^\d{3,6}/) || [])[0];
  const medidaItem = String(it.medida || "").replace(/\D+/g, "");
  const qtdItem = it.quantidade ? String(it.quantidade) : "";

  const opExata = opsList.find(o => {
    const prodOp = String(o.item_produto || o.produto_rotulo_pcp || o.modelo || o.tipo_peca || o.produto || "").toUpperCase().trim();
    const codOp = (prodOp.match(/^\d{3,6}/) || [])[0];
    const matchProd = (codItem && codOp && codItem === codOp) || (prodOp && (prodItem.includes(prodOp) || prodOp.includes(prodItem)));
    if (!matchProd) return false;

    // Se temos medida no item, checa se bate com a metragem ou dimensões da OP
    if (medidaItem) {
      const opMetragem = String(o.metragem_mm || o.dimensoes_livres || "").replace(/\D+/g, "");
      if (opMetragem && (opMetragem.includes(medidaItem) || medidaItem.includes(opMetragem))) return true;
    }
    // Se temos quantidade/metros
    if (qtdItem && (String(o.metros) === qtdItem || String(o.quantidade) === qtdItem || String(o.quantidade_telhas) === qtdItem)) {
      return true;
    }
    return false;
  });
  if (opExata) return opExata;

  // 3. Se houver apenas 1 OP desse código correspondente na lista
  if (codItem) {
    const opsMesmoCod = opsList.filter(o => {
      const prodOp = String(o.item_produto || o.produto_rotulo_pcp || o.modelo || o.tipo_peca || o.produto || "").toUpperCase().trim();
      const codOp = (prodOp.match(/^\d{3,6}/) || [])[0];
      return codOp && codOp === codItem;
    });
    if (opsMesmoCod.length === 1) return opsMesmoCod[0];
  }

  // 4. Fallback estrito: SOMENTE se o pedido tiver exatamente 1 item E a lista de OPs tiver exatamente 1 OP
  if (opsList.length === 1 && todosItens.length === 1) {
    return opsList[0];
  }

  return null;
}

// Calcula o progresso real e dinâmico consultando as OPs de produção nas máquinas
export function calcularProgressoRealPedido(pedido, pedidosProducao = [], ordensCD = []) {
  if (!pedido) return 0;
  const itens = getItens(pedido);
  if (!itens || itens.length === 0) return pedido.percentual_concluido || 0;

  const numPed = String(pedido.numero_pedido || "").trim().toUpperCase();
  const ofId = String(pedido.of_odoo_id || pedido.odoo_id || "").trim().toUpperCase();
  const ofNome = String(pedido.of_nome || "").trim().toUpperCase();

  const matchOp = (op) => {
    if (!op || op.status === "cancelado") return false;
    if (op.pedido_odoo_id && pedido?.id) {
      return op.pedido_odoo_id === pedido.id;
    }
    if (ofId && op.of_odoo_id) {
      return String(op.of_odoo_id).trim().toUpperCase() === ofId;
    }
    if (ofNome && op.of_nome) {
      return String(op.of_nome).trim().toUpperCase() === ofNome;
    }
    // Se a OP já foi vinculada a OUTRO pedido_odoo_id ou of_odoo_id, NÃO pertence a este:
    if (op.pedido_odoo_id || op.of_odoo_id) {
      return false;
    }
    if (op.numero_pedido && String(op.numero_pedido).trim().toUpperCase() === numPed) {
      return true;
    }
    return false;
  };

  const opsTelha = (pedidosProducao || []).filter(matchOp);
  const opsCD = (ordensCD || []).filter(matchOp);

  let soma = 0;
  for (const it of itens) {
    const grupo = classGrupo(it);
    let opReal = null;

    if (grupo === "telha") {
      opReal = localizarOpDoItem(it, opsTelha, itens);
    } else {
      opReal = localizarOpDoItem(it, opsCD, itens);
    }

    if (opReal) {
      if (opReal.status === "finalizado") {
        soma += 100;
      } else if (opReal.status === "aguardando_colagem") {
        soma += 85;
      } else if (opReal.status === "em_producao") {
        soma += 75; // Operador deu Play / máquina rodando!
      } else if (opReal.status === "pausado") {
        soma += 60;
      } else if (opReal.status === "pendente") {
        soma += 50; // OP criada na máquina (ex: TP - 25)!
      } else if (opReal.status === "aguardando_corte" || opReal.status === "aguardando_material") {
        soma += 25;
      } else {
        soma += 0;
      }
    } else if (it.status === "concluido") {
      soma += 100;
    } else if (it.status === "em_producao" || it.maquina) {
      soma += 50;
    } else if (pedido.status_pcp === "distribuido") {
      soma += 15; // Distribuído para galpão
    } else {
      soma += 0;
    }
  }

  return Math.min(100, Math.round(soma / itens.length));
}

// Retorna status descritivo e claro para cada item (ex: "Aguardando Início (TP - 25)", "Aguardando Revisão (C&D)")
export function obterStatusDescritivoItem(it, pedido, pedidosProducao = [], ordensCD = []) {
  const g = classGrupo(it);
  const numPed = String(pedido?.numero_pedido || "").trim().toUpperCase();
  const ofId = String(pedido?.of_odoo_id || pedido?.odoo_id || "").trim().toUpperCase();
  const ofNome = String(pedido?.of_nome || "").trim().toUpperCase();

  const matchOp = (op) => {
    if (!op || op.status === "cancelado") return false;
    if (op.pedido_odoo_id && pedido?.id) {
      return op.pedido_odoo_id === pedido.id;
    }
    if (ofId && op.of_odoo_id) {
      return String(op.of_odoo_id).trim().toUpperCase() === ofId;
    }
    if (ofNome && op.of_nome) {
      return String(op.of_nome).trim().toUpperCase() === ofNome;
    }
    if (op.pedido_odoo_id || op.of_odoo_id) {
      return false;
    }
    if (op.numero_pedido && String(op.numero_pedido).trim().toUpperCase() === numPed) {
      return true;
    }
    return false;
  };

  const opsTelha = (pedidosProducao || []).filter(matchOp);
  const opsCD = (ordensCD || []).filter(matchOp);
  const itens = getItens(pedido);

  let opReal = null;
  if (g === "telha") {
    opReal = localizarOpDoItem(it, opsTelha, itens);
  } else {
    opReal = localizarOpDoItem(it, opsCD, itens);
  }

  const isSanduiche = /(eps|manta|sanduiche|isopor|termoacustica)/i.test(
    String(it.produto || it.descricao || "")
  );

  if (opReal) {
    const maquinaNome = opReal.maquina || it.maquina || (g === "telha" ? "Perfiladeira" : "C&D");
    if (opReal.status === "finalizado") {
      return {
        status: "Concluído",
        status_detalhado: "100% Concluído",
        pct: 100,
        maquina: maquinaNome,
        fase: "concluido",
        etapaAtiva: 4
      };
    }
    if (opReal.status === "aguardando_colagem") {
      return {
        status: "Aguardando Colagem",
        status_detalhado: "Telha Cortada — Aguardando Colagem",
        pct: 85,
        maquina: "Bancada Colagem",
        fase: "colagem",
        etapaAtiva: 3
      };
    }
    if (opReal.status === "em_producao") {
      return {
        status: `Em Produção (${maquinaNome})`,
        status_detalhado: `Em Produção na Máquina ${maquinaNome}`,
        pct: 75,
        maquina: maquinaNome,
        fase: "em_producao",
        etapaAtiva: 1
      };
    }
    if (opReal.status === "pausado") {
      return {
        status: `Pausado (${maquinaNome})`,
        status_detalhado: `Produção Pausada na Máquina ${maquinaNome}`,
        pct: 60,
        maquina: maquinaNome,
        fase: "pausado",
        etapaAtiva: 1
      };
    }
    if (opReal.status === "pendente") {
      return {
        status: `Aguardando Início (${maquinaNome})`,
        status_detalhado: `Na Máquina ${maquinaNome} — Aguardando Início`,
        pct: 50,
        maquina: maquinaNome,
        fase: "aguardando_inicio",
        etapaAtiva: 1
      };
    }
  }

  // Se não foi criada OP na máquina ainda
  if (it.status === "concluido") {
    return {
      status: "Concluído",
      status_detalhado: "100% Concluído",
      pct: 100,
      maquina: it.maquina || "",
      fase: "concluido",
      etapaAtiva: 4
    };
  }
  if (it.status === "em_producao" || it.maquina) {
    const maq = it.maquina || (g === "telha" ? "Telhas" : "C&D");
    return {
      status: `Aguardando Início (${maq})`,
      status_detalhado: `Na Máquina ${maq} — Aguardando Início`,
      pct: 50,
      maquina: maq,
      fase: "aguardando_inicio",
      etapaAtiva: 1
    };
  }
  if (pedido?.status_pcp === "distribuido") {
    const setorNome = g === "telha" ? "Fila Telhas" : "Fila Corte & Dobra";
    return {
      status: `Aguardando Revisão (${setorNome})`,
      status_detalhado: `Aguardando Revisão do Encarregado (${setorNome})`,
      pct: 15,
      maquina: "",
      fase: "aguardando_revisao",
      etapaAtiva: 1
    };
  }

  return {
    status: "Aguardando Distribuição (PCP)",
    status_detalhado: "Aguardando Distribuição na Central PCP",
    pct: 0,
    maquina: "",
    fase: "pendente_pcp",
    etapaAtiva: 1
  };
}

export function enriquecerItensComStatusReal(pedido, pedidosProducao = [], ordensCD = []) {
  const itens = getItens(pedido);
  return itens.map((it) => {
    const info = obterStatusDescritivoItem(it, pedido, pedidosProducao, ordensCD);
    return {
      ...it,
      status: info.status,
      status_detalhado: info.status_detalhado,
      percentual: info.pct,
      maquina: info.maquina || it.maquina || ""
    };
  });
}

export function buildItensJson(itens) {
  return JSON.stringify(
    itens.map(({ _idx, ...rest }) => rest)
  );
}

// Determina o status_pcp do pedido com base no percentual
export function statusPcpPorPercentual(percentual, atual) {
  if (percentual >= 100) return "concluido";
  if (percentual > 0) return "em_producao";
  return atual === "distribuido" ? "distribuido" : (atual || "pendente_distribuicao");
}

export const STATUS_ITEM = {
  pendente: { label: "Pendente", cls: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400" },
  em_producao: { label: "Em Produção", cls: "bg-amber-100 text-amber-700 border-amber-300", dot: "bg-amber-500" },
  concluido: { label: "Concluído", cls: "bg-emerald-100 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" }
};

export const MAQUINAS_CD = [
  "Dobradeira 3m",
  "Dobradeira 6m",
  "Guilhotina 3m",
  "Guilhotina 6m",
  "Perfiladeira"
];

// Extrai a espessura numérica do EPS informada no produto (ex: EPS30, EPS 50mm -> "30mm")
export function extrairEspessuraEPS(texto = "") {
  const t = String(texto || "").toUpperCase();
  const match = t.match(/(?:EPS|ISOPOR|PU|PIR)\s*(\d{2,3})(?:\s*MM)?/i);
  if (match) {
    return `${match[1]}mm`;
  }
  return "";
}

// Detecta o tipo exato de produto para Telhas (compatível com PRODUTOS do formulário e chão de fábrica)
export function detectarTipoProdutoTelha(produtoTexto = "", descricaoTexto = "") {
  const p = `${produtoTexto || ""} ${descricaoTexto || ""}`.toUpperCase();

  // 0. CUMEEIRA tem prioridade sobre telhas compostas (ex: CUMEEIRA NORMAL TR 25)
  if (/\bCUMEEIRA\b/i.test(p)) {
    return "CUMEEIRA";
  }

  // 1. TELHA + EPS + MANTA (Telha + EPS com acabamento inferior em manta de alumínio / filme)
  const ehManta = (
    /(MANTA|FILME|ALUMINIO|ALUMNIO)/i.test(p) &&
    /(EPS|ISOPOR|SANDU|TERMOAC)/i.test(p)
  ) || /(EPS\s*\d*|ISOPOR|PU|PIR)\s*(\+|\/)\s*(MANTA|FILME)/i.test(p);
  if (ehManta) {
    return "TELHA + EPS + MANTA";
  }

  // 2. TELHA + EPS + TELHA (Dupla face / Sanduíche com chapa superior + EPS + chapa inferior)
  // Suporta padrões Odoo: [telha+EPS30+telha], [telha+EPS50+telha], EPS30+TELHA, TELHA+EPS+TELHA, DUPLA FACE, etc.
  const ehTelhaEpsTelha = (
    /(TELHA|CHAPA|COLONIAL|ONDULADA|TP\s*40|TP\s*25)\s*(\+|\/)\s*(EPS\s*\d*|ISOPOR|PU|PIR)\s*(\+|\/)\s*(TELHA|CHAPA|COLONIAL|ONDULADA|TP\s*40|TP\s*25)/i.test(p) ||
    /(EPS\s*\d*|ISOPOR|PU|PIR)\s*(\+|\/)\s*(TELHA|CHAPA|COLONIAL|ONDULADA|TP\s*40|TP\s*25)/i.test(p) ||
    /(DUPLA\s*FACE|DUPLA\s*CHAPA|TELHA\s*DUPLA|SANDU[IÍ]CHE\s*DUPL|TELHA\s*(\+|\/)\s*TELHA)/i.test(p)
  );
  if (ehTelhaEpsTelha) {
    return "TELHA + EPS + TELHA";
  }

  // 3. TELHA BANDEJA
  if (/\bBANDEJA\b/i.test(p)) {
    return "TELHA BANDEJA";
  }

  // 4. TELHA + EPS (Monoface: Chapa superior + EPS sem chapa ou manta inferior)
  // Exige termos explícitos com limites de palavra para nunca confundir telha simples
  if (/\b(EPS|ISOPOR|SANDUICHE|SANDUÍCHE|TERMOACUSTICA|TERMOACÚSTICA|PIR|PUR)\b/i.test(p) || /(EPS\s*\d+|ISOPOR\s*\d+)/i.test(p)) {
    return "TELHA + EPS";
  }

  // 5. Demais tipos específicos
  if (/(BOBININ|BOBININH|BOBINA|FITA|DESBOBINAM)/i.test(p)) {
    return "BOBININHA";
  }
  if (p.includes("PAINEL")) {
    return "PAINEL";
  }

  return "TELHA";
}

// Detecta a máquina sugerida para Telhas
export function detectarMaquinaTelha(produtoTexto = "") {
  const p = typeof produtoTexto === "object"
    ? `${produtoTexto?.produto || ""} ${produtoTexto?.modelo || ""} ${produtoTexto?.item_produto || ""} ${produtoTexto?.observacoes || ""} ${produtoTexto?.descricao || ""}`.toUpperCase()
    : String(produtoTexto || "").toUpperCase();

  // 1. CUMEEIRA sempre é feita na máquina CUMEEIRA (mesmo que seja Cumeeira TR 25, TR 40 ou Colonial)
  if (p.includes("CUMEEIRA")) return "CUMEEIRA";

  // 2. Bobininha / Fita
  if (/(DESBOBINADOR|BOBININ|BOBININH|BOBINA|FITA|DESBOBINAM)/i.test(p)) return "DESBOBINADOR";

  // 3. Demais perfiladeiras
  if (p.includes("TP 25") || p.includes("TP-25") || p.includes("TP25") || p.includes("TR 25") || p.includes("TR-25") || p.includes("TR25")) return "TP - 25";
  if (p.includes("TP 40") || p.includes("TP-40") || p.includes("TP40") || p.includes("TR 40") || p.includes("TR-40") || p.includes("TR40")) return "TP - 40";
  if (p.includes("ONDULAD")) return "ONDULADA";
  if (p.includes("COLONIAL")) return "COLONIAL";
  if (p.includes("BANDEJA")) return "BANDEJA";
  return "";
}

// Detecta a espessura no texto (ex: "(0,43)", "0.43", "0,50", "0.65", "1,25", etc.)
export function detectarEspessura(produtoTexto = "") {
  const p = String(produtoTexto || "");
  const matchPar = p.match(/\((\d+[.,]\d+)\s*\)/);
  if (matchPar) return matchPar[1].replace(".", ",");
  const match = p.match(/(0[,.]\d{1,3}|1[,.]\d{1,3}|2[,.]\d{1,3})/);
  return match ? match[1].replace(".", ",") : "";
}

// Detecta a origem do aço exigida (Nacional / Importado / ambas)
export function detectarOrigemAco(produtoTexto = "") {
  const p = String(produtoTexto || "").toLowerCase();
  if (p.includes("nacional") || p.includes("nac")) return "Nacional";
  if (p.includes("importad") || p.includes("imp")) return "Importado";
  return "ambas";
}

// Detecta o tipo e espessura de EPS a partir do texto do produto, modelo ou da máquina da telha
// REGRA DE OURO: Telha simples NUNCA tem EPS. Retorna vazio se não houver indício claro de EPS.
export function detectarEPSTelha(produtoTexto = "", maquina = "") {
  const p = String(produtoTexto || "").toUpperCase();
  const m = String(maquina || "").toUpperCase();

  // Se nem o texto nem a máquina mencionam EPS/termoacústica/sanduíche/isopor/bandeja, RETORNA VAZIO!
  const temIndicioEps =
    /\b(EPS|ISOPOR|SANDU|TERMOAC|PIR|PUR|BANDEJA)\b/i.test(p) ||
    /(EPS\s*\d+|ISOPOR\s*\d+)/i.test(p) ||
    /(CORTE DE EPS|CORTE EPS|COLAGEM)/i.test(m);

  if (!temIndicioEps) {
    return "";
  }

  const espEps = extrairEspessuraEPS(produtoTexto);
  const espSufixo = espEps ? ` (${espEps})` : "";

  // 1. Verifica no nome da máquina da telha
  if (m.includes("COLONIAL") && (m.includes("BANDEJA") || p.includes("BANDEJA"))) return `EPS - COLONIAL BANDEJA${espSufixo}`;
  if (m.includes("COLONIAL")) return `EPS - COLONIAL${espSufixo}`;
  if (m.includes("BANDEJA") || p.includes("BANDEJA")) return `EPS - TP 40 BANDEJA${espSufixo}`;
  if (m.includes("TP 25") || m.includes("TP-25") || m.includes("TP25")) return `EPS - TP 25${espSufixo}`;
  if (m.includes("TP 40") || m.includes("TP-40") || m.includes("TP40")) return `EPS - TP 40${espSufixo}`;
  if (m.includes("ONDULAD")) return `EPS - ONDULADO${espSufixo}`;

  // 2. Verifica no texto do produto / rótulo PCP
  if (p.includes("COLONIAL") && p.includes("BANDEJA")) return `EPS - COLONIAL BANDEJA${espSufixo}`;
  if (p.includes("COLONIAL")) return `EPS - COLONIAL${espSufixo}`;
  if (p.includes("BANDEJA") || p.includes("TP 40 BANDEJA") || p.includes("TP-40 BANDEJA")) return `EPS - TP 40 BANDEJA${espSufixo}`;
  if (p.includes("TP 25") || p.includes("TP-25") || p.includes("TP25")) return `EPS - TP 25${espSufixo}`;
  if (p.includes("TP 40") || p.includes("TP-40") || p.includes("TP40")) return `EPS - TP 40${espSufixo}`;
  if (p.includes("ONDULAD")) return `EPS - ONDULADO${espSufixo}`;

  return espEps ? `EPS ${espEps}` : "EPS";
}

import { calcularDataPrometidaSLA, toISODate } from "@/lib/sla";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { extrairCroquiPedido } from "@/lib/croquiExtractor";
import { detectarCorTelha } from "@/lib/bobinaValidation";

// Monta o preset completo de Nova Ordem para Telhas
export function prepararPresetNovaOrdemTelhas(pedido, item, filialAtiva) {
  const descTexto = item?.descricao || item?.observacao || pedido?.observacoes || "";
  const produtoNome = item?.produto || item?.descricao || "";
  const prodTipo = detectarTipoProdutoTelha(produtoNome, descTexto);
  const maq = detectarMaquinaTelha(produtoNome);
  const esp = item?.espessura ? String(item.espessura) : detectarEspessura(produtoNome);
  const origem = item?.origem || detectarOrigemAco(produtoNome);
  const cor = item?.cor || detectarCorTelha(produtoNome, descTexto);
  const isComEps = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(prodTipo) ||
    /(eps|manta|sanduiche|isopor|termoacustica)/i.test(produtoNome) ||
    /(eps|manta|sanduiche|isopor|termoacustica)/i.test(descTexto);
  const eps = isComEps ? detectarEPSTelha(`${produtoNome} ${descTexto}`, maq) : "";

  const dataReceb = pedido?.data_recebimento ? String(pedido.data_recebimento).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const dataPrevista = pedido?.data_entrega
    ? String(pedido.data_entrega).slice(0, 10)
    : toISODate(calcularDataPrometidaSLA(dataReceb, 7));

  // Extrai especificação inteligente da descrição (ex: "50 PÇS c/ 2000")
  const espTec = extrairEspecificacao(descTexto, item?.quantidade, item?.unidade);

  // No formulário de Telhas:
  // - metros = quantidade de chapas / peças a cortar (ex: 50)
  // - metragem_mm = comprimento unitário da telha em mm (ex: 2000)
  // - quantidade_telhas = metragem linear total do pedido em metros (ex: 100m)
  let qtdChapas = item?.quantidade || "";
  let metragemMm = "";
  let metragemTotalLinear = item?.quantidade || "";
  let variacoesTelhasJson = "";

  if (espTec.tem_especificacao) {
    if (espTec.variacoes && espTec.variacoes.length > 1) {
      qtdChapas = espTec.quantidade;
      metragemMm = espTec.comprimento_mm || "";
      metragemTotalLinear = espTec.metragem_total || item?.quantidade || "";
      variacoesTelhasJson = JSON.stringify(espTec.variacoes);
    } else if (espTec.comprimento_mm && espTec.quantidade) {
      qtdChapas = espTec.quantidade; // ex: 50 peças
      metragemMm = espTec.comprimento_mm; // ex: 2000 mm
      metragemTotalLinear = espTec.metragem_total || item?.quantidade || ""; // ex: 100 metros
    } else if (espTec.quantidade) {
      qtdChapas = espTec.quantidade;
      if (espTec.comprimento_mm) metragemMm = espTec.comprimento_mm;
      metragemTotalLinear = espTec.metragem_total || item?.quantidade || "";
    }
  }

  return {
    _presets: {
      data: dataReceb,
      data_pedido: dataReceb,
      data_prevista: dataPrevista,
      numero_pedido: pedido?.numero_pedido || "",
      cliente: pedido?.cliente_nome || "",
      vendedor: pedido?.vendedor_nome || "",
      unidade: filialAtiva || pedido?.unidade || "Matriz AJL",
      produto: prodTipo,
      produto_rotulo_pcp: produtoNome,
      maquina: maq,
      eps: eps,
      espessura_exigida: esp,
      origem_exigida: origem,
      cor_exigida: cor,
      rvm_superior: cor === "NATURAL" ? "Natural" : cor,
      quantidade_telhas: metragemTotalLinear,
      metros: qtdChapas,
      metragem_mm: metragemMm,
      metragem_planejada: metragemTotalLinear,
      variacoes_telhas: variacoesTelhasJson,
      observacoes_odoo: descTexto,
      observacoes_encarregado: "",
      foto_pedido_url: item?.foto_url || item?.imagem_url || pedido?.foto_pedido_url || extrairCroquiPedido(pedido) || "",
      trava_produto_pcp: true,
      pedido_odoo_id: pedido?.id || "",
      of_odoo_id: pedido?.of_odoo_id || "",
      of_nome: pedido?.of_nome || "",
      item_idx: item?._idx != null ? item._idx : 0,
      item_produto: produtoNome,
    }
  };
}

// Normaliza número de pedido para comparação consistente (remove '#', prefixos, espaços e símbolos)
export function normalizarNumPedido(num) {
  if (num === null || num === undefined) return "";
  return String(num)
    .replace(/^(pedido|ped|op|ordem)\s*#?/i, "")
    .replace(/^#+/, "")
    .trim()
    .toUpperCase();
}

// Compara se dois números de pedido são equivalentes
export function saoPedidosIguais(num1, num2) {
  if (!num1 || !num2) return false;
  const s1 = normalizarNumPedido(num1);
  const s2 = normalizarNumPedido(num2);
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;

  // Comparação sem pontuação ou caracteres não alfanuméricos
  const clean1 = s1.replace(/[^a-zA-Z0-9]/g, "");
  const clean2 = s2.replace(/[^a-zA-Z0-9]/g, "");
  if (clean1 && clean2 && clean1 === clean2) return true;

  // Correspondência numérica com prefixos de loja ou zeros à esquerda
  // Ex: "501006" e "1006", "001006" e "1006", "501806" e "1806"
  const digits1 = clean1.replace(/\D/g, "");
  const digits2 = clean2.replace(/\D/g, "");
  if (digits1 && digits2) {
    if (digits1 === digits2) return true;
    if (parseInt(digits1, 10) === parseInt(digits2, 10)) return true;
    const dMaior = digits1.length > digits2.length ? digits1 : digits2;
    const dMenor = digits1.length > digits2.length ? digits2 : digits1;
    // Se um termina exatamente com o outro e a diferença de dígitos for <= 3 (prefixo de filial como 50, 01, 10)
    if (dMenor.length >= 3 && dMaior.endsWith(dMenor) && (dMaior.length - dMenor.length <= 3)) {
      return true;
    }
  }

  return false;
}

/**
 * Extrai a anotação/instrução real do vendedor para um item do pedido Odoo.
 * Elimina falsos positivos onde o Odoo envia o próprio nome do produto, modelo base
 * ou variantes (ex: "(Padrão KG)", "Chapa 1,25 GV") no campo de observação.
 * Se houver anotação real (ex: "1 Chapa 1,25 GV (Padrão KG) - Teste de anotação"),
 * remove o prefixo do nome do produto e retorna apenas o texto da anotação: "Teste de anotação".
 */
export function extrairAnotacaoItem(item) {
  if (!item) return "";
  const prodRaw = stripHtml(item.produto || "").trim();
  const obsRaw = stripHtml(item.observacao || "").trim();
  const descRaw = stripHtml(item.descricao || "").trim();

  // Candidato prioritário: observacao. Se não houver, usa descricao se diferente de produto
  let texto = obsRaw || (descRaw !== prodRaw ? descRaw : "");
  if (!texto) return "";

  // Helper de canonicidade para desconsiderar acentos, pontuações, variações de código
  const canonico = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\[\d+\]/g, "")
      .replace(/^\s*\d+\s*[-–]?\s*/g, "")
      .replace(/\(padr[aã]o[^)]*\)/gi, "")
      .replace(/[^\w\d]/g, "")
      .trim();

  const cProd = canonico(prodRaw);
  const cTexto = canonico(texto);

  // Se o texto for idêntico ao produto ou vazio após normalização
  if (!cTexto || cTexto === cProd) {
    return "";
  }

  // Se for uma substring do produto com 6+ caracteres (ex: "Chapa 1,25 GV" dentro de "1 Chapa 1,25 GV (Padrão KG)")
  if (cProd && cProd.includes(cTexto) && cTexto.length >= 6) {
    return "";
  }

  // Se contiver quebras de linha e a primeira linha for apenas o nome do produto
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length > 1) {
    const primeiraLinhaCanon = canonico(linhas[0]);
    if (primeiraLinhaCanon === cProd || (cProd && cProd.includes(primeiraLinhaCanon))) {
      const resto = linhas.slice(1).join("\n").trim();
      if (resto && canonico(resto) !== cProd) {
        return resto;
      }
    }
  }

  // Se o texto começar com o nome do produto ou a versão base dele seguido de anotação:
  // Ex: "1 Chapa 1,25 GV (Padrão KG) - Teste de anotação"
  let resto = texto;
  const separadorRegex = /^[\s\-–—:;,\/]+/;

  if (prodRaw && resto.toLowerCase().startsWith(prodRaw.toLowerCase())) {
    resto = resto.slice(prodRaw.length).replace(separadorRegex, "").trim();
  } else {
    const prodBase = prodRaw
      .replace(/^\[\d+\]\s*/, "")
      .replace(/^\d+\s*[-–]\s*/, "")
      .replace(/\s*\(padr[aã]o[^)]*\)/i, "")
      .trim();

    if (prodBase && prodBase.length >= 4 && resto.toLowerCase().startsWith(prodBase.toLowerCase())) {
      resto = resto.slice(prodBase.length).replace(separadorRegex, "").trim();
    }
  }

  const cResto = canonico(resto);
  if (!cResto || cResto === cProd || (cProd && cProd.includes(cResto) && cResto.length >= 6)) {
    return "";
  }

  return resto;
}

/**
 * Retorna diagnóstico preciso do estado de execução do pedido ou OF no chão de fábrica:
 * - isConcluido: true se 100% concluído
 * - produzindoAgora: true se operador deu play e máquina está em operação ativa
 * - aguardandoInicio: true se OP já está na máquina mas aguarda play do operador
 * - pausado: true se operador pausou
 * - pendentePcp: true se ainda não foi distribuído
 */
export function obterStatusExecucaoPedido(pedido, pedidosProducao = [], ordensCD = []) {
  if (!pedido) {
    return {
      statusChave: "pendente_pcp",
      label: "Pendente",
      badgeCls: "bg-slate-100 text-slate-700",
      produzindoAgora: false,
      aguardandoInicio: false,
      isConcluido: false,
      maquinas: [],
      opsVinculadas: []
    };
  }

  const progresso = calcularProgressoRealPedido(pedido, pedidosProducao, ordensCD);
  if (progresso >= 100 || pedido.status_pcp === "concluido") {
    return {
      statusChave: "concluido",
      label: "Concluído 100%",
      badgeCls: "bg-emerald-600 text-white border-emerald-700 font-bold",
      produzindoAgora: false,
      aguardandoInicio: false,
      isConcluido: true,
      maquinas: [],
      opsVinculadas: []
    };
  }

  // 🛡️ SE O PEDIDO ESTÁ PENDENTE DE DISTRIBUIÇÃO NO PCP, ELE NUNCA ESTÁ EM PRODUÇÃO!
  if (pedido?.status_pcp === "pendente_distribuicao") {
    return {
      statusChave: "pendente_distribuicao",
      label: "Fila PCP — Aguardando Distribuição",
      badgeCls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-bold",
      produzindoAgora: false,
      aguardandoInicio: false,
      isConcluido: false,
      maquinas: [],
      opsVinculadas: []
    };
  }

  const grupoSetor = classGrupo(pedido);
  const numPed = String(pedido.numero_pedido || "").trim().toUpperCase();
  const ofId = String(pedido.of_odoo_id || pedido.odoo_id || "").trim().toUpperCase();
  const ofNome = String(pedido.of_nome || "").trim().toUpperCase();

  // ── BLINDAGEM TOTAL POR SETOR ──
  // OFs de Corte & Dobra NUNCA consultam pedidos de telhas (pedidosProducao), e Telhas NUNCA consultam ordensCD.
  const listaFonte = grupoSetor === "cd"
    ? (ordensCD || [])
    : grupoSetor === "telha"
    ? (pedidosProducao || [])
    : [...(pedidosProducao || []), ...(ordensCD || [])];

  const matchOp = (op) => {
    if (!op || op.status === "cancelado") return false;

    // Se a OP é de máquina de telha e o pedido é de C&D (ou vice-versa), BLOQUEIA IMEDIATAMENTE
    const opMaq = String(op.maquina || op.maquina_nome || "").toUpperCase();
    const opIsTelha = /(TP\s*-\s*25|TP\s*-\s*40|ONDULADA|COLONIAL|BANDEJA|CUMEEIRA|COLAGEM|TELHA)/i.test(opMaq) ||
                      /(TELHA|BOBININHA|CUMEEIRA)/i.test(String(op.produto || ""));
    const pedIsTelha = grupoSetor === "telha";
    const pedIsCd = grupoSetor === "cd";

    if (pedIsCd && opIsTelha) return false;
    if (pedIsTelha && !opIsTelha && /(DOBRADEIRA|GUILHOTINA|PERFIL|CHAPA|CORTE)/i.test(opMaq)) return false;

    if (op.pedido_odoo_id && pedido?.id) return op.pedido_odoo_id === pedido.id;
    if (ofId && op.of_odoo_id) return String(op.of_odoo_id).trim().toUpperCase() === ofId;
    if (ofNome && op.of_nome) return String(op.of_nome).trim().toUpperCase() === ofNome;
    if (op.pedido_odoo_id || op.of_odoo_id) return false;

    // Vínculo por número de pedido com validação de produto/índice
    if (op.numero_pedido && String(op.numero_pedido).trim().toUpperCase() === numPed) {
      const itens = getItens(pedido);
      if (itens && itens.length > 0) {
        return Boolean(localizarOpDoItem(itens[0], [op], itens));
      }
      return true;
    }
    return false;
  };

  const opsVinculadas = listaFonte.filter(matchOp);

  const temEmProducao = opsVinculadas.some(o => ["em_producao", "executando"].includes(o.status));
  const temPausado = opsVinculadas.some(o => o.status === "pausado");
  const temPendenteMaquina = opsVinculadas.some(o => o.status === "pendente" || Boolean(o.maquina));

  const maquinas = Array.from(new Set(opsVinculadas.map(o => o.maquina || o.maquina_nome))).filter(Boolean);

  if (temEmProducao) {
    const maqsStr = maquinas.length > 0 ? ` (${maquinas.join(", ")})` : "";
    return {
      statusChave: "produzindo_agora",
      label: `⚡ Produzindo Agora${maqsStr}`,
      badgeCls: "bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm animate-pulse font-black",
      produzindoAgora: true,
      aguardandoInicio: false,
      isConcluido: false,
      maquinas,
      opsVinculadas
    };
  }

  if (temPausado) {
    return {
      statusChave: "pausado",
      label: "⏸️ Produção Pausada",
      badgeCls: "bg-amber-600 text-white border-amber-700 font-bold",
      produzindoAgora: false,
      aguardandoInicio: false,
      isConcluido: false,
      maquinas,
      opsVinculadas
    };
  }

  // Só está na fila da máquina se de fato houver OP vinculada nesta máquina
  if (temPendenteMaquina || (opsVinculadas.length > 0 && pedido.status_pcp === "em_producao")) {
    const maqsStr = maquinas.length > 0 ? ` (${maquinas.join(", ")})` : "";
    return {
      statusChave: "aguardando_inicio",
      label: `⏳ Na Fila da Máquina${maqsStr}`,
      badgeCls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-bold",
      produzindoAgora: false,
      aguardandoInicio: true,
      isConcluido: false,
      maquinas,
      opsVinculadas
    };
  }

  if (pedido.status_pcp === "distribuido") {
    return {
      statusChave: "distribuido",
      label: "📦 Distribuído",
      badgeCls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 font-bold",
      produzindoAgora: false,
      aguardandoInicio: false,
      isConcluido: false,
      maquinas: [],
      opsVinculadas: []
    };
  }

  return {
    statusChave: "pendente_pcp",
    label: "Pendente Distribuição",
    badgeCls: "bg-slate-100 dark:bg-slate-800 text-slate-600 border-slate-300",
    produzindoAgora: false,
    aguardandoInicio: false,
    isConcluido: false,
    maquinas: [],
    opsVinculadas: []
  };
}