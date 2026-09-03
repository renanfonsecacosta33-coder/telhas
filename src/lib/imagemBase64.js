// Suporte nativo a imagens Base64 enviadas pelo Odoo.
// O Odoo pode enviar o croqui/foto do pedido como uma string Base64 pura
// (sem o prefixo data:image/...). Este módulo normaliza para exibição no <img>.

const DATA_IMAGE_PREFIX = "data:image/";

/**
 * Verifica se uma string parece ser uma imagem Base64 (com ou sem prefixo).
 * Aceita:
 *  - "data:image/png;base64,...."
 *  - "/9j/4AAQSkZJRg..." (Base64 puro de JPEG, começa com /9j/)
 *  - "iVBORw0KGgo..." (Base64 puro de PNG, começa com iVBOR)
 */
export function isBase64Image(str) {
  if (typeof str !== "string" || !str) return false;
  const s = str.trim();
  if (s.startsWith(DATA_IMAGE_PREFIX)) return true;
  if (/^(https?|ftp):\/\//i.test(s)) return false;
  const clean = s.replace(/\s+/g, "");
  if (clean.length < 64) return false;
  return /^[A-Za-z0-9+/=]+$/.test(clean);
}

/**
 * Normaliza uma string de imagem para uso direto no atributo src do <img>.
 * - Se for URL normal (http/https), retorna como está.
 * - Se for caminho relativo do Odoo (/web/content, /web/image...), prefixa com o domínio.
 * - Se começa com "data:image/", limpa quebras e espaços e retorna pronto.
 * - Se é uma string Base64 pura (sem prefixo), identifica o MIME e monta data URI limpo.
 * - Caso contrário (vazio/nulo), retorna "".
 */
export function normalizarImagemBase64(raw) {
  if (!raw) return "";
  let str = String(raw).trim();
  if (!str) return "";

  // 1. URL pública HTTP/HTTPS
  if (/^https?:\/\//i.test(str)) {
    return str;
  }

  // 2. Caminho relativo do Odoo
  if (str.startsWith("/web/") || str.startsWith("web/")) {
    const limpo = str.startsWith("/") ? str.slice(1) : str;
    return `https://ajlferroeaco.odoo.com/${limpo}`;
  }

  // 3. Já tem data:image/... (limpa quebras MIME do Python se houver)
  if (str.startsWith(DATA_IMAGE_PREFIX)) {
    const commaIdx = str.indexOf(",");
    if (commaIdx > 0) {
      const header = str.slice(0, commaIdx);
      const b64 = str.slice(commaIdx + 1).replace(/\s+/g, "");
      return `${header},${b64}`;
    }
    return str;
  }

  // 4. Base64 puro (sem prefixo data:)
  const clean = str.replace(/\s+/g, "");
  if (clean.length >= 64 && /^[A-Za-z0-9+/=]+$/.test(clean)) {
    if (clean.startsWith("/9j/")) return `data:image/jpeg;base64,${clean}`;
    if (clean.startsWith("iVBORw0KGgo")) return `data:image/png;base64,${clean}`;
    if (clean.startsWith("R0lGOD")) return `data:image/gif;base64,${clean}`;
    if (clean.startsWith("UklGR")) return `data:image/webp;base64,${clean}`;
    return `data:image/png;base64,${clean}`;
  }

  return str;
}