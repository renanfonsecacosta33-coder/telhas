import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, Package, Factory,
  BarChart2, Weight, Zap, Pause, Circle, ArrowRight, ChevronRight,
  Calendar, Target, Activity, Scissors, Layers, Timer, Coffee, Square
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
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
  const [aba, setAba] = useState("producao");
  const [maquinaSel, setMaquinaSel] = useState(null); // null = Geral
  const hoje = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const mesStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const { data: ordens = [] } = useQuery({
    queryKey: ["ordens-maquina-cd-dash"],
    queryFn: () => base44.entities.OrdemMaquinaCD.list("-data", 500),
    refetchInterval: 15000,
  });

  const { data: ordensDesb = [] } = useQuery({
    queryKey: ["ordens-desb-dash"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 300),
    refetchInterval: 15000,
  });

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-cd-dash-novo"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false }),
    refetchInterval: 30000,
  });

  const todasOrdens = useMemo(() => [...ordens, ...ordensDesb.map(o => ({ ...o, maquina: "DESBOBINADEIRA", tipo_peca: o.bobina_descricao || "Corte", _desb: true }))], [ordens, ordensDesb]);

  // Filtra por máquina selecionada (null = todas)
  const ordensBase = useMemo(() => maquinaSel ? todasOrdens.filter(o => o.maquina === maquinaSel) : todasOrdens, [todasOrdens, maquinaSel]);

  const ordensHoje = useMemo(() => ordensBase.filter(o => o.data === hoje), [ordensBase, hoje]);
  const ordensSemana = useMemo(() => ordensBase.filter(o => o.data >= weekStart && o.data <= weekEnd), [ordensBase, weekStart, weekEnd]);
  const ordensMes = useMemo(() => ordensBase.filter(o => o.data >= mesStart && o.data <= hoje), [ordensBase, mesStart, hoje]);

  const emProducaoAgora = ordensBase.filter(o => o.status === "em_producao").length;
  const pausadosAgora = ordensBase.filter(o => o.status === "pausado").length;
  const finalizadosHoje = ordensHoje.filter(o => o.status === "finalizado").length;
  const pecasHoje = ordensHoje.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
  const pecasSemana = ordensSemana.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
  const pecasMes = ordensMes.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);

  const tempoProdTotal = ordensHoje.reduce((s, o) => s + (o.tempo_producao_seg || 0), 0);
  const tempoPausaTotal = ordensHoje.reduce((s, o) => s + (o.tempo_pausa_seg || 0), 0);
  const tempoSetupTotal = ordensHoje.reduce((s, o) => s + (o.tempo_setup_seg || 0), 0);
  const tempoTotal = tempoProdTotal + tempoPausaTotal + tempoSetupTotal;
  const eficiencia = tempoTotal > 0 ? Math.round((tempoProdTotal / tempoTotal) * 100) : 0;

  // Gráfico 7 dias
  const ultimos7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dia = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const fin = ordensBase.filter(o => o.data === dia && o.status === "finalizado");
    return {
      dia: format(new Date(dia + "T12:00:00"), "EEE dd", { locale: ptBR }),
      pecas: fin.reduce((s, o) => s + (o.quantidade || 0), 0),
      ordens: ordensBase.filter(o => o.data === dia).length,
    };
  }), [ordensBase]);

  // Por máquina hoje
  const porMaquinaHoje = useMemo(() => {
    const maqList = [...MAQUINAS_CD, { id: "DESBOBINADEIRA", label: "Desbobinadeira", color: "bg-orange-600", hex: "#ea580c", path: "/corte-dobra/producao" }];
    return maqList.map(m => {
      const os = ordensHoje.filter(o => o.maquina === m.id);
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
  }, [ordensHoje]);

  // Mix de peças semana
  const mixPecas = useMemo(() => {
    const map = {};
    ordensSemana.filter(o => o.status === "finalizado" && o.tipo_peca).forEach(o => {
      map[o.tipo_peca] = (map[o.tipo_peca] || 0) + (o.quantidade || 0);
    });
    return Object.entries(map).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 6);
  }, [ordensSemana]);

  // Estoque bobinas
  const totalPeso = bobinas.reduce((s, b) => s + (b.peso_kg || 0), 0);
  const bobinasCriticas = bobinas.filter(b => (b.peso_kg || 0) < 100);
  const bobinasAlerta = bobinas.filter(b => b.estoque_minimo_kg && (b.peso_kg || 0) <= b.estoque_minimo_kg * 1.2 && (b.peso_kg || 0) > (b.peso_kg < 100 ? -1 : b.estoque_minimo_kg));

  const ordensAtivas = useMemo(() => ordensBase.filter(o => o.status === "em_producao" || o.status === "pausado"), [ordensBase]);

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
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${aba === "producao" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Factory className="w-3.5 h-3.5 inline mr-1.5" />Produção
          </button>
          <button onClick={() => setAba("estoque")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${aba === "estoque" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Package className="w-3.5 h-3.5 inline mr-1.5" />Estoque
          </button>
        </div>
      </div>

      {/* Seletor de Máquina */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button onClick={() => setMaquinaSel(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${maquinaSel === null ? "bg-orange-500 text-white border-orange-500 shadow" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}>
          <Factory className="w-3.5 h-3.5 inline mr-1" />Geral
        </button>
        {MAQUINAS_COMPLETO.map(m => (
          <button key={m.id} onClick={() => setMaquinaSel(m.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${maquinaSel === m.id ? "text-white border-transparent shadow" : "bg-card text-muted-foreground border-border hover:bg-muted"}`}
            style={maquinaSel === m.id ? { backgroundColor: m.hex } : {}}>
            <span className={`w-2 h-2 rounded-full ${m.color}`} />
            {m.label}
          </button>
        ))}
      </div>

      {/* Alertas */}
      {(bobinasCriticas.length > 0 || pausadosAgora > 0) && (
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
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-300 rounded-xl px-4 py-2.5">
              <Pause className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">{pausadosAgora} ordem(ns) pausada(s)</span>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ABA PRODUÇÃO ══════════════ */}
      {aba === "producao" && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Peças Hoje", value: pecasHoje > 0 ? pecasHoje : "—", sub: "finalizadas", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
              { label: "Em Produção", value: emProducaoAgora || "—", sub: "ordens ativas", icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Finalizados Hoje", value: finalizadosHoje || "—", sub: "ordens", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Eficiência", value: tempoTotal > 0 ? `${eficiencia}%` : "—", sub: "tempo produtivo/total", icon: Activity, color: eficiencia >= 70 ? "text-green-600" : eficiencia >= 50 ? "text-amber-600" : "text-red-600", bg: eficiencia >= 70 ? "bg-green-50" : eficiencia >= 50 ? "bg-amber-50" : "bg-red-50" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Peças Esta Semana", value: pecasSemana || "—", icon: Calendar, color: "text-indigo-600" },
              { label: "Peças Este Mês", value: pecasMes || "—", icon: Target, color: "text-purple-600" },
              { label: "Ordens Semana", value: ordensSemana.length || "—", icon: Layers, color: "text-slate-600" },
              { label: "Pausadas Agora", value: pausadosAgora || "✓", icon: Pause, color: pausadosAgora > 0 ? "text-purple-600" : "text-green-600" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <k.icon className={`w-4 h-4 ${k.color} flex-shrink-0`} />
                <div>
                  <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status das Máquinas — apenas na visão Geral */}
          {!maquinaSel && (
          <div>
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-orange-500" /> Status das Máquinas — Hoje
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {porMaquinaHoje.map(m => (
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-orange-500" /> Peças Cortadas — Últimos 7 Dias
                </h2>
                <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Semana: {pecasSemana} peças</Badge>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ultimos7} barCategoryGap="30%">
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip formatter={(v) => [`${v}`, "Peças"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="pecas" name="Peças" radius={[6, 6, 0, 0]}>
                    {ultimos7.map((_, i) => <Cell key={i} fill={i === 6 ? "#f97316" : "#fed7aa"} />)}
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
                    <div key={o.id} className={`rounded-lg px-3 py-2 border text-xs ${o.status === "pausado" ? "bg-amber-50 border-amber-200" : "bg-orange-50 border-orange-200"}`}>
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
                  <Clock className="w-4 h-4 text-primary" /> Distribuição de Tempo Hoje ({formatTempo(tempoTotal)})
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
                <Layers className="w-4 h-4 text-purple-500" /> Mix de Peças — Esta Semana
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
        </>
      )}

      {/* ══════════════ ABA ESTOQUE ══════════════ */}
      {aba === "estoque" && (
        <>
          {/* KPIs estoque */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Bobinas Ativas", value: bobinas.length, sub: "CD", icon: Circle, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "Total em KG", value: `${totalPeso.toLocaleString("pt-BR")}kg`, sub: "nas bobinas", icon: Weight, color: "text-slate-700", bg: "bg-slate-100" },
              { label: "Bobinas Críticas", value: bobinasCriticas.length || "✓", sub: bobinasCriticas.length > 0 ? "< 100kg" : "Tudo ok", icon: AlertTriangle, color: bobinasCriticas.length > 0 ? "text-red-600" : "text-green-600", bg: bobinasCriticas.length > 0 ? "bg-red-50" : "bg-green-50" },
              { label: "Reservadas", value: bobinas.filter(b => b.reservada).length || "—", sub: "com reserva ativa", icon: Layers, color: "text-purple-600", bg: "bg-purple-50" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
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

          {/* Bobinas em estoque */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" /> Bobinas Corte e Dobra ({bobinas.length})
              </h2>
              <Link to="/corte-dobra/bobinas"><span className="text-xs text-primary hover:underline cursor-pointer">Ver todas →</span></Link>
            </div>
            {bobinas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma bobina no estoque CD</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {[...bobinas].sort((a, b) => (a.peso_kg || 0) - (b.peso_kg || 0)).map(b => {
                  const pct = b.peso_inicial > 0 ? Math.round((b.peso_kg / b.peso_inicial) * 100) : null;
                  const critica = (b.peso_kg || 0) < 100;
                  return (
                    <div key={b.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border text-xs ${critica ? "bg-red-50 border-red-200" : "bg-muted/30 border-border"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-orange-600">{b.codigo || "—"}</span>
                          <span className="text-slate-600">{b.chapa}</span>
                          {b.cor && <span className="text-blue-600">{b.cor}</span>}
                          {b.qualidade && <span className="text-muted-foreground">({b.qualidade})</span>}
                          {critica && <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">⚠ Crítico</Badge>}
                          {b.reservada && <Badge className="bg-purple-100 text-purple-700 border-purple-300 text-xs">Reservada</Badge>}
                        </div>
                        {pct !== null && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${pct > 40 ? "bg-green-500" : pct > 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold ${critica ? "text-red-600" : "text-slate-700"}`}>{b.peso_kg || 0}kg</p>
                        {b.fornecedor && <p className="text-muted-foreground">{b.fornecedor}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-xl font-black text-orange-600">{bobinas.length}</p>
                <p className="text-xs text-muted-foreground">Bobinas ativas</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-green-600">{totalPeso.toFixed(0)}kg</p>
                <p className="text-xs text-muted-foreground">Total estoque</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-black ${bobinasCriticas.length > 0 ? "text-red-600" : "text-green-600"}`}>{bobinasCriticas.length}</p>
                <p className="text-xs text-muted-foreground">⚠ Críticas</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}