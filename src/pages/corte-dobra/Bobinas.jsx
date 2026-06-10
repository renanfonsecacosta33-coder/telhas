import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Archive, AlertTriangle, Package, Weight } from "lucide-react";
import { toast } from "sonner";
import BobinaFormDialogCD from "@/components/corte-dobra/BobinaFormDialogCD";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";
import BobinaCard, { getAlertaNivel } from "@/components/bobinas/BobinaCardShared";

export default function BobinasCD() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filterAlerta, setFilterAlerta] = useState(false);
  const [showArquivadas, setShowArquivadas] = useState(false);
  const queryClient = useQueryClient();

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["bobinas-cd"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra" }),
  });

  const proximoNumero = (() => {
    let max = 0;
    bobinas.forEach(b => {
      const match = b.codigo && b.codigo.match(/^CD(\d+)$/i);
      if (match) { const n = parseInt(match[1], 10); if (n > max) max = n; }
    });
    return max + 1;
  })();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Bobina.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] }); setDialogOpen(false); toast.success("Bobina adicionada!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bobina.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] }); setDialogOpen(false); setEditItem(null); toast.success("Bobina atualizada!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bobina.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] }); setDeleteItem(null); toast.success("Bobina excluída!"); },
  });

  const arquivarMutation = useMutation({
    mutationFn: ({ id, arquivada }) => base44.entities.Bobina.update(id, {
      arquivada,
      data_encerramento: arquivada ? new Date().toISOString().split("T")[0] : null,
    }),
    onSuccess: (_, { arquivada }) => {
      queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] });
      toast.success(arquivada ? "Bobina arquivada!" : "Bobina restaurada!");
    },
  });

  const handleSave = (data) => {
    if (editItem) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const ativas = bobinas.filter(b => !b.arquivada);
  const arquivadas = bobinas.filter(b => b.arquivada);
  const totalPeso = ativas.reduce((s, b) => s + (b.peso_kg || 0), 0);
  const emAlerta = ativas.filter(b => getAlertaNivel(b) !== null);

  const base = showArquivadas ? arquivadas : ativas;
  const filtered = base.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q) ||
      b.codigo?.toLowerCase().includes(q) || b.fornecedor?.toLowerCase().includes(q) || b.qualidade?.toLowerCase().includes(q);
    const matchAlerta = !filterAlerta || getAlertaNivel(b) !== null;
    return matchSearch && matchAlerta;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Bobinas</h1>
            <Badge variant="outline">Corte e Dobra</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Estoque de bobinas do setor de Corte e Dobra</p>
        </div>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Bobina
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <Package className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{ativas.length}</p>
          <p className="text-xs text-muted-foreground">Em Estoque</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <Weight className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalPeso.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">kg em estoque</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${emAlerta.length > 0 ? "bg-red-50 border-red-300" : "bg-white border-border"}`}>
          <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${emAlerta.length > 0 ? "text-red-500" : "text-gray-400"}`} />
          <p className={`text-2xl font-bold ${emAlerta.length > 0 ? "text-red-700" : ""}`}>{emAlerta.length}</p>
          <p className="text-xs text-muted-foreground">Em alerta</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <Archive className="w-5 h-5 text-orange-400 mx-auto mb-1" />
          <p className="text-2xl font-bold">{arquivadas.length}</p>
          <p className="text-xs text-muted-foreground">Arquivadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por cor, chapa, código..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={showArquivadas ? "default" : "outline"} size="sm"
            onClick={() => { setShowArquivadas(!showArquivadas); setFilterAlerta(false); }} className="gap-1">
            <Archive className="w-3 h-3" />
            {showArquivadas ? "Ver em estoque" : `Arquivadas (${arquivadas.length})`}
          </Button>
          {!showArquivadas && emAlerta.length > 0 && (
            <Button variant={filterAlerta ? "destructive" : "outline"} size="sm"
              onClick={() => setFilterAlerta(!filterAlerta)} className="gap-1">
              <AlertTriangle className="w-3 h-3" />
              Alertas ({emAlerta.length})
            </Button>
          )}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhuma bobina encontrada" description="Adicione bobinas ao estoque." onAdd={() => { setEditItem(null); setDialogOpen(true); }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(bobina => (
            <BobinaCard
              key={bobina.id}
              bobina={bobina}
              onEdit={(b) => { setEditItem(b); setDialogOpen(true); }}
              onDelete={(b) => setDeleteItem(b)}
              onArquivar={(id, val) => arquivarMutation.mutate({ id, arquivada: val })}
            />
          ))}
        </div>
      )}

      <BobinaFormDialogCD
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
        proximoNumero={proximoNumero}
      />
      <DeleteConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteMutation.mutate(deleteItem.id)}
        itemName={deleteItem ? `${deleteItem.cor} - ${deleteItem.chapa}` : ""}
      />
    </div>
  );
}