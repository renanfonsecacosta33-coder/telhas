import React from "react";
import { Warehouse, X } from "lucide-react";

export const FILIAIS_LIST = [
  "Matriz AJL",
  "Pinhais",
  "Ponta Grossa",
  "Ivaiporã",
];

export const FILIAIS_COLORS = {
  "Matriz AJL": {
    short: "MATRIZ",
    pillActive: "bg-blue-500 text-white border-blue-600",
    pillInactive: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
    rowBg: "bg-blue-50/40",
    rowHover: "hover:bg-blue-100/50",
    rowBorder: "border-l-4 border-l-blue-500",
    badge: "bg-blue-200 text-blue-800",
    dot: "bg-blue-500",
  },
  "Pinhais": {
    short: "PINHAIS",
    pillActive: "bg-emerald-500 text-white border-emerald-600",
    pillInactive: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    rowBg: "bg-emerald-50/40",
    rowHover: "hover:bg-emerald-100/50",
    rowBorder: "border-l-4 border-l-emerald-500",
    badge: "bg-emerald-200 text-emerald-800",
    dot: "bg-emerald-500",
  },
  "Ponta Grossa": {
    short: "P. GROSSA",
    pillActive: "bg-purple-500 text-white border-purple-600",
    pillInactive: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    rowBg: "bg-purple-50/40",
    rowHover: "hover:bg-purple-100/50",
    rowBorder: "border-l-4 border-l-purple-500",
    badge: "bg-purple-200 text-purple-800",
    dot: "bg-purple-500",
  },
  "Ivaiporã": {
    short: "IVAIPORÃ",
    pillActive: "bg-orange-500 text-white border-orange-600",
    pillInactive: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    rowBg: "bg-orange-50/40",
    rowHover: "hover:bg-orange-100/50",
    rowBorder: "border-l-4 border-l-orange-500",
    badge: "bg-orange-200 text-orange-800",
    dot: "bg-orange-500",
  },
};

export function getFilialColor(unidade) {
  return FILIAIS_COLORS[unidade] || FILIAIS_COLORS["Matriz AJL"];
}

export default function FiliaisMultiSelect({ selected, onChange }) {
  const toggle = (filial) => {
    if (selected.includes(filial)) {
      if (selected.length === 1) return; // não permite deselecionar a última
      onChange(selected.filter(f => f !== filial));
    } else {
      onChange([...selected, filial]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0">
        <Warehouse className="w-4 h-4" />
        <span>Estoque:</span>
      </div>
      {FILIAIS_LIST.map(filial => {
        const c = getFilialColor(filial);
        const active = selected.includes(filial);
        return (
          <button
            key={filial}
            onClick={() => toggle(filial)}
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              active ? c.pillActive : c.pillInactive
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
            {c.short}
            {active && <X className="w-3 h-3 opacity-70" />}
          </button>
        );
      })}
      {selected.length > 1 && (
        <button
          onClick={() => onChange([selected[0]])}
          className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
        >
          limpar
        </button>
      )}
    </div>
  );
}