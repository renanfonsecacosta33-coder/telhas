import React, { useMemo, useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Clock, CheckCircle2, Pause, Circle, Timer,
  Coffee, Square, TrendingUp, AlertCircle, BarChart2, Activity
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m ${String(sc).padStart(2, "0")}s`;
}

function LiveTimer({ pedido }) {
  const [, setTick] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    ref.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(ref.current);
  }, []);

  const now = Date.now();
  let prod = pedido.tempo_producao_seg || 0;
  let pausa = pedido.tempo_pausa_seg || 0;
  let setup = pedido.tempo_setup_seg || 0;

  if (pedido.status === "em_producao" && pedido.inicio_producao_ts) {
    prod += Math.floor((now - new Date(pedido.inicio_producao_ts).getTime()) / 1000);
  }
  if (pedido.status === "pausado" && pedido.inicio_pausa_ts) {
    const delta = Math.floor((now - new Date(pedido.inicio_pausa_ts).getTime()) / 1000);
    if (pedido.motivo_pausa === "setup") setup += delta;
    else pausa += delta;
  }

  const isActive = pedido.status === "em_producao";
  const isPaused = pedido.status === "pausado";

  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      <div className={`rounded-lg px-2 py-1.5 text-center ${isActive ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-border"}`}>
        <div className="flex items-center justify-center gap-1 mb-0.5">
          <Timer className="w-3 h-3 text-green-600" />
          <span className="text-xs text-muted-foreground">Produção</span>
        </div>
        <p className={`text-xs font-bold tabular-nums ${isActive ? "text-green-700" : "text-slate-600"}`}>{formatTempo(prod)}</p>
      </div>
      <div className={`rounded-lg px-2 py-1.5 text-center ${isPaused && pedido.motivo_pausa !== "setup" ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-border"}`}>
        <div className="flex items-center justify-center gap-1 mb-0.5">
          <Coffee className="w-3 h-3 text-amber-600" />
          <span className="text-xs text-muted-foreground">Pausa</span>
        </div>
        <p className={`text-xs font-bold tabular-nums ${isPaused && pedido.motivo_pausa !== "setup" ? "text-amber-700" : "text-slate-600"}`}>{formatTempo(pausa)}</p>
      </div>
      <div className={`rounded-lg px-2 py-1.5 text-center ${isPaused && pedido.motivo_pausa === "setup" ? "bg-purple-50 border border-purple-200" : "bg-slate-50 border border-border"}`}>
        <div className="flex items-center justify-center gap-1 mb-0.5">
          <Square className="w-3 h-3 text-purple-600" />
          <span className="text-xs text-muted-foreground">Setup</span>
        </div>
        <p className={`text-xs font-bold tabular-nums ${isPaused && pedido.motivo_pausa === "setup" ? "text-purple-700" : "text-slate-600"}`}>{formatTempo(setup)}</p>
      </div>
    </div>
  );
}

const MAQUINAS_CONFIG = {
  "TP - 40":      { path: "/maquina/tp40",         color: "bg-green-500",  colorHex: "#22c55e", gradient: "from-green-600 to-green-500" },
  "TP - 25":      { path: "/maquina/tp25",          color: "bg-blue-500",   colorHex: "#3b82f6", gradient: "from-blue-600 to-blue-500" },
  "ONDULADA":     { path: "/maquina/ondulada",      color: "bg-purple-500", colorHex: "#a855f7", gradient: "from-purple-600 to-purple-500" },
  "COLONIAL":     { path: "/maquina/colonial",      color: "bg-orange-500", colorHex: "#f97316", gradient: "from-orange-600 to-orange-500" },
  "BANDEJA":      { path: "/maquina/bandeja",       color: "bg-pink-500",   colorHex: "#ec4899", gradient: "from-pink-600 to-pink-500" },
  "DESBOBINADOR": { path: "/maquina/desbobinador",  color: "bg-yellow-500", colorHex: "#eab308", gradient: "from-yellow-600 to-yellow-500" },
  "CUMEEIRA":     { path: "/maquina/cumeeira",      color: "bg-teal-500",   colorHex: "#14b8a6", gradient: "from-teal-600 to-teal-500" },
  "COLAGEM":      { path: "/maquina/colagem",       color: "bg-red-500",    colorHex: "#ef4444", gradient: "from-red-600 to-red-500" },
};

