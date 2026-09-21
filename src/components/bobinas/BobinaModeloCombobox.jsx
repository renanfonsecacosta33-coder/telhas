import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Search, Layers, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Combobox pesquisável para selecionar uma Bobina Existente como modelo
 * no cadastro de Nova Bobina (Telhas ou Corte & Dobra).
 */
export default function BobinaModeloCombobox({
  bobinas = [],
  selectedId = "",
  onSelect,
  onClear,
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Normaliza e filtra bobinas válidas
  const bobinasFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const validas = (bobinas || []).filter(b => b && (b.codigo || b.cor || b.chapa));

    if (!q) return validas.slice(0, 100); // Exibe até 100 inicialmente para performance máxima

    return validas
      .filter(b => {
        const searchable = [
          b.codigo,
          b.cor,
          b.chapa,
          b.qualidade,
          b.fornecedor,
          b.largura_mm,
          b.sub_cod,
          b.setor,
          b.origem,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      })
      .slice(0, 100);
  }, [bobinas, query]);

  const bobinaSelecionada = useMemo(() => {
    if (!selectedId) return null;
    return (bobinas || []).find(b => (b.id && b.id === selectedId) || (b.codigo && b.codigo === selectedId)) || null;
  }, [bobinas, selectedId]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setQuery(""); }}>
        <div className="flex items-center gap-2">
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              disabled={disabled}
              aria-expanded={open}
              className={cn(
                "w-full justify-between font-normal h-auto py-2.5 px-3 text-left border-dashed hover:border-primary transition-colors",
                bobinaSelecionada ? "bg-primary/5 border-primary/40" : "bg-muted/20"
              )}
            >
              {bobinaSelecionada ? (
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge variant="default" className="font-mono text-xs shrink-0 bg-primary font-bold">
                    {bobinaSelecionada.codigo || "S/ CÓD"}
                  </Badge>
                  <div className="truncate text-xs">
                    <span className="font-medium text-foreground">{bobinaSelecionada.cor || "Sem cor"}</span>
                    {bobinaSelecionada.chapa && (
                      <span className="text-muted-foreground ml-1.5">· Chapa {bobinaSelecionada.chapa}</span>
                    )}
                    {bobinaSelecionada.largura_mm && (
                      <span className="text-muted-foreground ml-1.5">· {bobinaSelecionada.largura_mm}mm</span>
                    )}
                    {bobinaSelecionada.fornecedor && (
                      <span className="text-muted-foreground ml-1.5">({bobinaSelecionada.fornecedor})</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <Layers className="w-4 h-4 text-primary shrink-0" />
                  <span>Escolha uma bobina cadastrada para preencher as especificações...</span>
                </div>
              )}
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
            </Button>
          </PopoverTrigger>

          {bobinaSelecionada && onClear && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              title="Limpar modelo selecionado"
              className="h-9 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <PopoverContent className="w-[90vw] sm:w-[600px] md:w-[720px] p-0 shadow-2xl" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por código, cor, chapa, fornecedor..."
              value={query}
              onValueChange={setQuery}
              className="h-10 text-xs"
            />
            <CommandList className="max-h-72">
              <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                Nenhuma bobina encontrada com esse termo.
              </CommandEmpty>
              <CommandGroup heading={`Bobinas encontradas (${bobinasFiltradas.length})`}>
                {bobinasFiltradas.map(b => {
                  const itemKey = b.id || b.codigo || Math.random();
                  const isSelected = selectedId && (b.id === selectedId || b.codigo === selectedId);

                  return (
                    <CommandItem
                      key={itemKey}
                      value={b.id || b.codigo}
                      onSelect={() => {
                        if (onSelect) onSelect(b);
                        setOpen(false);
                      }}
                      className="cursor-pointer py-2 px-3 border-b border-border/40 last:border-0 hover:bg-accent/60"
                    >
                      <div className="flex items-start justify-between w-full gap-2">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {b.codigo || "S/ CÓD"}
                            </span>
                            <span className="text-xs font-semibold truncate text-foreground">
                              {b.cor || "Cor não inf."}
                            </span>
                            {b.qualidade && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                {b.qualidade}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2">
                            {b.chapa && <span>Chapa: <strong className="text-foreground">{b.chapa}</strong></span>}
                            {b.largura_mm && <span>Largura: {b.largura_mm}mm</span>}
                            {b.fornecedor && <span>Forn: {b.fornecedor}</span>}
                            {b.origem && <span>Origem: {b.origem}</span>}
                          </div>
                        </div>

                        {isSelected ? (
                          <Check className="w-4 h-4 text-primary shrink-0 mt-1" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground/70 shrink-0 mt-1">Usar</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
