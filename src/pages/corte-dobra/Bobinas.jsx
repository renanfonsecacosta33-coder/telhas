import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Archive, AlertTriangle, Package, Weight, X, Loader2, Calendar, Download, History } from "lucide-react";
import { toast } from "sonner";
import BobinaFormDialogCD from "@/components/corte-dobra/BobinaFormDialogCD";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";
import BobinaCard, { getAlertaNivel } from "@/components/bobinas/BobinaCardShared";
import PainelSolicitacoesReserva from "@/components/vendedor/PainelSolicitacoesReserva";
import PainelTransferencias from "@/components/bobinas/PainelTransferencias";
import { useFilial } from "@/contexts/FilialContext";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";
import { getTimestampArquivamento, matchBobinaBuscaData, matchBobinaFiltroDataExata } from "@/lib/bobinaStatusHelper";
import { exportarPlanilhaBobinasOdoo } from "@/lib/exportarBobinasHelper";
import ExportarBobinasDialog from "@/components/bobinas/ExportarBobinasDialog";
import HistoricoReservasDialog from "@/components/bobinas/HistoricoReservasDialog";

export default function BobinasCD() {
  const { filialAtiva } = useFilial();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [filterAlerta, setFilterAlerta] = useState(false);
  const [showArquivadas, setShowArquivadas] = useState(false);
  const [filtroQualidade, setFiltroQualidade] = useState("todos");
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [ordenacao, setOrdenacao] = useState("none");
  const queryClient = useQueryClient();

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["bobinas-cd", filialAtiva],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", unidade: filialAtiva }, "-created_date", 500),
  });

  const filiaisHook = filialAtiva === "todas" ? null : [filialAtiva];
  const { preBaixaMap, statusMap, totalPreBaixaKg } = usePreBaixaBobinas("corte_dobra", filiaisHook);

  const { data: bobinasGlobais = [], refetch: refetchCodigos } = useQuery({
    queryKey: ["bobinas-cd-global-codigos"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra" }, "codigo", 2000),
    staleTime: 0,
    gcTime: 0,
  });

  // Calcula o PRÓXIMO número disponível com base em TODOS os códigos existentes (incluindo arquivados)
  const calcProximoNumero = (lista) => {
    let max = 0;
    lista.forEach(b => {
      const match = b.codigo && b.codigo.match(/^CD(\d+)$/i);
      if (match) { const n = parseInt(match[1], 10); if (n > max) max = n; }
    });
    return max + 1;
  };

  const proximoNumero = calcProximoNumero(bobinasGlobais);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // 🔒 TRAVA ANTI-DUPLICATA: Busca lista atualizada no momento do save
      const listaAtualizada = await base44.entities.Bobina.filter({ setor: "corte_dobra" }, "codigo", 2000);
      queryClient.setQueryData(["bobinas-cd-global-codigos"], listaAtualizada);

      // Verifica se o código já existe
      const codigoExiste = listaAtualizada.some(
        b => b.codigo && b.codigo.toUpperCase() === (data.codigo || "").toUpperCase()
      );

      if (codigoExiste) {
        // Gera o próximo número seguro
        const numSeguro = calcProximoNumero(listaAtualizada);
        data = { ...data, codigo: `CD${String(numSeguro).padStart(4, "0")}` };
        toast.warning(`Código duplicado detectado. Código corrigido para ${data.codigo} automaticamente.`);
      }

      const result = await base44.entities.Bobina.create(data);
      if (!result || !result.id) throw new Error("Resposta inesperada do servidor");
      return result;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] }); queryClient.refetchQueries({ queryKey: ["bobinas-cd"] }); setDialogOpen(false); toast.success("Bobina adicionada!"); },
    onError: (err) => {
      console.error("Erro ao adicionar bobina CD:", err);
      let msg = "Erro ao adicionar bobina";
      try {
        msg = err?.response?.data?.detail || err?.response?.data?.message || err?.response?.data?.error || err?.detail || err?.message || JSON.stringify(err?.response?.data || err);
      } catch (e) {}
      toast.error(String(msg).substring(0, 200));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Bobina.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] }); queryClient.refetchQueries({ queryKey: ["bobinas-cd"] }); setDialogOpen(false); setEditItem(null); toast.success("Bobina atualizada!"); },
    onError: (err) => {
      console.error("Erro ao atualizar bobina CD:", err);
      let msg = "Erro ao atualizar bobina";
      try {
        msg = err?.response?.data?.detail || err?.response?.data?.message || err?.response?.data?.error || err?.detail || err?.message || JSON.stringify(err?.response?.data || err);
      } catch (e) {}
      toast.error(String(msg).substring(0, 200));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bobina.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] }); queryClient.refetchQueries({ queryKey: ["bobinas-cd"] }); setDeleteItem(null); toast.success("Bobina excluída!"); },
  });

  const arquivarMutation = useMutation({
    mutationFn: ({ id, arquivada }) => base44.entities.Bobina.update(id, {
      arquivada,
      data_encerramento: arquivada ? new Date().toISOString().split("T")[0] : null,
    }),
    onSuccess: (_, { arquivada }) => {
      queryClient.invalidateQueries({ queryKey: ["bobinas-cd"] });
      queryClient.refetchQueries({ queryKey: ["bobinas-cd"] });
      toast.success(arquivada ? "Bobina arquivada!" : "Bobina restaurada!");
    },
  });

  const handleSave = (data) => {
    try {
      if (editItem) updateMutation.mutate({ id: editItem.id, data });
      else createMutation.mutate({ ...data, unidade: filialAtiva });
    } catch (e) {
      console.error("Erro síncrono ao salvar CD:", e);
      toast.error("Erro ao salvar: " + (e?.message || String(e)));
    }
  };

  const ativas = bobinas.filter(b => !b.arquivada);
  const arquivadas = bobinas.filter(b => b.arquivada);
  const totalPeso = ativas.reduce((s, b) => s + (b.peso_kg || 0), 0);
  const emAlerta = ativas.filter(b => getAlertaNivel(b) !== null);

  const base = showArquivadas ? arquivadas : ativas;
  const filtered = base.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q || b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q) ||
      b.codigo?.toLowerCase().includes(q) || b.fornecedor?.toLowerCase().includes(q) || b.qualidade?.toLowerCase().includes(q) ||
      b.nf?.toLowerCase().includes(q) || b.espessura_real?.toLowerCase().includes(q) || b.espessura_utilizada?.toLowerCase().includes(q) ||
      b.sub_cod?.toLowerCase().includes(q) || String(b.largura_mm || "").includes(q) || String(b.peso_kg || "").includes(q) ||
      matchBobinaBuscaData(b, q, showArquivadas);
    const matchAlerta = !filterAlerta || getAlertaNivel(b) !== null;
    const matchQualidade = filtroQualidade === "todos" || b.qualidade === filtroQualidade;
    const matchFornecedor = !filtroFornecedor || (b.fornecedor || "").toLowerCase().includes(filtroFornecedor.toLowerCase());
    const matchData = !filtroData || matchBobinaFiltroDataExata(b, filtroData, showArquivadas);
    return matchSearch && matchAlerta && matchQualidade && matchFornecedor && matchData;
  });

  // Ordenação inteligente (Prioriza data de arquivamento quando visualizando arquivadas)
  const sorted = [...filtered].sort((a, b) => {
    if (showArquivadas) {
      if (ordenacao === "data_arq_asc") {
        const da = getTimestampArquivamento(a);
        const db = getTimestampArquivamento(b);
        if (da !== db) return da - db;
      } else if (ordenacao === "codigo_asc") {
        return (a.codigo || "").localeCompare(b.codigo || "", undefined, { numeric: true });
      } else if (ordenacao === "codigo_desc") {
        return (b.codigo || "").localeCompare(a.codigo || "", undefined, { numeric: true });
      } else if (ordenacao === "espessura_asc") {
        return parseFloat((a.chapa || "0").replace(",", ".")) - parseFloat((b.chapa || "0").replace(",", "."));
      } else if (ordenacao === "espessura_desc") {
        return parseFloat((b.chapa || "0").replace(",", ".")) - parseFloat((a.chapa || "0").replace(",", "."));
      } else {
        // Padrão em arquivadas: Mais recentes primeiro (ordem por data de arquivamento)
        const da = getTimestampArquivamento(a);
        const db = getTimestampArquivamento(b);
        if (da !== db) return db - da;
      }
    } else {
      if (ordenacao === "codigo_asc")  return (a.codigo || "").localeCompare(b.codigo || "", undefined, { numeric: true });
      if (ordenacao === "codigo_desc") return (b.codigo || "").localeCompare(a.codigo || "", undefined, { numeric: true });
      if (ordenacao === "espessura_asc") {
        const ea = parseFloat((a.chapa || "0").replace(",", "."));
        const eb = parseFloat((b.chapa || "0").replace(",", "."));
        return ea - eb;
      }
      if (ordenacao === "espessura_desc") {
        const ea = parseFloat((a.chapa || "0").replace(",", "."));
        const eb = parseFloat((b.chapa || "0").replace(",", "."));
        return eb - ea;
      }
      if (ordenacao === "data_recebimento_desc") {
        const da = a.data_recebimento ? new Date(a.data_recebimento).getTime() : 0;
        const db = b.data_recebimento ? new Date(b.data_recebimento).getTime() : 0;
        return db - da;
      }
      if (ordenacao === "data_recebimento_asc") {
        const da = a.data_recebimento ? new Date(a.data_recebimento).getTime() : 0;
        const db = b.data_recebimento ? new Date(b.data_recebimento).getTime() : 0;
        return da - db;
      }
    }
    return 0;
  });

  const temFiltrosBobina = filtroQualidade !== "todos" || !!filtroFornecedor || !!filtroData;
  const limparFiltrosBobina = () => {
    setSearch("");
    setFiltroQualidade("todos");
    setFiltroFornecedor("");
    setFiltroData("");
    setFilterAlerta(false);
  };

  const [exportarDialogOpen, setExportarDialogOpen] = useState(false);
  const [historicoReservasOpen, setHistoricoReservasOpen] = useState(false);

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
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setHistoricoReservasOpen(true)}
            className="gap-2 border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
            title="Ver histórico e carimbo de data e hora de todas as reservas"
          >
            <History className="w-4 h-4" />
            Histórico Reservas
          </Button>
          <Button
            variant="outline"
            onClick={() => setExportarDialogOpen(true)}
            className="gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            title="Exportar planilha de bobinas do Base44 para parear no Odoo"
          >
            <Download className="w-4 h-4" />
            Exportar Planilha (Odoo)
          </Button>
          <Button onClick={() => { setEditItem(null); refetchCodigos(); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Bobina
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Package className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{ativas.length}</p>
          <p className="text-xs text-muted-foreground">Em Estoque</p>
          <p className="text-sm font-semibold text-muted-foreground mt-1">{totalPeso.toLocaleString("pt-BR")} kg</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Weight className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalPeso.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">kg disponíveis</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">Pré-baixa: {totalPreBaixaKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${emAlerta.length > 0 ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800" : "bg-card border-border"}`}>
          <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${emAlerta.length > 0 ? "text-red-500" : "text-gray-400"}`} />
          <p className={`text-2xl font-bold ${emAlerta.length > 0 ? "text-red-700 dark:text-red-400" : ""}`}>{emAlerta.length}</p>
          <p className="text-xs text-muted-foreground">Em alerta</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
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
            <Input placeholder="Buscar por cor, chapa, código, data (ex: 14/09), fornecedor, NF, largura, peso..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {(temFiltrosBobina || filterAlerta) && (
            <Button variant="ghost" size="sm" onClick={limparFiltrosBobina} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3 h-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant={showArquivadas ? "default" : "outline"} size="sm"
            onClick={() => { setShowArquivadas(!showArquivadas); setFilterAlerta(false); setOrdenacao("none"); setFiltroData(""); }} className="gap-1 h-8 text-xs">
            <Archive className="w-3 h-3" />
            {showArquivadas ? "Ver em estoque" : `Arquivadas (${arquivadas.length})`}
          </Button>
          {!showArquivadas && emAlerta.length > 0 && (
            <Button variant={filterAlerta ? "destructive" : "outline"} size="sm"
              onClick={() => setFilterAlerta(!filterAlerta)} className="gap-1 h-8 text-xs">
              <AlertTriangle className="w-3 h-3" />
              Alertas ({emAlerta.length})
            </Button>
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
          <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-2.5 h-8 text-xs text-muted-foreground hover:border-primary/50 transition-colors" title={showArquivadas ? "Filtrar por data de arquivamento" : "Filtrar por data de recebimento"}>
            <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <input
              type="date"
              value={filtroData}
              onChange={e => setFiltroData(e.target.value)}
              className="bg-transparent text-xs outline-none text-foreground cursor-pointer"
            />
            {filtroData && (
              <button
                type="button"
                onClick={() => setFiltroData("")}
                className="hover:text-destructive text-muted-foreground p-0.5 rounded"
                title="Limpar filtro de data"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <Select value={ordenacao} onValueChange={setOrdenacao}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Ordenar por..." /></SelectTrigger>
            <SelectContent>
              {showArquivadas ? (
                <>
                  <SelectItem value="none">Data Arquivamento (Recentes)</SelectItem>
                  <SelectItem value="data_arq_asc">Data Arquivamento (Antigas)</SelectItem>
                  <SelectItem value="codigo_asc">Código ↑</SelectItem>
                  <SelectItem value="codigo_desc">Código ↓</SelectItem>
                  <SelectItem value="espessura_asc">Espessura ↑</SelectItem>
                  <SelectItem value="espessura_desc">Espessura ↓</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="none">Padrão</SelectItem>
                  <SelectItem value="data_recebimento_desc">Data Recebimento (Recentes)</SelectItem>
                  <SelectItem value="data_recebimento_asc">Data Recebimento (Antigas)</SelectItem>
                  <SelectItem value="codigo_asc">Código ↑</SelectItem>
                  <SelectItem value="codigo_desc">Código ↓</SelectItem>
                  <SelectItem value="espessura_asc">Espessura ↑</SelectItem>
                  <SelectItem value="espessura_desc">Espessura ↓</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground ml-auto">
            {sorted.length} de {base.length} bobinas
          </p>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title="Nenhuma bobina encontrada" description="Adicione bobinas ao estoque." onAdd={() => { setEditItem(null); refetchCodigos(); setDialogOpen(true); }} />
      ) : (
        <div className="space-y-3">
          {sorted.map(bobina => (
            <BobinaCard
              key={bobina.id}
              bobina={bobina}
              preBaixaKg={preBaixaMap[bobina.id] || 0}
              statusInfo={statusMap[bobina.id]}
              onEdit={(b) => { setEditItem(b); setDialogOpen(true); }}
              onDelete={(b) => setDeleteItem(b)}
              onArquivar={(id, val) => arquivarMutation.mutate({ id, arquivada: val })}
            />
          ))}
        </div>
      )}

      {/* Painel de solicitações de reserva dos vendedores */}
      <div className="mt-6">
        <PainelSolicitacoesReserva setor="corte_dobra" />
      </div>

      {/* Painel de transferências entre filiais */}
      <div className="mt-6">
        <PainelTransferencias setor="corte_dobra" />
      </div>

      <BobinaFormDialogCD
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
        proximoNumero={proximoNumero}
        saving={createMutation.isPending || updateMutation.isPending}
      />
      <DeleteConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteMutation.mutate(deleteItem.id)}
        itemName={deleteItem ? `${deleteItem.cor} - ${deleteItem.chapa}` : ""}
      />
      <ExportarBobinasDialog open={exportarDialogOpen} onOpenChange={setExportarDialogOpen} setorInicial="corte_dobra" />
      <HistoricoReservasDialog open={historicoReservasOpen} onOpenChange={setHistoricoReservasOpen} setorFiltro="corte_dobra" />
    </div>
  );
}