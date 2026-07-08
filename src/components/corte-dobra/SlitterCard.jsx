import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3, ChevronDown, FileText, Pencil, Trash2, Weight, Ruler, ScrollText
} from "lucide-react";
import ImageLink from "@/components/ui/ImageLink";

const DENSIDADE_ACO = 7850; // kg/m³

const qualidadeColors = {
  "GV": "bg-blue-100 text-blue-800",
  "FF": "bg-emerald-100 text-emerald-800",
  "PP": "bg-amber-100 text-amber-800",
  "FQ": "bg-violet-100 text-violet-800",
  "GL (IMP)": "bg-rose-100 text-rose-800",
};

const statusConfig = {
  disponivel: { label: "Disponível", color: "bg-emerald-100 text-emerald-700" },
  em_uso: { label: "Em Uso", color: "bg-blue-100 text-blue-700" },
  consumido: { label: "Consumido", color: "bg-gray-100 text-gray-600" },
  arquivado: { label: "Arquivado", color: "bg-orange-100 text-orange-700" },
};

function parseMateriais(raw) {
  if (!raw) return [];
  return raw.split("/").map(m => m.trim()).filter(Boolean);
}

const COMPRIMENTO_BARRA_MM = 6000; // barra de 6m

function calcularBarras(pesoKg, larguraMm, espessuraMm) {
  // Peso por metro linear da fita slitter:
  // largura(m) x espessura(m) x densidade(7850 kg/m³)
  const kgPorMetro = (larguraMm / 1000) * (espessuraMm / 1000) * 7850;

  // Peso de cada peça (barra de 6m)
  const kgPorBarra = kgPorMetro * (COMPRIMENTO_BARRA_MM / 1000);

  // Quantidade de peças: peso total da bobina / peso de cada barra
  const barras = kgPorBarra > 0 ? Math.floor(pesoKg / kgPorBarra) : 0;

  return { barras, kgPorBarra, kgPorMetro };
}

export default function SlitterCard({ slitter, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const materiais = parseMateriais(slitter.materiais_producao);
  const temExpandir = materiais.length > 0 || !!(slitter.anexo_nf_url || slitter.observacoes);

  // Cálculo básico (sempre visível no expandir)
  const largM = (slitter.largura_mm || 0) / 1000;
  const espM = (slitter.espessura_mm || 0) / 1000;
  const kgPorMetro = largM * espM * 7850;
  const kgPorBarraBase = kgPorMetro * 6;
  const totalBarras = kgPorBarraBase > 0 ? Math.floor((slitter.peso_kg || 0) / kgPorBarraBase) : 0;

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-lg">{slitter.codigo}</span>
            <Badge className={qualidadeColors[slitter.qualidade] || "bg-gray-100 text-gray-800"}>
              {slitter.qualidade}
            </Badge>
            <Badge className="bg-gray-100 text-gray-700">
              {slitter.status || "Disponível"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {slitter.data && <span>{new Date(slitter.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
            {slitter.nf && <span className="font-semibold text-foreground">NF: {slitter.nf}</span>}
          </div>
        </div>

        {/* Métricas */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <Weight className="w-4 h-4 text-slate-400 mx-auto mb-0.5" />
            <p className="text-xl font-bold">{slitter.peso_kg?.toLocaleString("pt-BR")} kg</p>
          </div>
          <div className="text-center">
            <Ruler className="w-4 h-4 text-slate-400 mx-auto mb-0.5" />
            <p className="text-xl font-bold">{slitter.largura_mm} mm</p>
            <p className="text-xs text-muted-foreground">× {slitter.espessura_mm} mm</p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {slitter.anexo_nf_url && (
            <ImageLink url={slitter.anexo_nf_url} name={slitter.anexo_nf_nome}
              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors" title="Ver NF">
              <FileText className="w-4 h-4" />
            </ImageLink>
          )}
          <Button variant="ghost" size="icon" onClick={() => onEdit(slitter)} className="h-8 w-8">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(slitter)} className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {temExpandir && (
            <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)} className="h-8 w-8">
              <ChevronDown className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")} />
            </Button>
          )}
        </div>
      </div>

      {/* Expandido */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-slate-50/50">
          {/* Cálculo + Materiais de produção */}
          {materiais.length > 0 && (
            <>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Cálculo da Bobina
                </h4>
                <div className="bg-white border rounded-lg p-3 space-y-1.5">
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>Peso por metro:</span> <strong>{kgPorMetro.toFixed(2)} kg/m</strong></div>
                    <div className="flex justify-between text-emerald-700"><span>Peso por barra (6m):</span> <strong>{kgPorBarraBase.toFixed(2)} kg</strong></div>
                  </div>
                  <div className="pt-1 border-t">
                    <p className="text-lg font-black text-emerald-600">
                      {totalBarras} barras <span className="text-xs font-normal text-muted-foreground">de 6m</span>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ScrollText className="w-3 h-3" /> Materiais de Produção
                </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {materiais.map((mat, i) => {
                  const { barras, kgPorBarra, kgPorMetro } = calcularBarras(
                    slitter.peso_kg, slitter.largura_mm, slitter.espessura_mm
                  );
                  return (
                    <div key={i} className="bg-white border rounded-lg p-3 space-y-1.5">
                      <p className="font-bold text-sm">{mat}</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div className="flex justify-between"><span>Peso por metro:</span> <strong>{kgPorMetro.toFixed(2)} kg/m</strong></div>
                        <div className="flex justify-between text-emerald-700"><span>Peso por barra (6m):</span> <strong>{kgPorBarra.toFixed(2)} kg</strong></div>
                      </div>
                      <div className="pt-1 border-t">
                        <p className="text-lg font-black text-emerald-600">
                          {barras} barras <span className="text-xs font-normal text-muted-foreground">de 6m</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}

          {/* NF anexada */}
          {slitter.anexo_nf_url && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">NF Anexada</h4>
              <ImageLink url={slitter.anexo_nf_url} name={slitter.anexo_nf_nome}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium">
                <FileText className="w-4 h-4" /> {slitter.anexo_nf_nome || "Ver NF"}
              </ImageLink>
            </div>
          )}

          {/* Observações */}
          {slitter.observacoes && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Observações</h4>
              <p className="text-sm text-muted-foreground">{slitter.observacoes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}