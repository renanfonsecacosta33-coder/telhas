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
  // Heurística simples para Base64 puro de imagem (sem prefixo data:)
  // - não começa com http/https/ftp (essas são URLs normais)
  // - não contém espaço
  // - comprimento razoável (mínimo de um PNG/JPEG pequeno)
  if (/^(https?|ftp):\/\//i.test(s)) return false;
  if (s.includes(" ")) return false;
  if (s.length < 64) return false;
  // Base64 válido contém apenas [A-Za-z0-9+/=]
  return /^[A-Za-z0-9+/=]+$/.test(s);
}

/**
 * Normaliza uma string de imagem para uso direto no atributo src do <img>.
 * - Se já começa com "data:image/", retorna como está.
 * - Se é uma string Base64 pura (sem prefixo), adiciona o prefixo PNG.
 * - Se é uma URL normal (http/https), retorna como está.
 * - Caso contrário (vazio/nulo), retorna "".
 */
export function normalizarImagemBase64(raw) {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";
  if (str.startsWith(DATA_IMAGE_PREFIX)) return str;
  if (isBase64Image(str)) return `data:image/png;base64,${str}`;
  return str;
}