import React, { useState } from "react";
import { ChevronDown, ChevronUp, Boxes, PackageOpen } from "lucide-react";

// Grupos EXCLUSIVOS: cada pedido cai em um único grupo, então a soma sempre fecha.
const BUCKETS = [
  { key: "concluidos", label: "✅ Concluídos", cls: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800" },
  { key: "emProducao", label: "⚙️ Em Produção", cls: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800" },
  { key: "criticos", label: "🔥 Atraso Crítico >5d", cls: "bg-red-600 text-white border-red-700" },
  { key: "moderados", label: "⚠️ Atraso 1-4d", cls: "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800" },
  { key: "hojeAmanha", label: "⏳ Vence Hoje/Amanhã", cls: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800" },
  { key: "noPrazo", label: "📅 No Prazo", cls: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700" },
  { key: "semPrazo", label: "❓ Sem Prazo", cls: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 border-dashed" },
];

/**
 * Resumo executivo da Fila PCP de Telhas.
 * Mostra total de PEDIDOS x total de ITENS (um pedido pode ter vários itens),
 * a quebra por grupos exclusivos (que soma exatamente o total) e
 * a contagem de itens aguardando produção por categoria (TP - 40, TP - 25, Ondulada...).
 */
export default function ResumoFilaPCPTelhas({ analise }) {
  const [aberto, setAberto] = useState(true);
  if (!analise) return null;

  const { contadores, buckets, categorias } = analise;

  return (
    <div className="mx-4 sm:mx-6 my-2 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/70"
      >
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">
          <Boxes className="w-4 h-4 text-orange-500 shrink-0" />
          Resumo da Fila — {contadores.total} pedido(s) · {contadores.totalItens || 0} item(ns) de telha
          <span className="font-normal text-slate-400 hidden sm:inline">(grupos exclusivos: a soma sempre fecha)</span>
        </div>
        {aberto ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {aberto && (
        <div className="p-3.5 space-y-3 bg-white dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1.5">
            {BUCKETS.map(({ key, label, cls }) => (
              <div key={key} className={`flex flex-col leading-tight px-2.5 py-1 rounded-lg border text-[11px] font-bold ${cls}`}>
                <span>{label}</span>
                <span>{buckets[key].pedidos} pedidos · {buckets[key].itens} itens</span>
              </div>
            ))}
          </div>

          {categorias.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1 text-[11px] font-extrabold text-slate-600 dark:text-slate-300">
                <PackageOpen className="w-3.5 h-3.5 text-teal-500" />
                Itens aguardando por categoria:
              </span>
              {categorias.map(c => (
                <span
                  key={c.nome}
                  className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-900 text-[11px] font-bold"
                >
                  {c.nome}: {c.itens} {c.itens === 1 ? "item" : "itens"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}