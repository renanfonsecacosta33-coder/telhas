import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DollarSign, TrendingUp, TrendingDown, Package } from "lucide-react";

const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function KpiFinanceiro() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${year}-${month}-01`;
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const { data, isLoading } = useQuery({
    queryKey: ["admin-kpi-financeiro", monthStart],
    queryFn: async () => {
      const [ordensMaq, ordensDesb, pedidos, bobinas] = await Promise.all([
        base44.entities.OrdemMaquinaCD.filter({ status: "finalizado", data_finalizacao: { $gte: monthStart, $lte: monthEnd } }, "-data_finalizacao", 500),
        base44.entities.OrdemDesbobinadeira.filter({ status: "finalizado", data_finalizacao: { $gte: monthStart, $lte: monthEnd } }, "-data_finalizacao", 500),
        base44.entities.Pedido.filter({ status: "finalizado", data_finalizacao: { $gte: monthStart, $lte: monthEnd } }, "-data_finalizacao", 500),
        base44.entities.Bobina.list("-created_date", 500),
      ]);

      const bobinaMap = {};
      bobinas.forEach(b => { bobinaMap[b.id] = b; });

      const faturamento =
        ordensMaq.reduce((s, o) => s + (o.valor_pago_cliente || 0), 0) +
        ordensDesb.reduce((s, o) => s + (o.valor_pago_cliente || 0), 0);

      let custo = 0;
      ordensDesb.forEach(o => {
        const bobina = bobinaMap[o.bobina_id];
        if (bobina?.custo && o.kg_estimado) custo += o.kg_estimado * bobina.custo;
      });
      ordensMaq.forEach(o => {
        if (o.bobina_id && o.peso_kg) {
          const bobina = bobinaMap[o.bobina_id];
          if (bobina?.custo) custo += o.peso_kg * bobina.custo;
        }
      });
      pedidos.forEach(p => {
        const kgSup = p.kg_superior || 0;
        const kgInf = p.kg_inferior || 0;
        const custoSup = bobinaMap[p.bobina_superior_id]?.custo || 0;
        const custoInf = bobinaMap[p.bobina_inferior_id]?.custo || 0;
        custo += (kgSup * custoSup) + (kgInf * custoInf);
      });

      const margem = faturamento - custo;
      const margemPct = faturamento > 0 ? (margem / faturamento) * 100 : 0;

      return { faturamento, custo, margem, margemPct, totalOPs: ordensMaq.length + ordensDesb.length + pedidos.length };
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const k = data || { faturamento: 0, custo: 0, margem: 0, margemPct: 0, totalOPs: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <DollarSign className="w-5 h-5" />
            <span className="text-sm font-medium">Faturamento Estimado</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatBRL(k.faturamento)}</p>
          <p className="text-xs text-muted-foreground mt-1">{k.totalOPs} OPs finalizadas no mês</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <Package className="w-5 h-5" />
            <span className="text-sm font-medium">Custo de Matéria-Prima</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatBRL(k.custo)}</p>
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
    </div>
  );
}