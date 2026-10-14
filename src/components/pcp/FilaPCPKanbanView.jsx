import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap, CheckCircle2, Eye, History, ChevronDown, ChevronRight, RefreshCw
} from "lucide-react";
import { PrioridadeBadge } from "@/lib/prioridadeHelper";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import { classGrupo, calcularProgressoRealPedido, normalizarUnidadeMedidaItem } from "@/lib/pedidoOdooHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";

const COLUNAS_KANBAN_PCP = [
  {
    id: "pendente",
    titulo: "📋 Pendente / Fila Ativa",
    subtitulo: "Aguardando envio para máquinas",
    headerBg: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
    badgeCor: "bg-amber-500 text-white",
  },
  {
    id: "distribuido",
    titulo: "⚙️ Na Fila da Máquina",
    subtitulo: "Distribuídos para o operador",
    headerBg: "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30",
    badgeCor: "bg-blue-600 text-white",
  },
  {
    id: "em_producao",
    titulo: "▶️ Em Produção",
    subtitulo: "Rodando nas máquinas agora",
    headerBg: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-500/30",
    badgeCor: "bg-indigo-600 text-white",
  },
  {
    id: "concluido",
    titulo: "✅ Concluído / 100%",
    subtitulo: "Produção finalizada",
    headerBg: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    badgeCor: "bg-emerald-600 text-white",
  },
];

