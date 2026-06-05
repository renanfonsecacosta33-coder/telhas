import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, CheckCircle2, Pause, AlertCircle, Zap,
  Activity, Timer, BarChart2, Package, Circle, Clock,
  Coffee, Square, ArrowRight, Scissors
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";

// Máquinas do CD
const MAQUINAS_CD = [
  { nome: "DESBOBINADEIRA", path: "/corte-dobra/producao", color: "bg-orange-500", colorHex: "#f97316" },
  { nome: "DOBRADEIRA",     path: "/corte-dobra/producao", color: "bg-blue-500",   colorHex: "#3b82f6" },
  { nome: "GUILHOTINA",     path: "/corte-dobra/producao", color: "bg-purple-500", colorHex: "#a855f7" },
  { nome: "CALANDRA",       path: "/corte-dobra/producao", color: "bg-green-500",  colorHex: "#22c55e" },
  { nome: "PRENSA",         path: "/corte-dobra/producao", color: "bg-pink-500",   colorHex: "#ec4899" },
];

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardCD() {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens-desbobinadeira-dash"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 500),
    refetchInterval: 15000,
  });

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-cd-dash"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false }),
  });

  const { data: bobinasTodas = [] } = useQuery({
    queryKey: ["bobinas-cd-todas"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra" }),
  });

  // KPIs
  const ordensHoje = useMemo(() => ordens.filter(o => o.data === hoje), [ordens, hoje]);
  const ordensSemana = useMemo(() => ordens.filter(o => o.data >= weekStart && o.data <= weekEnd), [ordens, weekStart, weekEnd]);

  const emProducaoHoje = ordensHoje.filter(o => o.status === "em_producao").length;
  const pausadosHoje = ordensHoje.filter(o => o.status === "pausado").length;
  const finalizadosHoje = ordensHoje.filter(o => o.status === "finalizado").length;
  const pendentesHoje = ordensHoje.filter(o => o.status === "pendente").length;
  const pecasHoje = ordensHoje.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
  const pecasSemana = ordensSemana.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);

  const tempoProdTotal = ordensHoje.reduce((s, o) => s + (o.tempo_producao_seg || 0), 0);
  const tempoPausaTotal = ordensHoje.reduce((s, o) => s + (o.tempo_pausa_seg || 0), 0);
  const tempoSetupTotal = ordensHoje.reduce((s, o) => s + (o.tempo_setup_seg || 0), 0);
  const tempoTotal = tempoProdTotal + tempoPausaTotal + tempoSetupTotal;
  const eficiencia = tempoTotal > 0 ? Math.round((tempoProdTotal / tempoTotal) * 100) : 0;

  const ordensAtivas = useMemo(() => ordens.filter(o => o.status === "em_producao" || o.status === "pausado"), [ordens]);

  // Gráfico 7 dias — peças finalizadas
  const ultimos7dias = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dia = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const os = ordens.filter(o => o.data === dia);
    return {
      dia: format(new Date(dia + "T12:00:00"), "EEE dd/MM", { locale: ptBR }),
      ordens: os.length,
      finalizadas: os.filter(o => o.status === "finalizado").length,
      pecas: os.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0),
    };
  }), [ordens]);

  // Gráfico semana por dia
  const dadosSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const dia = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const os = ordens.filter(o => o.data === dia && o.status === "finalizado");
    return {
      dia: format(new Date(dia + "T12:00:00"), "EEE", { locale: ptBR }),
      pecas: os.reduce((s, o) => s + (o.quantidade || 0), 0),
    };
  }), [ordens]);

  // Histórico de pausas hoje
  const pausasHoje = useMemo(() => {
    const lista = [];
    ordensHoje.forEach(o => {
      const hist = JSON.parse(o.historico_pausas || "[]");
      hist.forEach(h => lista.push({ ...h, bobina: o.bobina_descricao }));
    });
    return lista;
  }, [ordensHoje]);

  // Estoque crítico
  const bobinasCriticas = bobinas.filter(b => (b.peso_kg || 0) < 100);
  const totalEstoqueKg = bobinas.reduce((s, b) => s + (b.peso_kg || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scissors className="w-6 h-6 text-orange-500" />
            Dashboard — Corte e Dobra
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR })} · Atualiza a cada 15s
          </p>
        </div>
        <Link to="/corte-dobra/producao">
          <div className="flex items-center gap-2 bg-orange-500 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-orange-600 transition-colors cursor-pointer">
            <Scissors className="w-4 h-4" /> Ir para Produção
          </div>
        </Link>
      </div>

      {/* Alertas */}
      {(pausadosHoje > 0 || bobinasCriticas.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {pausadosHoje > 0 && (
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-300 rounded-xl px-4 py-2.5">
              <Pause className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">{pausadosHoje} ordem(ns) pausada(s)</span>
            </div>
          )}
          {bobinasCriticas.length > 0 && (
            <Link to="/corte-dobra/bobinas">
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-red-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-700">{bobinasCriticas.length} bobina(s) &lt;100kg</span>
                <ArrowRight className="w-3 h-3 text-red-500" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Peças Hoje", value: pecasHoje > 0 ? pecasHoje : "—", sub: "finalizadas", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Em Produção", value: emProducaoHoje || "—", sub: "ordens ativas agora", icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Bobinas CD", value: bobinas.length, sub: `${totalEstoqueKg.toFixed(0)}kg em estoque`, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
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

      {/* Cards de Máquinas — fila superior igual às Telhas */}
      <div>
        <h2 className="font-bold text-base mb-3 flex items-center gap-2">
          <Scissors className="w-4 h-4 text-orange-500" /> Máquinas do Setor
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {MAQUINAS_CD.map(m => {
            const osHoje = ordensHoje.filter(o =>
              o.bobina_descricao?.toLowerCase().includes(m.nome.toLowerCase()) ||
              m.nome === "DESBOBINADEIRA"
            );
            const ativa = ordensHoje.filter(o => o.status === "em_producao").length > 0 && m.nome === "DESBOBINADEIRA";
            const finalizadas = m.nome === "DESBOBINADEIRA" ? finalizadosHoje : 0;
            const total = m.nome === "DESBOBINADEIRA" ? ordensHoje.length : 0;
            const emProd = m.nome === "DESBOBINADEIRA" ? emProducaoHoje : 0;
            const pausado = m.nome === "DESBOBINADEIRA" ? pausadosHoje : 0;
            const pendente = m.nome === "DESBOBINADEIRA" ? pendentesHoje : 0;
            const isMaquinaComDados = m.nome === "DESBOBINADEIRA";

            return (
              <Link key={m.nome} to={m.path}>
                <div className="bg-card border border-border rounded-xl p-3 hover:shadow-md transition-all group cursor-pointer h-full">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${emProd > 0 ? m.color + " animate-pulse" : total > 0 ? m.color + " opacity-40" : "bg-slate-200"}`} />
                    <span className="text-xs font-bold truncate">{m.nome}</span>
                  </div>
                  {isMaquinaComDados ? (
                    <>
                      <p className="text-xl font-black text-orange-500">{total > 0 ? `${total} ord.` : "—"}</p>
                      <div className="space-y-0.5 mt-1">
                        {emProd > 0 && <div className="flex items-center gap-1 text-xs text-amber-600"><Zap className="w-2.5 h-2.5" />{emProd} prod.</div>}
                        {pausado > 0 && <div className="flex items-center gap-1 text-xs text-purple-600"><Pause className="w-2.5 h-2.5" />{pausado} paus.</div>}
                        {finalizadas > 0 && <div className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-2.5 h-2.5" />{finalizadas} fin.</div>}
                        {pendente > 0 && <div className="flex items-center gap-1 text-xs text-slate-500"><Circle className="w-2.5 h-2.5" />{pendente} pend.</div>}
                        {total === 0 && <div className="text-xs text-muted-foreground/50 italic">Sem ordens</div>}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic mt-2">Em breve</p>
                  )}
                  <div className="mt-2 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">Ver painel →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tempos */}
      {tempoTotal > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Distribuição de Tempo — Hoje (total: {formatTempo(tempoTotal)})
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Produção", val: tempoProdTotal, color: "text-green-600", bg: "bg-green-50 border-green-200", barColor: "bg-green-500" },
              { label: "Pausa",    val: tempoPausaTotal, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", barColor: "bg-amber-500" },
              { label: "Setup",    val: tempoSetupTotal, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", barColor: "bg-purple-500" },
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
        </div>
      )}

      {/* Grid: Gráfico 7 dias + Ordens ativas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-orange-500" /> Peças Cortadas — Últimos 7 Dias
            </h2>
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
              Semana: {pecasSemana} peças
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ultimos7dias} barCategoryGap="30%">
              <XAxis dataKey="dia" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip formatter={(v, n) => [v, n === "pecas" ? "Peças" : "Ordens"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="pecas" name="Peças" radius={[6, 6, 0, 0]}>
                {ultimos7dias.map((_, i) => (
                  <Cell key={i} fill={i === 6 ? "#f97316" : "#fed7aa"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ordens ativas agora */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Ativas Agora ({ordensAtivas.length})
          </h2>
          {ordensAtivas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs">
              <Circle className="w-8 h-8 mb-2 opacity-30" />
              Nenhuma ordem ativa agora
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {ordensAtivas.map(o => (
                <div key={o.id} className={`rounded-lg px-3 py-2 border text-xs ${o.status === "pausado" ? "bg-amber-50 border-amber-200" : "bg-orange-50 border-orange-200"}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-700 truncate">{o.bobina_descricao || "—"}</span>
                    <Badge className={`text-xs border flex-shrink-0 ml-1 ${o.status === "pausado" ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-orange-100 text-orange-700 border-orange-300"}`}>
                      {o.status === "pausado" ? "Pausado" : "Produzindo"}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">{o.quantidade} peças · {o.comprimento_mm ? `${o.comprimento_mm}mm` : "—"}</div>
                  {o.tempo_producao_seg > 0 && (
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

      {/* Catálogo de Bobinas CD */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" />
            Bobinas em Estoque — Corte e Dobra ({bobinas.length})
          </h2>
          <Link to="/corte-dobra/bobinas">
            <span className="text-xs text-primary hover:underline cursor-pointer">Ver todas →</span>
          </Link>
        </div>
        {bobinas.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma bobina no estoque CD</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {[...bobinas].sort((a, b) => (a.peso_kg || 0) - (b.peso_kg || 0)).map(b => {
              const pctRestante = b.peso_inicial > 0 ? Math.round((b.peso_kg / b.peso_inicial) * 100) : null;
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
                    </div>
                    {pctRestante !== null && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${pctRestante > 40 ? "bg-green-500" : pctRestante > 20 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${pctRestante}%` }} />
                        </div>
                        <span className="text-muted-foreground w-8 text-right">{pctRestante}%</span>
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
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xl font-black text-blue-600">{bobinas.length}</p>
            <p className="text-xs text-muted-foreground">Bobinas ativas</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-green-600">{totalEstoqueKg.toFixed(0)}kg</p>
            <p className="text-xs text-muted-foreground">Total em estoque</p>
          </div>
          <div className="text-center">
            <p className={`text-xl font-black ${bobinasCriticas.length > 0 ? "text-red-600" : "text-green-600"}`}>{bobinasCriticas.length}</p>
            <p className="text-xs text-muted-foreground">⚠ Críticas</p>
          </div>
        </div>
      </div>

      {/* Histórico de pausas hoje */}
      {pausasHoje.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Pause className="w-4 h-4 text-amber-600" />
            Histórico de Pausas — Hoje ({pausasHoje.length})
          </h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {[...pausasHoje].sort((a, b) => (b.inicio || "").localeCompare(a.inicio || "")).map((h, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${h.motivo === "setup" ? "bg-purple-50 border-purple-200" : "bg-amber-50 border-amber-200"}`}>
                {h.motivo === "setup" ? <Square className="w-3 h-3 text-purple-600 flex-shrink-0" /> : <Coffee className="w-3 h-3 text-amber-600 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{h.motivo === "setup" ? "Setup" : h.motivo}</span>
                  {h.bobina && <span className="text-muted-foreground ml-1">· {h.bobina}</span>}
                </div>
                {h.segundos > 0 && <span className={`font-bold ${h.motivo === "setup" ? "text-purple-700" : "text-amber-700"}`}>{formatTempo(h.segundos)}</span>}
                {h.inicio && <span className="text-muted-foreground">{format(new Date(h.inicio), "HH:mm")}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico semana */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-bold text-sm mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-orange-500" /> Peças por Dia — Esta Semana
        </h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dadosSemana} barCategoryGap="35%">
            <XAxis dataKey="dia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip formatter={(v) => [`${v} peças`]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="pecas" name="Peças" radius={[6, 6, 0, 0]}>
              {dadosSemana.map((_, i) => (
                <Cell key={i} fill={i === dadosSemana.length - 1 ? "#f97316" : "#fed7aa"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}