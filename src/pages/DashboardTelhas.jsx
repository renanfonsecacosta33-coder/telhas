import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, Package, Snowflake,
  Factory, BarChart2, Layers, Weight, Zap, Pause, Circle, ArrowRight,
  ChevronRight, Calendar, Target, Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
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

const PRODUTO_CORES = {
  "TELHA": "#3b82f6",
  "TELHA + EPS": "#10b981",
  "TELHA + EPS + MANTA": "#14b8a6",
  "TELHA + EPS + TELHA": "#6366f1",
  "TELHA BANDEJA": "#ec4899",
  "BOBININHA": "#f59e0b",
  "CUMEEIRA": "#f97316",
  "PAINEL": "#a855f7",
};

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardTelhas() {
  const [aba, setAba] = useState("producao");
  const hoje = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const mesStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-dash-telhas"],
    queryFn: () => base44.entities.Pedido.list("-data", 500),
    refetchInterval: 15000,
  });

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-telhas-dash"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "telhas", arquivada: false }),
    refetchInterval: 30000,
  });

  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores-dash"],
    queryFn: () => base44.entities.Isopor.list(),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-dash"],
    queryFn: () => base44.entities.Produto.list(),
  });

  const pedidosHoje = useMemo(() => pedidos.filter(p => p.data === hoje), [pedidos, hoje]);
  const pedidosSemana = useMemo(() => pedidos.filter(p => p.data >= weekStart && p.data <= weekEnd), [pedidos, weekStart, weekEnd]);
  const pedidosMes = useMemo(() => pedidos.filter(p => p.data >= mesStart && p.data <= hoje), [pedidos, mesStart, hoje]);

  const emProducaoAgora = pedidos.filter(p => p.status === "em_producao" || p.status === "pausado").length;
  const aguardandoColagem = pedidos.filter(p => p.status === "aguardando_colagem").length;
  const finalizadosHoje = pedidosHoje.filter(p => p.status === "finalizado").length;
  const metrosHoje = pedidosHoje.filter(p => p.status === "finalizado").reduce((s, p) => s + (p.metros || 0), 0);
  const metrosSemana = pedidosSemana.filter(p => p.status === "finalizado").reduce((s, p) => s + (p.metros || 0), 0);
  const metrosMes = pedidosMes.filter(p => p.status === "finalizado").reduce((s, p) => s + (p.metros || 0), 0);
  const kgHoje = pedidosHoje.filter(p => p.status === "finalizado").reduce((s, p) => s + (p.kg_total || 0), 0);

  const tempoProdTotal = pedidosHoje.reduce((s, p) => s + (p.tempo_producao_seg || 0), 0);
  const tempoPausaTotal = pedidosHoje.reduce((s, p) => s + (p.tempo_pausa_seg || 0), 0);
  const tempoSetupTotal = pedidosHoje.reduce((s, p) => s + (p.tempo_setup_seg || 0), 0);
  const tempoTotal = tempoProdTotal + tempoPausaTotal + tempoSetupTotal;
  const eficiencia = tempoTotal > 0 ? Math.round((tempoProdTotal / tempoTotal) * 100) : 0;

  const ultimos7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dia = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const fin = pedidos.filter(p => p.data === dia && p.status === "finalizado");
    return {
      dia: format(new Date(dia + "T12:00:00"), "EEE dd", { locale: ptBR }),
      metros: +fin.reduce((s, p) => s + (p.metros || 0), 0).toFixed(1),
    };
  }), [pedidos]);

  const mixProdutos = useMemo(() => {
    const map = {};
    pedidosSemana.filter(p => p.status === "finalizado").forEach(p => {
      map[p.produto] = (map[p.produto] || 0) + (p.metros || 0);
    });
    return Object.entries(map).map(([nome, metros]) => ({ nome, metros: +metros.toFixed(1) }))
      .sort((a, b) => b.metros - a.metros);
  }, [pedidosSemana]);

  const porMaquinaHoje = useMemo(() =>
    MAQUINAS_TELHAS.map(m => {
      const os = pedidosHoje.filter(p => p.maquina === m.id);
      return {
        ...m,
        total: os.length,
        emProd: os.filter(p => p.status === "em_producao").length,
        pausado: os.filter(p => p.status === "pausado").length,
        finalizado: os.filter(p => p.status === "finalizado").length,
        metros: os.filter(p => p.status === "finalizado").reduce((s, p) => s + (p.metros || 0), 0),
      };
    }), [pedidosHoje]);

  const totalPeso = bobinas.reduce((s, b) => s + (b.peso_kg || 0), 0);
  const bobinasCriticas = bobinas.filter(b => b.estoque_minimo_kg && (b.peso_kg || 0) <= b.estoque_minimo_kg);
  const bobinasAtencao = bobinas.filter(b => b.estoque_minimo_kg && (b.peso_kg || 0) <= b.estoque_minimo_kg * 1.3 && (b.peso_kg || 0) > b.estoque_minimo_kg);
  const totalMetragemIsopor = isopores.reduce((s, i) => s + (i.metragem_total || 0), 0);

  const pedidosAtivos = pedidos.filter(p => p.status === "em_producao" || p.status === "pausado");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" />
            Dashboard — Telhas
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

      {/* Alertas */}
      {(bobinasCriticas.length > 0 || aguardandoColagem > 0) && (
        <div className="flex flex-wrap gap-2">
          {bobinasCriticas.length > 0 && (
            <Link to="/bobinas">
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-100 transition-colors">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">{bobinasCriticas.length} bobina(s) abaixo do mínimo</span>
                <ChevronRight className="w-3.5 h-3.5 text-red-500" />
              </div>
            </Link>
          )}
          {aguardandoColagem > 0 && (
            <Link to="/maquina/colagem">
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-orange-100 transition-colors">
                <Layers className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-700">{aguardandoColagem} aguardando colagem</span>
                <ChevronRight className="w-3.5 h-3.5 text-orange-500" />
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
              { label: "Telhas Hoje", value: metrosHoje > 0 ? String(metrosHoje.toLocaleString("pt-BR")) : "—", sub: "finalizadas", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Em Produção", value: emProducaoAgora > 0 ? emProducaoAgora : "—", sub: "ordens ativas agora", icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Finalizados Hoje", value: finalizadosHoje > 0 ? finalizadosHoje : "—", sub: "pedidos prontos", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
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
              { label: "Metros Esta Semana", value: `${metrosSemana.toLocaleString("pt-BR")}m`, icon: Calendar, color: "text-indigo-600" },
              { label: "Metros Este Mês", value: `${metrosMes.toLocaleString("pt-BR")}m`, icon: Target, color: "text-purple-600" },
              { label: "KG Produzido Hoje", value: kgHoje > 0 ? `${kgHoje.toLocaleString("pt-BR")}kg` : "—", icon: Weight, color: "text-slate-600" },
              { label: "Aguard. Colagem", value: aguardandoColagem > 0 ? aguardandoColagem : "✓", icon: Layers, color: aguardandoColagem > 0 ? "text-orange-600" : "text-green-600" },
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

          {/* Status das Máquinas */}
          <div>
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Factory className="w-4 h-4 text-blue-500" /> Status das Máquinas — Hoje
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
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
                          {m.metros > 0 && <div className="text-xs text-blue-600">{m.metros.toFixed(0)}m ✓</div>}
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

          {/* Grid: Gráfico + Ordens ativas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-500" /> Metros Produzidos — Últimos 7 Dias
                </h2>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Semana: {metrosSemana}m</Badge>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ultimos7} barCategoryGap="30%">
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip formatter={(v) => [`${v}m`, "Metros"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="metros" name="Metros" radius={[6, 6, 0, 0]}>
                    {ultimos7.map((_, i) => <Cell key={i} fill={i === 6 ? "#3b82f6" : "#bfdbfe"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Ordens Ativas ({pedidosAtivos.length})
              </h2>
              {pedidosAtivos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs">
                  <Circle className="w-8 h-8 mb-2 opacity-30" />
                  Nenhuma ordem ativa
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {pedidosAtivos.map(p => (
                    <div key={p.id} className={`rounded-lg px-3 py-2 border text-xs ${p.status === "pausado" ? "bg-purple-50 border-purple-200" : "bg-blue-50 border-blue-200"}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold truncate">{p.produto}</span>
                        <Badge className={`text-xs ${p.status === "pausado" ? "bg-purple-100 text-purple-700 border-purple-300" : "bg-amber-100 text-amber-700 border-amber-300"}`}>
                          {p.status === "pausado" ? "Pausado" : "Produzindo"}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">{p.maquina} · {p.metros || 0}m · {p.cliente || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Distribuição de tempo + Mix de produtos */}
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
                <Layers className="w-4 h-4 text-purple-500" /> Mix de Produtos — Esta Semana
              </h2>
              {mixProdutos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sem dados esta semana</p>
              ) : (
                <div className="space-y-2">
                  {mixProdutos.slice(0, 6).map(p => {
                    const max = mixProdutos[0].metros;
                    const pct = max > 0 ? (p.metros / max) * 100 : 0;
                    return (
                      <div key={p.nome}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-medium truncate">{p.nome}</span>
                          <span className="font-bold ml-2 flex-shrink-0">{p.metros}m</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PRODUTO_CORES[p.nome] || "#6b7280" }} />
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
              { label: "Bobinas Ativas", value: bobinas.length, sub: "em estoque", icon: Circle, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Total em KG", value: `${totalPeso.toLocaleString("pt-BR")}kg`, sub: "nas bobinas", icon: Weight, color: "text-slate-700", bg: "bg-slate-100" },
              { label: "Estoque Crítico", value: bobinasCriticas.length > 0 ? bobinasCriticas.length : "✓", sub: bobinasCriticas.length > 0 ? "abaixo do mínimo" : "Tudo ok", icon: AlertTriangle, color: bobinasCriticas.length > 0 ? "text-red-600" : "text-green-600", bg: bobinasCriticas.length > 0 ? "bg-red-50" : "bg-green-50" },
              { label: "Isopor (m linear)", value: `${totalMetragemIsopor}m`, sub: `${isopores.length} tipos`, icon: Snowflake, color: "text-cyan-600", bg: "bg-cyan-50" },
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

          {/* Bobinas críticas */}
          {(bobinasCriticas.length > 0 || bobinasAtencao.length > 0) && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Bobinas que Precisam de Atenção
              </h2>
              <div className="space-y-2">
                {[...bobinasCriticas.map(b => ({ ...b, nivel: "critico" })), ...bobinasAtencao.map(b => ({ ...b, nivel: "atencao" }))].map(b => {
                  const pct = b.peso_inicial > 0 ? Math.round((b.peso_kg / b.peso_inicial) * 100) : null;
                  return (
                    <div key={b.id} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border text-xs ${b.nivel === "critico" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${b.nivel === "critico" ? "bg-red-500" : "bg-amber-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{b.codigo || "—"}</span>
                          <span className="text-slate-600">{b.cor}</span>
                          <span className="text-muted-foreground">Chapa: {b.chapa}</span>
                        </div>
                        {pct !== null && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-white rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full rounded-full ${pct > 30 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-black text-sm ${b.nivel === "critico" ? "text-red-600" : "text-amber-700"}`}>{b.peso_kg || 0}kg</p>
                        <p className="text-muted-foreground">mín: {b.estoque_minimo_kg}kg</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <Link to="/bobinas">
                  <Button variant="outline" size="sm" className="w-full gap-2">Ver todas as bobinas <ArrowRight className="w-3.5 h-3.5" /></Button>
                </Link>
              </div>
            </div>
          )}

          {/* Todas as bobinas */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" /> Bobinas em Estoque ({bobinas.length})
              </h2>
              <Link to="/bobinas"><span className="text-xs text-primary hover:underline cursor-pointer">Ver todas →</span></Link>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {[...bobinas].sort((a, b) => (a.peso_kg || 0) - (b.peso_kg || 0)).map(b => {
                const pct = b.peso_inicial > 0 ? Math.round((b.peso_kg / b.peso_inicial) * 100) : null;
                const critica = b.estoque_minimo_kg && (b.peso_kg || 0) <= b.estoque_minimo_kg;
                return (
                  <div key={b.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 border text-xs ${critica ? "bg-red-50 border-red-200" : "bg-muted/30 border-border"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-blue-600">{b.codigo || "—"}</span>
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
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-xl font-black text-blue-600">{bobinas.length}</p>
                <p className="text-xs text-muted-foreground">Bobinas ativas</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-green-600">{totalPeso.toLocaleString("pt-BR")}kg</p>
                <p className="text-xs text-muted-foreground">Total estoque</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-black ${bobinasCriticas.length > 0 ? "text-red-600" : "text-green-600"}`}>{bobinasCriticas.length}</p>
                <p className="text-xs text-muted-foreground">⚠ Críticas</p>
              </div>
            </div>
          </div>

          {/* Isopor */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-cyan-500" /> Estoque de Isopor / EPS
              </h2>
              <Link to="/isopor"><span className="text-xs text-primary hover:underline">Ver tudo →</span></Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {isopores.map(i => (
                <div key={i.id} className="bg-cyan-50 border border-cyan-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-cyan-800 mb-1 truncate">{i.tipo}</p>
                  <p className="text-xl font-black text-cyan-700">{i.quantidade || 0}<span className="text-xs font-normal ml-1">un</span></p>
                  {i.metragem_total && <p className="text-xs text-cyan-600">{i.metragem_total}m linear</p>}
                </div>
              ))}
              {isopores.length === 0 && <p className="text-xs text-muted-foreground col-span-3 text-center py-4">Nenhum isopor cadastrado</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}