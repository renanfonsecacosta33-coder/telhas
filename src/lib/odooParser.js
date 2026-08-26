// Parser de payload de webhook Odoo → estrutura normalizada de pedido PCP
// Filtra apenas categorias industriais: Telhas, Corte e Dobra, Perfis, Frisadas, Chapas
// (descarta revendas e outros)

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

export function classificarCategoria(catRaw) {
  const cat = String(catRaw || "").trim().toLowerCase();
  return CATEGORIA_MAP[cat] || null;
}

export function isCategoriaValida(catRaw) {
  const cat = String(catRaw || "").trim().toLowerCase();
  return CATEGORIAS_VALIDAS.includes(cat);
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

    const itensRaw = Array.isArray(p.itens) ? p.itens :
      Array.isArray(p.order_line) ? p.order_line :
      Array.isArray(p.lines) ? p.lines : [];

    // Filtra apenas categorias industriais válidas
    const itens = itensRaw
      .map((it) => {
        const produto = it.produto || it.product_name || it.product || "";
        // A descrição da linha (campo 'observacao'/'name') é a instrução de corte do vendedor
        const descricao = it.observacao || it.description || it.note || it.customer_note || it.name || "";
        let espessura = it.espessura || it.thickness || "";
        if (!espessura) {
          const em = String(produto).match(/\((\d+[.,]\d+)\s*\)/);
          if (em) espessura = em[1].replace(",", ".");
        }
        return {
          categoria: it.categoria || it.category || it.product_category || "",
          produto,
          descricao,
          medida: it.medida || it.dimension || it.dimensao || "",
          espessura,
          quantidade: Number(it.quantidade || it.qty || it.quantity || it.product_uom_qty || 0)
        };
      })
      .filter((it) => isCategoriaValida(it.categoria));

    const telhaCount = itens.filter((i) => classificarCategoria(i.categoria)?.grupo === "telha").length;
    const cdCount = itens.filter((i) => classificarCategoria(i.categoria)?.grupo === "cd").length;
    const frisadaCount = itens.filter((i) => classificarCategoria(i.categoria)?.grupo === "frisada").length;

    // Espessuras distintas
    const espessuras = [...new Set(itens.map((i) => i.espessura).filter(Boolean))];

    const numero = p.numero_pedido || p.numero || p.name || p.order_name || p.number || "";
    if (!numero) continue;

    // Foto/croqui do pedido enviado pelo Odoo (anexo principal)
    const foto_pedido_url = p.foto_pedido_url || p.anexo_1_url || p.anexo_url || p.attachment_url || p.foto_url || "";

    result.push({
      odoo_id: String(p.odoo_id || p.id || ""),
      numero_pedido: String(numero),
      cliente_nome: p.cliente_nome || p.cliente || p.partner_name || p.partner_id?.[1] || "",
      vendedor_nome: p.vendedor_nome || p.vendedor || p.user_id?.[1] || p.salesman || "",
      foto_pedido_url,
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