import React from "react";
import { Scissors, Ruler, Palette, Layers, Package, Gauge } from "lucide-react";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";

// Destaque GIGANTE da instrução de corte do vendedor (descrição da linha Odoo)
// + especificação extraída (qtd, comprimento, cor, espessura, metragem).
export default function InstrucaoVendedorCard({ descricao, quantidadeOdoo, espessura, unidade = "MT", compact = false }) {
  const desc = descricao || "";
  const esp = extrairEspecificacao(desc);

  return (
    <div className="rounded-xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Scissors className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Instrução de Corte do Vendedor
        </span>
      </div>

      <p className={`font-extrabold text-slate-900 dark:text-white leading-snug break-words ${compact ? "text-sm" : "text-base sm:text-lg"}`}>
        {desc || "—"}
      </p>

      {(esp.quantidade || esp.comprimento_m || esp.cor || espessura) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {esp.quantidade != null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
              <Package className="w-3 h-3" /> {esp.quantidade} peças
            </span>
          )}
          {esp.comprimento_m != null && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-600 text-white">
              <Ruler className="w-3 h-3" /> {esp.comprimento_m}m ({esp.comprimento_mm}mm)
            </span>
          )}
          {esp.cor && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-600 text-white">
              <Palette className="w-3 h-3" /> {esp.cor}
            </span>
          )}
          {espessura && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-500 text-white">
              <Layers className="w-3 h-3" /> Chapa {espessura}mm
            </span>
          )}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-amber-300/60 dark:border-amber-700/40 space-y-1">
        {esp.metragem_total != null && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Detalhamento
            </span>
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              {esp.quantidade} × {esp.comprimento_m}m = {esp.metragem_total}m
            </span>
          </div>
        )}
        {unidade === "MT" && quantidadeOdoo != null && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase">
              Metragem Total Odoo
            </span>
            <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
              {quantidadeOdoo} MT
            </span>
          </div>
        )}
      </div>
    </div>
  );
}