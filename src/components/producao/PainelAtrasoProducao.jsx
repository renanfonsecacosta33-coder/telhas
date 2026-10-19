import React from "react";
import { Clock, AlertOctagon, AlertTriangle, CalendarX, Ruler, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Painel de análise de pedidos em atraso da Produção (Telhas).
 * Todos os números vêm da MESMA definição de atraso (atrasoPedidosHelper),
 * então sempre batem com os chips de filtro da barra.
 */
export default function PainelAtrasoProducao({
  analise,
  onVerAtrasados,
  onVerCriticos,
  onVerSemAgendamento,
  onVerKanban,
}) {
  if (!analise || (analise.vencidos === 0 && analise.semAgendamento === 0)) return null;

  const { vencidos, criticos, moderados, semAgendamento, metrosAtrasados, maiorAtrasoDias, pedidoMaisAtrasado } = analise;

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-red-900 dark:text-red-200 font-medium">
          <Clock className="w-4 h-4 text-red-600 shrink-0" />
          <span>
            <strong>{vencidos} pedido(s) em atraso</strong> ·{" "}
            {metrosAtrasados.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}m a produzir
            {maiorAtrasoDias > 0 && (
              <> · Maior atraso: <strong>{maiorAtrasoDias}d úteis</strong> {pedidoMaisAtrasado}</>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {vencidos > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onVerAtrasados}
              className="h-7 text-xs font-bold border-red-300 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Ver Pedidos Atrasados
            </Button>
          )}
          {semAgendamento > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onVerSemAgendamento}
              className="h-7 text-xs font-bold border-sky-300 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              Sem Agendamento ({semAgendamento})
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onVerKanban}
            className="h-7 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100 gap-1"
          >
            <Layers className="w-3.5 h-3.5" /> Ver no Kanban
          </Button>
        </div>
      </div>

      {(criticos > 0 || moderados > 0 || semAgendamento > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {criticos > 0 && (
            <button
              type="button"
              onClick={onVerCriticos}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white font-bold animate-pulse hover:bg-red-700"
              title="Filtrar somente atraso crítico (5+ dias úteis)"
            >
              <AlertOctagon className="w-3 h-3" /> 🔥 Críticos &gt;5d: {criticos}
            </button>
          )}
          {moderados > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 font-bold border border-red-300 dark:border-red-800">
              <AlertTriangle className="w-3 h-3" /> ⚠️ Atraso 1-4d: {moderados}
            </span>
          )}
          {semAgendamento > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-700">
              <CalendarX className="w-3 h-3" /> Sem agendamento: {semAgendamento}
            </span>
          )}
          <span className="text-red-800/70 dark:text-red-300/70 flex items-center gap-1 font-semibold">
            <Ruler className="w-3 h-3" /> Total fora do prazo: {vencidos + semAgendamento} abertos
          </span>
        </div>
      )}
    </div>
  );
}