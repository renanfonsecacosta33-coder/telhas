import React from "react";

// Tabela de Identificação das Chapas por Cores
// Mapeia espessura (mm) → cor pintada na chapa
const TABELA_CORES = {
  // VERDE
  0.80: { cor: "#28a745", nome: "Verde" },
  0.85: { cor: "#28a745", nome: "Verde" },
  3.75: { cor: "#28a745", nome: "Verde" },
  // VERMELHO
  0.90: { cor: "#dc3545", nome: "Vermelho" },
  0.95: { cor: "#dc3545", nome: "Vermelho" },
  6.30: { cor: "#dc3545", nome: "Vermelho" },
  // PRETO
  1.11: { cor: "#1a1a1a", nome: "Preto" },
  // AMARELO
  1.20: { cor: "#ffc107", nome: "Amarelo" },
  1.25: { cor: "#ffc107", nome: "Amarelo" },
  9.50: { cor: "#ffc107", nome: "Amarelo" },
  // AZUL
  1.50: { cor: "#007bff", nome: "Azul" },
  1.55: { cor: "#007bff", nome: "Azul" },
  2.65: { cor: "#007bff", nome: "Azul" },
  2.70: { cor: "#007bff", nome: "Azul" },
  // ROSA
  1.80: { cor: "#e83e8c", nome: "Rosa" },
  1.95: { cor: "#e83e8c", nome: "Rosa" },
  2.00: { cor: "#e83e8c", nome: "Rosa" },
  // BRANCA
  2.25: { cor: "#ffffff", nome: "Branca" },
  2.30: { cor: "#ffffff", nome: "Branca" },
  // LARANJA
  3.00: { cor: "#fd7e14", nome: "Laranja" },
  // MARROM
  4.25: { cor: "#8b4513", nome: "Marrom" },
  // DOURADA
  4.75: { cor: "#ffd700", nome: "Dourada" },
  // S/COR
  8.00: { cor: "transparent", nome: "S/ Cor" },
};

export function parseEspessura(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return valor;
  const str = String(valor).replace(",", ".").trim();
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

export function getCorChapa(espessura) {
  const n = parseEspessura(espessura);
  if (n === null) return null;
  if (TABELA_CORES[n]) return TABELA_CORES[n];
  const arredondado = Math.round(n * 100) / 100;
  return TABELA_CORES[arredondado] || null;
}

// Tenta extrair espessura de um texto descritivo (ex: "CH0001 — TE0001 Branco 0,43 1200mm")
export function extractEspessuraFromDesc(desc) {
  if (!desc) return null;
  const matches = [...String(desc).matchAll(/(\d+[,.]\d{1,2})/g)];
  for (const m of matches) {
    const n = parseEspessura(m[1]);
    if (n !== null && n >= 0.30 && n <= 10.00) {
      // Filtra valores que claramente não são espessura (ex: 1200mm de largura)
      return n;
    }
  }
  return null;
}

export default function CorChapaDot({ espessura, size = "sm", className = "" }) {
  const cor = getCorChapa(espessura);
  if (!cor) return null;

  const sizes = {
    xs: "w-2.5 h-2.5",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const isTransparent = cor.cor === "transparent";
  const isWhite = cor.cor === "#ffffff";

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      title={`Cor da chapa: ${cor.nome} (${espessura}mm)`}
    >
      <span
        className={`${sizes[size] || sizes.sm} rounded-full inline-block flex-shrink-0 ${
          isTransparent
            ? "border-2 border-dashed border-gray-400"
            : isWhite
              ? "border-2 border-gray-400 shadow-sm"
              : "border border-black/15 shadow-sm"
        }`}
        style={isTransparent ? {} : { backgroundColor: cor.cor }}
      />
    </span>
  );
}