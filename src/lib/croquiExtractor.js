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
 * Força a construção de um Data URI (`data:image/png;base64,...`) a partir de
 * qualquer string Base64 bruta enviada pelo Odoo. Remove prefixos `data:`
 * existentes, quebras de linha e espaços que inviabilizam a renderização no
 * <img>. Retorna "" se a string não contiver Base64 utilizável.
 */
function forcarDataUriBase64(raw) {
  if (!raw || typeof raw !== "string") return "";
  let s = raw.trim();
  if (!s) return "";
  // Remove prefixo data:image/...;base64, se já existir
  if (s.startsWith("data:")) {
    const idx = s.indexOf("base64,");
    if (idx >= 0) s = s.slice(idx + 7).trim();
  }
  // Remove quebras de linha e espaços internos que quebram o Base64
  s = s.replace(/\s+/g, "");
  if (!s || s.length < 64) return "";
  // Valida caracteres Base64
  if (!/^[A-Za-z0-9+/=]+$/.test(s)) return "";
  return `data:image/png;base64,${s}`;
}

// Verifica se uma string é uma URL interna do Odoo (relativa /web/content, /web/image...)
// que exigiria sessão logada no Odoo para carregar.
function ehUrlOdooInterna(str) {
  if (typeof str !== "string") return false;
  const s = str.trim();
  if (!s) return false;
  // Já é data: URI ou URL http(s) absoluta → não é interna
  if (s.startsWith("data:")) return false;
  if (/^https?:\/\//i.test(s)) return false;
  // Caminhos relativos do Odoo: /web/content/... /web/image/...
  return s.startsWith("/web/") || s.startsWith("web/");
}

/**
 * Extrai a lista de anexos de croqui do pedido (Anexo 1 e Anexo 2).
 * Cada item: { src, fallback, label }.
 *
 * Prioriza o Base64 (anexo_x_base64) — renderiza imediatamente sem exigir
 * login no Odoo. Se só houver URL externa http, usa-a (com fallback Base64 no
 * onError). URLs internas do Odoo (/web/content/...) são ignoradas quando não
 * há Base64 correspondente, pois exigiriam sessão logada.
 */
export function extrairAnexosLista(pedido) {
  if (!pedido) return [];
  const grupos = [
    {
      label: "Anexo 1",
      base64Keys: ["anexo_1_base64", "anexo1_base64", "anexo_1", "anexo1"],
      urlKeys: ["anexo_1_url", "anexo1_url", "anexo_1", "anexo1", "foto_pedido_url", "foto_pedido", "croqui_url", "foto_url"]
    },
    {
      label: "Anexo 2",
      base64Keys: ["anexo_2_base64", "anexo2_base64", "anexo_2", "anexo2"],
      urlKeys: ["anexo_2_url", "anexo2_url", "anexo_2", "anexo2"]
    },
  ];
  const anexos = [];
  for (const g of grupos) {
    const base64Raw = g.base64Keys.map((k) => pedido[k]).find((v) => v);
    const base64Forcado = forcarDataUriBase64(base64Raw);
    const urlRaw = g.urlKeys.map((k) => pedido[k]).find((v) => v);
    const urlSrc = normalizarImagemBase64(urlRaw);

    let src = "";
    let fallback = "";
    if (base64Forcado) {
      src = base64Forcado;
    } else if (urlSrc) {
      src = urlSrc;
    }
    if (base64Forcado && src !== base64Forcado) fallback = base64Forcado;

    if (src) anexos.push({ src, fallback, label: g.label });
  }

  // Se ainda não encontrou anexos, tenta buscar dentro de itens_json
  if (anexos.length === 0) {
    try {
      const itens = JSON.parse(pedido.itens_json || "[]");
      for (const it of itens) {
        const a1 = normalizarImagemBase64(it.anexo_1_url || it.anexo_1 || it.foto_url || it.croqui_url);
        const a2 = normalizarImagemBase64(it.anexo_2_url || it.anexo_2);
        if (a1 && !anexos.some(a => a.src === a1)) anexos.push({ src: a1, fallback: "", label: "Anexo 1" });
        if (a2 && !anexos.some(a => a.src === a2)) anexos.push({ src: a2, fallback: "", label: "Anexo 2" });
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