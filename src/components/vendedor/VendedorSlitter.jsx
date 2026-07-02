import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Filter, BookmarkPlus } from "lucide-react";
import SolicitarReservaDialog from "@/components/vendedor/SolicitarReservaDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";

export default function VendedorSlitter({ vendedorNome }) {
  const qc = useQueryClient();
  const { filialAtiva } = useFilial();
  const [search, setSearch] = useState("");
  const [filtroQualidade, setFiltroQualidade] = useState(null);
  const [solicitarItem, setSolicitarItem] = useState(null);

  const { data: slitters = [], isLoading } = useQuery({
    queryKey: ["slitters-vendedor", filialAtiva],
    queryFn: () => base44.entities.Slitter.filter({ unidade: filialAtiva }),
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

  const getPesoReservadoSlitter = (s) => {
    const peso = s.peso_kg || 0;
    if (!s.reservada) return 0;
    return s.reserva_tipo === "parcial" ? (s.reserva_kg || 0) : peso;
  };
  const getPesoDisponivelSlitter = (s) => (s.peso_kg || 0) - getPesoReservadoSlitter(s);
  const fmtKg = (v) => v ? `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "-";
  const fmtNum = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const totalKg = ativas.reduce((s, sl) => s + (sl.peso_kg || 0), 0);
  const totalReservadoKg = ativas.reduce((s, sl) => s + getPesoReservadoSlitter(sl), 0);
  const totalDisponivelKg = totalKg - totalReservadoKg;

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Slitters em estoque</span>
          <span className="text-2xl font-bold text-primary">{ativas.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">KG Disponível</span>
            <span className="text-sm font-bold text-emerald-700">{fmtNum(totalDisponivelKg)} kg</span>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">KG Reservado</span>
            <span className="text-sm font-bold text-amber-700">{fmtNum(totalReservadoKg)} kg</span>
          </div>
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
                <th className="px-2 py-2"></th>
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
                    {s.reservada ? (
                      <span className="text-xs font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded">Reservada</span>
                    ) : (
                      <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{s.status || "Disponível"}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {getPesoDisponivelSlitter(s) > 0 ? (
                      <button onClick={() => setSolicitarItem(s)} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors" title="Solicitar reserva">
                        <BookmarkPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Reservar</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">Já reservado</span>
                    )}
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

      <SolicitarReservaDialog
        open={!!solicitarItem}
        onClose={() => { setSolicitarItem(null); qc.invalidateQueries({ queryKey: ["slitters-vendedor"] }); }}
        item={solicitarItem}
        itemTipo="slitter"
        itemLabel={solicitarItem ? `${solicitarItem.codigo || "-"} — ${solicitarItem.qualidade || "?"} — ${solicitarItem.espessura_mm || "?"}mm — ${solicitarItem.largura_mm || "?"}mm` : ""}
        vendedorNome={vendedorNome}
        setor="corte_dobra"
      />
    </div>
  );
}