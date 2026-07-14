import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Search, X } from "lucide-react";

export default function EficienciaMaquinas({ filters }) {
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [buscaMaquina, setBuscaMaquina] = useState("");

  const { data: rawData = [], isLoading } = useQuery({
    queryKey: ["admin-eficiencia-v3", filters.dataInicial, filters.dataFinal, filters.filial],
    queryFn: async () => {
      const f = { status: "finalizado", data_finalizacao: { $gte: filters.dataInicial, $lte: filters.dataFinal } };
      if (filters.filial) f.unidade = filters.filial;
      const [ordensMaq, ordensDesb, pedidos] = await Promise.all([
        base44.entities.OrdemMaquinaCD.filter(f, "-data_finalizacao", 500),
        base44.entities.OrdemDesbobinadeira.filter(f, "-data_finalizacao", 500),
        base44.entities.Pedido.filter(f, "-data_finalizacao", 500),
      ]);
      const stats = {};
      const add = (machine, prod, setup, pausa, kg, setor) => { if (!machine) return; if (!stats[machine]) stats[machine] = { producao: 0, setup: 0, pausa: 0, kg: 0, setor }; stats[machine].producao += prod || 0; stats[machine].setup += setup || 0; stats[machine].pausa += pausa || 0; stats[machine].kg += kg || 0; };
      ordensMaq.forEach(o => add(o.maquina, o.tempo_producao_seg, o.tempo_setup_seg, o.tempo_pausa_seg, o.peso_kg, "Corte e Dobra"));
      ordensDesb.forEach(o => add("DESBobINADEIRA", o.tempo_producao_seg, o.tempo_setup_seg, o.tempo_pausa_seg, o.kg_estimado, "Corte e Dobra"));
      pedidos.forEach(p => add(p.maquina, p.tempo_producao_seg, p.tempo_setup_seg, p.tempo_pausa_seg, p.kg_total, "Telhas"));
      return Object.entries(stats).map(([machine, s]) => {
        const total = s.producao + s.setup + s.pausa;
        return { machine, setor: s.setor, producao: +(s.producao / 3600).toFixed(1), setup: +(s.setup / 3600).toFixed(1), pausa: +(s.pausa / 3600).toFixed(1), kg: Math.round(s.kg), eficiencia: total > 0 ? +((s.producao / total) * 100).toFixed(1) : 0 };
      });
    },
  });

  const filteredData = useMemo(() => {
    let d = rawData;
    if (filtroSetor !== "todos") d = d.filter(m => m.setor === (filtroSetor === "telhas" ? "Telhas" : "Corte e Dobra"));
    if (buscaMaquina.trim()) { const q = buscaMaquina.toLowerCase().trim(); d = d.filter(m => m.machine.toLowerCase().includes(q)); }
    return d;
  }, [rawData, filtroSetor, buscaMaquina]);

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {["todos", "telhas", "corte_dobra"].map(f => (
            <button key={f} onClick={() => setFiltroSetor(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroSetor === f ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"}`}>{f === "todos" ? "Todos" : f === "telhas" ? "Telhas" : "Corte e Dobra"}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input type="text" value={buscaMaquina} onChange={e => setBuscaMaquina(e.target.value)} placeholder="Buscar máquina..." className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          {buscaMaquina && <button onClick={() => setBuscaMaquina("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {filteredData.length > 0 ? (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="machine" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} interval={0} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v, n) => n.includes("KG") ? `${v} kg` : `${v}h`} /><Legend />
            <Bar dataKey="producao" stackId="a" fill="#10b981" name="Produzindo (h)" /><Bar dataKey="setup" stackId="a" fill="#f59e0b" name="Setup (h)" /><Bar dataKey="pausa" stackId="a" fill="#ef4444" name="Pausado (h)" />
          </BarChart>
        </ResponsiveContainer>
      ) : <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">Nenhum dado no período.</div>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border"><h3 className="text-sm font-bold">Tabela Geral de Eficiência</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
              <th className="text-left py-2 px-4 font-medium">Máquina</th><th className="text-left py-2 px-4 font-medium">Setor</th><th className="text-right py-2 px-4 font-medium">Horas Produção</th><th className="text-right py-2 px-4 font-medium">Horas Setup</th><th className="text-right py-2 px-4 font-medium">Horas Pausa</th><th className="text-right py-2 px-4 font-medium">KG Produzido</th><th className="text-right py-2 px-4 font-medium">Eficiência</th>
            </tr></thead>
            <tbody>
              {filteredData.map(m => (
                <tr key={m.machine} className="border-b border-border hover:bg-muted/30">
                  <td className="py-2.5 px-4 font-medium">{m.machine}</td>
                  <td className="py-2.5 px-4"><span className={`text-xs px-2 py-0.5 rounded ${m.setor === "Telhas" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>{m.setor}</span></td>
                  <td className="py-2.5 px-4 text-right text-emerald-600 font-medium">{m.producao}h</td><td className="py-2.5 px-4 text-right text-amber-600">{m.setup}h</td><td className="py-2.5 px-4 text-right text-red-500">{m.pausa}h</td>
                  <td className="py-2.5 px-4 text-right font-bold">{m.kg.toLocaleString('pt-BR')} kg</td>
                  <td className="py-2.5 px-4 text-right"><span className={`px-2 py-0.5 rounded text-xs font-bold ${m.eficiencia >= 70 ? "bg-emerald-100 text-emerald-700" : m.eficiencia >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{m.eficiencia}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}