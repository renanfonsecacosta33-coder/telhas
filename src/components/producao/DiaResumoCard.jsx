import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Play, 
  Pause, 
  Circle, 
  Route, 
  Star, 
  ShoppingCart, 
  User 
} from "lucide-react";
import { format, isToday as dateFnsIsToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { useMetasProducao } from "@/hooks/useMetasProducao";

function OpStatusBadge({ status }) {
  switch (status) {
    case "finalizado":
      return (
        <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 text-[10px] font-bold gap-1 shrink-0">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          Finalizada
        </Badge>
      );
    case "em_producao":
      return (
        <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 text-[10px] font-bold gap-1 shrink-0 animate-pulse">
          <Play className="w-2.5 h-2.5 fill-amber-600 text-amber-600 dark:fill-amber-400 dark:text-amber-400" />
          Produzindo
        </Badge>
      );
    case "pausado":
      return (
        <Badge className="bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 text-[10px] font-bold gap-1 shrink-0">
          <Pause className="w-2.5 h-2.5" />
          Pausada
        </Badge>
      );
    case "aguardando_colagem":
      return (
        <Badge className="bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 text-[10px] font-bold gap-1 shrink-0">
          <Clock className="w-2.5 h-2.5" />
          Aguard. Colagem
        </Badge>
      );
    case "cancelado":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] font-semibold gap-1 shrink-0">
          Cancelada
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 text-[10px] font-semibold gap-1 shrink-0">
          <Circle className="w-2 h-2 text-slate-400" />
          Não iniciada
        </Badge>
      );
  }
}

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
        className="w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20 transition-colors cursor-pointer"
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
            <Badge variant="outline" className="text-xs font-semibold">{pedidos.length} pedido(s)</Badge>
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
            <span className="text-xs font-bold text-foreground/80 bg-muted/60 px-2 py-0.5 rounded-full">
              {finalizados}/{pedidos.length} ✓
            </span>
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
            <div className="p-4 space-y-4">
              {Object.entries(porMaquina).map(([maquina, peds]) => {
                const totalMaq = peds.reduce((s, p) => s + calcularMetrosPedido(p), 0);
                const metaMod = obterMetaModelo(maquina);
                const stMaq = metaMod ? calcularStatusMeta(totalMaq, metaMod.min, metaMod.max) : null;
                const pedsFinalizados = peds.filter(p => p.status === "finalizado").length;
                const pedsEmProd = peds.filter(p => p.status === "em_producao").length;
                const pedsPausados = peds.filter(p => p.status === "pausado").length;
                const pedsPendentes = peds.filter(p => !p.status || p.status === "pendente").length;
                const pctMaqConcluido = peds.length > 0 ? Math.round((pedsFinalizados / peds.length) * 100) : 0;

                return (
                  <div key={maquina} className="rounded-xl border border-border/70 bg-card/50 p-3 space-y-2.5">
                    {/* Cabeçalho da Máquina com Métricas e Placar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`border text-xs font-black shadow-2xs ${maquinaCores[maquina] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                          {maquina}
                        </Badge>
                        <span className="text-sm font-black text-foreground">
                          {totalMaq.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                        </span>
                        {metaMod && (
                          <span className="text-[11px] text-muted-foreground">
                            (Mín: {metaMod.min}m · Máx: {metaMod.max}m)
                          </span>
                        )}
                        {stMaq && stMaq.status === "limite_estourado" && (
                          <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 text-[10px] font-bold">
                            Capacidade Excedida (+{stMaq.excesso}m)
                          </Badge>
                        )}
                      </div>

                      {/* Placar de Status da Máquina */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pedsFinalizados > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {pedsFinalizados} pronta{pedsFinalizados > 1 ? "s" : ""}
                          </span>
                        )}
                        {pedsEmProd > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 px-2 py-0.5 rounded-md animate-pulse">
                            <Play className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            {pedsEmProd} rodando
                          </span>
                        )}
                        {pedsPausados > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700/60 px-2 py-0.5 rounded-md">
                            <Pause className="w-2.5 h-2.5 text-purple-600" />
                            {pedsPausados} pausada{pedsPausados > 1 ? "s" : ""}
                          </span>
                        )}
                        {pedsPendentes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-md">
                            <Circle className="w-2 h-2 text-slate-400" />
                            {pedsPendentes} pendente{pedsPendentes > 1 ? "s" : ""}
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-muted-foreground ml-1">
                          {peds.length} OP{peds.length > 1 ? "s" : ""} ({pctMaqConcluido}%)
                        </span>
                      </div>
                    </div>

                    {/* Linhas das OPs com Status e Complementos em Evidência */}
                    <div className="space-y-1.5">
                      {peds.map(p => {
                        const m = calcularMetrosPedido(p);
                        const pecas = Number(p.metros) || Number(p.quantidade_telhas) || 0;
                        const temVariacoes = p.variacoes_telhas && (typeof p.variacoes_telhas === "string" ? p.variacoes_telhas.length > 5 : p.variacoes_telhas.length > 0);

                        return (
                          <div
                            key={p.id}
                            className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${
                              p.status === "finalizado"
                                ? "bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200/60 dark:border-emerald-900/40"
                                : p.status === "em_producao"
                                ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 shadow-2xs"
                                : "bg-background/80 border-border/60 hover:bg-muted/30 hover:border-border"
                            }`}
                          >
                            {/* Esquerda: Pedido + Produto + Cliente + Complementos */}
                            <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                              {/* Número do pedido em destaque mono */}
                              {p.numero_pedido && (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-black text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-950/70 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 shadow-2xs shrink-0">
                                  <ShoppingCart className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                  #{p.numero_pedido}
                                </span>
                              )}

                              {/* Nome do Produto */}
                              <span className="font-bold text-foreground text-xs sm:text-sm shrink-0">
                                {p.produto}
                              </span>

                              {/* Nome do Cliente em Evidência */}
                              {p.cliente && (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-slate-800 dark:text-slate-100 truncate max-w-[220px] sm:max-w-md uppercase tracking-tight">
                                  <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                  {p.cliente}
                                </span>
                              )}

                              {/* Badges de ROTA e PRIORIDADE */}
                              {p.rota && (
                                <Badge className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0 gap-0.5 animate-pulse shrink-0">
                                  <Route className="w-2.5 h-2.5" />
                                  ROTA
                                </Badge>
                              )}
                              {p.prioridade && (
                                <Badge className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0 gap-0.5 shrink-0">
                                  <Star className="w-2.5 h-2.5 fill-white" />
                                  PRIORIDADE
                                </Badge>
                              )}

                              {/* Status EPS */}
                              {p.eps_status === "pronto" && (
                                <Badge variant="outline" className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0 shrink-0">
                                  🧊 EPS Pronto
                                </Badge>
                              )}
                              {p.eps_status === "em_corte" && (
                                <Badge variant="outline" className="text-[9px] font-semibold text-blue-700 dark:text-blue-300 border-blue-300 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0 shrink-0">
                                  🧊 EPS em Corte
                                </Badge>
                              )}

                              {/* Vendedor */}
                              {p.vendedor && (
                                <span className="text-[10px] text-muted-foreground hidden xl:inline ml-1">
                                  · Vend: <strong className="text-foreground/80">{p.vendedor}</strong>
                                </span>
                              )}
                            </div>

                            {/* Direita: Metragem linear/peças + Status da OP */}
                            <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                              <div className="text-right">
                                {m > 0 && (
                                  <span className="font-mono font-black text-xs sm:text-sm text-primary">
                                    {m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                                  </span>
                                )}
                                {pecas > 0 && !temVariacoes && (
                                  <span className="text-[10px] font-medium text-muted-foreground ml-1.5">
                                    ({pecas} pçs)
                                  </span>
                                )}
                              </div>

                              {/* Status da OP ao lado em evidência */}
                              <OpStatusBadge status={p.status} />
                            </div>
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