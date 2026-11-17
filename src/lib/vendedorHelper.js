import { normalizarImagemBase64 } from "@/lib/imagemBase64";
import { extrairAnexosLista } from "@/lib/croquiExtractor";
import { getItens, classGrupo } from "@/lib/pedidoOdooHelper";
import { normalizarNumeroPedido } from "@/lib/normalizacaoPedidoHelper";

/**
 * Normaliza nomes para correspondência sem case-sensitive, sem acentos,
 * removendo domínios de email e pontuações (pontos, traços, sublinhados)
 * Ex: "adriano.klabunde@ajlferroeaco.com.br" -> "adriano klabunde"
 * Ex: "adriano.klabunde" -> "adriano klabunde"
 * Ex: "Adriano Klabunde" -> "adriano klabunde"
 */
export function normalizarNome(str) {
  if (!str) return "";
  let limpo = String(str).trim();
  // Se for e-mail, extrai a parte antes do @
  if (limpo.includes("@")) {
    limpo = limpo.split("@")[0];
  }
  return limpo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Identifica se dois nomes de vendedores correspondem com máxima tolerância
 * Trata variações de username (com ponto/underline), nomes abreviados,
 * primeiro nome, sobrenome compartilhado ou emails.
 */
export function nomesCorrespondem(nomeA, nomeB) {
  const a = normalizarNome(nomeA);
  const b = normalizarNome(nomeB);
  if (!a || !b) return false;
  if (a === b) return true;

  const partesA = a.split(/\s+/).filter(Boolean);
  const partesB = b.split(/\s+/).filter(Boolean);

  // 1. Se o primeiro nome bater e um dos lados tiver apenas 1 palavra (ex: "Adriano" e "Adriano Klabunde")
  if (partesA[0] === partesB[0] && (partesA.length === 1 || partesB.length === 1)) {
    return true;
  }

  // 2. Se primeiro nome e último nome baterem (ex: "Adriano Silva Klabunde" e "Adriano Klabunde")
  if (partesA.length >= 2 && partesB.length >= 2) {
    if (partesA[0] === partesB[0] && partesA[partesA.length - 1] === partesB[partesB.length - 1]) {
      return true;
    }
  }

  // 3. Substring de palavra significativa (mínimo 4 caracteres)
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a];
  if (menor.length >= 4) {
    // Verifica se contém como palavra delimitada
    const regex = new RegExp(`(^|\\s)${menor.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(\\s|$)`, "i");
    if (regex.test(maior)) {
      return true;
    }
  }

  return false;
}

/**
 * Consolida dados operacionais, fotos seguras, bobinas e histórico do pedido
 * cruzando PedidoOdoo com ordens de chão de fábrica (telhas e corte & dobra)
 */
