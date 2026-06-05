import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { format, isToday as dateFnsIsToday } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DiaResumoCardCD({ dia, ordens, onVerDia, onNovaOrdem }) {
  const [expanded, setExpanded] = useState(dateFnsIsToday(dia));
  const totalPecas = ordens.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
  const finalizadas = ordens.filter(o => o.status === "finalizado").length;
  const isHoje = dateFnsIsToday(dia);

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${isHoje ? "border-orange-400/50 shadow-sm" : "border-border"}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <span className={`font-bold capitalize ${isHoje ? "text-orange-500" : ""}`}>
              {format(dia, "EEEE", { locale: ptBR })}
            </span>
            <span className="text-sm text-muted-foreground ml-2">{format(dia, "dd/MM", { locale: ptBR })}</span>
            {isHoje && <Badge className="ml-2 text-xs bg-orange-100 text-orange-700 border-orange-200">Hoje</Badge>}
          </div>
          {ordens.length > 0 && <Badge variant="outline">{ordens.length} ordem(ns)</Badge>}
        </div>
        <div className="flex items-center gap-3">
          {totalPecas > 0 && <span className="text-sm font-bold text-orange-500">{totalPecas} peças</span>}
          {ordens.length > 0 && <span className="text-xs text-muted-foreground">{finalizadas}/{ordens.length} ✓</span>}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {ordens.length === 0 ? (
            <div className="px-4 py-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Nenhuma ordem registrada neste dia</p>
              <Button size="sm" onClick={onNovaOrdem} className="gap-1 bg-orange-500 hover:bg-orange-600">
                <Plus className="w-3 h-3" /> Adicionar Ordem
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {ordens.map(o => (
                <div key={o.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    o.status === "finalizado" ? "bg-green-500" :
                    o.status === "em_producao" ? "bg-amber-500 animate-pulse" :
                    o.status === "pausado" ? "bg-purple-500" : "bg-slate-300"
                  }`} />
                  <span className="font-mono font-bold text-orange-600 truncate max-w-[120px]">{o.bobina_descricao || "—"}</span>
                  {o.quantidade > 0 && <span className="text-muted-foreground">{o.quantidade} pç</span>}
                  {o.comprimento_mm > 0 && <span className="text-muted-foreground">{o.comprimento_mm}mm</span>}
                  <span className="ml-auto">
                    <Badge className={`text-xs border ${
                      o.status === "finalizado" ? "bg-green-100 text-green-700 border-green-200" :
                      o.status === "em_producao" ? "bg-amber-100 text-amber-700 border-amber-200" :
                      o.status === "pausado" ? "bg-purple-100 text-purple-700 border-purple-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>{o.status}</Badge>
                  </span>
                </div>
              ))}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" onClick={onVerDia} className="flex-1">Ver detalhes</Button>
                <Button size="sm" onClick={onNovaOrdem} className="gap-1 bg-orange-500 hover:bg-orange-600 text-white">
                  <Plus className="w-3 h-3" /> Ordem
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}