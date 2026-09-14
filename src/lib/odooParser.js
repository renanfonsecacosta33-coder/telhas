// Parser de payload de webhook Odoo → estrutura normalizada de pedido PCP
// Filtra apenas categorias industriais: Telhas, Corte e Dobra, Perfis, Frisadas, Chapas
// (descarta revendas e outros)

import { normalizarImagemBase64 } from "@/lib/imagemBase64";
import { classGrupo } from "@/lib/pedidoOdooHelper";

const CATEGORIA_MAP = {
  // Telhas
  "telhas": { grupo: "telha", sla: 7 },
  "telha": { grupo: "telha", sla: 7 },
  "bandeja": { grupo: "telha", sla: 7 },
  "bobininha": { grupo: "telha", sla: 7 },
  // Corte e Dobra
  "corte e dobra": { grupo: "cd", sla: 5 },
  "corte_dobra": { grupo: "cd", sla: 5 },
  "corte-dobra": { grupo: "cd", sla: 5 },
  // Perfis
  "perfis": { grupo: "cd", sla: 5 },
  "perfil": { grupo: "cd", sla: 5 },
  "perfis perfilados": { grupo: "cd", sla: 5 },
  // Chapas
  "chapas": { grupo: "cd", sla: 5 },
  "chapa": { grupo: "cd", sla: 5 },
  // Frisadas
  "frisadas": { grupo: "frisada", sla: 5 },
  "frisada": { grupo: "frisada", sla: 5 }
};

const CATEGORIAS_VALIDAS = Object.keys(CATEGORIA_MAP);

export function classificarCategoria(catRaw, produtoTexto = "") {
  const cat = String(catRaw || "").trim().toLowerCase();
  if (CATEGORIA_MAP[cat]) return CATEGORIA_MAP[cat];
  const g = classGrupo(catRaw, produtoTexto);
  if (g === "telha") return { grupo: "telha", sla: 7 };
  if (g === "frisada") return { grupo: "frisada", sla: 5 };
  if (g === "cd") return { grupo: "cd", sla: 5 };
  return null;
}

export function isCategoriaValida(catRaw, produtoTexto = "") {
  return classificarCategoria(catRaw, produtoTexto) !== null;
}

