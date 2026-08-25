// Extrai especificações técnicas (qtd, comprimento, cor) da descrição livre
// da linha do pedido Odoo (campo 'observacao' / 'name').
// Ex: "250 telhas de 3000 pré pintada em preto" → { quantidade:250, comprimento_mm:3000, comprimento_m:3, cor:"Preto", metragem_total:750 }

const CORES = [
  "preto", "branca", "branco", "vermelho", "vermelha", "cinza", "bege",
  "marrom", "verde", "azul", "grafite", "terracota", "amarelo", "natural",
  "chocolate", "tabaco", "bronze", "dourado"
];

function capitalizar(s) {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function extrairEspecificacao(texto) {
  const t = String(texto || "").toLowerCase().trim();
  const out = { quantidade: null, comprimento_mm: null, comprimento_m: null, cor: null, metragem_total: null };
  if (!t) return out;

  // Quantidade de peças: "250 telhas", "250 peças", "250x", "250 un"
  let m = t.match(/(\d+)\s*(?:telhas?|pe[çc]as?|unidades?|un\.?|pcs?\.?|x\b)/);
  if (m) out.quantidade = Number(m[1]);

  // Comprimento em mm: "3000mm", "3000 mm", "de 3000", "3000"
  m = t.match(/(\d{3,4})\s*(?:mm)?/);
  if (m) out.comprimento_mm = Number(m[1]);

  // Comprimento em metros: "3,00m", "3.00m", "3 metros"
  if (out.comprimento_mm === null) {
    m = t.match(/(\d+[.,]\d{1,2})\s*(?:m\b|metros?)/);
    if (m) out.comprimento_mm = Math.round(Number(m[1].replace(",", ".")) * 1000);
  }
  if (out.comprimento_mm) out.comprimento_m = +(out.comprimento_mm / 1000).toFixed(2);

  // Cor: "pré pintada em preto", "pintada em branco"
  m = t.match(/(?:pr[eé]\s*)?pintad[oa]s?\s+em\s+([a-zç]{3,})/);
  if (m) out.cor = m[1];
  if (!out.cor) {
    for (const c of CORES) {
      if (t.includes(c)) { out.cor = c; break; }
    }
  }
  out.cor = capitalizar(out.cor);

  // Metragem total = qtd × comprimento (m)
  if (out.quantidade && out.comprimento_m) {
    out.metragem_total = +(out.quantidade * out.comprimento_m).toFixed(2);
  }

  return out;
}

// Extrai espessura do nome do produto Odoo, ex: "Telha TP 40 (0,43) Importada" → "0.43"
export function extrairEspessuraProduto(produtoName) {
  if (!produtoName) return null;
  const m = String(produtoName).match(/\((\d+[.,]\d+)\s*\)/);
  if (m) return m[1].replace(",", ".");
  return null;
}