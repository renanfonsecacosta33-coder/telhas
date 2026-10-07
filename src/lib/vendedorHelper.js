import { normalizarImagemBase64 } from "@/lib/imagemBase64";
import { extrairAnexosLista } from "@/lib/croquiExtractor";
import { getItens, classGrupo } from "@/lib/pedidoOdooHelper";

/**
 * Normaliza nomes para correspondência sem case-sensitive e sem acentos
 */
export function normalizarNome(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Identifica se dois nomes de vendedores correspondem
 */
export function nomesCorrespondem(nomeA, nomeB) {
  const a = normalizarNome(nomeA);
  const b = normalizarNome(nomeB);
  if (!a || !b) return false;
  if (a === b) return true;
  // Se um nome contém o outro (ex: "Renan Fonseca" contém "Renan")
  const partesA = a.split(/\s+/);
  const partesB = b.split(/\s+/);
  if (partesA[0] === partesB[0] && (partesA.length === 1 || partesB.length === 1)) {
    return true;
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
  const idOdoo = String(pedidoOdoo.id || "").trim();

  // 1. Ordens de fábrica relacionadas a este pedido
  const ordensTelhasDoPedido = ordensTelhas.filter(o =>
    (numPed && String(o.numero_pedido || "").trim() === numPed) ||
    (idOdoo && String(o.pedido_odoo_id || "").trim() === idOdoo)
  );

  const opsCDDoPedido = [
    ...opsDesbob.filter(o => numPed && String(o.numero_pedido || "").trim() === numPed),
    ...opsMaquinaCD.filter(o => numPed && String(o.numero_pedido || "").trim() === numPed)
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
  const temCarregamento = allOrdens.some(o => o.status_expedicao === "expedido" || o.foto_carregamento_url);
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

  // 3. Galeria de Fotos Organizada por Etapa
  const croquisOdoo = extrairAnexosLista(pedidoOdoo).map((a, idx) => ({
    url: a.src,
    titulo: a.label || `Croqui ${idx + 1}`,
    etapa: "croqui",
    origem: "Odoo ERP"
  }));

  const fotosEtiqueta = [];
  const fotosProducao = [];
  const fotosColagem = [];
  const fotosCarregamento = [];

  allOrdens.forEach(o => {
    // Foto de Etiqueta
    if (o.foto_etiqueta_url) {
      fotosEtiqueta.push({
        url: o.foto_etiqueta_url,
        titulo: `Etiqueta · ${o.maquina || "Máquina"}`,
        etapa: "etiqueta",
        origem: o.operador ? `Op: ${o.operador}` : "Fábrica"
      });
    }
    // Foto de Produção / Finalização
    if (o.foto_finalizacao_url) {
      fotosProducao.push({
        url: o.foto_finalizacao_url,
        titulo: `Perfilação · ${o.maquina || "Máquina"}`,
        etapa: "producao",
        origem: o.operador ? `Op: ${o.operador}` : "Fábrica"
      });
    }
    if (o.foto_pedido_url && !fotosProducao.some(f => f.url === o.foto_pedido_url)) {
      fotosProducao.push({
        url: o.foto_pedido_url,
        titulo: `Registro da Peça · ${o.maquina || "Fábrica"}`,
        etapa: "producao",
        origem: "Fábrica"
      });
    }
    // Foto de Colagem EPS
    if (o.foto_colagem_eps_url) {
      fotosColagem.push({
        url: o.foto_colagem_eps_url,
        titulo: "Colagem EPS / Termoacústica",
        etapa: "colagem",
        origem: o.operador ? `Op: ${o.operador}` : "Setor de Colagem"
      });
    }
    // Foto de Carregamento / Expedição
    if (o.foto_carregamento_url) {
      fotosCarregamento.push({
        url: o.foto_carregamento_url,
        titulo: "Carregamento no Caminhão",
        etapa: "carregamento",
        origem: "Expedição"
      });
    }
  });

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