export default function FilaPCPKanbanView({
  gruposPedidos = null,
  pedidos = [],
  estoqueContext = null,
  pedidosProducao = [],
  ordensCD = [],
  onOpenDetalhe,
  onDistribuir,
  onDistribuirGrupo,
  onFinalizarOP,
  onFinalizarGrupo100,
  onSincronizarOdoo,
  onSincronizarGrupoOdoo,
  onOpenHistorico,
  selecionados = new Set(),
  onToggleSelectGrupo,
}) {
  const [expandidos, setExpandidos] = useState(new Set());

  // Constrói ou utiliza gruposPedidos consolidados
  const listaGrupos = useMemo(() => {
    if (Array.isArray(gruposPedidos) && gruposPedidos.length > 0) {
      return gruposPedidos;
    }
    const map = new Map();
    pedidos.forEach(p => {
      const num = p.numero_pedido || `AVULSO_${p.id}`;
      if (!map.has(num)) {
        map.set(num, {
          numero_pedido: p.numero_pedido || "Sem Número",
          cliente_nome: p.cliente || p.cliente_nome || "—",
          vendedor_nome: p.vendedor || p.vendedor_nome || "—",
          data_entrega: p.data_entrega || p.data_prometida,
          unidade: p.unidade,
          prioridade: !!p.prioridade,
          prioridade_nivel: p.prioridade_nivel || p.prioridade_tipo,
          ofs: []
        });
      }
      map.get(num).ofs.push(p);
    });
    return Array.from(map.values());
  }, [gruposPedidos, pedidos]);

  // Classifica cada pedido em uma das 4 colunas do Kanban
  const gruposPorColuna = useMemo(() => {
    const mapa = {
      pendente: [],
      distribuido: [],
      em_producao: [],
      concluido: []
    };

    listaGrupos.forEach(grupo => {
      const ofs = grupo.ofs || [];
      const totalOfs = ofs.length;

      // Calcula o progresso real consolidado
      const somaProgressos = ofs.reduce((acc, p) => acc + calcularProgressoRealPedido(p, pedidosProducao, ordensCD), 0);
      const progressoGeral = totalOfs > 0 ? Math.round(somaProgressos / totalOfs) : 0;

      // Status das OFs
      const concluidas = ofs.filter(p => {
        if (p.status_pcp === "concluido") return true;
        return calcularProgressoRealPedido(p, pedidosProducao, ordensCD) >= 100;
      });

      const emProd = ofs.filter(p => {
        const prog = calcularProgressoRealPedido(p, pedidosProducao, ordensCD);
        return p.status_pcp === "em_producao" || (prog > 0 && prog < 100);
      });

      const distribuidas = ofs.filter(p => p.status_pcp === "distribuido" && !emProd.includes(p) && !concluidas.includes(p));

      // Atribuição de Coluna
      if (concluidas.length === totalOfs && totalOfs > 0) {
        mapa.concluido.push({ grupo, progressoGeral, statusChave: "concluido" });
      } else if (emProd.length > 0 || (progressoGeral > 0 && progressoGeral < 100)) {
        mapa.em_producao.push({ grupo, progressoGeral, statusChave: "em_producao" });
      } else if (distribuidas.length > 0) {
        mapa.distribuido.push({ grupo, progressoGeral, statusChave: "distribuido" });
      } else {
        mapa.pendente.push({ grupo, progressoGeral, statusChave: "pendente" });
      }
    });

    return mapa;
  }, [listaGrupos, pedidosProducao, ordensCD]);

  const toggleExpandir = (num) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {COLUNAS_KANBAN_PCP.map((col) => {
        const itensColuna = gruposPorColuna[col.id] || [];

        // Totais da coluna
        let totalMetrosColuna = 0;
        let totalPecasColuna = 0;

        itensColuna.forEach(({ grupo }) => {
          (grupo.ofs || []).forEach(p => {
            const grp = classGrupo(p);
            let itens = [];
            try { itens = JSON.parse(p.itens_json || "[]"); } catch { itens = []; }
            if (Array.isArray(itens) && itens.length > 0) {
              itens.forEach(it => {
                const unid = normalizarUnidadeMedidaItem(it, grp);
                const esp = extrairEspecificacao(`${it.observacao || ""} ${it.descricao || ""} ${it.produto || ""}`, it.quantidade, unid);
                totalMetrosColuna += esp.metragem_total || (Number(it.quantidade) || 0);
                totalPecasColuna += esp.pecas || (Number(it.quantidade) || 1);
              });
            } else {
              totalMetrosColuna += Number(p.metros) || 0;
              totalPecasColuna += Number(p.quantidade_telhas || p.pecas_total) || 1;
            }
          });
        });

        return (
          <div
            key={col.id}
            className="bg-card border border-border rounded-xl flex flex-col max-h-[85vh] overflow-hidden shadow-xs"
          >
            {/* Header da Coluna */}
            <div className={`p-3 border-b border-border ${col.headerBg}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm tracking-tight">{col.titulo}</h3>
                <Badge className={`font-extrabold text-xs ${col.badgeCor}`}>
                  {itensColuna.length}
                </Badge>
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">{col.subtitulo}</p>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold">
                <span>{totalPecasColuna} pçs</span>
                {totalMetrosColuna > 0 && (
                  <span>{totalMetrosColuna.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m</span>
                )}
              </div>
            </div>

            {/* Lista de Cards da Coluna */}
            <div className="p-2.5 space-y-3 overflow-y-auto flex-1">
              {itensColuna.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                  Nenhum pedido nesta etapa
                </div>
              ) : (
                itensColuna.map(({ grupo, progressoGeral }) => {
                  const ofs = grupo.ofs || [];
                  const numPedido = grupo.numero_pedido;
                  const isUrgente = grupo.prioridade || ofs.some(p => p.prioridade || p.prioridade_nivel);
                  const isExpandido = expandidos.has(numPedido);
                  const primeiroPedido = ofs[0] || {};

                  // Metragem e peças deste pedido
                  let metrosPed = 0;
                  let pecasPed = 0;
                  let hasTelha = false;
                  let hasCD = false;

                  ofs.forEach(p => {
                    const grp = classGrupo(p);
                    if (grp === "telha") hasTelha = true;
                    if (grp === "cd" || grp === "frisada") hasCD = true;

                    let itens = [];
                    try { itens = JSON.parse(p.itens_json || "[]"); } catch { itens = []; }
                    if (Array.isArray(itens) && itens.length > 0) {
                      itens.forEach(it => {
                        const unid = normalizarUnidadeMedidaItem(it, grp);
                        const esp = extrairEspecificacao(`${it.observacao || ""} ${it.descricao || ""} ${it.produto || ""}`, it.quantidade, unid);
                        metrosPed += esp.metragem_total || (Number(it.quantidade) || 0);
                        pecasPed += esp.pecas || (Number(it.quantidade) || 1);
                      });
                    } else {
                      metrosPed += Number(p.metros) || 0;
                      pecasPed += Number(p.quantidade_telhas || p.pecas_total) || 1;
                    }
                  });

                  return (
                    <div
                      key={numPedido}
                      className={`bg-background border rounded-xl p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-2 border-border hover:border-blue-500/60 ${
                        isUrgente ? "border-amber-400 bg-amber-50/10 dark:bg-amber-950/10" : ""
                      }`}
                    >
                      {/* Topo do Card: Número, Prioridade e SLA */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-sm text-foreground">
                              #{numPedido}
                            </span>
                            {isUrgente && (
                              <PrioridadeBadge prioridade={grupo.prioridade_nivel || "P1"} />
                            )}
                          </div>
                          <p className="text-xs font-bold text-foreground mt-0.5 truncate max-w-[200px]" title={grupo.cliente_nome}>
                            {grupo.cliente_nome}
                          </p>
                          {grupo.vendedor_nome && grupo.vendedor_nome !== "—" && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              Vend: {grupo.vendedor_nome}
                            </p>
                          )}
                        </div>

                        {/* Prazo SLA */}
                        {grupo.data_entrega && (
                          <div className="shrink-0">
                            <SlaCountdownBadge
                              dataPrometida={grupo.data_entrega}
                              concluido={progressoGeral >= 100}
                            />
                          </div>
                        )}
                      </div>

                      {/* Badges de Setor + Metragem */}
                      <div className="flex items-center justify-between text-xs py-1 border-t border-b border-border/40">
                        <div className="flex items-center gap-1">
                          {hasTelha && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                              Telha
                            </span>
                          )}
                          {hasCD && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                              C&D
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {ofs.length} OF{ofs.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-xs">
                            {metrosPed > 0 ? `${metrosPed.toFixed(1)}m` : `${pecasPed} pçs`}
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso Geral */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                          <span>Progresso</span>
                          <span className="font-bold text-foreground">{progressoGeral}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progressoGeral >= 100 ? "bg-emerald-500" : progressoGeral > 0 ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                            }`}
                            style={{ width: `${progressoGeral}%` }}
                          />
                        </div>
                      </div>

                      {/* Botão Retrátil para ver Itens/OFs dentro do Card */}
                      <button
                        type="button"
                        onClick={() => toggleExpandir(numPedido)}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-semibold flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <span>{isExpandido ? "Ocultar Itens" : `Ver ${ofs.length} OF(s)`}</span>
                        {isExpandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>

                      {/* Grade de Itens Expandida */}
                      {isExpandido && (
                        <div className="space-y-1.5 pt-1 border-t border-border/50 text-[11px]">
                          {ofs.map((ofItem, idx) => {
                            let itensOf = [];
                            try { itensOf = JSON.parse(ofItem.itens_json || "[]"); } catch { itensOf = []; }
                            if (itensOf.length === 0) {
                              itensOf = [{ produto: ofItem.produto || "Item", quantidade: ofItem.metros || 1 }];
                            }

                            const progOf = calcularProgressoRealPedido(ofItem, pedidosProducao, ordensCD);
                            const isOfConcluida = progOf >= 100 || ofItem.status_pcp === "concluido";

                            return itensOf.map((it, itIdx) => (
                              <div key={`${ofItem.id}-${itIdx}`} className="bg-muted/40 p-1.5 rounded flex items-center justify-between gap-1">
                                <div className="min-w-0">
                                  <div className="font-semibold truncate max-w-[150px]" title={it.produto}>
                                    {it.produto}
                                  </div>
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {it.quantidade} {it.unidade || "pç"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {!isOfConcluida && col.id !== "pendente" && onFinalizarOP && (
                                    <Button
                                      size="sm"
                                      className="h-5 text-[9px] px-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                                      onClick={() => onFinalizarOP(ofItem)}
                                      title="Finalizar esta OP"
                                    >
                                      Finalizar OP
                                    </Button>
                                  )}
                                  {isOfConcluida && (
                                    <span className="text-[10px] text-emerald-600 font-bold">100% OK</span>
                                  )}
                                </div>
                              </div>
                            ));
                          })}
                        </div>
                      )}

                      {/* Barra de Ações Rápidas no Rodapé */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs flex-wrap gap-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* SE PENDENTE: BOTÃO DISTRIBUIR */}
                          {onDistribuirGrupo && col.id === "pendente" && (
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                              onClick={() => onDistribuirGrupo(grupo)}
                            >
                              <Zap className="w-3 h-3 mr-1" /> Distribuir
                            </Button>
                          )}

                          {/* SE DISTRIBUÍDO OU EM PRODUÇÃO: BOTÃO FINALIZAR PEDIDO */}
                          {onFinalizarGrupo100 && (col.id === "distribuido" || col.id === "em_producao") && (
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer gap-1"
                              onClick={() => onFinalizarGrupo100(ofs)}
                              title="Finalizar 100% de todas as OFs deste pedido"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Finalizar Pedido
                            </Button>
                          )}

                          {/* SE CONCLUÍDO: BOTÃO SINCRONIZAR ODOO */}
                          {onSincronizarGrupoOdoo && col.id === "concluido" && (
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer gap-1"
                              onClick={() => onSincronizarGrupoOdoo(ofs)}
                              title="Sincronizar com o Odoo ERP"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Odoo
                            </Button>
                          )}

                          {onOpenDetalhe && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                              onClick={() => onOpenDetalhe(primeiroPedido)}
                              title="Ver Detalhes do Pedido"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        {onOpenHistorico && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => onOpenHistorico(numPedido)}
                            title="Histórico / Timeline"
                          >
                            <History className="w-3 h-3" />
                          </Button>
                        )}
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