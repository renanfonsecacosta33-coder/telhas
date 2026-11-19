import React, { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Factory,
  Check,
  AlertCircle,
  Loader2,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  identificarRoteiroDoPedido,
  processarConclusaoEtapas
} from "@/lib/roteiroEtapasProducaoHelper";
import { finalizarOpsDoPedido } from "@/lib/conciliacaoPcpMaquinasHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { normalizarPrioridadeNivelNumerico } from "@/lib/prioridadeHelper";
import { getItens } from "@/lib/pedidoOdooHelper";

/**
 * Dialog interativo para seleção e finalização individual de etapas de produção
 * (Perfiladeira, Colagem, Desbobinadeira, Guilhotina, Dobradeira ou 100%).
 */
export default function ModalFinalizarEtapasCalendario({
  open,
  onOpenChange,
  pedido,
  ofAlvo = null,
  pedidosProducao = [],
  ordensCD = [],
  usuario = "Central PCP"
}) {
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [etapas, setEtapas] = useState([]);

  // Roteiro inteligente calculado para este pedido / OF
  useEffect(() => {
    if (!open || !pedido) return;

    const base = ofAlvo || pedido;
    const etapasDetectadas = identificarRoteiroDoPedido(pedido, ofAlvo);

    // Ajusta o status de concluído conforme o estado atual
    const etapasInicializadas = etapasDetectadas.map((etp) => {
      let isConcluida = Boolean(etp.concluida);
      if (base.status === "finalizado" || base.status_pcp === "concluido" || base.percentual_concluido >= 100) {
        isConcluida = true;
      } else if (etp.id === "telha_superior" || etp.id === "perfilacao_telha") {
        if (base.status === "aguardando_colagem" || base.maquina === "COLAGEM" || base.perfilacao_concluida) {
          isConcluida = true;
        }
      }
      return { ...etp, concluida: isConcluida };
    });

    setEtapas(etapasInicializadas);
  }, [open, pedido, ofAlvo]);

  // Alterna uma etapa individual no checkbox
  const handleToggleEtapa = (id) => {
    setEtapas((prev) =>
      prev.map((e) => (e.id === id ? { ...e, concluida: !e.concluida } : e))
    );
  };

  // Atalho: Concluir Todas (100%)
  const handleConcluirTodas = () => {
    setEtapas((prev) => prev.map((e) => ({ ...e, concluida: true })));
  };

  // Atalho: Concluir Próxima Pendente
  const handleConcluirProxima = () => {
    let jaMarcou = false;
    setEtapas((prev) =>
      prev.map((e) => {
        if (!e.concluida && !jaMarcou) {
          jaMarcou = true;
          return { ...e, concluida: true };
        }
        return e;
      })
    );
  };

  const totalEtapas = etapas.length;
  const concluidasCount = etapas.filter((e) => e.concluida).length;
  const todasMarcadas = totalEtapas > 0 && concluidasCount === totalEtapas;
  const nenhumaMarcada = concluidasCount === 0;

  // Próxima etapa a ser executada no chão de fábrica após as selecionadas
  const proximaEtapaAposConclusao = useMemo(() => {
    return etapas.find((e) => !e.concluida);
  }, [etapas]);

  // Executa a confirmação da baixa
  const handleConfirmar = async () => {
    if (!pedido) return;
    setSalvando(true);

    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const numPed = pedido.numero_pedido || pedido.id;

      // ─────────────────────────────────────────────────────────────
      // CASO 1: TODAS AS ETAPAS ESTÃO MARCADAS COMO CONCLUÍDAS (100%)
      // ─────────────────────────────────────────────────────────────
      if (todasMarcadas) {
        // Se há uma OF específica alvo de um grupo com múltiplas OFs:
        if (ofAlvo && ofAlvo.id && ofAlvo.id !== pedido.id) {
          // Atualiza a OF alvo específica
          const itensOf = getItens(ofAlvo).map((i) => ({
            ...i,
            concluido: true,
            status: "concluido",
            status_detalhado: "Concluído"
          }));

          await base44.entities.PedidoOdoo.update(ofAlvo.id, {
            status_pcp: "concluido",
            percentual_concluido: 100,
            onde_esta: "Expedição / Concluído",
            data_conclusao: todayIso,
            etapas_concluidas_json: JSON.stringify(etapas),
            ...(itensOf.length ? { itens_json: JSON.stringify(itensOf) } : {})
          });

          // Finaliza OPs locais vinculadas a esta OF específica
          try {
            await finalizarOpsDoPedido({ pedido: ofAlvo, usuario });
          } catch (e) {
            console.warn("Falha ao finalizar OPs locais da OF alvo:", e);
          }

          // Verifica se as outras OFs do mesmo pedido também estão concluídas
          const outrasOfs = (pedido.ofs || []).filter((o) => o.id !== ofAlvo.id);
          const todasOutrasConcluidas = outrasOfs.every(
            (o) => o.status_pcp === "concluido" || (o.percentual_concluido || 0) >= 100
          );

          if (todasOutrasConcluidas && pedido.id) {
            await base44.entities.PedidoOdoo.update(pedido.id, {
              status_pcp: "concluido",
              percentual_concluido: 100,
              onde_esta: "Expedição / Concluído",
              data_conclusao: todayIso
            }).catch(() => {});
          }

          toast.success(`🎉 OF #${ofAlvo.of_nome || ofAlvo.id} finalizada com sucesso (100%)!`);
        } else {
          // Finalização completa do Pedido Principal / Grupo
          const itens = getItens(pedido).map((i) => ({
            ...i,
            concluido: true,
            status: "concluido",
            status_detalhado: "Concluído"
          }));

          const nivelNum = normalizarPrioridadeNivelNumerico(
            pedido.prioridade_nivel,
            pedido.tipo_prioridade || (pedido.is_rota ? "ROTA" : pedido.cliente_retira_agora ? "RETIRA_AGORA" : null)
          );

          if (pedido.id) {
            await base44.entities.PedidoOdoo.update(pedido.id, {
              status_pcp: "concluido",
              percentual_concluido: 100,
              onde_esta: "Expedição / Concluído",
              data_conclusao: todayIso,
              ...(typeof nivelNum === "number" && !isNaN(nivelNum) ? { prioridade_nivel: nivelNum } : {}),
              etapas_concluidas_json: JSON.stringify(etapas),
              ...(itens.length ? { itens_json: JSON.stringify(itens) } : {})
            });
          }

          // Se tiver OFs filhas, finaliza todas
          if (pedido.ofs && pedido.ofs.length > 0) {
            for (const ofFilha of pedido.ofs) {
              if (ofFilha.id && ofFilha.id !== pedido.id) {
                await base44.entities.PedidoOdoo.update(ofFilha.id, {
                  status_pcp: "concluido",
                  percentual_concluido: 100,
                  onde_esta: "Expedição / Concluído",
                  data_conclusao: todayIso
                }).catch(() => {});
              }
            }
          }

          // Notifica Odoo ERP
          try {
            await notificarStatus(
              {
                ...pedido,
                percentual_concluido: 100,
                status_pcp: "concluido"
              },
              "concluido",
              {
                percentual_concluido: 100,
                status_novo: "concluido",
                item_nome: `Pedido #${numPed}`
              }
            );
          } catch (e) {
            console.warn("Falha ao notificar Odoo ERP:", e);
          }

          // Finaliza OPs locais no chão de fábrica
          await finalizarOpsDoPedido({ pedido, usuario });

          toast.success(`🎉 Pedido #${numPed} finalizado em 100% com sucesso!`, {
            description: "Todas as ordens e etapas foram dadas como concluídas e sincronizadas."
          });
        }
      }

      // ─────────────────────────────────────────────────────────────
      // CASO 2: CONCLUSÃO DE ETAPAS INTERMEDIÁRIAS (Avança de Máquina)
      // ─────────────────────────────────────────────────────────────
      else if (proximaEtapaAposConclusao) {
        const maquinaDestino = proximaEtapaAposConclusao.maquina;
        const novoPercentual = Math.max(
          10,
          Math.min(95, Math.round((concluidasCount / totalEtapas) * 100))
        );
        const statusOpNovo = maquinaDestino === "COLAGEM" ? "aguardando_colagem" : "pendente";
        const ondeEstaNovo = `Fila da ${maquinaDestino} (Galpão)`;

        const alvoAtualizar = ofAlvo || pedido;

        if (alvoAtualizar.id) {
          await base44.entities.PedidoOdoo.update(alvoAtualizar.id, {
            maquina: maquinaDestino,
            status_pcp: "em_producao",
            status: statusOpNovo,
            onde_esta: ondeEstaNovo,
            percentual_concluido: novoPercentual,
            perfilacao_concluida: true,
            bloqueado_colagem: false,
            etapas_concluidas_json: JSON.stringify(etapas)
          });
        }

        // Atualiza a OP física correspondente no chão de fábrica
        const opsTelhas = await base44.entities.Pedido.filter({
          numero_pedido: alvoAtualizar.numero_pedido || pedido.numero_pedido
        }).catch(() => []);

        if (opsTelhas && opsTelhas.length > 0) {
          for (const op of opsTelhas) {
            if (maquinaDestino === "COLAGEM") {
              await base44.entities.Pedido.update(op.id, {
                maquina: "COLAGEM",
                status: "aguardando_colagem",
                bloqueado_colagem: false,
                perfilacao_concluida: true,
                data_perfilacao: todayIso,
                operador_perfilacao: usuario
              });
            } else {
              await base44.entities.Pedido.update(op.id, {
                maquina: maquinaDestino,
                status: "pendente"
              });
            }
          }
        }

        // Se for Corte e Dobra
        const opsCD = await base44.entities.OrdemMaquinaCD.filter({
          numero_pedido: alvoAtualizar.numero_pedido || pedido.numero_pedido
        }).catch(() => []);

        if (opsCD && opsCD.length > 0) {
          for (const op of opsCD) {
            await base44.entities.OrdemMaquinaCD.update(op.id, {
              status: "em_producao",
              maquina: maquinaDestino
            });
          }
        }

        toast.success(
          `🚀 Etapa concluída! Ordem avançou para a ${maquinaDestino} (${novoPercentual}%)`,
          {
            description: `Liberada para execução na ${maquinaDestino}.`
          }
        );
      }

      // Invalidação de queries em tempo real
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina"] });

      onOpenChange?.(false);
    } catch (err) {
      console.error("Erro ao confirmar etapas:", err);
      toast.error(`Falha ao concluir etapas: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  if (!pedido) return null;

  const numPed = pedido.numero_pedido || pedido.id;
  const cliente = pedido.cliente_nome || pedido.cliente || "Cliente";
  const ofNome = ofAlvo?.of_nome || ofAlvo?.of_odoo_id || ofAlvo?.id;
  const produtoNome = ofAlvo?.produto || ofAlvo?.descricao || pedido.produto || "Telhas / Perfis";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[95vw] rounded-2xl p-5 border-slate-200 dark:border-slate-800 shadow-xl">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
              <Factory className="w-4 h-4" /> Finalização de Etapas de Produção
            </span>
            <Badge variant="outline" className="font-mono text-xs font-black">
              #{numPed}
            </Badge>
          </div>
          <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            {ofAlvo ? `OF: ${ofNome}` : `Pedido #${numPed}`}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Cliente: <strong className="text-slate-700 dark:text-slate-200">{cliente}</strong>
            {produtoNome && (
              <span className="block text-[11px] text-slate-400 mt-0.5 truncate">
                Produto: {produtoNome}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Barra de Progresso Resultante */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>Progresso Selecionado:</span>
            <span
              className={
                todasMarcadas
                  ? "text-emerald-600 font-black"
                  : "text-orange-600 font-extrabold"
              }
            >
              {concluidasCount} de {totalEtapas} etapas (
              {totalEtapas > 0 ? Math.round((concluidasCount / totalEtapas) * 100) : 0}%)
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                todasMarcadas
                  ? "bg-emerald-500"
                  : concluidasCount > 0
                  ? "bg-orange-500"
                  : "bg-slate-300"
              }`}
              style={{
                width: `${totalEtapas > 0 ? (concluidasCount / totalEtapas) * 100 : 0}%`
              }}
            />
          </div>
        </div>

        {/* Lista de Etapas com Checkboxes */}
        <div className="space-y-2 py-1 max-h-[300px] overflow-y-auto pr-1">
          {etapas.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              Nenhuma etapa detectada para este modelo de telha/peça.
            </div>
          ) : (
            etapas.map((etp, idx) => {
              const isUltima = idx === etapas.length - 1;
              const isChecked = etp.concluida;

              return (
                <div
                  key={etp.id || idx}
                  onClick={() => handleToggleEtapa(etp.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                      : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => handleToggleEtapa(etp.id)}
                    className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span
                        className={`text-xs font-bold ${
                          isChecked
                            ? "text-emerald-950 dark:text-emerald-200 line-through opacity-80"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {etp.nome}
                      </span>
                      {isChecked ? (
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                          ✓ Baixada
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {etp.maquina || "Máquina"}
                        </span>
                      )}
                    </div>
                    {etp.descricao && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {etp.descricao}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Botões de Seleção Rápida */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={handleConcluirProxima}
            className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Concluir Próxima
          </button>
          <button
            type="button"
            onClick={handleConcluirTodas}
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" /> Marcar 100%
          </button>
        </div>

        {/* Rodapé com Ações */}
        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange?.(false)}
            disabled={salvando}
            className="text-xs font-bold"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmar}
            disabled={salvando || nenhumaMarcada}
            className={`text-xs font-bold gap-1.5 text-white ${
              todasMarcadas
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                : "bg-orange-600 hover:bg-orange-700 shadow-sm"
            }`}
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : todasMarcadas ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finalizar em 100%
              </>
            ) : (
              <>
                <ArrowRight className="w-3.5 h-3.5" />
                Confirmar e Avançar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
