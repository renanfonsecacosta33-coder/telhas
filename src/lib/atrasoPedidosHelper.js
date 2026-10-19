import { diasUteisRestantes } from "@/lib/sla";
import { extrairDataISO } from "@/lib/filtroDataHelper";

/**
 * Fonte Única de Verdade para "atraso" de OPs de Telhas (Pedido).
 * Usada pelos contadores, pelos filtros de urgência e pelo painel de atraso,
 * garantindo que todos os números somem igualmente.
 *
 * Prazo alvo: Entrega Prometida (data_entrega) > Data Prevista > Data Programada.
 */
export function calcularAtrasoPedido(p) {
  const dataAlvo = extrairDataISO(p?.data_entrega || p?.data_prevista || p?.data);
  if (!dataAlvo) {
    return {
      temPrazo: false,
      semAgendamento: true,
      isAtrasado: false,
      isCritico: false,
      isModerado: false,
      isHojeAmanha: false,
      diasAtraso: 0,
    };
  }

  const d = diasUteisRestantes(dataAlvo);
  const isAtrasado = d < 0;
  const diasAtraso = isAtrasado ? Math.abs(d) : 0;

  return {
    temPrazo: true,
    semAgendamento: false,
    isAtrasado,
    isCritico: isAtrasado && diasAtraso >= 5,
    isModerado: isAtrasado && diasAtraso < 5,
    isHojeAmanha: !isAtrasado && d >= 0 && d <= 1,
    diasAtraso,
  };
}

/** OP aberta = ainda não finalizada nem cancelada. */
export function estaAberto(p) {
  return Boolean(p) && p.status !== "finalizado" && p.status !== "cancelado";
}