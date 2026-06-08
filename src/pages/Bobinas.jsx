import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Pencil, Trash2, Archive, ArchiveRestore,
  AlertTriangle, Clock, TrendingDown, Package, Weight, Ruler,
  CalendarDays, FileCheck, ShieldCheck, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
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

const qualidadeColors = {
  "GV": "bg-blue-100 text-blue-800 border-blue-300",
  "PP": "bg-pink-100 text-pink-800 border-pink-300",
  "FF": "bg-gray-100 text-gray-700 border-gray-300",
  "FQ": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "ALZ": "bg-orange-100 text-orange-800 border-orange-300",
};

const qualidadeNomes = {
  "GV": "Galvanizado",
  "PP": "Pré-pintado",
  "FF": "Fundo Fosco",
  "FQ": "Fundo Quente",
  "ALZ": "Aluminizada (Imp.)",
};

function getPorcentagemUso(bobina) {
  if (!bobina.peso_inicial || !bobina.peso_kg) return null;
  const usado = bobina.peso_inicial - bobina.peso_kg;
  return Math.min(100, Math.max(0, (usado / bobina.peso_inicial) * 100));
}

function getPrevisaoAcabar(bobina) {
  if (!bobina.consumo_diario_kg || !bobina.peso_kg || bobina.consumo_diario_kg <= 0) return null;
  const dias = Math.round(bobina.peso_kg / bobina.consumo_diario_kg);
  return dias;
}

function getAlertaNivel(bobina) {
  if (!bobina.estoque_minimo_kg || !bobina.peso_kg) return null;
  if (bobina.peso_kg <= bobina.estoque_minimo_kg) return "critico";
  if (bobina.peso_kg <= bobina.estoque_minimo_kg * 1.3) return "atencao";
  return null;
}

