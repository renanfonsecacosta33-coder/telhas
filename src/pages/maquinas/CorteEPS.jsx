import React, { useState, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Snowflake, Play, CheckCircle2, Pause, Circle, Clock, Search, Filter, 
  Calendar, Layers, Scissors, Package, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, User, Check
} from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";
import { playAlertSound, playFinishSound } from "@/lib/sounds";
import ChatPedidoButton from "@/components/chat/ChatPedidoButton";
import ImageLink from "@/components/ui/ImageLink";

const PRODUTOS_COM_EPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"];

const STATUS_EPS_LABELS = {
  pendente: { label: "Pendente de Corte", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Circle },
  em_corte: { label: "Em Corte", cls: "bg-blue-100 text-blue-800 border-blue-300", icon: Scissors },
  pronto:   { label: "Pronto / Separado", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
};

function calcularNecessidadeEPS(pedido) {
  let totalMetrosLinear = 0;
  let detalhamento = [];

  // Checa variações de telha
  let vars = [];
  try { vars = JSON.parse(pedido.variacoes_telhas || "[]"); } catch {}

  if (Array.isArray(vars) && vars.length > 0) {
    vars.forEach(v => {
      const q = Number(v.qty) || 0;
      const mm = Number(v.mm) || 0;
      const m = (q * mm) / 1000;
      totalMetrosLinear += m;
      detalhesPush(detalhamento, `${q} pçs x ${mm}mm = ${m.toFixed(1)}m`);
    });
  } else {
    const q = Number(pedido.quantidade_telhas || pedido.metros) || 0;
    const mm = Number(pedido.metragem_mm) || 0;
    if (q > 0 && mm > 0) {
      totalMetrosLinear = (q * mm) / 1000;
      detalhamento.push(`${q} pçs x ${mm}mm = ${totalMetrosLinear.toFixed(1)}m`);
    } else if (q > 0) {
      totalMetrosLinear = q;
      detalhamento.push(`${q} metros lineares`);
    }
  }

  // Se for Telha Sanduíche de dupla camada (ex: TELHA + EPS + TELHA), multiplica por 1 ou 2 conforme estrutura
  const placasEstimatativas = Math.ceil(totalMetrosLinear / 2); // placa padrão 2 metros

  return {
    totalMetrosLinear,
    placasEstimatativas,
    detalhamento,
  };
}

function detalhesPush(arr, item) {
  if (item) arr.push(item);
}

export default function CorteEPS() {
  const { filialAtiva } = useFilial();
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos"); // "todos" | "pendente" | "em_corte" | "pronto"
  const [user, setUser] = useState(null);

  // Modais de Conclusão / Ação
  const [concluirDialog, setConcluirDialog] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [observacoesCorte, setObservacoesCorte] = useState("");
  const [carrinhoLocalizacao, setCarrinhoLocalizacao] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Busca todos os pedidos da filial
  const { data: todosPedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-corte-eps", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva }, "-data", 400),
    refetchInterval: 10000,
  });

  // Filtra apenas pedidos que exigem EPS (por produto ou campo eps preenchido ou máquina colagem)
  const pedidosEPS = useMemo(() => {
    return todosPedidos.filter(p => {
      const e = (p.eps || "").trim();
      const prod = (p.produto || "").toUpperCase();
      const maq = (p.maquina || "").toUpperCase();
      const temEps = e.length > 0 || PRODUTOS_COM_EPS.includes(prod) || maq === "COLAGEM";
      return temEps && p.status !== "cancelado";
    });
  }, [todosPedidos]);

  // Alerta sonoro quando um novo pedido com EPS pendente entra
  const prevCountRef = useRef(null);
  useEffect(() => {
    const pendentesCount = pedidosEPS.filter(p => (p.eps_status || "pendente") === "pendente").length;
    if (prevCountRef.current !== null && pendentesCount > prevCountRef.current) {
      playAlertSound();
    }
    prevCountRef.current = pendentesCount;
  }, [pedidosEPS]);

  // Filtros aplicados por data, status e busca
  const pedidosFiltrados = useMemo(() => {
    return pedidosEPS.filter(p => {
      const st = p.eps_status || "pendente";

      // Filtro de Busca
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchNum = (p.numero_pedido || "").toLowerCase().includes(q);
        const matchCli = (p.cliente || "").toLowerCase().includes(q);
        const matchEps = (p.eps || "").toLowerCase().includes(q);
        const matchProd = (p.produto || "").toLowerCase().includes(q);
        if (!matchNum && !matchCli && !matchEps && !matchProd) return false;
      }

      // Filtro de Status
      if (filterStatus !== "todos" && st !== filterStatus) return false;

      // Se não houver busca, filtra por data selecionada (ou pedidos em corte/pendentes não finalizados)
      if (!search.trim() && filterStatus === "todos") {
        const isSelectedDay = p.data === selectedDay;
        const isEmAndamento = st === "em_corte" || (st === "pendente" && p.data <= selectedDay);
        return isSelectedDay || isEmAndamento;
      }

      return true;
    }).sort((a, b) => {
      const ord = { em_corte: 0, pendente: 1, pronto: 2 };
      const stA = a.eps_status || "pendente";
      const stB = b.eps_status || "pendente";
      return (ord[stA] ?? 1) - (ord[stB] ?? 1);
    });
  }, [pedidosEPS, selectedDay, search, filterStatus]);

  // Stats KPIs
  const stats = useMemo(() => {
    let pendentes = 0;
    let emCorte = 0;
    let prontos = 0;
    let totalMetros = 0;
    let totalPlacas = 0;

    pedidosEPS.forEach(p => {
      const st = p.eps_status || "pendente";
      if (st === "pendente") pendentes++;
      if (st === "em_corte") emCorte++;
      if (st === "pronto") prontos++;

      if (st !== "pronto") {
        const { totalMetrosLinear, placasEstimatativas } = calcularNecessidadeEPS(p);
        totalMetros += totalMetrosLinear;
        totalPlacas += placasEstimatativas;
      }
    });

    return { pendentes, emCorte, prontos, totalMetros, totalPlacas };
  }, [pedidosEPS]);

  // Mutation para atualizar status do EPS no pedido
  const updateEpsMutation = useMutation({
    mutationFn: ({ id, updates }) => base44.entities.Pedido.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-corte-eps"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina"] });
    },
  });

  const handleIniciarCorte = (p) => {
    updateEpsMutation.mutate({
      id: p.id,
      updates: {
        eps_status: "em_corte",
        eps_observacoes: p.eps_observacoes ? `${p.eps_observacoes}\n— Iniciado corte por ${user?.full_name || "Operador"}` : `Iniciado corte por ${user?.full_name || "Operador"}`,
      }
    });
    toast.info(`Corte de EPS iniciado para Pedido #${p.numero_pedido || p.id.slice(-4)}`);
  };

  const handleOpenConcluir = (p) => {
    setPedidoSelecionado(p);
    setObservacoesCorte("");
    setCarrinhoLocalizacao("");
    setConcluirDialog(true);
  };

  const handleConfirmarConclusao = () => {
    if (!pedidoSelecionado) return;
    const locStr = carrinhoLocalizacao.trim() ? ` [Local: ${carrinhoLocalizacao.trim()}]` : "";
    const obsStr = observacoesCorte.trim() ? ` — ${observacoesCorte.trim()}` : "";
    const finalObs = `Pronto e separado por ${user?.full_name || "Operador"}${locStr}${obsStr}`;

    updateEpsMutation.mutate({
      id: pedidoSelecionado.id,
      updates: {
        eps_status: "pronto",
        eps_observacoes: pedidoSelecionado.eps_observacoes ? `${pedidoSelecionado.eps_observacoes}\n${finalObs}` : finalObs,
      }
    });

    playFinishSound();
    setConcluirDialog(false);
    setPedidoSelecionado(null);
    toast.success("EPS marcado como PRONTO e separado!");
  };

  const handleReabrir = (p) => {
    updateEpsMutation.mutate({
      id: p.id,
      updates: { eps_status: "pendente" }
    });
    toast.info("Status de EPS reaberto para Pendente.");
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 text-white rounded-2xl p-6 shadow-lg border border-cyan-800/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-400/30 shadow-inner">
              <Snowflake className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">Painel do Operador de EPS</h1>
                <Badge className="bg-cyan-500/30 text-cyan-200 border-cyan-400/40 text-xs">Isopor & Sanduíche</Badge>
              </div>
              <p className="text-sm text-cyan-100/70 mt-0.5">
                Corte, preparação e separação de blocos de Isopor para Telhas Termoacústicas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedDay(format(subDays(new Date(selectedDay + "T00:00:00"), 1), "yyyy-MM-dd"))}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              {isToday(new Date(selectedDay + "T00:00:00")) ? "Hoje" : format(new Date(selectedDay + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedDay(format(addDays(new Date(selectedDay + "T00:00:00"), 1), "yyyy-MM-dd"))}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pendentes</span>
            <Circle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-amber-600">{stats.pendentes}</p>
          <p className="text-[11px] text-slate-400 mt-1">Aguardando corte</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Em Corte</span>
            <Scissors className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-blue-600">{stats.emCorte}</p>
          <p className="text-[11px] text-slate-400 mt-1">Sendo cortados agora</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Prontos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-emerald-600">{stats.prontos}</p>
          <p className="text-[11px] text-slate-400 mt-1">Separados para colagem</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 shadow-sm bg-gradient-to-br from-cyan-50 to-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-cyan-800 uppercase tracking-wide">Estimativa Placas</span>
            <Layers className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-3xl font-black text-cyan-700">≈ {stats.totalPlacas}</p>
          <p className="text-[11px] text-cyan-600 mt-1">~{stats.totalMetros.toFixed(0)}m lineares a cortar</p>
        </div>
      </div>

      {/* Buscador e Filtros */}
      <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nº pedido, cliente, tipo de EPS..." 
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button 
              size="sm" 
              variant={filterStatus === "todos" ? "default" : "outline"}
              onClick={() => setFilterStatus("todos")}
              className="h-8 text-xs"
            >
              Todos ({pedidosEPS.length})
            </Button>
            <Button 
              size="sm" 
              variant={filterStatus === "pendente" ? "default" : "outline"}
              onClick={() => setFilterStatus("pendente")}
              className="h-8 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              🟡 Pendentes ({stats.pendentes})
            </Button>
            <Button 
              size="sm" 
              variant={filterStatus === "em_corte" ? "default" : "outline"}
              onClick={() => setFilterStatus("em_corte")}
              className="h-8 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
            >
              🔵 Em Corte ({stats.emCorte})
            </Button>
            <Button 
              size="sm" 
              variant={filterStatus === "pronto" ? "default" : "outline"}
              onClick={() => setFilterStatus("pronto")}
              className="h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              🟢 Prontos ({stats.prontos})
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Ordens de EPS */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-cyan-600 rounded-full animate-spin" />
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center text-slate-500 space-y-2">
          <Snowflake className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700">Nenhum pedido de EPS encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Não há ordens pendentes de corte de isopor para o filtro ou data selecionada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pedidosFiltrados.map((p) => {
            const st = p.eps_status || "pendente";
            const cfg = STATUS_EPS_LABELS[st] || STATUS_EPS_LABELS.pendente;
            const IconSt = cfg.icon;
            const { totalMetrosLinear, placasEstimatativas, detalhamento } = calcularNecessidadeEPS(p);

            return (
              <div 
                key={p.id} 
                className={`bg-white border-2 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  st === "em_corte" 
                    ? "border-blue-400 bg-blue-50/20" 
                    : st === "pronto" 
                    ? "border-emerald-300 bg-emerald-50/10 opacity-90" 
                    : "border-slate-200"
                }`}
              >
                <div className="space-y-3">
                  {/* Header do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-base text-slate-900 font-mono block">
                        #{p.numero_pedido || p.id.slice(-6).toUpperCase()}
                      </span>
                      <p className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
                        {p.cliente || "Cliente não informado"}
                      </p>
                    </div>
                    <Badge className={`border text-xs gap-1 font-semibold ${cfg.cls}`}>
                      <IconSt className="w-3 h-3" />
                      {cfg.label}
                    </Badge>
                  </div>

                  {/* Detalhes do Produto e Máquina */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium">Produto:</span>
                      <span className="font-bold text-slate-900">{p.produto || "Telha Sanduíche"}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium">Destino Fábrica:</span>
                      <Badge variant="outline" className="text-[10px] font-bold bg-white text-slate-800">
                        {p.maquina || "COLAGEM"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium">Especificação EPS:</span>
                      <span className="font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                        {p.eps || "EPS Padrão"}
                      </span>
                    </div>
                  </div>

                  {/* Necessidade Calculada de EPS */}
                  <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-900 flex items-center gap-1">
                        <Scissors className="w-3.5 h-3.5 text-cyan-600" />
                        Necessidade de EPS:
                      </span>
                      <span className="font-black text-cyan-700 text-sm">
                        ≈ {placasEstimatativas} placas ({totalMetrosLinear.toFixed(1)}m)
                      </span>
                    </div>
                    {detalhamento.length > 0 && (
                      <div className="text-[10px] text-cyan-800/80 pt-1 border-t border-cyan-200/60 space-y-0.5">
                        {detalhamento.map((d, idx) => (
                          <p key={idx} className="font-mono">{d}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Observações registradas */}
                  {p.eps_observacoes && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900">
                      <span className="font-bold">Histórico / Obs:</span>
                      <p className="whitespace-pre-line text-amber-800 mt-0.5">{p.eps_observacoes}</p>
                    </div>
                  )}
                </div>

                {/* Footer do Card - Botões de Ação */}
                <div className="pt-4 mt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {p.foto_pedido_url && (
                      <ImageLink url={p.foto_pedido_url} name="Foto do Pedido">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500" title="Ver foto do pedido">
                          <Package className="w-4 h-4" />
                        </Button>
                      </ImageLink>
                    )}
                    <ChatPedidoButton 
                      canal_id={p.id} 
                      canal_label={`EPS #${p.numero_pedido || p.id.slice(-4)}`} 
                      currentUser={user} 
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {st === "pendente" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleIniciarCorte(p)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" /> Iniciar Corte
                      </Button>
                    )}

                    {st === "em_corte" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleOpenConcluir(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Pronto
                      </Button>
                    )}

                    {st === "pronto" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleReabrir(p)}
                        className="text-slate-600 border-slate-300 hover:bg-slate-100 text-xs h-8 gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Concluir / Marcar como Pronto */}
      <Dialog open={concluirDialog} onOpenChange={setConcluirDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Confirmar Corte de EPS Pronto
            </DialogTitle>
          </DialogHeader>
          {pedidoSelecionado && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-950 space-y-1">
                <p className="font-bold text-sm">Pedido #{pedidoSelecionado.numero_pedido || pedidoSelecionado.id.slice(-6).toUpperCase()}</p>
                <p className="text-emerald-800 font-medium">{pedidoSelecionado.cliente || "Sem cliente"}</p>
                <p className="text-emerald-700 font-mono">Especificação: {pedidoSelecionado.eps || "EPS Padrão"}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold">Localização / Carrinho de Separação</Label>
                <Input 
                  placeholder="Ex: Carrinho #3 / Bancada de Colagem" 
                  value={carrinhoLocalizacao}
                  onChange={e => setCarrinhoLocalizacao(e.target.value)}
                  className="h-9"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400">Ajuda o operador da colagem a encontrar os blocos rapidamente.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold">Observações / Detalhes do Corte (Opcional)</Label>
                <Textarea 
                  placeholder="Ex: Cortadas 24 placas de 30mm em 6 metros com encaixe perfeito..." 
                  value={observacoesCorte}
                  onChange={e => setObservacoesCorte(e.target.value)}
                  className="h-20"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConcluirDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarConclusao} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <Check className="w-4 h-4" /> Finalizar e Avisar Fábrica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