export function consolidarPedidoParaVendedor(pedidoOdoo, ordensTelhas = [], opsDesbob = [], opsMaquinaCD = [], todasBobinas = []) {
  if (!pedidoOdoo) return null;

  const numPed = String(pedidoOdoo.numero_pedido || "").trim();
  const numPedNorm = normalizarNumeroPedido(numPed);
  const idOdoo = String(pedidoOdoo.id || "").trim();
  const odooId = String(pedidoOdoo.odoo_id || "").trim();
  const ofIdOdoo = String(pedidoOdoo.of_odoo_id || "").trim().toUpperCase();
  const ofNomeOdoo = String(pedidoOdoo.of_nome || "").trim().toUpperCase();

  // Função resiliente de correspondência entre Odoo ERP e ordens de fábrica
  const matchPedido = (o) => {
    if (!o) return false;
    const opPedId = String(o.pedido_odoo_id || o.pedido_id || "").trim();
    if (idOdoo && opPedId && (opPedId === idOdoo || (odooId && opPedId === odooId))) return true;

    const opOfId = String(o.of_odoo_id || "").trim().toUpperCase();
    if (ofIdOdoo && opOfId && opOfId === ofIdOdoo) return true;

    const opOfNome = String(o.of_nome || "").trim().toUpperCase();
    if (ofNomeOdoo && opOfNome && opOfNome === ofNomeOdoo) return true;

    const opNum = String(o.numero_pedido || "").trim();
    if (numPed && opNum && opNum.toUpperCase() === numPed.toUpperCase()) return true;

    const opNumNorm = normalizarNumeroPedido(opNum);
    if (numPedNorm && opNumNorm && opNumNorm === numPedNorm) return true;

    return false;
  };

  // 1. Ordens de fábrica relacionadas a este pedido
  const ordensTelhasDoPedido = ordensTelhas.filter(matchPedido);
  const opsCDDoPedido = [
    ...opsDesbob.filter(matchPedido),
    ...opsMaquinaCD.filter(matchPedido)
  ];

  const itens = getItens(pedidoOdoo);
  const setorTipo = classGrupo(pedidoOdoo) === "cd" ? "Corte e Dobra" : "Telhas";

  // 2. Apuração do Status Operacional em Tempo Real
  let statusOperacional = {
    chave: "aguardando_pcp",
    label: "Aguardando PCP",
    sublabel: "Aguardando programação fabril",
    maquina: null,
    operador: null,
    tipo: "pendente"
  };

  const allOrdens = [...ordensTelhasDoPedido, ...opsCDDoPedido];

  // Verifica se já foi expedido / carregado
  const temCarregamento = allOrdens.some(o => o.status_expedicao === "expedido" || o.foto_carregamento_url) || Boolean(pedidoOdoo.foto_carregamento_url);
  const allFinalizado = allOrdens.length > 0 && allOrdens.every(o => o.status === "finalizado" || o.status === "cancelado");
  const anyProduzindoAgora = allOrdens.find(o => o.produzindo_agora || o.status === "em_producao");
  const anyColagem = ordensTelhasDoPedido.find(o => o.status === "aguardando_colagem" || o.maquina === "COLAGEM");
  const anyFilaMaquina = allOrdens.find(o => o.status === "pendente" || o.status === "aguardando_corte" || !o.produzindo_agora);

  if (temCarregamento) {
    statusOperacional = {
      chave: "em_transito",
      label: "🚚 Carregado / Em Trânsito",
      sublabel: "Carga liberada na expedição",
      tipo: "sucesso"
    };
  } else if (pedidoOdoo.status_pcp === "concluido" || allFinalizado) {
    statusOperacional = {
      chave: "pronto_patio",
      label: "📦 Pronto no Pátio",
      sublabel: "Finalizado, aguardando carregamento",
      tipo: "sucesso"
    };
  } else if (anyColagem) {
    statusOperacional = {
      chave: "colagem",
      label: "🥪 Em Colagem / Termoacústica",
      sublabel: "Perfilação pronta, aplicando EPS e cola",
      maquina: "COLAGEM",
      operador: anyColagem.operador || anyColagem.operador_nome || null,
      tipo: "producao"
    };
  } else if (anyProduzindoAgora) {
    const maq = anyProduzindoAgora.maquina || anyProduzindoAgora.maquina_inicial || "Máquina";
    const opNome = anyProduzindoAgora.operador || anyProduzindoAgora.operador_nome || anyProduzindoAgora.operadores_nomes || null;
    statusOperacional = {
      chave: "produzindo",
      label: `⚡ Produzindo Agora na ${maq}`,
      sublabel: opNome ? `Operador: ${opNome}` : "Produção em andamento na máquina",
      maquina: maq,
      operador: opNome,
      tipo: "producao_ativa"
    };
  } else if (pedidoOdoo.status_pcp === "distribuido" || allOrdens.length > 0) {
    const maqAlvo = allOrdens[0]?.maquina || allOrdens[0]?.maquina_inicial || "Máquina";
    statusOperacional = {
      chave: "fila_maquina",
      label: `📋 Na Fila da ${maqAlvo}`,
      sublabel: "Ordem enviada para a fábrica, aguardando início",
      maquina: maqAlvo,
      tipo: "alerta"
    };
  } else {
    statusOperacional = {
      chave: "aguardando_pcp",
      label: "⏳ Aguardando PCP",
      sublabel: "Ordem recebida no sistema, aguardando liberação do PCP",
      tipo: "pendente"
    };
  }

  // 3. Galeria de Fotos Organizada por Etapa (Consolidação Rigorosa e Auditável)
  const croquisOdoo = extrairAnexosLista(pedidoOdoo).map((a, idx) => ({
    url: a.src,
    titulo: a.label || `Croqui ${idx + 1}`,
    etapa: "croqui",
    origem: "Odoo ERP"
  }));

  const urlsAdicionadas = new Set();
  croquisOdoo.forEach(c => {
    if (c.url) urlsAdicionadas.add(String(c.url).trim());
  });

  const fotosEtiqueta = [];
  const fotosProducao = [];
  const fotosColagem = [];
  const fotosCarregamento = [];

  const registrarFoto = (lista, { url, titulo, etapa, origem }) => {
    if (!url || typeof url !== "string") return;
    const cleanUrl = url.trim();
    if (!cleanUrl || cleanUrl === "null" || cleanUrl === "undefined" || urlsAdicionadas.has(cleanUrl)) return;
    urlsAdicionadas.add(cleanUrl);
    lista.push({
      url: cleanUrl,
      titulo: titulo || "Registro Fotográfico",
      etapa: etapa || "producao",
      origem: origem || "Fábrica"
    });
  };

  allOrdens.forEach(o => {
    const maq = o.maquina || o.maquina_inicial || "Máquina";
    const opNome = o.operador || o.operador_nome || o.operadores_nomes || null;
    const origemOp = opNome ? `Op: ${opNome}` : "Fábrica";

    // 3.1. Fotos de Etiqueta (Bobina / Pacote de Chapas)
    if (o.foto_etiqueta_url) {
      registrarFoto(fotosEtiqueta, {
        url: o.foto_etiqueta_url,
        titulo: `Etiqueta · ${maq}`,
        etapa: "etiqueta",
        origem: origemOp
      });
    }
    if (o.foto_etiqueta_bobina_url) {
      registrarFoto(fotosEtiqueta, {
        url: o.foto_etiqueta_bobina_url,
        titulo: `Etiqueta Bobina · ${maq}`,
        etapa: "etiqueta",
        origem: origemOp
      });
    }
    if (o.foto_etiqueta_chapa_url) {
      registrarFoto(fotosEtiqueta, {
        url: o.foto_etiqueta_chapa_url,
        titulo: `Etiqueta Chapa · ${maq}`,
        etapa: "etiqueta",
        origem: origemOp
      });
    }

    // 3.2. Fotos de Colagem EPS & Termoacústica
    if (o.foto_colagem_eps_url) {
      registrarFoto(fotosColagem, {
        url: o.foto_colagem_eps_url,
        titulo: "Colagem EPS / Termoacústica",
        etapa: "colagem",
        origem: origemOp
      });
    }
    if (o.foto_eps_url) {
      registrarFoto(fotosColagem, {
        url: o.foto_eps_url,
        titulo: "Corte / Bloco EPS",
        etapa: "colagem",
        origem: "Setor de EPS"
      });
    }

    // 3.3. Fotos de Carregamento & Expedição
    if (o.foto_carregamento_url) {
      registrarFoto(fotosCarregamento, {
        url: o.foto_carregamento_url,
        titulo: "Carregamento no Caminhão",
        etapa: "carregamento",
        origem: "Expedição"
      });
    }

    // 3.4. Fotos de Produção, Perfilação e Conclusão das Peças
    if (o.foto_finalizacao_url) {
      registrarFoto(fotosProducao, {
        url: o.foto_finalizacao_url,
        titulo: `Perfilação Final · ${maq}`,
        etapa: "producao",
        origem: origemOp
      });
    }
    if (o.foto_etapa1_url) {
      registrarFoto(fotosProducao, {
        url: o.foto_etapa1_url,
        titulo: `Telha Superior / Perfilação · ${maq}`,
        etapa: "producao",
        origem: origemOp
      });
    }
    if (o.foto_etapa2_url) {
      registrarFoto(fotosProducao, {
        url: o.foto_etapa2_url,
        titulo: `Bandeja Inferior · ${maq}`,
        etapa: "producao",
        origem: origemOp
      });
    }
    if (o.foto_pedido_url) {
      registrarFoto(fotosProducao, {
        url: o.foto_pedido_url,
        titulo: `Registro da Peça · ${maq}`,
        etapa: "producao",
        origem: origemOp
      });
    }
    if (o.foto_material_url) {
      registrarFoto(fotosProducao, {
        url: o.foto_material_url,
        titulo: `Material / Chapa · ${maq}`,
        etapa: "producao",
        origem: origemOp
      });
    }
    if (o.retrabalho_foto_1_url) {
      registrarFoto(fotosProducao, {
        url: o.retrabalho_foto_1_url,
        titulo: `Inspeção Técnica / Ajuste 1 · ${maq}`,
        etapa: "producao",
        origem: "Controle de Qualidade"
      });
    }
    if (o.retrabalho_foto_2_url) {
      registrarFoto(fotosProducao, {
        url: o.retrabalho_foto_2_url,
        titulo: `Inspeção Técnica / Ajuste 2 · ${maq}`,
        etapa: "producao",
        origem: "Controle de Qualidade"
      });
    }

    // 3.5. Variações de itens dentro da OP (fotos individuais de cada variação/lote)
    try {
      const vars = typeof o.variacoes_telhas === "string" ? JSON.parse(o.variacoes_telhas) : o.variacoes_telhas;
      if (Array.isArray(vars)) {
        vars.forEach((v, idx) => {
          const descItem = v.comprimento ? `${v.comprimento}mm` : (v.label || `Item ${idx + 1}`);
          if (v.foto_item_url) {
            registrarFoto(fotosProducao, {
              url: v.foto_item_url,
              titulo: `Peça ${descItem} · ${maq}`,
              etapa: "producao",
              origem: origemOp
            });
          }
          if (v.foto_etapa1_url) {
            registrarFoto(fotosProducao, {
              url: v.foto_etapa1_url,
              titulo: `Telha Sup. ${descItem} · ${maq}`,
              etapa: "producao",
              origem: origemOp
            });
          }
          if (v.foto_etapa2_url) {
            registrarFoto(fotosProducao, {
              url: v.foto_etapa2_url,
              titulo: `Bandeja ${descItem} · ${maq}`,
              etapa: "producao",
              origem: origemOp
            });
          }
        });
      }
    } catch {}

    // 3.6. Histórico de alterações com fotos anexadas
    try {
      const hist = typeof o.historico_alteracoes === "string" ? JSON.parse(o.historico_alteracoes) : o.historico_alteracoes;
      if (Array.isArray(hist)) {
        hist.forEach((h) => {
          const fotoH = h.foto_url || h.foto || h.imagem_url;
          if (fotoH) {
            registrarFoto(fotosProducao, {
              url: fotoH,
              titulo: `Apontamento: ${h.acao || h.descricao || "Produção"}`,
              etapa: "producao",
              origem: h.operador || origemOp
            });
          }
        });
      }
    } catch {}
  });

  // 3.7. Fotos registradas diretamente no Pedido Odoo
  if (pedidoOdoo.foto_carregamento_url) {
    registrarFoto(fotosCarregamento, {
      url: pedidoOdoo.foto_carregamento_url,
      titulo: "Carregamento no Caminhão",
      etapa: "carregamento",
      origem: "Expedição"
    });
  }
  if (pedidoOdoo.foto_colagem_eps_url) {
    registrarFoto(fotosColagem, {
      url: pedidoOdoo.foto_colagem_eps_url,
      titulo: "Colagem EPS / Termoacústica",
      etapa: "colagem",
      origem: "Setor de Colagem"
    });
  }
  if (pedidoOdoo.foto_finalizacao_url) {
    registrarFoto(fotosProducao, {
      url: pedidoOdoo.foto_finalizacao_url,
      titulo: "Produção Concluída",
      etapa: "producao",
      origem: "Fábrica"
    });
  }
  if (pedidoOdoo.foto_pedido_url) {
    registrarFoto(fotosProducao, {
      url: pedidoOdoo.foto_pedido_url,
      titulo: "Registro do Pedido",
      etapa: "producao",
      origem: "Fábrica"
    });
  }

  // 3.8. Itens do Pedido Odoo com foto
  if (Array.isArray(itens)) {
    itens.forEach((it, idx) => {
      const fotoItem = it.foto_url || it.foto_finalizacao_url || it.foto;
      if (fotoItem) {
        registrarFoto(fotosProducao, {
          url: fotoItem,
          titulo: `Item: ${it.produto || `Peça #${idx + 1}`}`,
          etapa: "producao",
          origem: "Fábrica"
        });
      }
    });
  }

  // 4. Bobinas Utilizadas (SIGILO TOTAL: NENHUMA INFORMAÇÃO DE NF OU CUSTO)
  const bobinasIdsEncontrados = new Set();
  const bobinasUtilizadas = [];

  const registrarBobina = (bobIdOrCod) => {
    if (!bobIdOrCod || bobinasIdsEncontrados.has(String(bobIdOrCod))) return;
    bobinasIdsEncontrados.add(String(bobIdOrCod));

    const bobinaObj = todasBobinas.find(b =>
      b.id === bobIdOrCod ||
      b.codigo === bobIdOrCod ||
      (b.codigo && String(bobIdOrCod).toUpperCase().includes(String(b.codigo).toUpperCase()))
    );

    if (bobinaObj) {
      bobinasUtilizadas.push({
        codigo: bobinaObj.codigo || String(bobIdOrCod),
        cor: bobinaObj.cor || "Padrão",
        espessura: bobinaObj.espessura_utilizada || bobinaObj.espessura_real || bobinaObj.chapa || "—",
        origem: bobinaObj.origem || "Nacional",
        qualidade: bobinaObj.qualidade || "GV",
        largura: bobinaObj.largura_mm ? `${bobinaObj.largura_mm} mm` : null,
        // SEGURANÇA ABSOLUTA: custo, custo_total, nf e fornecedor NÃO são incluídos aqui!
      });
    } else {
      bobinasUtilizadas.push({
        codigo: String(bobIdOrCod),
        cor: "Conforme OP",
        espessura: "—",
        origem: "Nacional",
        qualidade: "GV",
        largura: null
      });
    }
  };

  ordensTelhasDoPedido.forEach(o => {
    if (o.bobina_superior_id) registrarBobina(o.bobina_superior_id);
    if (o.bobina_superior && o.bobina_superior !== o.bobina_superior_id) registrarBobina(o.bobina_superior);
    if (o.bobina_inferior_id) registrarBobina(o.bobina_inferior_id);
    if (o.bobina_inferior && o.bobina_inferior !== o.bobina_inferior_id) registrarBobina(o.bobina_inferior);
    try {
      const vars = typeof o.variacoes_telhas === "string" ? JSON.parse(o.variacoes_telhas || "[]") : (o.variacoes_telhas || []);
      vars.forEach(v => {
        if (v.bobina_id) registrarBobina(v.bobina_id);
        if (v.bobina_codigo) registrarBobina(v.bobina_codigo);
        if (v.bobina_inf_id) registrarBobina(v.bobina_inf_id);
      });
    } catch {}
  });

  opsCDDoPedido.forEach(o => {
    if (o.bobina_id) registrarBobina(o.bobina_id);
    if (o.bobina_codigo) registrarBobina(o.bobina_codigo);
    if (o.bobina_utilizada) registrarBobina(o.bobina_utilizada);
  });

  // 5. Histórico Cronológico
  const historico = [];

  if (pedidoOdoo.data_recebimento) {
    historico.push({
      data: pedidoOdoo.data_recebimento,
      titulo: "Pedido Recebido do Odoo ERP",
      descricao: `Pedido #${numPed} integrado com sucesso para o cliente ${pedidoOdoo.cliente_nome || "—"}.`,
      tipo: "odoo"
    });
  }

  if (pedidoOdoo.status_pcp === "distribuido" || allOrdens.length > 0) {
    const dataRoteamento = allOrdens[0]?.created_date || allOrdens[0]?.data || pedidoOdoo.data_recebimento;
    historico.push({
      data: dataRoteamento,
      titulo: "Ordem Programada pelo PCP",
      descricao: `Pedido roteado para produção (${setorTipo}).`,
      tipo: "pcp"
    });
  }

  if (pedidoOdoo.motivo_alteracao_prazo) {
    historico.push({
      data: pedidoOdoo.data_alteracao_prazo || new Date().toISOString(),
      titulo: "Prazo Fabril Reprogramado",
      descricao: `Nova previsão: ${pedidoOdoo.data_previsao_fabrica || "—"}. Motivo: ${pedidoOdoo.motivo_alteracao_prazo}`,
      tipo: "aviso"
    });
  }

  allOrdens.forEach(o => {
    if (o.inicio_producao_ts) {
      historico.push({
        data: o.inicio_producao_ts,
        titulo: `Início de Produção na ${o.maquina || "Máquina"}`,
        descricao: o.operador ? `Operador: ${o.operador}` : "Operador iniciou a fabricação.",
        tipo: "maquina"
      });
    }
    if (o.data_finalizacao || o.fim_producao_ts) {
      historico.push({
        data: o.fim_producao_ts || o.data_finalizacao,
        titulo: `Peças Concluídas na ${o.maquina || "Máquina"}`,
        descricao: `Fabricação finalizada. Foto anexada.`,
        tipo: "conclusao"
      });
    }
    if (o.foto_carregamento_url) {
      historico.push({
        data: o.data_carregamento || new Date().toISOString(),
        titulo: "Carregamento e Expedição",
        descricao: "Material carregado para transporte e entrega.",
        tipo: "expedicao"
      });
    }
  });

  historico.sort((a, b) => new Date(a.data || 0).getTime() - new Date(b.data || 0).getTime());

  // 6. Cálculo do Percentual
  let pct = Number(pedidoOdoo.percentual_concluido || 0);
  if (pct === 0 && allOrdens.length > 0) {
    const finalizadas = allOrdens.filter(o => o.status === "finalizado").length;
    pct = Math.round((finalizadas / allOrdens.length) * 100);
  }
  if (statusOperacional.chave === "pronto_patio" || statusOperacional.chave === "em_transito") {
    pct = 100;
  }

  // 5. Tempo de produção acumulado das OPs do pedido (para o cronômetro do vendedor)
  const agoraMs = Date.now();
  let segProdutivo = 0;
  let segPausa = 0;
  let rodandoAgora = false;
  allOrdens.forEach(o => {
    if (o.status === "cancelado") return;
    segProdutivo += Number(o.tempo_producao_seg) || 0;
    segPausa += Number(o.tempo_pausa_seg) || 0;
    if (o.status === "em_producao" && o.inicio_producao_ts) {
      const inicio = new Date(o.inicio_producao_ts).getTime();
      if (!isNaN(inicio)) segProdutivo += Math.max(0, Math.floor((agoraMs - inicio) / 1000));
      rodandoAgora = true;
    }
    if (o.status === "pausado" && o.inicio_pausa_ts) {
      const inicio = new Date(o.inicio_pausa_ts).getTime();
      if (!isNaN(inicio)) segPausa += Math.max(0, Math.floor((agoraMs - inicio) / 1000));
    }
  });
  const tempoProducao = {
    seg: segProdutivo,
    segPausa,
    rodando: rodandoAgora,
    emPausa: allOrdens.some(o => o.status === "pausado"),
    temDados: allOrdens.some(o => o.tempo_producao_seg || o.inicio_producao_ts || o.status === "em_producao"),
  };

  return {
    id: pedidoOdoo.id,
    odoo_id: pedidoOdoo.odoo_id,
    of_odoo_id: pedidoOdoo.of_odoo_id,
    of_nome: pedidoOdoo.of_nome,
    numero_pedido: numPed,
    cliente: pedidoOdoo.cliente_nome || "—",
    vendedor: pedidoOdoo.vendedor_nome || "—",
    unidade: pedidoOdoo.unidade || "Matriz AJL",
    setor: setorTipo,
    data_recebimento: pedidoOdoo.data_recebimento,
    data_entrega: pedidoOdoo.data_entrega,
    data_prevista: pedidoOdoo.data_previsao_fabrica || pedidoOdoo.data_entrega,
    motivo_alteracao_prazo: pedidoOdoo.motivo_alteracao_prazo,
    status_pcp: pedidoOdoo.status_pcp,
    percentual: pct,
    statusOperacional,
    tempoProducao,
    itens,
    total_itens: itens.length,
    descricao: pedidoOdoo.descricao || (itens.length > 0 ? `${itens[0]?.quantidade || 1}x ${itens[0]?.produto || "Telha / Perfil"}` : "Ordem Industrial"),
    fotos: {
      croquis: croquisOdoo,
      etiquetas: fotosEtiqueta,
      producao: fotosProducao,
      colagem: fotosColagem,
      carregamento: fotosCarregamento,
      total: croquisOdoo.length + fotosEtiqueta.length + fotosProducao.length + fotosColagem.length + fotosCarregamento.length
    },
    bobinasUtilizadas,
    historico,
    ordensFabrica: allOrdens,
    pedido_original: pedidoOdoo
  };
}

