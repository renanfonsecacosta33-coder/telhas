// Tipos e constantes compartilhadas do Otimizador de Corte

export const CORES_PECAS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#F97316", "#EC4899", "#14B8A6", "#6366F1",
  "#84CC16", "#F43F5E", "#0EA5E9", "#A855F7", "#22C55E",
];

export function corPeca(index) {
  return CORES_PECAS[index % CORES_PECAS.length];
}

export function gerarId() {
  return Math.random().toString(36).substr(2, 9);
}