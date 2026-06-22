import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Package, Weight, Archive, X, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import BobinaFormDialog from "@/components/bobinas/BobinaFormDialog";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";
import BobinaCard, { getAlertaNivel } from "@/components/bobinas/BobinaCardShared";
import PainelSolicitacoesReserva from "@/components/vendedor/PainelSolicitacoesReserva";

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

export default function Bobinas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAlerta, setFilterAlerta] = useState(false);
  const [showArquivadas, setShowArquivadas] = useState(false);
  const [filtroQualidade, setFiltroQualidade] = useState("todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const queryClient = useQueryClient();

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["bobinas"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "telhas" }, "-created_date", 500),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Bobina.create(data);
      if (!result || !result.id) throw new Error("Resposta inesperada do servidor");
      return result;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas"] }); queryClient.refetchQueries({ queryKey: ["bobinas"] }); setDialogOpen(false); setEditItem(null); toast.success("Bobina adicionada!"); },
    onError: (err) => {
      console.error("Erro ao adicionar bobina:", err);
      let msg = "Erro ao adicionar bobina";
      try {
        msg = err?.response?.data?.detail || err?.response?.data?.message || err?.response?.data?.error || err?.detail || err?.message || JSON.stringify(err?.response?.data || err);
      } catch (e) {}
      toast.error(String(msg).substring(0, 200));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bobina.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas"] }); queryClient.refetchQueries({ queryKey: ["bobinas"] }); setDialogOpen(false); setEditItem(null); toast.success("Bobina atualizada!"); },
    onError: (err) => {
      console.error("Erro ao atualizar bobina:", err);
      let msg = "Erro ao atualizar bobina";
      try {
        msg = err?.response?.data?.detail || err?.response?.data?.message || err?.response?.data?.error || err?.detail || err?.message || JSON.stringify(err?.response?.data || err);
      } catch (e) {}
      toast.error(String(msg).substring(0, 200));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bobina.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas"] }); queryClient.refetchQueries({ queryKey: ["bobinas"] }); setDeleteItem(null); toast.success("Bobina excluída!"); },
  });

  const arquivarMutation = useMutation({
    mutationFn: ({ id, arquivada }) => base44.entities.Bobina.update(id, {
      arquivada,
      data_encerramento: arquivada ? new Date().toISOString().split("T")[0] : null,
      status: arquivada ? "Finalizada" : undefined,
    }),
    onSuccess: (_, { arquivada }) => {
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      queryClient.refetchQueries({ queryKey: ["bobinas"] });
      toast.success(arquivada ? "Bobina arquivada!" : "Bobina restaurada!");
    },
  });

  const handleSave = (data) => {
    try {
      if (editItem) updateMutation.mutate({ id: editItem.id, data });
      else createMutation.mutate(data);
    } catch (e) {
      console.error("Erro síncrono ao salvar:", e);
      toast.error("Erro ao salvar: " + (e?.message || String(e)));
    }
  };

  const ativas = bobinas.filter(b => !b.arquivada);
  const arquivadas = bobinas.filter(b => b.arquivada);
  const totalPeso = ativas.reduce((s, b) => s + (b.peso_kg || 0), 0);
  const emAlerta = ativas.filter(b => getAlertaNivel(b) !== null);
  const reservadas = ativas.filter(b => b.reservada);
  const statusList = [...new Set(ativas.map(b => b.status).filter(Boolean))].sort();

  const base = showArquivadas ? arquivadas : ativas;
  const filtered = base.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q) ||
      b.codigo?.toLowerCase().includes(q) || b.fornecedor?.toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q) || b.qualidade?.toLowerCase().includes(q) ||
      b.nf?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    const matchAlerta = !filterAlerta || getAlertaNivel(b) !== null;
    const matchQualidade = filtroQualidade === "todos" || b.qualidade === filtroQualidade;
    const matchFornecedor = !filtroFornecedor || (b.fornecedor || "").toLowerCase().includes(filtroFornecedor.toLowerCase());
    return matchSearch && matchStatus && matchAlerta && matchQualidade && matchFornecedor;
  });

  const temFiltrosExtras = filtroQualidade !== "todos" || !!filtroFornecedor;
  const limparFiltros = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterAlerta(false);
    setFiltroQualidade("todos");
    setFiltroFornecedor("");
  };

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
        <div className={`border rounded-xl p-4 text-center ${reservadas.length > 0 ? "bg-purple-50 border-purple-300" : "bg-white border-border"}`}>
          <Archive className={`w-5 h-5 mx-auto mb-1 ${reservadas.length > 0 ? "text-purple-500" : "text-gray-400"}`} />
          <p className={`text-2xl font-bold ${reservadas.length > 0 ? "text-purple-700" : ""}`}>{reservadas.length}</p>
          <p className="text-xs text-muted-foreground">Reservadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por cor, chapa, código, fornecedor, NF..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {(temFiltrosExtras || filterAlerta) && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3 h-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant={showArquivadas ? "default" : "outline"} size="sm"
            onClick={() => { setShowArquivadas(!showArquivadas); setFilterStatus("all"); setFilterAlerta(false); }} className="gap-1 h-8 text-xs">
            <Archive className="w-3 h-3" />
            {showArquivadas ? "Ver em estoque" : `Arquivadas (${arquivadas.length})`}
          </Button>
          {!showArquivadas && (
            <>
              {emAlerta.length > 0 && (
                <Button variant={filterAlerta ? "destructive" : "outline"} size="sm"
                  onClick={() => setFilterAlerta(!filterAlerta)} className="gap-1 h-8 text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  Alertas ({emAlerta.length})
                </Button>
              )}
              <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("all")}
                className="h-8 text-xs">Todas</Button>
              {statusList.map(s => (
                <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm"
                  onClick={() => setFilterStatus(s)} className="h-8 text-xs">{s}</Button>
              ))}
            </>
          )}
          <Select value={filtroQualidade} onValueChange={setFiltroQualidade}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Qualidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="GV">GV</SelectItem>
              <SelectItem value="FF">FF</SelectItem>
              <SelectItem value="PP">PP</SelectItem>
              <SelectItem value="FQ">FQ</SelectItem>
              <SelectItem value="GL (IMP)">GL (IMP)</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-40">
            <Input
              placeholder="Filtrar fornecedor..."
              className="h-8 text-xs pl-2"
              value={filtroFornecedor}
              onChange={e => setFiltroFornecedor(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground ml-auto">
            {filtered.length} de {base.length} bobinas
          </p>
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
          {filtered.map((bobina) => (
            <BobinaCard
              key={bobina.id}
              bobina={bobina}
              statusColors={statusColors}
              onEdit={(b) => { setEditItem(b); setDialogOpen(true); }}
              onDelete={(b) => setDeleteItem(b)}
              onArquivar={(id, val) => arquivarMutation.mutate({ id, arquivada: val })}
            />
          ))}
        </div>
      )}

      {/* Painel de solicitações de reserva dos vendedores */}
      <div className="mt-6">
        <PainelSolicitacoesReserva setor="telhas" />
      </div>

      <BobinaFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditItem(null); }} onSave={handleSave} editItem={editItem} saving={createMutation.isPending || updateMutation.isPending} />
      <DeleteConfirmDialog open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={() => deleteMutation.mutate(deleteItem.id)} itemName={deleteItem ? `${deleteItem.cor} - ${deleteItem.chapa}` : ""} />
    </div>
  );
}