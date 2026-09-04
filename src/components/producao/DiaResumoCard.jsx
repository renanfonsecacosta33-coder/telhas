import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Plus, Target, ShieldAlert } from "lucide-react";
import { format, isToday as dateFnsIsToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { useMetasProducao } from "@/hooks/useMetasProducao";

export default function DiaResumoCard({ dia, pedidos, maquinaCores, onVerDia, onNovoPedido }) {
  const [expanded, setExpanded] = useState(dateFnsIsToday(dia));
  const { metaGeral, calcularStatusMeta, obterMetaModelo } = useMetasProducao();
  const totalDia = pedidos.reduce((s, p) => s + calcularMetrosPedido(p), 0);
  const finalizados = pedidos.filter(p => p.status === "finalizado").length;

  const stDia = calcularStatusMeta(totalDia, metaGeral.min, metaGeral.max);

  const porMaquina = pedidos.reduce((acc, p) => {
    const m = p.maquina || "Sem máquina";
    if (!acc[m]) acc[m] = [];
    acc[m].push(p);
    return acc;
  }, {});

  const isHoje = dateFnsIsToday(dia);
  const pctGeral = metaGeral.max > 0 ? Math.min(100, Math.round((totalDia / metaGeral.max) * 100)) : 0;

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${
      stDia.status === "limite_estourado"
        ? "border-red-500/60 shadow-sm"
        : isHoje
        ? "border-primary/40 shadow-sm"
        : "border-border"
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-left">
            <span className={`font-bold capitalize ${isHoje ? "text-primary" : ""}`}>
              {format(dia, "EEEE", { locale: ptBR })}
            </span>
            <span className="text-sm text-muted-foreground ml-2">{format(dia, "dd/MM", { locale: ptBR })}</span>
            {isHoje && <Badge className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">Hoje</Badge>}
          </div>
          {pedidos.length > 0 && (
            <Badge variant="outline" className="text-xs">{pedidos.length} pedido(s)</Badge>
          )}

          {/* Badge de Meta Diária */}
          {stDia.status === "limite_estourado" ? (
            <Badge className="bg-red-600 text-white text-[10px] font-bold gap-1 animate-pulse">
              <ShieldAlert className="w-3 h-3" />
              Capacidade Esgotada (+{stDia.excesso}m)
            </Badge>
          ) : stDia.status === "meta_atingida" ? (
            <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
              ✓ Meta Atingida
            </Badge>
          ) : totalDia > 0 ? (
            <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300">
              Faltam {(metaGeral.min - totalDia).toFixed(0)}m p/ mínima
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto">
          {totalDia > 0 ? (
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end">
                <span className={`text-sm font-black ${
                  stDia.status === "limite_estourado" ? "text-red-600" :
                  stDia.status === "meta_atingida" ? "text-emerald-600" : "text-primary"
                }`}>
                  {totalDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                </span>
                <span className="text-[11px] text-muted-foreground">/ máx {metaGeral.max}m</span>
              </div>
              {/* Barra de capacidade */}
              <div className="w-28 bg-muted rounded-full h-1.5 overflow-hidden ml-auto mt-0.5">
                <div
                  className={`h-full rounded-full ${stDia.barClass}`}
                  style={{ width: `${pctGeral}%` }}
                />
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">0m / máx {metaGeral.max}m</span>
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
              {Object.entries(porMaquina).map(([maquina, peds]) => {
                const totalMaq = peds.reduce((s, p) => s + calcularMetrosPedido(p), 0);
                const metaMod = obterMetaModelo(maquina);
                const stMaq = metaMod ? calcularStatusMeta(totalMaq, metaMod.min, metaMod.max) : null;
                return (
                  <div key={maquina}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`border text-xs ${maquinaCores[maquina] || "bg-gray-100 text-gray-700 border-gray-200"}`}>{maquina}</Badge>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {totalMaq.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                        </span>
                        {metaMod && (
                          <span className="text-[11px] text-muted-foreground">
                            (Mín: {metaMod.min}m · Máx: {metaMod.max}m)
                          </span>
                        )}
                      </div>
                      {stMaq && stMaq.status === "limite_estourado" && (
                        <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 text-[10px] font-bold">
                          Capacidade Excedida (+{stMaq.excesso}m)
                        </Badge>
                      )}
                    </div>
                  <div className="space-y-1 pl-2">
                    {peds.map(p => {
                      const m = calcularMetrosPedido(p);
                      return (
                        <div key={p.id} className="flex items-center gap-2 text-xs">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === "finalizado" ? "bg-green-500" : p.status === "em_producao" ? "bg-amber-500" : "bg-gray-300"}`} />
                          <span className="font-medium">{p.produto}</span>
                          {p.cliente && <span className="text-muted-foreground">— {p.cliente}</span>}
                          {m > 0 && <span className="ml-auto font-bold text-primary">{m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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