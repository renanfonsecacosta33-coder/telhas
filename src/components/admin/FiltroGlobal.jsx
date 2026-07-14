import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const FILIAIS = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];

export default function FiltroGlobal({ filters, setFilters }) {
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-global"],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo: "vendedor", ativo: true }),
  });

  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];

  const setShortcut = (s) => {
    let start, end;
    if (s === "hoje") { start = end = fmt(today); }
    else if (s === "ontem") { const y = new Date(today); y.setDate(y.getDate() - 1); start = end = fmt(y); }
    else if (s === "7dias") { const w = new Date(today); w.setDate(w.getDate() - 6); start = fmt(w); end = fmt(today); }
    else if (s === "mes") { start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`; end = fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)); }
    else if (s === "mes_ant") { const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1); start = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}-01`; end = fmt(new Date(lm.getFullYear(), lm.getMonth() + 1, 0)); }
    setFilters(prev => ({ ...prev, dataInicial: start, dataFinal: end }));
  };

  const update = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
      <div className="flex gap-1 flex-wrap">
        {[{ k: "hoje", l: "Hoje" }, { k: "ontem", l: "Ontem" }, { k: "7dias", l: "7 dias" }, { k: "mes", l: "Este Mês" }, { k: "mes_ant", l: "Mês Ant." }].map(s => (
          <button key={s.k} onClick={() => setShortcut(s.k)} className="px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted hover:border-primary/50 transition-colors">{s.l}</button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input type="date" value={filters.dataInicial} onChange={e => update("dataInicial", e.target.value)} className="h-8 text-xs rounded-md border border-input bg-transparent px-2" />
        <span className="text-xs text-muted-foreground">→</span>
        <input type="date" value={filters.dataFinal} onChange={e => update("dataFinal", e.target.value)} className="h-8 text-xs rounded-md border border-input bg-transparent px-2" />
      </div>
      <select value={filters.filial} onChange={e => update("filial", e.target.value)} className="h-8 text-xs rounded-md border border-input bg-transparent px-2 cursor-pointer">
        <option value="">🏛️ Todas as Filiais</option>
        {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <select value={filters.vendedor} onChange={e => update("vendedor", e.target.value)} className="h-8 text-xs rounded-md border border-input bg-transparent px-2 cursor-pointer">
        <option value="">👤 Todos Vendedores</option>
        {vendedores.map(v => <option key={v.id} value={v.valor}>{v.valor}</option>)}
      </select>
    </div>
  );
}