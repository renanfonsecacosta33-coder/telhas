/**
 * Texto EXATO do item como chegou do Odoo na Central PCP.
 * Regra inviolável: nunca reescrever, resumir, cortar código nem redetectar —
 * o operador na máquina tem que ler exatamente o mesmo que o PCP leu.
 * Ex.: "1493 - Telha Bandeja (0,43) importada (Padrão - MT)"
 */
export function descricaoItemOriginal(pedido) {
  if (!pedido) return "";
  const bruto = String(pedido.item_produto || "").replace(/\s+/g, " ").trim();
  if (bruto) return bruto;
  // OP criada manualmente (sem vínculo Odoo): usa o rótulo digitado
  return [pedido.produto, pedido.modelo].filter(Boolean).join(" ").trim();
}

/**
 * Espessura exatamente como escrita no item do PCP (ex.: "0,43").
 * Usa o texto original quando existir, para não exibir "0.43" no chão de fábrica.
 */
export function espessuraOriginalItem(pedido) {
  if (!pedido) return "";
  const texto = descricaoItemOriginal(pedido);
  const noTexto = texto.match(/\((\d+[,.]\d+)\)/);
  if (noTexto) return noTexto[1].replace(".", ",");
  return String(pedido.espessura_exigida || "").replace(".", ",");
}