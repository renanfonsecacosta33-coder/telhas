/**
 * Helper utilitário puro e isolado para normalização e comparação de números de pedidos e OFs.
 * ATENÇÃO: NÃO importe outros módulos ou entidades neste arquivo para garantir que não haja
 * dependências circulares nem TDZ (Temporal Dead Zone) no bundle de produção.
 */

/**
 * Normaliza o número de pedido para comparação resiliente:
 * Remove prefixos como '#', 'SO-', 'S0', 'S', zeros à esquerda e caracteres não numéricos.
 * Exemplo: '#S01493' -> '1493', 'SO-283427' -> '283427', '1493' -> '1493'
 */
export function normalizarNumeroPedido(num) {
  if (!num) return "";
  const s = String(num).trim().toUpperCase();
  const semPrefixo = s.replace(/^(SO[-_\s]*|S0*|#)/i, "");
  const semZeros = semPrefixo.replace(/^0+/, "");
  const digitos = semZeros.replace(/\D/g, "");
  return digitos || semZeros || s;
}

export default normalizarNumeroPedido;
