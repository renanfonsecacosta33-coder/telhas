import React, { useEffect } from "react";
import { LayoutList, Table, Columns3 } from "lucide-react";

/**
 * Componente unificado de seleção de visualização (Cards | Tabela | Kanban)
 * Suporta persistência automática no localStorage por tela/módulo.
 */
export default function ViewModeToggle({
  value,
  onChange,
  storageKey,
  className = "",
  labels = { cards: "Cards", tabela: "Tabela", kanban: "Kanban" },
  allowedModes = ["cards", "tabela", "kanban"],
}) {
  // Ao montar, recupera a preferência salva no localStorage se existir
  useEffect(() => {
    if (storageKey) {
      try {
        const salvo = localStorage.getItem(`ajl_viewmode_${storageKey}`);
        if (salvo && allowedModes.includes(salvo) && salvo !== value) {
          onChange?.(salvo);
        }
      } catch (e) {
        // Ignora erro de storage
      }
    }
  }, [storageKey]);

  const handleSelect = (modo) => {
    if (modo === value) return;
    if (storageKey) {
      try {
        localStorage.setItem(`ajl_viewmode_${storageKey}`, modo);
      } catch (e) {}
    }
    onChange?.(modo);
  };

  return (
    <div
      className={`inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}
    >
      {allowedModes.includes("cards") && (
        <button
          type="button"
          onClick={() => handleSelect("cards")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
            value === "cards"
              ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
          title="Visão em Lista de Cards Detalhados"
        >
          <LayoutList className="w-3.5 h-3.5" />
          <span>{labels.cards}</span>
        </button>
      )}

      {allowedModes.includes("tabela") && (
        <button
          type="button"
          onClick={() => handleSelect("tabela")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
            value === "tabela"
              ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
          title="Visão em Tabela Compacta (Estilo Planilha)"
        >
          <Table className="w-3.5 h-3.5" />
          <span>{labels.tabela}</span>
        </button>
      )}

      {allowedModes.includes("kanban") && (
        <button
          type="button"
          onClick={() => handleSelect("kanban")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
            value === "kanban"
              ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
          title="Visão em Quadro Kanban"
        >
          <Columns3 className="w-3.5 h-3.5" />
          <span>{labels.kanban}</span>
        </button>
      )}
    </div>
  );
}
