import React from "react";
import { Calendar } from "lucide-react";
import { format } from "date-fns";

/**
 * Selo de data de entrega do card de OP na máquina.
 * Fica pulsante em vermelho quando a data prometida já passou (atrasado).
 */
export default function PedidoRowEntrega({ pedido: p }) {
  const rawData = p.data_entrega || p.data_previsao_fabrica || p.data_prevista || p.data;
  if (!rawData) return null;

  let fmt = "";
  try {
    const iso = /^\d{4}-\d{2}-\d{2}/.test(rawData) ? rawData.slice(0, 10) : "";
    fmt = iso ? format(new Date(iso + "T12:00:00"), "dd/MM/yyyy") : String(rawData);
  } catch {
    fmt = String(rawData);
  }

  const hojeIso = format(new Date(), "yyyy-MM-dd");
  const isAtrasado = /^\d{4}-\d{2}-\d{2}/.test(rawData) && rawData.slice(0, 10) < hojeIso;

  return (
    <span
      className={`text-[11px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
        isAtrasado
          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60 animate-pulse"
          : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60"
      }`}
      title={isAtrasado ? "Prazo de entrega em atraso!" : "Data prometida de entrega"}
    >
      <Calendar className="w-3 h-3" />
      Entrega: {fmt}
    </span>
  );
}