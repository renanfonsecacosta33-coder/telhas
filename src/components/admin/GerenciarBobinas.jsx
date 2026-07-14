import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, X, FileText, Image as ImageIcon, History, DollarSign, Weight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNum = (v) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

function BobinaDrawer({ bobina, open, onClose }) {
  const { data: historico = [] } = useQuery({
    queryKey: ["bobina-historico", bobina?.id],
    queryFn: async () => {
      if (!bobina) return [];
      const id = bobina.id;
      const [pSup, pInf, om, od] = await Promise.all([
        base44.entities.Pedido.filter({ bobina_superior_id: id }, "-created_date", 50),
        base44.entities.Pedido.filter({ bobina_inferior_id: id }, "-created_date", 50),
        base44.entities.OrdemMaquinaCD.filter({ bobina_id: id }, "-created_date", 50),
        base44.entities.OrdemDesbobinadeira.filter({ bobina_id: id }, "-created_date", 50),
      ]);
      return [...pSup.map(p => ({ ...p, _tipo: "Pedido (Sup.)", _kg: p.kg_superior || 0 })), ...pInf.filter(p => !pSup.find(ps => ps.id === p.id)).map(p => ({ ...p, _tipo: "Pedido (Inf.)", _kg: p.kg_inferior || 0 })), ...om.map(o => ({ ...o, _tipo: "Ordem CD", _kg: o.peso_kg || 0 })), ...od.map(o => ({ ...o, _tipo: "Desbobinadeira", _kg: o.kg_estimado || 0 }))].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    },
    enabled: !!bobina,
  });

  if (!bobina) return null;
  const InfoRow = ({ label, value }) => (<div className="flex justify-between py-1.5 text-sm border-b border-border/50"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right">{value || "—"}</span></div>);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4"><SheetTitle className="flex items-center gap-2"><Weight className="w-5 h-5" />{bobina.codigo || "Bobina"}</SheetTitle></SheetHeader>
        <div className="space-y-5 px-4 pb-8">
          <div><h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Informações Básicas</h4>
            <InfoRow label="Setor" value={bobina.setor === "corte_dobra" ? "Corte e Dobra" : "Telhas"} /><InfoRow label="Cor / RVM" value={bobina.cor} /><InfoRow label="Qualidade" value={bobina.qualidade} /><InfoRow label="Espessura (Chapa)" value={bobina.chapa} /><InfoRow label="Espessura Real" value={bobina.espessura_real} /><InfoRow label="Espessura Utilizada" value={bobina.espessura_utilizada} /><InfoRow label="Largura" value={bobina.largura_mm ? `${bobina.largura_mm} mm` : null} /><InfoRow label="Unidade" value={bobina.unidade} /><InfoRow label="Fornecedor" value={bobina.fornecedor} />
          </div>
          <div><h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Datas</h4>
            <InfoRow label="Recebimento" value={bobina.data_recebimento ? format(new Date(bobina.data_recebimento), "dd/MM/yyyy", { locale: ptBR }) : null} /><InfoRow label="Encerramento" value={bobina.data_encerramento ? format(new Date(bobina.data_encerramento), "dd/MM/yyyy", { locale: ptBR }) : null} /><InfoRow label="Status" value={bobina.status} /><InfoRow label="Arquivada" value={bobina.arquivada ? "Sim" : "Não"} />
          </div>
          <div><h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><Weight className="w-3 h-3" />Pesos e Metragem</h4>
            <InfoRow label="Peso Inicial" value={`${formatNum(bobina.peso_inicial)} kg`} /><InfoRow label="Peso Atual" value={`${formatNum(bobina.peso_kg)} kg`} /><InfoRow label="Metragem Total" value={bobina.metragem ? `${bobina.metragem} m` : null} /><InfoRow label="Metragem Restante" value={bobina.metragem_restante ? `${bobina.metragem_restante} m` : null} /><InfoRow label="Estoque Mínimo" value={`${formatNum(bobina.estoque_minimo_kg)} kg`} />
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${(bobina.peso_kg || 0) < (bobina.estoque_minimo_kg || 500) ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, ((bobina.peso_kg || 0) / Math.max(1, bobina.peso_inicial || bobina.peso_kg || 1)) * 100)}%` }} /></div>
          </div>
          <div><h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><DollarSign className="w-3 h-3" />Custos</h4>
            <InfoRow label="Custo por KG" value={bobina.custo ? formatBRL(bobina.custo) : null} /><InfoRow label="Custo Total" value={bobina.custo_total ? formatBRL(bobina.custo_total) : null} />
          </div>
          <div><h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><FileText className="w-3 h-3" />Documentos</h4>
            <InfoRow label="NF" value={bobina.nf} />
            {bobina.anexo_nf_url && <a href={bobina.anexo_nf_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-600 hover:underline mt-1">📄 {bobina.anexo_nf_nome || "Ver NF"}</a>}
            {bobina.anexo_cert_url && <a href={bobina.anexo_cert_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-600 hover:underline mt-1">📋 {bobina.anexo_cert_nome || "Ver Certificado"}</a>}
            {bobina.anexo_cert_ausencia && <p className="text-xs text-amber-600 mt-1">⚠️ Certificado ausente — Resp: {bobina.anexo_cert_ausencia}</p>}
          </div>
          {(bobina.foto_cor_url || bobina.foto_adicional_url) && (
            <div><h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><ImageIcon className="w-3 h-3" />Fotos Anexadas</h4>
              <div className="grid grid-cols-2 gap-2">
                {bobina.foto_cor_url && <img src={bobina.foto_cor_url} alt="Cor" className="w-full h-24 object-cover rounded-lg border border-border" />}
                {bobina.foto_adicional_url && <img src={bobina.foto_adicional_url} alt="Adicional" className="w-full h-24 object-cover rounded-lg border border-border" />}
              </div>
            </div>
          )}
          <div><h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><History className="w-3 h-3" />Histórico de OPs ({historico.length})</h4>
            <div className="space-y-1.5">
              {historico.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma OP consumiu esta bobina.</p> : historico.map(op => (
                <div key={op._tipo + op.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                  <div><p className="font-medium">#{op.numero_pedido || "—"} · {op.cliente || "—"}</p><p className="text-xs text-muted-foreground">{op._tipo} · {op.status} · {op.created_date ? format(new Date(op.created_date), "dd/MM/yyyy", { locale: ptBR }) : ""}</p></div>
                  <span className="text-xs font-bold">{formatNum(op._kg)} kg</span>
                </div>
              ))}
            </div>
          </div>
          {bobina.observacoes && <div><h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Observações</h4><p className="text-sm bg-muted/30 rounded-lg p-3">{bobina.observacoes}</p></div>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function GerenciarBobinas({ filters }) {
  const [busca, setBusca] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [selected, setSelected] = useState(null);

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["admin-gerenciar-bobinas-v2", filters.filial],
    queryFn: async () => {
      const f = { arquivada: false };
      if (filters.filial) f.unidade = filters.filial;
      return base44.entities.Bobina.filter(f, "-peso_kg", 500);
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    let d = bobinas;
    if (filtroSetor !== "todos") d = d.filter(b => b.setor === filtroSetor);
    if (busca.trim()) { const q = busca.toLowerCase().trim(); d = d.filter(b => (b.codigo || "").toLowerCase().includes(q) || (b.cor || "").toLowerCase().includes(q) || (b.chapa || "").toLowerCase().includes(q)); }
    return d;
  }, [bobinas, busca, filtroSetor]);

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const setorLabel = { todos: "Todas", telhas: "Telhas", corte_dobra: "Corte e Dobra" };

  return (
    <div className="space-y-4">
      {/* Barra de pesquisa redesenhada */}
      <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Tabs visuais de setor */}
          <div className="flex bg-muted/50 rounded-lg p-1 gap-1 flex-shrink-0">
            {["todos", "telhas", "corte_dobra"].map(f => (
              <button key={f} onClick={() => setFiltroSetor(f)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filtroSetor === f ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                {f === "todos" ? "Todas" : f === "telhas" ? "Telhas" : "Corte e Dobra"}
              </button>
            ))}
          </div>
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por código, cor ou espessura..."
              className="w-full h-10 pl-10 pr-10 rounded-lg border border-input bg-muted/30 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-all" />
            {busca && <button onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>}
          </div>
          {/* Contador */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg flex-shrink-0">
            <Weight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{filtered.length}</span>
            <span className="text-xs text-muted-foreground">bobina(s) em {setorLabel[filtroSetor]}</span>
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map(b => {
          const isCritico = (b.peso_kg || 0) < (b.estoque_minimo_kg || 500);
          return (
            <div key={b.id} onClick={() => setSelected(b)} className="bg-card border border-border rounded-xl p-3 space-y-2 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm">{b.codigo || "—"}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${b.setor === "corte_dobra" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{b.setor === "corte_dobra" ? "CD" : "Telhas"}</span>
              </div>
              <div className="text-xs space-y-0.5">
                <p>Cor: <strong>{b.cor || "—"}</strong></p>
                <p>Espessura: <strong>{b.chapa || "—"}</strong></p>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Peso Restante</span>
                  <span className={`font-bold ${isCritico ? "text-red-600" : "text-foreground"}`}>{formatNum(b.peso_kg)} kg</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${isCritico ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, ((b.peso_kg || 0) / Math.max(1, b.peso_inicial || b.peso_kg || 1)) * 100)}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{b.unidade || "—"}</p>
              </div>
              {/* Linha de Custo (Admin) */}
              <div className="border-t border-border pt-1.5 space-y-0.5 text-xs">
                <p className="flex justify-between"><span className="text-muted-foreground">💰 Custo/KG:</span><span className="font-medium">{b.custo ? `R$ ${b.custo.toFixed(2)}` : "—"}</span></p>
                <p className="flex justify-between"><span className="text-muted-foreground">📊 Custo Total:</span><span className="font-medium">{b.custo_total ? formatBRL(b.custo_total) : "—"}</span></p>
              </div>
              {/* Linha de NF e CV (Admin) */}
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="text-muted-foreground">📄 NF:</span>
                {b.anexo_nf_url ? <a href={b.anexo_nf_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline font-medium flex-1 truncate text-right">{b.nf || "Ver NF"}</a> : <span className="font-medium flex-1 text-right truncate">{b.nf || "—"}</span>}
                <span className="text-muted-foreground">|</span>
                <span className="text-muted-foreground">CV:</span>
                {b.anexo_cert_url ? (
                  <a href={b.anexo_cert_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline font-medium flex items-center gap-0.5">Ver Cert.</a>
                ) : b.anexo_cert_ausencia ? (
                  <span className="text-amber-600 font-medium" title={`Declarado por: ${b.anexo_cert_ausencia}`}>Sem CV</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BobinaDrawer bobina={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}