import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ShoppingCart, CheckCircle2, Link2, Loader2, PackageX, Search, X } from "lucide-react";
import { toast } from "sonner";

const norm = (s) => (s || "").toString().toLowerCase().replace(/[.,\s]/g, "").trim();

function findCompatibleBobina(op, bobinas, setor) {
  return bobinas.find(b => !b.arquivada && b.setor === setor && (b.peso_kg || 0) > 0 && norm(b.chapa).includes(norm(op.material_espessura)) && (!op.material_cor || norm(b.cor).includes(norm(op.material_cor))));
}

export default function AlertasEstoqueCritico({ filters }) {
  const [filtro, setFiltro] = useState("todos");
  const [filtroEspessura, setFiltroEspessura] = useState("");
  const [busca, setBusca] = useState("");
  const [vinculando, setVinculando] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-estoque-critico-v3", filters.filial],
    queryFn: async () => {
      const bobinaF = { arquivada: false };
      if (filters.filial) bobinaF.unidade = filters.filial;
      const opsF = { status: "aguardando_material" };
      if (filters.filial) opsF.unidade = filters.filial;

      const [bobinas, pSemMat, omSemMat, odSemMat] = await Promise.all([
        base44.entities.Bobina.filter(bobinaF, "-peso_kg", 500),
        base44.entities.Pedido.filter(opsF, "-created_date", 50),
        base44.entities.OrdemMaquinaCD.filter(opsF, "-created_date", 50),
        base44.entities.OrdemDesbobinadeira.filter(opsF, "-created_date", 50),
      ]);

      const criticas = bobinas.filter(b => (b.peso_kg || 0) < (b.estoque_minimo_kg || 500));
      const opsSemMat = [...pSemMat.map(o => ({ ...o, _entity: "Pedido", _setor: "telhas" })), ...omSemMat.map(o => ({ ...o, _entity: "OrdemMaquinaCD", _setor: "corte_dobra" })), ...odSemMat.map(o => ({ ...o, _entity: "OrdemDesbobinadeira", _setor: "corte_dobra" }))]
        .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)).slice(0, 10)
        .map(op => ({ ...op, _compativel: findCompatibleBobina(op, bobinas, op._setor) }));

      return { criticas, opsSemMat, espessuras: [...new Set(bobinas.map(b => b.chapa).filter(Boolean))].sort() };
    },
    refetchInterval: 30000,
  });

  const handleVincular = async (op, bobina) => {
    setVinculando(op.id);
    try {
      const desc = `${bobina.codigo || ""} · ${bobina.cor || ""} · ${bobina.chapa || ""}`;
      const update = { status: "pendente", material_em_falta: false };
      if (op._entity === "Pedido") { update.bobina_superior_id = bobina.id; update.bobina_superior = desc; }
      else { update.bobina_id = bobina.id; update.bobina_descricao = desc; if (op._entity === "OrdemDesbobinadeira") update.espessura_utilizada = bobina.chapa; }
      await base44.entities[op._entity].update(op.id, update);
      toast.success("OP vinculada e liberada para produção!");
      queryClient.invalidateQueries({ queryKey: ["admin-estoque-critico-v3"] });
    } catch (e) { toast.error("Erro ao vincular: " + (e.message || e)); }
    setVinculando(null);
  };

  const criticasFiltered = useMemo(() => {
    let d = data?.criticas || [];
    if (filtro !== "todos") d = d.filter(b => b.setor === filtro);
    if (filtroEspessura) d = d.filter(b => b.chapa === filtroEspessura);
    if (busca.trim()) { const q = busca.toLowerCase().trim(); d = d.filter(b => (b.codigo || "").toLowerCase().includes(q) || (b.cor || "").toLowerCase().includes(q) || (b.cliente || "").toLowerCase().includes(q)); }
    return d;
  }, [data, filtro, filtroEspessura, busca]);

  const opsTelhas = (data?.opsSemMat || []).filter(o => o._setor === "telhas");
  const opsCD = (data?.opsSemMat || []).filter(o => o._setor === "corte_dobra");

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          {["todos", "telhas", "corte_dobra"].map(f => (
            <button key={f} onClick={() => setFiltro(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtro === f ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"}`}>{f === "todos" ? "Todos" : f === "telhas" ? "Telhas" : "Corte e Dobra"}</button>
          ))}
        </div>
        <select value={filtroEspessura} onChange={e => setFiltroEspessura(e.target.value)} className="h-9 text-sm rounded-md border border-input bg-transparent px-2 cursor-pointer">
          <option value="">Todas Espessuras</option>
          {(data?.espessuras || []).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por código, cor ou cliente..." className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          {busca && <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {/* Estoque Crítico */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border"><AlertTriangle className="w-4 h-4 text-red-500" /><h3 className="text-sm font-bold">Bobinas Críticas ({criticasFiltered.length})</h3></div>
        {criticasFiltered.length === 0 ? <div className="p-8 text-center text-muted-foreground"><CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />Nenhuma bobina crítica.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-4 font-medium">Código</th><th className="text-left py-2 px-4 font-medium">Especificação</th><th className="text-left py-2 px-4 font-medium">Cor</th><th className="text-left py-2 px-4 font-medium">Espessura</th><th className="text-right py-2 px-4 font-medium">Peso Atual (KG)</th><th className="text-left py-2 px-4 font-medium">Setor</th><th className="text-center py-2 px-4 font-medium">Ação</th>
              </tr></thead>
              <tbody>
                {criticasFiltered.map(b => (
                  <tr key={b.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-2.5 px-4 font-mono font-bold">{b.codigo || "—"}</td>
                    <td className="py-2.5 px-4">{b.qualidade || "—"} · {b.largura_mm || "—"}mm</td>
                    <td className="py-2.5 px-4">{b.cor || "—"}</td><td className="py-2.5 px-4">{b.chapa || "—"}</td>
                    <td className="py-2.5 px-4 text-right"><span className="text-red-600 font-bold">{(b.peso_kg || 0).toFixed(0)}</span><span className="text-muted-foreground text-xs"> / {b.estoque_minimo_kg || 500}</span></td>
                    <td className="py-2.5 px-4">{b.setor === "corte_dobra" ? "CD" : "Telhas"}</td>
                    <td className="py-2.5 px-4 text-center"><button onClick={() => toast.success(`Solicitação de compra gerada para ${b.codigo}`, { duration: 6000 })} className="flex items-center gap-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1.5 transition-colors mx-auto"><ShoppingCart className="w-3 h-3" /> Comprar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pedidos Sem Material — Duas Colunas */}
      <div>
        <div className="flex items-center gap-2 mb-3"><PackageX className="w-4 h-4 text-amber-500" /><h3 className="text-sm font-bold">Pedidos Aguardando Matéria-Prima (Máx. 10 recentes)</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Telhas */}
          <div className="bg-card border border-blue-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-blue-200 bg-blue-50"><h4 className="text-sm font-bold text-blue-700">🏠 Telhas ({opsTelhas.length})</h4></div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {opsTelhas.length === 0 ? <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma OP aguardando.</p> :
                opsTelhas.map(op => (
                  <div key={op.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between"><span className="font-mono font-bold text-sm">#{op.numero_pedido || "—"}</span><span className="text-xs text-muted-foreground">{op.cliente || "—"}</span></div>
                    <div className="flex items-center gap-2 text-xs"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Esp: {op.material_espessura || "—"}</span><span className="bg-muted px-2 py-0.5 rounded">Cor: {op.material_cor || "—"}</span></div>
                    {op._compativel ? <button onClick={() => handleVincular(op, op._compativel)} disabled={vinculando === op.id} className="flex items-center gap-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-50">{vinculando === op.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Vincular: {op._compativel.codigo}</button> : <span className="text-xs text-red-500 font-medium">Sem bobina compatível</span>}
                  </div>
                ))
              }
            </div>
          </div>
          {/* Corte e Dobra */}
          <div className="bg-card border border-orange-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-orange-200 bg-orange-50"><h4 className="text-sm font-bold text-orange-700">✂️ Corte e Dobra ({opsCD.length})</h4></div>
            <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
              {opsCD.length === 0 ? <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma OP aguardando.</p> :
                opsCD.map(op => (
                  <div key={op._entity + op.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between"><span className="font-mono font-bold text-sm">#{op.numero_pedido || "—"}</span><span className="text-xs text-muted-foreground">{op.cliente || "—"}</span></div>
                    <div className="flex items-center gap-2 text-xs"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Esp: {op.material_espessura || "—"}</span><span className="bg-muted px-2 py-0.5 rounded">Cor: {op.material_cor || "—"}</span></div>
                    {op._compativel ? <button onClick={() => handleVincular(op, op._compativel)} disabled={vinculando === op.id} className="flex items-center gap-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-50">{vinculando === op.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Vincular: {op._compativel.codigo}</button> : <span className="text-xs text-red-500 font-medium">Sem bobina compatível</span>}
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}