function BarraProgresso({ pct, alerta }) {
  const cor = alerta === "critico" ? "bg-red-500" : alerta === "atencao" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function BobinaCard({ bobina, onEdit, onDelete, onArquivar }) {
  const [expandido, setExpandido] = useState(false);
  const pctUso = getPorcentagemUso(bobina);
  const pctRestante = pctUso !== null ? 100 - pctUso : null;
  const diasRestantes = getPrevisaoAcabar(bobina);
  const alerta = getAlertaNivel(bobina);
  const custoTotal = bobina.custo && bobina.peso_kg ? bobina.custo * bobina.peso_kg : null;

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm hover:shadow-md transition-all ${alerta === "critico" ? "border-red-300" : alerta === "atencao" ? "border-amber-300" : "border-border"}`}>
      {/* Alerta topo */}
      {alerta && (
        <div className={`px-4 py-2 rounded-t-xl flex items-center gap-2 text-xs font-semibold ${alerta === "critico" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          {alerta === "critico" ? "⚠ Estoque abaixo do mínimo!" : "⚠ Estoque próximo do mínimo"}
          {diasRestantes !== null && <span className="ml-auto">Previsão: {diasRestantes} dias</span>}
        </div>
      )}

      <div className="p-4">
        {/* Linha principal */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-gray-900">{bobina.cor}</span>
              {bobina.qualidade && (
                <Badge variant="outline" className={`text-xs font-bold ${qualidadeColors[bobina.qualidade] || ""}`}>
                  {bobina.qualidade} · {qualidadeNomes[bobina.qualidade] || bobina.qualidade}
                </Badge>
              )}
              {bobina.status && (
                <Badge variant="outline" className={`text-xs ${statusColors[bobina.status] || ""}`}>{bobina.status}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {bobina.codigo && <span className="font-mono font-semibold text-gray-700">{bobina.codigo}</span>}
              <span>Chapa: <strong className="text-gray-700">{bobina.chapa} mm</strong></span>
              {bobina.largura_mm && <span>Largura: <strong className="text-gray-700">{bobina.largura_mm} mm</strong></span>}
              {bobina.fornecedor && <span>· {bobina.fornecedor}</span>}
              {bobina.data_recebimento && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{bobina.data_recebimento}</span>}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1 shrink-0">
            {!bobina.arquivada ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700" title="Arquivar" onClick={() => onArquivar(bobina.id, true)}>
                <Archive className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" title="Restaurar" onClick={() => onArquivar(bobina.id, false)}>
                <ArchiveRestore className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(bobina)}><Pencil className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(bobina)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Métricas principais */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Weight className="w-3 h-3" />Peso Atual</p>
            <p className="text-lg font-bold text-gray-900">{bobina.peso_kg ? `${bobina.peso_kg.toLocaleString("pt-BR")}` : "—"}</p>
            <p className="text-xs text-muted-foreground">kg</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Ruler className="w-3 h-3" />Metragem</p>
            <p className="text-lg font-bold text-gray-900">{bobina.metragem ? `${bobina.metragem.toLocaleString("pt-BR")}` : "—"}</p>
            <p className="text-xs text-muted-foreground">metros</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${alerta === "critico" ? "bg-red-50" : alerta === "atencao" ? "bg-amber-50" : "bg-gray-50"}`}>
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" />Estoque Mín.</p>
            <p className={`text-lg font-bold ${alerta === "critico" ? "text-red-700" : alerta === "atencao" ? "text-amber-700" : "text-gray-900"}`}>
              {bobina.estoque_minimo_kg ? `${bobina.estoque_minimo_kg.toLocaleString("pt-BR")}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">kg</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${diasRestantes !== null && diasRestantes <= 7 ? "bg-red-50" : diasRestantes !== null && diasRestantes <= 15 ? "bg-amber-50" : "bg-gray-50"}`}>
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3" />Previsão</p>
            <p className={`text-lg font-bold ${diasRestantes !== null && diasRestantes <= 7 ? "text-red-700" : diasRestantes !== null && diasRestantes <= 15 ? "text-amber-700" : "text-gray-900"}`}>
              {diasRestantes !== null ? diasRestantes : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{diasRestantes !== null ? "dias" : "sem consumo"}</p>
          </div>
        </div>

        {/* Barra de uso */}
        {pctRestante !== null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Consumido: {pctUso.toFixed(0)}%</span>
              <span className="font-semibold text-gray-700">Restante: {pctRestante.toFixed(0)}%</span>
              {bobina.peso_inicial && <span>Inicial: {bobina.peso_inicial.toLocaleString("pt-BR")} kg</span>}
            </div>
            <BarraProgresso pct={pctRestante} alerta={alerta} />
          </div>
        )}

        {/* Expandir detalhes */}
        <button
          onClick={() => setExpandido(!expandido)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expandido ? "Menos detalhes" : "Mais detalhes"}
        </button>

        {/* Detalhes expandidos */}
        {expandido && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {bobina.nf && <div><span className="text-muted-foreground">NF:</span> <strong>{bobina.nf}</strong></div>}
              {bobina.custo && <div><span className="text-muted-foreground">Custo/kg:</span> <strong>R$ {Number(bobina.custo).toFixed(2)}</strong></div>}
              {custoTotal && <div><span className="text-muted-foreground">Valor estoque:</span> <strong>R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>}
              {bobina.consumo_diario_kg && <div><span className="text-muted-foreground">Consumo/dia:</span> <strong>{bobina.consumo_diario_kg} kg</strong></div>}
              {bobina.metragem_restante && <div><span className="text-muted-foreground">Metragem restante:</span> <strong>{bobina.metragem_restante} m</strong></div>}
              {bobina.data_encerramento && <div><span className="text-muted-foreground">Encerrada em:</span> <strong>{bobina.data_encerramento}</strong></div>}
            </div>
            {bobina.observacoes && (
              <p className="text-xs text-muted-foreground bg-gray-50 rounded-lg px-3 py-2">{bobina.observacoes}</p>
            )}
            {/* Anexos */}
            <div className="flex gap-2 flex-wrap">
              {bobina.anexo_nf_url && (
                <a href={bobina.anexo_nf_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium">
                  <FileCheck className="w-3.5 h-3.5" /> NF
                </a>
              )}
              {bobina.anexo_cert_url && (
                <a href={bobina.anexo_cert_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" /> Certificado
                </a>
              )}
              {bobina.anexo_cert_ausencia && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 font-medium">
                  ⚠ Sem cert. — {bobina.anexo_cert_ausencia}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Bobinas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAlerta, setFilterAlerta] = useState(false);
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
  const emAlerta = ativas.filter(b => getAlertaNivel(b) !== null);
  const statusList = [...new Set(ativas.map(b => b.status).filter(Boolean))].sort();

  const base = showArquivadas ? arquivadas : ativas;
  const filtered = base.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q) ||
      b.codigo?.toLowerCase().includes(q) || b.fornecedor?.toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q) || b.qualidade?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    const matchAlerta = !filterAlerta || getAlertaNivel(b) !== null;
    return matchSearch && matchStatus && matchAlerta;
  });

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
          <Input placeholder="Buscar por cor, chapa, código..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={showArquivadas ? "default" : "outline"} size="sm"
            onClick={() => { setShowArquivadas(!showArquivadas); setFilterStatus("all"); setFilterAlerta(false); }} className="gap-1">
            <Archive className="w-3 h-3" />
            {showArquivadas ? "Ver em estoque" : `Arquivadas (${arquivadas.length})`}
          </Button>
          {!showArquivadas && (
            <>
              {emAlerta.length > 0 && (
                <Button variant={filterAlerta ? "destructive" : "outline"} size="sm"
                  onClick={() => setFilterAlerta(!filterAlerta)} className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Alertas ({emAlerta.length})
                </Button>
              )}
              <Button variant={filterStatus === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterStatus("all")}>Todas</Button>
              {statusList.map(s => (
                <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>{s}</Button>
              ))}
            </>
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
          {filtered.map((bobina) => (
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

      <BobinaFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditItem(null); }} onSave={handleSave} editItem={editItem} />
      <DeleteConfirmDialog open={!!deleteItem} onClose={() => setDeleteItem(null)} onConfirm={() => deleteMutation.mutate(deleteItem.id)} itemName={deleteItem ? `${deleteItem.cor} - ${deleteItem.chapa}` : ""} />
    </div>
  );
}