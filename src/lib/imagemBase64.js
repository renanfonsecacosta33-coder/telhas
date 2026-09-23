// Suporte nativo a imagens e documentos Base64 enviados pelo Odoo e integrações externas.
// Normaliza formatos, converte URLs de anexo para visualização inline e otimiza links.

const DATA_IMAGE_PREFIX = "data:image/";

/**
 * Detecta se uma URL ou string data URI representa um documento PDF.
 */
export function isPdfUrl(url) {
  if (!url || typeof url !== "string") return false;
  const s = url.trim().toLowerCase();
  return (
    s.endsWith(".pdf") ||
    s.includes(".pdf?") ||
    s.includes("format=pdf") ||
    s.startsWith("data:application/pdf") ||
    s.startsWith("jvberi0") ||
    url.trim().startsWith("JVBERi0")
  );
}

/**
 * Verifica se uma string parece ser uma imagem Base64 (com ou sem prefixo).
 */
export function isBase64Image(str) {
  if (typeof str !== "string" || !str) return false;
  const s = str.trim();
  if (s.startsWith("data:")) return true;
  if (/^(https?|ftp):\/\//i.test(s)) return false;
  const clean = s.replace(/\s+/g, "");
  if (clean.length < 64) return false;
  return /^[A-Za-z0-9+/=]+$/.test(clean);
}

/**
 * Normaliza uma string de imagem para uso direto no atributo src do <img>.
 * - Converte URLs do Odoo (/web/content/ -> /web/image/) para visualização inline
 * - Remove download=true que força download em vez de renderização
 * - Otimiza links do Google Drive para thumbnails rápidos
 * - Normaliza strings Base64 puras adicionando os magic bytes corretos
 */
export function normalizarImagemBase64(raw) {
  if (!raw) return "";
  let str = String(raw).trim();
  if (!str) return "";

  // 1. Google Drive: converte link de visualização em thumbnail ultrarrápido
  if (str.includes("drive.google.com/file/d/")) {
    const match = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
    }
  }

  // 2. URL pública HTTP/HTTPS
  if (/^https?:\/\//i.test(str)) {
    let url = str.trim();

    // Se for URL do Odoo apontando para /web/content/, converte para /web/image/
    // No Odoo, /web/content/ envia 'Content-Disposition: attachment' (download) que quebra <img>.
    // Já /web/image/ envia 'Content-Disposition: inline', permitindo exibição direta e com cache de CDN!
    if (url.includes("/web/content/")) {
      url = url.replace("/web/content/", "/web/image/");
    } else if (url.includes("/web/content?")) {
      url = url.replace("/web/content?", "/web/image?");
    }

    // Remove parâmetros que forçam download
    url = url.replace(/([?&])download=true(&|$)/, "$1").replace(/[?&]$/, "");

    return url;
  }

  // 3. Caminho relativo do Odoo
  if (str.startsWith("/web/") || str.startsWith("web/")) {
    const limpo = str.startsWith("/") ? str.slice(1) : str;
    let url = `https://ajlferroeaco.odoo.com/${limpo}`;
    if (url.includes("/web/content/")) {
      url = url.replace("/web/content/", "/web/image/");
    } else if (url.includes("/web/content?")) {
      url = url.replace("/web/content?", "/web/image?");
    }
    url = url.replace(/([?&])download=true(&|$)/, "$1").replace(/[?&]$/, "");
    return url;
  }

  // 4. Já tem prefixo data: (data:image/... ou data:application/pdf...)
  if (str.startsWith("data:")) {
    const commaIdx = str.indexOf(",");
    if (commaIdx > 0) {
      const header = str.slice(0, commaIdx);
      const b64 = str.slice(commaIdx + 1).replace(/\s+/g, "");
      return `${header},${b64}`;
    }
    return str;
  }

  // 5. Base64 puro (sem prefixo data:)
  const clean = str.replace(/\s+/g, "");
  if (clean.length >= 40 && /^[A-Za-z0-9+/=]+$/.test(clean)) {
    if (clean.startsWith("/9j/")) return `data:image/jpeg;base64,${clean}`;
    if (clean.startsWith("iVBORw0KGgo")) return `data:image/png;base64,${clean}`;
    if (clean.startsWith("R0lGOD")) return `data:image/gif;base64,${clean}`;
    if (clean.startsWith("UklGR")) return `data:image/webp;base64,${clean}`;
    if (clean.startsWith("JVBER")) return `data:application/pdf;base64,${clean}`;
    // Fallback padrão para JPEG
    return `data:image/jpeg;base64,${clean}`;
  }

  return str;
}