import React, { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Check,
  ChevronsUpDown,
  X,
  Layers,
  Tag
} from "lucide-react";
import {
  getBobinaStatus,
  calcMetrosDisponiveis,
  isBobinaAberta,
  isBobinaNatural,
  compararBobinasTelhas,
  matchBobinaBuscaGeral
} from "@/lib/bobinaStatusHelper";
import { cn } from "@/lib/utils";

// Helper de visual de cor para badges rápidos
function getCorBadgeStyle(cor) {
  const c = String(cor || "").toLowerCase().trim();
  if (!c || c.includes("natural") || c.includes("galvalume") || c.includes("sem cor")) {
    return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
  }
  if (c.includes("pret")) {
    return "bg-zinc-900 text-white border-zinc-950 dark:bg-zinc-800 dark:text-zinc-100";
  }
  if (c.includes("branc")) {
    return "bg-white text-slate-800 border-slate-300 shadow-sm dark:bg-slate-100 dark:text-slate-900";
  }
  if (c.includes("azul")) {
    return "bg-blue-600 text-white border-blue-700";
  }
  if (c.includes("vermelh")) {
    return "bg-red-600 text-white border-red-700";
  }
  if (c.includes("cinza") || c.includes("grafite")) {
    return "bg-slate-600 text-white border-slate-700";
  }
  if (c.includes("bege") || c.includes("areia")) {
    return "bg-amber-100 text-amber-900 border-amber-300";
  }
  if (c.includes("verd")) {
    return "bg-emerald-600 text-white border-emerald-700";
  }
  if (c.includes("marrom") || c.includes("terracota")) {
    return "bg-amber-800 text-white border-amber-900";
  }
  return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300";
}

