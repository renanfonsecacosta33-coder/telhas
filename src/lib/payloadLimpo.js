/**
 * Campos declarados como string nas entidades recusam `null` na validação
 * ("Input should be a valid string"). A forma segura de gravar é simplesmente
 * não enviar o campo quando ele está vazio.
 */
export function payloadLimpo(objeto = {}) {
  const saida = {};
  Object.entries(objeto || {}).forEach(([chave, valor]) => {
    if (valor === null || valor === undefined) return;
    saida[chave] = valor;
  });
  return saida;
}

/** Retorna a string aparada ou null (nunca número/objeto). */
export function textoOuNulo(valor) {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  return texto || null;
}