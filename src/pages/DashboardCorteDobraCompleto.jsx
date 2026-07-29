import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip as UITooltip, TooltipTrigger as UITooltipTrigger, TooltipContent as UITooltipContent, TooltipProvider as UITooltipProvider } from "@/components/ui/tooltip";
import QuickActionDialog from "@/components/corte-dobra/QuickActionDialog";
import HistoricoBobinas from "@/components/corte-dobra/HistoricoBobinas";
import KpiDetailSidebar from "@/components/corte-dobra/KpiDetailSidebar";
import { format, subDays, addDays, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, Package, Factory,
  BarChart2, Weight, Zap, Pause, Circle, ArrowRight, ChevronRight,
  Calendar, Target, Activity, Scissors, Layers, Timer, Coffee, Square, RefreshCw, DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFilial } from "@/contexts/FilialContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie
} from "recharts";

const MAQUINAS_CD = [
  { id: "CORTE 3M",       label: "Corte 3m",       color: "bg-blue-500",   hex: "#3b82f6", path: "/corte-dobra/maquina/corte-3m" },
  { id: "DOBRA 3M",       label: "Dobra 3m",       color: "bg-indigo-500", hex: "#6366f1", path: "/corte-dobra/maquina/dobra-3m" },
  { id: "CORTE 6M",       label: "Corte 6m",       color: "bg-teal-500",   hex: "#14b8a6", path: "/corte-dobra/maquina/corte-6m" },
  { id: "DOBRA FUNDO 6M", label: "Dobra Fundo 6m", color: "bg-green-500",  hex: "#22c55e", path: "/corte-dobra/maquina/dobra-fundo-6m" },
  { id: "DOBRA INICIO 6M",label: "Dobra Início 6m",color: "bg-emerald-500",hex: "#10b981", path: "/corte-dobra/maquina/dobra-inicio-6m" },
  { id: "PERFILADEIRA",   label: "Perfiladeira",   color: "bg-orange-500", hex: "#f97316", path: "/corte-dobra/maquina/perfiladeira" },
];

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const MAQUINAS_COMPLETO = [
  ...MAQUINAS_CD,
  { id: "DESBOBINADEIRA", label: "Desbobinadeira", color: "bg-orange-600", hex: "#ea580c", path: "/corte-dobra/producao" },
];

