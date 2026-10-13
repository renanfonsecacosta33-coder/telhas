import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers, Clock, Zap, CheckCircle2, AlertTriangle, Eye, History, Star,
  User, Factory, Calendar, ExternalLink
} from "lucide-react";
import { PrioridadeBadge } from "@/lib/prioridadeHelper";
import { formatDataBR } from "@/lib/sla";

const COLUNAS_KANBAN_PCP = [
  {
    id: "pendente",
    titulo: "📋 Pendente / Fila Ativa",
    subtitulo: "Aguardando envio para máquinas",
    headerBg: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
    filtro: (p) => (!p.status_pcp || p.status_pcp === "pendente_distribuicao" || p.status_pcp === "pendente") && (p.percentual_concluido || 0) < 100,
  },
  {
    id: "distribuido",
    titulo: "⚙️ Na Fila da Máquina",
    subtitulo: "Distribuídos para o operador",
    headerBg: "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30",
    filtro: (p) => p.status_pcp === "distribuido" && (p.percentual_concluido || 0) < 100,
  },
  {
    id: "em_producao",
    titulo: "▶️ Em Produção",
    subtitulo: "Rodando nas máquinas agora",
    headerBg: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-500/30",
    filtro: (p) => p.status_pcp === "em_producao" && (p.percentual_concluido || 0) < 100,
  },
  {
    id: "concluido",
    titulo: "✅ Concluído / 100%",
    subtitulo: "Produção finalizada",
    headerBg: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    filtro: (p) => p.status_pcp === "concluido" || (p.percentual_concluido || 0) >= 100,
  },
];

export default function FilaPCPKanbanView({
  pedidos = [],
  onOpenDetalhe,
  onDistribuir,
  onOpenHistorico,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {COLUNAS_KANBAN_PCP.map((col) => {
        const itensColuna = pedidos.filter(col.filtro);
        const totalMetros = itensColuna.reduce((sum, p) => sum + (Number(p.metros) || 0), 0);
        const totalPecas = itensColuna.reduce((sum, p) => sum + (Number(p.quantidade_telhas || p.pecas_total || 1)), 0);

        return (
          <div
            key={col.id}
            className="bg-card border border-border rounded-xl flex flex-col max-h-[82vh] overflow-hidden shadow-xs"
          >
            {/* Header Coluna */}
            <div className={`p-3 border-b border-border ${col.headerBg}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm tracking-tight">{col.titulo}</h3>
                <Badge variant="secondary" className="font-extrabold text-xs">
                  {itensColuna.length}
                </Badge>
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">{col.subtitulo}</p>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold">
                <span>{totalPecas} pçs</span>
                {totalMetros > 0 && <span>{totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m</span>}
              </div>
            </div>

            {/* Lista Cards */}
            <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
              {itensColuna.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                  Nenhum pedido nesta etapa
                </div>
              ) : (
                itensColuna.map((p) => {
                  const isUrgente = p.prioridade || p.urgente;
                  const pct = p.percentual_concluido || 0;

                  return (
                    <div
                      key={p.id}
                      className="bg-background border border-border hover:border-blue-500/60 rounded-lg p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-2"
                    >
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-sm text-foreground">
                              #{p.numero_pedido || p.id?.slice(0, 8)}
                            </span>
                            {isUrgente && (
                              <PrioridadeBadge prioridade={p.prioridade_tipo || "P1"} />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-foreground truncate block max-w-[180px] mt-0.5" title={p.cliente}>
                            {p.cliente || "Sem cliente"}
                          </span>
                        </div>
                        <Badge variant="outline" className="font-mono font-extrabold text-xs bg-muted/50 text-foreground shrink-0">
                          {p.metros ? `${Number(p.metros).toFixed(1)}m` : "—"}
                        </Badge>
                      </div>

                      {/* Informações de entrega e vendedor */}
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{p.vendedor ? `Vend: ${p.vendedor}` : "—"}</span>
                        {p.data_prometida_iso && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDataBR(p.data_prometida_iso)}
                          </span>
                        )}
                      </div>

                      {/* Barra de Progresso */}
                      {pct > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Progresso</span>
                            <span className="font-bold text-foreground">{pct}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Rodapé com botões de ação */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/60 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {p.filial_destino || "Matriz"}
                        </span>
                        <div className="flex items-center gap-1">
                          {onDistribuir && col.id === "pendente" && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-6 text-[10px] px-2 gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                              onClick={() => onDistribuir(p)}
                              title="Distribuir Pedido"
                            >
                              <Zap className="w-2.5 h-2.5" /> Distribuir
                            </Button>
                          )}
                          {onOpenDetalhe && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title="Ver Detalhes"
                              onClick={() => onOpenDetalhe(p)}
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                          {onOpenHistorico && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title="Histórico / Timeline"
                              onClick={() => onOpenHistorico(p.numero_pedido || p.id)}
                            >
                              <History className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
