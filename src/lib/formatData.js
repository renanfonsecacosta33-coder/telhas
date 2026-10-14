import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formata uma data vinda do banco (yyyy-MM-dd ou timestamp ISO completo)
 * sem quebrar com RangeError quando o valor é inválido ou está em formato inesperado.
 */
export function formatarDataSegura(value, formato = "dd/MM", fallback = "--/--") {
  if (!value) return fallback;
  const d = new Date(String(value).slice(0, 10) + "T12:00:00");
  if (isNaN(d.getTime())) return fallback;
  return format(d, formato, { locale: ptBR });
}