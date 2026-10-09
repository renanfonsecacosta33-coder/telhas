import React from "react";
import { Filter, Palette, X } from "lucide-react";

/**
 * Componente unificado para filtro por TIPO DE BOBINA (Natural/Galvalume, Pré-Pintada, origens, espessuras)
 * e COR DE BOBINA (apenas cores presentes nos pedidos).
 */
export default function FiltroTipoECorBobina({
  dadosFiltros,
  filtroTipo = "todos",
  filtroCor = "todas",
  onSelecionarTipo,
  onSelecionarCor,
  onLimparFiltros,
  totalBase = 0
}) {
  if (!dadosFiltros || (dadosFiltros.tipos.length <= 1 && dadosFiltros.cores.length === 0)) {
    return null;
  }

  const isFiltrado = filtroTipo !== "todos" || filtroCor !== "todas";

  return (
    <div className="pt-2.5 border-t border-border/50 space-y-2.5">
      {/* Linha 1: TIPO DE BOBINA */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-primary" />
            Tipo de Bobina
          </span>
          {isFiltrado && (
            <button
              type="button"
              onClick={onLimparFiltros}
              className="text-[11px] text-primary hover:underline font-bold cursor-pointer flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpar filtros {totalBase > 0 ? `(${totalBase} pedidos)` : ""}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar flex-wrap sm:flex-nowrap">
          {/* Tipos Principais (Todos, Natural, Pré-Pintada) */}
          {dadosFiltros.tipos.map((t) => {
            const isSelected = filtroTipo === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onSelecionarTipo(t.key)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm font-bold ring-2 ring-primary ring-offset-1"
                    : "bg-muted/40 hover:bg-muted text-foreground border-border/70 font-medium"
                }`}
                title={`Filtrar por ${t.label}`}
              >
                <span>{t.icone}</span>
                <span>{t.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                    isSelected
                      ? "bg-primary-foreground/25 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}

          {/* Subopções de Natural se houver (Importada, Nacional, Espessuras) */}
          {dadosFiltros.subtiposNatural && dadosFiltros.subtiposNatural.length > 0 && (
            <div className="flex items-center gap-1 pl-1.5 border-l border-border/60">
              {dadosFiltros.subtiposNatural.map((st) => {
                const isSelected = filtroTipo === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => onSelecionarTipo(st.key)}
                    className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer flex items-center gap-1 border ${
                      isSelected
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 font-bold ring-1 ring-primary shadow-xs"
                        : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60 font-medium"
                    }`}
                    title={`Filtrar por ${st.label}`}
                  >
                    <span>{st.icone}</span>
                    <span>{st.label}</span>
                    <span
                      className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                        isSelected ? "bg-white/20 dark:bg-black/20" : "bg-muted"
                      }`}
                    >
                      {st.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Linha 2: COR DE BOBINA (aparece quando houver pedidos coloridos na tela) */}
      {dadosFiltros.cores && dadosFiltros.cores.length > 0 && (
        <div className="space-y-1 pt-1.5 border-t border-border/40">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Cor da Bobina
            </span>
            {filtroCor !== "todas" && (
              <button
                type="button"
                onClick={() => onSelecionarCor("todas")}
                className="text-[10px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
              >
                Todas as cores
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
            {/* Botão Todas as Cores */}
            <button
              type="button"
              onClick={() => onSelecionarCor("todas")}
              className={`flex-shrink-0 px-2.5 py-0.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                filtroCor === "todas"
                  ? "bg-purple-600 text-white border-purple-600 shadow-sm font-bold ring-1 ring-purple-400"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/70 font-medium"
              }`}
            >
              <span>Todas as Cores</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  filtroCor === "todas" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {dadosFiltros.countPrePintada}
              </span>
            </button>

            {/* Chips Individuais de Cada Cor */}
            {dadosFiltros.cores.map((c) => {
              const isSelected = filtroCor === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onSelecionarCor(c.key)}
                  className={`flex-shrink-0 px-2.5 py-0.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? `ring-2 ring-purple-500 ring-offset-1 font-bold shadow-xs ${c.badgeCls}`
                      : "bg-background hover:bg-muted/70 text-foreground border-border/80 font-medium"
                  }`}
                  title={`Filtrar pedidos com bobina ${c.label}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0 shadow-2xs"
                    style={{ backgroundColor: c.dotColor }}
                  />
                  <span>{c.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                      isSelected ? "bg-black/15 dark:bg-white/25" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
