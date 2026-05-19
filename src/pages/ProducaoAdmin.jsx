import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Factory, Download, Calendar, Database, TrendingUp, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import PedidoFormDialog from "@/components/producao/PedidoFormDialog";
import PedidoCard from "@/components/producao/PedidoCard";
import DiaResumoCard from "@/components/producao/DiaResumoCard";
import ProducaoDados from "@/pages/ProducaoDados";
import AlertasEstoque from "@/components/producao/AlertasEstoque";
import OPImpressao from "@/components/producao/OPImpressao";

const MAQUINAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];

const MAQUINA_CORES = {
  "TP - 25": "bg-blue-100 text-blue-800 border-blue-200",
  "TP - 40": "bg-green-100 text-green-800 border-green-200",
  "ONDULADA": "bg-purple-100 text-purple-800 border-purple-200",
  "COLONIAL": "bg-orange-100 text-orange-800 border-orange-200",
  "BANDEJA": "bg-pink-100 text-pink-800 border-pink-200",
  "DESBOBINADOR": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "CUMEEIRA": "bg-teal-100 text-teal-800 border-teal-200",
  "COLAGEM": "bg-red-100 text-red-800 border-red-200",
};

export default function ProducaoAdmin() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewMode, setViewMode] = useState("semana"); // "semana" | "dia"
  const [activeTab, setActiveTab] = useState("producao"); // "producao" | "dados"
  const [opOpen, setOpOpen] = useState(false);
  const [opPedido, setOpPedido] = useState(null);
  const [alertasVisivel, setAlertasVisivel] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // pedido a excluir
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const diasDaSemana = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => base44.entities.Pedido.list("-data", 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Pedido.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pedidos"] }); setDialogOpen(false); toast.success("Pedido registrado!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pedidos"] }); setDialogOpen(false); setEditItem(null); toast.success("Pedido atualizado!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Pedido.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pedidos"] }); toast.success("Pedido excluído!"); },
  });

  const handleSave = (data) => {
    if (editItem && !editItem._presets && editItem.id) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const openNew = (date = null, maquina = null) => {
    setEditItem(null);
    setDialogOpen(true);
    if (date || maquina) {
      setEditItem({ _presets: { data: date || selectedDay, maquina: maquina || "" } });
    }
  };

  const openEdit = (p) => { setEditItem(p); setDialogOpen(true); };

  const abrirOP = (p) => { setOpPedido(p); setOpOpen(true); };

  const confirmarDelete = (id) => {
    const p = pedidos.find(x => x.id === id);
    setDeleteConfirm(p || { id });
  };

  // Pedidos da semana atual
  const pedidosSemana = useMemo(() => {
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    return pedidos.filter(p => p.data >= startStr && p.data <= endStr);
  }, [pedidos, weekStart, weekEnd]);

  // Pedidos do dia selecionado
  const pedidosDia = useMemo(() => {
    return pedidos.filter(p => p.data === selectedDay);
  }, [pedidos, selectedDay]);

  const totalSemana = pedidosSemana.reduce((s, p) => s + (p.metros || 0), 0);

  const exportarSemana = () => {
    const linhas = ["Dia,Máquina,Cliente,Produto,Metros,Status"];
    pedidosSemana.forEach(p => {
      linhas.push(`${p.data},${p.maquina || ""},${p.cliente || ""},${p.produto || ""},${p.metros || 0},${p.status || ""}`);
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `producao_semana_${format(weekStart, "dd-MM-yyyy")}.csv`;
    a.click();
    toast.success("Exportado!");
  };

  return (
    <div className="space-y-6">
      {/* Alertas de Estoque */}
      {alertasVisivel && <AlertasEstoque onClose={() => setAlertasVisivel(false)} />}

      {/* Header + Abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="w-6 h-6" />
            Produção — Visão Admin
          </h1>
          <p className="text-sm text-muted-foreground">Todos os pedidos e produção diária</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "producao" && (
            <>
              <Button variant="outline" size="sm" onClick={exportarSemana} className="gap-1">
                <Download className="w-4 h-4" />
                Exportar
              </Button>
              <Button onClick={() => openNew()} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Pedido
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("producao")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "producao" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Factory className="w-4 h-4" />
          Produção
        </button>
        <Link
          to="/maquina/colagem"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-card hover:text-foreground hover:shadow"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          Colagem
        </Link>

        {/* Separador visual */}
        <div className="w-px bg-border mx-1 self-stretch" />

        {[
          { tab: "maq-tp40",         label: "TP - 40",       color: "bg-green-500",  path: "/maquina/tp40" },
          { tab: "maq-tp25",         label: "TP - 25",       color: "bg-blue-500",   path: "/maquina/tp25" },
          { tab: "maq-ondulada",     label: "Ondulada",      color: "bg-purple-500", path: "/maquina/ondulada" },
          { tab: "maq-colonial",     label: "Colonial",      color: "bg-orange-500", path: "/maquina/colonial" },
          { tab: "maq-bandeja",      label: "Bandeja",       color: "bg-pink-500",   path: "/maquina/bandeja" },
          { tab: "maq-desbobinador", label: "Desbobinador",  color: "bg-yellow-500", path: "/maquina/desbobinador" },
          { tab: "maq-cumeeira",     label: "Cumeeira",      color: "bg-teal-500",   path: "/maquina/cumeeira" },
        ].map(m => (
          <Link
            key={m.tab}
            to={m.path}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-card hover:text-foreground hover:shadow"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.color}`} />
            {m.label}
          </Link>
        ))}

        {/* Separador visual */}
        <div className="w-px bg-border mx-1 self-stretch" />

        <button
          onClick={() => setActiveTab("dados")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "dados" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Database className="w-4 h-4" />
          Dados
        </button>

        {/* Separador visual */}
        <div className="w-px bg-border mx-1 self-stretch" />

        <Link
          to="/dashboard-performance"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-card hover:text-foreground hover:shadow"
        >
          <TrendingUp className="w-4 h-4" />
          Performance
        </Link>

        <Link
          to="/dashboard-producao"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-card hover:text-foreground hover:shadow"
        >
          <TrendingUp className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      {activeTab === "dados" && <ProducaoDados />}

      {activeTab === "colagem" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Pedidos de Colagem</h2>
            <Button size="sm" onClick={() => { setActiveTab("producao"); setTimeout(() => openNew(selectedDay, "COLAGEM"), 100); }} className="gap-1">
              <Plus className="w-3 h-3" />
              Novo Pedido Colagem
            </Button>
          </div>
          {pedidos.filter(p => p.maquina === "COLAGEM").length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              Nenhum pedido de colagem cadastrado
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.filter(p => p.maquina === "COLAGEM").sort((a, b) => b.data?.localeCompare(a.data)).map(p => (
                <PedidoCard key={p.id} pedido={p} maquinaCores={MAQUINA_CORES} onEdit={(p) => { setEditItem(p); setDialogOpen(true); }} onDelete={confirmarDelete} onStatusChange={(p, status) => updateMutation.mutate({ id: p.id, data: { ...p, status } })} onPrintOP={abrirOP} />
              ))}
            </div>
          )}
          <PedidoFormDialog
            open={dialogOpen}
            onClose={() => { setDialogOpen(false); setEditItem(null); }}
            onSave={handleSave}
            editItem={editItem}
            defaultDate={selectedDay}
          />
        </div>
      )}

      {activeTab === "producao" && (<>

      {/* Navegação de semana */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-bold text-lg">Semana de {format(weekStart, "dd 'de' MMM", { locale: ptBR })} a {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}</p>
            <Badge className="bg-primary/10 text-primary border border-primary/20">
              Total da semana: {totalSemana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
            </Badge>
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Dias da semana como abas */}
        <div className="grid grid-cols-7 gap-1">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const pedidosDoDia = pedidosSemana.filter(p => p.data === diaStr);
            const totalDia = pedidosDoDia.reduce((s, p) => s + (p.metros || 0), 0);
            const isSelected = selectedDay === diaStr;
            const isHoje = isToday(dia);
            return (
              <button
                key={diaStr}
                onClick={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                className={`rounded-lg p-2 text-center transition-all border ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : isHoje
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="text-xs font-semibold uppercase">{format(dia, "EEE", { locale: ptBR })}</p>
                <p className={`text-lg font-bold ${isSelected ? "" : isHoje ? "text-primary" : ""}`}>{format(dia, "dd")}</p>
                {pedidosDoDia.length > 0 && (
                  <div className={`text-xs mt-0.5 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {pedidosDoDia.length}p · {totalDia.toFixed(0)}m
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle visão semana / dia */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "semana" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("semana")}
        >
          Visão Semana
        </Button>
        <Button
          variant={viewMode === "dia" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("dia")}
        >
          Visão Dia — {format(new Date(selectedDay + "T12:00:00"), "dd/MM", { locale: ptBR })}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setSelectedDay(format(new Date(), "yyyy-MM-dd")); setCurrentWeek(new Date()); setViewMode("dia"); }}
          className="gap-1"
        >
          <Calendar className="w-3 h-3" />
          Hoje
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : viewMode === "semana" ? (
        // Visão Semana — resumo por dia
        <div className="space-y-3">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const pedidosDoDia = pedidosSemana.filter(p => p.data === diaStr);
            return (
              <DiaResumoCard
                key={diaStr}
                dia={dia}
                pedidos={pedidosDoDia}
                maquinaCores={MAQUINA_CORES}
                onVerDia={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                onNovoPedido={() => openNew(diaStr)}
              />
            );
          })}
        </div>
      ) : (
        // Visão Dia — por máquina
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {format(new Date(selectedDay + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border border-primary/20">
                {pedidosDia.length} pedidos · {pedidosDia.reduce((s, p) => s + (p.metros || 0), 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
              </Badge>
              <Button size="sm" onClick={() => openNew(selectedDay)} className="gap-1">
                <Plus className="w-3 h-3" />
                Pedido
              </Button>
            </div>
          </div>

          {MAQUINAS.map(maquina => {
            const pedidosMaquina = pedidosDia.filter(p => p.maquina === maquina);
            const totalMaq = pedidosMaquina.reduce((s, p) => s + (p.metros || 0), 0);
            return (
              <div key={maquina} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-3">
                    <Badge className={`border ${MAQUINA_CORES[maquina]}`}>{maquina}</Badge>
                    <span className="text-sm text-muted-foreground">{pedidosMaquina.length} pedido(s)</span>
                    {totalMaq > 0 && <span className="text-sm font-bold text-primary">{totalMaq.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openNew(selectedDay, maquina)} className="h-7 gap-1 text-xs">
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </Button>
                </div>
                {pedidosMaquina.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground italic">Sem pedidos para esta máquina</div>
                ) : (
                  <div className="divide-y divide-border">
                    {pedidosMaquina.map(p => (
                      <PedidoCard key={p.id} pedido={p} maquinaCores={MAQUINA_CORES} onEdit={openEdit} onDelete={confirmarDelete} onStatusChange={(p, status) => updateMutation.mutate({ id: p.id, data: { ...p, status } })} onPrintOP={abrirOP} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PedidoFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
        defaultDate={selectedDay}
      />
      </>)}

      <OPImpressao open={opOpen} onClose={() => setOpOpen(false)} pedido={opPedido} />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Excluir Pedido
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja excluir este pedido? Esta ação é irreversível.</p>
              {deleteConfirm && (
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-foreground space-y-0.5">
                  {deleteConfirm.produto && <p><strong>Produto:</strong> {deleteConfirm.produto}</p>}
                  {deleteConfirm.cliente && <p><strong>Cliente:</strong> {deleteConfirm.cliente}</p>}
                  {deleteConfirm.data && <p><strong>Data:</strong> {deleteConfirm.data}</p>}
                  {deleteConfirm.metros && <p><strong>Metros:</strong> {deleteConfirm.metros}m</p>}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}