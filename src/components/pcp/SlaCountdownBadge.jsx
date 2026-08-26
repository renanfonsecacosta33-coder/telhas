import React from "react";
import { slaCountdown, slaCountdownCls } from "@/lib/regrasFabrica";

// Badge de contagem regressiva de SLA em dias úteis.
// Exibe: "⏱️ Faltam 4 dias úteis", "⚠️ Vence amanhã!", "🔴 ATRASADO 1 dia!"
export default function SlaCountdownBadge({ dataPrometida, className = "" }) {
  if (!dataPrometida) return null;
  const { texto, tom } = slaCountdown(dataPrometida);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${slaCountdownCls(tom)} ${className}`}>
      {texto}
    </span>
  );
}