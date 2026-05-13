import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Circle, Weight, Ruler, CalendarDays, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import StatsCard from "@/components/stock/StatsCard";
import BobinaFormDialog from "@/components/bobinas/BobinaFormDialog";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";

const statusColors = {
  "Aberta": "bg-green-500/10 text-green-700 border-green-300",
  "Fechada": "bg-gray-500/10 text-gray-600 border-gray-300",
  "Finalizada": "bg-blue-500/10 text-blue-700 border-blue-300",
  "Na TP40": "bg-amber-500/10 text-amber-700 border-amber-300",
  "Na BOBININHA": "bg-purple-500/10 text-purple-700 border-purple-300",
  "Matriz AJL": "bg-orange-500/10 text-orange-700 border-orange-300",
  "Pinhais": "bg-teal-500/10 text-teal-700 border-teal-300",
  "Ivaiporã": "bg-rose-500/10 text-rose-700 border-rose-300",
  "Matriz - Frisada": "bg-indigo-500/10 text-indigo-700 border-indigo-300",
  "RESERVADA": "bg-yellow-500/10 text-yellow-700 border-yellow-300",
};

const qualidadeBadge = {
  "GV": "bg-blue-100 text-blue-800",
  "PP": "bg-pink-100 text-pink-800",
  "FF": "bg-gray-100 text-gray-700",
  "FQ": "bg-emerald-100 text-emerald-800",
};

export default function Bobinas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showArquivadas, setShowArquivadas] = useState(false);
  const queryClient = useQueryClient();

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["bobinas"],
    queryFn: () => base44.entities.Bobina.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Bobina.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas"] }); setDialogOpen(false); toast.success("Bobina adicionada!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bobina.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas"] }); setDialogOpen(false); setEditItem(null); toast.success("Bobina atualizada!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bobina.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas"] }); setDeleteItem(null); toast.success("Bobina excluída!"); },
  });

  const arquivarMutation = useMutation({
    mutationFn: ({ id, arquivada }) => base44.entities.Bobina.update(id, {
      arquivada,
      data_encerramento: arquivada ? new Date().toISOString().split("T")[0] : null,
      status: arquivada ? "Finalizada" : undefined,
    }),
    onSuccess: (_, { arquivada }) => {
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
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
  const statusList = [...new Set(ativas.map(b => b.status).filter(Boolean))].sort();

  const base = showArquivadas ? arquivadas : ativas;
  const filtered = base.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q) ||
      b.codigo?.toLowerCase().includes(q) || b.fornecedor?.toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q) || b.qualidade?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const abertas = ativas.filter(b => b.status === "Aberta").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Bobinas</h1>
            <Badge variant="outline">Telhas</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Bobinas de aço para produção de telhas</p>
        </div>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Bobina
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Em Estoque" value={ativas.length} subtitle={`${abertas} abertas`} icon={Circle} color="blue" />
        <StatsCard title="Peso Total" value={`${totalPeso.toLocaleString("pt-BR")} kg`} subtitle="peso líquido em estoque" icon={Weight} color="green" />
        <StatsCard title="Arquivadas" value={arquivadas.length} subtitle="bobinas finalizadas" icon={Archive} color="orange" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por cor, chapa, código..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showArquivadas ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowArquivadas(!showArquivadas); setFilterStatus("all"); }}
            className="gap-1"
          >
            <Archive className="w-3 h-3" />
            {showArquivadas ? "Ver em estoque" : `Arquivadas (${arquivadas.length})`}
          </Button>
          {!showArquivadas && (
            <>
              <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("all")}>Todas</Button>
              {statusList.map(s => (
                <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>{s}</Button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Table-style list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhuma bobina encontrada" description="Adicione bobinas ao estoque." onAdd={() => { setEditItem(null); setDialogOpen(true); }} />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
            <span>Cor / Fornecedor</span>
            <span>Chapa / Qualidade</span>
            <span>Peso (kg)</span>
            <span>Metragem</span>
            <span>Código</span>
            <span>Status</span>
            <span></span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((bobina) => (
              <div key={bobina.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
                {/* Cor / Fornecedor */}
                <div>
                  <p className="font-semibold text-sm">{bobina.cor}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {bobina.data_recebimento && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{bobina.data_recebimento}</span>}
                    {bobina.fornecedor && <span>· {bobina.fornecedor}</span>}
                  </div>
                </div>
                {/* Chapa / Qualidade */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{bobina.chapa}</span>
                  {bobina.qualidade && <Badge variant="outline" className={`text-xs ${qualidadeBadge[bobina.qualidade] || ""}`}>{bobina.qualidade}</Badge>}
                </div>
                {/* Peso */}
                <div>
                  <p className="text-sm font-semibold">{bobina.peso_kg ? `${bobina.peso_kg.toLocaleString("pt-BR")}` : "-"}</p>
                  {bobina.peso_inicial && bobina.peso_inicial !== bobina.peso_kg && (
                    <p className="text-xs text-muted-foreground">Inicial: {bobina.peso_inicial.toLocaleString("pt-BR")}</p>
                  )}
                </div>
                {/* Metragem */}
                <div className="text-sm">{bobina.metragem ? `${bobina.metragem.toLocaleString("pt-BR")}m` : "-"}</div>
                {/* Código */}
                <div className="text-xs text-muted-foreground">
                  <p>{bobina.codigo || "-"}</p>
                  {bobina.nf && <p>NF: {bobina.nf}</p>}
                </div>
                {/* Status */}
                <div>
                  {bobina.status && (
                    <Badge variant="outline" className={`text-xs ${statusColors[bobina.status] || ""}`}>{bobina.status}</Badge>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!bobina.arquivada ? (
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700"
                      title="Arquivar bobina (acabou)"
                      onClick={() => arquivarMutation.mutate({ id: bobina.id, arquivada: true })}
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700"
                      title="Restaurar bobina"
                      onClick={() => arquivarMutation.mutate({ id: bobina.id, arquivada: false })}
                    >
                      <ArchiveRestore className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditItem(bobina); setDialogOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteItem(bobina)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <BobinaFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditItem(null); }} onSave={handleSave} editItem={editItem} />
      <DeleteConfirmDialog open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={() => deleteMutation.mutate(deleteItem.id)} itemName={deleteItem ? `${deleteItem.cor} - ${deleteItem.chapa}` : ""} />
    </div>
  );
}