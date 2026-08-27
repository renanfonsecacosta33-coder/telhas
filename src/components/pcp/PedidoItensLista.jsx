import React from "react";
import { Factory, Scissors, Wind, Package, CheckCircle2, Circle, Clock } from "lucide-react";

// Mapeia o barracão (grupo) de cada item a cor + ícone + label.
const BARRACAO = {
  telha: {
    label: "Telhas",
    Icon: Factory,
    border: "border-l-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    text: "text-orange-700 dark:text-orange-300",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    dot: "bg-orange-500",
  },
  cd: {
    label: "Corte & Dobra",
    Icon: Scissors,
    border: "border-l-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/20",
    text: "text-sky-700 dark:text-sky-300",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    dot: "bg-sky-500",
  },
  frisada: {
    label: "Frisada",
    Icon: Wind,
    border: "border-l-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/20",
    text: "text-teal-700 dark:text-teal-300",
    chip: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
    dot: "bg-teal-500",
  },
};

function grupoDoItem(item) {
  const cat = String(item?.categoria || "").trim().toLowerCase();
  if (["telhas", "telha", "bandeja", "bobininha"].includes(cat)) return "telha";
  if (["frisadas", "frisada"].includes(cat)) return "frisada";
  return "cd";
}

const STATUS_ICON = {
  concluido: { Icon: CheckCircle2, cls: "text-emerald-500" },
  em_producao: { Icon: Clock, cls: "text-amber-500" },
  pendente: { Icon: Circle, cls: "text-slate-300 dark:text-slate-600" },
};

// Lista cada item do pedido com cor distinta por barracão (Telhas / C&D / Frisada).
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
      <div className="flex flex-col gap-1.5">
        {itens.map((it, idx) => {
          const g = grupoDoItem(it);
          const cfg = BARRACAO[g] || BARRACAO.cd;
          const { Icon: BIcon } = cfg;
          const stKey = it.status || "pendente";
          const StIcon = STATUS_ICON[stKey] || STATUS_ICON.pendente;
          const desc = it.descricao || it.produto || "Item sem descrição";
          const qtd = it.quantidade != null ? `${it.quantidade}x` : null;
          const esp = it.espessura || it.chapa;

          return (
            <div
              key={idx}
              className={`flex items-center gap-2 rounded-md border-l-4 ${cfg.border} ${cfg.bg} px-2 py-1.5`}
            >
              <BIcon className={`w-3.5 h-3.5 shrink-0 ${cfg.text}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
                  {desc}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.chip}`}>
                    {cfg.label}
                  </span>
                  {qtd && (
                    <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-0.5">
                      <Package className="w-2.5 h-2.5" />{qtd}
                    </span>
                  )}
                  {esp && (
                    <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                      {esp}mm
                    </span>
                  )}
                </div>
              </div>
              <StIcon.Icon className={`w-4 h-4 shrink-0 ${StIcon.cls}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}