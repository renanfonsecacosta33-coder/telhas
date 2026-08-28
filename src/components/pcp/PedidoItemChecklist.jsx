import React from "react";
import { CheckCircle2, Circle, Layers, Ruler, ClipboardList } from "lucide-react";
import { parseItensPedido, isItemChapa } from "@/lib/regrasFabrica";
import { stripHtml } from "@/lib/stripHtml";

// Checklist individual por item de um pedido Odoo (Rule 4 — Agrupamento).
// Exibe todos os itens agrupados no mesmo Card Mãe, cada um com checkbox de conclusão.
// Layout de alto contraste: quantidade GIGANTE laranja + instrução do vendedor em itálico azul.
// onToggleItem(index) alterna o estado "concluido" do item.
export default function PedidoItemChecklist({ itensJson, onToggleItem, readOnly = false, compact = false }) {
  const itens = parseItensPedido(itensJson);
  if (itens.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        <Layers className="w-3.5 h-3.5" />
        Itens do Pedido ({itens.length})
      </div>
      {itens.map((it, idx) => {
        const done = !!it.concluido;
        const chapa = isItemChapa(it.categoria);
        const descricao = stripHtml(it.descricao || it.produto || "");
        const produtoLimpo = stripHtml(it.produto);
        const obs = stripHtml(it.observacao || "");
        const qtd = it.quantidade;

        return (
          <div
            key={idx}
            className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 transition-all ${done ? "border-emerald-400 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"}`}
          >
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onToggleItem?.(idx)}
              className={`mt-1 shrink-0 ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
              title={done ? "Item concluído" : "Marcar como concluído"}
            >
              {done
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                : <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />}
            </button>

            <div className="min-w-0 flex-1">
              {/* Linha 1: Produto (negrito) + badges de roteamento */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-sm font-extrabold leading-tight ${done ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                  {stripHtml(it.produto) || descricao || `Item ${idx + 1}`}
                </span>
                {chapa && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                    CHAPA → Desbob.
                  </span>
                )}
                {!chapa && it.categoria && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                    {String(it.categoria).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Observação do item (itálico azul) — só se diferente do produto */}
              {obs && obs !== produtoLimpo && (
                <div className="flex items-start gap-1 mt-1">
                  <ClipboardList className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-xs italic text-sky-700 dark:text-sky-300 leading-snug break-words">
                    {obs}
                  </p>
                </div>
              )}

              {/* Linha 2: Instrução/Descrição do vendedor (itálico azul) */}
              {descricao && descricao !== stripHtml(it.produto) && (
                <div className="flex items-start gap-1 mt-1">
                  <ClipboardList className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-xs italic text-sky-700 dark:text-sky-300 leading-snug break-words">
                    {descricao}
                  </p>
                </div>
              )}

              {/* Linha 3: Espessura + Medida (destaque secundário) */}
              {(it.espessura || it.medida) && (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {it.espessura && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      <Layers className="w-3 h-3" /> {it.espessura}mm
                    </span>
                  )}
                  {it.medida && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                      <Ruler className="w-3 h-3" /> {it.medida}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Coluna direita: QUANTIDADE GIGANTE laranja */}
            {qtd != null && (
              <div className="shrink-0 flex flex-col items-center justify-center min-w-[64px]">
                <span className={`text-2xl sm:text-3xl font-black leading-none ${done ? "text-slate-300 dark:text-slate-600" : "text-orange-500 dark:text-amber-400"}`}>
                  {qtd}
                </span>
                <span className={`text-[9px] font-bold uppercase tracking-wide ${done ? "text-slate-400" : "text-orange-600 dark:text-amber-500"}`}>
                  peças
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}