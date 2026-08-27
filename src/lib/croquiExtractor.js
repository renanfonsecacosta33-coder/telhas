import { normalizarImagemBase64 } from "@/lib/imagemBase64";

/**
 * Extrai a primeira imagem válida (URL ou Base64) de um pedido Odoo.
 * Procura em: foto_pedido_url, anexo_1_url, anexo_2_url e, por fallback,
 * nos anexos dos itens (itens_json -> item.anexo_1_url / anexo_2_url / foto_url).
 * Retorna uma string pronta para o atributo src do <img> (URL http, data: ou "").
 */
export function extrairCroquiPedido(pedido) {
  if (!pedido) return "";
  const campos = [
    pedido.foto_pedido_url,
    pedido.anexo_1_url,
    pedido.anexo_2_url,
    pedido.anexo_url,
    pedido.foto_url,
  ];
  for (const c of campos) {
    const src = normalizarImagemBase64(c);
    if (src) return src;
  }
  // Fallback: anexos dentro dos itens do pedido
  try {
    const itens = JSON.parse(pedido.itens_json || "[]");
    for (const it of itens) {
      for (const k of ["anexo_1_url", "anexo_2_url", "foto_url", "croqui_url"]) {
        const src = normalizarImagemBase64(it?.[k]);
        if (src) return src;
      }
    }
  } catch { /* ignore */ }
  return "";
}