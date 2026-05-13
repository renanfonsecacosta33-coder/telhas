import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Circle, Weight } from "lucide-react";
import { toast } from "sonner";
import BobinaFormDialog from "@/components/bobinas/BobinaFormDialog";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";

export default function Bobinas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["bobinas"],
    queryFn: () => base44.entities.Bobina.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Bobina.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      setDialogOpen(false);
      toast.success("Bobina adicionada!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bobina.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      setDialogOpen(false);
      setEditItem(null);
      toast.success("Bobina atualizada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bobina.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      setDeleteItem(null);
      toast.success("Bobina excluída!");
    },
  });

  const handleSave = (data) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = bobinas.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.cor?.toLowerCase().includes(q) ||
      b.espessura?.toLowerCase().includes(q) ||
      b.observacoes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bobinas</h1>
          <p className="text-sm text-muted-foreground">Gerencie o estoque de bobinas de aço</p>
        </div>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Bobina
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cor, espessura..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma bobina encontrada"
          description="Adicione bobinas ao estoque para começar a gerenciar."
          onAdd={() => { setEditItem(null); setDialogOpen(true); }}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((bobina) => (
            <div
              key={bobina.id}
              className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Circle className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{bobina.cor}</p>
                  <p className="text-sm text-muted-foreground">{bobina.espessura}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {bobina.peso_kg && (
                  <Badge variant="secondary" className="gap-1">
                    <Weight className="w-3 h-3" />
                    {bobina.peso_kg} kg
                  </Badge>
                )}
                {bobina.quantidade && (
                  <Badge variant="outline">Qtd: {bobina.quantidade}</Badge>
                )}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setEditItem(bobina); setDialogOpen(true); }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteItem(bobina)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BobinaFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
      />

      <DeleteConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteMutation.mutate(deleteItem.id)}
        itemName={deleteItem ? `${deleteItem.cor} - ${deleteItem.espessura}` : ""}
      />
    </div>
  );
}