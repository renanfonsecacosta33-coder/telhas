import React from "react";
import { Factory, Scissors, Wind, Layers, Ruler, ClipboardList } from "lucide-react";

// Mapeia o barracão (grupo) de cada item a cor + ícone + label.
const BARRACAO = {
  telha: {
    label: "Telhas",
    Icon: Factory,
    border: "border-l-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-300",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  },
  cd: {
    label: "Corte & Dobra",
    Icon: Scissors,
    border: "border-l-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/20",
    text: "text-sky-700 dark:text-sky-300",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  frisada: {
    label: "Frisada",
    Icon: Wind,
    border: "border-l-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/20",
    text: "text-teal-700 dark:text-teal-300",
    chip: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  },
};

function grupoDoItem(item) {
  const cat = String(item?.categoria || "").trim().toLowerCase();
  if (["telhas", "telha", "bandeja", "bobininha"].includes(cat)) return "telha";
  if (["frisadas", "frisada"].includes(cat)) return "frisada";
  return "cd";
}

// Lista cada item do pedido com cor distinta por barracão (Telhas / C&D / Frisada).
// Layout de alto contraste: quantidade GIGANTE laranja + instrução do vendedor em itálico azul.
export default function PedidoItensLista({ itensJson }) {
  let itens = [];
  try {
    const arr = JSON.parse(itensJson || "[]");
    itens = Array.isArray(arr) ? arr : [];
  } catch {
    itens = [];
  }
  if (itens.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Itens do Pedido ({itens.length})
      </span>
      <div className="flex flex-col gap-2">
        {itens.map((it, idx) => {
          const g = grupoDoItem(it);
          const cfg = BARRACAO[g] || BARRACAO.cd;
          const { Icon: BIcon } = cfg;
          const desc = it.descricao || it.produto || "Item sem descrição";
          const qtd = it.quantidade;
          const esp = it.espessura || it.chapa;

          return (
            <div
              key={idx}
              className={`flex items-center gap-2.5 rounded-lg border-l-4 ${cfg.border} ${cfg.bg} px-3 py-2`}
            >
              <BIcon className={`w-4 h-4 shrink-0 ${cfg.text}`} />
              <div className="min-w-0 flex-1">
                {/* Linha 1: Produto (negrito) + badge de barracão */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                    {it.produto || desc}
                  </p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.chip}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Linha 2: Instrução/Descrição do vendedor (itálico azul) */}
                {it.descricao && it.descricao !== it.produto && (
                  <div className="flex items-start gap-1 mt-1">
                    <ClipboardList className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                    <p className="text-xs italic text-sky-700 dark:text-sky-300 leading-snug break-words">
                      {it.descricao}
                    </p>
                  </div>
                )}

                {/* Linha 3: Espessura + Medida (destaque secundário) */}
                {(esp || it.medida) && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {esp && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        <Layers className="w-3 h-3" /> {esp}mm
                      </span>
                    )}
                    {it.medida && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        <Ruler className="w-3 h-3" /> {it.medida}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Coluna direita: QUANTIDADE GIGANTE laranja */}
              {qtd != null && (
                <div className="shrink-0 flex flex-col items-center justify-center min-w-[56px]">
                  <span className="text-2xl sm:text-3xl font-black leading-none text-orange-500 dark:text-amber-400">
                    {qtd}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-orange-600 dark:text-amber-500">
                    peças
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}