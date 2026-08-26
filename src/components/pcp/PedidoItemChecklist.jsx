import React from "react";
import { CheckCircle2, Circle, Layers, Ruler } from "lucide-react";
import { parseItensPedido, isItemChapa } from "@/lib/regrasFabrica";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";

// Checklist individual por item de um pedido Odoo (Rule 4 — Agrupamento).
// Exibe todos os itens agrupados no mesmo Card Mãe, cada um com checkbox de conclusão.
// onToggleItem(index) alterna o estado "concluido" do item.
export default function PedidoItemChecklist({ itensJson, onToggleItem, readOnly = false, compact = false }) {
  const itens = parseItensPedido(itensJson);
  if (itens.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        <Layers className="w-3.5 h-3.5" />
        Itens do Pedido ({itens.length})
      </div>
      {itens.map((it, idx) => {
        const done = !!it.concluido;
        const chapa = isItemChapa(it.categoria);
        return (
          <div
            key={idx}
            className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-all ${done ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"}`}
          >
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onToggleItem?.(idx)}
              className={`mt-0.5 shrink-0 ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
              title={done ? "Item concluído" : "Marcar como concluído"}
            >
              {done
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                : <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-semibold ${done ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-100"}`}>
                  {it.produto || it.descricao || `Item ${idx + 1}`}
                </span>
                {chapa && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                    CHAPA → Desbobinadora
                  </span>
                )}
                {!chapa && it.categoria && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                    {String(it.categoria).toUpperCase()} → Chapa
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                {it.medida && <span className="inline-flex items-center gap-0.5"><Ruler className="w-2.5 h-2.5" />{it.medida}</span>}
                {it.espessura && <span className="font-mono">{it.espessura}mm</span>}
                <span className="font-bold text-slate-600 dark:text-slate-300">{it.quantidade}x</span>
              </div>
              {!compact && (it.descricao || it.produto) && (
                <div className="mt-1">
                  <InstrucaoVendedorCard descricao={it.descricao || it.produto} quantidadeOdoo={it.quantidade} espessura={it.espessura} compact />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}