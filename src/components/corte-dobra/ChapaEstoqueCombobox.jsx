import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, Search, Lock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Combobox pesquisável de chapas do estoque (chaparia).
 * - Lista todas as chapas disponíveis/parciais.
 * - Perite digitar para filtrar (código, bobina, comprimento, pedido, cliente).
 * - Mostra indicadores de reserva (🔒 pedido direto / 🚫 reservada p/ outro pedido).
 * - Seleção continua vinculando a uma chapa real do estoque.
 */
export default function ChapaEstoqueCombobox({
  chapas = [],
  value,
  onChange,
  maxComprimento = 99999,
  numeroPedido = "",
  placeholder = "Selecione a chapa...",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const chapasFiltradas = useMemo(() => {
    const withinMachine = chapas.filter(c => (c.comprimento_mm || 0) <= maxComprimento);
    const q = query.trim().toLowerCase();
    if (!q) return withinMachine;
    return withinMachine.filter(c => {
      const blob = [
        c.codigo, c.bobina_descricao, c.comprimento_mm, c.largura_mm,
        c.numero_pedido, c.cliente, c.material, c.qualidade, c.nf,
      ].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [chapas, maxComprimento, query]);

  const chapaSelecionada = chapas.find(c => c.id === value) || null;

  const reservadaParaOutro = (c) =>
    c.destino === "pedido_direto" && c.numero_pedido && c.numero_pedido !== numeroPedido;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className="w-full justify-between font-normal h-11 text-base"
        >
          {chapaSelecionada ? (
            <span className="flex items-center gap-2 min-w-0 truncate">
              <span className="font-mono font-bold text-sm">{chapaSelecionada.codigo || "—"}</span>
              <span className="text-muted-foreground text-xs truncate">{chapaSelecionada.bobina_descricao || "—"}</span>
              <span className="text-muted-foreground text-xs">{chapaSelecionada.comprimento_mm}mm</span>
              <span className="text-green-600 text-xs font-semibold">{chapaSelecionada.quantidade_disponivel}pç</span>
              {chapaSelecionada.destino === "pedido_direto" && (
                <span className="text-amber-600 text-xs font-bold">🔒 {chapaSelecionada.numero_pedido || ""}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <Search className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Pesquisar por código, bobina, pedido, cliente..." value={query} onValueChange={setQuery} className="h-11 text-base" />
          <CommandList>
            <CommandEmpty>
              {chapas.length === 0 ? "Nenhuma chapa no estoque." : "Nenhuma chapa encontrada."}
            </CommandEmpty>
            <CommandGroup>
              {chapasFiltradas.map(c => {
                const isReservadaOutro = reservadaParaOutro(c);
                const isReservada = c.destino === "pedido_direto";
                return (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => { onChange(c.id); setOpen(false); setQuery(""); }}
                    className="flex items-center gap-2 py-3 min-h-11"
                  >
                    <Check className={cn("h-4 w-4 shrink-0", value === c.id ? "opacity-100" : "opacity-0")} />
                    <div className="flex flex-1 items-center gap-2 min-w-0 flex-wrap">
                      <span className="font-mono font-bold text-sm">{c.codigo || "—"}</span>
                      <span className="text-muted-foreground text-xs truncate">{c.bobina_descricao || "—"}</span>
                      <span className="text-muted-foreground text-xs">{c.comprimento_mm}mm</span>
                      <span className="text-green-600 text-xs font-bold">{c.quantidade_disponivel}pç</span>
                    </div>
                    {isReservada && !isReservadaOutro && (
                      <span className="text-amber-600 text-xs font-bold flex items-center gap-0.5 shrink-0">
                        <Lock className="h-3 w-3" /> {c.numero_pedido || ""}
                      </span>
                    )}
                    {isReservadaOutro && (
                      <span className="text-amber-600 text-xs font-bold flex items-center gap-1 shrink-0 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">
                        <Lock className="h-3 w-3" /> Requer Ped. {c.numero_pedido || ""}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}