import { normalizarImagemBase64 } from "@/lib/imagemBase64";

// Mapeamento amplo de variações de nomes de campos de imagem/anexo enviados
// pelo Odoo. Suporta Anexo 1 até Anexo 10.
const CAMPOS_IMAGEM_TOP = [
  ...Array.from({ length: 10 }, (_, i) => [
    { key: `anexo_${i + 1}_base64`, label: `Anexo ${i + 1}` },
    { key: `anexo_${i + 1}_url`, label: `Anexo ${i + 1}` },
    { key: `anexo_${i + 1}`, label: `Anexo ${i + 1}` },
    { key: `anexo${i + 1}`, label: `Anexo ${i + 1}` },
  ]).flat(),
  { key: "foto_pedido_url", label: "Foto do Pedido" },
  { key: "foto_pedido", label: "Foto do Pedido" },
  { key: "anexo_url", label: "Anexo" },
  { key: "foto_url", label: "Foto" },
];

// Campos dentro de cada item do itens_json (prioriza imagem_url do novo payload Odoo)
export const CAMPOS_IMAGEM_ITEM = [
  "imagem_url",
  "anexo_1_base64",
  "anexo_1_url",
  "anexo_1",
  "anexo1",
  "anexo_2_base64",
  "anexo_2_url",
  "anexo_2",
  "anexo2",
  "foto_url",
  "croqui_url",
  "foto_pedido_url"
];

/**
 * Extrai o croqui/imagem específico de um item do pedido.
 */
export function extrairCroquiItem(item) {
  if (!item) return "";
  for (const k of CAMPOS_IMAGEM_ITEM) {
    const src = normalizarImagemBase64(item[k]);
    if (src) return src;
  }
  return "";
}

/**
 * Extrai a primeira imagem válida (URL ou Base64) de um pedido Odoo.
 * Procura em todas as variações de campos de anexo/foto (anexo_1 a anexo_10,
 * foto_pedido_url, imagens_anexos) e, por fallback, nos anexos dos itens (itens_json).
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
    const itens = typeof pedido.itens_json === "string" ? JSON.parse(pedido.itens_json || "[]") : (pedido.itens || []);
    for (const it of itens) {
      const src = extrairCroquiItem(it);
      if (src) return { src, origem: it.produto || "Anexo Item" };
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
 * Extrai a lista de anexos de croqui do pedido (Anexo 1 até Anexo 10).
 * Cada item: { src, label }.
 *
 * Prioriza Data URIs limpos (Base64) ou URLs públicas prontas.
 */
export function extrairAnexosLista(pedido) {
  if (!pedido) return [];
  const anexos = [];

  // 1. Varre de Anexo 1 a Anexo 10
  for (let i = 1; i <= 10; i++) {
    const keys = [
      `anexo_${i}_base64`,
      `anexo${i}_base64`,
      `anexo_${i}_url`,
      `anexo${i}_url`,
      `anexo_${i}`,
      `anexo${i}`
    ];
    if (i === 1) {
      keys.push("foto_pedido_url", "foto_pedido", "croqui_url", "foto_url");
    }
    let src = "";
    // Procura primeiro por Base64 real (data: ou Base64 puro)
    for (const k of keys) {
      const val = pedido[k];
      if (val && typeof val === "string" && val.trim()) {
        const norm = normalizarImagemBase64(val);
        if (norm && norm.startsWith("data:")) {
          src = norm;
          break;
        }
      }
    }
    // Depois procura por URL
    if (!src) {
      for (const k of keys) {
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
    if (src && !anexos.some(a => a.src === src)) {
      anexos.push({ src, label: `Anexo ${i}` });
    }
  }

  // 2. Se ainda não encontrou anexos, tenta buscar dentro de itens_json
  if (anexos.length === 0) {
    try {
      const itens = typeof pedido.itens_json === "string" ? JSON.parse(pedido.itens_json || "[]") : (pedido.itens || []);
      for (const it of itens) {
        const src = extrairCroquiItem(it);
        if (src && !anexos.some(a => a.src === src)) {
          anexos.push({ src, label: it.produto || "Anexo Item" });
        }
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