import React from "react";
import { slaCountdown, slaCountdownCls } from "@/lib/regrasFabrica";

// Badge de contagem regressiva de SLA em dias úteis.
// Exibe: "⏱️ Faltam 4 dias úteis", "⚠️ Vence amanhã!", "🔴 ATRASADO 1 dia!"
// Quanto mais perto do prazo, mais forte e chamativo fica o badge.
export default function SlaCountdownBadge({ dataPrometida, className = "" }) {
  if (!dataPrometida) return null;
  const { texto, tom, dias } = slaCountdown(dataPrometida);
  const urgente = tom === "atrasado" || tom === "hoje" || tom === "amanha";
  const proximo = typeof dias === "number" && dias >= 0 && dias <= 2;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-extrabold tracking-tight ${slaCountdownCls(tom)} ${
        urgente ? "text-sm animate-pulse shadow-sm" : proximo ? "text-xs" : "text-[11px]"
      } ${className}`}
    >
      {texto}
    </span>
  );
}