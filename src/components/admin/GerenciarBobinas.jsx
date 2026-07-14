import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, X, Package, FileText, Image as ImageIcon, History, DollarSign, Weight } from "lucide-react";
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
      return [
        ...pSup.map(p => ({ ...p, _tipo: "Pedido (Sup.)", _kg: p.kg_superior || 0 })),
        ...pInf.filter(p => !pSup.find(ps => ps.id === p.id)).map(p => ({ ...p, _tipo: "Pedido (Inf.)", _kg: p.kg_inferior || 0 })),
        ...om.map(o => ({ ...o, _tipo: "Ordem CD", _kg: o.peso_kg || 0 })),
        ...od.map(o => ({ ...o, _tipo: "Desbobinadeira", _kg: o.kg_estimado || 0 })),
      ].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    },
    enabled: !!bobina,
  });

  if (!bobina) return null;

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between py-1.5 text-sm border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2"><Package className="w-5 h-5" />{bobina.codigo || "Bobina"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          {/* Info Básica */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Informações Básicas</h4>
            <InfoRow label="Setor" value={bobina.setor === "corte_dobra" ? "Corte e Dobra" : "Telhas"} />
            <InfoRow label="Cor / RVM" value={bobina.cor} />
            <InfoRow label="Qualidade" value={bobina.qualidade} />
            <InfoRow label="Espessura (Chapa)" value={bobina.chapa} />
            <InfoRow label="Espessura Real" value={bobina.espessura_real} />
            <InfoRow label="Espessura Utilizada" value={bobina.espessura_utilizada} />
            <InfoRow label="Largura" value={bobina.largura_mm ? `${bobina.largura_mm} mm` : null} />
            <InfoRow label="Unidade" value={bobina.unidade} />
            <InfoRow label="Fornecedor" value={bobina.fornecedor} />
          </div>

          {/* Datas */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Datas</h4>
            <InfoRow label="Recebimento" value={bobina.data_recebimento ? format(new Date(bobina.data_recebimento), "dd/MM/yyyy", { locale: ptBR }) : null} />
            <InfoRow label="Encerramento" value={bobina.data_encerramento ? format(new Date(bobina.data_encerramento), "dd/MM/yyyy", { locale: ptBR }) : null} />
            <InfoRow label="Status" value={bobina.status} />
            <InfoRow label="Arquivada" value={bobina.arquivada ? "Sim" : "Não"} />
          </div>

          {/* Pesos */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><Weight className="w-3 h-3" />Pesos e Metragem</h4>
            <InfoRow label="Peso Inicial" value={`${formatNum(bobina.peso_inicial)} kg`} />
            <InfoRow label="Peso Atual" value={`${formatNum(bobina.peso_kg)} kg`} />
            <InfoRow label="Metragem Total" value={bobina.metragem ? `${bobina.metragem} m` : null} />
            <InfoRow label="Metragem Restante" value={bobina.metragem_restante ? `${bobina.metragem_restante} m` : null} />
            <InfoRow label="Estoque Mínimo" value={`${formatNum(bobina.estoque_minimo_kg)} kg`} />
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${(bobina.peso_kg || 0) < (bobina.estoque_minimo_kg || 500) ? "bg-red-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, ((bobina.peso_kg || 0) / Math.max(1, bobina.peso_inicial || bobina.peso_kg || 1)) * 100)}%` }} />
            </div>
          </div>

          {/* Custos */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><DollarSign className="w-3 h-3" />Custos</h4>
            <InfoRow label="Custo por KG" value={bobina.custo ? formatBRL(bobina.custo) : null} />
            <InfoRow label="Custo Total" value={bobina.custo_total ? formatBRL(bobina.custo_total) : null} />
          </div>

          {/* Documentos */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><FileText className="w-3 h-3" />Documentos</h4>
            <InfoRow label="NF" value={bobina.nf} />
            {bobina.anexo_nf_url && <a href={bobina.anexo_nf_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-600 hover:underline mt-1">📄 {bobina.anexo_nf_nome || "Ver NF"}</a>}
            {bobina.anexo_cert_url && <a href={bobina.anexo_cert_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-blue-600 hover:underline mt-1">📋 {bobina.anexo_cert_nome || "Ver Certificado"}</a>}
            {bobina.anexo_cert_ausencia && <p className="text-xs text-amber-600 mt-1">⚠️ Certificado ausente — Resp: {bobina.anexo_cert_ausencia}</p>}
          </div>

          {/* Fotos */}
          {(bobina.foto_cor_url || bobina.foto_adicional_url) && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><ImageIcon className="w-3 h-3" />Fotos Anexadas</h4>
              <div className="grid grid-cols-2 gap-2">
                {bobina.foto_cor_url && <img src={bobina.foto_cor_url} alt="Cor" className="w-full h-24 object-cover rounded-lg border border-border" />}
                {bobina.foto_adicional_url && <img src={bobina.foto_adicional_url} alt="Adicional" className="w-full h-24 object-cover rounded-lg border border-border" />}
              </div>
            </div>
          )}

          {/* Histórico de OPs */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1"><History className="w-3 h-3" />Histórico de OPs ({historico.length})</h4>
            <div className="space-y-1.5">
              {historico.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma OP consumiu esta bobina.</p> :
                historico.map(op => (
                  <div key={op._tipo + op.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                    <div>
                      <p className="font-medium">#{op.numero_pedido || "—"} · {op.cliente || "—"}</p>
                      <p className="text-xs text-muted-foreground">{op._tipo} · {op.status} · {op.created_date ? format(new Date(op.created_date), "dd/MM/yyyy", { locale: ptBR }) : ""}</p>
                    </div>
                    <span className="text-xs font-bold">{formatNum(op._kg)} kg</span>
                  </div>
                ))
              }
            </div>
          </div>

          {bobina.observacoes && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Observações</h4>
              <p className="text-sm bg-muted/30 rounded-lg p-3">{bobina.observacoes}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function GerenciarBobinas() {
  const [busca, setBusca] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [selected, setSelected] = useState(null);

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["admin-gerenciar-bobinas"],
    queryFn: () => base44.entities.Bobina.list("-peso_kg", 500),
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    let d = bobinas.filter(b => !b.arquivada);
    if (filtroSetor !== "todos") d = d.filter(b => b.setor === filtroSetor);
    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      d = d.filter(b => (b.codigo || "").toLowerCase().includes(q) || (b.cor || "").toLowerCase().includes(q) || (b.chapa || "").toLowerCase().includes(q));
    }
    return d;
  }, [bobinas, busca, filtroSetor]);

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {["todos", "telhas", "corte_dobra"].map(f => (
            <button key={f} onClick={() => setFiltroSetor(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroSetor === f ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"}`}>
              {f === "todos" ? "Todos" : f === "telhas" ? "Telhas" : "Corte e Dobra"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por código, cor, espessura..."
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          {busca && <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} bobina(s)</span>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
              <th className="text-left py-2 px-4 font-medium">Código</th>
              <th className="text-left py-2 px-4 font-medium">Setor</th>
              <th className="text-left py-2 px-4 font-medium">Cor</th>
              <th className="text-left py-2 px-4 font-medium">Espessura</th>
              <th className="text-left py-2 px-4 font-medium">Qualidade</th>
              <th className="text-right py-2 px-4 font-medium">Peso Atual</th>
              <th className="text-right py-2 px-4 font-medium">Peso Inicial</th>
              <th className="text-left py-2 px-4 font-medium">Unidade</th>
            </tr></thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} onClick={() => setSelected(b)} className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold">{b.codigo || "—"}</td>
                  <td className="py-2.5 px-4"><span className={`text-xs px-2 py-0.5 rounded ${b.setor === "corte_dobra" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{b.setor === "corte_dobra" ? "CD" : "Telhas"}</span></td>
                  <td className="py-2.5 px-4">{b.cor || "—"}</td>
                  <td className="py-2.5 px-4">{b.chapa || "—"}</td>
                  <td className="py-2.5 px-4">{b.qualidade || "—"}</td>
                  <td className="py-2.5 px-4 text-right">
                    <span className={`font-bold ${(b.peso_kg || 0) < (b.estoque_minimo_kg || 500) ? "text-red-600" : "text-foreground"}`}>{formatNum(b.peso_kg)} kg</span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-muted-foreground">{formatNum(b.peso_inicial)} kg</td>
                  <td className="py-2.5 px-4 text-xs">{b.unidade || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BobinaDrawer bobina={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}