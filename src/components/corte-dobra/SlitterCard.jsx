import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronDown, FileText, Pencil, Trash2, Weight, Ruler, ScrollText
} from "lucide-react";

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

function calcularBarras(pesoKg, larguraMm, espessuraMm, materialStr) {
  const match = materialStr.match(/^(\d+)\s*[xX]\s*(\d+)/);
  if (!match) return { tiras: 0, barras: 0, totalLinha: 0 };
  const stripWidth = Number(match[1]);
  const larguraM = larguraMm / 1000;
  const espessuraM = espessuraMm / 1000;
  const comprimentoBobina = pesoKg / (larguraM * espessuraM * DENSIDADE_ACO);
  const tiras = Math.floor(larguraMm / stripWidth);
  const totalLinha = comprimentoBobina * tiras;
  const barras = Math.floor(totalLinha / 6);
  return { tiras, barras, totalLinha };
}

export default function SlitterCard({ slitter, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const materiais = parseMateriais(slitter.materiais_producao);
  const temExpandir = (slitter.materiais_producao || slitter.anexo_nf_url || slitter.observacoes);

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
            <a href={slitter.anexo_nf_url} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors" title="Ver NF">
              <FileText className="w-4 h-4" />
            </a>
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
          {/* Materiais de produção */}
          {materiais.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <ScrollText className="w-3 h-3" /> Materiais de Produção
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {materiais.map((mat, i) => {
                  const { tiras, barras, totalLinha } = calcularBarras(
                    slitter.peso_kg, slitter.largura_mm, slitter.espessura_mm, mat
                  );
                  return (
                    <div key={i} className="bg-white border rounded-lg p-3 space-y-1">
                      <p className="font-bold text-sm">{mat}</p>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p><strong>{tiras}</strong> tiras de {slitter.largura_mm}mm</p>
                        <p><strong>{totalLinha.toFixed(1)}</strong> metros lineares total</p>
                        <p className="text-lg font-black text-emerald-600">
                          {barras} barras <span className="text-xs font-normal text-muted-foreground">de 6m</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NF anexada */}
          {slitter.anexo_nf_url && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">NF Anexada</h4>
              <a href={slitter.anexo_nf_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium">
                <FileText className="w-4 h-4" /> {slitter.anexo_nf_nome || "Ver NF"}
              </a>
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