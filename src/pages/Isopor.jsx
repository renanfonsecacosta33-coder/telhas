import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Snowflake, Ruler, Package, Calculator, History, MinusCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import StatsCard from "@/components/stock/StatsCard";
import IsoporFormDialog from "@/components/isopor/IsoporFormDialog";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";
import UsarIsoporDialog from "@/components/isopor/UsarIsoporDialog";
import HistoricoIsoporDialog from "@/components/isopor/HistoricoIsoporDialog";

export default function Isopor() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [usarOpen, setUsarOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: isopores = [], isLoading } = useQuery({
    queryKey: ["isopores"],
    queryFn: () => base44.entities.Isopor.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Isopor.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isopores"] });
      setDialogOpen(false);
      toast.success("Isopor adicionado!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Isopor.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isopores"] });
      setDialogOpen(false);
      setEditItem(null);
      toast.success("Isopor atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Isopor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["isopores"] });
      setDeleteItem(null);
      toast.success("Isopor excluído!");
    },
  });

  const handleSave = (data) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleUsarIsopor = async (usoData, isoporObj) => {
    // Registra o uso no histórico
    await base44.entities.UsoIsopor.create(usoData);
    // Desconta do estoque
    const novaQtd = (isoporObj.quantidade || 0) - usoData.quantidade;
    const novaMetragem = novaQtd * 2; // cada placa = 2m
    await base44.entities.Isopor.update(isoporObj.id, {
      quantidade: novaQtd,
      metragem_total: novaMetragem,
    });
    queryClient.invalidateQueries({ queryKey: ["isopores"] });
    setUsarOpen(false);
    toast.success(`${usoData.quantidade} placas descontadas do estoque!`);
  };

  const totalQuantidade = isopores.reduce((sum, i) => sum + (i.quantidade || 0), 0);
  const totalMetragem = isopores.reduce((sum, i) => sum + (i.metragem_total || 0), 0);
  const tipos = [...new Set(isopores.map((i) => i.tipo))];

  const filtered = isopores.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch =
      item.tipo?.toLowerCase().includes(q) ||
      item.observacoes?.toLowerCase().includes(q);
    const matchTipo = filterTipo === "all" || item.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const tipoColors = {
    "EPS - TP 25": "bg-blue-500/10 text-blue-700 border-blue-200",
    "EPS - TP 40": "bg-green-500/10 text-green-700 border-green-200",
    "EPS - TP 40 BANDEJA": "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    "EPS - COLONIAL": "bg-amber-500/10 text-amber-700 border-amber-200",
    "EPS - COLONIAL BANDEJA": "bg-orange-500/10 text-orange-700 border-orange-200",
    "EPS - ONDULADO": "bg-purple-500/10 text-purple-700 border-purple-200",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Isopor</h1>
            <Badge className="bg-accent text-accent-foreground">Foco</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Gerencie o estoque de isopor EPS</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setHistoricoOpen(true)} className="gap-2">
            <History className="w-4 h-4" />
            Histórico
          </Button>
          <Link to="/calculadora-isopor">
            <Button variant="outline" className="gap-2">
              <Calculator className="w-4 h-4" />
              Calculadora
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setUsarOpen(true)} className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50">
            <MinusCircle className="w-4 h-4" />
            Usar Isopor
          </Button>
          <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Isopor
          </Button>
        </div>
      </div>

      {/* Stats globais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Tipos Cadastrados"
          value={isopores.length}
          subtitle="modelos de EPS"
          icon={Snowflake}
          color="blue"
        />
        <StatsCard
          title="Quantidade Total"
          value={totalQuantidade}
          subtitle="placas em estoque"
          icon={Package}
          color="green"
        />
        <StatsCard
          title="Metragem Total"
          value={`${totalMetragem}m`}
          subtitle={`${(totalMetragem / 1000).toFixed(1)}km linear`}
          icon={Ruler}
          color="orange"
        />
      </div>

      {/* KPIs por modelo */}
      {isopores.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Snowflake className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Estoque por Modelo</h2>
          </div>
          <div className="divide-y divide-border">
            {isopores.map((item) => {
              const pct = totalQuantidade > 0 ? (item.quantidade || 0) / totalQuantidade * 100 : 0;
              const baixo = (item.quantidade || 0) < 20;
              const critico = (item.quantidade || 0) < 5;
              return (
                <div key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${critico ? "bg-red-500" : baixo ? "bg-amber-400" : "bg-green-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{item.tipo}</span>
                        {item.espessura_mm && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.espessura_mm}mm</span>}
                        {critico && <span className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertTriangle className="w-3 h-3" />Crítico</span>}
                        {baixo && !critico && <span className="text-xs text-amber-600 font-semibold">Baixo</span>}
                        {!baixo && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" />OK</span>}
                      </div>
                      {/* Barra de progresso */}
                      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden w-full max-w-xs">
                        <div
                          className={`h-full rounded-full transition-all ${critico ? "bg-red-500" : baixo ? "bg-amber-400" : "bg-green-500"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 text-right sm:text-left">
                    <div>
                      <p className="text-lg font-bold">{item.quantidade || 0}</p>
                      <p className="text-xs text-muted-foreground">placas</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">{(item.metragem_total || 0)}m</p>
                      <p className="text-xs text-muted-foreground">metragem</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">{pct.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">do total</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por tipo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterTipo === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterTipo("all")}
          >
            Todos
          </Button>
          {tipos.map((tipo) => (
            <Button
              key={tipo}
              variant={filterTipo === tipo ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterTipo(tipo)}
            >
              {tipo.replace("EPS - ", "")}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum isopor encontrado"
          description="Adicione isopor ao estoque para começar a gerenciar."
          onAdd={() => { setEditItem(null); setDialogOpen(true); }}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Snowflake className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{item.tipo}</p>
                      <Badge variant="outline" className={tipoColors[item.tipo] || ""}>
                        {item.tipo.replace("EPS - ", "")}
                      </Badge>
                    </div>
                    {item.observacoes && (
                      <p className="text-sm text-muted-foreground truncate">{item.observacoes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {item.espessura_mm && (
                    <Badge variant="secondary">{item.espessura_mm}mm</Badge>
                  )}
                  {item.quantidade && (
                    <Badge variant="outline" className="font-semibold">
                      {item.quantidade} un
                    </Badge>
                  )}
                  {item.metragem_total && (
                    <Badge className="bg-primary/10 text-primary border border-primary/20">
                      {item.metragem_total}m
                    </Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditItem(item); setDialogOpen(true); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteItem(item)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <IsoporFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
      />

      <DeleteConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteMutation.mutate(deleteItem.id)}
        itemName={deleteItem ? deleteItem.tipo : ""}
      />

      <UsarIsoporDialog
        open={usarOpen}
        onClose={() => setUsarOpen(false)}
        onConfirm={handleUsarIsopor}
        isopores={isopores}
      />

      <HistoricoIsoporDialog
        open={historicoOpen}
        onClose={() => setHistoricoOpen(false)}
      />
    </div>
  );
}