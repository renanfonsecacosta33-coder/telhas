import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  ArrowRightLeft,
  Factory,
  Clock,
  User,
  AlertTriangle,
  Flame,
  Truck,
  CheckCircle2,
  Calendar,
  Layers,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formata data ISO para exibição amigável em português
 */
function formatarDataHoraSegura(dataStr) {
  if (!dataStr) return "Data não registrada";
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return String(dataStr);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return String(dataStr);
  }
}

export default function HistoricoMovimentacaoDialog({
  open,
  onOpenChange,
  pedido,
  grupo
}) {
  // Coleta as OFs alvo (seja a partir de um grupo ou de um pedido individual)
  const ofs = useMemo(() => {
    if (grupo?.ofs && Array.isArray(grupo.ofs) && grupo.ofs.length > 0) {
      return grupo.ofs;
    }
    if (pedido) {
      return [pedido];
    }
    return [];
  }, [grupo, pedido]);

  const pedidoPrincipal = ofs[0] || pedido || grupo || {};
  const numeroPedido = grupo?.numero_pedido || pedidoPrincipal.numero_pedido || pedidoPrincipal.of_nome || "—";
  const clienteNome = grupo?.cliente_nome || pedidoPrincipal.cliente_nome || "Cliente não informado";
  const vendedorNome = grupo?.vendedor_nome || pedidoPrincipal.vendedor_nome || "Não informado";
  const unidadeAtual = pedidoPrincipal.unidade || "Matriz AJL";

  // Consolida todos os eventos de movimentação e transferências
  const { timeline, transferenciasRecentes } = useMemo(() => {
    const eventos = [];
    const transferenciasSet = new Set();
    const listaTransferencias = [];

    ofs.forEach((ofItem) => {
      // 1. Extrai histórico estruturado de transferências
      try {
        const transfs = typeof ofItem.historico_transferencias === "string"
          ? JSON.parse(ofItem.historico_transferencias || "[]")
          : (Array.isArray(ofItem.historico_transferencias) ? ofItem.historico_transferencias : []);

        transfs.forEach((t) => {
          const chaveUnica = `${t.data}_${t.de}_${t.para}_${t.usuario}`;
          if (!transferenciasSet.has(chaveUnica)) {
            transferenciasSet.add(chaveUnica);
            listaTransferencias.push(t);
            eventos.push({
              id: chaveUnica,
              tipo: "transferencia",
              titulo: "Transferência de Central PCP",
              data: t.data,
              usuario: t.usuario || "PCP",
              de: t.de,
              para: t.para,
              motivo: t.motivo || "Transferência de fábrica solicitada pelo PCP",
              detalhes: `Transferido de ${t.de} para ${t.para}. Motivo: ${t.motivo || "Sem observações informadas"}`
            });
          }
        });
      } catch (e) {
        console.warn("[HistoricoMovimentacao] Erro ao parsear historico_transferencias:", e);
      }

      // Se não tinha no array estruturado mas tem campos diretos de transferência antiga
      if (ofItem.unidade_transferida_de && listaTransferencias.length === 0) {
        const chaveLegada = `LEGADA_${ofItem.unidade_transferida_de}_${ofItem.unidade}`;
        if (!transferenciasSet.has(chaveLegada)) {
          transferenciasSet.add(chaveLegada);
          const tLegada = {
            data: ofItem.data_transferencia || ofItem.updated_date || ofItem.created_date,
            de: ofItem.unidade_transferida_de,
            para: ofItem.unidade || unidadeAtual,
            usuario: ofItem.usuario_transferencia || "PCP",
            motivo: ofItem.motivo_transferencia || "Transferência de central registrada no sistema"
          };
          listaTransferencias.push(tLegada);
          eventos.push({
            id: chaveLegada,
            tipo: "transferencia",
            titulo: "Transferência de Central PCP",
            data: tLegada.data,
            usuario: tLegada.usuario,
            de: tLegada.de,
            para: tLegada.para,
            motivo: tLegada.motivo,
            detalhes: `Transferido de ${tLegada.de} para ${tLegada.para}. Motivo: ${tLegada.motivo}`
          });
        }
      }

      // 2. Extrai histórico geral de logs do PCP (distribuições, prioridades, exclusões)
      try {
        const logs = typeof ofItem.historico_log === "string"
          ? JSON.parse(ofItem.historico_log || "[]")
          : (Array.isArray(ofItem.historico_log) ? ofItem.historico_log : []);

        logs.forEach((log, idx) => {
          const chaveLog = `${log.data}_${log.acao}_${idx}`;
          // Se for log de transferência e já adicionamos acima, evita duplicação
          if (log.acao === "transferencia_unidade_item" || log.acao === "transferencia") return;

          let tipo = "info";
          let titulo = "Evento do PCP";
          if (log.acao?.includes("prioridade")) {
            tipo = "prioridade";
            titulo = "Alteração de Prioridade / Rota";
          } else if (log.acao?.includes("distribuicao")) {
            tipo = "distribuicao";
            titulo = "Distribuição para Máquinas";
          } else if (log.acao?.includes("chegada")) {
            tipo = "chegada";
            titulo = "Chegada na Central PCP";
          } else if (log.acao?.includes("devolucao")) {
            tipo = "devolucao";
            titulo = "Devolução à Mesa do PCP";
          }

          eventos.push({
            id: chaveLog,
            tipo,
            titulo,
            data: log.data,
            usuario: log.usuario || "Sistema PCP",
            detalhes: log.detalhes || log.motivo || log.acao
          });
        });
      } catch (e) {
        console.warn("[HistoricoMovimentacao] Erro ao parsear historico_log:", e);
      }

      // 3. Chegada no PCP (se não houver log explícito de chegada)
      if (ofItem.data_recebimento) {
        const chaveChegada = `CHEGADA_${ofItem.data_recebimento}`;
        if (!eventos.some((ev) => ev.tipo === "chegada")) {
          eventos.push({
            id: chaveChegada,
            tipo: "chegada",
            titulo: "Chegada no PCP (Fila de Entrada)",
            data: ofItem.data_recebimento,
            usuario: "Integração Odoo",
            detalhes: `Pedido recebido e alocado na central da ${ofItem.unidade || unidadeAtual}`
          });
        }
      }

      // 4. Conclusão 100%
      if (ofItem.status_pcp === "concluido" || ofItem.percentual_concluido === 100) {
        const chaveConclusao = `CONCLUSAO_${ofItem.id}`;
        eventos.push({
          id: chaveConclusao,
          tipo: "conclusao",
          titulo: "Pedido Concluído 100%",
          data: ofItem.updated_date || ofItem.created_date,
          usuario: ofItem.finalizado_por || "Fábrica / PCP",
          detalhes: "Todas as etapas industriais foram finalizadas."
        });
      }
    });

    // Ordena do evento mais recente para o mais antigo
    eventos.sort((a, b) => {
      const timeA = new Date(a.data || 0).getTime();
      const timeB = new Date(b.data || 0).getTime();
      return timeB - timeA;
    });

    return {
      timeline: eventos,
      transferenciasRecentes: listaTransferencias
    };
  }, [ofs, unidadeAtual]);

  // Se o pedido teve transferência recente
  const ultimaTransferencia = transferenciasRecentes[transferenciasRecentes.length - 1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* Topo do Modal */}
        <DialogHeader className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Histórico de Movimentação do Pedido</span>
                <Badge variant="outline" className="text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200">
                  {numeroPedido}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Cliente: <span className="font-semibold text-slate-700 dark:text-slate-300">{clienteNome}</span> · Vendedor: <span className="font-semibold text-slate-700 dark:text-slate-300">{vendedorNome}</span> · Filial Atual: <span className="font-bold text-blue-600 dark:text-blue-400">{unidadeAtual}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-700 dark:text-slate-200">

          {/* Destaque Superior: Alerta Explicativo de Transferência (caso tenha sido transferido) */}
          {ultimaTransferencia && (
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Detalhes da Transferência de Central</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">De ➔ Para:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {ultimaTransferencia.de} ➔ {ultimaTransferencia.para}
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Quem transferiu:</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    {ultimaTransferencia.usuario || "Operador do PCP"}
                  </span>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40 text-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-amber-600" />
                  Motivo / Justificativa informada:
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 italic">
                  "{ultimaTransferencia.motivo || "Transferência de item realizada pelo PCP sem justificativa descrita."}"
                </p>
                <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block mt-1">
                  Transferido em: {formatarDataHoraSegura(ultimaTransferencia.data)}
                </span>
              </div>
            </div>
          )}

          {/* Linha do Tempo Vertical */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              Linha do Tempo de Movimentação ({timeline.length} registro{timeline.length !== 1 ? "s" : ""})
            </h4>

            {timeline.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Nenhum registro de movimentação anterior gravado.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Este pedido foi alocado diretamente na fila de produção da {unidadeAtual}.
                </p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3.5 space-y-4 py-1">
                {timeline.map((ev, index) => {
                  let badgeColor = "bg-slate-100 text-slate-700 border-slate-300";
                  let IconComponent = Clock;

                  if (ev.tipo === "transferencia") {
                    badgeColor = "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700";
                    IconComponent = ArrowRightLeft;
                  } else if (ev.tipo === "distribuicao") {
                    badgeColor = "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700";
                    IconComponent = Factory;
                  } else if (ev.tipo === "prioridade") {
                    badgeColor = "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-700";
                    IconComponent = Flame;
                  } else if (ev.tipo === "conclusao") {
                    badgeColor = "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700";
                    IconComponent = CheckCircle2;
                  } else if (ev.tipo === "chegada") {
                    badgeColor = "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700";
                    IconComponent = Calendar;
                  }

                  return (
                    <div key={ev.id || index} className="relative pl-6">
                      {/* Ponto / Ícone no eixo vertical */}
                      <span className={`absolute -left-2.5 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-900 ${
                        ev.tipo === "transferencia"
                          ? "border-amber-500 text-amber-500"
                          : ev.tipo === "distribuicao"
                          ? "border-blue-500 text-blue-500"
                          : ev.tipo === "prioridade"
                          ? "border-orange-500 text-orange-500"
                          : ev.tipo === "conclusao"
                          ? "border-emerald-500 text-emerald-500"
                          : "border-slate-400 text-slate-400"
                      }`}>
                        <IconComponent className="w-2.5 h-2.5" />
                      </span>

                      {/* Card do Evento */}
                      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                            {ev.titulo}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {formatarDataHoraSegura(ev.data)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                          {ev.detalhes}
                        </p>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>Responsável: <strong className="text-slate-700 dark:text-slate-300">{ev.usuario}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com Fechar */}
        <DialogFooter className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold px-4"
          >
            Fechar
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