export default function DashboardMaquina({ maquina }) {
  const navigate = useNavigate();
  const cfg = MAQUINAS_CONFIG[maquina] || { colorHex: "#3b82f6", gradient: "from-primary to-primary/80", path: "/" };
  const hoje = format(new Date(), "yyyy-MM-dd");

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-dash-maquina", maquina],
    queryFn: () => base44.entities.Pedido.filter({ maquina }, "-data", 500),
    refetchInterval: 10000,
  });

  const pedidosHoje = useMemo(() => pedidos.filter(p => p.data === hoje), [pedidos, hoje]);
  const ativos = useMemo(() => pedidos.filter(p => p.status === "em_producao" || p.status === "pausado"), [pedidos]);

  const metrosHoje = pedidosHoje.reduce((s, p) => s + (p.metros || 0), 0);
  const finalizadosHoje = pedidosHoje.filter(p => p.status === "finalizado" || p.status === "aguardando_colagem").length;
  const pendentesHoje = pedidosHoje.filter(p => p.status === "pendente").length;

  // Tempo total produzido hoje (soma)
  const tempoTotalProd = pedidosHoje.reduce((s, p) => s + (p.tempo_producao_seg || 0), 0);
  const tempoTotalPausa = pedidosHoje.reduce((s, p) => s + (p.tempo_pausa_seg || 0), 0);
  const tempoTotalSetup = pedidosHoje.reduce((s, p) => s + (p.tempo_setup_seg || 0), 0);

  // Últimos 7 dias
  const ultimos7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dia = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const ps = pedidos.filter(p => p.data === dia);
    return {
      dia: format(new Date(dia + "T12:00:00"), "EEE dd/MM", { locale: ptBR }),
      metros: ps.reduce((s, p) => s + (p.metros || 0), 0),
      finalizados: ps.filter(p => p.status === "finalizado" || p.status === "aguardando_colagem").length,
      total: ps.length,
    };
  }), [pedidos]);

  // Histórico de pausas de todos os pedidos
  const todasPausas = useMemo(() => {
    const lista = [];
    pedidosHoje.forEach(p => {
      const hist = JSON.parse(p.historico_pausas || "[]");
      hist.forEach(h => lista.push({ ...h, produto: p.produto, cliente: p.cliente }));
    });
    return lista.sort((a, b) => (b.inicio || "").localeCompare(a.inicio || ""));
  }, [pedidosHoje]);

  const kpis = [
    { label: "Metros Hoje", value: `${metrosHoje.toFixed(0)}m`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Finalizados", value: finalizadosHoje, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
    { label: "Pendentes", value: pendentesHoje, icon: Circle, color: "text-slate-500", bg: "bg-slate-100" },
    { label: "Tempo Produção", value: formatTempo(tempoTotalProd), icon: Timer, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Botão voltar */}
      <Button variant="ghost" size="sm" onClick={() => navigate(cfg.path)} className="gap-2 text-muted-foreground">
        <ArrowLeft className="w-4 h-4" />
        Voltar ao Painel {maquina}
      </Button>

      {/* Header */}
      <div className={`bg-gradient-to-r ${cfg.gradient} rounded-2xl p-6 text-white shadow-lg`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-75 font-medium uppercase tracking-wide">Dashboard da Máquina</p>
            <h1 className="text-3xl font-black mt-1">{maquina}</h1>
            <p className="text-sm opacity-80 mt-1">
              {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="text-right">
            {ativos.length > 0 ? (
              <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                <span className="font-bold text-sm">{ativos.length} em produção</span>
              </div>
            ) : (
              <div className="bg-white/20 rounded-xl px-3 py-2">
                <span className="font-bold text-sm opacity-70">Parada</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.bg}`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <div>
              <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tempos totais hoje */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Distribuição de Tempo — Hoje
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Tempo Produtivo", value: formatTempo(tempoTotalProd), color: "text-green-600", bg: "bg-green-50 border-green-200", bar: tempoTotalProd },
            { label: "Tempo de Pausa", value: formatTempo(tempoTotalPausa), color: "text-amber-600", bg: "bg-amber-50 border-amber-200", bar: tempoTotalPausa },
            { label: "Tempo de Setup", value: formatTempo(tempoTotalSetup), color: "text-purple-600", bg: "bg-purple-50 border-purple-200", bar: tempoTotalSetup },
          ].map(t => {
            const total = tempoTotalProd + tempoTotalPausa + tempoTotalSetup || 1;
            const pct = Math.round((t.bar / total) * 100);
            return (
              <div key={t.label} className={`rounded-xl p-4 border ${t.bg}`}>
                <p className={`text-2xl font-black ${t.color}`}>{t.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.label}</p>
                <div className="mt-2 bg-white/60 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-current transition-all" style={{ width: `${pct}%`, color: t.color.replace("text-", "") }} />
                </div>
                <p className="text-xs font-semibold mt-1 opacity-60">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Gráfico 7 dias + Pedidos ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            Metros Produzidos — Últimos 7 Dias
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ultimos7} barCategoryGap="30%">
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip
                formatter={(v) => [`${v}m`, "Metros"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="metros" radius={[6, 6, 0, 0]}>
                {ultimos7.map((entry, i) => (
                  <Cell key={i} fill={i === 6 ? cfg.colorHex : `${cfg.colorHex}60`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pedidos ativos agora */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Em Produção Agora ({ativos.length})
          </h2>
          {ativos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-xs text-center">
              <Circle className="w-8 h-8 mb-2 opacity-30" />
              Nenhum pedido ativo agora
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {ativos.map(p => (
                <div key={p.id} className={`rounded-xl p-3 border text-xs ${p.status === "pausado" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-700">{p.produto}</span>
                    <Badge className={`text-xs border ${p.status === "pausado" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-green-100 text-green-700 border-green-300"}`}>
                      {p.status === "pausado" ? "Pausado" : "Produzindo"}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">{p.cliente || "—"} · {p.metros || 0}m</div>
                  {p.status === "pausado" && p.motivo_pausa && (
                    <div className="mt-1 text-amber-700">
                      ⏸ {p.motivo_pausa === "setup" ? "Setup de máquina" : p.motivo_pausa}
                    </div>
                  )}
                  <LiveTimer pedido={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Histórico de pausas hoje */}
      {todasPausas.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Pause className="w-4 h-4 text-amber-600" />
            Histórico de Pausas — Hoje ({todasPausas.length})
          </h2>
          <div className="space-y-2">
            {todasPausas.map((h, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${h.motivo === "setup" ? "bg-purple-50 border-purple-200" : "bg-amber-50 border-amber-200"}`}>
                {h.motivo === "setup"
                  ? <Square className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                  : <Coffee className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{h.motivo === "setup" ? "Setup de Máquina" : h.motivo}</span>
                  {h.produto && <span className="text-muted-foreground ml-2">· {h.produto}</span>}
                  {h.cliente && <span className="text-muted-foreground ml-1">({h.cliente})</span>}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`font-bold ${h.motivo === "setup" ? "text-purple-700" : "text-amber-700"}`}>
                    {formatTempo(h.segundos)}
                  </span>
                  {h.inicio && (
                    <p className="text-muted-foreground mt-0.5">
                      {format(new Date(h.inicio), "HH:mm")}
                      {h.fim ? ` → ${format(new Date(h.fim), "HH:mm")}` : " (em curso)"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pedidos do dia detalhados */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-bold text-sm mb-3">Pedidos de Hoje — {pedidosHoje.length} pedido(s)</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : pedidosHoje.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido programado para hoje</p>
        ) : (
          <div className="space-y-2">
            {pedidosHoje.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-muted/30 text-sm">
                <StatusDot status={p.status} />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{p.produto}</span>
                  {p.cliente && <span className="text-muted-foreground ml-2 text-xs">{p.cliente}</span>}
                  {p.numero_pedido && <span className="text-muted-foreground ml-2 font-mono text-xs">#{p.numero_pedido}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {p.tempo_producao_seg > 0 && (
                    <span className="flex items-center gap-1 text-green-600">
                      <Timer className="w-3 h-3" />{formatTempo(p.tempo_producao_seg)}
                    </span>
                  )}
                  <span className="font-bold text-primary">{p.metros || 0}m</span>
                </div>
                <StatusPill status={p.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }) {
  const colors = {
    em_producao: "bg-amber-400 animate-pulse",
    pausado: "bg-purple-400",
    finalizado: "bg-green-500",
    aguardando_colagem: "bg-orange-400",
    pendente: "bg-slate-300",
    cancelado: "bg-red-400",
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || "bg-slate-300"}`} />;
}

function StatusPill({ status }) {
  const cfg = {
    pendente:           { label: "Pendente",      color: "bg-slate-100 text-slate-600" },
    em_producao:        { label: "Produzindo",    color: "bg-amber-100 text-amber-700" },
    pausado:            { label: "Pausado",       color: "bg-purple-100 text-purple-700" },
    aguardando_colagem: { label: "Ag. Colagem",  color: "bg-orange-100 text-orange-700" },
    finalizado:         { label: "Finalizado",    color: "bg-green-100 text-green-700" },
    cancelado:          { label: "Cancelado",     color: "bg-red-100 text-red-700" },
  }[status] || { label: status, color: "bg-slate-100 text-slate-600" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>;
}