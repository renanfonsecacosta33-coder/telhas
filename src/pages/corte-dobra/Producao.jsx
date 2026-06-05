import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Factory, Calendar, Wrench, Download } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import OrdemFormDialogCD from "@/components/corte-dobra/OrdemFormDialogCD";
import OrdemDesbobinadiraRow from "@/components/corte-dobra/OrdemDesbobinadiraRow";
import DiaResumoCardCD from "@/components/corte-dobra/DiaResumoCardCD";

const MAQUINAS_CD = ["DESBOBINADEIRA", "DOBRADEIRA", "GUILHOTINA", "CALANDRA", "PRENSA"];

const MAQUINA_CORES = {
  "DESBOBINADEIRA": "bg-orange-100 text-orange-800 border-orange-200",
  "DOBRADEIRA":     "bg-blue-100 text-blue-800 border-blue-200",
  "GUILHOTINA":     "bg-purple-100 text-purple-800 border-purple-200",
  "CALANDRA":       "bg-green-100 text-green-800 border-green-200",
  "PRENSA":         "bg-pink-100 text-pink-800 border-pink-200",
};

export default function ProducaoCD() {
  const [user, setUser] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState("semana"); // "semana" | "dia"
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const diasDaSemana = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens-desbobinadeira"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 500),
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OrdemDesbobinadeira.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }); setDialogOpen(false); toast.success("Ordem criada!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemDesbobinadeira.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OrdemDesbobinadeira.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }); toast.success("Ordem excluída!"); },
  });

  const handleUpdate = (id, data) => updateMutation.mutate({ id, data });

  const openNew = (date = null) => {
    setEditItem(null);
    setDialogOpen(true);
    if (date) setEditItem({ _presets: { data: date } });
  };

  const openEdit = (item) => { setEditItem(item); setDialogOpen(true); };
  const handleClose = () => { setDialogOpen(false); setEditItem(null); };

  const handleSave = (data) => {
    if (editItem && !editItem._presets && editItem.id) {
      updateMutation.mutate({ id: editItem.id, data });
      handleClose();
    } else {
      createMutation.mutate(data);
    }
  };

  const isGestor = user?.role === "admin" || user?.full_name?.toLowerCase().includes("hudson");

  // Dados da semana
  const ordensSemana = useMemo(() => {
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    return ordens.filter(o => o.data >= startStr && o.data <= endStr);
  }, [ordens, weekStart, weekEnd]);

  const ordensDia = useMemo(() => ordens.filter(o => o.data === selectedDay), [ordens, selectedDay]);

  const totalSemanaOrdens = ordensSemana.length;
  const totalSemanaPecas = ordensSemana.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);

  const exportarSemana = () => {
    const linhas = ["Dia,Bobina,Comprimento(mm),Quantidade,Status"];
    ordensSemana.forEach(o => {
      linhas.push(`${o.data},${o.bobina_descricao || ""},${o.comprimento_mm || 0},${o.quantidade || 0},${o.status || ""}`);
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cd_semana_${format(weekStart, "dd-MM-yyyy")}.csv`;
    a.click();
    toast.success("Exportado!");
  };

  const ordensDiaOrdenadas = [...ordensDia].sort((a, b) => {
    const order = { em_producao: 0, pausado: 1, pendente: 2, finalizado: 3, cancelado: 4 };
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-orange-500" />
            Produção — Corte e Dobra
          </h1>
          <p className="text-sm text-muted-foreground">Ordens de produção do setor</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarSemana} className="gap-1">
            <Download className="w-4 h-4" /> Exportar
          </Button>
          {isGestor && (
            <Button onClick={() => openNew()} className="gap-2 bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4" /> Nova Ordem
            </Button>
          )}
        </div>
      </div>

      {/* Navegação de semana */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-bold text-lg">
              Semana de {format(weekStart, "dd 'de' MMM", { locale: ptBR })} a {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}
            </p>
            <Badge className="bg-orange-100 text-orange-700 border-orange-200">
              {totalSemanaOrdens} ordens · {totalSemanaPecas} peças finalizadas
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
            const ordensDoDia = ordensSemana.filter(o => o.data === diaStr);
            const pecasDia = ordensDoDia.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
            const isSelected = selectedDay === diaStr;
            const isHoje = isToday(dia);
            return (
              <button
                key={diaStr}
                onClick={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                className={`rounded-lg p-2 text-center transition-all border ${
                  isSelected ? "bg-orange-500 text-white border-orange-500" :
                  isHoje ? "border-orange-400/50 bg-orange-50" : "border-border hover:bg-muted/50"
                }`}
              >
                <p className="text-xs font-semibold uppercase">{format(dia, "EEE", { locale: ptBR })}</p>
                <p className={`text-lg font-bold ${isSelected ? "" : isHoje ? "text-orange-500" : ""}`}>{format(dia, "dd")}</p>
                {ordensDoDia.length > 0 && (
                  <div className={`text-xs mt-0.5 ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                    {ordensDoDia.length}o{pecasDia > 0 ? ` · ${pecasDia}p` : ""}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle semana / dia */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={viewMode === "semana" ? "default" : "outline"} size="sm" onClick={() => setViewMode("semana")}>
          Visão Semana
        </Button>
        <Button variant={viewMode === "dia" ? "default" : "outline"} size="sm" onClick={() => setViewMode("dia")}
          className={viewMode === "dia" ? "bg-orange-500 hover:bg-orange-600 border-0" : ""}>
          Visão Dia — {format(new Date(selectedDay + "T12:00:00"), "dd/MM", { locale: ptBR })}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setSelectedDay(format(new Date(), "yyyy-MM-dd")); setCurrentWeek(new Date()); setViewMode("dia"); }} className="gap-1">
          <Calendar className="w-3 h-3" /> Hoje
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : viewMode === "semana" ? (
        // ── VISÃO SEMANA ──
        <div className="space-y-3">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const ordensDoDia = ordensSemana.filter(o => o.data === diaStr);
            return (
              <DiaResumoCardCD
                key={diaStr}
                dia={dia}
                ordens={ordensDoDia}
                onVerDia={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                onNovaOrdem={() => { openNew(diaStr); }}
              />
            );
          })}
        </div>
      ) : (
        // ── VISÃO DIA ──
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold capitalize">
              {format(new Date(selectedDay + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <div className="flex items-center gap-2">
              <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                {ordensDia.length} ordens
              </Badge>
              {isGestor && (
                <Button size="sm" onClick={() => openNew(selectedDay)} className="gap-1 bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-3 h-3" /> Ordem
                </Button>
              )}
            </div>
          </div>

          {/* Bloco DESBOBINADEIRA (única máquina ativa por enquanto) */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <Badge className="border bg-orange-100 text-orange-800 border-orange-200">DESBOBINADEIRA</Badge>
                <span className="text-sm text-muted-foreground">{ordensDia.length} ordem(ns)</span>
                {ordensDia.filter(o => o.status === "finalizado").length > 0 && (
                  <span className="text-sm font-bold text-green-600">
                    {ordensDia.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0)} peças ✓
                  </span>
                )}
              </div>
              {isGestor && (
                <Button variant="ghost" size="sm" onClick={() => openNew(selectedDay)} className="h-7 gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Adicionar
                </Button>
              )}
            </div>

            {ordensDiaOrdenadas.length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center gap-3">
                <Factory className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Sem ordens para este dia</p>
                {isGestor && (
                  <Button size="sm" onClick={() => openNew(selectedDay)} className="gap-1 bg-orange-500 hover:bg-orange-600">
                    <Plus className="w-3 h-3" /> Nova Ordem
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {ordensDiaOrdenadas.map(o => (
                  <div key={o.id}>
                    <OrdemDesbobinadiraRow ordem={o} onUpdate={handleUpdate} isGestor={isGestor} />
                    {isGestor && o.status === "pendente" && (
                      <div className="flex justify-end mt-1">
                        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-6 px-2" onClick={() => openEdit(o)}>
                          ✏️ Editar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outras máquinas — em breve */}
          {MAQUINAS_CD.filter(m => m !== "DESBOBINADEIRA").map(maquina => (
            <div key={maquina} className="bg-card border border-dashed border-border rounded-xl overflow-hidden opacity-50">
              <div className="px-4 py-3 flex items-center justify-between">
                <Badge className={`border ${MAQUINA_CORES[maquina]}`}>{maquina}</Badge>
                <span className="text-xs text-muted-foreground italic">Em breve</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <OrdemFormDialogCD
        open={dialogOpen}
        onClose={handleClose}
        onSave={handleSave}
        editItem={editItem && !editItem._presets ? editItem : null}
        defaultDate={editItem?._presets?.data || selectedDay}
      />
    </div>
  );
}