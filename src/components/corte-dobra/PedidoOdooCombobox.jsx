import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Check, Layers, User, X, Sparkles, AlertCircle, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getItens, classGrupo } from "@/lib/pedidoOdooHelper";
import { cn } from "@/lib/utils";

/**
 * PedidoOdooCombobox.jsx
 * 
 * Permite digitar o número do pedido manualmente OU pesquisar e selecionar
 * um pedido real do ODOO que já esteja na fila de produção de Corte & Dobra.
 * Ao selecionar, auto-preenche:
 *  - Número do Pedido
 *  - Cliente
 *  - Sugere produto/peça de Corte & Dobra e quantidade
 */
export default function PedidoOdooCombobox({
  numeroPedido = "",
  onChangeNumeroPedido,
  onSelectPedidoOdoo,
  clienteAtual = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Busca pedidos do Odoo na fila
  const { data: pedidosOdoo = [], isLoading } = useQuery({
    queryKey: ["pedidos-odoo-fila-cd"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 200),
    staleTime: 20000,
  });

  // Filtra e enriquece pedidos que possuem itens de Corte & Dobra ou estão na fila
  const pedidosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pedidosOdoo
      .map(p => {
        const itens = getItens(p);
        const itensCD = itens.filter(i => classGrupo(i) === "cd" || classGrupo(i) === "chapa");
        return {
          ...p,
          itensCD,
          totalItensCD: itensCD.length,
        };
      })
      .filter(p => {
        if (!q) return true;
        const blob = [
          p.numero_pedido,
          p.cliente_nome,
          p.vendedor_nome,
          p.of_nome,
          ...p.itensCD.map(i => `${i.produto || ""} ${i.descricao || ""}`),
        ].join(" ").toLowerCase();
        return blob.includes(q);
      });
  }, [pedidosOdoo, query]);

  const pedidoVinculado = useMemo(() => {
    if (!numeroPedido) return null;
    return pedidosOdoo.find(
      p => String(p.numero_pedido).trim().toLowerCase() === String(numeroPedido).trim().toLowerCase()
    ) || null;
  }, [pedidosOdoo, numeroPedido]);

  const handleSelect = (pedido) => {
    onChangeNumeroPedido(pedido.numero_pedido || "");
    if (onSelectPedidoOdoo) {
      onSelectPedidoOdoo(pedido);
    }
    setOpen(false);
    setQuery("");
  };

  const handleLimpar = () => {
    onChangeNumeroPedido("");
    if (onSelectPedidoOdoo) {
      onSelectPedidoOdoo(null);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Input
          placeholder="Ex: S00609, 298249..."
          value={numeroPedido}
          onChange={e => onChangeNumeroPedido(e.target.value)}
          disabled={disabled}
          className={cn(
            "h-9 text-sm font-mono font-bold flex-1",
            pedidoVinculado ? "border-emerald-500 bg-emerald-50/20 text-emerald-900 dark:text-emerald-300" : ""
          )}
        />

        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className={cn(
                "h-9 px-2.5 gap-1 shrink-0 font-semibold text-xs border-orange-300 hover:bg-orange-50 hover:text-orange-700",
                pedidoVinculado ? "border-emerald-400 bg-emerald-50 text-emerald-700" : ""
              )}
              title="Pesquisar pedidos do ODOO na fila de produção"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fila Odoo</span>
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[360px] sm:w-[440px] p-0" align="end">
            <Command shouldFilter={false}>
              <div className="p-2 border-b border-border bg-muted/40">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-orange-500" />
                  Pedidos do ODOO na Fila de Corte & Dobra
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Selecione para vincular cliente, número e puxar os itens automaticamente.
                </p>
              </div>

              <CommandInput
                placeholder="Pesquisar por pedido, cliente, produto..."
                value={query}
                onValueChange={setQuery}
                className="h-9 text-xs"
              />

              <CommandList className="max-h-[300px]">
                <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                  {isLoading ? "Carregando pedidos do Odoo..." : "Nenhum pedido encontrado na fila."}
                </CommandEmpty>

                <CommandGroup heading={`Pedidos da Fila (${pedidosFiltrados.length})`}>
                  {pedidosFiltrados.map(p => {
                    const isSelected = String(numeroPedido).trim().toLowerCase() === String(p.numero_pedido).trim().toLowerCase();
                    const primeiroItemCD = p.itensCD?.[0] || null;

                    return (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        onSelect={() => handleSelect(p)}
                        className="py-2.5 px-3 cursor-pointer flex flex-col items-start gap-1 border-b border-border/50 last:border-b-0 hover:bg-orange-50 dark:hover:bg-slate-800"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-foreground">
                              {p.numero_pedido}
                            </span>
                            {p.cliente_nome && (
                              <span className="text-xs font-semibold text-muted-foreground truncate max-w-[180px]">
                                {p.cliente_nome}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {p.totalItensCD > 0 && (
                              <Badge className="bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-bold">
                                {p.totalItensCD} item(ns) C&D
                              </Badge>
                            )}
                            {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                        </div>

                        {primeiroItemCD && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-muted/60 px-2 py-0.5 rounded w-full truncate">
                            <strong className="text-foreground">Item:</strong> {primeiroItemCD.produto || primeiroItemCD.descricao}
                            {primeiroItemCD.quantidade ? ` (${primeiroItemCD.quantidade} ${primeiroItemCD.unidade || "UN"})` : ""}
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          {p.vendedor_nome && <span>👤 Vend: {p.vendedor_nome}</span>}
                          {p.data_entrega && <span>📅 Entrega: {p.data_entrega}</span>}
                          {p.unidade && <span>🏭 {p.unidade}</span>}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {pedidoVinculado && (
          <button
            type="button"
            onClick={handleLimpar}
            className="text-muted-foreground hover:text-red-500 p-1 rounded"
            title="Remover vínculo com pedido Odoo"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {pedidoVinculado && (
        <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-0.5 text-[11px] text-emerald-800 dark:text-emerald-300">
          <span className="truncate">
            ✓ Odoo: <strong>{pedidoVinculado.numero_pedido}</strong> — {pedidoVinculado.cliente_nome || "Cliente"}
          </span>
          <span className="text-[10px] font-bold text-emerald-600 uppercase shrink-0">
            Vinculado
          </span>
        </div>
      )}
    </div>
  );
}
