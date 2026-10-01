import React from "react";
import { slaCountdown, slaCountdownCls } from "@/lib/regrasFabrica";

// Badge de contagem regressiva de SLA em dias úteis.
// Exibe: "⏱️ Faltam 4 dias úteis", "⚠️ Vence amanhã!", "🔴 ATRASADO 1 dia!"
// Quanto mais perto do prazo, mais forte e chamativo fica o badge.
export default function SlaCountdownBadge({ dataPrometida, dataPrevisaoFabrica, className = "" }) {
  const dataAlvo = dataPrevisaoFabrica || dataPrometida;
  if (!dataAlvo) return null;
  const { texto, tom, dias } = slaCountdown(dataAlvo);
  const urgente = tom === "atrasado" || tom === "hoje" || tom === "amanha";
  const proximo = typeof dias === "number" && dias >= 0 && dias <= 2;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border font-extrabold tracking-tight ${slaCountdownCls(tom)} ${
          urgente ? "text-sm animate-pulse shadow-sm" : proximo ? "text-xs" : "text-[11px]"
        } ${className}`}
      >
        {texto}
      </span>
      {dataPrevisaoFabrica && (
        <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 bg-orange-100/80 dark:bg-orange-950/50 px-1.5 py-0.5 rounded border border-orange-300 dark:border-orange-800">
          Prazo Fábrica Ajustado
        </span>
      )}
    </div>
  );
}