import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";

export default function VendedorSlitter({ vendedorNome }) {
  const [search, setSearch] = useState("");
  const [filtroQualidade, setFiltroQualidade] = useState(null);

  const { data: slitters = [], isLoading } = useQuery({
    queryKey: ["slitters-vendedor"],
    queryFn: () => base44.entities.Slitter.list(),
  });

  const ativas = slitters.filter(s => s.status !== "arquivado");

  const qualidadesUnicas = [...new Set(ativas.map(s => s.qualidade).filter(Boolean))].sort();

  const filtered = ativas
    .filter(s => {
      if (filtroQualidade && s.qualidade !== filtroQualidade) return false;
      const q = search.toLowerCase();
      return s.codigo?.toLowerCase().includes(q) ||
        s.nf?.toLowerCase().includes(q) ||
        s.qualidade?.toLowerCase().includes(q) ||
        s.materiais_producao?.toLowerCase().includes(q) ||
        String(s.largura_mm || "").includes(q) ||
        String(s.espessura_mm || "").includes(q) ||
        String(s.peso_kg || "").includes(q);
    })
    .sort((a, b) => (a.codigo || "").localeCompare(b.codigo || "", undefined, { numeric: true }));

  const fmtKg = (v) => v ? `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "-";

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Slitters em estoque</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-primary">{ativas.length}</span>
          <span className="text-xs text-muted-foreground">
            ({ativas.reduce((s, sl) => s + (sl.peso_kg || 0), 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg)
          </span>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, qualidade, espessura..."
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
        <div className="text-center py-12 text-muted-foreground text-sm">Nenhum slitter disponível encontrado.</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                <th className="text-left px-2 py-2 whitespace-nowrap">Código</th>
                <th className="text-left px-2 py-2 whitespace-nowrap">Qual.</th>
                <th className="text-right px-2 py-2 whitespace-nowrap">Espessura</th>
                <th className="text-right px-2 py-2 whitespace-nowrap">Largura</th>
                <th className="text-right px-2 py-2 whitespace-nowrap">Peso</th>
                <th className="text-left px-2 py-2 whitespace-nowrap">Mat. Produção</th>
                <th className="text-left px-2 py-2 whitespace-nowrap">NF</th>
                <th className="text-left px-2 py-2 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-2 py-2 font-medium whitespace-nowrap">{s.codigo || "-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{s.qualidade || "-"}</span>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{s.espessura_mm ? `${s.espessura_mm} mm` : "-"}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{s.largura_mm ? `${s.largura_mm} mm` : "-"}</td>
                  <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{fmtKg(s.peso_kg)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{s.materiais_producao || "-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{s.nf || "-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                      {s.status || "Disponível"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Slitters são bobinas slitadas (menor largura) usadas na perfiladeira e outros equipamentos.
      </p>
    </div>
  );
}