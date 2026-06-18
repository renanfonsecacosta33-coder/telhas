import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Weight, X, Archive, Package, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import SlitterFormDialog from "@/components/corte-dobra/SlitterFormDialog";
import SlitterCard from "@/components/corte-dobra/SlitterCard";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";

export default function SlitterPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filtroQualidade, setFiltroQualidade] = useState("todas");
  const queryClient = useQueryClient();

  const { data: slitters = [], isLoading } = useQuery({
    queryKey: ["slitters"],
    queryFn: () => base44.entities.Slitter.list(),
  });

  const proximoCodigo = (() => {
    let max = 0;
    slitters.forEach(s => {
      const match = s.codigo && s.codigo.match(/^ST(\d+)$/i);
      if (match) { const n = parseInt(match[1], 10); if (n > max) max = n; }
    });
    return max + 1;
  })();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Slitter.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["slitters"] }); setDialogOpen(false); toast.success("Slitter adicionada!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Slitter.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["slitters"] }); setDialogOpen(false); setEditItem(null); toast.success("Slitter atualizada!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Slitter.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["slitters"] }); setDeleteItem(null); toast.success("Slitter excluída!"); },
  });

  const handleSave = (data) => {
    if (editItem) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const ativas = slitters.filter(s => s.status !== "arquivado");
  const arquivadas = slitters.filter(s => s.status === "arquivado");
  const totalPeso = ativas.reduce((s, b) => s + (b.peso_kg || 0), 0);

  // Cálculo agregado de barras
  const DENSIDADE_ACO = 7850;
  const totalBarrasPotencial = ativas.reduce((total, s) => {
    if (!s.materiais_producao || !s.peso_kg || !s.largura_mm || !s.espessura_mm) return total;
    const materiais = s.materiais_producao.split("/").map(m => m.trim()).filter(Boolean);
    let maxBarras = 0;
    materiais.forEach(mat => {
      const match = mat.match(/^(\d+)\s*[xX]\s*(\d+)/);
      if (!match) return;
      const stripW = Number(match[1]);
      const largM = s.largura_mm / 1000;
      const espM = s.espessura_mm / 1000;
      const compBobina = s.peso_kg / (largM * espM * DENSIDADE_ACO);
      const tiras = Math.floor(s.largura_mm / stripW);
      const totalLinha = compBobina * tiras;
      const barras = Math.floor(totalLinha / 6);
      if (barras > maxBarras) maxBarras = barras;
    });
    return total + maxBarras;
  }, 0);

  const filtered = slitters.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.codigo?.toLowerCase().includes(q) || s.nf?.toLowerCase().includes(q) ||
      s.qualidade?.toLowerCase().includes(q) || s.materiais_producao?.toLowerCase().includes(q);
    const matchQualidade = filtroQualidade === "todas" || s.qualidade === filtroQualidade;
    return matchSearch && matchQualidade;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Slitter</h1>
            <Badge variant="outline">Corte e Dobra</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Controle de bobinas slitter e seus materiais de produção</p>
        </div>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Slitter
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
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <BarChart3 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalBarrasPotencial.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">Barras Potencial (6m)</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4 text-center">
          <Archive className="w-5 h-5 text-orange-400 mx-auto mb-1" />
          <p className="text-2xl font-bold">{arquivadas.length}</p>
          <p className="text-xs text-muted-foreground">Arquivadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por código, NF, qualidade, materiais..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtroQualidade !== "todas" && (
            <Button variant="ghost" size="sm" onClick={() => { setFiltroQualidade("todas"); setSearch(""); }}
              className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3 h-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filtroQualidade} onValueChange={setFiltroQualidade}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Qualidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="GV">GV</SelectItem>
              <SelectItem value="FF">FF</SelectItem>
              <SelectItem value="PP">PP</SelectItem>
              <SelectItem value="FQ">FQ</SelectItem>
              <SelectItem value="GL (IMP)">GL (IMP)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground ml-auto">
            {filtered.length} de {slitters.length} slitters
          </p>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhuma slitter encontrada" description="Adicione bobinas slitter ao estoque." onAdd={() => { setEditItem(null); setDialogOpen(true); }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(slitter => (
            <SlitterCard
              key={slitter.id}
              slitter={slitter}
              onEdit={(s) => { setEditItem(s); setDialogOpen(true); }}
              onDelete={(s) => setDeleteItem(s)}
            />
          ))}
        </div>
      )}

      <SlitterFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
        proximoCodigo={proximoCodigo}
      />
      <DeleteConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteMutation.mutate(deleteItem.id)}
        itemName={deleteItem ? `${deleteItem.codigo} - ${deleteItem.qualidade}` : ""}
      />
    </div>
  );
}