import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Pencil, Trash2, Droplets, Package, Calculator,
  History, MinusCircle, AlertTriangle, CheckCircle2, Settings2,
  TrendingDown, BarChart2
} from "lucide-react";
import { toast } from "sonner";
import StatsCard from "@/components/stock/StatsCard";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";
import ColaFormDialog from "@/components/cola/ColaFormDialog";
import UsarColaDialog from "@/components/cola/UsarColaDialog";
import HistoricoColaDialog from "@/components/cola/HistoricoColaDialog";
import CalculadoraColaInline from "@/components/cola/CalculadoraColaInline";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SACO_PESO_KG = 3.75;
const TAMBOR_PESO_KG = 200;

export default function Cola() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [usarOpen, setUsarOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [limites, setLimites] = useState(() => {
    try {
      const saved = localStorage.getItem("cola_limites");
      return saved ? JSON.parse(saved) : { critico: 10, baixo: 30 };
    } catch { return { critico: 10, baixo: 30 }; }
  });
  const [editandoLimites, setEditandoLimites] = useState(false);
  const [limitesForm, setLimitesForm] = useState(limites);

  const queryClient = useQueryClient();

  const { data: colas = [], isLoading } = useQuery({
    queryKey: ["colas"],
    queryFn: () => base44.entities.Cola.list("-created_date"),
  });

  const { data: usosCola = [] } = useQuery({
    queryKey: ["usos-cola"],
    queryFn: () => base44.entities.UsosCola.list("-data_uso", 30),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cola.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colas"] });
      setDialogOpen(false);
      toast.success("Cola adicionada!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cola.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colas"] });
      setDialogOpen(false);
      setEditItem(null);
      toast.success("Cola atualizada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cola.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["colas"] });
      setDeleteItem(null);
      toast.success("Cola excluída!");
    },
  });

  const handleSave = (data) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleUsarCola = async (usoData, colaObj) => {
    await base44.entities.UsosCola.create(usoData);
    const novosSacos = (colaObj.sacos_qtd || 0) - usoData.sacos_usados;
    const novoKgTotal = novosSacos * SACO_PESO_KG;
    await base44.entities.Cola.update(colaObj.id, {
      sacos_qtd: novosSacos,
      kg_total: novoKgTotal,
    });
    queryClient.invalidateQueries({ queryKey: ["colas"] });
    queryClient.invalidateQueries({ queryKey: ["usos-cola"] });
    setUsarOpen(false);
    toast.success(`${usoData.sacos_usados} sacos (${usoData.kg_usados.toFixed(2)}kg) descontados!`);
  };

  const totalSacos = colas.reduce((s, c) => s + (c.sacos_qtd || 0), 0);
  const totalKg = colas.reduce((s, c) => s + (c.kg_total || 0), 0);
  const totalTambores = colas.reduce((s, c) => s + (c.tambores_qtd || 0), 0);
  const totalSacosUsados30d = usosCola.reduce((s, u) => s + (u.sacos_usados || 0), 0);
  const totalKgUsados30d = usosCola.reduce((s, u) => s + (u.kg_usados || 0), 0);

  const filtered = colas.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.tipo?.toLowerCase().includes(q) ||
      c.fornecedor?.toLowerCase().includes(q) ||
      c.lote?.toLowerCase().includes(q)
    );
  });

  const handleSaveLimites = () => {
    const c = Number(limitesForm.critico);
    const b = Number(limitesForm.baixo);
    if (c >= b) { toast.error("Crítico deve ser menor que Baixo."); return; }
    setLimites({ critico: c, baixo: b });
    localStorage.setItem("cola_limites", JSON.stringify({ critico: c, baixo: b }));
    setEditandoLimites(false);
    toast.success("Limites atualizados!");
  };

  // Estoque por tipo para o painel de KPIs
  const tiposData = colas.map((c) => {
    const baixo = (c.sacos_qtd || 0) < limites.baixo;
    const critico = (c.sacos_qtd || 0) < limites.critico;
    return { ...c, baixo, critico };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Cola</h1>
            <Badge className="bg-orange-500/10 text-orange-700 border border-orange-200">Estoque</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Gerencie tambores e sacos de cola para colagem</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setHistoricoOpen(true)} className="gap-2">
            <History className="w-4 h-4" />
            Histórico
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCalc((v) => !v)}
            className={`gap-2 ${showCalc ? "border-orange-400 text-orange-700 bg-orange-50" : ""}`}
          >
            <Calculator className="w-4 h-4" />
            Calculadora
          </Button>
          <Button
            variant="outline"
            onClick={() => setUsarOpen(true)}
            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <MinusCircle className="w-4 h-4" />
            Usar Cola
          </Button>
          <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Cola
          </Button>
        </div>
      </div>

      {/* Calculadora inline */}
      {showCalc && <CalculadoraColaInline />}

      {/* Stats globais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard
          title="Sacos em Estoque"
          value={totalSacos}
          subtitle={`${totalKg.toFixed(1)}kg total`}
          icon={Package}
          color="orange"
        />
        <StatsCard
          title="Tambores"
          value={totalTambores}
          subtitle="tambores cadastrados"
          icon={Droplets}
          color="blue"
        />
        <StatsCard
          title="Sacos Usados (30d)"
          value={totalSacosUsados30d}
          subtitle={`${totalKgUsados30d.toFixed(1)}kg consumidos`}
          icon={TrendingDown}
          color="red"
        />
        <StatsCard
          title="Tipos Cadastrados"
          value={colas.length}
          subtitle="tipos de cola"
          icon={BarChart2}
          color="green"
        />
      </div>

      {/* KPI por tipo */}
      {colas.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-orange-500" />
              <h2 className="font-semibold text-sm">Estoque por Tipo</h2>
              <span className="text-xs text-muted-foreground">
                · crítico &lt;{limites.critico} · baixo &lt;{limites.baixo} sacos
              </span>
            </div>
            <button
              onClick={() => { setLimitesForm(limites); setEditandoLimites(true); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Editar limites
            </button>
          </div>

          {editandoLimites && (
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-red-600">Crítico (sacos)</label>
                <Input
                  type="number" min="0"
                  className="h-8 w-24 text-sm"
                  value={limitesForm.critico}
                  onChange={(e) => setLimitesForm((f) => ({ ...f, critico: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-amber-600">Baixo (sacos)</label>
                <Input
                  type="number" min="1"
                  className="h-8 w-24 text-sm"
                  value={limitesForm.baixo}
                  onChange={(e) => setLimitesForm((f) => ({ ...f, baixo: e.target.value }))}
                />
              </div>
              <Button size="sm" onClick={handleSaveLimites}>Salvar</Button>
              <Button size="sm" variant="outline" onClick={() => setEditandoLimites(false)}>Cancelar</Button>
            </div>
          )}

          <div className="divide-y divide-border">
            {tiposData.map((item) => {
              const pct = totalSacos > 0 ? (item.sacos_qtd || 0) / totalSacos * 100 : 0;
              return (
                <div key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.critico ? "bg-red-500" : item.baixo ? "bg-amber-400" : "bg-green-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{item.tipo}</span>
                        {item.fornecedor && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.fornecedor}</span>}
                        {item.critico && <span className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertTriangle className="w-3 h-3" />Crítico</span>}
                        {item.baixo && !item.critico && <span className="text-xs text-amber-600 font-semibold">Baixo</span>}
                        {!item.baixo && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" />OK</span>}
                      </div>
                      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden w-full max-w-xs">
                        <div
                          className={`h-full rounded-full transition-all ${item.critico ? "bg-red-500" : item.baixo ? "bg-amber-400" : "bg-green-500"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold">{item.sacos_qtd || 0}</p>
                      <p className="text-xs text-muted-foreground">sacos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-600">{(item.kg_total || 0).toFixed(1)}kg</p>
                      <p className="text-xs text-muted-foreground">em estoque</p>
                    </div>
                    {item.tambores_qtd > 0 && (
                      <div className="text-right">
                        <p className="text-sm font-semibold text-blue-600">{item.tambores_qtd}</p>
                        <p className="text-xs text-muted-foreground">tambores</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimos usos */}
      {usosCola.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Últimos Usos</h2>
            <span className="text-xs text-muted-foreground ml-auto">últimos 30 registros</span>
          </div>
          <div className="divide-y divide-border">
            {usosCola.slice(0, 5).map((uso) => (
              <div key={uso.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{uso.cola_tipo || "Cola"}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                    {uso.pedido_info && <span>Pedido: {uso.pedido_info}</span>}
                    {uso.metros_colados && <span>📏 {uso.metros_colados}m</span>}
                    <span>{uso.data_uso ? format(new Date(uso.data_uso), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-orange-700">{uso.sacos_usados} sacos</p>
                  <p className="text-xs text-muted-foreground">{uso.kg_usados?.toFixed(2)}kg</p>
                </div>
              </div>
            ))}
          </div>
          {usosCola.length > 5 && (
            <div className="px-4 py-2 border-t border-border">
              <button onClick={() => setHistoricoOpen(true)} className="text-xs text-primary hover:underline">
                Ver todos os {usosCola.length} registros →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por tipo, fornecedor..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma cola encontrada"
          description="Adicione cola ao estoque para começar a gerenciar."
          onAdd={() => { setEditItem(null); setDialogOpen(true); }}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((item) => {
            const baixo = (item.sacos_qtd || 0) < limites.baixo;
            const critico = (item.sacos_qtd || 0) < limites.critico;
            const vencendo = item.data_validade && new Date(item.data_validade) < new Date(Date.now() + 30 * 24 * 3600 * 1000);
            return (
              <div
                key={item.id}
                className={`bg-card border rounded-xl p-4 hover:shadow-md transition-shadow ${critico ? "border-red-300" : baixo ? "border-amber-300" : "border-border"}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${critico ? "bg-red-100" : baixo ? "bg-amber-100" : "bg-orange-100"}`}>
                      <Droplets className={`w-5 h-5 ${critico ? "text-red-600" : baixo ? "text-amber-600" : "text-orange-600"}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{item.tipo}</p>
                        {critico && <Badge className="bg-red-100 text-red-700 border border-red-200 text-xs">⚠ Crítico</Badge>}
                        {baixo && !critico && <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">Baixo</Badge>}
                        {vencendo && <Badge className="bg-purple-100 text-purple-700 border border-purple-200 text-xs">Vencendo</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                        {item.fornecedor && <span>Fornecedor: {item.fornecedor}</span>}
                        {item.lote && <span>Lote: {item.lote}</span>}
                        {item.data_validade && (
                          <span className={vencendo ? "text-purple-600 font-medium" : ""}>
                            Validade: {format(new Date(item.data_validade), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {item.custo_tambor && <span>R$ {item.custo_tambor.toFixed(2)}/tambor</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {item.tambores_qtd > 0 && (
                      <Badge variant="outline" className="text-blue-700 border-blue-200">
                        {item.tambores_qtd} tambor{item.tambores_qtd > 1 ? "es" : ""}
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-semibold text-orange-700 border-orange-200">
                      {item.sacos_qtd || 0} sacos
                    </Badge>
                    <Badge className="bg-primary/10 text-primary border border-primary/20">
                      {(item.kg_total || 0).toFixed(1)}kg
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => { setEditItem(item); setDialogOpen(true); }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ColaFormDialog
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

      <UsarColaDialog
        open={usarOpen}
        onClose={() => setUsarOpen(false)}
        onConfirm={handleUsarCola}
        colas={colas}
      />

      <HistoricoColaDialog
        open={historicoOpen}
        onClose={() => setHistoricoOpen(false)}
      />
    </div>
  );
}