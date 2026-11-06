/**
 * Máquinas disponíveis por filial.
 * - Ivaiporã NÃO possui a máquina COLONIAL nas telhas.
 * - O Corte e Dobra de Ivaiporã opera somente com LASER e DOBRADEIRA 4M.
 */

export function ehIvaipora(filial) {
  const s = String(filial || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return s.includes("ivaipor");
}

export const MAQUINAS_TELHA_PADRAO = [
  "TP - 25",
  "TP - 40",
  "ONDULADA",
  "COLONIAL",
  "BANDEJA",
  "CUMEEIRA",
  "COLAGEM",
  "DESBOBINADOR",
];

export const MAQUINAS_CD_PADRAO = [
  "DESBOBINADEIRA 01",
  "DESBOBINADEIRA 02",
  "CORTE 3M",
  "CORTE 6M",
  "DOBRA 3M",
  "DOBRA FUNDO 6M",
  "DOBRA INICIO 6M",
  "PERFILADEIRA",
];

export const MAQUINAS_CD_IVAIPORA = ["LASER", "DOBRADEIRA 4M"];

export function maquinasTelhaPorFilial(filial) {
  if (ehIvaipora(filial)) return MAQUINAS_TELHA_PADRAO.filter((m) => m !== "COLONIAL");
  return [...MAQUINAS_TELHA_PADRAO];
}

export function maquinasCDPorFilial(filial) {
  if (ehIvaipora(filial)) return [...MAQUINAS_CD_IVAIPORA];
  return [...MAQUINAS_CD_PADRAO];
}