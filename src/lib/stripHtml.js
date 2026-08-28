// Remove tags HTML de uma string, retornando apenas texto puro.
// Ex: "<p>Cortar em <strong>3000mm</strong></p>" → "Cortar em 3000mm"
// Converte <br> e </p> em quebras de linha e decodifica entidades básicas.
export function stripHtml(html) {
  if (html == null) return "";
  let s = String(html);
  if (!s) return "";
  // Converte <br>, <br/>, <br /> em quebra de linha
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Converte fechamento de parágrafos e divs em quebra de linha
  s = s.replace(/<\/(p|div|li|h[1-6])>/gi, "\n");
  // Remove todas as tags restantes
  s = s.replace(/<[^>]*>/g, "");
  // Decodifica entidades HTML comuns
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&atilde;/gi, "ã")
    .replace(/&otilde;/gi, "õ")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&Ccedil;/gi, "Ç");
  // Colapsa múltiplas quebras/espaços em branco
  s = s.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  return s;
}