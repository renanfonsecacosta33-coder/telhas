import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Circle, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import PedidoRow from "@/components/producao/PedidoRow";







export default function MaquinaPanel({ maquina }) {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-maquina", maquina],
    queryFn: () => base44.entities.Pedido.filter({ maquina }, "-data", 300),
    refetchInterval: 10000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
      toast.success("Status atualizado!");
    },
  });

  const handleStatusChange = (pedido, novoStatus, extraData = {}) => {
    const data = { ...pedido, status: novoStatus, ...extraData };
    updateMutation.mutate({ id: pedido.id, data });
  };

  const pedidosDia = useMemo(() => {
    return pedidos.filter(p => p.data === selectedDay || p.status === "pausado" || p.status === "em_producao");
  }, [pedidos, selectedDay]);

  const hoje = isToday(new Date(selectedDay + "T12:00:00"));
  const totalMetros = pedidosDia.reduce((s, p) => s + (p.metros || 0), 0);
  const finalizados = pedidosDia.filter(p => p.status === "finalizado" || p.status === "aguardando_colagem").length;
  const emProducao = pedidosDia.filter(p => p.status === "em_producao" || p.status === "pausado").length;
  const pendentes = pedidosDia.filter(p => p.status === "pendente").length;

  const ordenados = useMemo(() => {
    const order = { em_producao: 0, pausado: 1, pendente: 2, aguardando_colagem: 3, finalizado: 4, cancelado: 5 };
    return [...pedidosDia].sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2));
  }, [pedidosDia]);

  // Próximos dias com pedidos
  const diasComPedidos = useMemo(() => {
    const set = new Set(pedidos.map(p => p.data));
    return Array.from(set).sort();
  }, [pedidos]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Botão de voltar */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/producao")}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Produção
      </Button>

      {/* Header máquina */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-lg">
        <p className="text-sm opacity-75 font-medium uppercase tracking-wide">Painel da Máquina</p>
        <h1 className="text-3xl font-black mt-1">{maquina}</h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold">
            {pedidosDia.length} pedido(s)
          </div>
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold">
            {totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} metros
          </div>
          {finalizados > 0 && (
            <div className="bg-green-500/30 rounded-lg px-3 py-1.5 text-sm font-semibold">
              {finalizados} ✓ prontos
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
            {hoje && <Badge className="text-xs mt-1 bg-primary/10 text-primary border-primary/20">Hoje</Badge>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSelectedDay(d => format(addDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Mini calendário de dias com pedidos */}
        {diasComPedidos.length > 0 && (
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto">
            {diasComPedidos.slice(-14).map(dia => {
              const qtd = pedidos.filter(p => p.data === dia).length;
              const fin = pedidos.filter(p => p.data === dia && p.status === "finalizado").length;
              const isSelected = dia === selectedDay;
              return (
                <button
                  key={dia}
                  onClick={() => setSelectedDay(dia)}
                  className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-center transition-all border text-xs ${
                    isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="font-bold">{format(new Date(dia + "T12:00:00"), "dd/MM")}</p>
                  <p className={isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}>
                    {fin}/{qtd}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumo do dia */}
      {pedidosDia.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: `${totalMetros.toFixed(0)}m`, color: "text-primary" },
            { label: "Pendentes", value: pendentes, color: "text-slate-600" },
            { label: "Produzindo", value: emProducao, color: "text-amber-600" },
            { label: "Prontos", value: finalizados, color: "text-green-600" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lista de pedidos */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : ordenados.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Circle className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">Sem pedidos para este dia</p>
            <p className="text-sm text-muted-foreground mt-1">
              {diasComPedidos.length > 0
                ? "Navegue nos dias acima para ver pedidos de outros dias"
                : "Quando o admin cadastrar pedidos para esta máquina, eles aparecerão aqui"}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {ordenados.map(p => (
            <PedidoRow key={p.id} pedido={p} onStatusChange={handleStatusChange} onUpdate={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}