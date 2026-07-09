import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Circle, ChevronLeft, ChevronRight, ArrowLeft, BarChart2, Plus, Star, Trash2, Edit3, Route } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import PedidoRow from "@/components/producao/PedidoRow";
import PedidoFormDialog from "@/components/producao/PedidoFormDialog";
import { useFilial } from "@/contexts/FilialContext";
import { playAlertSound, speakNovaOp, playFinishSound, speakOpFinalizada } from "@/lib/sounds";
import { HistoricoPedidoTelhasButton } from "@/components/producao/HistoricoPedidoTelhasSidebar";
import PainelSolicitacoesProducao from "@/components/producao/PainelSolicitacoesProducao";

const STATUS_LABELS_TELHAS = {
  pendente: "Pendente",
  em_producao: "Em Produção",
  pausado: "Pausado",
  aguardando_colagem: "Aguardando Colagem",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};







const DASH_PATHS = {
  "TP - 40": "/dashboard/tp40",
  "TP - 25": "/dashboard/tp25",
  "ONDULADA": "/dashboard/ondulada",
  "COLONIAL": "/dashboard/colonial",
  "BANDEJA": "/dashboard/bandeja",
  "DESBOBINADOR": "/dashboard/desbobinador",
  "CUMEEIRA": "/dashboard/cumeeira",
  "COLAGEM": "/dashboard/colagem",
};

