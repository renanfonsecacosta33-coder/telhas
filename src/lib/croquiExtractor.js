import { normalizarImagemBase64 } from "@/lib/imagemBase64";

// Mapeamento amplo de variações de nomes de campos de imagem/anexo enviados
// pelo Odoo. Ordem de prioridade: Anexo 1 primeiro, depois Anexo 2, depois foto.
const CAMPOS_IMAGEM_TOP = [
  { key: "anexo_1_base64", label: "Anexo 1" },
  { key: "anexo_1_url", label: "Anexo 1" },
  { key: "anexo_1", label: "Anexo 1" },
  { key: "anexo1", label: "Anexo 1" },
  { key: "anexo_2_base64", label: "Anexo 2" },
  { key: "anexo_2_url", label: "Anexo 2" },
  { key: "anexo_2", label: "Anexo 2" },
  { key: "anexo2", label: "Anexo 2" },
  { key: "foto_pedido_url", label: "Foto do Pedido" },
  { key: "foto_pedido", label: "Foto do Pedido" },
  { key: "anexo_url", label: "Anexo" },
  { key: "foto_url", label: "Foto" },
];

// Campos dentro de cada item do itens_json
const CAMPOS_IMAGEM_ITEM = ["anexo_1_base64", "anexo_1_url", "anexo_1", "anexo1", "anexo_2_base64", "anexo_2_url", "anexo_2", "anexo2", "foto_url", "croqui_url", "foto_pedido_url"];

/**
 * Extrai a primeira imagem válida (URL ou Base64) de um pedido Odoo.
 * Procura em todas as variações de campos de anexo/foto (anexo_1, anexo_2,
 * anexo1, anexo2, anexo_1_url, anexo_2_url, foto_pedido_url, foto_pedido,
 * imagens_anexos) e, por fallback, nos anexos dos itens (itens_json).
 *
 * Retorna { src, origem } onde:
 *  - src: string pronta para o atributo src do <img> (URL http, data: ou "")
 *  - origem: rótulo legível da origem ("Anexo 1", "Anexo 2", "Foto do Pedido"...)
 */
export function extrairCroquiPedidoInfo(pedido) {
  if (!pedido) return { src: "", origem: "" };

  // 1. Campos diretos do objeto do pedido (todas as variações)
  for (const { key, label } of CAMPOS_IMAGEM_TOP) {
    const raw = pedido[key];
    const src = normalizarImagemBase64(raw);
    if (src) return { src, origem: label };
  }

  // 2. imagens_anexos — pode ser array de strings, array de {url}, ou JSON string
  const anexos = pedido.imagens_anexos;
  if (anexos) {
    let lista = anexos;
    if (typeof anexos === "string") {
      try { lista = JSON.parse(anexos); } catch { lista = null; }
    }
    if (Array.isArray(lista)) {
      for (const item of lista) {
        const raw = typeof item === "string" ? item : (item?.url || item?.anexo_1_url || item?.src || item?.foto_url);
        const src = normalizarImagemBase64(raw);
        if (src) return { src, origem: "Anexo" };
      }
    } else if (typeof lista === "string") {
      const src = normalizarImagemBase64(lista);
      if (src) return { src, origem: "Anexo" };
    }
  }

  // 3. Fallback: anexos dentro dos itens do pedido (itens_json)
  try {
    const itens = JSON.parse(pedido.itens_json || "[]");
    for (const it of itens) {
      for (const k of CAMPOS_IMAGEM_ITEM) {
        const src = normalizarImagemBase64(it?.[k]);
        if (src) return { src, origem: k.startsWith("anexo_2") || k === "anexo2" ? "Anexo 2" : "Anexo 1" };
      }
    }
  } catch { /* ignore */ }

  return { src: "", origem: "" };
}

/**
 * Compatibilidade: retorna apenas a string src (sem info de origem).
 */
export function extrairCroquiPedido(pedido) {
  return extrairCroquiPedidoInfo(pedido).src;
}

/**
 * Extrai a lista de anexos de croqui do pedido (Anexo 1 e Anexo 2).
 * Cada item: { src, label }.
 *
 * Prioriza Data URIs limpos (Base64) ou URLs públicas prontas.
 */
export function extrairAnexosLista(pedido) {
  if (!pedido) return [];
  const grupos = [
    {
      label: "Anexo 1",
      keys: [
        "anexo_1_base64", "anexo1_base64", "anexo_1_url", "anexo1_url",
        "anexo_1", "anexo1", "foto_pedido_url", "foto_pedido", "croqui_url", "foto_url"
      ]
    },
    {
      label: "Anexo 2",
      keys: [
        "anexo_2_base64", "anexo2_base64", "anexo_2_url", "anexo2_url",
        "anexo_2", "anexo2"
      ]
    },
  ];
  const anexos = [];
  for (const g of grupos) {
    let src = "";
    // 1. Procura primeiro por Base64 real (começa com data: ou Base64 puro)
    for (const k of g.keys) {
      const val = pedido[k];
      if (val && typeof val === "string" && val.trim()) {
        const norm = normalizarImagemBase64(val);
        if (norm && norm.startsWith("data:")) {
          src = norm;
          break;
        }
      }
    }
    // 2. Se não achou data URI, procura por qualquer URL pública válida
    if (!src) {
      for (const k of g.keys) {
        const val = pedido[k];
        if (val && typeof val === "string" && val.trim()) {
          const norm = normalizarImagemBase64(val);
          if (norm) {
            src = norm;
            break;
          }
        }
      }
    }

    if (src) anexos.push({ src, label: g.label });
  }

  // Se ainda não encontrou anexos, tenta buscar dentro de itens_json
  if (anexos.length === 0) {
    try {
      const itens = JSON.parse(pedido.itens_json || "[]");
      for (const it of itens) {
        const a1 = normalizarImagemBase64(it.anexo_1_base64 || it.anexo_1_url || it.anexo_1 || it.foto_url || it.croqui_url);
        const a2 = normalizarImagemBase64(it.anexo_2_base64 || it.anexo_2_url || it.anexo_2);
        if (a1 && !anexos.some(a => a.src === a1)) anexos.push({ src: a1, label: "Anexo 1" });
        if (a2 && !anexos.some(a => a.src === a2)) anexos.push({ src: a2, label: "Anexo 2" });
      }
    } catch { /* ignore */ }
  }

  return anexos;
}

// Campos que podem conter um Base64 puro para fallback de onError.
const CAMPOS_BASE64 = ["anexo_1_base64", "anexo_2_base64", "anexo_1", "anexo_2"];

/**
 * Retorna um Data URI pronto para <img> construído a partir de qualquer
 * campo Base64 bruto presente no pedido (anexo_1_base64, anexo_2_base64...).
 * Usado como fallback quando a URL externa do Odoo falha ao carregar.
 */
export function extrairBase64Fallback(pedido) {
  if (!pedido) return "";
  for (const key of CAMPOS_BASE64) {
    const raw = pedido[key];
    if (typeof raw === "string" && raw.trim()) {
      const src = normalizarImagemBase64(raw);
      if (src.startsWith("data:image/")) return src;
    }
  }
  return "";
}