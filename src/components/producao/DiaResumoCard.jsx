import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { format, isToday as dateFnsIsToday } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DiaResumoCard({ dia, pedidos, maquinaCores, onVerDia, onNovoPedido }) {
  const [expanded, setExpanded] = useState(dateFnsIsToday(dia));
  const totalDia = pedidos.reduce((s, p) => s + (p.metros || 0), 0);
  const finalizados = pedidos.filter(p => p.status === "finalizado").length;

  const porMaquina = pedidos.reduce((acc, p) => {
    const m = p.maquina || "Sem máquina";
    if (!acc[m]) acc[m] = [];
    acc[m].push(p);
    return acc;
  }, {});

  const isHoje = dateFnsIsToday(dia);

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${isHoje ? "border-primary/30 shadow-sm" : "border-border"}`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <span className={`font-bold capitalize ${isHoje ? "text-primary" : ""}`}>
              {format(dia, "EEEE", { locale: ptBR })}
            </span>
            <span className="text-sm text-muted-foreground ml-2">{format(dia, "dd/MM", { locale: ptBR })}</span>
            {isHoje && <Badge className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">Hoje</Badge>}
          </div>
          {pedidos.length > 0 && (
            <Badge variant="outline">{pedidos.length} pedido(s)</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalDia > 0 && (
            <span className="text-sm font-bold text-primary">{totalDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m</span>
          )}
          {pedidos.length > 0 && (
            <span className="text-xs text-muted-foreground">{finalizados}/{pedidos.length} ✓</span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {pedidos.length === 0 ? (
            <div className="px-4 py-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Nenhum pedido registrado neste dia</p>
              <Button size="sm" onClick={onNovoPedido} className="gap-1">
                <Plus className="w-3 h-3" />
                Adicionar Pedido
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {Object.entries(porMaquina).map(([maquina, peds]) => (
                <div key={maquina}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`border text-xs ${maquinaCores[maquina] || "bg-gray-100 text-gray-700 border-gray-200"}`}>{maquina}</Badge>
                    <span className="text-xs text-muted-foreground">{peds.reduce((s, p) => s + (p.metros || 0), 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m</span>
                  </div>
                  <div className="space-y-1 pl-2">
                    {peds.map(p => (
                      <div key={p.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === "finalizado" ? "bg-green-500" : p.status === "em_producao" ? "bg-amber-500" : "bg-gray-300"}`} />
                        <span className="font-medium">{p.produto}</span>
                        {p.cliente && <span className="text-muted-foreground">— {p.cliente}</span>}
                        {p.metros > 0 && <span className="ml-auto font-bold text-primary">{p.metros}m</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" onClick={onVerDia} className="flex-1">Ver detalhes</Button>
                <Button size="sm" onClick={onNovoPedido} className="gap-1">
                  <Plus className="w-3 h-3" />
                  Pedido
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}