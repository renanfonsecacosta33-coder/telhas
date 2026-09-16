import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  CheckCircle2, 
  Play, 
  Pause, 
  Circle, 
  ShoppingCart, 
  User, 
  Layers, 
  Factory 
} from "lucide-react";
import { format, isToday as dateFnsIsToday } from "date-fns";
import { ptBR } from "date-fns/locale";

function OpStatusBadgeCD({ status }) {
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

export default function DiaResumoCardCD({ dia, ordens = [], onVerDia, onNovaOrdem }) {
  const [expanded, setExpanded] = useState(dateFnsIsToday(dia));
  const totalPecas = ordens.reduce((s, o) => s + (Number(o.quantidade) || 0), 0);
  const totalKg = ordens.reduce((s, o) => s + (Number(o.peso_kg) || Number(o.kg_estimado) || 0), 0);
  const finalizadas = ordens.filter(o => o.status === "finalizado").length;
  const isHoje = dateFnsIsToday(dia);

  // Agrupar ordens por máquina
  const porMaquina = ordens.reduce((acc, o) => {
    const m = o.maquina || (o.bobina_id ? "Desbobinadeira" : "Corte & Dobra");
    if (!acc[m]) acc[m] = [];
    acc[m].push(o);
    return acc;
  }, {});

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all ${
      isHoje ? "border-orange-400/60 shadow-sm" : "border-border"
    }`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-left">
            <span className={`font-bold capitalize ${isHoje ? "text-orange-500" : ""}`}>
              {format(dia, "EEEE", { locale: ptBR })}
            </span>
            <span className="text-sm text-muted-foreground ml-2">{format(dia, "dd/MM", { locale: ptBR })}</span>
            {isHoje && <Badge className="ml-2 text-xs bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200">Hoje</Badge>}
          </div>
          {ordens.length > 0 && (
            <Badge variant="outline" className="text-xs font-semibold">{ordens.length} ordem(ns)</Badge>
          )}
        </div>

        <div className="flex items-center gap-3 justify-between sm:justify-end w-full sm:w-auto">
          {totalPecas > 0 && (
            <span className="text-sm font-black text-orange-600 dark:text-orange-400">
              {totalPecas} peças {totalKg > 0 ? `· ${totalKg.toFixed(0)}kg` : ""}
            </span>
          )}
          {ordens.length > 0 && (
            <span className="text-xs font-bold text-foreground/80 bg-muted/60 px-2 py-0.5 rounded-full">
              {finalizadas}/{ordens.length} ✓
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {ordens.length === 0 ? (
            <div className="px-4 py-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Nenhuma ordem registrada neste dia</p>
              <Button size="sm" onClick={onNovaOrdem} className="gap-1 bg-orange-500 hover:bg-orange-600 text-white">
                <Plus className="w-3 h-3" /> Adicionar Ordem
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {Object.entries(porMaquina).map(([maquina, ords]) => {
                const totalMaqPecas = ords.reduce((s, o) => s + (Number(o.quantidade) || 0), 0);
                const ordsFinalizadas = ords.filter(o => o.status === "finalizado").length;
                const ordsEmProd = ords.filter(o => o.status === "em_producao").length;
                const ordsPausadas = ords.filter(o => o.status === "pausado").length;
                const ordsPendentes = ords.filter(o => !o.status || o.status === "pendente").length;
                const pctConcluido = ords.length > 0 ? Math.round((ordsFinalizadas / ords.length) * 100) : 0;

                return (
                  <div key={maquina} className="rounded-xl border border-border/70 bg-card/50 p-3 space-y-2.5">
                    {/* Cabeçalho da Máquina de C&D */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="border text-xs font-black shadow-2xs bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                          <Factory className="w-3 h-3 mr-1" />
                          {maquina}
                        </Badge>
                        <span className="text-sm font-black text-foreground">
                          {totalMaqPecas} peças
                        </span>
                      </div>

                      {/* Placar de Status da Máquina */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ordsFinalizadas > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {ordsFinalizadas} pronta{ordsFinalizadas > 1 ? "s" : ""}
                          </span>
                        )}
                        {ordsEmProd > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 px-2 py-0.5 rounded-md animate-pulse">
                            <Play className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            {ordsEmProd} rodando
                          </span>
                        )}
                        {ordsPausadas > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700/60 px-2 py-0.5 rounded-md">
                            <Pause className="w-2.5 h-2.5 text-purple-600" />
                            {ordsPausadas} pausada{ordsPausadas > 1 ? "s" : ""}
                          </span>
                        )}
                        {ordsPendentes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-md">
                            <Circle className="w-2 h-2 text-slate-400" />
                            {ordsPendentes} pendente{ordsPendentes > 1 ? "s" : ""}
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-muted-foreground ml-1">
                          {ords.length} OP{ords.length > 1 ? "s" : ""} ({pctConcluido}%)
                        </span>
                      </div>
                    </div>

                    {/* Lista de Ordens de C&D */}
                    <div className="space-y-1.5">
                      {ords.map(o => (
                        <div
                          key={o.id}
                          className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-all ${
                            o.status === "finalizado"
                              ? "bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200/60 dark:border-emerald-900/40"
                              : o.status === "em_producao"
                              ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 shadow-2xs"
                              : "bg-background/80 border-border/60 hover:bg-muted/30 hover:border-border"
                          }`}
                        >
                          {/* Esquerda: Pedido + Peça / Bobina + Cliente */}
                          <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                            {/* Número do pedido em destaque mono */}
                            {o.numero_pedido && (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-black text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-950/70 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 shadow-2xs shrink-0">
                                <ShoppingCart className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                #{o.numero_pedido}
                              </span>
                            )}

                            {/* Tipo de peça / descrição */}
                            <span className="font-bold text-foreground text-xs sm:text-sm shrink-0">
                              {o.tipo_peca || o.bobina_descricao || o.chapa_descricao || "Ordem C&D"}
                            </span>

                            {/* Cliente */}
                            {o.cliente && (
                              <span className="inline-flex items-center gap-1 text-xs font-black text-slate-800 dark:text-slate-100 truncate max-w-[220px] sm:max-w-md uppercase tracking-tight">
                                <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                {o.cliente}
                              </span>
                            )}

                            {/* Dimensões / Medidas */}
                            {o.dimensoes_livres && (
                              <span className="text-[11px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                                {o.dimensoes_livres}
                              </span>
                            )}
                          </div>

                          {/* Direita: Quantidade / Dimensões + Status da OP */}
                          <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                            <div className="text-right">
                              {o.quantidade > 0 && (
                                <span className="font-mono font-black text-xs sm:text-sm text-foreground">
                                  {o.quantidade} pç
                                </span>
                              )}
                              {o.comprimento_mm > 0 && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  · {o.comprimento_mm}mm
                                </span>
                              )}
                            </div>

                            {/* Status da OP ao lado em evidência */}
                            <OpStatusBadgeCD status={o.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

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