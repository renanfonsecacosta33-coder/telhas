import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function EficienciaMaquinas() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const { data: chartData = [], isLoading } = useQuery({
    queryKey: ["admin-eficiencia-maquinas", weekAgoStr],
    queryFn: async () => {
      const [ordensMaq, ordensDesb, pedidos] = await Promise.all([
        base44.entities.OrdemMaquinaCD.filter({ status: "finalizado", data_finalizacao: { $gte: weekAgoStr } }, "-data_finalizacao", 500),
        base44.entities.OrdemDesbobinadeira.filter({ status: "finalizado", data_finalizacao: { $gte: weekAgoStr } }, "-data_finalizacao", 500),
        base44.entities.Pedido.filter({ status: "finalizado", data_finalizacao: { $gte: weekAgoStr } }, "-data_finalizacao", 500),
      ]);

      const stats = {};
      const add = (machine, prod, setup, pausa) => {
        if (!machine) return;
        if (!stats[machine]) stats[machine] = { producao: 0, setup: 0, pausa: 0 };
        stats[machine].producao += prod || 0;
        stats[machine].setup += setup || 0;
        stats[machine].pausa += pausa || 0;
      };

      ordensMaq.forEach(o => add(o.maquina, o.tempo_producao_seg, o.tempo_setup_seg, o.tempo_pausa_seg));
      ordensDesb.forEach(o => add("DESBobINADEIRA", o.tempo_producao_seg, o.tempo_setup_seg, o.tempo_pausa_seg));
      pedidos.forEach(p => add(p.maquina, p.tempo_producao_seg, p.tempo_setup_seg, p.tempo_pausa_seg));

      return Object.entries(stats).map(([machine, s]) => ({
        machine,
        producao: +(s.producao / 3600).toFixed(1),
        setup: +(s.setup / 3600).toFixed(1),
        pausa: +(s.pausa / 3600).toFixed(1),
      }));
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Acumulado semanal (últimos 7 dias) — horas por máquina</p>
      {chartData.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">Nenhum dado de produção finalizada na semana.</div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="machine" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => `${v}h`} />
            <Legend />
            <Bar dataKey="producao" stackId="a" fill="#10b981" name="Produzindo (h)" />
            <Bar dataKey="setup" stackId="a" fill="#f59e0b" name="Setup (h)" />
            <Bar dataKey="pausa" stackId="a" fill="#ef4444" name="Pausado (h)" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}