export default function MaquinaPanel({ maquina }) {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [editandoPedido, setEditandoPedido] = useState(null);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  const isOperador = user?.role === "operador";
  const podeGerenciar = !isOperador;

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Adiciona entrada ao histórico de alterações do pedido
  const appendHistorico = (pedido, acao, acaoLabel, detalhes = "") => {
    if (!user) return {};
    const hist = (() => {
      try { return JSON.parse(pedido.historico_alteracoes || "[]"); }
      catch { return []; }
    })();
    hist.push({
      data: new Date().toISOString(),
      usuario: user.full_name || user.email || "—",
      acao,
      acao_label: acaoLabel,
      detalhes,
    });
    return { historico_alteracoes: JSON.stringify(hist) };
  };

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-maquina", maquina, filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ maquina, unidade: filialAtiva }, "-data", 300),
    refetchInterval: 10000,
  });

  // Detectar novas OPs e anunciar por voz
  const prevOrderIds = useRef(new Set());
  useEffect(() => {
    if (!pedidos || pedidos.length === 0) {
      prevOrderIds.current = new Set();
      return;
    }
    const currentIds = new Set(pedidos.map(p => p.id));
    const newOrders = pedidos.filter(p => !prevOrderIds.current.has(p.id));
    if (prevOrderIds.current.size > 0 && newOrders.length > 0) {
      // Só toca som para pedidos pendentes que são NOVOS nesta máquina
      // (não toca para pedidos que vieram de outra máquina já em produção/colagem)
      const trulyNew = newOrders.filter(p => p.status === "pendente");
      if (trulyNew.length > 0) {
        playAlertSound();
        trulyNew.forEach(p => {
          speakNovaOp(p.maquina, p.numero_pedido);
        });
      }
    }
    prevOrderIds.current = currentIds;
  }, [pedidos]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
      toast.success("Status atualizado!");
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const hist = [{
        data: new Date().toISOString(),
        usuario: user?.full_name || user?.email || "—",
        acao: "criado",
        acao_label: "Pedido Criado",
        detalhes: `Produto: ${data.produto || "—"}${data.cliente ? " · Cliente: " + data.cliente : ""}`,
      }];
      return base44.entities.Pedido.create({ ...data, historico_alteracoes: JSON.stringify(hist) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
      setNovoPedidoOpen(false);
      toast.success("Pedido criado!");
    },
  });

  const handleStatusChange = (pedido, novoStatus, extraData = {}) => {
    const acaoMap = {
      em_producao: pedido.status === "pausado" ? ["retomado", "Retomou Produção"] : ["iniciado", "Iniciou Produção"],
      pausado: ["pausado", "Pausou Produção"],
      finalizado: ["finalizado", "Finalizou Pedido"],
      aguardando_colagem: ["status_alterado", "Enviado para Colagem"],
      pendente: ["status_alterado", `Retornou para Pendente`],
      cancelado: ["status_alterado", "Cancelado"],
    };
    const [acao, label] = acaoMap[novoStatus] || ["status_alterado", `Status → ${STATUS_LABELS_TELHAS[novoStatus] || novoStatus}`];
    const detalhes = novoStatus === "pausado" && extraData.motivo_pausa
      ? `Motivo: ${extraData.motivo_pausa}`
      : novoStatus === "finalizado" && extraData.metragem_utilizada
        ? `Metragem: ${extraData.metragem_utilizada}m`
        : "";
    const histData = appendHistorico(pedido, acao, label, detalhes);
    const data = { ...pedido, status: novoStatus, ...extraData, ...histData };
    if (novoStatus === "finalizado") {
      playFinishSound();
      speakOpFinalizada(pedido.maquina, pedido.numero_pedido);
    }
    updateMutation.mutate({ id: pedido.id, data });
  };

  // Pedidos que "passaram" por esta máquina (foram para outra após aqui)
  // Busca também pedidos com histórico nesta máquina
  // No dia de hoje, inclui também pedidos atrasados (não finalizados/cancelados)
  const pedidosDia = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    const isHoje = selectedDay === hoje;
    if (!isHoje) {
      return pedidos.filter(p => p.data === selectedDay || p.status === "pausado" || p.status === "em_producao");
    }
    return pedidos.filter(p =>
      p.data === selectedDay ||
      p.status === "pausado" ||
      p.status === "em_producao" ||
      (p.data < hoje && p.status !== "finalizado" && p.status !== "cancelado")
    );
  }, [pedidos, selectedDay]);

  const hoje = isToday(new Date(selectedDay + "T12:00:00"));
  const totalMetros = pedidosDia.reduce((s, p) => s + (p.metros || 0), 0);
  
  // Para o dashboard da máquina: "finalizado" = finalizado OU aguardando_colagem (passou por aqui e foi para outra)
  // Mas se aguardando_colagem e maquina mudou (está em outra), conta como finalizado nessa máquina
  const finalizados = pedidosDia.filter(p => {
    if (p.status === "finalizado") return true;
    // aguardando_colagem e máquina atual é diferente desta → passou por aqui
    if (p.status === "aguardando_colagem" && p.maquina !== maquina) return true;
    return false;
  }).length;
  const emProducao = pedidosDia.filter(p => p.status === "em_producao" || p.status === "pausado").length;
  const pendentes = pedidosDia.filter(p => p.status === "pendente").length;

  const ordenados = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    const order = { em_producao: 0, pausado: 1, pendente: 2, aguardando_colagem: 3, finalizado: 4, cancelado: 5 };
    return [...pedidosDia].sort((a, b) => {
      // Rota tem prioridade máxima, depois prioridade normal
      const rotaDiff = (b.rota ? 1 : 0) - (a.rota ? 1 : 0);
      if (rotaDiff !== 0) return rotaDiff;
      const pri = (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0);
      if (pri !== 0) return pri;
      const aAtrasado = a.data < hoje ? 0 : 1;
      const bAtrasado = b.data < hoje ? 0 : 1;
      if (aAtrasado !== bAtrasado) return aAtrasado - bAtrasado;
      return (order[a.status] ?? 2) - (order[b.status] ?? 2);
    });
  }, [pedidosDia]);

  const togglePrioridade = (pedido) => {
    const novaPri = !pedido.prioridade;
    const histData = appendHistorico(pedido, "prioridade", novaPri ? "Marcou Prioridade" : "Removeu Prioridade");
    updateMutation.mutate({ id: pedido.id, data: { prioridade: novaPri, ...histData } });
  };

  const toggleRota = (pedido) => {
    const novaRota = !pedido.rota;
    const histData = appendHistorico(pedido, "rota", novaRota ? "Marcou como Rota" : "Removeu Rota");
    updateMutation.mutate({ id: pedido.id, data: { rota: novaRota, ...histData } });
  };

  const handleEditPedido = (pedido, formData) => {
    const histData = appendHistorico(pedido, "editado", "Editou Pedido", "Campos atualizados");
    updateMutation.mutate({ id: pedido.id, data: { ...formData, ...histData } });
    setEditandoPedido(null);
  };

  const handleDeletePedido = async (pedido) => {
    if (!confirm(`Excluir pedido ${pedido.numero_pedido ? "#" + pedido.numero_pedido : ""}?\nEsta ação não pode ser desfeita.`)) return;
    const histData = appendHistorico(pedido, "excluido", "Excluiu Pedido");
    // Registra no histórico antes de excluir (best-effort — se o pedido for excluído, o log se perde,
    // mas o usuário será notificado via toast)
    try {
      await base44.entities.Pedido.delete(pedido.id);
      toast.success("Pedido excluído!");
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
    } catch (err) {
      toast.error("Erro ao excluir: " + (err.message || ""));
    }
  };

  // Próximos dias com pedidos
  const diasComPedidos = useMemo(() => {
    const set = new Set(pedidos.map(p => p.data));
    return Array.from(set).sort();
  }, [pedidos]);

  // OP que está rodando agora nesta máquina
  const opRodando = pedidosDia.find(p => p.status === "em_producao");

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Painel de solicitações de produção para o encarregado */}
      {podeGerenciar && (
        <PainelSolicitacoesProducao maquina={maquina} user={user} />
      )}

      {/* Botão de voltar + Dashboard + Novo Pedido */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/producao")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Produção
        </Button>
        {!isOperador && (
          <div className="flex items-center gap-2">
            {DASH_PATHS[maquina] && (
              <Link to={DASH_PATHS[maquina]}>
                <Button variant="outline" size="sm" className="gap-2">
                  <BarChart2 className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
            )}
            <Button size="sm" className="gap-2" onClick={() => setNovoPedidoOpen(true)}>
              <Plus className="w-4 h-4" />
              Novo Pedido
            </Button>
          </div>
        )}
      </div>

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

      {/* Dialog novo pedido */}
      <PedidoFormDialog
        open={novoPedidoOpen}
        onClose={() => setNovoPedidoOpen(false)}
        onSave={(data) => createMutation.mutate({ ...data, maquina, data: selectedDay })}
        defaultDate={selectedDay}
        editItem={{ _presets: { maquina, data: selectedDay } }}
      />

      {/* Dialog editar pedido */}
      {editandoPedido && (
        <PedidoFormDialog
          open={true}
          onClose={() => setEditandoPedido(null)}
          onSave={(data) => handleEditPedido(editandoPedido, data)}
          editItem={editandoPedido}
        />
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
            <div key={p.id}>
              {podeGerenciar && (
                <div className="flex justify-end gap-1 mb-1">
                  {p.status !== "finalizado" && p.status !== "cancelado" && (
                    <>
                      <Button size="sm" variant="ghost" className={`text-xs h-6 px-2 ${p.rota ? "text-red-600 font-bold" : "text-muted-foreground"}`} onClick={() => toggleRota(p)}>
                        <Route className={`w-3 h-3 mr-1 ${p.rota ? "fill-red-500 text-red-500" : ""}`} /> {p.rota ? "Rota" : "Rota"}
                      </Button>
                      <Button size="sm" variant="ghost" className={`text-xs h-6 px-2 ${p.prioridade ? "text-amber-600 font-bold" : "text-muted-foreground"}`} onClick={() => togglePrioridade(p)}>
                        <Star className={`w-3 h-3 mr-1 ${p.prioridade ? "fill-amber-500 text-amber-500" : ""}`} /> {p.prioridade ? "Prioritário" : "Prioridade"}
                      </Button>
                    </>
                  )}
                  <HistoricoPedidoTelhasButton pedido={p} />
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-blue-600" onClick={() => setEditandoPedido(p)}>
                    <Edit3 className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-red-600" onClick={() => handleDeletePedido(p)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Excluir
                  </Button>
                </div>
              )}
              <PedidoRow pedido={p} onStatusChange={handleStatusChange} onUpdate={handleStatusChange} userRole={user?.role} opRodando={opRodando} maquina={maquina} user={user} filialAtiva={filialAtiva} appendHistoricoFn={(pedido, acao, label, detalhes) => appendHistorico(pedido, acao, label, detalhes)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}