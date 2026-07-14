import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DollarSign, TrendingUp, TrendingDown, Package, Users, Building2 } from "lucide-react";

const formatBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNum = (v) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

export default function KpiFinanceiro() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-kpi-fin", monthStart],
    queryFn: async () => {
      const [ordensMaq, ordensDesb, pedidos, bobinas] = await Promise.all([
        base44.entities.OrdemMaquinaCD.filter({ status: "finalizado", data_finalizacao: { $gte: monthStart, $lte: monthEnd } }, "-data_finalizacao", 500),
        base44.entities.OrdemDesbobinadeira.filter({ status: "finalizado", data_finalizacao: { $gte: monthStart, $lte: monthEnd } }, "-data_finalizacao", 500),
        base44.entities.Pedido.filter({ status: "finalizado", data_finalizacao: { $gte: monthStart, $lte: monthEnd } }, "-data_finalizacao", 500),
        base44.entities.Bobina.list("-created_date", 500),
      ]);

      const bobinaMap = {};
      bobinas.forEach(b => { bobinaMap[b.id] = b; });

      const faturamento = ordensMaq.reduce((s, o) => s + (o.valor_pago_cliente || 0), 0) + ordensDesb.reduce((s, o) => s + (o.valor_pago_cliente || 0), 0);

      let custo = 0;
      const calcCusto = (bobinaId, kg) => {
        const b = bobinaMap[bobinaId];
        return b?.custo && kg ? kg * b.custo : 0;
      };
      ordensDesb.forEach(o => { custo += calcCusto(o.bobina_id, o.kg_estimado); });
      ordensMaq.forEach(o => { custo += calcCusto(o.bobina_id, o.peso_kg); });
      pedidos.forEach(p => { custo += calcCusto(p.bobina_superior_id, p.kg_superior) + calcCusto(p.bobina_inferior_id, p.kg_inferior); });

      const margem = faturamento - custo;
      const margemPct = faturamento > 0 ? (margem / faturamento) * 100 : 0;

      // Vendas por Vendedor
      const vendMap = {};
      const addVend = (v, fat, cst, kg) => {
        const nome = v || "Sem Vendedor";
        if (!vendMap[nome]) vendMap[nome] = { pedidos: 0, faturamento: 0, custo: 0, kg: 0 };
        vendMap[nome].pedidos++;
        vendMap[nome].faturamento += fat || 0;
        vendMap[nome].custo += cst || 0;
        vendMap[nome].kg += kg || 0;
      };
      ordensMaq.forEach(o => addVend(o.vendedor, o.valor_pago_cliente, calcCusto(o.bobina_id, o.peso_kg), o.peso_kg));
      ordensDesb.forEach(o => addVend(o.vendedor, o.valor_pago_cliente, calcCusto(o.bobina_id, o.kg_estimado), o.kg_estimado));
      pedidos.forEach(p => addVend(p.vendedor, 0, calcCusto(p.bobina_superior_id, p.kg_superior) + calcCusto(p.bobina_inferior_id, p.kg_inferior), p.kg_total));

      const vendedores = Object.entries(vendMap).map(([nome, v]) => ({
        nome, ...v, margem: v.faturamento - v.custo,
        margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
      })).sort((a, b) => b.faturamento - a.faturamento);

      // Faturamento por Setor
      const faturamentoCD = ordensMaq.reduce((s, o) => s + (o.valor_pago_cliente || 0), 0) + ordensDesb.reduce((s, o) => s + (o.valor_pago_cliente || 0), 0);
      const kgCD = ordensMaq.reduce((s, o) => s + (o.peso_kg || 0), 0) + ordensDesb.reduce((s, o) => s + (o.kg_estimado || 0), 0);
      const kgTelhas = pedidos.reduce((s, p) => s + (p.kg_total || 0), 0);

      return {
        faturamento, custo, margem, margemPct,
        totalOPs: ordensMaq.length + ordensDesb.length + pedidos.length,
        vendedores,
        setores: [
          { nome: "Telhas", faturamento: 0, kg: kgTelhas, ops: pedidos.length },
          { nome: "Corte e Dobra", faturamento: faturamentoCD, kg: kgCD, ops: ordensMaq.length + ordensDesb.length },
        ],
      };
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  const k = data || { faturamento: 0, custo: 0, margem: 0, margemPct: 0, totalOPs: 0, vendedores: [], setores: [] };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-emerald-600 mb-2"><DollarSign className="w-5 h-5" /><span className="text-sm font-medium">Faturamento Estimado</span></div>
          <p className="text-2xl font-bold">{formatBRL(k.faturamento)}</p>
          <p className="text-xs text-muted-foreground mt-1">{k.totalOPs} OPs finalizadas no mês</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-orange-600 mb-2"><Package className="w-5 h-5" /><span className="text-sm font-medium">Custo de Matéria-Prima</span></div>
          <p className="text-2xl font-bold">{formatBRL(k.custo)}</p>
          <p className="text-xs text-muted-foreground mt-1">Estimado por KG × custo/KG</p>
        </div>
        <div className={`bg-card border-2 rounded-xl p-5 ${k.margem >= 0 ? "border-emerald-300" : "border-red-300"}`}>
          <div className={`flex items-center gap-2 mb-2 ${k.margem >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {k.margem >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            <span className="text-sm font-medium">Margem de Lucro Bruto</span>
          </div>
          <p className={`text-2xl font-bold ${k.margem >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatBRL(k.margem)}</p>
          <p className="text-xs text-muted-foreground mt-1">{k.margemPct.toFixed(1)}% de margem</p>
        </div>
      </div>

      {/* Vendas por Vendedor */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Vendas por Vendedor</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
              <th className="text-left py-2 px-4 font-medium">Vendedor</th>
              <th className="text-right py-2 px-4 font-medium">Pedidos</th>
              <th className="text-right py-2 px-4 font-medium">Faturamento</th>
              <th className="text-right py-2 px-4 font-medium">Custo Aço</th>
              <th className="text-right py-2 px-4 font-medium">Margem</th>
              <th className="text-right py-2 px-4 font-medium">Margem %</th>
            </tr></thead>
            <tbody>
              {k.vendedores.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma venda no mês</td></tr>
              ) : k.vendedores.map(v => (
                <tr key={v.nome} className="border-b border-border hover:bg-muted/30">
                  <td className="py-2.5 px-4 font-medium">{v.nome}</td>
                  <td className="py-2.5 px-4 text-right">{v.pedidos}</td>
                  <td className="py-2.5 px-4 text-right">{formatBRL(v.faturamento)}</td>
                  <td className="py-2.5 px-4 text-right text-orange-600">{formatBRL(v.custo)}</td>
                  <td className={`py-2.5 px-4 text-right font-medium ${v.margem >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatBRL(v.margem)}</td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${v.margemPct >= 30 ? "bg-emerald-100 text-emerald-700" : v.margemPct >= 10 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{v.margemPct.toFixed(1)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Faturamento por Setor */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Building2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Faturamento por Setor</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 p-4">
          {k.setores.map(s => (
            <div key={s.nome} className={`rounded-lg p-4 border ${s.nome === "Telhas" ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
              <p className={`text-sm font-bold ${s.nome === "Telhas" ? "text-blue-700" : "text-orange-700"}`}>{s.nome}</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Faturamento:</span><span className="font-bold">{formatBRL(s.faturamento)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">KG Produzido:</span><span className="font-bold">{formatNum(s.kg)} kg</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">OPs Finalizadas:</span><span className="font-bold">{s.ops}</span></div>
              </div>
              <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${s.nome === "Telhas" ? "bg-blue-500" : "bg-orange-500"}`} style={{ width: `${Math.min(100, s.faturamento / Math.max(1, k.faturamento) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}