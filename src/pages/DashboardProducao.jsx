import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Factory, Clock, CheckCircle2, Pause, AlertCircle,
  TrendingUp, ArrowRight, Circle, Layers, Timer,
  BarChart2, Activity, Coffee, Square, Zap, Package
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend, PieChart, Pie
} from "recharts";

const MAQUINAS = [
  { nome: "TP - 40",      path: "/maquina/tp40",         dashPath: "/dashboard/tp40",         color: "bg-green-500",  colorHex: "#22c55e" },
  { nome: "TP - 25",      path: "/maquina/tp25",          dashPath: "/dashboard/tp25",          color: "bg-blue-500",   colorHex: "#3b82f6" },
  { nome: "ONDULADA",     path: "/maquina/ondulada",      dashPath: "/dashboard/ondulada",      color: "bg-purple-500", colorHex: "#a855f7" },
  { nome: "COLONIAL",     path: "/maquina/colonial",      dashPath: "/dashboard/colonial",      color: "bg-orange-500", colorHex: "#f97316" },
  { nome: "BANDEJA",      path: "/maquina/bandeja",       dashPath: "/dashboard/bandeja",       color: "bg-pink-500",   colorHex: "#ec4899" },
  { nome: "DESBOBINADOR", path: "/maquina/desbobinador",  dashPath: "/dashboard/desbobinador",  color: "bg-yellow-500", colorHex: "#eab308" },
  { nome: "CUMEEIRA",     path: "/maquina/cumeeira",      dashPath: "/dashboard/cumeeira",      color: "bg-teal-500",   colorHex: "#14b8a6" },
  { nome: "COLAGEM",      path: "/maquina/colagem",       dashPath: "/dashboard/colagem",       color: "bg-red-500",    colorHex: "#ef4444" },
];

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardProducao() {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-dashboard"],
    queryFn: () => base44.entities.Pedido.list("-data", 1000),
    refetchInterval: 15000,
  });

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-dashboard"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false }),
  });

  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores-dashboard"],
    queryFn: () => base44.entities.Isopor.list(),
  });

  // Pedidos de hoje e semana
  const pedidosHoje = useMemo(() => pedidos.filter(p => p.data === hoje), [pedidos, hoje]);
  const pedidosSemana = useMemo(() => pedidos.filter(p => p.data >= weekStart && p.data <= weekEnd), [pedidos, weekStart, weekEnd]);

  // KPIs hoje
  const emProducaoHoje = pedidosHoje.filter(p => p.status === "em_producao").length;
  const pausadosHoje = pedidosHoje.filter(p => p.status === "pausado").length;
  const finalizadosHoje = pedidosHoje.filter(p => p.status === "finalizado" || p.status === "aguardando_colagem").length;
  const pendentesHoje = pedidosHoje.filter(p => p.status === "pendente").length;
  const metrosHoje = pedidosHoje.reduce((s, p) => s + (p.metros || 0), 0);
  const metrosSemana = pedidosSemana.reduce((s, p) => s + (p.metros || 0), 0);

  // Tempos totais hoje
  const tempoProdTotal = pedidosHoje.reduce((s, p) => s + (p.tempo_producao_seg || 0), 0);
  const tempoPausaTotal = pedidosHoje.reduce((s, p) => s + (p.tempo_pausa_seg || 0), 0);
  const tempoSetupTotal = pedidosHoje.reduce((s, p) => s + (p.tempo_setup_seg || 0), 0);
  const tempoTotal = tempoProdTotal + tempoPausaTotal + tempoSetupTotal;
  const eficiencia = tempoTotal > 0 ? Math.round((tempoProdTotal / tempoTotal) * 100) : 0;

  // Por máquina — hoje
  const porMaquinaHoje = useMemo(() => MAQUINAS.map(m => {
    const ps = pedidosHoje.filter(p => p.maquina === m.nome);
    return {
      ...m,
      total: ps.length,
      metros: ps.reduce((s, p) => s + (p.metros || 0), 0),
      emProducao: ps.filter(p => p.status === "em_producao").length,
      pausado: ps.filter(p => p.status === "pausado").length,
      finalizado: ps.filter(p => p.status === "finalizado" || p.status === "aguardando_colagem").length,
      pendente: ps.filter(p => p.status === "pendente").length,
      tempoProd: ps.reduce((s, p) => s + (p.tempo_producao_seg || 0), 0),
    };
  }), [pedidosHoje]);

  // Gráfico últimos 7 dias
  const ultimos7dias = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dia = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const ps = pedidos.filter(p => p.data === dia);
    return {
      dia: format(new Date(dia + "T12:00:00"), "EEE dd/MM", { locale: ptBR }),
      metros: ps.reduce((s, p) => s + (p.metros || 0), 0),
      pedidos: ps.length,
      finalizados: ps.filter(p => p.status === "finalizado").length,
    };
  }), [pedidos]);

  // Pedidos ativos agora (em produção ou pausados em qualquer data)
  const pedidosAtivos = useMemo(() => pedidos.filter(p => p.status === "em_producao" || p.status === "pausado"), [pedidos]);
  const aguardandoColagem = pedidos.filter(p => p.status === "aguardando_colagem").length;

  // Pedidos em trânsito (multi-etapa: aguardando próxima máquina)
  const pedidosTransito = useMemo(() => pedidos.filter(p => p.status === "aguardando_colagem"), [pedidos]);

  // Fluxos de máquinas conhecidos para rastreamento visual
  const FLUXOS = {
    "TELHA BANDEJA": { "TP - 40": ["TP - 40", "BANDEJA", "COLAGEM"], "COLONIAL": ["COLONIAL", "BANDEJA", "COLAGEM"] },
    "TELHA + EPS": { default: ["TP - 40", "COLAGEM"] },
    "TELHA + EPS + TELHA": { default: ["TP - 40", "COLAGEM"] },
    "TELHA + EPS + MANTA": { default: ["TP - 40", "COLAGEM"] },
  };

  function getMaquinasPercorridas(pedido) {
    // Tenta determinar quais máquinas o pedido já passou
    const maquinaAtual = pedido.maquina;
    const produto = pedido.produto;
    const fluxoProduto = FLUXOS[produto];
    if (!fluxoProduto) return null;
    const fluxo = fluxoProduto[maquinaAtual] || fluxoProduto.default;
    if (!fluxo) return null;
    const idxAtual = fluxo.indexOf(maquinaAtual);
    return { fluxo, idxAtual };
  }

  // Histórico de pausas hoje — todos
  const pausasHoje = useMemo(() => {
    const lista = [];
    pedidosHoje.forEach(p => {
      const hist = JSON.parse(p.historico_pausas || "[]");
      hist.forEach(h => lista.push({ ...h, maquina: p.maquina, produto: p.produto }));
    });
    return lista;
  }, [pedidosHoje]);
  const totalPausasSetup = pausasHoje.filter(h => h.motivo === "setup").reduce((s, h) => s + (h.segundos || 0), 0);
  const totalPausasOutro = pausasHoje.filter(h => h.motivo !== "setup").reduce((s, h) => s + (h.segundos || 0), 0);

  // Estoque crítico
  const bobinasCriticas = bobinas.filter(b => (b.peso_kg || 0) < 200);
  const isoporCritico = isopores.filter(i => (i.quantidade || 0) < 10);

  // Produção por produto semana (para pie chart)
  const porProdutoSemana = useMemo(() => {
    const tipos = ["TELHA", "TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA", "BOBININHA", "CUMEEIRA", "PAINEL"];
    return tipos.map(t => ({
      name: t.replace("TELHA + EPS + ", "T+EPS+").replace("TELHA + EPS", "T+EPS").replace("TELHA BANDEJA", "T.BANDEJA"),
      metros: pedidosSemana.filter(p => p.produto === t).reduce((s, p) => s + (p.metros || 0), 0),
    })).filter(d => d.metros > 0).sort((a, b) => b.metros - a.metros);
  }, [pedidosSemana]);

  const PIE_COLORS = ["#3b82f6", "#22c55e", "#14b8a6", "#f97316", "#ec4899", "#a855f7", "#eab308", "#ef4444"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Dashboard Geral de Produção
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })} · Atualiza a cada 15s
          </p>
        </div>
        <Link to="/producao">
          <Button variant="outline" size="sm" className="gap-2">
            <Factory className="w-4 h-4" />
            Visão Admin
          </Button>
        </Link>
      </div>

      {/* Alertas */}
      {(aguardandoColagem > 0 || bobinasCriticas.length > 0 || isoporCritico.length > 0 || pausadosHoje > 0) && (
        <div className="flex flex-wrap gap-2">
          {pausadosHoje > 0 && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-300 rounded-xl px-4 py-2.5">
              <Pause className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">{pausadosHoje} pedido(s) pausado(s)</span>
            </div>
          )}
          {aguardandoColagem > 0 && (
            <Link to="/maquina/colagem">
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-orange-100 transition-colors">
                <Layers className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-700">{aguardandoColagem} aguardando Colagem</span>
                <ArrowRight className="w-3 h-3 text-orange-500" />
              </div>
            </Link>
          )}
          {bobinasCriticas.length > 0 && (
            <Link to="/bobinas">
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">{bobinasCriticas.length} bobina(s) &lt;200kg</span>
                <ArrowRight className="w-3 h-3 text-red-500" />
              </div>
            </Link>
          )}
          {isoporCritico.length > 0 && (
            <Link to="/isopor">
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-yellow-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-semibold text-yellow-700">{isoporCritico.length} EPS &lt;10 peças</span>
                <ArrowRight className="w-3 h-3 text-yellow-500" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* KPIs principais — Hoje */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Metros Hoje", value: `${metrosHoje.toFixed(0)}m`, sub: "Total programado", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
          { label: "Em Produção", value: emProducaoHoje, sub: "pedidos ativos agora", icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Finalizados Hoje", value: finalizadosHoje, sub: "pedidos concluídos", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Eficiência", value: `${eficiencia}%`, sub: "tempo produtivo/total", icon: Activity, color: eficiencia >= 70 ? "text-green-600" : eficiencia >= 50 ? "text-amber-600" : "text-red-600", bg: eficiencia >= 70 ? "bg-green-50" : eficiencia >= 50 ? "bg-amber-50" : "bg-red-50" },
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

      {/* Tempos e eficiência */}
      {tempoTotal > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Distribuição de Tempo — Hoje (total: {formatTempo(tempoTotal)})
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-3">
            {[
              { label: "Produção", val: tempoProdTotal, color: "text-green-600", bg: "bg-green-50 border-green-200", barColor: "bg-green-500" },
              { label: "Pausa", val: tempoPausaTotal, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", barColor: "bg-amber-500" },
              { label: "Setup", val: tempoSetupTotal, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", barColor: "bg-purple-500" },
            ].map(t => {
              const pct = tempoTotal > 0 ? Math.round((t.val / tempoTotal) * 100) : 0;
              return (
                <div key={t.label} className={`rounded-xl p-3 border ${t.bg}`}>
                  <p className={`text-xl font-black ${t.color}`}>{formatTempo(t.val)}</p>
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                  <div className="mt-2 bg-white/70 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${t.barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs font-bold mt-0.5 opacity-60">{pct}%</p>
                </div>
              );
            })}
          </div>
          {pausasHoje.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground border-t border-border pt-3">
              <span className="flex items-center gap-1"><Square className="w-3 h-3 text-purple-500" />Setup: {formatTempo(totalPausasSetup)} ({pausasHoje.filter(h => h.motivo === "setup").length}x)</span>
              <span className="flex items-center gap-1"><Coffee className="w-3 h-3 text-amber-500" />Outras pausas: {formatTempo(totalPausasOutro)} ({pausasHoje.filter(h => h.motivo !== "setup").length}x)</span>
            </div>
          )}
        </div>
      )}

      {/* Grid: Gráfico 7 dias + Pedidos ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 7 dias */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Metros Produzidos — Últimos 7 Dias
            </h2>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              Semana: {metrosSemana.toFixed(0)}m
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ultimos7dias} barCategoryGap="30%">
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip formatter={(v) => [`${v}m`, "Metros"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="metros" radius={[6, 6, 0, 0]}>
                {ultimos7dias.map((entry, i) => (
                  <Cell key={i} fill={i === 6 ? "#3b82f6" : "#93c5fd"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pedidos ativos agora */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Em Produção Agora ({pedidosAtivos.length})
          </h2>
          {pedidosAtivos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs">
              <Circle className="w-8 h-8 mb-2 opacity-30" />
              Nenhum pedido ativo no momento
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {pedidosAtivos.map(p => (
                <div key={p.id} className={`rounded-lg px-3 py-2 border text-xs ${p.status === "pausado" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-700">{p.produto}</span>
                    <Badge className={`text-xs border ${p.status === "pausado" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-green-100 text-green-700 border-green-300"}`}>
                      {p.status === "pausado" ? "Pausado" : "Produzindo"}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">{p.maquina} · {p.cliente || "—"}</div>
                  {p.status === "pausado" && p.motivo_pausa && (
                    <div className="text-amber-700 mt-0.5">⏸ {p.motivo_pausa === "setup" ? "Setup" : p.motivo_pausa}</div>
                  )}
                  {p.tempo_producao_seg > 0 && (
                    <div className="flex items-center gap-1 mt-0.5 text-slate-500">
                      <Timer className="w-2.5 h-2.5" />
                      {formatTempo(p.tempo_producao_seg)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rastreamento de Pedidos em Andamento / Trânsito */}
      {(pedidosAtivos.length > 0 || pedidosTransito.length > 0) && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            Rastreamento de Pedidos — Onde estão agora
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {[...pedidosAtivos, ...pedidosTransito].map(p => {
              const rastreio = getMaquinasPercorridas(p);
              return (
                <div key={p.id} className="border border-border rounded-xl p-3 bg-muted/30">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-bold text-sm">{p.produto}</span>
                      {p.cliente && <span className="text-xs text-muted-foreground ml-2">· {p.cliente}</span>}
                      {p.numero_pedido && <span className="text-xs text-muted-foreground ml-1">#{p.numero_pedido}</span>}
                    </div>
                    <Badge className={`text-xs border flex-shrink-0 ${
                      p.status === "em_producao" ? "bg-amber-100 text-amber-700 border-amber-300" :
                      p.status === "pausado" ? "bg-purple-100 text-purple-700 border-purple-300" :
                      "bg-orange-100 text-orange-700 border-orange-300"
                    }`}>
                      {p.status === "em_producao" ? "🔄 Produzindo" : p.status === "pausado" ? "⏸ Pausado" : "⏳ Aguardando"}
                    </Badge>
                  </div>
                  {/* Fluxo de máquinas */}
                  {rastreio ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {rastreio.fluxo.map((maq, i) => {
                        const passou = i < rastreio.idxAtual;
                        const atual = i === rastreio.idxAtual;
                        const futuro = i > rastreio.idxAtual;
                        return (
                          <React.Fragment key={maq}>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                              passou ? "bg-green-100 text-green-700 border-green-300 line-through opacity-70" :
                              atual ? "bg-primary text-primary-foreground border-primary" :
                              "bg-muted text-muted-foreground border-border"
                            }`}>
                              {passou ? "✓ " : atual ? "▶ " : ""}{maq}
                            </span>
                            {i < rastreio.fluxo.length - 1 && (
                              <ArrowRight className={`w-3 h-3 ${passou ? "text-green-400" : "text-muted-foreground/40"}`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold border bg-primary text-primary-foreground border-primary">
                        ▶ {p.maquina}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {p.metros > 0 && <span>{Number(p.metros).toLocaleString("pt-BR")} telhas</span>}
                    {p.metragem_mm > 0 && <span>{Number(p.metragem_mm)}mm</span>}
                    {p.metros > 0 && p.metragem_mm > 0 && <span className="text-primary font-semibold">{(p.metros * p.metragem_mm / 1000).toFixed(1)}m total</span>}
                    {p.data_prevista && <span>· Prev: {format(new Date(p.data_prevista + "T12:00:00"), "dd/MM")}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status por Máquina — hoje */}
      <div>
        <h2 className="font-bold text-base mb-3">Status por Máquina — Hoje</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {porMaquinaHoje.map(m => (
            <div key={m.nome} className="bg-card border border-border rounded-xl p-3 hover:shadow-md transition-all group">
              {/* Indicador de status */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${m.emProducao > 0 ? m.color + " animate-pulse" : m.total > 0 ? m.color + " opacity-40" : "bg-slate-200"}`} />
                <span className="text-xs font-bold truncate">{m.nome}</span>
              </div>
              <p className="text-2xl font-black text-primary">{m.metros > 0 ? `${m.metros.toFixed(0)}m` : "—"}</p>
              <p className="text-xs text-muted-foreground mb-2">{m.total} ped.</p>
              <div className="space-y-0.5">
                {m.emProducao > 0 && <div className="flex items-center gap-1 text-xs text-amber-600"><Zap className="w-2.5 h-2.5" />{m.emProducao} prod.</div>}
                {m.pausado > 0 && <div className="flex items-center gap-1 text-xs text-purple-600"><Pause className="w-2.5 h-2.5" />{m.pausado} paus.</div>}
                {m.finalizado > 0 && <div className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-2.5 h-2.5" />{m.finalizado} pron.</div>}
                {m.pendente > 0 && <div className="flex items-center gap-1 text-xs text-slate-500"><Circle className="w-2.5 h-2.5" />{m.pendente} pend.</div>}
                {m.total === 0 && <div className="text-xs text-muted-foreground/50 italic">Sem pedidos</div>}
              </div>
              {m.tempoProd > 0 && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                  <Timer className="w-2.5 h-2.5" />{formatTempo(m.tempoProd)}
                </div>
              )}
              <div className="mt-1 flex gap-1">
                <Link to={m.path} className="flex-1">
                  <div className="text-xs text-center text-muted-foreground group-hover:text-primary transition-colors border border-border rounded px-1 py-0.5">Painel</div>
                </Link>
                <Link to={m.dashPath} className="flex-1">
                  <div className="text-xs text-center text-muted-foreground group-hover:text-primary transition-colors border border-border rounded px-1 py-0.5">Dash</div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid inferior: Produção semana + Histórico pausas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por produto semana */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Produção por Produto — Semana
          </h2>
          {porProdutoSemana.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma produção esta semana</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const maxM = Math.max(...porProdutoSemana.map(d => d.metros), 1);
                return porProdutoSemana.map(d => (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-32 truncate text-slate-600">{d.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(d.metros / maxM) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-primary w-12 text-right">{d.metros.toFixed(0)}m</span>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Histórico de pausas hoje */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Pause className="w-4 h-4 text-amber-600" />
            Histórico de Pausas — Hoje ({pausasHoje.length})
          </h2>
          {pausasHoje.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma pausa registrada hoje</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...pausasHoje].sort((a, b) => (b.inicio || "").localeCompare(a.inicio || "")).map((h, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${h.motivo === "setup" ? "bg-purple-50 border-purple-200" : "bg-amber-50 border-amber-200"}`}>
                  {h.motivo === "setup" ? <Square className="w-3 h-3 text-purple-600 flex-shrink-0" /> : <Coffee className="w-3 h-3 text-amber-600 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{h.motivo === "setup" ? "Setup" : h.motivo}</span>
                    <span className="text-muted-foreground ml-1">· {h.maquina}</span>
                  </div>
                  <span className={`font-bold ${h.motivo === "setup" ? "text-purple-700" : "text-amber-700"}`}>
                    {formatTempo(h.segundos)}
                  </span>
                  {h.inicio && (
                    <span className="text-muted-foreground">{format(new Date(h.inicio), "HH:mm")}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Semana: pedidos por dia e máquina */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-bold text-sm mb-4">Metros por Máquina — Semana</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={(() => {
              const dias = Array.from({ length: 7 }, (_, i) => {
                const dia = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
                const label = format(new Date(dia + "T12:00:00"), "EEE dd/MM", { locale: ptBR });
                const row = { dia: label };
                MAQUINAS.forEach(m => {
                  row[m.nome] = pedidos.filter(p => p.data === dia && p.maquina === m.nome).reduce((s, p) => s + (p.metros || 0), 0);
                });
                return row;
              });
              return dias;
            })()}
            barCategoryGap="20%"
            barGap={1}
          >
            <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v}m`]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            {MAQUINAS.filter(m => porMaquinaHoje.find(pm => pm.nome === m.nome)?.total > 0 || pedidosSemana.some(p => p.maquina === m.nome)).map(m => (
              <Bar key={m.nome} dataKey={m.nome} stackId="a" fill={m.colorHex} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}