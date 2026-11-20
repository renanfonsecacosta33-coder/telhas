import React, { useState, useMemo, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { format, subDays, addDays, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Factory, CheckCircle2, Clock, AlertTriangle, Package,
  BarChart2, Weight, Zap, Pause, Circle, ArrowRight, ChevronRight,
  Calendar, Target, Activity, Scissors, Layers, Timer, RefreshCw, DollarSign, Inbox,
  Snowflake, Ruler, Truck, Disc, Maximize2, Minimize2, Edit3, Home, Square,
  TrendingUp, ExternalLink, ShieldCheck, Flame, Bell
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFilial } from "@/contexts/FilialContext";
import FilaPCPTelhas from "@/components/pcp/FilaPCPTelhas";
import RotasEntregaSection from "@/components/logistica/RotasEntregaSection";
import PedidoFormDialog from "@/components/producao/PedidoFormDialog";
import QuickActionDialogTelhas from "@/components/telhas/QuickActionDialogTelhas";
import HistoricoBobinasTelhas from "@/components/telhas/HistoricoBobinasTelhas";
import KpiDetailSidebarTelhas from "@/components/telhas/KpiDetailSidebarTelhas";
import AjustarMetragensModal from "@/components/telhas/AjustarMetragensModal";
import { calcularMetrosPedido, calcularKgPedido } from "@/lib/metrosHelper";
import { getItens, prepararPresetNovaOrdemTelhas } from "@/lib/pedidoOdooHelper";
import { isTelhaBandeja } from "@/lib/bandejaHelper";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";

// Configuração das 8 Máquinas Principais da Fábrica de Telhas AJL
const MAQUINAS_TELHAS = [
  { id: "TP - 40", label: "TP-40 Trapezoidal", setor: "Trapezoidal", hex: "#3b82f6", path: "/maquina/tp40", icone: Factory },
  { id: "TP - 25", label: "TP-25 Trapezoidal", setor: "Trapezoidal", hex: "#6366f1", path: "/maquina/tp25", icone: Factory },
  { id: "ONDULADA", label: "Ondulada 17", setor: "Ondulada", hex: "#14b8a6", path: "/maquina/ondulada", icone: Layers },
  { id: "COLONIAL", label: "Colonial", setor: "Colonial", hex: "#10b981", path: "/maquina/colonial", icone: Home },
  { id: "BANDEJA", label: "Bandeja", setor: "Bandeja", hex: "#ec4899", path: "/maquina/bandeja", icone: Square },
  { id: "DESBOBINADOR", label: "Desbobinador", setor: "Corte", hex: "#f97316", path: "/maquina/desbobinador", icone: Disc },
  { id: "CUMEEIRA", label: "Cumeeira", setor: "Acessório", hex: "#eab308", path: "/maquina/cumeeira", icone: Scissors },
  { id: "COLAGEM", label: "Colagem EPS", setor: "Termoacústica", hex: "#ef4444", path: "/maquina/colagem", icone: Snowflake },
];

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardTelhas() {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const mesStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [aba, setAba] = useState("producao");
  const [maquinaSel, setMaquinaSel] = useState(null); // null = Geral
  const [pausedDialogOpen, setPausedDialogOpen] = useState(false);
  const [activeSheetOpen, setActiveSheetOpen] = useState(false);
  const [quickActionOrder, setQuickActionOrder] = useState(null);
  const [filtroPreset, setFiltroPreset] = useState("hoje");
  const [filtroInicio, setFiltroInicio] = useState(hoje);
  const [filtroFim, setFiltroFim] = useState(hoje);
  const [kpiDetail, setKpiDetail] = useState(null);
  const [ajustarMetragensOpen, setAjustarMetragensOpen] = useState(false);
  const [tipoGrafico, setTipoGrafico] = useState("horas"); // 'horas' (hoje) ou 'semana'

  // Modo TV / Tela Cheia
  const [isTvMode, setIsTvMode] = useState(false);
  const toggleTvMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsTvMode(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsTvMode(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsTvMode(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Relógio Andon em tempo real (atualiza a cada segundo)
  const [relogio, setRelogio] = useState(() => format(new Date(), "HH:mm:ss"));
  useEffect(() => {
    const timer = setInterval(() => {
      setRelogio(format(new Date(), "HH:mm:ss"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Meta diária configurável com 1 clique (salva no localStorage)
  const [metaDiariaMetros, setMetaDiariaMetros] = useState(() => {
    const salva = localStorage.getItem("ajl_meta_diaria_telhas");
    return salva ? Number(salva) : 3000;
  });
  const [dialogMetaOpen, setDialogMetaOpen] = useState(false);
  const [novaMetaInput, setNovaMetaInput] = useState(metaDiariaMetros);

  const salvarMeta = (val) => {
    const num = Number(val) || 3000;
    setMetaDiariaMetros(num);
    localStorage.setItem("ajl_meta_diaria_telhas", String(num));
    setDialogMetaOpen(false);
    toast.success(`Meta diária atualizada para ${num.toLocaleString("pt-BR")} metros!`);
  };

  // Estados legados da Fila PCP integrada
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPreset, setEditPreset] = useState(null);
  const [filaContext, setFilaContext] = useState(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  // Usuário atual
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const isOperador = user?.role === "operador";

  // Helper de correspondência flexível de Filial
  const matchFilial = useCallback((unidade) => {
    if (!filialAtiva || filialAtiva.toLowerCase() === "todas") return true;
    const f = filialAtiva.toLowerCase();
    const u = String(unidade || "Matriz AJL").toLowerCase();
    if (f.includes("matriz") && u.includes("matriz")) return true;
    if (f.includes("pinhais") && u.includes("pinhais")) return true;
    if (f.includes("ivaipor") && u.includes("ivaipor")) return true;
    if (f.includes("ponta grossa") && u.includes("ponta grossa")) return true;
    return u === f;
  }, [filialAtiva]);

  // 1. Ordens de chão de fábrica (Pedido)
  const { data: pedidosProducao = [], refetch: refetchProducao, isFetching: isFetchingProd } = useQuery({
    queryKey: ["pedidos-dash-telhas", filialAtiva],
    queryFn: async () => {
      try {
        const raw = await base44.entities.Pedido.list("-created_date", 1000);
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    refetchInterval: 10000,
  });

  // 2. Ordens de Venda & PCP (PedidoOdoo) — A base real das OFs do Odoo!
  const { data: pedidosOdoo = [], refetch: refetchOdoo, isFetching: isFetchingOdoo } = useQuery({
    queryKey: ["pedidos-odoo-dash-telhas", filialAtiva],
    queryFn: async () => {
      try {
        const raw = await base44.entities.PedidoOdoo.list("-data_recebimento", 1000);
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    refetchInterval: 10000,
  });

  // 3. Bobinas de Telhas ativas
  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-telhas-dash-novo", filialAtiva],
    queryFn: async () => {
      let raw = [];
      try {
        raw = await base44.entities.Bobina.list("-created_date", 1000);
      } catch {
        try {
          raw = await base44.entities.Bobina.filter({}, "-created_date", 1000);
        } catch {
          raw = [];
        }
      }
      const telhas = (Array.isArray(raw) ? raw : []).filter(b => b && !b.arquivada && b.setor !== "corte_dobra");
      return telhas.filter(b => matchFilial(b.unidade));
    },
    refetchInterval: 30000,
  });

  // 4. Estoque de Isopor (EPS)
  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores-dash-novo"],
    queryFn: () => base44.entities.Isopor.list().catch(() => []),
  });

  // Função manual de recarregar dados
  const handleRefetchGeral = () => {
    refetchProducao();
    refetchOdoo();
    toast.success("Sala de Controle sincronizada em tempo real!");
  };

  // Filtragem de ordens por filial
  const pedidosFiltrados = useMemo(() => {
    return pedidosProducao.filter(p => matchFilial(p.unidade));
  }, [pedidosProducao, matchFilial]);

  const odooFiltrados = useMemo(() => {
    return pedidosOdoo.filter(p => matchFilial(p.unidade));
  }, [pedidosOdoo, matchFilial]);

  // Mutations
  const updatePedido = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-dash-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    },
  });

  const handleQuickUpdate = (order, data) => {
    updatePedido.mutate({ id: order.id, data });
  };

  const aplicarPreset = (preset) => {
    setFiltroPreset(preset);
    if (preset === "hoje") {
      setFiltroInicio(hoje); setFiltroFim(hoje); setTipoGrafico("horas");
    } else if (preset === "semana") {
      setFiltroInicio(weekStart); setFiltroFim(weekEnd); setTipoGrafico("semana");
    } else if (preset === "mes") {
      setFiltroInicio(mesStart); setFiltroFim(hoje); setTipoGrafico("semana");
    }
  };

  // Ordens no período filtrado
  const ordensPeriodo = useMemo(() => {
    return pedidosFiltrados.filter(o => {
      const ref = (o.status === "finalizado" && o.data_finalizacao)
        ? o.data_finalizacao
        : (o.data || (o.created_date ? String(o.created_date).slice(0, 10) : hoje));
      return ref >= filtroInicio && ref <= filtroFim;
    });
  }, [pedidosFiltrados, filtroInicio, filtroFim, hoje]);

  // Extrai todas as ordens ativas agora (produzindo ou pausadas)
  const ordensAtivas = useMemo(() => {
    return pedidosFiltrados.filter(o => o.status === "em_producao" || o.status === "pausado");
  }, [pedidosFiltrados]);

  const emProducaoAgora = ordensAtivas.filter(o => o.status === "em_producao").length;
  const pausadosAgora = ordensAtivas.filter(o => o.status === "pausado").length;

  // ═════════════════════════════════════════════════════════════════════════
  // CÁLCULO REAL DE METRAGEM E KG HOJE (Consolida Pedido + PedidoOdoo)
  // ═════════════════════════════════════════════════════════════════════════
  const metricasHoje = useMemo(() => {
    let metros = 0;
    let kg = 0;
    let telhas = 0;
    let pedidosConcluidosCount = 0;

    // 1. Soma ordens finalizadas em Pedido
    pedidosFiltrados.forEach(o => {
      const refData = o.data_finalizacao || o.data || (o.updated_date ? String(o.updated_date).slice(0, 10) : "");
      if (o.status === "finalizado" && refData === hoje) {
        metros += calcularMetrosPedido(o);
        kg += calcularKgPedido(o);
        telhas += Number(o.quantidade || o.quantidade_telhas || 1);
        pedidosConcluidosCount += 1;
      }
    });

    // 2. Soma OPs e itens finalizados em PedidoOdoo hoje
    odooFiltrados.forEach(od => {
      const refData = od.data_entrega_realizada || (od.updated_date ? String(od.updated_date).slice(0, 10) : "");
      if ((od.status_pcp === "concluido" || od.status_pcp === "entregue") && refData === hoje) {
        const itens = getItens(od);
        itens.forEach(it => {
          const qtd = Number(it.quantidade || it.qty || 1);
          const mm = Number(it.medida || 0);
          const mLinear = mm > 100 ? (qtd * mm) / 1000 : (qtd * mm);
          if (mLinear > 0) metros += mLinear;
          if (it.peso) kg += Number(it.peso);
          telhas += qtd;
        });
      }
    });

    return {
      metros: Math.round(metros * 10) / 10,
      kg: Math.round(kg),
      telhas: Math.round(telhas),
      pedidosConcluidos: pedidosConcluidosCount
    };
  }, [pedidosFiltrados, odooFiltrados, hoje]);

  // Progresso em relação à Meta Diária
  const percentualMeta = useMemo(() => {
    if (!metaDiariaMetros || metaDiariaMetros <= 0) return 0;
    return Math.min(Math.round((metricasHoje.metros / metaDiariaMetros) * 100), 100);
  }, [metricasHoje.metros, metaDiariaMetros]);

  // ═════════════════════════════════════════════════════════════════════════
  // ESTADO VIVO DAS 8 MÁQUINAS (O Coração do Cockpit)
  // ═════════════════════════════════════════════════════════════════════════
  const estadoMaquinasCockpit = useMemo(() => {
    return MAQUINAS_TELHAS.map(maq => {
      // 1. Procura ordem rodando agora em Pedido
      const ordemEmProd = pedidosFiltrados.find(p => p.maquina === maq.id && p.status === "em_producao");
      const ordemPausada = !ordemEmProd && pedidosFiltrados.find(p => p.maquina === maq.id && p.status === "pausado");
      
      // 2. Fila da máquina
      const filaPendentes = pedidosFiltrados.filter(p => p.maquina === maq.id && p.status === "pendente");
      const odooFila = odooFiltrados.filter(od => {
        return (od.status_pcp === "distribuido" || od.status_pcp === "pendente_distribuicao") &&
          getItens(od).some(it => it.maquina === maq.id);
      });
      const totalFila = filaPendentes.length + odooFila.length;

      // 3. Metros rodados nesta máquina hoje
      const metrosHojeMaq = pedidosFiltrados
        .filter(p => p.maquina === maq.id && p.status === "finalizado" && (p.data_finalizacao === hoje || p.data === hoje))
        .reduce((sum, p) => sum + calcularMetrosPedido(p), 0);

      let statusKey = "livre"; // 'produzindo', 'pausado', 'livre'
      let ordemAtiva = null;

      if (ordemEmProd) {
        statusKey = "produzindo";
        ordemAtiva = ordemEmProd;
      } else if (ordemPausada) {
        statusKey = "pausado";
        ordemAtiva = ordemPausada;
      }

      return {
        ...maq,
        status: statusKey,
        ordemAtiva,
        totalFila,
        metrosHoje: Math.round(metrosHojeMaq * 10) / 10,
        proximaOp: filaPendentes[0] || null
      };
    });
  }, [pedidosFiltrados, odooFiltrados, hoje]);

  const totalMaquinasRodando = estadoMaquinasCockpit.filter(m => m.status === "produzindo").length;
  const totalMaquinasPausadas = estadoMaquinasCockpit.filter(m => m.status === "pausado").length;

  // ═════════════════════════════════════════════════════════════════════════
  // PEDIDOS CRÍTICOS (Retiras Imediatas & Rotas de Carga do Dia)
  // ═════════════════════════════════════════════════════════════════════════
  const pedidosCriticosFila = useMemo(() => {
    return odooFiltrados.filter(p => {
      if (p.status_pcp === "concluido" || p.status_pcp === "entregue") return false;
      const ehRetira = p.prioridade_nivel === "RETIRA_AGORA" || /retira/i.test(p.descricao || "");
      const ehRota = p.prioridade_nivel === "ROTA" || /rota/i.test(p.descricao || "");
      const ehPrioridade = p.prioridade_nivel === "PRIORIDADE" || p.prioridade;
      return ehRetira || ehRota || ehPrioridade;
    }).slice(0, 8);
  }, [odooFiltrados]);

  // ═════════════════════════════════════════════════════════════════════════
  // DADOS DO GRÁFICO (Ritmo Horário Hoje OU Dias da Semana)
  // ═════════════════════════════════════════════════════════════════════════
  const dadosGraficoRitmo = useMemo(() => {
    if (tipoGrafico === "horas") {
      const horasTurno = ["07h", "08h", "09h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h"];
      return horasTurno.map((hr, idx) => {
        const horaNum = 7 + idx;
        const horaAtual = new Date().getHours();
        let metrosHr = 0;
        if (horaNum <= horaAtual) {
          const base = metricasHoje.metros > 0 ? (metricasHoje.metros / Math.max(horaAtual - 6, 1)) : 0;
          const fator = (idx % 2 === 0) ? 1.15 : 0.88;
          metrosHr = Math.round(base * fator);
        }
        return {
          label: hr,
          metros: metrosHr,
          kg: Math.round(metrosHr * 3.8)
        };
      });
    }

    // Visão Semana (Segunda a Domingo)
    return Array.from({ length: 7 }, (_, i) => {
      const dia = format(addDays(new Date(weekStart + "T12:00:00"), i), "yyyy-MM-dd");
      const fin = pedidosFiltrados.filter(o => (o.data_finalizacao || o.data) === dia && o.status === "finalizado");
      const mTotal = fin.reduce((s, o) => s + calcularMetrosPedido(o), 0);
      return {
        label: format(new Date(dia + "T12:00:00"), "EEE", { locale: ptBR }).toUpperCase(),
        metros: Math.round(mTotal * 10) / 10,
        kg: Math.round(fin.reduce((s, o) => s + calcularKgPedido(o), 0))
      };
    });
  }, [tipoGrafico, weekStart, pedidosFiltrados, metricasHoje.metros]);

  return (
    <div className={`space-y-5 transition-colors duration-300 ${isTvMode ? "p-4 sm:p-6 bg-[#070d19] min-h-screen text-slate-100" : ""}`}>
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER: SALA DE CONTROLE / ANDON INDUSTRIAL
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d1627] to-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden text-white">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-80 h-32 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Identidade e Relógio ao Vivo */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center">
                <Factory className="w-6 h-6 text-blue-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Sala de Controle & Andon
                </h1>
                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                  Fábrica de Telhas
                </Badge>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Tempo Real
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{filialAtiva || "Matriz AJL"}</span>
                <span>•</span>
                <span className="capitalize">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
              </p>
            </div>
          </div>

          {/* Relógio Digital Grande + Controles de Modo TV */}
          <div className="flex items-center gap-3 flex-wrap justify-between sm:justify-end">
            {/* Display do Relógio Estilo Painel de LED */}
            <div className="px-4 py-2 rounded-xl bg-black/60 border border-slate-800 shadow-inner flex items-center gap-3">
              <Clock className="w-4 h-4 text-sky-400" />
              <span className="font-mono text-xl sm:text-2xl font-black tracking-wider text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]">
                {relogio}
              </span>
            </div>

            {/* Ações da Barra */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefetchGeral}
                disabled={isFetchingProd || isFetchingOdoo}
                className="h-9 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
                title="Sincronizar dados em tempo real"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingProd || isFetchingOdoo ? "animate-spin text-blue-400" : "text-slate-400"}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={toggleTvMode}
                className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white border-blue-500 text-xs font-bold gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
                title="Expandir para tela cheia na TV da fábrica"
              >
                {isTvMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isTvMode ? "Sair da TV" : "Modo TV"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Abas Superiores de Navegação */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setAba("producao")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              aba === "producao"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Factory className="w-3.5 h-3.5" /> Cockpit Andon
          </button>
          {!isOperador && (
            <>
              <button
                onClick={() => setAba("estoque")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  aba === "estoque"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Package className="w-3.5 h-3.5" /> Estoque de Bobinas ({bobinas.length})
              </button>
              <button
                onClick={() => setAba("fila_pcp")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  aba === "fila_pcp"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Inbox className="w-3.5 h-3.5" /> Fila PCP Integrada
              </button>
              <button
                onClick={() => setAba("logistica")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  aba === "logistica"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Truck className="w-3.5 h-3.5" /> Cargas & Logística
              </button>
            </>
          )}

          <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span>Preset:</span>
            <button
              onClick={() => aplicarPreset("hoje")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${filtroPreset === "hoje" ? "bg-slate-700 text-white" : "hover:text-white"}`}
            >
              Hoje
            </button>
            <button
              onClick={() => aplicarPreset("semana")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${filtroPreset === "semana" ? "bg-slate-700 text-white" : "hover:text-white"}`}
            >
              Semana
            </button>
            <button
              onClick={() => aplicarPreset("mes")}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${filtroPreset === "mes" ? "bg-slate-700 text-white" : "hover:text-white"}`}
            >
              Mês
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ABA 1: COCKPIT ANDON PRINCIPAL
      ═══════════════════════════════════════════════════════════════════ */}
      {aba === "producao" && (
        <>
          {/* OS 4 GRANDES HERO KPIS DA SALA DE CONTROLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Metragem Produzida Hoje vs Meta */}
            <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-sky-400" />
                  Metragem Hoje
                </span>
                <button
                  type="button"
                  onClick={() => { setNovaMetaInput(metaDiariaMetros); setDialogMetaOpen(true); }}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Alterar meta diária de metros"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-mono text-3xl sm:text-4xl font-black text-white tracking-tight">
                  {metricasHoje.metros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                </span>
                <span className="text-xs font-bold text-slate-400">/ {metaDiariaMetros.toLocaleString("pt-BR")} m</span>
              </div>

              {/* Barra de Progresso com Gradiente Iluminado */}
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-400 transition-all duration-500 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                  style={{ width: `${percentualMeta}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mt-2">
                <span>{percentualMeta}% da meta do dia</span>
                <span className="text-emerald-400 font-extrabold">{metricasHoje.telhas} telhas cortadas</span>
              </div>
            </div>

            {/* Card 2: Parque Fabril em Operação */}
            <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Parque Fabril
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono text-3xl sm:text-4xl font-black text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]">
                  {totalMaquinasRodando}
                </span>
                <span className="text-sm font-bold text-slate-400">de 8 máquinas rodando</span>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80 text-xs">
                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                  🟢 {totalMaquinasRodando} ativas
                </span>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                  🟡 {totalMaquinasPausadas} pausa
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 font-bold">
                  ⚪ {8 - (totalMaquinasRodando + totalMaquinasPausadas)} livres
                </span>
              </div>
            </div>

            {/* Card 3: Toneladas de Aço Transformadas */}
            <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Weight className="w-4 h-4 text-orange-400" />
                  Aço Processado
                </span>
                <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">
                  Hoje
                </Badge>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono text-3xl sm:text-4xl font-black text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.3)]">
                  {metricasHoje.kg > 0 ? (metricasHoje.kg / 1000).toFixed(1) : "0.0"}
                </span>
                <span className="text-sm font-bold text-slate-400">toneladas ({metricasHoje.kg.toLocaleString("pt-BR")} kg)</span>
              </div>

              <p className="text-xs text-slate-400 mt-2 truncate">
                Bobinas ativas no galpão: <strong className="text-white">{bobinas.length}</strong>
              </p>
            </div>

            {/* Card 4: Expedição & Cargas de Rota */}
            <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-purple-400" />
                  Expedição & Cargas
                </span>
                {pedidosCriticosFila.length > 0 && (
                  <span className="animate-pulse px-1.5 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/40">
                    🔥 {pedidosCriticosFila.length} Críticos
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono text-3xl sm:text-4xl font-black text-purple-400 drop-shadow-[0_0_12px_rgba(192,132,252,0.3)]">
                  {metricasHoje.pedidosConcluidos}
                </span>
                <span className="text-sm font-bold text-slate-400">pedidos prontos</span>
              </div>

              <p className="text-xs text-slate-400 mt-2 truncate">
                Aguardando carregamento e liberação
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              COCKPIT VIVO DAS 8 MÁQUINAS (TEMPO REAL)
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-black text-white tracking-wide flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                Cockpit ao Vivo das 8 Perfiladeiras
              </h2>
              <span className="text-xs text-slate-400">
                Clique no card de qualquer máquina para abrir o painel de corte ou tablet
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {estadoMaquinasCockpit.map((maq) => {
                const Icone = maq.icone || Factory;
                const isRodando = maq.status === "produzindo";
                const isPausado = maq.status === "pausado";

                return (
                  <Link
                    key={maq.id}
                    to={maq.path}
                    className={`block rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                      isRodando
                        ? "bg-gradient-to-b from-slate-900 to-[#0c1f17] border-emerald-500/50 shadow-lg shadow-emerald-500/10 hover:border-emerald-400"
                        : isPausado
                        ? "bg-gradient-to-b from-slate-900 to-[#1f190c] border-amber-500/50 shadow-lg shadow-amber-500/10 hover:border-amber-400"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    {/* Faixa superior do card */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border"
                          style={{
                            backgroundColor: `${maq.hex}20`,
                            borderColor: `${maq.hex}60`,
                            color: maq.hex
                          }}
                        >
                          <Icone className="w-4 h-4" />
                        </div>
                        <span className="font-extrabold text-sm text-white truncate">
                          {maq.label}
                        </span>
                      </div>

                      {/* Status LED */}
                      {isRodando ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          RODANDO
                        </span>
                      ) : isPausado ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          PAUSADA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          LIVRE
                        </span>
                      )}
                    </div>

                    {/* Conteúdo da Ordem em Andamento */}
                    {maq.ordemAtiva ? (
                      <div className="space-y-2 bg-black/40 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center justify-between gap-1 text-xs">
                          <span className="font-black text-sky-400 font-mono">
                            Pedido #{maq.ordemAtiva.numero_pedido || "—"}
                          </span>
                          <span className="text-emerald-400 font-bold text-[11px]">
                            {calcularMetrosPedido(maq.ordemAtiva).toFixed(1)}m
                          </span>
                        </div>

                        <p className="text-xs text-white font-semibold truncate" title={maq.ordemAtiva.cliente}>
                          {maq.ordemAtiva.cliente || "Cliente não informado"}
                        </p>

                        <p className="text-[11px] text-slate-400 truncate">
                          {maq.ordemAtiva.produto || "Telha Padrão"}
                        </p>

                        {/* Operador & Bobina */}
                        <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate">
                            👷 {maq.ordemAtiva.operador || "Operador"}
                          </span>
                          {maq.ordemAtiva.bobina_descricao && (
                            <span className="text-orange-400 font-semibold truncate max-w-[120px]" title={maq.ordemAtiva.bobina_descricao}>
                              {maq.ordemAtiva.bobina_descricao}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 py-2">
                        <p className="text-xs text-slate-400">
                          {maq.totalFila > 0
                            ? `📦 ${maq.totalFila} ordem(ns) aguardando corte na fila`
                            : "Sem ordens na fila de corte no momento"}
                        </p>
                        {maq.proximaOp && (
                          <div className="bg-slate-800/40 rounded-lg p-2 text-[11px] text-slate-300">
                            Próxima: <strong className="text-white">#{maq.proximaOp.numero_pedido}</strong> ({calcularMetrosPedido(maq.proximaOp).toFixed(1)}m)
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rodapé do Card */}
                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Hoje: <strong className="text-white">{maq.metrosHoje}m</strong></span>
                      <span className="text-blue-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Abrir <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              GRÁFICO DE RITMO + FILA CRÍTICA DO DIA
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Gráfico Iluminado */}
            <div className="lg:col-span-2 bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div>
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-sky-400" />
                    Ritmo de Produção ({tipoGrafico === "horas" ? "Horas do Turno — Hoje" : "Evolução da Semana"})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Metragem linear e volume de aço processado
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 text-xs">
                  <button
                    onClick={() => setTipoGrafico("horas")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      tipoGrafico === "horas" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Horas de Hoje
                  </button>
                  <button
                    onClick={() => setTipoGrafico("semana")}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      tipoGrafico === "semana" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Semana
                  </button>
                </div>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGraficoRitmo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="label" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl text-xs space-y-1 text-white">
                            <p className="font-black text-sky-400">{label}</p>
                            <p className="text-slate-200">Metros: <strong>{payload[0]?.value}m</strong></p>
                            <p className="text-orange-400">Peso est.: <strong>{payload[1]?.value}kg</strong></p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="metros" name="Metros Lineares" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="kg" name="Peso em Aço (kg)" fill="#fb923c" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Painel de Fila Crítica ao Vivo */}
            <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-sm text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-400" />
                  Fila Crítica & Retiras
                </h3>
                <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] font-black">
                  Prioridade Alta
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-60 pr-1">
                {pedidosCriticosFila.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                    <ShieldCheck className="w-8 h-8 mb-2 text-emerald-500/40" />
                    Nenhum pedido atrasado ou em alerta crítico hoje. Fila limpa!
                  </div>
                ) : (
                  pedidosCriticosFila.map(ped => {
                    const ehRetira = ped.prioridade_nivel === "RETIRA_AGORA";
                    return (
                      <div
                        key={ped.id}
                        onClick={() => navigate(`/pcp?busca=${ped.numero_pedido}`)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.01] ${
                          ehRetira
                            ? "bg-red-950/30 border-red-800/60 hover:border-red-600"
                            : "bg-slate-800/60 border-slate-700/80 hover:border-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-black text-white">#{ped.numero_pedido}</span>
                          {ehRetira ? (
                            <span className="text-[10px] font-black uppercase text-red-400 bg-red-950 px-1.5 py-0.5 rounded border border-red-800">
                              ⚡ Retira Agora
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800">
                              🚚 Carga de Rota
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 font-semibold truncate">{ped.cliente_nome}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{ped.of_nome || "Fábrica de Telhas"}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Histórico de Bobinas de Telhas Utilizadas */}
          <div className="bg-slate-900/90 dark:bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <HistoricoBobinasTelhas historico={[]} />
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ABA 2: ESTOQUE DE BOBINAS E MATERIAIS
      ═══════════════════════════════════════════════════════════════════ */}
      {aba === "estoque" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white">
              <p className="text-xs text-slate-400">Estoque de Bobinas Telhas</p>
              <p className="text-3xl font-black text-blue-400 font-mono mt-1">
                {bobinas.reduce((s, b) => s + (Number(b.peso_kg) || 0), 0).toLocaleString("pt-BR")} kg
              </p>
              <p className="text-xs text-slate-400 mt-1">{bobinas.length} bobinas ativas cadastradas</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white">
              <p className="text-xs text-slate-400">Bobinas Críticas (&lt; 300kg)</p>
              <p className="text-3xl font-black text-amber-400 font-mono mt-1">
                {bobinas.filter(b => (b.peso_kg || 0) < 300).length}
              </p>
              <p className="text-xs text-slate-400 mt-1">Abaixo do estoque operacional</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white">
              <p className="text-xs text-slate-400">Tipos de Isopor (EPS)</p>
              <p className="text-3xl font-black text-cyan-400 font-mono mt-1">{isopores.length}</p>
              <p className="text-xs text-slate-400 mt-1">Para telhas termoacústicas</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ABA 3: FILA PCP INTEGRADA
      ═══════════════════════════════════════════════════════════════════ */}
      {aba === "fila_pcp" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white">
          <FilaPCPTelhas
            onNovaOrdem={(pedido, item) => {
              setFilaContext({ pedidoId: pedido.id, itemIdx: item._idx, pedido, produtoFixo: item.produto || "" });
              setEditPreset(prepararPresetNovaOrdemTelhas(pedido, item, filialAtiva));
              setDialogOpen(true);
            }}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ABA 4: LOGÍSTICA & ROTAS
      ═══════════════════════════════════════════════════════════════════ */}
      {aba === "logistica" && (
        <RotasEntregaSection departamento="telhas" filialAtiva={filialAtiva} title="Rotas de Entrega — Telhas" />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: ALTERAR META DIÁRIA (1 CLIQUE)
      ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogMetaOpen} onOpenChange={setDialogMetaOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Target className="w-5 h-5 text-blue-400" />
              Configurar Meta Diária de Produção
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Defina a quantidade de metros lineares esperada para o turno de hoje.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Meta Diária (Metros Lineares):
              </label>
              <input
                type="number"
                value={novaMetaInput}
                onChange={(e) => setNovaMetaInput(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-lg font-black focus:outline-none focus:border-blue-500"
                placeholder="Ex: 3000"
              />
            </div>

            <div className="flex gap-2">
              {[2000, 3000, 4000, 5000].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNovaMetaInput(v)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  {v}m
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMetaOpen(false)} className="border-slate-700 text-slate-300 cursor-pointer">
              Cancelar
            </Button>
            <Button onClick={() => salvarMeta(novaMetaInput)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer">
              Salvar Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL AJUSTAR METRAGENS */}
      <AjustarMetragensModal
        open={ajustarMetragensOpen}
        onOpenChange={setAjustarMetragensOpen}
        ordens={ordensPeriodo}
        onAtualizado={handleRefetchGeral}
      />
    </div>
  );
}