export default function BobinaComboboxTelhas({
  bobinas = [],
  value,
  onChange,
  preBaixaMap = {},
  statusMap = {},
  ordensAtivas = [],
  placeholder = "Selecione a bobina...",
  disabled = false,
  className = "",
  id = undefined,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos"); // "todos" | "abertas" | "naturais" | "prepintadas"
  const searchInputRef = useRef(null);

  // Bobina atualmente selecionada
  const bobinaSelecionada = useMemo(() => {
    if (!value) return null;
    return bobinas.find((b) => b.id === value || b.codigo === value) || null;
  }, [bobinas, value]);

  // Foco automático no input de busca ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearch("");
      setFiltroTipo("todos");
    }
  }, [open]);

  // Ordena as bobinas estritamente segundo a regra de Telhas:
  // 1. Abertas Naturais
  // 2. Abertas Pré-Pintadas
  // 3. Fechadas Naturais
  // 4. Fechadas Pré-Pintadas
  const bobinasOrdenadas = useMemo(() => {
    return [...bobinas].sort((a, b) => compararBobinasTelhas(a, b, statusMap));
  }, [bobinas, statusMap]);

  // Aplica a busca por código, cor, chapa e o filtro rápido
  const bobinasFiltradas = useMemo(() => {
    return bobinasOrdenadas.filter((b) => {
      // Filtro de chips rápidos
      if (filtroTipo === "abertas" && !isBobinaAberta(b, statusMap)) return false;
      if (filtroTipo === "naturais" && !isBobinaNatural(b)) return false;
      if (filtroTipo === "prepintadas" && isBobinaNatural(b)) return false;

      // Busca por texto
      if (!search.trim()) return true;
      return matchBobinaBuscaGeral(b, search);
    });
  }, [bobinasOrdenadas, search, filtroTipo, statusMap]);

  // Agrupamento para exibição visual clara
  const grupos = useMemo(() => {
    const abertasNaturais = [];
    const abertasPrePintadas = [];
    const fechadasNaturais = [];
    const fechadasPrePintadas = [];

    bobinasFiltradas.forEach((b) => {
      const aberta = isBobinaAberta(b, statusMap);
      const natural = isBobinaNatural(b);

      if (aberta && natural) abertasNaturais.push(b);
      else if (aberta && !natural) abertasPrePintadas.push(b);
      else if (!aberta && natural) fechadasNaturais.push(b);
      else fechadasPrePintadas.push(b);
    });

    return [
      {
        id: "abertas_naturais",
        titulo: "🟢 Abertas — Naturais (Galvalume)",
        badge: "Em uso / Pátio aberto",
        badgeColor: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
        itens: abertasNaturais,
      },
      {
        id: "abertas_prepintadas",
        titulo: "🎨 Abertas — Pré-Pintadas (Cores)",
        badge: "Coloridas Abertas",
        badgeColor: "bg-blue-500/15 text-blue-700 border-blue-500/40",
        itens: abertasPrePintadas,
      },
      {
        id: "fechadas_naturais",
        titulo: "🔒 Fechadas — Naturais (Galvalume)",
        badge: "Lacradas",
        badgeColor: "bg-slate-400/20 text-slate-700 border-slate-400/40",
        itens: fechadasNaturais,
      },
      {
        id: "fechadas_prepintadas",
        titulo: "🎨 Fechadas — Pré-Pintadas (Cores)",
        badge: "Coloridas Lacradas",
        badgeColor: "bg-purple-500/15 text-purple-700 border-purple-500/40",
        itens: fechadasPrePintadas,
      },
    ].filter((g) => g.itens.length > 0);
  }, [bobinasFiltradas, statusMap]);

  const handleSelect = (b) => {
    onChange(b.id, b);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("", null);
  };

  // Render do item individual da bobina
  const renderItemBobina = (b) => {
    const isSelected = bobinaSelecionada?.id === b.id;
    const pb = preBaixaMap[b.id] || 0;
    const pesoBruto = b.peso_kg || 0;
    const dispLivre = Math.max(0, pesoBruto - pb);
    const metrosLivres = calcMetrosDisponiveis(b, dispLivre);
    const st = getBobinaStatus(b, ordensAtivas, statusMap);
    const natural = isBobinaNatural(b);

    return (
      <button
        key={b.id}
        type="button"
        onClick={() => handleSelect(b)}
        className={cn(
          "w-full text-left p-2.5 rounded-lg transition-all border flex items-start justify-between gap-2.5",
          isSelected
            ? "bg-blue-50/90 border-blue-400 dark:bg-blue-950/50 dark:border-blue-700 shadow-sm"
            : "border-border/60 hover:bg-muted/80 hover:border-border"
        )}
      >
        <div className="space-y-1 flex-1 min-w-0">
          {/* Linha 1: Código, Chapa, Qualidade e Cor com Badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-primary px-1.5 py-0.5 rounded border border-border">
              {b.codigo || "S/ CÓD"}
            </span>
            <span className="font-semibold text-xs text-foreground">
              {b.chapa ? `Chapa ${b.chapa}` : "Chapa —"}
            </span>
            {b.qualidade && (
              <span className="text-[11px] text-muted-foreground font-medium">
                ({b.qualidade})
              </span>
            )}
            {/* Tag da Cor em destaque */}
            <span
              className={cn(
                "text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1",
                getCorBadgeStyle(b.cor)
              )}
            >
              <Tag className="w-3 h-3 shrink-0" />
              {b.cor ? b.cor : natural ? "Natural / Galvalume" : "Padrão"}
            </span>
          </div>

          {/* Linha 2: Estoque, Metragem e Reservas */}
          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
              {dispLivre.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg livre
              {metrosLivres ? ` (~${metrosLivres.toLocaleString("pt-BR")}m)` : ""}
            </span>

            {pb > 0 && (
              <span className="text-amber-600 font-medium">
                · {pb.toFixed(0)}kg reservado (Total: {pesoBruto.toLocaleString("pt-BR")}kg)
              </span>
            )}

            {b.fornecedor && (
              <span className="text-muted-foreground text-[10px] truncate max-w-[130px]">
                · {b.fornecedor}
              </span>
            )}
          </div>
        </div>

        {/* Status / Ações à direita */}
        <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
          {st && (
            <span
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-md border text-right",
                st.bgClass
              )}
            >
              {st.label}
            </span>
          )}
          {isSelected && (
            <span className="flex items-center gap-0.5 text-xs text-blue-600 font-bold">
              <Check className="w-3.5 h-3.5" /> Selecionada
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-[42px] px-3 py-2 text-left font-normal border-input hover:bg-background/90",
            !bobinaSelecionada && "text-muted-foreground",
            className
          )}
        >
          {bobinaSelecionada ? (
            <div className="flex items-center gap-2 flex-wrap min-w-0 pr-2">
              <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-primary px-1.5 py-0.5 rounded border border-border">
                {bobinaSelecionada.codigo || "—"}
              </span>
              <span className="font-medium text-xs text-foreground">
                {bobinaSelecionada.chapa ? `Chapa ${bobinaSelecionada.chapa}` : ""}
              </span>
              {bobinaSelecionada.qualidade && (
                <span className="text-[11px] text-muted-foreground">
                  ({bobinaSelecionada.qualidade})
                </span>
              )}
              <span
                className={cn(
                  "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                  getCorBadgeStyle(bobinaSelecionada.cor)
                )}
              >
                {bobinaSelecionada.cor || "Natural / Galvalume"}
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                {Math.max(0, (bobinaSelecionada.peso_kg || 0) - (preBaixaMap[bobinaSelecionada.id] || 0)).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg livre
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{placeholder}</span>
          )}

          <div className="flex items-center gap-1 shrink-0 ml-auto pl-1">
            {bobinaSelecionada && !disabled && (
              <span
                role="button"
                onClick={handleClear}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Limpar seleção"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="w-4 h-4 text-muted-foreground opacity-70" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[calc(100vw-32px)] sm:w-[540px] max-w-[95vw] p-0 shadow-2xl border border-border rounded-xl overflow-hidden bg-popover z-50"
        align="start"
      >
        {/* Barra de Busca Superior com Input Especializado */}
        <div className="p-3 border-b border-border bg-slate-50/80 dark:bg-slate-900/80 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar código (ex: 001, TE0045) ou cor (ex: Preta, Branca)..."
              className="pl-9 pr-8 h-9 text-xs bg-background border-slate-300 dark:border-slate-700"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Chips de filtro rápido */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Filtro rápido:
            </span>
            <button
              type="button"
              onClick={() => setFiltroTipo("todos")}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full font-medium transition-all border cursor-pointer",
                filtroTipo === "todos"
                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                  : "bg-background text-muted-foreground hover:text-foreground border-border"
              )}
            >
              Todas ({bobinas.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo("abertas")}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full font-medium transition-all border cursor-pointer",
                filtroTipo === "abertas"
                  ? "bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs"
                  : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200"
              )}
            >
              🟢 Abertas ({bobinas.filter((b) => isBobinaAberta(b, statusMap)).length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo("naturais")}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full font-medium transition-all border cursor-pointer",
                filtroTipo === "naturais"
                  ? "bg-slate-700 text-white border-slate-700 font-bold shadow-xs"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
              )}
            >
              ⚪ Naturais / Galvalume ({bobinas.filter((b) => isBobinaNatural(b)).length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo("prepintadas")}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full font-medium transition-all border cursor-pointer",
                filtroTipo === "prepintadas"
                  ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs"
                  : "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200"
              )}
            >
              🎨 Pré-Pintadas / Cores ({bobinas.filter((b) => !isBobinaNatural(b)).length})
            </button>
          </div>
        </div>

        {/* Lista com scroll e grupos visuais */}
        <div className="max-h-[360px] overflow-y-auto p-2 space-y-3">
          {bobinasFiltradas.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-2">
              <Layers className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
              <p className="text-xs font-semibold text-foreground">
                Nenhuma bobina encontrada
              </p>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                {search
                  ? `Nenhuma bobina compatível com o termo "${search}".`
                  : "Não há bobinas cadastradas para os filtros aplicados."}
              </p>
              {search && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 mt-1"
                  onClick={() => setSearch("")}
                >
                  Limpar busca
                </Button>
              )}
            </div>
          ) : (
            grupos.map((grupo) => (
              <div key={grupo.id} className="space-y-1.5">
                {/* Cabeçalho do Grupo de Prioridade */}
                <div className="flex items-center justify-between px-1 pt-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    {grupo.titulo}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                      grupo.badgeColor
                    )}
                  >
                    {grupo.itens.length} bobina(s)
                  </span>
                </div>

                {/* Itens do Grupo */}
                <div className="space-y-1">
                  {grupo.itens.map((b) => renderItemBobina(b))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="p-2 border-t border-border bg-muted/40 text-[10px] text-muted-foreground flex items-center justify-between px-3">
          <span>
            Ordem: <strong>1º Abertas Naturais</strong> → <strong>2º Abertas Cores</strong> → <strong>3º Fechadas</strong>
          </span>
          <span className="font-semibold">{bobinasFiltradas.length} encontradas</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
