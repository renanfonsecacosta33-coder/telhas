import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format, subDays, addDays, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, Package, Factory,
  BarChart2, Weight, Zap, Pause, Circle, ArrowRight, ChevronRight,
  Calendar, Target, Activity, Scissors, Layers, Timer, Coffee, Square, RefreshCw, DollarSign, Inbox,
  Snowflake, Ruler, Truck, Disc
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
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { prepararPresetNovaOrdemTelhas, getItens, computePercentual, statusPcpPorPercentual, buildItensJson } from "@/lib/pedidoOdooHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { isTelhaBandeja, montarTriadeTelhaBandeja } from "@/lib/bandejaHelper";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie
} from "recharts";

const MAQUINAS_TELHAS = [
  { id: "TP - 40",      label: "TP-40",        color: "bg-blue-500",   hex: "#3b82f6", path: "/maquina/tp40" },
  { id: "TP - 25",      label: "TP-25",        color: "bg-indigo-500", hex: "#6366f1", path: "/maquina/tp25" },
  { id: "ONDULADA",     label: "Ondulada",     color: "bg-teal-500",   hex: "#14b8a6", path: "/maquina/ondulada" },
  { id: "COLONIAL",     label: "Colonial",     color: "bg-green-500",  hex: "#22c55e", path: "/maquina/colonial" },
  { id: "BANDEJA",      label: "Bandeja",      color: "bg-pink-500",   hex: "#ec4899", path: "/maquina/bandeja" },
  { id: "DESBOBINADOR", label: "Desbobinador", color: "bg-orange-500", hex: "#f97316", path: "/maquina/desbobinador" },
  { id: "CUMEEIRA",     label: "Cumeeira",     color: "bg-yellow-500", hex: "#eab308", path: "/maquina/cumeeira" },
  { id: "COLAGEM",      label: "Colagem",      color: "bg-red-500",    hex: "#ef4444", path: "/maquina/colagem" },
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
  const [filtroPreset, setFiltroPreset] = useState("semana");
  const [filtroInicio, setFiltroInicio] = useState(weekStart);
  const [filtroFim, setFiltroFim] = useState(weekEnd);
  const [kpiDetail, setKpiDetail] = useState(null);

  // Estados legados da Fila PCP integrada
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPreset, setEditPreset] = useState(null);
  const [filaContext, setFilaContext] = useState(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  // Queries
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-dash-telhas", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva }, "-data", 1000),
    refetchInterval: 15000,
  });

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
      if (!filialAtiva || filialAtiva === "todas") return telhas;
      const fn = String(filialAtiva).trim().toLowerCase();
      return telhas.filter(b => {
        const u = String(b.unidade || "Matriz AJL").trim().toLowerCase();
        return u === fn || (fn.includes("matriz") && u.includes("matriz"));
      });
    },
    refetchInterval: 30000,
  });

  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores-dash-novo"],
    queryFn: () => base44.entities.Isopor.list(),
  });

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
    if (preset === "hoje") { setFiltroInicio(hoje); setFiltroFim(hoje); }
    else if (preset === "semana") { setFiltroInicio(weekStart); setFiltroFim(weekEnd); }
    else if (preset === "mes") { setFiltroInicio(mesStart); setFiltroFim(hoje); }
  };

  // Filtragem por máquina (null = Geral)
  const ordensBase = useMemo(() => {
    if (!maquinaSel) return pedidos;
    return pedidos.filter(p => p.maquina === maquinaSel);
  }, [pedidos, maquinaSel]);

  // Ordens no período
  const ordensPeriodo = useMemo(() => ordensBase.filter(o => {
    const ref = (o.status === "finalizado" && o.data_finalizacao) ? o.data_finalizacao : o.data;
    return ref >= filtroInicio && ref <= filtroFim;
  }), [ordensBase, filtroInicio, filtroFim]);

  // KPIs
  const emProducaoAgora = ordensBase.filter(o => o.status === "em_producao").length;
  const pausadosAgora = ordensBase.filter(o => o.status === "pausado").length;
  const aguardandoColagem = ordensBase.filter(o => o.status === "aguardando_colagem").length;
  const finalizadosPeriodo = ordensPeriodo.filter(o => o.status === "finalizado").length;
  
  const metrosPeriodo = ordensPeriodo
    .filter(o => o.status === "finalizado")
    .reduce((s, o) => s + calcularMetrosPedido(o), 0);
  
  const telhasPeriodo = ordensPeriodo
    .filter(o => o.status === "finalizado")
    .reduce((s, o) => s + (o.quantidade || o.quantidade_telhas || 1), 0);

  const kgPeriodo = ordensPeriodo
    .filter(o => o.status === "finalizado")
    .reduce((s, o) => s + (o.kg_total || o.peso_kg || 0), 0);

  const termoacusticasPeriodo = ordensPeriodo
    .filter(o => o.status === "finalizado" && /(eps|manta|sanduiche|isopor|termoacustica)/i.test(o.produto || ""))
    .reduce((s, o) => s + calcularMetrosPedido(o), 0);

  const retrabalhosPeriodo = ordensPeriodo.filter(o => o.is_retrabalho || o.retrabalho);

  const tempoProdTotal = ordensPeriodo.reduce((s, o) => s + (o.tempo_producao_seg || 0), 0);
  const tempoPausaTotal = ordensPeriodo.reduce((s, o) => s + (o.tempo_pausa_seg || 0), 0);
  const tempoSetupTotal = ordensPeriodo.reduce((s, o) => s + (o.tempo_setup_seg || 0), 0);
  const tempoTotal = tempoProdTotal + tempoPausaTotal + tempoSetupTotal;
  const eficiencia = tempoTotal > 0 ? Math.round((tempoProdTotal / tempoTotal) * 100) : 0;

  // Gráfico de Metros Lineares e KG dia a dia
  const chartData = useMemo(() => {
    const numDias = Math.min(Math.ceil((new Date(filtroFim + "T12:00:00") - new Date(filtroInicio + "T12:00:00")) / 86400000) + 1, 31);
    return Array.from({ length: numDias > 0 ? numDias : 0 }, (_, i) => {
      const dia = format(addDays(new Date(filtroInicio + "T12:00:00"), i), "yyyy-MM-dd");
      const fin = ordensPeriodo.filter(o => (o.data_finalizacao || o.data) === dia && o.status === "finalizado");
      return {
        dia: format(new Date(dia + "T12:00:00"), "EEE dd", { locale: ptBR }),
        metros: +fin.reduce((s, o) => s + calcularMetrosPedido(o), 0).toFixed(1),
        kg: +fin.reduce((s, o) => s + (o.kg_total || o.peso_kg || 0), 0).toFixed(0),
      };
    });
  }, [ordensPeriodo, filtroInicio, filtroFim]);

  // Desempenho por Máquina no Período
  const porMaquinaPeriodo = useMemo(() => {
    return MAQUINAS_TELHAS.map(m => {
      const os = ordensPeriodo.filter(o => o.maquina === m.id);
      return {
        ...m,
        total: os.length,
        emProd: os.filter(o => o.status === "em_producao").length,
        pausado: os.filter(o => o.status === "pausado").length,
        finalizado: os.filter(o => o.status === "finalizado").length,
        pendente: os.filter(o => o.status === "pendente").length,
        metros: +os.filter(o => o.status === "finalizado").reduce((s, o) => s + calcularMetrosPedido(o), 0).toFixed(1),
      };
    });
  }, [ordensPeriodo]);

  // Mix de Telhas no Período
  const mixProdutos = useMemo(() => {
    const map = {};
    ordensPeriodo.filter(o => o.status === "finalizado" && o.produto).forEach(o => {
      let nome = o.produto;
      if (/(eps.*manta|manta.*eps)/i.test(nome)) nome = "Telha + EPS + Manta";
      else if (/eps/i.test(nome)) nome = "Telha + EPS (Sanduíche)";
      else if (/tp.*40/i.test(nome)) nome = "TP-40 Trapezoidal";
      else if (/tp.*25/i.test(nome)) nome = "TP-25";
      else if (/ondulada/i.test(nome)) nome = "Ondulada 17";
      else if (/colonial/i.test(nome)) nome = "Colonial";
      else if (/cumeeira/i.test(nome)) nome = "Cumeeira";
      else if (/bandeja/i.test(nome)) nome = "Bandeja";

      map[nome] = (map[nome] || 0) + calcularMetrosPedido(o);
    });
    return Object.entries(map).map(([nome, metros]) => ({ nome, metros: +metros.toFixed(1) }))
      .sort((a, b) => b.metros - a.metros).slice(0, 8);
  }, [ordensPeriodo]);

  // Histórico de Bobinas de Telhas Utilizadas no Período
  const historicoBobinas = useMemo(() => {
    const finOrdens = ordensPeriodo.filter(o => o.status === "finalizado" && (o.bobina_id || o.bobina_descricao));
    const map = {};
    finOrdens.forEach(o => {
      const key = o.bobina_id || o.bobina_descricao;
      if (!map[key]) {
        map[key] = {
          bobina_descricao: o.bobina_descricao || "Bobina Telha",
          kg_total: 0,
          metros_total: 0,
          ordens: []
        };
      }
      map[key].kg_total += (o.kg_total || o.peso_kg || 0);
      map[key].metros_total += calcularMetrosPedido(o);
      map[key].ordens.push({
        maquina: o.maquina,
        produto: o.produto,
        quantidade: o.quantidade || o.quantidade_telhas || 1,
        metros: calcularMetrosPedido(o),
        data: o.data_finalizacao || o.data,
        kg: o.kg_total || o.peso_kg || 0
      });
    });
    return Object.values(map).sort((a, b) => b.kg_total - a.kg_total).slice(0, 8);
  }, [ordensPeriodo]);

  // Custo de Matéria-Prima no Período
  const custoProducao = useMemo(() => {
    const finOrdens = ordensPeriodo.filter(o => o.status === "finalizado" && o.bobina_id);
    const bobinaMap = {};
    bobinas.forEach(b => { bobinaMap[b.id] = b; });
    let total = 0;
    finOrdens.forEach(o => {
      const bob = bobinaMap[o.bobina_id];
      if (bob && bob.custo) {
        total += (o.kg_total || o.peso_kg || 0) * bob.custo;
      }
    });
    return total;
  }, [ordensPeriodo, bobinas]);

  // Bobinas Críticas de Telhas (< 300kg ou estoque mínimo)
  const bobinasCriticas = useMemo(() => {
    return bobinas.filter(b => {
      const peso = b.peso_kg || 0;
      const min = b.estoque_minimo_kg || 300;
      return peso <= min;
    });
  }, [bobinas]);

  // Ordens Ativas Agora
  const ordensAtivas = useMemo(() => {
    return ordensBase.filter(o => o.status === "em_producao" || o.status === "pausado");
  }, [ordensBase]);

  // Analytics de Estoque para Aba Estoque
  const analyticsEstoque = useMemo(() => {
    const qualidadeMap = {};
    const espessuraMap = {};
    const fornecedorMap = {};
    let totalKg = 0;

    bobinas.forEach(b => {
      if (!b) return;
      const peso = parseFloat(b.peso_kg || 0) || 0;
      totalKg += peso;
      const qual = b.qualidade || (b.cor ? "Pré-Pintada" : "Galvalume (GL)");
      const chapa = b.chapa ? `${b.chapa}mm` : (b.espessura_mm ? `${b.espessura_mm}mm` : "0,43mm");
      const forn = b.fornecedor || "Não informado";

      if (!qualidadeMap[qual]) qualidadeMap[qual] = { nome: qual, peso: 0, qtd: 0 };
      qualidadeMap[qual].peso += peso;
      qualidadeMap[qual].qtd += 1;

      if (!espessuraMap[chapa]) espessuraMap[chapa] = { espessura: chapa, peso: 0, qtd: 0 };
      espessuraMap[chapa].peso += peso;
      espessuraMap[chapa].qtd += 1;

      if (!fornecedorMap[forn]) fornecedorMap[forn] = { fornecedor: forn, peso: 0, qtd: 0 };
      fornecedorMap[forn].peso += peso;
      fornecedorMap[forn].qtd += 1;
    });

    const dadosQualidade = Object.values(qualidadeMap).map(q => ({
      ...q,
      fill: q.nome.includes("Pintada") ? "#ec4899" : q.nome.includes("GL") ? "#06b6d4" : "#3b82f6"
    }));

    const dadosEspessura = Object.values(espessuraMap).sort((a, b) => {
      const na = parseFloat(String(a?.espessura || "0").replace("mm", "").replace(",", ".")) || 0;
      const nb = parseFloat(String(b?.espessura || "0").replace("mm", "").replace(",", ".")) || 0;
      return na - nb;
    });

    return { dadosQualidade, dadosEspessura, totalKg };
  }, [bobinas]);

  return (
    <div className="space-y-6">
      {/* ══════════════ HEADER PRINCIPAL ══════════════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" />
            Dashboard — Fábrica de Telhas
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })} · Atualiza a cada 15s
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <button
            onClick={() => setAba("producao")}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              aba === "producao" ? "bg-white shadow text-foreground dark:bg-slate-800" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Factory className="w-3.5 h-3.5 inline mr-1.5 text-blue-600" /> Produção
          </button>
          <button
            onClick={() => setAba("estoque")}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              aba === "estoque" ? "bg-white shadow text-foreground dark:bg-slate-800" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="w-3.5 h-3.5 inline mr-1.5 text-amber-600" /> Estoque
          </button>
          <button
            onClick={() => setAba("fila_pcp")}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              aba === "fila_pcp" ? "bg-white shadow text-blue-600 dark:bg-slate-800" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Inbox className="w-3.5 h-3.5 inline mr-1.5 text-blue-600" /> Fila PCP
          </button>
          <button
            onClick={() => setAba("logistica")}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              aba === "logistica" ? "bg-white shadow text-indigo-600 dark:bg-slate-800" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Truck className="w-3.5 h-3.5 inline mr-1.5 text-indigo-600" /> Logística
          </button>
        </div>
      </div>

      {/* ══════════════ SELETOR DE MÁQUINA DE TELHAS ══════════════ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setMaquinaSel(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border ${
            maquinaSel === null ? "bg-blue-600 text-white border-blue-600 shadow" : "bg-card text-muted-foreground border-border hover:bg-muted"
          }`}
        >
          <Factory className="w-3.5 h-3.5 inline mr-1" /> Geral
        </button>
        {MAQUINAS_TELHAS.map(m => (
          <button
            key={m.id}
            onClick={() => setMaquinaSel(m.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border flex items-center gap-1.5 ${
              maquinaSel === m.id ? "text-white border-transparent shadow" : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
            style={maquinaSel === m.id ? { backgroundColor: m.hex } : {}}
          >
            <span className={`w-2 h-2 rounded-full ${m.color}`} />
            {m.label}
          </button>
        ))}
      </div>

      {/* ══════════════ FILTRO DE PERÍODO ══════════════ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <button onClick={() => aplicarPreset("hoje")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${filtroPreset === "hoje" ? "bg-white shadow text-foreground dark:bg-slate-800" : "text-muted-foreground hover:text-foreground"}`}>Hoje</button>
          <button onClick={() => aplicarPreset("semana")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${filtroPreset === "semana" ? "bg-white shadow text-foreground dark:bg-slate-800" : "text-muted-foreground hover:text-foreground"}`}>Esta Semana</button>
          <button onClick={() => aplicarPreset("mes")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${filtroPreset === "mes" ? "bg-white shadow text-foreground dark:bg-slate-800" : "text-muted-foreground hover:text-foreground"}`}>Este Mês</button>
          <button onClick={() => setFiltroPreset("custom")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${filtroPreset === "custom" ? "bg-white shadow text-foreground dark:bg-slate-800" : "text-muted-foreground hover:text-foreground"}`}>Personalizado</button>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={filtroInicio} onChange={(e) => { setFiltroInicio(e.target.value); setFiltroPreset("custom"); }} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card cursor-pointer" />
          <span className="text-xs text-muted-foreground font-medium">até</span>
          <input type="date" value={filtroFim} onChange={(e) => { setFiltroFim(e.target.value); setFiltroPreset("custom"); }} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card cursor-pointer" />
        </div>
      </div>

      {/* ══════════════ ALERTAS NO TOPO ══════════════ */}
      {(bobinasCriticas.length > 0 || pausadosAgora > 0 || aguardandoColagem > 0 || retrabalhosPeriodo.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {bobinasCriticas.length > 0 && (
            <Link to="/bobinas">
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-100 transition-colors">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700 dark:text-red-300">{bobinasCriticas.length} bobina(s) de telha críticas (&lt;300kg)</span>
                <ChevronRight className="w-3.5 h-3.5 text-red-500" />
              </div>
            </Link>
          )}
          {pausadosAgora > 0 && (
            <button
              onClick={() => setPausedDialogOpen(true)}
              className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-purple-100 transition-all"
            >
              <Pause className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">{pausadosAgora} ordem(ns) pausada(s) nas perfiladeiras</span>
              <ChevronRight className="w-3.5 h-3.5 text-purple-500" />
            </button>
          )}
          {aguardandoColagem > 0 && (
            <Link to="/maquina/colagem">
              <div className="flex items-center gap-2 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-cyan-100 transition-colors">
                <Snowflake className="w-4 h-4 text-cyan-600" />
                <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">{aguardandoColagem} telha(s) aguardando colagem</span>
                <ChevronRight className="w-3.5 h-3.5 text-cyan-500" />
              </div>
            </Link>
          )}
          {retrabalhosPeriodo.length > 0 && (
            <div
              onClick={() => setKpiDetail("retrabalhos")}
              className="flex items-center gap-2 bg-red-100 dark:bg-red-950/60 border border-red-400 dark:border-red-800 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-red-700" />
              <span className="text-sm font-semibold text-red-800 dark:text-red-200">{retrabalhosPeriodo.length} retrabalho(s) no período</span>
              <ChevronRight className="w-3.5 h-3.5 text-red-600" />
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ABA PRODUÇÃO ══════════════ */}
      {aba === "producao" && (
        <>
          {/* Grid de KPIs Principais (Linha 1) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Metros no Período",
                value: metrosPeriodo > 0 ? `${metrosPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m` : "—",
                sub: `${telhasPeriodo} telhas finalizadas`,
                icon: Ruler,
                color: "text-blue-600",
                bg: "bg-blue-50 dark:bg-blue-950/50",
                onClick: () => setKpiDetail("metros")
              },
              {
                label: "Em Produção",
                value: emProducaoAgora > 0 ? emProducaoAgora : "—",
                sub: "ordens ativas agora",
                icon: Zap,
                color: "text-amber-600",
                bg: "bg-amber-50 dark:bg-amber-950/50",
                onClick: () => setActiveSheetOpen(true)
              },
              {
                label: "Finalizados no Período",
                value: finalizadosPeriodo > 0 ? finalizadosPeriodo : "—",
                sub: "pedidos concluídos",
                icon: CheckCircle2,
                color: "text-green-600",
                bg: "bg-green-50 dark:bg-green-950/50",
                onClick: () => setKpiDetail("finalizados")
              },
              {
                label: "Eficiência",
                value: tempoTotal > 0 ? `${eficiencia}%` : "—",
                sub: "tempo produtivo/total",
                icon: Activity,
                color: eficiencia >= 70 ? "text-green-600" : eficiencia >= 50 ? "text-amber-600" : "text-red-600",
                bg: eficiencia >= 70 ? "bg-green-50 dark:bg-green-950/50" : eficiencia >= 50 ? "bg-amber-50 dark:bg-amber-950/50" : "bg-red-50 dark:bg-red-950/50",
                tooltip: `Proporção entre tempo produtivo e tempo total das perfiladeiras. Atual: ${eficiencia}% produzindo.`,
                onClick: () => setKpiDetail("eficiencia")
              },
            ].map(k => (
              <div
                key={k.label}
                onClick={k.onClick}
                title={k.tooltip}
                className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 transition-all duration-200 hover:scale-[1.01] hover:shadow-md cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.bg} shrink-0`}>
                  <k.icon className={`w-5 h-5 ${k.color}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-2xl font-black ${k.color} truncate`}>{k.value}</p>
                  <p className="text-xs text-muted-foreground leading-tight truncate">{k.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 truncate">{k.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Grid de KPIs Secundários (Linha 2) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              {
                label: "KG no Período",
                value: kgPeriodo > 0 ? `${kgPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}kg` : "—",
                icon: Weight,
                color: "text-orange-600",
                onClick: () => setKpiDetail("kg")
              },
              {
                label: "Ordens no Período",
                value: ordensPeriodo.length || "—",
                icon: Layers,
                color: "text-slate-600",
                onClick: () => setKpiDetail("ordens")
              },
              {
                label: "Termoacústicas",
                value: termoacusticasPeriodo > 0 ? `${termoacusticasPeriodo.toFixed(0)}m` : "✓",
                icon: Snowflake,
                color: "text-cyan-600",
                onClick: () => setKpiDetail("sanduiche")
              },
              {
                label: "Pausadas Agora",
                value: pausadosAgora > 0 ? pausadosAgora : "✓",
                icon: Pause,
                color: pausadosAgora > 0 ? "text-purple-600" : "text-green-600",
                onClick: () => setKpiDetail("pausadas")
              },
              {
                label: "Custo Produção",
                value: custoProducao > 0 ? custoProducao.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—",
                icon: DollarSign,
                color: "text-green-600",
                onClick: () => setKpiDetail("custo")
              },
            ].map(k => (
              <div
                key={k.label}
                onClick={k.onClick}
                className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer"
              >
                <k.icon className={`w-4 h-4 ${k.color} shrink-0`} />
                <div className="min-w-0">
                  <p className={`text-lg font-black ${k.color} truncate`}>{k.value}</p>
                  <p className="text-xs text-muted-foreground leading-tight truncate">{k.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status das Máquinas — Período (apenas na visão Geral) */}
          {!maquinaSel && (
            <div>
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Scissors className="w-4 h-4 text-blue-600" /> Status das Perfiladeiras — Período
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {porMaquinaPeriodo.map(m => (
                  <Link key={m.id} to={m.path}>
                    <div className="bg-card border border-border rounded-xl p-3 hover:shadow-md transition-all group cursor-pointer h-full">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${m.emProd > 0 ? m.color + " animate-pulse" : m.total > 0 ? m.color + " opacity-40" : "bg-slate-300"}`} />
                        <span className="text-xs font-bold truncate">{m.label}</span>
                      </div>
                      {m.total > 0 ? (
                        <>
                          <p className="text-lg font-black" style={{ color: m.hex }}>{m.total} ord.</p>
                          <div className="space-y-0.5 mt-1 text-[11px]">
                            {m.emProd > 0 && <div className="text-amber-600 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{m.emProd} prod.</div>}
                            {m.pausado > 0 && <div className="text-purple-600 flex items-center gap-1"><Pause className="w-2.5 h-2.5" />{m.pausado} paus.</div>}
                            {m.finalizado > 0 && <div className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />{m.finalizado} fin.</div>}
                            {m.metros > 0 && <div className="text-blue-600 font-semibold">{m.metros}m ✓</div>}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Sem ordens</p>
                      )}
                      <p className="text-[10px] text-muted-foreground group-hover:text-blue-600 mt-2 font-medium">Ver →</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Gráfico Metros Lineares & KG + Ordens Ativas Agora */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-600" /> Metros Lineares e KG — Período
                </h2>
                <Badge variant="outline" className="text-xs font-normal">
                  {metrosPeriodo.toFixed(0)}m · {kgPeriodo.toFixed(0)}kg
                </Badge>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-popover border border-border rounded-lg p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-bold text-foreground">{label}</p>
                          <p className="text-blue-600 font-medium">Metros: <strong>{payload[0]?.value}m</strong></p>
                          <p className="text-orange-600 font-medium">Peso: <strong>{payload[1]?.value}kg</strong></p>
                        </div>
                      );
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="metros" name="Metros Lineares" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="kg" name="KG de Aço" fill="#ea580c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Card Ativas Agora */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                Ativas Agora ({ordensAtivas.length})
              </h2>
              {ordensAtivas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs">
                  <Circle className="w-8 h-8 mb-2 opacity-30" />
                  Nenhuma perfiladeira rodando agora
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {ordensAtivas.map(o => (
                    <div
                      key={o.id}
                      onClick={() => setQuickActionOrder(o)}
                      className={`rounded-lg px-3 py-2 border text-xs cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${
                        o.status === "pausado" ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200" : "bg-blue-50 dark:bg-blue-950/40 border-blue-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold truncate text-slate-900 dark:text-white">{o.maquina}</span>
                        <Badge className={`text-[10px] ${o.status === "pausado" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {o.status === "pausado" ? "Pausado" : "Produzindo"}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground truncate">{o.produto || "Telha"} · {calcularMetrosPedido(o).toFixed(1)}m</div>
                      {o.tempo_producao_seg > 0 && (
                        <div className="flex items-center gap-1 mt-0.5 text-slate-500 text-[10px]">
                          <Timer className="w-2.5 h-2.5" /> {formatTempo(o.tempo_producao_seg)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tempo + Mix de Produtos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tempoTotal > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Distribuição de Tempo — Período ({formatTempo(tempoTotal)})
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Produção", val: tempoProdTotal, color: "text-green-600", bg: "bg-green-50 border-green-200", bar: "bg-green-500" },
                    { label: "Pausa", val: tempoPausaTotal, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", bar: "bg-amber-500" },
                    { label: "Setup", val: tempoSetupTotal, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", bar: "bg-purple-500" },
                  ].map(t => {
                    const pct = tempoTotal > 0 ? Math.round((t.val / tempoTotal) * 100) : 0;
                    return (
                      <div key={t.label} className={`rounded-xl p-3 border ${t.bg}`}>
                        <p className={`text-xl font-black ${t.color}`}>{formatTempo(t.val)}</p>
                        <p className="text-xs text-muted-foreground">{t.label}</p>
                        <div className="mt-2 bg-white/70 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs font-bold mt-0.5 opacity-60">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" /> Mix de Telhas — Período
              </h2>
              {mixProdutos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sem dados no período</p>
              ) : (
                <div className="space-y-2">
                  {mixProdutos.map((p, idx) => {
                    const max = mixProdutos[0].metros;
                    const pct = max > 0 ? (p.metros / max) * 100 : 0;
                    const cores = ["#2563eb", "#06b6d4", "#10b981", "#6366f1", "#ec4899", "#f59e0b", "#8b5cf6", "#ea580c"];
                    return (
                      <div key={p.nome}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-medium truncate">{p.nome}</span>
                          <span className="font-bold ml-2 shrink-0">{p.metros} m</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cores[idx % cores.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Histórico de Bobinas de Telhas Utilizadas */}
          <HistoricoBobinasTelhas historico={historicoBobinas} />
        </>
      )}

      {/* ══════════════ ABA ESTOQUE ══════════════ */}
      {aba === "estoque" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Estoque de Bobinas Telhas</p>
              <p className="text-2xl font-black text-blue-600">{analyticsEstoque.totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg</p>
              <p className="text-xs text-muted-foreground mt-1">{bobinas.length} bobinas ativas</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Bobinas Críticas (&lt;300kg)</p>
              <p className={`text-2xl font-black ${bobinasCriticas.length > 0 ? "text-red-600" : "text-green-600"}`}>
                {bobinasCriticas.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Abaixo do estoque mínimo</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">Estoque de Isopor (EPS)</p>
              <p className="text-2xl font-black text-cyan-600">{isopores.length} tipos</p>
              <p className="text-xs text-muted-foreground mt-1">Para colagem termoacústica</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bobinas por Qualidade */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm mb-3">Bobinas por Qualidade / Revestimento</h2>
              <div className="space-y-2">
                {analyticsEstoque.dadosQualidade.map(q => (
                  <div key={q.nome} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40">
                    <span className="font-bold">{q.nome}</span>
                    <span className="font-semibold text-blue-600">{q.peso.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg ({q.qtd} bobinas)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bobinas por Espessura */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm mb-3">Bobinas por Espessura (Chapa)</h2>
              <div className="space-y-2">
                {analyticsEstoque.dadosEspessura.map(e => (
                  <div key={e.espessura} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40">
                    <span className="font-bold">{e.espessura}</span>
                    <span className="font-semibold text-orange-600">{e.peso.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg ({e.qtd} bobinas)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ ABA FILA PCP ══════════════ */}
      {aba === "fila_pcp" && (
        <FilaPCPTelhas
          onNovaOrdem={(pedido, item) => {
            setFilaContext({ pedidoId: pedido.id, itemIdx: item._idx, pedido, produtoFixo: item.produto || "" });
            if (item.existingOp) {
              const op = item.existingOp;
              const presets = op._presets || {};
              setEditPreset({
                ...presets,
                ...op,
                produto: op.produto || presets.produto || item.produto || "",
                numero_pedido: op.numero_pedido || presets.numero_pedido || pedido.numero_pedido || "",
                cliente: op.cliente || presets.cliente || pedido.cliente_nome || "",
                vendedor: op.vendedor || presets.vendedor || pedido.vendedor_nome || "",
                unidade: op.unidade || presets.unidade || pedido.unidade || filialAtiva || "Matriz AJL",
                metros: op.metros != null ? op.metros : (presets.metros != null ? presets.metros : item.quantidade),
                metragem_mm: op.metragem_mm != null ? op.metragem_mm : (presets.metragem_mm != null ? presets.metragem_mm : ""),
                quantidade_telhas: op.quantidade_telhas != null ? op.quantidade_telhas : (presets.quantidade_telhas != null ? presets.quantidade_telhas : item.quantidade),
                cor_exigida: op.cor_exigida || presets.cor_exigida || op.rvm_superior || "",
                observacoes_odoo: op.observacoes_odoo || presets.observacoes_odoo || item.descricao || "",
                _presets: undefined,
              });
            } else {
              setEditPreset(prepararPresetNovaOrdemTelhas(pedido, item, filialAtiva));
            }
            setDialogOpen(true);
          }}
        />
      )}

      {/* ══════════════ ABA LOGÍSTICA / ROTAS ══════════════ */}
      {aba === "logistica" && (
        <RotasEntregaSection departamento="telhas" filialAtiva={filialAtiva} title="Rotas de Entrega — Telhas" />
      )}

      {/* ══════════════ DIÁLOGOS E DRAWERS ══════════════ */}
      {/* Drawer de Ordens Ativas Agora */}
      <Sheet open={activeSheetOpen} onOpenChange={setActiveSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-5 overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> Ordens Ativas Agora ({ordensAtivas.length})
            </SheetTitle>
            <SheetDescription>Ordens em andamento e pausadas nas perfiladeiras</SheetDescription>
          </SheetHeader>
          <div className="space-y-2">
            {ordensAtivas.map(o => (
              <div
                key={o.id}
                onClick={() => { setActiveSheetOpen(false); setQuickActionOrder(o); }}
                className="p-3 border rounded-xl hover:shadow-md cursor-pointer transition-all bg-card"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">{o.maquina}</span>
                  <Badge className={o.status === "pausado" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}>
                    {o.status === "pausado" ? "Pausado" : "Produzindo"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{o.produto} · {calcularMetrosPedido(o).toFixed(1)}m</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{o.cliente} · #{o.numero_pedido}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Diálogo de Ordens Pausadas */}
      <Dialog open={pausedDialogOpen} onOpenChange={setPausedDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-purple-600" /> Ordens Pausadas ({pausadosAgora})
            </DialogTitle>
            <DialogDescription>Perfiladeiras com ordens aguardando retomada</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {ordensBase.filter(o => o.status === "pausado").map(o => (
              <div
                key={o.id}
                onClick={() => { setPausedDialogOpen(false); setQuickActionOrder(o); }}
                className="p-3 border border-purple-200 bg-purple-50/40 rounded-xl cursor-pointer hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{o.maquina}</span>
                  <span className="text-[11px] font-bold text-blue-600">{calcularMetrosPedido(o).toFixed(1)}m</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{o.produto}</p>
                {o.observacoes && <p className="text-[11px] text-muted-foreground italic mt-0.5">"{o.observacoes}"</p>}
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
              const { ordemTelha, ordemBandeja, ordemColagem } = montarTriadeTelhaBandeja({ ...data, unidade: filialAtiva });
              try {
                await base44.entities.Pedido.create(ordemBandeja);
                await base44.entities.Pedido.create(ordemColagem);
              } catch (errBandeja) {
                console.error("[DashboardTelhas] Erro ao criar triade:", errBandeja);
              }
              await base44.entities.Pedido.create(ordemTelha);
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
    </div>
  );
}