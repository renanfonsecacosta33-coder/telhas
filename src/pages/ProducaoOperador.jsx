import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Circle, Clock, ChevronLeft, ChevronRight,
  Pause, Play, XCircle, Timer
} from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import PausaDialog from "@/components/producao/PausaDialog";
import ConflitoDialog from "@/components/producao/ConflitoDialog";
import CronometroProducao from "@/components/producao/CronometroProducao";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", icon: Circle, badge: "bg-gray-100 text-gray-700 border-gray-200" },
  em_producao: { label: "Em Produção", icon: Clock, badge: "bg-amber-100 text-amber-700 border-amber-200" },
  pausado: { label: "Pausado", icon: Pause, badge: "bg-orange-100 text-orange-700 border-orange-200" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, badge: "bg-green-100 text-green-700 border-green-200" },
  cancelado: { label: "Cancelado", icon: XCircle, badge: "bg-red-100 text-red-700 border-red-200" },
};

const STATUS_ORDER = { em_producao: 0, pausado: 1, pendente: 2, finalizado: 3, cancelado: 4 };

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
  const [pausaTarget, setPausaTarget] = useState(null);
  const [conflitoInfo, setConflitoInfo] = useState(null);
  const queryClient = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-operador", maquina],
    queryFn: () => base44.entities.Pedido.filter({ maquina }, "-data", 200),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-operador", maquina] });
      toast.success("Status atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const pedidosDia = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    if (selectedDay !== hoje) return pedidos.filter((p) => p.data === selectedDay);
    const atrasados = pedidos.filter(
      (p) => p.data < hoje && p.status !== "finalizado" && p.status !== "cancelado"
    );
    return [...atrasados, ...pedidos.filter((p) => p.data === selectedDay)];
  }, [pedidos, selectedDay]);

  const totalDia = pedidosDia.reduce((s, p) => s + (p.metros || 0), 0);
  const finalizados = pedidosDia.filter((p) => p.status === "finalizado").length;
  const emProducao = pedidosDia.filter((p) => p.status === "em_producao").length;
  const pausados = pedidosDia.filter((p) => p.status === "pausado").length;
  const pendentes = pedidosDia.filter((p) => p.status === "pendente").length;

  // ─── Time helpers ───
  const getElapsedProducao = (p) => {
    if (p.status !== "em_producao" || !p.inicio_producao_ts) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(p.inicio_producao_ts).getTime()) / 1000));
  };

  const getElapsedPausa = (p) => {
    if (!p.inicio_pausa_ts) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(p.inicio_pausa_ts).getTime()) / 1000));
  };

  const buildHistoricoPausas = (p, newEntry) => {
    let historico = [];
    try {
      historico = JSON.parse(p.historico_pausas || "[]");
    } catch {
      historico = [];
    }
    if (newEntry) historico.push(newEntry);
    return JSON.stringify(historico);
  };

  // ─── Conflict detection ───
  const verificarConflito = (pedidoId) =>
    pedidos.find(
      (p) =>
        p.id !== pedidoId &&
        p.maquina === maquina &&
        (p.status === "em_producao" || p.status === "pausado")
    );

  // ─── Status handlers ───
  const executarIniciar = (p) => {
    updateMutation.mutate({
      id: p.id,
      data: {
        status: "em_producao",
        inicio_producao_ts: new Date().toISOString(),
        data_finalizacao: null,
      },
    });
  };

  const handleIniciar = (p) => {
    const conflito = verificarConflito(p.id);
    if (conflito) {
      setConflitoInfo({ target: p, conflitante: conflito, acao: "iniciar" });
      return;
    }
    executarIniciar(p);
  };

  const executarRetomar = (p) => {
    const agora = new Date().toISOString();
    const pauseSeg = getElapsedPausa(p);
    const isSetup = p.motivo_pausa === "Setup de Máquina";

    const newEntry = {
      motivo: p.motivo_pausa || "Outros",
      inicio: p.inicio_pausa_ts,
      fim: agora,
      segundos: pauseSeg,
    };

    const data = {
      status: "em_producao",
      inicio_producao_ts: agora,
      inicio_pausa_ts: null,
      motivo_pausa: null,
      historico_pausas: buildHistoricoPausas(p, newEntry),
    };

    if (isSetup) {
      data.tempo_setup_seg = (p.tempo_setup_seg || 0) + pauseSeg;
    } else {
      data.tempo_pausa_seg = (p.tempo_pausa_seg || 0) + pauseSeg;
    }

    updateMutation.mutate({ id: p.id, data });
  };

  const handleRetomar = (p) => {
    const conflito = verificarConflito(p.id);
    if (conflito) {
      setConflitoInfo({ target: p, conflitante: conflito, acao: "retomar" });
      return;
    }
    executarRetomar(p);
  };

  const handlePausar = (p) => setPausaTarget(p);

  const confirmarPausa = (motivo) => {
    const p = pausaTarget;
    if (!p) return;
    const agora = new Date().toISOString();
    const prodSeg = getElapsedProducao(p);

    updateMutation.mutate({
      id: p.id,
      data: {
        status: "pausado",
        inicio_pausa_ts: agora,
        inicio_producao_ts: null,
        motivo_pausa: motivo,
        tempo_producao_seg: (p.tempo_producao_seg || 0) + prodSeg,
      },
    });
    setPausaTarget(null);
  };

  const handleFinalizar = (p) => {
    const agora = new Date().toISOString();
    const data = {
      status: "finalizado",
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
    };

    if (p.status === "em_producao") {
      const prodSeg = getElapsedProducao(p);
      data.tempo_producao_seg = (p.tempo_producao_seg || 0) + prodSeg;
      data.inicio_producao_ts = null;
    } else if (p.status === "pausado") {
      const pauseSeg = getElapsedPausa(p);
      if (p.motivo_pausa === "Setup de Máquina") {
        data.tempo_setup_seg = (p.tempo_setup_seg || 0) + pauseSeg;
      } else {
        data.tempo_pausa_seg = (p.tempo_pausa_seg || 0) + pauseSeg;
      }
      data.historico_pausas = buildHistoricoPausas(p, {
        motivo: p.motivo_pausa || "Outros",
        inicio: p.inicio_pausa_ts,
        fim: agora,
        segundos: pauseSeg,
      });
      data.inicio_pausa_ts = null;
      data.motivo_pausa = null;
    }

    updateMutation.mutate({ id: p.id, data });
  };

  const handleCancelar = (p) => {
    const data = { status: "cancelado" };
    if (p.status === "em_producao") {
      data.inicio_producao_ts = null;
      data.tempo_producao_seg = (p.tempo_producao_seg || 0) + getElapsedProducao(p);
    } else if (p.status === "pausado") {
      data.inicio_pausa_ts = null;
    }
    updateMutation.mutate({ id: p.id, data });
  };

  const handleReabrir = (p) => {
    updateMutation.mutate({
      id: p.id,
      data: { status: "pendente", data_finalizacao: null },
    });
  };

  const resolverConflito = () => {
    if (!conflitoInfo) return;
    if (conflitoInfo.acao === "iniciar") executarIniciar(conflitoInfo.target);
    else if (conflitoInfo.acao === "retomar") executarRetomar(conflitoInfo.target);
    setConflitoInfo(null);
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDay((d) => format(subDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="!text-center">
          <p className="font-bold capitalize">
            {format(new Date(selectedDay + "T12:00:00"), "EEEE", { locale: ptBR })}
          </p>
          <p className="text-sm text-muted-foreground capitalize">
            {format(new Date(selectedDay + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
          </p>
          {isToday(new Date(selectedDay + "T12:00:00")) && (
            <Badge className="text-xs mt-1 bg-primary/10 text-primary border-primary/20">Hoje</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDay((d) => format(addDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Resumo do dia */}
      {pedidosDia.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalDia.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">metros</p>
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
            <p className="text-2xl font-bold text-orange-600">{pausados}</p>
            <p className="text-xs text-muted-foreground">pausados</p>
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
          <p className="text-sm text-muted-foreground">
            Quando o admin cadastrar pedidos para esta máquina, eles aparecerão aqui
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidosDia
            .slice()
            .sort((a, b) => {
              const hoje = format(new Date(), "yyyy-MM-dd");
              const aAtrasado = a.data < hoje && a.status !== "finalizado" && a.status !== "cancelado" ? 0 : 1;
              const bAtrasado = b.data < hoje && b.status !== "finalizado" && b.status !== "cancelado" ? 0 : 1;
              if (aAtrasado !== bAtrasado) return aAtrasado - bAtrasado;
              return (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2);
            })
            .map((p) => {
              const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendente;
              const Icon = st.icon;
              const isAtivo = p.status === "em_producao" || p.status === "pausado";
              const isAtrasado =
                p.data < format(new Date(), "yyyy-MM-dd") &&
                p.status !== "finalizado" &&
                p.status !== "cancelado";

              return (
                <div
                  key={p.id}
                  className={`border-2 rounded-xl p-4 transition-all duration-200 hover:shadow-md ${
                    PRODUTO_CORES[p.produto] || "bg-card border-border"
                  } ${
                    p.status === "em_producao"
                      ? "ring-2 ring-amber-400/40 shadow-sm"
                      : p.status === "pausado"
                      ? "ring-2 ring-orange-400/40"
                      : ""
                  }`}
                >
                  {/* Header do card */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAtivo && (
                          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                            <span
                              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                                p.status === "em_producao" ? "bg-amber-500" : "bg-orange-500"
                              }`}
                            />
                            <span
                              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                                p.status === "em_producao" ? "bg-amber-500" : "bg-orange-500"
                              }`}
                            />
                          </span>
                        )}
                        <span className="font-bold text-lg">{p.produto}</span>
                        <Badge className={`border text-xs ${st.badge}`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {st.label}
                        </Badge>
                        {isAtrasado && (
                          <Badge className="bg-red-500 text-white border-red-600 animate-pulse text-xs">
                            ⚠️ Prioridade (Dia Anterior)
                          </Badge>
                        )}
                      </div>
                      {p.cliente && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Cliente: <span className="font-medium text-foreground">{p.cliente}</span>
                        </p>
                      )}
                      {p.numero_pedido && (
                        <p className="text-xs text-muted-foreground">Pedido: #{p.numero_pedido}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-primary">
                        {(p.metros || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        <span className="text-sm font-normal">m</span>
                      </p>
                      {p.valor && (
                        <p className="text-xs text-muted-foreground">
                          R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Detalhes técnicos */}
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mb-3">
                    {p.rvm_superior && (
                      <span>
                        RVM: <span className="text-foreground font-medium">{p.rvm_superior}</span>
                      </span>
                    )}
                    {p.eps && (
                      <span>
                        EPS: <span className="text-foreground font-medium">{p.eps}</span>
                      </span>
                    )}
                    {p.bobina_superior && (
                      <span>
                        Bobina: <span className="text-foreground font-medium">{p.bobina_superior}</span>
                      </span>
                    )}
                    {p.kg_total && (
                      <span>
                        Peso: <span className="text-foreground font-medium">{p.kg_total}kg</span>
                      </span>
                    )}
                    {p.data_prevista && (
                      <span>
                        Previsto:{" "}
                        <span className="text-foreground font-medium">
                          {format(new Date(p.data_prevista + "T12:00:00"), "dd/MM")}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Cronômetro (apenas para pedidos ativos) */}
                  {isAtivo && <CronometroProducao pedido={p} />}

                  {p.observacoes && (
                    <div className="bg-white/60 rounded-lg px-3 py-2 text-xs mt-3 mb-3">
                      {p.observacoes}
                    </div>
                  )}

                  {/* Ações de status */}
                  <div className="flex gap-2 mt-3">
                    {/* Pendente → Iniciar */}
                    {p.status === "pendente" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                        disabled={updateMutation.isPending}
                        onClick={() => handleIniciar(p)}
                      >
                        <Play className="w-3 h-3" />
                        Iniciar
                      </Button>
                    )}

                    {/* Em Produção → Pausar */}
                    {p.status === "em_producao" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                        disabled={updateMutation.isPending}
                        onClick={() => handlePausar(p)}
                      >
                        <Pause className="w-3 h-3" />
                        Pausar
                      </Button>
                    )}

                    {/* Pausado → Retomar */}
                    {p.status === "pausado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                        disabled={updateMutation.isPending}
                        onClick={() => handleRetomar(p)}
                      >
                        <Play className="w-3 h-3" />
                        Retomar
                      </Button>
                    )}

                    {/* Finalizar (em_producao ou pausado) */}
                    {(p.status === "em_producao" || p.status === "pausado") && (
                      <Button
                        size="sm"
                        className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                        disabled={updateMutation.isPending}
                        onClick={() => handleFinalizar(p)}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Finalizar
                      </Button>
                    )}

                    {/* Reabrir (finalizado) */}
                    {p.status === "finalizado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        disabled={updateMutation.isPending}
                        onClick={() => handleReabrir(p)}
                      >
                        <Timer className="w-3 h-3" />
                        Reabrir
                      </Button>
                    )}

                    {/* Cancelar (pendente, em_producao, pausado) */}
                    {p.status !== "finalizado" && p.status !== "cancelado" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={updateMutation.isPending}
                        onClick={() => handleCancelar(p)}
                        title="Cancelar pedido"
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Dialogs */}
      <PausaDialog
        open={!!pausaTarget}
        pedido={pausaTarget}
        onConfirm={confirmarPausa}
        onCancel={() => setPausaTarget(null)}
      />
      <ConflitoDialog
        open={!!conflitoInfo}
        conflitante={conflitoInfo?.conflitante}
        onConfirm={resolverConflito}
        onCancel={() => setConflitoInfo(null)}
      />
    </div>
  );
}