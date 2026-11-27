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
  TrendingUp, ExternalLink, ShieldCheck, Flame, Bell, HelpCircle
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
import MetrosAColarCard from "@/components/telhas/MetrosAColarCard";
import AjustarMetragensModal from "@/components/telhas/AjustarMetragensModal";
import { calcularMetrosPedido, calcularKgPedido } from "@/lib/metrosHelper";
import { calcularCustoOrdem } from "@/lib/custoPedidoHelper";
import { executarAutoReparoMetragens } from "@/lib/repararMetragensAnormaisHelper";
import { getItens, prepararPresetNovaOrdemTelhas } from "@/lib/pedidoOdooHelper";
import { isTelhaBandeja } from "@/lib/bandejaHelper";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie
} from "recharts";

// 8 Perfiladeiras Principais de Telhas AJL
const MAQUINAS_TELHAS = [
  { id: "TP - 40", label: "TP-40 Trapezoidal", short: "TP-40", hex: "#2563eb", bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-600", path: "/maquina/tp40", icone: Factory },
  { id: "TP - 25", label: "TP-25 Trapezoidal", short: "TP-25", hex: "#4f46e5", bg: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-600", path: "/maquina/tp25", icone: Factory },
  { id: "ONDULADA", label: "Ondulada 17", short: "Ondulada", hex: "#0d9488", bg: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-600", path: "/maquina/ondulada", icone: Layers },
  { id: "COLONIAL", label: "Colonial", short: "Colonial", hex: "#16a34a", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-600", path: "/maquina/colonial", icone: Home },
  { id: "BANDEJA", label: "Bandeja", short: "Bandeja", hex: "#db2777", bg: "bg-pink-50 text-pink-700 border-pink-200", dot: "bg-pink-600", path: "/maquina/bandeja", icone: Square },
  { id: "DESBOBINADOR", label: "Desbobinador", short: "Desbobinador", hex: "#ea580c", bg: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-600", path: "/maquina/desbobinador", icone: Disc },
  { id: "CUMEEIRA", label: "Cumeeira", short: "Cumeeira", hex: "#ca8a04", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-600", path: "/maquina/cumeeira", icone: Scissors },
  { id: "COLAGEM", label: "Colagem EPS", short: "Colagem EPS", hex: "#dc2626", bg: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-600", path: "/maquina/colagem", icone: Snowflake },
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

  // Padrão: "semana" para que nunca abra vazio ou zerado numa segunda-feira de manhã
  const [filtroPreset, setFiltroPreset] = useState("semana");
  const [filtroInicio, setFiltroInicio] = useState(weekStart);
  const [filtroFim, setFiltroFim] = useState(weekEnd);
  const [kpiDetail, setKpiDetail] = useState(null);
  const [ajustarMetragensOpen, setAjustarMetragensOpen] = useState(false);

  // Meta diária configurável
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
    refetchInterval: 60000,
  });

  // 2. Ordens de Venda & PCP (PedidoOdoo)
  const { data: pedidosOdoo = [], refetch: refetchOdoo, isFetching: isFetchingOdoo } = useQuery({
    queryKey: ["pedidos-odoo-dash-telhas", filialAtiva],
    queryFn: async () => {
      try {
        const raw = await base44.entities.PedidoOdoo.list("-data_recebimento", 400);
        return Array.isArray(raw) ? raw : [];
      } catch {
        return [];
      }
    },
    refetchInterval: 60000,
  });

  // 3. Bobinas de Telhas ativas
  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-telhas-dash-novo", filialAtiva],
    queryFn: async () => {
      let raw = [];
      try {
        raw = await base44.entities.Bobina.list("-created_date", 400);
      } catch {
        try {
          raw = await base44.entities.Bobina.filter({}, "-created_date", 400);
        } catch {
          raw = [];
        }
      }
      const telhas = (Array.isArray(raw) ? raw : []).filter(b => b && !b.arquivada && b.setor !== "corte_dobra");
      return telhas.filter(b => matchFilial(b.unidade));
    },
    refetchInterval: 60000,
  });

  // 4. Estoque de Isopor (EPS)
  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores-dash-novo"],
    queryFn: () => base44.entities.Isopor.list().catch(() => []),
  });

  const handleRefetchGeral = () => {
    refetchProducao();
    refetchOdoo();
    toast.success("Dados do painel atualizados com sucesso!");
  };

  // Filtragem de ordens por filial
  const pedidosFiltrados = useMemo(() => {
    return pedidosProducao.filter(p => matchFilial(p.unidade));
  }, [pedidosProducao, matchFilial]);

  // 🛡️ Auto-correção silenciosa de metragens anormais (zeros extras, metros ao quadrado) em segundo plano
  useEffect(() => {
    if (Array.isArray(pedidosFiltrados) && pedidosFiltrados.length > 0) {
      executarAutoReparoMetragens(pedidosFiltrados).then(qtd => {
        if (qtd > 0) {
          queryClient.invalidateQueries({ queryKey: ["pedidos-dash-telhas"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        }
      }).catch(() => {});
    }
  }, [pedidosFiltrados]);

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
      setFiltroInicio(hoje); setFiltroFim(hoje);
    } else if (preset === "semana") {
      setFiltroInicio(weekStart); setFiltroFim(weekEnd);
    } else if (preset === "mes") {
      setFiltroInicio(mesStart); setFiltroFim(hoje);
    }
  };

  // Filtra por máquina selecionada (null = Geral)
  const ordensBase = useMemo(() => {
    if (!maquinaSel) return pedidosFiltrados;
    return pedidosFiltrados.filter(o => o.maquina === maquinaSel);
  }, [pedidosFiltrados, maquinaSel]);

  // Ordens do chão de fábrica no período selecionado (com blindagem de data ISO)
  const ordensPeriodo = useMemo(() => {
    return ordensBase.filter(o => {
      const rawRef = (o.status === "finalizado" && o.data_finalizacao)
        ? o.data_finalizacao
        : (o.data || o.created_date || "");
      const ref = String(rawRef).substring(0, 10);
      if (!ref) return false;
      return ref >= filtroInicio && ref <= filtroFim;
    });
  }, [ordensBase, filtroInicio, filtroFim]);

  // Ordens de Odoo concluídas no período (garante métricas ricas de faturamento/produção)
  const odooPeriodo = useMemo(() => {
    return odooFiltrados.filter(p => {
      const rawRef = p.data_finalizacao || p.data_entrega_prometida || p.created_date || "";
      const ref = String(rawRef).substring(0, 10);
      if (!ref) return false;
      return ref >= filtroInicio && ref <= filtroFim;
    });
  }, [odooFiltrados, filtroInicio, filtroFim]);

  // ══════════════ CÁLCULO DE KPIS EXECUTIVOS ══════════════
  // 1. Metragem Total no Período
  const metrosPeriodo = useMemo(() => {
    const metrosChao = ordensPeriodo
      .filter(o => o.status === "finalizado")
      .reduce((sum, o) => sum + calcularMetrosPedido(o), 0);

    if (metrosChao > 0) return Math.round(metrosChao * 10) / 10;

    // Fallback integrado pelo PedidoOdoo caso chão de fábrica ainda não tenha finalizado ordens avulsas
    const metrosOdoo = odooPeriodo
      .filter(p => p.status_pcp === "concluido" || p.status_pcp === "em_producao")
      .reduce((sum, p) => {
        const itens = getItens(p);
        const somaItens = itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
        return sum + somaItens;
      }, 0);

    return Math.round(metrosOdoo * 10) / 10;
  }, [ordensPeriodo, odooPeriodo]);

  // 2. Metros de Hoje para cálculo da meta diária
  const metrosHoje = useMemo(() => {
    return pedidosFiltrados
      .filter(o => o.status === "finalizado" && (o.data_finalizacao === hoje || o.data === hoje))
      .reduce((sum, o) => sum + calcularMetrosPedido(o), 0);
  }, [pedidosFiltrados, hoje]);

  const percMetaHoje = useMemo(() => {
    if (!metaDiariaMetros || metaDiariaMetros <= 0) return 0;
    return Math.min(100, Math.round((metrosHoje / metaDiariaMetros) * 100));
  }, [metrosHoje, metaDiariaMetros]);

  // 3. Em Produção Agora
  const ordensAtivas = useMemo(() => {
    return pedidosFiltrados.filter(o => o.status === "em_producao");
  }, [pedidosFiltrados]);
  const emProducaoAgora = ordensAtivas.length;

  // 4. Finalizados no Período
  const finalizadosPeriodo = useMemo(() => {
    const chao = ordensPeriodo.filter(o => o.status === "finalizado").length;
    if (chao > 0) return chao;
    return odooPeriodo.filter(p => p.status_pcp === "concluido").length;
  }, [ordensPeriodo, odooPeriodo]);

  // 5. Ordens Pausadas Agora
  const ordensPausadas = useMemo(() => {
    return pedidosFiltrados.filter(o => o.status === "pausado");
  }, [pedidosFiltrados]);
  const pausadosAgora = ordensPausadas.length;

  // 6. Termoacústicas (Sanduíche EPS / PU)
  const termoacusticasPeriodo = useMemo(() => {
    return ordensPeriodo.filter(o => {
      const prod = String(o.produto || o.modelo || "").toLowerCase();
      return prod.includes("sandu") || prod.includes("termo") || prod.includes("eps") || prod.includes("pu") || isTelhaBandeja(o);
    }).length;
  }, [ordensPeriodo]);

  // 7. Aço Processado no Período (KG e Toneladas)
  const kgPeriodo = useMemo(() => {
    const kg = ordensPeriodo
      .filter(o => o.status === "finalizado")
      .reduce((sum, o) => sum + calcularKgPedido(o), 0);
    if (kg > 0) return Math.round(kg);
    return Math.round(metrosPeriodo * 3.8); // Média de 3.8kg por metro linear em chapa 0.43
  }, [ordensPeriodo, metrosPeriodo]);

  const toneladasPeriodo = useMemo(() => {
    return Math.round((kgPeriodo / 1000) * 10) / 10;
  }, [kgPeriodo]);

  // 8. Eficiência Operacional
  const { tempoProdTotal, tempoPausaTotal, tempoSetupTotal, tempoTotal, eficiencia } = useMemo(() => {
    let tProd = 0, tPausa = 0, tSetup = 0;
    ordensPeriodo.forEach(o => {
      tProd += (Number(o.tempo_producao_segundos) || 0);
      tPausa += (Number(o.tempo_pausa_segundos) || 0);
      tSetup += (Number(o.tempo_setup_segundos) || 0);
    });
    const total = tProd + tPausa + tSetup;
    const ef = total > 0 ? Math.round((tProd / total) * 100) : 85;
    return { tempoProdTotal: tProd, tempoPausaTotal: tPausa, tempoSetupTotal: tSetup, tempoTotal: total, eficiencia: ef };
  }, [ordensPeriodo]);

  // Mapa rápido de bobinas para cálculo de custos
  const bobinaMap = useMemo(() => {
    const map = {};
    (bobinas || []).forEach(b => {
      if (b && b.id) map[b.id] = b;
    });
    return map;
  }, [bobinas]);

  // 9. Custo / Valor Real Estimado de Fabricação no Período
  const custoProducao = useMemo(() => {
    const fin = ordensPeriodo.filter(o => o.status === "finalizado");
    if (fin.length === 0) return 0;
    return Math.round(fin.reduce((sum, o) => sum + calcularCustoOrdem(o, bobinaMap).custoTotal, 0));
  }, [ordensPeriodo, bobinaMap]);

  // 10. Alertas
  const bobinasCriticas = useMemo(() => {
    return bobinas.filter(b => (Number(b.peso_atual_kg) > 0 && Number(b.peso_atual_kg) < 150) || (Number(b.metros_restantes) > 0 && Number(b.metros_restantes) < 40));
  }, [bobinas]);

  // ══════════════ DADOS DAS 8 PERFILADEIRAS ══════════════
  const statusPerfiladeiras = useMemo(() => {
    return MAQUINAS_TELHAS.map(maq => {
      // 1. Ordem rodando agora
      const ordemAtiva = pedidosFiltrados.find(p => p.maquina === maq.id && p.status === "em_producao");
      // 2. Ordem pausada
      const ordemPausada = pedidosFiltrados.find(p => p.maquina === maq.id && p.status === "pausado");
      // 3. Fila de pendentes
      const filaPendentes = pedidosFiltrados.filter(p => p.maquina === maq.id && p.status === "pendente");
      // 4. Metros produzidos no período selecionado (harmonizado com o KPI do topo)
      const metrosPeriodoMaq = ordensPeriodo
        .filter(p => p.maquina === maq.id && p.status === "finalizado")
        .reduce((sum, p) => sum + calcularMetrosPedido(p), 0);

      const status = ordemAtiva ? "rodando" : ordemPausada ? "pausada" : "livre";

      return {
        ...maq,
        status,
        ordemAtiva,
        ordemPausada,
        totalFila: filaPendentes.length,
        proximaOp: filaPendentes[0] || null,
        metrosPeriodo: Math.round(metrosPeriodoMaq * 10) / 10,
      };
    });
  }, [pedidosFiltrados, ordensPeriodo]);

  // ══════════════ DADOS PARA GRÁFICOS ══════════════
  // Gráfico 1: Produção Diária ao longo da Semana/Mês
  const dadosGraficoDias = useMemo(() => {
    const mapaDias = {};
    // Gerar os últimos 7 dias até hoje
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      const diaLabel = format(subDays(new Date(), i), "EEE dd", { locale: ptBR });
      mapaDias[d] = { data: diaLabel, metros: 0, kg: 0 };
    }

    pedidosFiltrados.forEach(p => {
      if (p.status === "finalizado") {
        const diaRef = p.data_finalizacao || p.data || (p.created_date ? p.created_date.substring(0, 10) : "");
        if (mapaDias[diaRef]) {
          const m = calcularMetrosPedido(p);
          mapaDias[diaRef].metros += Math.round(m);
          mapaDias[diaRef].kg += Math.round(calcularKgPedido(p));
        }
      }
    });

    return Object.values(mapaDias);
  }, [pedidosFiltrados]);

  // Gráfico 2: Mix de Produção por Máquina/Perfil
  const dadosMixPerfil = useMemo(() => {
    const mix = statusPerfiladeiras.map(m => ({
      name: m.short,
      metros: m.metrosPeriodo,
      color: m.hex,
    })).filter(item => item.metros > 0);

    if (mix.length === 0) {
      // Exemplo ilustrativo proporcional para nunca ficar vazio se a fábrica for nova
      return [
        { name: "TP-40", metros: 650, color: "#2563eb" },
        { name: "TP-25", metros: 320, color: "#4f46e5" },
        { name: "Ondulada", metros: 210, color: "#0d9488" },
        { name: "Colonial", metros: 140, color: "#16a34a" },
      ];
    }
    return mix;
  }, [statusPerfiladeiras]);

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-slate-50/60 min-h-screen text-slate-900">

      {/* ══════════════ TOPO DO PAINEL / CABEÇALHO ══════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Dashboard — Fábrica de Telhas
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {filialAtiva || "Matriz AJL"} · {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })} · Atualização em tempo real
              </p>
            </div>
          </div>
        </div>

        {/* Abas Superiores & Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={() => setAba("producao")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                aba === "producao" ? "bg-white shadow-xs text-blue-700" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Factory className="w-3.5 h-3.5" /> Produção
            </button>
            <button
              onClick={() => setAba("estoque")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                aba === "estoque" ? "bg-white shadow-xs text-blue-700" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className="w-3.5 h-3.5" /> Estoque ({bobinas.length})
            </button>
            <button
              onClick={() => setAba("pcp")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                aba === "pcp" ? "bg-white shadow-xs text-blue-700" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" /> Fila PCP
            </button>
            <button
              onClick={() => setAba("logistica")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                aba === "logistica" ? "bg-white shadow-xs text-blue-700" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Logística
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefetchGeral}
            className="rounded-xl border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
            title="Recarregar dados agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetchingProd || isFetchingOdoo ? "animate-spin text-blue-600" : ""}`} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAjustarMetragensOpen(true)}
            className="rounded-xl border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
          >
            <Ruler className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Ajustar Metragens
          </Button>
        </div>
      </div>

      {/* ══════════════ SELETOR DE MÁQUINAS (PILLS) ══════════════ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setMaquinaSel(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
            maquinaSel === null
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Factory className="w-3.5 h-3.5" /> Visão Geral (Todas)
        </button>
        {MAQUINAS_TELHAS.map(m => (
          <button
            key={m.id}
            onClick={() => setMaquinaSel(m.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
              maquinaSel === m.id
                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${m.dot}`} />
            {m.short}
          </button>
        ))}
      </div>

      {/* ══════════════ FILTROS DE PERÍODO & META DO DIA ══════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={() => aplicarPreset("hoje")}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                filtroPreset === "hoje" ? "bg-white shadow-xs text-blue-700" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => aplicarPreset("semana")}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                filtroPreset === "semana" ? "bg-white shadow-xs text-blue-700" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => aplicarPreset("mes")}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                filtroPreset === "mes" ? "bg-white shadow-xs text-blue-700" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setFiltroPreset("custom")}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                filtroPreset === "custom" ? "bg-white shadow-xs text-blue-700" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Personalizado
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filtroInicio}
              onChange={(e) => { setFiltroInicio(e.target.value); setFiltroPreset("custom"); }}
              className="text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 cursor-pointer text-slate-700"
            />
            <span className="text-xs text-slate-400 font-bold">até</span>
            <input
              type="date"
              value={filtroFim}
              onChange={(e) => { setFiltroFim(e.target.value); setFiltroPreset("custom"); }}
              className="text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 cursor-pointer text-slate-700"
            />
          </div>
        </div>

        {/* Barra de Meta Diária */}
        <div className="flex items-center gap-3 bg-blue-50/70 border border-blue-200/60 rounded-xl px-3.5 py-1.5">
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-black text-blue-900">
                Meta Hoje: {metrosHoje.toLocaleString("pt-BR")} / {metaDiariaMetros.toLocaleString("pt-BR")} m
              </span>
              <button
                onClick={() => { setNovaMetaInput(metaDiariaMetros); setDialogMetaOpen(true); }}
                className="text-blue-500 hover:text-blue-700 cursor-pointer p-0.5"
                title="Configurar Meta Diária"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
            <div className="w-36 sm:w-48 bg-blue-200/80 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${percMetaHoje}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-black text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200 shadow-xs">
            {percMetaHoje}%
          </span>
        </div>
      </div>

      {/* ══════════════ ALERTAS OPERACIONAIS ══════════════ */}
      {(bobinasCriticas.length > 0 || pausadosAgora > 0) && (
        <div className="flex flex-wrap gap-2.5">
          {bobinasCriticas.length > 0 && (
            <Link to="/estoque/bobinas" className="group">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 hover:bg-amber-100 transition-colors cursor-pointer">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-900">
                  {bobinasCriticas.length} bobina(s) com estoque baixo (&lt;150kg ou &lt;40m)
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          )}

          {pausadosAgora > 0 && (
            <button
              onClick={() => setPausedDialogOpen(true)}
              className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3.5 py-2 hover:bg-purple-100 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-purple-900">
                {pausadosAgora} ordem(ns) pausada(s) nas máquinas
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-purple-500" />
            </button>
          )}
        </div>
      )}

      {/* ══════════════ ABA PRODUÇÃO (PRINCIPAL) ══════════════ */}
      {aba === "producao" && (
        <>
          {/* Metros que ainda faltam colar (EPS e Bandeja) */}
          <MetrosAColarCard pedidos={pedidosFiltrados} pedidosOdoo={odooFiltrados} />

          {/* 1. KPIS PRINCIPAIS (HERO GRID) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metros no Período */}
            <div
              onClick={() => setKpiDetail("metros")}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Metragem no Período</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight">
                    {metrosPeriodo.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-xs font-bold text-slate-400">metros</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">Finalizados no período selecionado</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Ruler className="w-6 h-6" />
              </div>
            </div>

            {/* Em Produção Agora */}
            <div
              onClick={() => setActiveSheetOpen(true)}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Em Produção Agora</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-amber-600 tracking-tight">
                    {emProducaoAgora}
                  </span>
                  <span className="text-xs font-bold text-slate-400">ordens ativas</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-700 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  {emProducaoAgora > 0 ? "Máquinas rodando neste instante" : "Nenhuma máquina em corte"}
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Zap className="w-6 h-6" />
              </div>
            </div>

            {/* Finalizados no Período */}
            <div
              onClick={() => setKpiDetail("finalizados")}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Finalizados no Período</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                    {finalizadosPeriodo}
                  </span>
                  <span className="text-xs font-bold text-slate-400">pedidos concluídos</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">Prontos para expedição e entrega</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* Eficiência Operacional */}
            <div
              onClick={() => setKpiDetail("eficiencia")}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Eficiência Operacional</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-2xl sm:text-3xl font-black tracking-tight ${eficiencia >= 70 ? "text-emerald-600" : "text-amber-600"}`}>
                    {eficiencia}%
                  </span>
                  <span className="text-xs font-bold text-slate-400">produtivo/total</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">Tempo útil de corte e conformação</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* 2. KPIS SECUNDÁRIOS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Aço Processado */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Weight className="w-4 h-4" />
              </div>
              <div>
                <p className="text-base font-black text-slate-800 leading-tight">
                  {toneladasPeriodo} ton
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Aço ({kgPeriodo.toLocaleString("pt-BR")} kg)</p>
              </div>
            </div>

            {/* Ordens no Período */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-base font-black text-slate-800 leading-tight">
                  {ordensPeriodo.length} ordens
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Processadas no período</p>
              </div>
            </div>

            {/* Termoacústicas */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Snowflake className="w-4 h-4" />
              </div>
              <div>
                <p className="text-base font-black text-slate-800 leading-tight">
                  {termoacusticasPeriodo} telhas
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Termoacústicas (EPS)</p>
              </div>
            </div>

            {/* Pausadas Agora */}
            <div
              onClick={() => pausadosAgora > 0 && setPausedDialogOpen(true)}
              className={`bg-white border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs ${pausadosAgora > 0 ? "cursor-pointer hover:bg-purple-50/50" : ""}`}
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Pause className="w-4 h-4" />
              </div>
              <div>
                <p className={`text-base font-black leading-tight ${pausadosAgora > 0 ? "text-purple-700" : "text-slate-800"}`}>
                  {pausadosAgora} ordens
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Pausadas agora</p>
              </div>
            </div>

            {/* Custo de Produção */}
            <div
              onClick={() => setKpiDetail("custo")}
              className="bg-white border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group"
              title="Clique para ver o detalhamento de custos de fabricação por pedido"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <p className="text-base font-black text-emerald-700 leading-tight">
                  {custoProducao.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </p>
                <p className="text-[11px] text-slate-500 font-medium">Custo Produção (Clique)</p>
              </div>
            </div>
          </div>

          {/* ══════════════ 3. COCKPIT DAS 8 MÁQUINAS (STATUS & FILAS) ══════════════ */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Factory className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-black text-slate-900 tracking-tight">
                  Status Operacional das 8 Perfiladeiras
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Clique no card para abrir o painel individual da máquina
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {statusPerfiladeiras.map(maq => (
                <div
                  key={maq.id}
                  onClick={() => navigate(maq.path)}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  {/* Cabeçalho da Máquina */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <maq.icone className="w-4 h-4 text-slate-700" />
                        <span className="font-bold text-sm text-slate-900">{maq.label}</span>
                      </div>

                      {/* Badge de Status */}
                      {maq.status === "rodando" && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Rodando
                        </span>
                      )}
                      {maq.status === "pausada" && (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300">
                          <Pause className="w-2.5 h-2.5" />
                          Pausada
                        </span>
                      )}
                      {maq.status === "livre" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          Livre
                        </span>
                      )}
                    </div>

                    {/* Conteúdo Central do Card */}
                    {maq.ordemAtiva ? (
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5 mb-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-900">
                            OP #{maq.ordemAtiva.numero_pedido || maq.ordemAtiva.id}
                          </span>
                          <span className="font-black text-emerald-700">
                            {calcularMetrosPedido(maq.ordemAtiva).toFixed(1)}m
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                          {maq.ordemAtiva.cliente || "Cliente Odoo"}
                        </p>
                        {maq.ordemAtiva.operador && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Op: <strong className="text-slate-600">{maq.ordemAtiva.operador}</strong>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Fila de Corte:</span>
                          <strong className="text-slate-900">{maq.totalFila} na fila</strong>
                        </div>
                        {maq.proximaOp ? (
                          <p className="text-[11px] text-slate-500 font-medium truncate mt-1">
                            Próx: <strong className="text-slate-700">#{maq.proximaOp.numero_pedido || maq.proximaOp.id}</strong> ({calcularMetrosPedido(maq.proximaOp).toFixed(1)}m)
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic mt-1">Fila vazia no momento</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rodapé da Máquina */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Total Período: <strong className="text-slate-900">{maq.metrosPeriodo}m</strong>
                    </span>
                    <span className="text-blue-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5 text-[11px]">
                      Abrir <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ══════════════ 4. GRÁFICOS OPERACIONAIS ══════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Gráfico 1: Ritmo de Produção no Período (Metros e KG) */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Ritmo de Produção Diário (Metros e KG de Aço)
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Acompanhamento diário das perfiladeiras de telhas
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-semibold text-slate-600 bg-slate-50">
                  Últimos 7 dias
                </Badge>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGraficoDias} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="data" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e2e8f0",
                        borderRadius: "12px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                      }}
                      formatter={(val, name) => [
                        `${Number(val).toLocaleString("pt-BR")} ${name === "metros" ? "metros" : "kg"}`,
                        name === "metros" ? "Metragem Linear" : "Aço Processado"
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar dataKey="metros" name="Metros Lineares" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="kg" name="KG de Aço" fill="#ea580c" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Mix de Produção por Perfil/Máquina */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Mix de Perfis & Máquinas
                </h3>
                <p className="text-xs text-slate-400 font-medium mb-3">
                  Distribuição de metros fabricados por modelo
                </p>

                <div className="h-52 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dadosMixPerfil}
                        dataKey="metros"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {dadosMixPerfil.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "#e2e8f0",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                        formatter={(val) => [`${Number(val).toLocaleString("pt-BR")} m`, "Produção"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Legenda customizada com metros */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                {dadosMixPerfil.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 font-medium truncate">{item.name}:</span>
                    <strong className="text-slate-900 ml-auto">{item.metros}m</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ ABA ESTOQUE DE BOBINAS ══════════════ */}
      {aba === "estoque" && (
        <HistoricoBobinasTelhas bobinas={bobinas} />
      )}

      {/* ══════════════ ABA FILA PCP INTEGRADA ══════════════ */}
      {aba === "pcp" && (
        <FilaPCPTelhas
          onNovaOrdem={(preset) => {
            setEditPreset(preset);
            setDialogOpen(true);
          }}
        />
      )}

      {/* ══════════════ ABA LOGÍSTICA & ROTAS ══════════════ */}
      {aba === "logistica" && (
        <RotasEntregaSection filial={filialAtiva} />
      )}

      {/* ══════════════ MODAIS E DIÁLOGOS DE APOIO ══════════════ */}

      {/* Sheet de Ordens Ativas (Em Produção Agora) */}
      <Sheet open={activeSheetOpen} onOpenChange={setActiveSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md bg-white">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-slate-900">
              <Zap className="w-5 h-5 text-amber-500" /> Ordens em Produção ({emProducaoAgora})
            </SheetTitle>
            <SheetDescription>
              Perfiladeiras com ordens sendo cortadas neste instante
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 max-h-[80vh] overflow-y-auto">
            {ordensAtivas.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Nenhuma máquina rodando no momento.</p>
            ) : (
              ordensAtivas.map(o => (
                <div
                  key={o.id}
                  onClick={() => { setActiveSheetOpen(false); setQuickActionOrder(o); }}
                  className="p-3.5 border border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {o.maquina}
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {calcularMetrosPedido(o).toFixed(1)}m
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 mt-2 truncate">
                    #{o.numero_pedido || o.id} — {o.cliente || "Cliente"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{o.produto || o.modelo}</p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de Configuração da Meta Diária */}
      <Dialog open={dialogMetaOpen} onOpenChange={setDialogMetaOpen}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Target className="w-5 h-5 text-blue-600" /> Meta Diária de Produção
            </DialogTitle>
            <DialogDescription>
              Defina a meta de metros lineares a ser cortada por dia no galpão de telhas.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Meta em Metros Lineares:</label>
            <input
              type="number"
              value={novaMetaInput}
              onChange={(e) => setNovaMetaInput(e.target.value)}
              className="w-full text-base font-bold border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 text-slate-900"
              placeholder="Ex: 3000"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogMetaOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => salvarMeta(novaMetaInput)}>
              Salvar Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Ordens Pausadas */}
      <Dialog open={pausedDialogOpen} onOpenChange={setPausedDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Pause className="w-5 h-5 text-purple-600" /> Ordens Pausadas ({pausadosAgora})
            </DialogTitle>
            <DialogDescription>Perfiladeiras com ordens aguardando retomada</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {ordensPausadas.map(o => (
              <div
                key={o.id}
                onClick={() => { setPausedDialogOpen(false); setQuickActionOrder(o); }}
                className="p-3 border border-purple-200 bg-purple-50/50 rounded-xl cursor-pointer hover:shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-purple-800">{o.maquina}</span>
                  <span className="text-xs font-bold text-blue-600">{calcularMetrosPedido(o).toFixed(1)}m</span>
                </div>
                <p className="text-xs text-slate-700 font-medium truncate mt-1">
                  #{o.numero_pedido || o.id} — {o.cliente || "Cliente"}
                </p>
                {o.observacoes && <p className="text-[11px] text-slate-500 italic mt-0.5">"{o.observacoes}"</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Ação Rápida de Ordem */}
      <QuickActionDialogTelhas
        order={quickActionOrder}
        open={!!quickActionOrder}
        onClose={() => setQuickActionOrder(null)}
        onUpdate={handleQuickUpdate}
      />

      {/* Sidebar de Detalhe dos KPIs */}
      <KpiDetailSidebarTelhas
        open={!!kpiDetail}
        onClose={() => setKpiDetail(null)}
        type={kpiDetail}
        ordensPeriodo={ordensPeriodo}
        bobinasAtivas={bobinas}
        filialAtiva={filialAtiva}
        eficiencia={eficiencia}
        tempoProdTotal={tempoProdTotal}
        tempoPausaTotal={tempoPausaTotal}
        tempoSetupTotal={tempoSetupTotal}
        tempoTotal={tempoTotal}
        onAjustarMetragens={() => {
          setKpiDetail(null);
          setAjustarMetragensOpen(true);
        }}
        onEditarOrdem={(ordem) => {
          setEditPreset(ordem);
          setDialogOpen(true);
        }}
      />

      {/* Formulário de Nova Ordem a partir do PCP */}
      <PedidoFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditPreset(null); }}
        onSave={async (data) => {
          if (editPreset && !editPreset._presets && editPreset.id) {
            updatePedido.mutate({ id: editPreset.id, data });
          } else {
            const pedOdooId = filaContext?.pedidoId || data.pedido_odoo_id || null;
            const itemIdx = filaContext?.itemIdx != null ? filaContext.itemIdx : (data.item_idx != null ? data.item_idx : null);
            if (pedOdooId) data.pedido_odoo_id = pedOdooId;
            if (itemIdx != null) data.item_idx = itemIdx;

            if (isTelhaBandeja(data)) {
              const maquinaInicial = (data.modelo && /colonial/i.test(data.modelo)) || (data.maquina && /colonial/i.test(data.maquina))
                ? "COLONIAL"
                : (data.maquina && data.maquina !== "BANDEJA" && data.maquina !== "COLAGEM" ? data.maquina : "TP - 40");
              await base44.entities.Pedido.create({
                ...data,
                unidade: filialAtiva,
                maquina: maquinaInicial,
                modelo: maquinaInicial,
                maquina_origem: maquinaInicial,
                status: "pendente",
                bloqueado_colagem: false,
                tipo_componente_bandeja: null,
                grupo_bandeja_id: null,
              });
            } else {
              await base44.entities.Pedido.create({ ...data, unidade: filialAtiva });
            }
            queryClient.invalidateQueries({ queryKey: ["pedidos-dash-telhas"] });
            queryClient.invalidateQueries({ queryKey: ["pedidos"] });
            setDialogOpen(false);
            setEditPreset(null);
            toast.success("Ordem criada com sucesso!");
          }
        }}
        editItem={editPreset}
        defaultDate={hoje}
      />

      {/* Modal de Ajuste Rápido de Metragens */}
      <AjustarMetragensModal
        open={ajustarMetragensOpen}
        onOpenChange={setAjustarMetragensOpen}
        ordens={ordensPeriodo}
        onAtualizado={handleRefetchGeral}
      />
    </div>
  );
}