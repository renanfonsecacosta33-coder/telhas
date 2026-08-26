import React from "react";
import { Brain, AlertTriangle, TrendingUp, Gauge } from "lucide-react";
import { avaliarCapacidade, formatarPeso, CAPACIDADE_DIARIA_KG } from "@/lib/regrasFabrica";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// IA Assistente de Capacidade Diária (KG / Toneladas)
// Avalia o peso agendado do dia vs capacidade e exibe recomendação.
export default function CapacidadeDiariaIA({ ordens, dataISO, capacidade = CAPACIDADE_DIARIA_KG, novoPesoKg = 0, className = "" }) {
  const aval = avaliarCapacidade(ordens, dataISO, capacidade);
  const pesoComNovo = aval.pesoAtual + (Number(novoPesoKg) || 0);
  const excedComNovo = Math.max(0, pesoComNovo - capacidade);
  const vaiExceder = excedComNovo > 0;
  const percentualComNovo = capacidade > 0 ? Math.round((pesoComNovo / capacidade) * 100) : 0;

  const dataLabel = dataISO
    ? format(new Date(dataISO + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })
    : "hoje";

  return (
    <div className={`rounded-xl border ${vaiExceder ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30" : "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30"} p-3 ${className}`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${vaiExceder ? "bg-red-500/15" : "bg-blue-500/15"}`}>
          {vaiExceder ? <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" /> : <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5" /> IA Capacidade — {dataLabel}
            </span>
            <span className={`text-[11px] font-bold ${percentualComNovo >= 100 ? "text-red-600" : percentualComNovo >= 80 ? "text-amber-600" : "text-emerald-600"}`}>
              {percentualComNovo}%
            </span>
          </div>

          {/* Barra de capacidade */}
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all ${percentualComNovo >= 100 ? "bg-red-500" : percentualComNovo >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, percentualComNovo)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
            {formatarPeso(pesoComNovo)} <span className="text-slate-400">/ {formatarPeso(capacidade)}</span> agendados
          </p>

          {vaiExceder ? (
            <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-red-700 dark:text-red-300 font-medium">
              <TrendingUp className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                <strong>Capacidade excedida em {formatarPeso(excedComNovo)}.</strong> A IA recomenda agendar o peso excedente para o próximo dia útil.
              </span>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
              ✓ Capacidade disponível: {formatarPeso(capacidade - pesoComNovo)} restantes
            </p>
          )}
        </div>
      </div>
    </div>
  );
}