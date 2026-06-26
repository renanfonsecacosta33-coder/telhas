import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Calendar, Factory } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import OrdemMaquinaFormDialog from "@/components/corte-dobra/OrdemMaquinaFormDialog.jsx";
import OrdemMaquinaRow from "@/components/corte-dobra/OrdemMaquinaRow.jsx";

export default function MaquinaCDPanel({ maquinaId, maquinaLabel, cor }) {
  const [user, setUser] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState("dia");
  const [dialog, setDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isGestor = user?.role === "admin" || user?.full_name?.toLowerCase().includes("hudson");
  const maquinaDoUsuario = user?.maquina; // máquina configurada no perfil do usuário
  const isOperadorRestrito = user && !isGestor; // não-admin = operador restrito

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const diasDaSemana = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens-maquina-cd"],
    queryFn: () => base44.entities.OrdemMaquinaCD.list("-data", 500),
    refetchInterval: 10000,
  });

  const ordensDaMaquina = useMemo(
    () => ordens.filter(o => o.maquina === maquinaId),
    [ordens, maquinaId]
  );

  const ordensSemana = useMemo(() => {
    const s = format(weekStart, "yyyy-MM-dd");
    const e = format(weekEnd, "yyyy-MM-dd");
    return ordensDaMaquina.filter(o => o.data >= s && o.data <= e);
  }, [ordensDaMaquina, weekStart, weekEnd]);

  const ordensDia = useMemo(
    () => ordensDaMaquina.filter(o => o.data === selectedDay).sort((a, b) => {
      const ord = { em_producao: 0, pausado: 1, aguardando_corte: 2, pendente: 3, finalizado: 4, cancelado: 5 };
      return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
    }),
    [ordensDaMaquina, selectedDay]
  );

  const updateMaq = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemMaquinaCD.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] }),
  });
  const createMaq = useMutation({
    mutationFn: (data) => base44.entities.OrdemMaquinaCD.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] }); },
  });

  const handleSave = async (data) => {
    if (editItem && !editItem._presets && editItem.id) {
      updateMaq.mutate({ id: editItem.id, data });
      setDialog(false);
    } else {
      const saved = await createMaq.mutateAsync(data);
      toast.success("Ordem criada!");
      // Se for CORTE 3M ou CORTE 6M e gerou dobra, criar ordem de dobra vinculada
      if (data.ordem_dobra_maquina && data.chapa_cd_id) {
        await base44.entities.OrdemMaquinaCD.create({
          data: data.data,
          maquina: data.ordem_dobra_maquina,
          tipo_peca: data.tipo_peca,
          dimensoes_livres: data.dimensoes_livres,
          quantidade: data.quantidade,
          peso_kg: data.peso_kg,
          numero_pedido: data.numero_pedido,
          cliente: data.cliente,
          chapa_cd_id: data.chapa_cd_id,
          chapa_descricao: data.chapa_descricao,
          chapa_origem: "chaparia",
          desenvolvimento_id: data.desenvolvimento_id,
          desenvolvimento_descricao: data.desenvolvimento_descricao,
          ordem_corte_id: saved.id,
          status: "aguardando_corte",
          observacoes: `Gerado automaticamente do ${data.maquina}`,
        });
        queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
        toast.success("Ordem de dobra vinculada criada!");
      }
      setDialog(false);
    }
  };

  const openNew = (date = null) => {
    setEditItem(date ? { _presets: { data: date } } : null);
    setDialog(true);
  };
  const openEdit = (item) => { setEditItem(item); setDialog(true); };

  const totalSemana = ordensSemana.length;
  const finalizadasSemana = ordensSemana.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);

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

  // Operador tentando acessar máquina que não é a dele
  if (user && isOperadorRestrito && maquinaDoUsuario && maquinaDoUsuario !== maquinaId) {
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
            <Factory className="w-6 h-6" />
            {maquinaLabel}
          </h1>
          <p className="text-sm text-muted-foreground">Ordens de produção — Corte e Dobra</p>
        </div>
        {isGestor && (
          <Button onClick={() => openNew(selectedDay)} className="gap-2">
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
                className={`rounded-lg p-2 text-center transition-all duration-200 cursor-pointer border ${isSelected ? "bg-primary text-primary-foreground border-primary" : isHoje ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                <p className="text-xs font-semibold uppercase">{format(dia, "EEE", { locale: ptBR })}</p>
                <p className="text-lg font-bold">{format(dia, "dd")}</p>
                {cnt > 0 && (
                  <div className={`text-xs mt-0.5 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
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
        <Button variant={viewMode === "dia" ? "default" : "outline"} size="sm" onClick={() => setViewMode("dia")}>
          Dia — {format(new Date(selectedDay + "T12:00:00"), "dd/MM", { locale: ptBR })}
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setSelectedDay(format(new Date(), "yyyy-MM-dd")); setCurrentWeek(new Date()); setViewMode("dia"); }} className="gap-1">
          <Calendar className="w-3 h-3" /> Hoje
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : viewMode === "semana" ? (
        /* VISÃO SEMANA */
        <div className="space-y-3">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const ordensDoDia = ordensSemana.filter(o => o.data === diaStr);
            const finalizadas = ordensDoDia.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
            return (
              <div key={diaStr} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-3">
                    <span className="font-bold capitalize text-sm">
                      {format(dia, "EEEE, dd/MM", { locale: ptBR })}
                    </span>
                    {isToday(dia) && <Badge className="text-xs bg-primary text-primary-foreground">Hoje</Badge>}
                    <span className="text-xs text-muted-foreground">{ordensDoDia.length} ordem(ns)</span>
                    {finalizadas > 0 && <span className="text-xs font-bold text-green-600">{finalizadas} pç ✓</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => { setSelectedDay(diaStr); setViewMode("dia"); }}>Ver dia</Button>
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
                    {ordensDoDia.sort((a, b) => {
                      const ord = { em_producao: 0, pausado: 1, aguardando_corte: 2, pendente: 3, finalizado: 4, cancelado: 5 };
                      return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
                    }).map(o => (
                      <div key={o.id}>
                        <OrdemMaquinaRow ordem={o} onUpdate={(id, data) => updateMaq.mutate({ id, data })} isGestor={isGestor} />
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
              <Badge variant="outline" className="text-xs">{ordensDia.length} ordens</Badge>
            </div>
            {isGestor && (
              <Button variant="ghost" size="sm" onClick={() => openNew(selectedDay)} className="h-7 gap-1 text-xs">
                <Plus className="w-3 h-3" /> Adicionar
              </Button>
            )}
          </div>
          {ordensDia.length === 0 ? (
            <div className="px-4 py-12 flex flex-col items-center gap-3">
              <Factory className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Nenhuma ordem para este dia</p>
              {isGestor && (
                <Button size="sm" onClick={() => openNew(selectedDay)} className="gap-1 mt-1">
                  <Plus className="w-3 h-3" /> Nova Ordem
                </Button>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {ordensDia.map(o => (
                <div key={o.id}>
                  <OrdemMaquinaRow ordem={o} onUpdate={(id, data) => updateMaq.mutate({ id, data })} isGestor={isGestor} />
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

      <OrdemMaquinaFormDialog
        open={dialog}
        onClose={() => { setDialog(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem && !editItem._presets ? editItem : null}
        defaultDate={editItem?._presets?.data || selectedDay}
        maquina={maquinaId}
      />
    </div>
  );
}