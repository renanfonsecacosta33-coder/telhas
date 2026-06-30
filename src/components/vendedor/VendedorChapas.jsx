import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Filter, ShieldCheck } from "lucide-react";

export default function VendedorChapas({ vendedorNome }) {
  const [search, setSearch] = useState("");
  const [filtroQualidade, setFiltroQualidade] = useState(null);

  const { data: chapas = [], isLoading } = useQuery({
    queryKey: ["chapas-vendedor"],
    queryFn: () => base44.entities.ChapaCD.filter({ status: { $ne: "cancelado" } }),
  });

  const ativas = chapas.filter(c => c.status !== "consumido" && (c.quantidade_disponivel ?? 0) > 0);

  const qualidadesUnicas = [...new Set(chapas.map(c => c.qualidade).filter(Boolean))].sort();

  const filtered = ativas
    .filter(c => {
      if (filtroQualidade && c.qualidade !== filtroQualidade) return false;
      const q = search.toLowerCase();
      return c.codigo?.toLowerCase().includes(q) ||
        c.material?.toLowerCase().includes(q) ||
        c.qualidade?.toLowerCase().includes(q) ||
        c.bobina_descricao?.toLowerCase().includes(q) ||
        String(c.comprimento_mm || "").includes(q) ||
        String(c.largura_mm || "").includes(q) ||
        String(c.espessura_mm || "").includes(q);
    })
    .sort((a, b) => (a.codigo || "").localeCompare(b.codigo || "", undefined, { numeric: true }));

  const fmtKg = (v) => v ? `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "-";

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Chapas em estoque</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary">{ativas.length}</span>
          <span className="text-xs text-muted-foreground">({ativas.filter(c => !c.reservada).length} disponíveis)</span>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, material, espessura..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filtros por qualidade */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <button
          onClick={() => setFiltroQualidade(null)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
            !filtroQualidade
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          Todas
        </button>
        {qualidadesUnicas.map(q => (
          <button
            key={q}
            onClick={() => setFiltroQualidade(filtroQualidade === q ? null : q)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
              filtroQualidade === q
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma chapa disponível encontrada.</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                <th className="text-left px-2 py-2 whitespace-nowrap">Código</th>
                <th className="text-left px-2 py-2 whitespace-nowrap">Qual.</th>
                <th className="text-left px-2 py-2 whitespace-nowrap">Material</th>
                <th className="text-right px-2 py-2 whitespace-nowrap">Espessura</th>
                <th className="text-right px-2 py-2 whitespace-nowrap">Comp.</th>
                <th className="text-right px-2 py-2 whitespace-nowrap">Largura</th>
                <th className="text-right px-2 py-2 whitespace-nowrap">Qtd. Disp.</th>
                <th className="text-right px-2 py-2 whitespace-nowrap">Peso</th>
                <th className="text-left px-2 py-2 whitespace-nowrap">Status</th>
                <th className="text-center px-2 py-2 whitespace-nowrap">Cert.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.id} className={`transition-colors ${c.reservada ? "bg-amber-50/60 hover:bg-amber-100/70" : "hover:bg-muted/20"}`}>
                  <td className="px-2 py-2 font-medium whitespace-nowrap">
                    {c.codigo || "-"}
                    {c.reservada && (
                      <span className="ml-1.5 text-[10px] font-semibold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">Reservada</span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{c.qualidade || "-"}</span>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{c.material || "-"}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{c.espessura_mm ? `${c.espessura_mm} mm` : "-"}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{c.comprimento_mm ? `${c.comprimento_mm} mm` : "-"}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{c.largura_mm ? `${c.largura_mm} mm` : "-"}</td>
                  <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{c.quantidade_disponivel ?? 0}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{fmtKg(c.peso_kg)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {c.reservada ? (
                      <span className="text-xs font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded">Reservada</span>
                    ) : c.status === "parcial" ? (
                      <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Parcial</span>
                    ) : (
                      <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Disponível</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {c.anexo_cf_url ? (
                      <a href={c.anexo_cf_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors"
                        title="Ver certificado">
                        <ShieldCheck className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Chapas são geradas pela desbobinadeira. Chapas reservadas aparecem em destaque (fundo amarelo).
      </p>
    </div>
  );
}