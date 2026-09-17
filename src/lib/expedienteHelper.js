import { format } from "date-fns";

/**
 * Regras de Expediente da Fábrica AJL:
 * - Segunda a Sexta:
 *   - Turno Manhã: 08:00 às 12:00
 *   - Intervalo Almoço: 12:00 às 13:00 (Ociosidade permitida/sem alarme)
 *   - Turno Tarde: 13:00 às 18:00
 *   - Fora do Expediente (antes das 08h, após às 18h e finais de semana)
 * - Tolerância de máquina parada: 3 minutos (180 segundos)
 */
export const TOLERANCIA_OCIOSIDADE_SEG = 180; // 3 minutos

export function getStatusExpediente(now = new Date()) {
  const diaSemana = now.getDay(); // 0 = Domingo, 6 = Sábado
  const isFimDeSemana = diaSemana === 0 || diaSemana === 6;

  if (isFimDeSemana) {
    return {
      emExpediente: false,
      emAlmoco: false,
      foraExpediente: true,
      label: "Fim de Semana (Fábrica Fechada)"
    };
  }

  const hora = now.getHours();
  const min = now.getMinutes();
  const minutosDia = hora * 60 + min;

  const inicioManha = 8 * 60;   // 08:00 = 480
  const fimManha = 12 * 60;      // 12:00 = 720
  const inicioTarde = 13 * 60;   // 13:00 = 780
  const fimTarde = 18 * 60;      // 18:00 = 1080

  if (minutosDia >= inicioManha && minutosDia < fimManha) {
    return {
      emExpediente: true,
      emAlmoco: false,
      foraExpediente: false,
      label: "Turno Manhã (08h às 12h)"
    };
  }

  if (minutosDia >= fimManha && minutosDia < inicioTarde) {
    return {
      emExpediente: false,
      emAlmoco: true,
      foraExpediente: false,
      label: "Almoço (12h às 13h)"
    };
  }

  if (minutosDia >= inicioTarde && minutosDia < fimTarde) {
    return {
      emExpediente: true,
      emAlmoco: false,
      foraExpediente: false,
      label: "Turno Tarde (13h às 18h)"
    };
  }

  return {
    emExpediente: false,
    emAlmoco: false,
    foraExpediente: true,
    label: "Fora do Expediente (Encerramento às 18h)"
  };
}

export function isHorarioExpediente(now = new Date()) {
  return getStatusExpediente(now).emExpediente;
}
