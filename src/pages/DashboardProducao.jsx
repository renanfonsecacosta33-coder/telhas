import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Factory, Clock, CheckCircle2, Pause, AlertCircle,
  TrendingUp, ArrowRight, Circle, Layers, Timer
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const MAQUINAS = [
  { nome: "TP - 40",      path: "/maquina/tp40",        color: "bg-green-500",  colorHex: "#22c55e" },
  { nome: "TP - 25",      path: "/maquina/tp25",        color: "bg-blue-500",   colorHex: "#3b82f6" },
  { nome: "ONDULADA",     path: "/maquina/ondulada",    color: "bg-purple-500", colorHex: "#a855f7" },
  { nome: "COLONIAL",     path: "/maquina/colonial",    color: "bg-orange-500", colorHex: "#f97316" },
  { nome: "BANDEJA",      path: "/maquina/bandeja",     color: "bg-pink-500",   colorHex: "#ec4899" },
  { nome: "DESBOBINADOR", path: "/maquina/desbobinador",color: "bg-yellow-500", colorHex: "#eab308" },
  { nome: "CUMEEIRA",     path: "/maquina/cumeeira",    color: "bg-teal-500",   colorHex: "#14b8a6" },
  { nome: "COLAGEM",      path: "/maquina/colagem",     color: "bg-red-500",    colorHex: "#ef4444" },
];

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
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
    queryFn: () => base44.entities.Pedido.list("-data", 500),
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

  // Pedidos de hoje
  const pedidosHoje = useMemo(() => pedidos.filter(p => p.data === hoje), [pedidos, hoje]);
  // Pedidos da semana
  const pedidosSemana = useMemo(() => pedidos.filter(p => p.data >= weekStart && p.data <= weekEnd), [pedidos, weekStart, weekEnd]);

  // Status counts hoje
  const emProducaoHoje = pedidosHoje.filter(p => p.status === "em_producao" || p.status === "pausado").length;
  const finalizadosHoje = pedidosHoje.filter(p => p.status === "finalizado" || p.status === "aguardando_colagem").length;
  const pendentesHoje = pedidosHoje.filter(p => p.status === "pendente").length;
  const metrosHoje = pedidosHoje.reduce((s, p) => s + (p.metros || 0), 0);
  const metrosSemana = pedidosSemana.reduce((s, p) => s + (p.metros || 0), 0);

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
    };
  }), [pedidosHoje]);

  // Gráfico últimos 7 dias
  const ultimos7dias = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dia = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
      const ps = pedidos.filter(p => p.data === dia);
      return {
        dia: format(new Date(dia + "T12:00:00"), "dd/MM", { locale: ptBR }),
        metros: ps.reduce((s, p) => s + (p.metros || 0), 0),
        pedidos: ps.length,
        finalizados: ps.filter(p => p.status === "finalizado").length,
      };
    });
  }, [pedidos]);

  // Pedidos ativos agora (em produção ou pausados)
  const pedidosAtivos = useMemo(() =>
    pedidos.filter(p => p.status === "em_producao" || p.status === "pausado")
  , [pedidos]);

  // Colagem pendente
  const aguardandoColagem = pedidos.filter(p => p.status === "aguardando_colagem").length;

  // Estoque crítico
  const bobinasCriticas = bobinas.filter(b => (b.peso_kg || 0) < 200);
  const isoporCritico = isopores.filter(i => (i.quantidade || 0) < 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Dashboard de Produção
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

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Metros Hoje", value: `${metrosHoje.toFixed(0)}m`, sub: "produzidos no dia", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
          { label: "Em Produção", value: emProducaoHoje, sub: "pedidos ativos agora", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Finalizados Hoje", value: finalizadosHoje, sub: "pedidos concluídos", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Pendentes Hoje", value: pendentesHoje, sub: "aguardando início", icon: Circle, color: "text-slate-500", bg: "bg-slate-100" },
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

      {/* Alertas */}
      {(aguardandoColagem > 0 || bobinasCriticas.length > 0 || isoporCritico.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {aguardandoColagem > 0 && (
            <Link to="/maquina/colagem">
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-orange-100 transition-colors">
                <Layers className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-700">{aguardandoColagem} pedido(s) aguardando Colagem</span>
                <ArrowRight className="w-3 h-3 text-orange-500" />
              </div>
            </Link>
          )}
          {bobinasCriticas.length > 0 && (
            <Link to="/bobinas">
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">{bobinasCriticas.length} bobina(s) com estoque baixo (&lt;200kg)</span>
                <ArrowRight className="w-3 h-3 text-red-500" />
              </div>
            </Link>
          )}
          {isoporCritico.length > 0 && (
            <Link to="/isopor">
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-yellow-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-semibold text-yellow-700">{isoporCritico.length} tipo(s) de EPS com estoque baixo (&lt;10 peças)</span>
                <ArrowRight className="w-3 h-3 text-yellow-500" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Grid: Gráfico + Pedidos Ativos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 7 dias */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm">Metros Produzidos — Últimos 7 Dias</h2>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
              Semana: {metrosSemana.toFixed(0)}m
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ultimos7dias} barCategoryGap="30%">
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip
                formatter={(v) => [`${v}m`, "Metros"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="metros" radius={[6, 6, 0, 0]}>
                {ultimos7dias.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.dia === format(new Date(), "dd/MM", { locale: ptBR }) ? "#3b82f6" : "#93c5fd"}
                  />
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
                      {p.status === "pausado" ? <><Pause className="w-2.5 h-2.5 mr-1" />Pausado</> : <><Clock className="w-2.5 h-2.5 mr-1" />Produzindo</>}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">{p.maquina} · {p.cliente || "—"}</div>
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

      {/* Painel por Máquina */}
      <div>
        <h2 className="font-bold text-base mb-3">Status por Máquina — Hoje</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {porMaquinaHoje.map(m => (
            <Link key={m.nome} to={m.path}>
              <div className="bg-card border border-border rounded-xl p-3 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${m.color}`} />
                  <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">{m.nome}</span>
                </div>
                <p className="text-2xl font-black text-primary">{m.metros > 0 ? `${m.metros.toFixed(0)}m` : "—"}</p>
                <p className="text-xs text-muted-foreground mb-2">{m.total} pedido(s)</p>
                <div className="space-y-0.5">
                  {m.emProducao > 0 && <div className="flex items-center gap-1 text-xs text-amber-600"><Clock className="w-2.5 h-2.5" />{m.emProducao} prod.</div>}
                  {m.pausado > 0 && <div className="flex items-center gap-1 text-xs text-purple-600"><Pause className="w-2.5 h-2.5" />{m.pausado} paus.</div>}
                  {m.finalizado > 0 && <div className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-2.5 h-2.5" />{m.finalizado} pron.</div>}
                  {m.pendente > 0 && <div className="flex items-center gap-1 text-xs text-slate-500"><Circle className="w-2.5 h-2.5" />{m.pendente} pend.</div>}
                  {m.total === 0 && <div className="text-xs text-muted-foreground/50 italic">Sem pedidos</div>}
                </div>
                <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                  Ver painel <ArrowRight className="w-2.5 h-2.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Resumo da semana por produto */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-bold text-sm mb-4">Produção da Semana por Tipo de Produto</h2>
        {(() => {
          const tipos = ["TELHA", "TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA", "BOBININHA", "CUMEEIRA", "PAINEL"];
          const dados = tipos.map(t => ({
            tipo: t,
            metros: pedidosSemana.filter(p => p.produto === t).reduce((s, p) => s + (p.metros || 0), 0),
            qtd: pedidosSemana.filter(p => p.produto === t).length,
          })).filter(d => d.qtd > 0).sort((a, b) => b.metros - a.metros);
          
          if (dados.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhuma produção esta semana</p>;
          
          const maxMetros = Math.max(...dados.map(d => d.metros), 1);
          return (
            <div className="space-y-2">
              {dados.map(d => (
                <div key={d.tipo} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-40 truncate text-slate-600">{d.tipo}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(d.metros / maxMetros) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-primary w-14 text-right">{d.metros.toFixed(0)}m</span>
                  <span className="text-xs text-muted-foreground w-14 text-right">{d.qtd} ped.</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}