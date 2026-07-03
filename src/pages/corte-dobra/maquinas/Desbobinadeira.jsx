import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Calendar, Factory, Layers } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import OrdemFormDialogCD from "@/components/corte-dobra/OrdemFormDialogCD";
import OrdemDesbobinadiraRow from "@/components/corte-dobra/OrdemDesbobinadiraRow";
import { useFilial } from "@/contexts/FilialContext";

export default function Desbobinadeira() {
  const { filialAtiva } = useFilial();
  const [user, setUser] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState("dia");
  const [dialog, setDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filtroEspessura, setFiltroEspessura] = useState("todas");

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isGestor = user?.role === "admin" || user?.full_name?.toLowerCase().includes("hudson");
  const maquinaDoUsuario = user?.maquina;
  const isOperadorRestrito = user && !isGestor;

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const diasDaSemana = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens-desbobinadeira", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 10000,
  });

  // Busca também as OPs das máquinas CD (guilhotina, dobra, etc.) para
  // calcular a sequência do pedido cruzando todos os setores
  const { data: ordensMaquina = [] } = useQuery({
    queryKey: ["ordens-maquina-cd", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 10000,
  });

  // Mapa de sequência de pedidos: para cada ordem com numero_pedido,
  // calcula "1/3", "2/3", etc. com base na ordem de criação — cruzando
  // Desbobinadeira + todas as máquinas CD (guilhotina, dobra, etc.)
  const pedidoSeqMap = useMemo(() => {
    const map = {};
    const groups = {};
    const todas = [...ordens, ...ordensMaquina];
    for (const o of todas) {
      if (!o.numero_pedido) continue;
      if (!groups[o.numero_pedido]) groups[o.numero_pedido] = [];
      groups[o.numero_pedido].push(o);
    }
    for (const items of Object.values(groups)) {
      // Dedup por id (caso a mesma OP apareça nas duas listas)
      const unique = Array.from(new Map(items.map(i => [i.id, i])).values());
      unique.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
      const total = unique.length;
      unique.forEach((item, idx) => {
        map[item.id] = `${idx + 1}/${total}`;
      });
    }
    return map;
  }, [ordens, ordensMaquina]);

  const ordensSemana = useMemo(() => {
    const s = format(weekStart, "yyyy-MM-dd");
    const e = format(weekEnd, "yyyy-MM-dd");
    return ordens.filter(o => o.data >= s && o.data <= e);
  }, [ordens, weekStart, weekEnd]);

  const ordensDia = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    const isHoje = selectedDay === hoje;
    const doDia = ordens.filter(o => o.data === selectedDay);
    if (!isHoje) {
      return doDia.sort((a, b) => {
        const ord = { em_producao: 0, pausado: 1, pendente: 2, finalizado: 3, cancelado: 4 };
        return (ord[a.status] ?? 2) - (ord[b.status] ?? 2);
      });
    }
    const atrasadas = ordens.filter(o => o.data < hoje && o.status !== "finalizado" && o.status !== "cancelado");
    return [...atrasadas, ...doDia].sort((a, b) => {
      const aAtrasada = a.data < hoje ? 0 : 1;
      const bAtrasada = b.data < hoje ? 0 : 1;
      if (aAtrasada !== bAtrasada) return aAtrasada - bAtrasada;
      const ord = { em_producao: 0, pausado: 1, pendente: 2, finalizado: 3, cancelado: 4 };
      return (ord[a.status] ?? 2) - (ord[b.status] ?? 2);
    });
  }, [ordens, selectedDay]);

  const updateOrdem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemDesbobinadeira.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }),
  });
  const deleteOrdem = useMutation({
    mutationFn: (id) => base44.entities.OrdemDesbobinadeira.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }); toast.success("Ordem excluída!"); },
  });
  const createOrdem = useMutation({
    mutationFn: (data) => base44.entities.OrdemDesbobinadeira.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }); setDialog(false); toast.success("Ordem criada!"); },
  });

  const handleSave = (data) => {
    if (editItem && !editItem._presets && editItem.id) {
      updateOrdem.mutate({ id: editItem.id, data });
      setDialog(false);
    } else {
      createOrdem.mutate(data);
    }
  };

  const openNew = (date = null) => {
    setEditItem(date ? { _presets: { data: date } } : null);
    setDialog(true);
  };
  const openEdit = (item) => { setEditItem(item); setDialog(true); };

  const totalSemana = ordensSemana.length;
  const finalizadasSemana = ordensSemana.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);

  // Espessuras disponíveis (extraídas das ordens da semana)
  const espessurasDisponiveis = useMemo(() => {
    const set = new Set();
    ordensSemana.forEach(o => { if (o.espessura_utilizada) set.add(o.espessura_utilizada); });
    return Array.from(set).sort((a, b) => parseFloat(a.replace(",", ".")) - parseFloat(b.replace(",", ".")));
  }, [ordensSemana]);

  const ordensDiaFiltradas = useMemo(() => {
    if (filtroEspessura === "todas") return ordensDia;
    return ordensDia.filter(o => o.espessura_utilizada === filtroEspessura);
  }, [ordensDia, filtroEspessura]);

  const ordensSemanaFiltradas = useMemo(() => {
    if (filtroEspessura === "todas") return ordensSemana;
    return ordensSemana.filter(o => o.espessura_utilizada === filtroEspessura);
  }, [ordensSemana, filtroEspessura]);

  // Operador sem máquina configurada
  if (user && isOperadorRestrito && !maquinaDoUsuario) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <span className="text-3xl">🔧</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Máquina não configurada</h2>
        <p className="text-muted-foreground max-w-sm">Peça ao administrador para configurar a máquina associada ao seu usuário.</p>
      </div>
    );
  }

  // Operador de outra máquina
  if (user && isOperadorRestrito && maquinaDoUsuario && maquinaDoUsuario !== "DESBOBINADEIRA") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <span className="text-3xl">🚫</span>
        </div>
        <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
        <p className="text-muted-foreground max-w-sm">Você só pode acessar as ordens da sua máquina: <strong>{maquinaDoUsuario}</strong>.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="w-6 h-6 text-orange-500" />
            Desbobinadeira
          </h1>
          <p className="text-sm text-muted-foreground">Ordens de produção — Corte e Dobra</p>
        </div>
        {isGestor && (
          <Button onClick={() => openNew(selectedDay)} className="gap-2 bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4" /> Nova Ordem
          </Button>
        )}
      </div>

      {/* Navegação semana */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-bold text-base">
              {format(weekStart, "dd 'de' MMM", { locale: ptBR })} — {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}
            </p>
            <Badge variant="outline" className="text-xs mt-1">
              {totalSemana} ordens · {finalizadasSemana} peças finalizadas
            </Badge>
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const cnt = ordensSemana.filter(o => o.data === diaStr).length;
            const isSelected = selectedDay === diaStr;
            const isHoje = isToday(dia);
            return (
              <button key={diaStr} onClick={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                className={`rounded-lg p-2 text-center transition-all border ${isSelected ? "bg-orange-500 text-white border-orange-500" : isHoje ? "border-orange-400/50 bg-orange-50" : "border-border hover:bg-muted/50"}`}>
                <p className="text-xs font-semibold uppercase">{format(dia, "EEE", { locale: ptBR })}</p>
                <p className="text-lg font-bold">{format(dia, "dd")}</p>
                {cnt > 0 && (
                  <div className={`text-xs mt-0.5 ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                    {cnt}o
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={viewMode === "semana" ? "default" : "outline"} size="sm" onClick={() => setViewMode("semana")}>Visão Semana</Button>
        <Button variant={viewMode === "dia" ? "default" : "outline"} size="sm"
          className={viewMode === "dia" ? "bg-orange-500 hover:bg-orange-600 border-0" : ""}
          onClick={() => setViewMode("dia")}>
          Dia — {format(new Date(selectedDay + "T12:00:00"), "dd/MM", { locale: ptBR })}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setSelectedDay(format(new Date(), "yyyy-MM-dd")); setCurrentWeek(new Date()); setViewMode("dia"); }} className="gap-1">
          <Calendar className="w-3 h-3" /> Hoje
        </Button>
      </div>

      {/* Filtro por espessura */}
      {espessurasDisponiveis.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Espessura:</span>
          <button
            onClick={() => setFiltroEspessura("todas")}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${filtroEspessura === "todas" ? "bg-orange-500 text-white border-orange-500" : "bg-card text-muted-foreground border-border hover:bg-muted/50"}`}
          >
            Todas
          </button>
          {espessurasDisponiveis.map(esp => (
            <button
              key={esp}
              onClick={() => setFiltroEspessura(filtroEspessura === esp ? "todas" : esp)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all flex items-center gap-1 ${filtroEspessura === esp ? "bg-blue-500 text-white border-blue-500" : "bg-card text-muted-foreground border-border hover:bg-muted/50"}`}
            >
              <Layers className="w-3 h-3" /> {esp}mm
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : viewMode === "semana" ? (
        /* VISÃO SEMANA */
        <div className="space-y-3">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const ordensDoDia = ordensSemanaFiltradas.filter(o => o.data === diaStr);
            const finalizadas = ordensDoDia.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
            return (
              <div key={diaStr} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-3">
                    <span className="font-bold capitalize text-sm">{format(dia, "EEEE, dd/MM", { locale: ptBR })}</span>
                    {isToday(dia) && <Badge className="text-xs bg-orange-500 text-white">Hoje</Badge>}
                    <span className="text-xs text-muted-foreground">{ordensDoDia.length} ordem(ns)</span>
                    {finalizadas > 0 && <span className="text-xs font-bold text-green-600">{finalizadas} pç ✓</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setSelectedDay(diaStr); setViewMode("dia"); }}>Ver dia</Button>
                    {isGestor && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openNew(diaStr)}>
                        <Plus className="w-3 h-3" /> Adicionar
                      </Button>
                    )}
                  </div>
                </div>
                {ordensDoDia.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-muted-foreground text-center">Sem ordens</div>
                ) : (
                  <div className="p-4 space-y-3">
                    {ordensDoDia.map(o => (
                      <div key={o.id}>
                        <OrdemDesbobinadiraRow ordem={o} onUpdate={(id, data) => updateOrdem.mutate({ id, data })} onDelete={(id) => deleteOrdem.mutate(id)} isGestor={isGestor} ordens={ordens} pedidoSeq={pedidoSeqMap[o.id]} />
                        {isGestor && o.status === "pendente" && (
                          <div className="flex justify-end mt-1">
                            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-6 px-2" onClick={() => openEdit(o)}>✏️ Editar</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VISÃO DIA */
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-3">
              <span className="font-bold capitalize text-sm">
                {format(new Date(selectedDay + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </span>
              <Badge variant="outline" className="text-xs">{ordensDiaFiltradas.length} ordens</Badge>
            </div>
            {isGestor && (
              <Button variant="ghost" size="sm" onClick={() => openNew(selectedDay)} className="h-7 gap-1 text-xs">
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
            )}
          </div>
          {ordensDiaFiltradas.length === 0 ? (
            <div className="px-4 py-12 flex flex-col items-center gap-3">
              <Factory className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Nenhuma ordem para este dia</p>
              {isGestor && (
                <Button size="sm" onClick={() => openNew(selectedDay)} className="gap-1 mt-1 bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-3 h-3" /> Nova Ordem
                </Button>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {ordensDiaFiltradas.map(o => (
                <div key={o.id}>
                  <OrdemDesbobinadiraRow ordem={o} onUpdate={(id, data) => updateOrdem.mutate({ id, data })} onDelete={(id) => deleteOrdem.mutate(id)} isGestor={isGestor} ordens={ordens} pedidoSeq={pedidoSeqMap[o.id]} />
                  {isGestor && o.status === "pendente" && (
                    <div className="flex justify-end mt-1">
                      <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-6 px-2" onClick={() => openEdit(o)}>✏️ Editar</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <OrdemFormDialogCD
        open={dialog}
        onClose={() => { setDialog(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem && !editItem._presets ? editItem : null}
        defaultDate={editItem?._presets?.data || selectedDay}
      />
    </div>
  );
}