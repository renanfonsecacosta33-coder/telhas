import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", icon: Circle, color: "text-muted-foreground", badge: "bg-gray-100 text-gray-700 border-gray-200" },
  em_producao: { label: "Em Produção", icon: Clock, color: "text-amber-600", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, color: "text-green-600", badge: "bg-green-100 text-green-700 border-green-200" },
};

const PRODUTO_CORES = {
  "TELHA": "bg-blue-50 border-blue-200",
  "TELHA + EPS": "bg-green-50 border-green-200",
  "TELHA + EPS + MANTA": "bg-teal-50 border-teal-200",
  "TELHA + EPS + TELHA": "bg-indigo-50 border-indigo-200",
  "TELHA BANDEJA": "bg-pink-50 border-pink-200",
  "BOBININHA": "bg-yellow-50 border-yellow-200",
  "CUMEEIRA": "bg-orange-50 border-orange-200",
  "PAINEL": "bg-purple-50 border-purple-200",
};

export default function ProducaoOperador({ maquina, userName }) {
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-operador", maquina],
    queryFn: () => base44.entities.Pedido.filter({ maquina }, "-data", 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pedidos-operador", maquina] }); toast.success("Status atualizado!"); },
  });

  const pedidosDia = useMemo(() => {
    return pedidos.filter(p => p.data === selectedDay);
  }, [pedidos, selectedDay]);

  const totalDia = pedidosDia.reduce((s, p) => s + (p.metros || 0), 0);
  const finalizados = pedidosDia.filter(p => p.status === "finalizado").length;
  const emProducao = pedidosDia.filter(p => p.status === "em_producao").length;
  const pendentes = pedidosDia.filter(p => p.status === "pendente").length;

  const setStatus = (pedido, status) => {
    const data = { ...pedido, status };
    if (status === "finalizado") data.data_finalizacao = format(new Date(), "yyyy-MM-dd");
    if (status === "em_producao") data.data_finalizacao = null;
    updateMutation.mutate({ id: pedido.id, data });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header operador */}
      <div className="bg-primary rounded-2xl p-6 text-primary-foreground">
        <p className="text-sm opacity-75">Operador: {userName}</p>
        <h1 className="text-2xl font-bold mt-1">{maquina}</h1>
        <p className="text-sm opacity-75 mt-1">Seus pedidos do dia</p>
      </div>

      {/* Navegação de dia */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDay(d => format(subDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="font-bold">{format(new Date(selectedDay + "T12:00:00"), "EEEE", { locale: ptBR })}</p>
          <p className="text-sm text-muted-foreground">{format(new Date(selectedDay + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}</p>
          {isToday(new Date(selectedDay + "T12:00:00")) && <Badge className="text-xs mt-1 bg-primary/10 text-primary border-primary/20">Hoje</Badge>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDay(d => format(addDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Resumo do dia */}
      {pedidosDia.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalDia.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">metros total</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-500">{pendentes}</p>
            <p className="text-xs text-muted-foreground">pendentes</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{emProducao}</p>
            <p className="text-xs text-muted-foreground">produzindo</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{finalizados}</p>
            <p className="text-xs text-muted-foreground">prontos</p>
          </div>
        </div>
      )}

      {/* Lista de pedidos */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : pedidosDia.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl">
          <Circle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="font-semibold">Nenhum pedido para hoje</p>
          <p className="text-sm text-muted-foreground">Quando o admin cadastrar pedidos para esta máquina, eles aparecerão aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidosDia
            .sort((a, b) => {
              const order = { em_producao: 0, pendente: 1, finalizado: 2, cancelado: 3 };
              return (order[a.status] || 1) - (order[b.status] || 1);
            })
            .map(p => {
              const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendente;
              const Icon = st.icon;
              return (
                <div key={p.id} className={`border-2 rounded-xl p-4 ${PRODUTO_CORES[p.produto] || "bg-card border-border"}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg">{p.produto}</span>
                        <Badge className={`border text-xs ${st.badge}`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {st.label}
                        </Badge>
                      </div>
                      {p.cliente && <p className="text-sm text-muted-foreground mt-0.5">Cliente: <span className="font-medium text-foreground">{p.cliente}</span></p>}
                      {p.numero_pedido && <p className="text-xs text-muted-foreground">Pedido: #{p.numero_pedido}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-primary">{(p.metros || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}<span className="text-sm font-normal">m</span></p>
                      {p.valor && <p className="text-xs text-muted-foreground">R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>}
                    </div>
                  </div>

                  {/* Detalhes */}
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mb-3">
                    {p.rvm_superior && <span>RVM: <span className="text-foreground font-medium">{p.rvm_superior}</span></span>}
                    {p.eps && <span>EPS: <span className="text-foreground font-medium">{p.eps}</span></span>}
                    {p.bobina_superior && <span>Bobina: <span className="text-foreground font-medium">{p.bobina_superior}</span></span>}
                    {p.kg_total && <span>Peso: <span className="text-foreground font-medium">{p.kg_total}kg</span></span>}
                    {p.data_prevista && <span>Previsto: <span className="text-foreground font-medium">{format(new Date(p.data_prevista + "T12:00:00"), "dd/MM")}</span></span>}
                  </div>

                  {p.observacoes && (
                    <div className="bg-white/60 rounded-lg px-3 py-2 text-xs mb-3">{p.observacoes}</div>
                  )}

                  {/* Ações de status */}
                  <div className="flex gap-2">
                    {p.status !== "em_producao" && p.status !== "finalizado" && (
                      <Button size="sm" variant="outline" className="flex-1 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setStatus(p, "em_producao")}>
                        <Clock className="w-3 h-3" />
                        Iniciar
                      </Button>
                    )}
                    {p.status !== "finalizado" && (
                      <Button size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700" onClick={() => setStatus(p, "finalizado")}>
                        <CheckCircle2 className="w-3 h-3" />
                        Finalizar
                      </Button>
                    )}
                    {p.status === "finalizado" && (
                      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setStatus(p, "pendente")}>
                        Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}