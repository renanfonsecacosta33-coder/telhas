import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Factory, Wrench } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import OrdemFormDialogCD from "@/components/corte-dobra/OrdemFormDialogCD";
import OrdemDesbobinadiraRow from "@/components/corte-dobra/OrdemDesbobinadiraRow";

export default function ProducaoCD() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const queryClient = useQueryClient();

  // Carrega usuário atual
  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoadingUser(false); }).catch(() => setLoadingUser(false));
  }, []);

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens-desbobinadeira"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 200),
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

  const handleUpdate = (id, data) => updateMutation.mutate({ id, data });

  const handleEdit = (item) => { setEditItem(item); setDialogOpen(true); };
  const handleClose = () => { setDialogOpen(false); setEditItem(null); };

  // Hudson é gestor — pode criar ordens; outros operadores só veem
  const isGestor = user?.role === "admin" || user?.full_name?.toLowerCase().includes("hudson");

  const ordensDia = ordens.filter(o => o.data === selectedDay);
  const hoje = isToday(new Date(selectedDay + "T12:00:00"));

  // Dias com ordens para o mini-calendário
  const diasComOrdens = [...new Set(ordens.map(o => o.data))].sort();

  const ordenados = [...ordensDia].sort((a, b) => {
    const order = { em_producao: 0, pausado: 1, pendente: 2, finalizado: 3, cancelado: 4 };
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
  });

  if (loadingUser) {
    return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-500" /> Desbobinadeira
          </h1>
          <p className="text-sm text-muted-foreground">
            {isGestor ? "Gestão de ordens — crie e acompanhe" : "Ordens do dia — inicie, pause e finalize"}
          </p>
        </div>
        {isGestor && (
          <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Ordem
          </Button>
        )}
      </div>

      {/* Cabeçalho da máquina */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-sm opacity-75 font-medium uppercase tracking-wide">Máquina</p>
        <h2 className="text-2xl font-black mt-0.5">DESBOBINADEIRA</h2>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold">
            {ordensDia.length} ordem(ns) hoje
          </div>
          {ordensDia.filter(o => o.status === "finalizado").length > 0 && (
            <div className="bg-green-300/30 rounded-lg px-3 py-1.5 text-sm font-semibold">
              {ordensDia.filter(o => o.status === "finalizado").length} ✓ finalizadas
            </div>
          )}
          {ordensDia.filter(o => o.status === "em_producao").length > 0 && (
            <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold animate-pulse">
              ⚡ Produzindo
            </div>
          )}
        </div>
      </div>

      {/* Navegação de dia */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setSelectedDay(d => format(subDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-bold capitalize">{format(new Date(selectedDay + "T12:00:00"), "EEEE", { locale: ptBR })}</p>
            <p className="text-sm text-muted-foreground">{format(new Date(selectedDay + "T12:00:00"), "dd 'de' MMMM yyyy", { locale: ptBR })}</p>
            {hoje && <Badge className="text-xs mt-1 bg-orange-100 text-orange-700 border-orange-200">Hoje</Badge>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSelectedDay(d => format(addDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        {diasComOrdens.length > 0 && (
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto">
            {diasComOrdens.slice(-14).map(dia => {
              const qtd = ordens.filter(o => o.data === dia).length;
              const fin = ordens.filter(o => o.data === dia && o.status === "finalizado").length;
              const isSelected = dia === selectedDay;
              return (
                <button key={dia} onClick={() => setSelectedDay(dia)}
                  className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-center transition-all border text-xs ${isSelected ? "bg-orange-500 text-white border-orange-500" : "border-border hover:bg-muted/50"}`}>
                  <p className="font-bold">{format(new Date(dia + "T12:00:00"), "dd/MM")}</p>
                  <p className={isSelected ? "text-white/70" : "text-muted-foreground"}>{fin}/{qtd}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de ordens */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" /></div>
      ) : ordenados.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Factory className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Sem ordens para este dia</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isGestor ? "Clique em \"Nova Ordem\" para adicionar" : "Aguarde o gestor adicionar ordens para você"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {ordenados.map(o => (
            <div key={o.id}>
              <OrdemDesbobinadiraRow
                ordem={o}
                onUpdate={handleUpdate}
                isGestor={isGestor}
              />
              {isGestor && o.status === "pendente" && (
                <div className="flex justify-end mt-1">
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-6 px-2" onClick={() => handleEdit(o)}>
                    ✏️ Editar ordem
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <OrdemFormDialogCD
        open={dialogOpen}
        onClose={handleClose}
        onSave={(data) => editItem ? updateMutation.mutate({ id: editItem.id, data }) && handleClose() : createMutation.mutate(data)}
        editItem={editItem}
        defaultDate={selectedDay}
      />
    </div>
  );
}