export default function DashboardCorteDobraCompleto() {
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens-maquina-cd-dash", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 15000,
  });

  const { data: ordensDesb = [] } = useQuery({
    queryKey: ["ordens-desb-dash", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva }, "-data", 300),
    refetchInterval: 15000,
  });

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-cd-dash-novo", filialAtiva],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false, unidade: filialAtiva }),
    refetchInterval: 30000,
  });

  const updateMaq = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemMaquinaCD.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd-dash"] }); queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] }); },
  });
  const updateDesb = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemDesbobinadeira.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-desb-dash"] }); queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }); },
  });

  const handleQuickUpdate = (order, data) => {
    if (order._desb) updateDesb.mutate({ id: order.id, data });
    else updateMaq.mutate({ id: order.id, data });
  };

  const aplicarPreset = (preset) => {
    setFiltroPreset(preset);
    if (preset === "hoje") { setFiltroInicio(hoje); setFiltroFim(hoje); }
    else if (preset === "semana") { setFiltroInicio(weekStart); setFiltroFim(weekEnd); }
    else if (preset === "mes") { setFiltroInicio(mesStart); setFiltroFim(hoje); }
  };

  const todasOrdens = useMemo(() => [...ordens, ...ordensDesb.map(o => ({ ...o, maquina: "DESBOBINADEIRA", tipo_peca: o.bobina_descricao || "Corte", _desb: true }))], [ordens, ordensDesb]);

  // Filtra por máquina selecionada (null = todas)
  const ordensBase = useMemo(() => maquinaSel ? todasOrdens.filter(o => o.maquina === maquinaSel) : todasOrdens, [todasOrdens, maquinaSel]);

  // Ordens no período: finalizadas usam data_finalizacao, demais usam data planejada
  const ordensPeriodo = useMemo(() => ordensBase.filter(o => {
    const ref = (o.status === "finalizado" && o.data_finalizacao) ? o.data_finalizacao : o.data;
    return ref >= filtroInicio && ref <= filtroFim;
  }), [ordensBase, filtroInicio, filtroFim]);

  const emProducaoAgora = ordensPeriodo.filter(o => o.status === "em_producao").length;
  const pausadosAgora = ordensPeriodo.filter(o => o.status === "pausado").length;
  const finalizadosPeriodo = ordensPeriodo.filter(o => o.status === "finalizado").length;
  const pecasPeriodo = ordensPeriodo.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
  const kgPeriodo = ordensPeriodo.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.peso_kg || o.kg_estimado || 0), 0);

  const tempoProdTotal = ordensPeriodo.reduce((s, o) => s + (o.tempo_producao_seg || 0), 0);
  const tempoPausaTotal = ordensPeriodo.reduce((s, o) => s + (o.tempo_pausa_seg || 0), 0);
  const tempoSetupTotal = ordensPeriodo.reduce((s, o) => s + (o.tempo_setup_seg || 0), 0);
  const tempoTotal = tempoProdTotal + tempoPausaTotal + tempoSetupTotal;
  const eficiencia = tempoTotal > 0 ? Math.round((tempoProdTotal / tempoTotal) * 100) : 0;

  // Gráfico 7 dias
  const chartData = useMemo(() => {
    const numDias = Math.min(Math.ceil((new Date(filtroFim + "T12:00:00") - new Date(filtroInicio + "T12:00:00")) / 86400000) + 1, 31);
    return Array.from({ length: numDias > 0 ? numDias : 0 }, (_, i) => {
      const dia = format(addDays(new Date(filtroInicio + "T12:00:00"), i), "yyyy-MM-dd");
      const fin = ordensPeriodo.filter(o => (o.data_finalizacao || o.data) === dia && o.status === "finalizado");
      return {
        dia: format(new Date(dia + "T12:00:00"), "EEE dd", { locale: ptBR }),
        pecas: fin.reduce((s, o) => s + (o.quantidade || 0), 0),
        kg: fin.reduce((s, o) => s + (o.peso_kg || o.kg_estimado || 0), 0),
      };
    });
  }, [ordensPeriodo, filtroInicio, filtroFim]);

  // Por máquina hoje
  const porMaquinaPeriodo = useMemo(() => {
    const maqList = [...MAQUINAS_CD, { id: "DESBOBINADEIRA", label: "Desbobinadeira", color: "bg-orange-600", hex: "#ea580c", path: "/corte-dobra/producao" }];
    return maqList.map(m => {
      const os = ordensPeriodo.filter(o => o.maquina === m.id);
      return {
        ...m,
        total: os.length,
        emProd: os.filter(o => o.status === "em_producao").length,
        pausado: os.filter(o => o.status === "pausado").length,
        finalizado: os.filter(o => o.status === "finalizado").length,
        pendente: os.filter(o => o.status === "pendente").length,
        pecas: os.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0),
      };
    });
  }, [ordensPeriodo]);

  // Mix de peças semana
  const mixPecas = useMemo(() => {
    const map = {};
    ordensPeriodo.filter(o => o.status === "finalizado" && o.tipo_peca).forEach(o => {
      map[o.tipo_peca] = (map[o.tipo_peca] || 0) + (o.quantidade || 0);
    });
    return Object.entries(map).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 6);
  }, [ordensPeriodo]);

  // Histórico de bobinas utilizadas (semana)
  const historicoBobinas = useMemo(() => {
    const finOrdens = ordensPeriodo.filter(o => o.status === "finalizado" && (o.bobina_id || o.bobina_descricao));
    const map = {};
    finOrdens.forEach(o => {
      const key = o.bobina_id || o.bobina_descricao;
      if (!map[key]) {
        map[key] = { bobina_descricao: o.bobina_descricao || "—", kg_total: 0, pecas_total: 0, ordens: [] };
      }
      map[key].kg_total += (o.peso_kg || o.kg_estimado || 0);
      map[key].pecas_total += (o.quantidade || 0);
      map[key].ordens.push({ maquina: o.maquina, tipo_peca: o.tipo_peca || o.bobina_descricao, quantidade: o.quantidade, data: o.data, kg: o.peso_kg || o.kg_estimado || 0 });
    });
    return Object.values(map).sort((a, b) => b.kg_total - a.kg_total).slice(0, 8);
  }, [ordensPeriodo]);

  // Custo de produção (material) — baseado no custo/kg da bobina
  const custoProducao = useMemo(() => {
    const finOrdens = ordensPeriodo.filter(o => o.status === "finalizado" && o.bobina_id);
    const bobinaMap = {};
    bobinas.forEach(b => { bobinaMap[b.id] = b; });
    let total = 0;
    finOrdens.forEach(o => {
      const bob = bobinaMap[o.bobina_id];
      if (bob && bob.custo) {
        total += (o.peso_kg || o.kg_estimado || 0) * bob.custo;
      }
    });
    return total;
  }, [ordensPeriodo, bobinas]);

  // Estoque bobinas
  const bobinasCriticas = bobinas.filter(b => (b.peso_kg || 0) < 100);
  const totalEstoqueKg = bobinas.reduce((s, b) => s + (b.peso_kg || 0), 0);

  // 📊 Analytics de Estoque para a aba "estoque"
  const analyticsEstoque = useMemo(() => {
    const qualidadeMap = {};
    const espessuraMap = {};
    const fornecedorMap = {};

    let reservadoKg = 0;
    let reservadasCount = 0;
    let criticasCount = 0;

    bobinas.forEach(b => {
      const peso = parseFloat(b.peso_kg || 0);
      const qual = b.qualidade || "Outros";
      const chapa = b.chapa ? `${b.chapa}mm` : "Outras";
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

      if (b.reservada) {
        reservadoKg += b.reserva_kg || peso;
        reservadasCount += 1;
      }
      if (peso < 100) {
        criticasCount += 1;
      }
    });

    const CORES_QUALIDADE = {
      "GV": "#06b6d4",
      "PP": "#ec4899",
      "FF": "#64748b",
      "FQ": "#10b981",
      "GL (IMP)": "#f59e0b",
      "Outros": "#8b5cf6"
    };

    const dadosQualidade = Object.values(qualidadeMap).map(q => ({
      ...q,
      fill: CORES_QUALIDADE[q.nome] || "#a855f7"
    }));

    const dadosEspessura = Object.values(espessuraMap).sort((a, b) => {
      const na = parseFloat(a.espessura.replace(",", "."));
      const nb = parseFloat(b.espessura.replace(",", "."));
      return na - nb;
    });

    const dadosFornecedor = Object.values(fornecedorMap).sort((a, b) => b.peso - a.peso).slice(0, 6);

    return {
      dadosQualidade,
      dadosEspessura,
      dadosFornecedor,
      reservadoKg,
      reservadasCount,
      criticasCount
    };
  }, [bobinas]);

  const ordensAtivas = useMemo(() => ordensPeriodo.filter(o => o.status === "em_producao" || o.status === "pausado"), [ordensPeriodo]);
  const ordensPausadas = useMemo(() => ordensPeriodo.filter(o => o.status === "pausado"), [ordensPeriodo]);
  const retrabalhosPeriodo = useMemo(() => ordensPeriodo.filter(o => o.is_retrabalho), [ordensPeriodo]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scissors className="w-6 h-6 text-orange-500" />
            Dashboard — Corte e Dobra
            {maquinaSel && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-sm">
                {MAQUINAS_COMPLETO.find(m => m.id === maquinaSel)?.label || maquinaSel}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })} · Atualiza a cada 15s
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <button onClick={() => setAba("producao")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${aba === "producao" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Factory className="w-3.5 h-3.5 inline mr-1.5" />Produção
          </button>
          <button onClick={() => setAba("estoque")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${aba === "estoque" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Package className="w-3.5 h-3.5 inline mr-1.5" />Estoque
          </button>
        </div>
      </div>

      {/* Seletor de Máquina */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button onClick={() => setMaquinaSel(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border ${maquinaSel === null ? "bg-orange-500 text-white border-orange-500 shadow" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}>
          <Factory className="w-3.5 h-3.5 inline mr-1" />Geral
        </button>
        {MAQUINAS_COMPLETO.map(m => (
          <button key={m.id} onClick={() => setMaquinaSel(m.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer border flex items-center gap-1.5 ${maquinaSel === m.id ? "text-white border-transparent shadow" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}
            style={maquinaSel === m.id ? { backgroundColor: m.hex } : {}}>
            <span className={`w-2 h-2 rounded-full ${m.color}`} />
            {m.label}
          </button>
        ))}
      </div>

      {/* Filtro de Período */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
          <button onClick={() => aplicarPreset("hoje")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 ${filtroPreset === "hoje" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Hoje</button>
          <button onClick={() => aplicarPreset("semana")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 ${filtroPreset === "semana" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Esta Semana</button>
          <button onClick={() => aplicarPreset("mes")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 ${filtroPreset === "mes" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Este Mês</button>
          <button onClick={() => setFiltroPreset("custom")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 ${filtroPreset === "custom" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Personalizado</button>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={filtroInicio} onChange={(e) => { setFiltroInicio(e.target.value); setFiltroPreset("custom"); }} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card cursor-pointer" />
          <span className="text-xs text-muted-foreground font-medium">até</span>
          <input type="date" value={filtroFim} onChange={(e) => { setFiltroFim(e.target.value); setFiltroPreset("custom"); }} className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card cursor-pointer" />
        </div>
      </div>

      {/* Alertas */}
      {(bobinasCriticas.length > 0 || pausadosAgora > 0 || retrabalhosPeriodo.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {bobinasCriticas.length > 0 && (
            <Link to="/corte-dobra/bobinas">
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-100 transition-colors">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">{bobinasCriticas.length} bobina(s) &lt;100kg</span>
                <ChevronRight className="w-3.5 h-3.5 text-red-500" />
              </div>
            </Link>
          )}
          {pausadosAgora > 0 && (
            <button onClick={() => setPausedDialogOpen(true)}
              className="flex items-center gap-2 bg-purple-50 border border-purple-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-purple-100 hover:shadow-md transition-all duration-200">
              <Pause className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">{pausadosAgora} ordem(ns) pausada(s)</span>
              <ChevronRight className="w-3.5 h-3.5 text-purple-500" />
            </button>
          )}
          {retrabalhosPeriodo.length > 0 && (
            <Link to="/corte-dobra/producao">
              <div className="flex items-center gap-2 bg-red-100 border border-red-400 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-200 transition-colors">
                <RefreshCw className="w-4 h-4 text-red-700" />
                <span className="text-sm font-semibold text-red-800">{retrabalhosPeriodo.length} retrabalho(s) no período</span>
                <ChevronRight className="w-3.5 h-3.5 text-red-600" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ══════════════ ABA PRODUÇÃO ══════════════ */}
      {aba === "producao" && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Peças no Período", value: pecasPeriodo > 0 ? pecasPeriodo : "—", sub: "finalizadas", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", onClick: () => setKpiDetail("pecas") },
              { label: "Em Produção", value: emProducaoAgora || "—", sub: "ordens ativas", icon: Zap, color: "text-amber-600", bg: "bg-amber-50", onClick: () => setActiveSheetOpen(true) },
              { label: "Finalizados no Período", value: finalizadosPeriodo || "—", sub: "ordens", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", onClick: () => setKpiDetail("finalizados") },
              { label: "Eficiência", value: tempoTotal > 0 ? `${eficiencia}%` : "—", sub: "tempo produtivo/total", icon: Activity, color: eficiencia >= 70 ? "text-green-600" : eficiencia >= 50 ? "text-amber-600" : "text-red-600", bg: eficiencia >= 70 ? "bg-green-50" : eficiencia >= 50 ? "bg-amber-50" : "bg-red-50", tooltip: `Proporção entre tempo produtivo e tempo total (incluindo pausas e setup). Atual: ${eficiencia}% do tempo foi gasto produzindo.`, onClick: () => setKpiDetail("eficiencia") },
              ].map(k => (
              <div key={k.label} onClick={k.onClick} title={k.tooltip}
                className={`bg-card border border-border rounded-xl p-4 flex items-center gap-3 transition-all duration-200 ${k.onClick ? "hover:scale-[1.01] hover:shadow-md cursor-pointer" : ""}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.bg}`}>
                  <k.icon className={`w-5 h-5 ${k.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                  <p className="text-xs text-muted-foreground/60">{k.sub}</p>
                </div>
              </div>
              ))}
          </div>

          {/* KPIs secundários */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
               { label: "KG no Período", value: kgPeriodo > 0 ? `${kgPeriodo.toFixed(0)}kg` : "—", icon: Weight, color: "text-orange-600", onClick: () => setKpiDetail("kg") },
               { label: "Ordens no Período", value: ordensPeriodo.length || "—", icon: Layers, color: "text-slate-600", onClick: () => setKpiDetail("ordens") },
               { label: "Retrabalhos", value: retrabalhosPeriodo.length || "✓", icon: RefreshCw, color: retrabalhosPeriodo.length > 0 ? "text-red-600" : "text-green-600", onClick: () => setKpiDetail("retrabalhos") },
               { label: "Pausadas Agora", value: pausadosAgora || "✓", icon: Pause, color: pausadosAgora > 0 ? "text-purple-600" : "text-green-600", onClick: () => setKpiDetail("pausadas") },
               { label: "Custo Produção", value: custoProducao > 0 ? custoProducao.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—", icon: DollarSign, color: "text-green-600", onClick: () => setKpiDetail("custo") },
             ].map(k => (
               <div key={k.label} onClick={k.onClick}
                 className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-md cursor-pointer">
                 <k.icon className={`w-4 h-4 ${k.color} flex-shrink-0`} />
                 <div className="min-w-0">
                   <p className={`text-lg font-black ${k.color} truncate`}>{k.value}</p>
                   <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                 </div>
               </div>
             ))}
          </div>

          {/* Status das Máquinas — apenas na visão Geral */}
          {!maquinaSel && (
          <div>
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-orange-500" /> Status das Máquinas — Período
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {porMaquinaPeriodo.map(m => (
                <Link key={m.id} to={m.path}>
                  <div className="bg-card border border-border rounded-xl p-3 hover:shadow-md transition-all group cursor-pointer h-full">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${m.emProd > 0 ? m.color + " animate-pulse" : m.total > 0 ? m.color + " opacity-40" : "bg-slate-200"}`} />
                      <span className="text-xs font-bold truncate">{m.label}</span>
                    </div>
                    {m.total > 0 ? (
                      <>
                        <p className="text-lg font-black" style={{ color: m.hex }}>{m.total} ord.</p>
                        <div className="space-y-0.5 mt-1">
                          {m.emProd > 0 && <div className="text-xs text-amber-600 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{m.emProd} prod.</div>}
                          {m.pausado > 0 && <div className="text-xs text-purple-600 flex items-center gap-1"><Pause className="w-2.5 h-2.5" />{m.pausado} paus.</div>}
                          {m.finalizado > 0 && <div className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" />{m.finalizado} fin.</div>}
                          {m.pecas > 0 && <div className="text-xs text-blue-600">{m.pecas} pç ✓</div>}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 italic mt-2">Sem ordens</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">Ver →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          )}

          {/* Grid: Gráfico 7 dias + Ordens ativas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
              <UITooltipProvider>
              <div className="flex items-center justify-between mb-4">
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <h2 className="font-bold text-sm flex items-center gap-2 cursor-help">
                      <BarChart2 className="w-4 h-4 text-orange-500" /> Peças e KG — Período
                    </h2>
                  </UITooltipTrigger>
                  <UITooltipContent>Mostra a quantidade de peças finalizadas por dia nos últimos 7 dias. A barra laranja destaca o dia de hoje.</UITooltipContent>
                </UITooltip>
                <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">{pecasPeriodo} pç · {kgPeriodo.toFixed(0)}kg</Badge>
              </div>
              </UITooltipProvider>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip formatter={(v, name) => [name === "KG" ? `${v}kg` : `${v} pç`, name === "KG" ? "KG Produzidos" : "Peças"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="pecas" name="Peças" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? "#f97316" : "#fed7aa"} />)}
                  </Bar>
                  <Bar dataKey="kg" name="KG" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === chartData.length - 1 ? "#f59e0b" : "#fde68a"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                Ativas Agora ({ordensAtivas.length})
              </h2>
              {ordensAtivas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs">
                  <Circle className="w-8 h-8 mb-2 opacity-30" />
                  Nenhuma ordem ativa
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {ordensAtivas.map(o => (
                    <div key={o.id} onClick={() => setQuickActionOrder(o)}
                      className={`rounded-lg px-3 py-2 border text-xs cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${o.status === "pausado" ? "bg-amber-50 border-amber-200" : "bg-orange-50 border-orange-200"}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold truncate">{o.maquina}</span>
                        <Badge className={`text-xs ${o.status === "pausado" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-orange-100 text-orange-700 border-orange-300"}`}>
                          {o.status === "pausado" ? "Pausado" : "Produzindo"}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">{o.tipo_peca || o.bobina_descricao || "—"} · {o.quantidade} pç</div>
                      {(o.tempo_producao_seg > 0) && (
                        <div className="flex items-center gap-1 mt-0.5 text-slate-500">
                          <Timer className="w-2.5 h-2.5" />{formatTempo(o.tempo_producao_seg)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tempo + Mix de peças */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tempoTotal > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Distribuição de Tempo — Período ({formatTempo(tempoTotal)})
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
                        <div className="mt-2 bg-white/70 rounded-full h-1.5 overflow-hidden">
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
                <Layers className="w-4 h-4 text-purple-500" /> Mix de Peças — Período
              </h2>
              {mixPecas.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sem dados esta semana</p>
              ) : (
                <div className="space-y-2">
                  {mixPecas.map((p, idx) => {
                    const max = mixPecas[0].qtd;
                    const pct = max > 0 ? (p.qtd / max) * 100 : 0;
                    const cores = ["#f97316", "#3b82f6", "#10b981", "#6366f1", "#ec4899", "#f59e0b"];
                    return (
                      <div key={p.nome}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-medium truncate">{p.nome}</span>
                          <span className="font-bold ml-2 flex-shrink-0">{p.qtd} pç</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cores[idx] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Histórico de Retrabalhos */}
          {retrabalhosPeriodo.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-red-500" /> Histórico de Retrabalhos — Período
                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">{retrabalhosPeriodo.length} retrabalho(s)</Badge>
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {retrabalhosPeriodo.map(rt => {
                  const etapaCor = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-pink-500"][Math.min((rt.retrabalho_etapa || 1) - 1, 4)];
                  const kg = rt.peso_kg || rt.kg_estimado || 0;
                  return (
                    <div key={rt.id} className="flex items-center gap-3 rounded-lg px-3 py-2 border border-red-200 bg-red-50/30 text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${etapaCor} flex-shrink-0`}>
                        E{rt.retrabalho_etapa || 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {rt.numero_pedido && (
                            <span className="font-bold text-blue-700 font-mono">#{rt.numero_pedido}</span>
                          )}
                          <span className="font-semibold text-foreground truncate">{rt.tipo_peca || rt.bobina_descricao || "—"}</span>
                          {rt.maquina && (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{rt.maquina}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                          {rt.cliente && <span>{rt.cliente}</span>}
                          {rt.retrabalho_bobina_sub_descricao && (
                            <span className="text-amber-600 font-medium">🔄 Bobina subs: {rt.retrabalho_bobina_sub_descricao}</span>
                          )}
                          {rt.retrabalho_motivo && (
                            <span className="truncate text-red-600/70">— {rt.retrabalho_motivo}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-foreground">{rt.retrabalho_quantidade || rt.quantidade || 0} pç</p>
                        {kg > 0 && <p className="text-emerald-600 font-semibold">{kg.toFixed(1)}kg</p>}
                        <p className="text-muted-foreground text-[10px]">{format(new Date(rt.data + "T12:00:00"), "dd/MM")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                <div className="text-center">
                  <p className="text-xl font-black text-red-600">{retrabalhosPeriodo.length}</p>
                  <p className="text-xs text-muted-foreground">Total retrabalhos</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-red-600">{retrabalhosPeriodo.reduce((s, r) => s + (r.retrabalho_quantidade || r.quantidade || 0), 0)}</p>
                  <p className="text-xs text-muted-foreground">Peças reproduzidas</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-black text-emerald-600">{retrabalhosPeriodo.reduce((s, r) => s + (r.peso_kg || r.kg_estimado || 0), 0).toFixed(1)}kg</p>
                  <p className="text-xs text-muted-foreground">KG em retrabalho</p>
                </div>
              </div>
            </div>
          )}

          {/* Histórico de Bobinas Utilizadas */}
          <HistoricoBobinas historico={historicoBobinas} />
        </>
      )}

      {/* ══════════════ ABA ESTOQUE ══════════════ */}
      {aba === "estoque" && (
        <div className="space-y-5">
          {/* KPIs Estoque Executivos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Bobinas no Estoque", value: bobinas.length, sub: "Bobinas ativas CD", icon: Package, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
              { label: "Peso Físico Total", value: `${totalEstoqueKg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`, sub: `~${(totalEstoqueKg / 1000).toFixed(1)} toneladas`, icon: Weight, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
              { label: "Reservado p/ Vendas", value: `${analyticsEstoque.reservadoKg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`, sub: `${analyticsEstoque.reservadasCount} bobinas reservadas`, icon: Layers, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
              { label: "Bobinas Críticas", value: analyticsEstoque.criticasCount || "✓", sub: analyticsEstoque.criticasCount > 0 ? "< 100 kg restantes" : "Estoque saudável", icon: AlertTriangle, color: analyticsEstoque.criticasCount > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400", bg: analyticsEstoque.criticasCount > 0 ? "bg-red-500/10 border-red-500/30" : "bg-emerald-500/10 border-emerald-500/30" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${k.bg}`}>
                  <k.icon className={`w-5 h-5 ${k.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
                  <p className="text-xs font-bold text-foreground leading-tight">{k.label}</p>
                  <p className="text-xs text-muted-foreground">{k.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* PAINEL DE GRÁFICOS RECHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gráfico 1: Distribuição por Qualidade do Aço (Donut PieChart) */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-teal-500" />
                  Distribuição por Qualidade de Aço
                </h3>
                <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-600 border-teal-500/30 font-bold">
                  Volume em Kg
                </Badge>
              </div>

              {analyticsEstoque.dadosQualidade.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Sem dados de estoque</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 py-2">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analyticsEstoque.dadosQualidade}
                          dataKey="peso"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={4}
                        >
                          {analyticsEstoque.dadosQualidade.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`${Number(value).toLocaleString("pt-BR")} kg`, "Peso Total"]}
                          contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legenda Lateral */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {analyticsEstoque.dadosQualidade.map(q => (
                      <div key={q.nome} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-muted/40 border border-border">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: q.fill }} />
                          <span className="font-bold text-foreground">{q.nome}</span>
                          <span className="text-[10px] text-muted-foreground">({q.qtd} bobinas)</span>
                        </div>
                        <span className="font-black text-foreground">{q.peso.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Gráfico 2: Peso por Espessura de Chapa (BarChart) */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-orange-500" />
                  Estoque por Espessura da Chapa (mm)
                </h3>
                <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30 font-bold">
                  Kg por Bitola
                </Badge>
              </div>

              {analyticsEstoque.dadosEspessura.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Sem dados de espessura</div>
              ) : (
                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsEstoque.dadosEspessura} barCategoryGap="25%">
                      <XAxis dataKey="espessura" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={45} formatter={(v) => `${(v/1000).toFixed(0)}t`} />
                      <Tooltip
                        formatter={(value) => [`${Number(value).toLocaleString("pt-BR")} kg`, "Peso em Estoque"]}
                        contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                      />
                      <Bar dataKey="peso" name="Peso (kg)" radius={[8, 8, 0, 0]}>
                        {analyticsEstoque.dadosEspessura.map((_, i) => (
                          <Cell key={i} fill={i % 2 === 0 ? "#f97316" : "#3b82f6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* LINHA 2: Top Fornecedores e Trava de Dispoibilidde */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Fornecedores */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <Factory className="w-4 h-4 text-purple-500" />
                  Participação por Fornecedor (Siderúrgicas)
                </h3>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsEstoque.dadosFornecedor} layout="vertical" barCategoryGap="20%">
                    <XAxis type="number" hide />
                    <YAxis dataKey="fornecedor" type="category" tick={{ fontSize: 11 }} width={110} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => [`${Number(value).toLocaleString("pt-BR")} kg`, "Estoque Total"]}
                      contentStyle={{ borderRadius: "12px", fontSize: "12px" }}
                    />
                    <Bar dataKey="peso" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Painel de Reserva x Livre */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Disponibilidade de Venda Real
                </h3>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-muted-foreground">Material Livre p/ Venda:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {Math.max(0, totalEstoqueKg - analyticsEstoque.reservadoKg).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${totalEstoqueKg > 0 ? Math.min(100, Math.max(0, ((totalEstoqueKg - analyticsEstoque.reservadoKg) / totalEstoqueKg) * 100)) : 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-muted-foreground">Material Compromissado (Reservas):</span>
                      <span className="text-purple-600 dark:text-purple-400">
                        {analyticsEstoque.reservadoKg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full transition-all"
                        style={{ width: `${totalEstoqueKg > 0 ? Math.min(100, (analyticsEstoque.reservadoKg / totalEstoqueKg) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Gerenciar no Módulo:</span>
                <Link to="/corte-dobra/bobinas">
                  <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-xl gap-1">
                    Ver Bobinas →
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Tabela de Bobinas no Estoque */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
                Catálogo de Bobinas em Estoque ({bobinas.length})
              </h3>
              <Link to="/corte-dobra/bobinas">
                <span className="text-xs text-primary hover:underline font-bold">Ver todas no Módulo de Bobinas →</span>
              </Link>
            </div>

            {bobinas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma bobina cadastrada no estoque Corte e Dobra</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {[...bobinas].sort((a, b) => (a.peso_kg || 0) - (b.peso_kg || 0)).map(b => {
                  const pct = b.peso_inicial > 0 ? Math.round((b.peso_kg / b.peso_inicial) * 100) : null;
                  const critica = (b.peso_kg || 0) < 100;

                  return (
                    <div key={b.id} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 border text-xs transition-all ${critica ? "bg-red-500/10 border-red-500/30" : "bg-muted/40 border-border hover:bg-muted/70"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-sm">{b.codigo || "—"}</span>
                          <Badge variant="outline" className="font-bold text-[10px] bg-background">{b.chapa}mm</Badge>
                          {b.cor && <span className="text-blue-600 dark:text-blue-400 font-bold">{b.cor}</span>}
                          {b.qualidade && <span className="text-muted-foreground">({b.qualidade})</span>}
                          {critica && <Badge className="bg-red-500 text-white text-[10px]">⚠ Est. Crítico</Badge>}
                          {b.reservada && <Badge className="bg-purple-600 text-white text-[10px]">🔒 Reservada</Badge>}
                        </div>

                        {pct !== null && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct > 40 ? "bg-emerald-500" : pct > 20 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground w-9 text-right font-mono text-[11px]">{pct}%</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className={`font-black text-sm ${critica ? "text-red-500" : "text-foreground"}`}>
                          {(b.peso_kg || 0).toLocaleString("pt-BR")} kg
                        </p>
                        {b.fornecedor && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{b.fornecedor}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sheet - Ordens Ativas */}
      <Sheet open={activeSheetOpen} onOpenChange={setActiveSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Ordens Ativas ({ordensAtivas.length})
            </SheetTitle>
            <SheetDescription>Ordens em produção ou pausadas no momento. Clique para gerenciar.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {ordensAtivas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ordem ativa</p>
            ) : (
              ordensAtivas.map(o => (
                <div key={o.id} onClick={() => { setActiveSheetOpen(false); setQuickActionOrder(o); }}
                  className={`rounded-lg px-3 py-2.5 border text-sm cursor-pointer hover:shadow-md transition-all duration-200 ${o.status === "pausado" ? "bg-amber-50 border-amber-200" : "bg-orange-50 border-orange-200"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">{o.maquina}</span>
                    <Badge className={`text-xs ${o.status === "pausado" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-orange-100 text-orange-700 border-orange-300"}`}>
                      {o.status === "pausado" ? "Pausado" : "Produzindo"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{o.tipo_peca || o.bobina_descricao || "—"} · {o.quantidade} pç</p>
                  {o.cliente && <p className="text-muted-foreground text-xs">Cliente: {o.cliente}</p>}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog - Ordens Pausadas */}
      <Dialog open={pausedDialogOpen} onOpenChange={setPausedDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pause className="w-5 h-5 text-purple-600" />
              Ordens Pausadas ({ordensPausadas.length})
            </DialogTitle>
            <DialogDescription>Ordens pausadas no momento. Clique para gerenciar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {ordensPausadas.map(o => {
              const maqInfo = MAQUINAS_COMPLETO.find(m => m.id === o.maquina);
              return (
                <div key={o.id} className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{o.maquina}</p>
                    <p className="text-xs text-muted-foreground truncate">{o.tipo_peca || o.bobina_descricao || "—"} · {o.quantidade} pç</p>
                    {o.motivo_pausa && <p className="text-xs text-purple-600 mt-0.5">⏸ {o.motivo_pausa === "setup" ? "Setup" : o.motivo_pausa}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => { setPausedDialogOpen(false); setQuickActionOrder(o); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 cursor-pointer transition-all duration-200">
                      Gerenciar
                    </button>
                    {maqInfo && (
                      <button onClick={() => navigate(maqInfo.path)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted cursor-pointer transition-all duration-200">
                        Ir →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Action Dialog */}
      <QuickActionDialog
        order={quickActionOrder}
        open={!!quickActionOrder}
        onClose={() => setQuickActionOrder(null)}
        onUpdate={handleQuickUpdate}
      />

      {/* KPI Detail Sidebar */}
      <KpiDetailSidebar
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
    </div>
  );
}