/**
 * Monta mensagem de texto profissional formatada para WhatsApp do Cliente
 */
export function gerarMensagemWhatsApp(card) {
  if (!card) return "";
  const saudacao = "Olá!";
  const num = card.numero_pedido ? `#${card.numero_pedido}` : "";
  const cliente = card.cliente && card.cliente !== "—" ? ` *${card.cliente}*` : "";
  const status = card.statusOperacional?.label || "Em andamento";
  const pct = card.percentual || 0;
  const previsao = card.data_prevista
    ? new Date(card.data_prevista).toLocaleDateString("pt-BR")
    : "Em definição";

  let msg = `${saudacao}${cliente ? ` Prezado(a)${cliente},` : ""}\n\n`;
  msg += `Aqui está a atualização do seu Pedido ${num} na *AJL Ferro & Aço*:\n\n`;
  msg += `📌 *Status Atual:* ${status}\n`;
  msg += `📊 *Progresso da Produção:* ${pct}%\n`;
  msg += `📅 *Previsão de Entrega:* ${previsao}\n\n`;

  if (card.bobinasUtilizadas && card.bobinasUtilizadas.length > 0) {
    const bob = card.bobinasUtilizadas[0];
    msg += `🔩 *Material:* Aço ${bob.origem || "Nacional"} · Chapa ${bob.espessura} · ${bob.cor}\n\n`;
  }

  msg += `Estamos à disposição para qualquer dúvida!\n*AJL Ferro & Aço*`;
  return msg;
}