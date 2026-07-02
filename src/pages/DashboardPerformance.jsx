import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Clock, CheckCircle2, AlertTriangle, Factory, Zap } from "lucide-react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFilial } from "@/contexts/FilialContext";

const MAQUINAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];
const CORES_MAQUINAS = ["#3b82f6","#22c55e","#a855f7","#f97316","#ec4899","#eab308","#14b8a6","#ef4444"];
const CORES_STATUS = { finalizado: "#22c55e", em_producao: "#f59e0b", pendente: "#94a3b8", pausado: "#8b5cf6", cancelado: "#ef4444", aguardando_colagem: "#f97316" };

function formatTempo(seg) {
  if (!seg || seg <= 0) return "—";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardPerformance() {
  const { filialAtiva } = useFilial();
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-dashboard", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva }, "-data", 500),
  });

  const hoje = format(new Date(), "yyyy-MM-dd");
  const ultimos30 = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const ultimos7dias = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });

  const pedidos30 = useMemo(() => pedidos.filter(p => p.data >= ultimos30), [pedidos, ultimos30]);

  // KPIs gerais
  const kpis = useMemo(() => {
    const finalizados = pedidos30.filter(p => p.status === "finalizado");
    const emProducao = pedidos30.filter(p => p.status === "em_producao" || p.status === "pausado");
    const totalMetros = finalizados.reduce((s, p) => s + (p.metros || 0), 0);
    const tempoMedioSeg = finalizados.filter(p => p.tempo_producao_seg > 0).reduce((s, p, _, arr) => s + p.tempo_producao_seg / arr.length, 0);
    const taxaConclusao = pedidos30.length > 0 ? (finalizados.length / pedidos30.length * 100).toFixed(0) : 0;
    return { finalizados: finalizados.length, emProducao: emProducao.length, totalMetros, tempoMedioSeg, taxaConclusao };
  }, [pedidos30]);

  // Produção por dia (últimos 7 dias)
  const dadosDiarios = useMemo(() => {
    return ultimos7dias.map(dia => {
      const diaStr = format(dia, "yyyy-MM-dd");
      const pedidosDia = pedidos.filter(p => p.data === diaStr && p.status === "finalizado");
      return {
        dia: format(dia, "EEE", { locale: ptBR }),
        metros: pedidosDia.reduce((s, p) => s + (p.metros || 0), 0),
        pedidos: pedidosDia.length,
      };
    });
  }, [pedidos, ultimos7dias]);

  // Produção por máquina
  const dadosMaquinas = useMemo(() => {
    return MAQUINAS.map((maq, i) => {
      const ps = pedidos30.filter(p => p.maquina === maq);
      const fin = ps.filter(p => p.status === "finalizado");
      return {
        maquina: maq.replace("TP - ", "TP-"),
        metros: fin.reduce((s, p) => s + (p.metros || 0), 0),
        pedidos: fin.length,
        fill: CORES_MAQUINAS[i],
      };
    }).filter(m => m.metros > 0);
  }, [pedidos30]);

  // Distribuição por status
  const dadosStatus = useMemo(() => {
    const contagem = {};
    pedidos30.forEach(p => { contagem[p.status] = (contagem[p.status] || 0) + 1; });
    return Object.entries(contagem).map(([status, count]) => ({
      name: status.replace("_", " "),
      value: count,
      fill: CORES_STATUS[status] || "#94a3b8",
    }));
  }, [pedidos30]);

  // Top produtos
  const topProdutos = useMemo(() => {
    const contagem = {};
    pedidos30.filter(p => p.status === "finalizado").forEach(p => {
      if (p.produto) contagem[p.produto] = (contagem[p.produto] || 0) + (p.metros || 0);
    });
    return Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, metros]) => ({ nome, metros: +metros.toFixed(1) }));
  }, [pedidos30]);

  if (isLoading) return (
    <div className="flex justify-center py-24">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          Dashboard de Performance
        </h1>
        <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={<CheckCircle2 className="w-5 h-5 text-green-600" />} label="Pedidos Finalizados" value={kpis.finalizados} bg="bg-green-50 border-green-200" />
        <KpiCard icon={<Factory className="w-5 h-5 text-amber-600" />} label="Em Produção" value={kpis.emProducao} bg="bg-amber-50 border-amber-200" />
        <KpiCard icon={<TrendingUp className="w-5 h-5 text-primary" />} label="Metros Produzidos" value={`${kpis.totalMetros.toLocaleString("pt-BR")}m`} bg="bg-primary/5 border-primary/20" />
        <KpiCard icon={<Zap className="w-5 h-5 text-purple-600" />} label="Taxa de Conclusão" value={`${kpis.taxaConclusao}%`} bg="bg-purple-50 border-purple-200" />
      </div>

      {/* Gráficos linha 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Produção diária */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Metros Produzidos — Últimos 7 dias
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dadosDiarios} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}m`, "Metros"]} />
              <Bar dataKey="metros" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por máquina */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
            <Factory className="w-4 h-4 text-primary" />
            Metros por Máquina — 30 dias
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dadosMaquinas} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="maquina" type="category" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => [`${v}m`, "Metros"]} />
              <Bar dataKey="metros" radius={[0, 4, 4, 0]}>
                {dadosMaquinas.map((m, i) => <Cell key={i} fill={m.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráficos linha 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status dos pedidos */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-bold text-sm mb-4">Distribuição por Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dadosStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {dadosStatus.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top produtos */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-bold text-sm mb-4">Top Produtos (metros)</h3>
          <div className="space-y-3">
            {topProdutos.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sem dados suficientes</p>
            ) : (
              topProdutos.map((p, i) => {
                const max = topProdutos[0].metros;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate max-w-[200px]">{p.nome}</span>
                      <span className="font-bold text-primary">{p.metros.toLocaleString("pt-BR")}m</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(p.metros / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, bg }) {
  return (
    <div className={`border rounded-xl p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}