import { diasUteisRestantes } from "@/lib/sla";

/**
 * Calcula o nível de urgência de um pedido com base nos dias úteis restantes
 * até a data de entrega (SLA). Retorna opacidade de vermelho para tingir o card
 * progressivamente conforme o prazo se aproxima.
 *
 * @param {string|Date} dataEntrega - Data prometida de entrega (SLA)
 * @param {object} opts
 * @param {boolean} [opts.concluido=false] - Se o pedido está 100% concluído (não tinge)
 * @returns {{opacidade:number, atrasado:boolean, dias:number}|null}
 */
export function urgenciaPrazo(dataEntrega, opts = {}) {
  if (opts.concluido) return null;
  if (!dataEntrega) return null;
  const dias = diasUteisRestantes(dataEntrega);
  if (dias == null || isNaN(dias)) return null;

  // Atrasado (dias < 0): vermelho forte + pulsante
  if (dias < 0) {
    return { opacidade: 0.38, atrasado: true, dias };
  }
  // Escala progressiva de branco -> vermelho conforme o prazo diminui
  let opacidade = 0;
  if (dias === 0) opacidade = 0.30;
  else if (dias === 1) opacidade = 0.22;
  else if (dias === 2) opacidade = 0.16;
  else if (dias <= 4) opacidade = 0.10;
  else if (dias <= 6) opacidade = 0.06;
  else opacidade = 0; // 7+ dias: sem alerta

  if (opacidade === 0) return null;
  return { opacidade, atrasado: false, dias };
}