// Aceita payload único (objeto) ou array de pedidos.
// Retorna sempre array de pedidos normalizados.
export function parseWebhookPayload(rawJson) {
  let data;
  try {
    data = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  } catch (e) {
    throw new Error("JSON inválido: " + e.message);
  }

  const pedidos = Array.isArray(data) ? data : [data];
  const result = [];

  for (const p of pedidos) {
    if (!p || typeof p !== "object") continue;

    let itensRaw = [];
    if (Array.isArray(p.itens)) {
      itensRaw = p.itens;
    } else if (Array.isArray(p.order_line)) {
      itensRaw = p.order_line;
    } else if (Array.isArray(p.lines)) {
      itensRaw = p.lines;
    } else if (typeof p.itens_json === "string" && p.itens_json.trim()) {
      try { itensRaw = JSON.parse(p.itens_json); } catch { itensRaw = []; }
    } else if (Array.isArray(p.itens_json)) {
      itensRaw = p.itens_json;
    }

    // Filtra apenas categorias industriais válidas (Telhas, C&D, Perfis, etc.)
    // e descarta itens explicitamente desmarcados para produção no Odoo
    const itens = itensRaw
      .filter((it) => {
        if (!it || typeof it !== "object") return false;
        if (it.fabricar === false || it.x_fabricar === false || it.a_fabricar === false || it.produzir === false) {
          return false;
        }
        return true;
      })
      .map((it) => {
        const produto = it.produto || it.product_name || it.product || "";
        // A descrição da linha (campo 'observacao'/'name') é a instrução de corte do vendedor
        const descricao = it.observacao || it.description || it.note || it.customer_note || it.name || "";
        let espessura = it.espessura || it.thickness || "";
        if (!espessura) {
          const em = String(produto).match(/\((\d+[.,]\d+)\s*\)/);
          if (em) espessura = em[1].replace(",", ".");
        }
        const imgUrl = normalizarImagemBase64(it.foto_url || it.imagem_url || it.anexo_url || it.croqui_url || it.anexo_1_url || "");
        return {
          categoria: it.categoria || it.category || it.product_category || "",
          produto,
          descricao,
          observacao: it.observacao || descricao,
          medida: it.medida || it.dimension || it.dimensao || "",
          espessura,
          quantidade: Number(it.quantidade || it.qty || it.quantity || it.product_uom_qty || 0),
          unidade: it.unidade || "UN",
          foto_url: imgUrl,
          imagem_url: imgUrl
        };
      })
      .filter((it) => isCategoriaValida(it.categoria, it.produto || it.descricao));

    const telhaCount = itens.filter((i) => classGrupo(i) === "telha").length;
    const cdCount = itens.filter((i) => classGrupo(i) === "cd").length;
    const frisadaCount = itens.filter((i) => classGrupo(i) === "frisada").length;

    // Espessuras distintas
    const espessuras = [...new Set(itens.map((i) => i.espessura).filter(Boolean))];

    const numero = p.numero_pedido || p.numero || p.name || p.order_name || p.number || "";
    if (!numero) continue;

    // Foto/croqui do pedido enviado pelo Odoo (anexo principal).
    // Normaliza strings Base64 puras adicionando o prefixo data:image/png;base64,
    // quando o Odoo envia a imagem sem o prefixo.
    const fotoRaw = p.foto_pedido_url || itens[0]?.foto_url || itens[0]?.imagem_url || p.anexo_1_url || p.anexo_2_url || p.anexo_url || p.attachment_url || p.foto_url || "";
    const foto_pedido_url = normalizarImagemBase64(fotoRaw);
    const anexo_1_url = normalizarImagemBase64(p.anexo_1_url || p.anexo_1 || p.anexo1 || p.foto_pedido_url || "");
    const anexo_2_url = normalizarImagemBase64(p.anexo_2_url || p.anexo_2 || p.anexo2 || "");

    const anexosExtras = {};
    for (let i = 1; i <= 10; i++) {
      const aVal = normalizarImagemBase64(p[`anexo_${i}_url`] || p[`anexo_${i}`] || p[`anexo${i}`] || "");
      if (aVal) anexosExtras[`anexo_${i}_url`] = aVal;
    }

    result.push({
      odoo_id: String(p.odoo_id || p.id || ""),
      of_odoo_id: String(p.of_odoo_id || p.odoo_id || p.id || ""),
      of_nome: p.of_nome || "",
      nova_of: Boolean(p.nova_of),
      numero_pedido: String(numero),
      cliente_nome: p.cliente_nome || p.cliente || p.partner_name || p.partner_id?.[1] || "",
      vendedor_nome: p.vendedor_nome || p.vendedor || p.user_id?.[1] || p.salesman || "",
      foto_pedido_url: foto_pedido_url || anexo_1_url || anexosExtras.anexo_1_url || "",
      anexo_1_url: anexo_1_url || foto_pedido_url || anexosExtras.anexo_1_url || "",
      anexo_2_url: anexo_2_url || anexosExtras.anexo_2_url || "",
      ...anexosExtras,
      identificacao_1: p.identificacao_1 || "",
      identificacao_2: p.identificacao_2 || "",
      descricao: p.descricao || "",
      data_entrega: p.data_entrega || "",
      data_recebimento: p.data_recebimento || p.date_order || new Date().toISOString(),
      unidade: p.unidade || "Matriz AJL",
      itens,
      itens_telha_count: telhaCount,
      itens_cd_count: cdCount,
      itens_frisada_count: frisadaCount,
      total_itens: itens.length,
      espessuras_tags: espessuras.map((e) => ({ espessura: e })),
      itens_json: JSON.stringify(itens)
    });
  }

  return result;
}