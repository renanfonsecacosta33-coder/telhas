import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Circle, ChevronLeft, ChevronRight, AlertCircle, Layers } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pendente:    { label: "Pendente",    Icon: Circle,       color: "bg-slate-100 text-slate-600 border-slate-200",  dot: "bg-slate-400" },
  em_producao: { label: "Em Produção", Icon: Clock,        color: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-500" },
  finalizado:  { label: "Finalizado",  Icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500" },
  cancelado:   { label: "Cancelado",   Icon: AlertCircle,  color: "bg-red-100 text-red-700 border-red-200",        dot: "bg-red-400"   },
};

const PRODUTO_BG = {
  "TELHA":              "border-l-blue-400",
  "TELHA + EPS":        "border-l-emerald-400",
  "TELHA + EPS + MANTA":"border-l-teal-400",
  "TELHA + EPS + TELHA":"border-l-indigo-400",
  "TELHA BANDEJA":      "border-l-pink-400",
  "BOBININHA":          "border-l-yellow-400",
  "CUMEEIRA":           "border-l-orange-400",
  "PAINEL":             "border-l-purple-400",
};

function PedidoRow({ pedido: p, onStatusChange }) {
  const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendente;
  const borderColor = PRODUTO_BG[p.produto] || "border-l-slate-300";

  const nextStatus = p.status === "pendente" ? "em_producao"
    : p.status === "em_producao" ? "finalizado"
    : p.status === "finalizado" ? "pendente"
    : "pendente";

  const actionLabel = p.status === "pendente" ? "▶ Iniciar"
    : p.status === "em_producao" ? "✓ Finalizar"
    : "↩ Reabrir";

  const actionClass = p.status === "pendente"
    ? "border-amber-300 text-amber-700 hover:bg-amber-50"
    : p.status === "em_producao"
    ? "bg-green-600 text-white hover:bg-green-700 border-green-600"
    : "border-slate-300 text-slate-600 hover:bg-slate-50";

  return (
    <div className={`border-l-4 ${borderColor} bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-base">{p.produto}</span>
            <Badge className={`border text-xs ${st.color}`}>
              <st.Icon className="w-3 h-3 mr-1" />
              {st.label}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
            {p.cliente && (
              <span className="font-semibold text-slate-700">{p.cliente}</span>
            )}
            {p.vendedor && (
              <span className="text-muted-foreground">{p.vendedor}</span>
            )}
            {p.numero_pedido && (
              <span className="text-muted-foreground font-mono text-xs">#{p.numero_pedido}</span>
            )}
          </div>
        </div>

        {/* Metros destaque */}
        <div className="text-right flex-shrink-0">
          <p className="text-3xl font-black text-primary leading-none">
            {(p.metros || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            <span className="text-base font-normal text-muted-foreground">m</span>
          </p>
          {p.valor > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </div>

      {/* Detalhes técnicos */}
      <div className="flex flex-wrap gap-2 mb-3">
        {p.bobina_superior && (
          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
            Bobina: {p.bobina_superior}
          </span>
        )}
        {p.rvm_superior && (
          <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
            {p.rvm_superior}{p.rvm_inferior ? ` / ${p.rvm_inferior}` : ""}
          </span>
        )}
        {p.eps && (
          <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
            EPS: {p.eps}
          </span>
        )}
        {p.kg_total > 0 && (
          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
            {p.kg_total} kg
          </span>
        )}
        {p.maquinario_superior && (
          <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full">
            Maq: {p.maquinario_superior}
          </span>
        )}
        {p.data_prevista && (
          <span className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full">
            Previsto: {format(new Date(p.data_prevista + "T12:00:00"), "dd/MM")}
          </span>
        )}
      </div>

      {p.observacoes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 text-xs text-yellow-800 mb-3">
          {p.observacoes}
        </div>
      )}

      {/* Etapas de produção do produto */}
      <EtapasProducao produto={p.produto} />

      {/* Botão de ação */}
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className={`gap-1 font-semibold ${actionClass}`}
          onClick={() => onStatusChange(p, nextStatus)}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function EtapasProducao({ produto }) {
  const etapas = {
    "TELHA": [
      "Verificar bobina metálica (espessura e cor)",
      "Passar pela perfiladeira",
      "Cortar no tamanho",
    ],
    "TELHA + EPS": [
      "Verificar bobina superior (metal)",
      "Separar bloco de EPS",
      "Colar EPS na chapa (cola + fita)",
      "Passar pela colagem",
    ],
    "TELHA + EPS + TELHA": [
      "Verificar bobina superior",
      "Verificar bobina inferior",
      "Separar EPS do tipo correto",
      "Colar EPS na chapa superior",
      "Colar chapa inferior (cola x2 + fita)",
      "Passar pela colagem",
    ],
    "TELHA + EPS + MANTA": [
      "Verificar bobina superior",
      "Separar EPS",
      "Preparar manta térmica",
      "Colar EPS + manta na chapa (cola + fita)",
    ],
    "TELHA BANDEJA": [
      "Verificar bobina superior",
      "Verificar bobina inferior (Bandeja)",
      "Separar EPS específico Bandeja",
      "Colar com cola x2 nas duas faces",
    ],
    "BOBININHA": [
      "Preparar desbobinador",
      "Cortar e rebobinar",
    ],
    "CUMEEIRA": [
      "Verificar bobina e cor",
      "Passar pela cumeeira",
      "Cortar e empacotar",
    ],
  };

  const steps = etapas[produto];
  if (!steps) return null;

  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers className="w-3 h-3 text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Etapas de Produção</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">{i + 1}</span>
            <span>{step}</span>
            {i < steps.length - 1 && <span className="text-slate-300 ml-1">›</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MaquinaPanel({ maquina }) {
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-maquina", maquina],
    queryFn: () => base44.entities.Pedido.filter({ maquina }, "-data", 300),
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
      toast.success("Status atualizado!");
    },
  });

  const handleStatusChange = (pedido, novoStatus) => {
    const data = { ...pedido, status: novoStatus };
    if (novoStatus === "finalizado") data.data_finalizacao = format(new Date(), "yyyy-MM-dd");
    updateMutation.mutate({ id: pedido.id, data });
  };

  const pedidosDia = useMemo(() => {
    return pedidos.filter(p => p.data === selectedDay);
  }, [pedidos, selectedDay]);

  const hoje = isToday(new Date(selectedDay + "T12:00:00"));
  const totalMetros = pedidosDia.reduce((s, p) => s + (p.metros || 0), 0);
  const finalizados = pedidosDia.filter(p => p.status === "finalizado").length;
  const emProducao = pedidosDia.filter(p => p.status === "em_producao").length;
  const pendentes = pedidosDia.filter(p => p.status === "pendente").length;

  const ordenados = useMemo(() => {
    const order = { em_producao: 0, pendente: 1, finalizado: 2, cancelado: 3 };
    return [...pedidosDia].sort((a, b) => (order[a.status] || 1) - (order[b.status] || 1));
  }, [pedidosDia]);

  // Próximos dias com pedidos
  const diasComPedidos = useMemo(() => {
    const set = new Set(pedidos.map(p => p.data));
    return Array.from(set).sort();
  }, [pedidos]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
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
            <PedidoRow key={p.id} pedido={p} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}