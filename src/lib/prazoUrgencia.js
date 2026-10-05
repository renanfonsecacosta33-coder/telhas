import { diasUteisRestantes } from "@/lib/sla";

/**
 * Calcula o nível de urgência de um pedido com base nos dias úteis restantes
 * até a data de entrega (SLA).
 * Retorna classes visuais de borda lateral esquerda (4px) e badge pulsante,
 * mantendo o fundo do card limpo e 100% legível.
 *
 * @param {string|Date} dataEntrega - Data prometida de entrega (SLA)
 * @param {object} opts
 * @param {boolean} [opts.concluido=false] - Se o pedido está 100% concluído
 * @returns {{atrasado:boolean, urgente?:boolean, atencao?:boolean, dias:number, badgeTexto:string, borderLeftClass:string, ringClass:string, badgeClass:string}|null}
 */
export function urgenciaPrazo(dataEntrega, opts = {}) {
  if (opts.concluido) return null;
  if (!dataEntrega) return null;
  const dias = diasUteisRestantes(dataEntrega);
  if (dias == null || isNaN(dias)) return null;

  // Atrasado (dias < 0): Borda lateral vermelha viva 4px + badge pulsante
  if (dias < 0) {
    const atraso = Math.abs(dias);
    return {
      atrasado: true,
      urgente: true,
      dias,
      badgeTexto: `ATRASADO ${atraso} dia${atraso > 1 ? "s" : ""}!`,
      borderLeftClass: "border-l-4 border-l-red-600 dark:border-l-red-500",
      ringClass: "ring-1 ring-red-400/40 border-red-300 dark:border-red-900/50",
      badgeClass: "bg-red-600 text-white font-black animate-pulse shadow-xs border-red-700"
    };
  }

  // Vence Hoje: Borda âmbar/laranja 4px + badge pulsante
  if (dias === 0) {
    return {
      atrasado: false,
      urgente: true,
      dias: 0,
      badgeTexto: "VENCE HOJE!",
      borderLeftClass: "border-l-4 border-l-amber-500 dark:border-l-amber-400",
      ringClass: "ring-1 ring-amber-400/40 border-amber-300 dark:border-amber-900/50",
      badgeClass: "bg-amber-600 text-white font-bold animate-pulse shadow-xs border-amber-700"
    };
  }

  // Vence Amanhã (1 dia): Borda âmbar 4px
  if (dias === 1) {
    return {
      atrasado: false,
      urgente: true,
      dias: 1,
      badgeTexto: "Vence Amanhã",
      borderLeftClass: "border-l-4 border-l-amber-500",
      ringClass: "border-amber-300 dark:border-amber-800",
      badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold border-amber-300"
    };
  }

  // 2 a 3 dias úteis: Borda lateral sutil de atenção
  if (dias <= 3) {
    return {
      atrasado: false,
      atencao: true,
      dias,
      badgeTexto: `Prazo: ${dias} dias úteis`,
      borderLeftClass: "border-l-2 border-l-amber-400/80",
      ringClass: "",
      badgeClass: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200"
    };
  }

  return null;
}