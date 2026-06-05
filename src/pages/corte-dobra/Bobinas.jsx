import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Circle, Plus } from "lucide-react";
import BobinaFormDialogCD from "@/components/corte-dobra/BobinaFormDialogCD";

export default function BobinasCD() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const queryClient = useQueryClient();

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["bobinas-cd"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false }),
  });

  // Calcular próximo número sequencial para código CD
  const proximoNumero = (() => {
    let max = 0;
    bobinas.forEach(b => {
      const match = b.codigo && b.codigo.match(/^CD(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > max) max = n;
      }
    });
    return max + 1;
  })();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Bobina.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] }); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bobina.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] }); setDialogOpen(false); setEditItem(null); },
  });

  const handleSave = (data) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (b) => { setEditItem(b); setDialogOpen(true); };
  const handleClose = () => { setDialogOpen(false); setEditItem(null); };

  const filtered = bobinas.filter(b => {
    const q = search.toLowerCase();
    return b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q) ||
      b.codigo?.toLowerCase().includes(q) || b.fornecedor?.toLowerCase().includes(q);
  });

  const totalPeso = bobinas.reduce((s, b) => s + (b.peso_kg || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Circle className="w-5 h-5" /> Bobinas — Corte e Dobra
          </h1>
          <p className="text-sm text-muted-foreground">Estoque de bobinas do setor</p>
        </div>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Bobina
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Em Estoque</p>
          <p className="text-2xl font-bold text-blue-600">{bobinas.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-sm text-muted-foreground">Peso Total</p>
          <p className="text-2xl font-bold text-green-600">{totalPeso.toLocaleString("pt-BR")} kg</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por cor, chapa, código..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma bobina encontrada.</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
            <span>Código</span><span>Chapa</span><span>Cor / Material</span><span>Peso (kg)</span><span>Fornecedor</span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map(b => (
              <div key={b.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 items-center hover:bg-muted/20 cursor-pointer"
                onClick={() => handleEdit(b)}>
                <span className="font-mono text-sm font-semibold text-orange-600">{b.codigo || "-"}</span>
                <span className="text-sm">{b.chapa || "-"}</span>
                <span className="text-sm">{b.cor || "-"}</span>
                <span className="text-sm font-semibold">{b.peso_kg ? b.peso_kg.toLocaleString("pt-BR") : "-"}</span>
                <span className="text-xs text-muted-foreground">{b.fornecedor || "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <BobinaFormDialogCD
        open={dialogOpen}
        onClose={handleClose}
        onSave={handleSave}
        editItem={editItem}
        proximoNumero={proximoNumero}
      />
    </div>
  );
}