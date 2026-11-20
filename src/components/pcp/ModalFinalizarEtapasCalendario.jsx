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
  Sparkles,
  Scissors,
  Copy
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
import { opDaMesmaOf } from "@/lib/opVinculoSeguro";

/**
 * Dialog interativo para seleção dinâmica e finalização individual de etapas de produção
 * com suporte completo a Corte & Dobra (Desbobinadeira, Guilhotina, Dobradeira) e Telhas.
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

  // Lista de OFs a serem gerenciadas (OF única ou todas do grupo)
  const listaOfs = useMemo(() => {
    if (!pedido) return [];
    if (ofAlvo) return [ofAlvo];
    if (Array.isArray(pedido.ofs) && pedido.ofs.length > 0) return pedido.ofs;
    return [pedido];
  }, [pedido, ofAlvo]);

  // OF ativa selecionada na interface (quando há múltiplas OFs)
  const [ofAtivaId, setOfAtivaId] = useState(null);

  // Mapa de etapas por OF: { [ofId]: Etapa[] }
  const [etapasPorOf, setEtapasPorOf] = useState({});

  // Inicializa o roteiro para cada OF do pedido
  useEffect(() => {
    if (!open || !pedido || listaOfs.length === 0) return;

    const mapa = {};
    listaOfs.forEach((ofItem) => {
      const ofKey = ofItem.id || ofItem.of_nome || ofItem.numero_pedido || "unica";
      const etapasDetectadas = identificarRoteiroDoPedido(pedido, ofItem, pedidosProducao);

      const base = ofItem || pedido;
      const opVinculada = (pedidosProducao || []).find((op) => opDaMesmaOf(op, ofItem));
      const opMaq = String(opVinculada?.maquina || opVinculada?.maquina_nome || "").toUpperCase();

      const jaNaColagem = Boolean(
        opMaq === "COLAGEM" ||
        base.status === "aguardando_colagem" ||
        base.maquina === "COLAGEM" ||
        pedido.maquina === "COLAGEM" ||
        base.perfilacao_concluida ||
        pedido.perfilacao_concluida ||
        String(base.onde_esta || "").toUpperCase().includes("COLAGEM") ||
        String(pedido.onde_esta || "").toUpperCase().includes("COLAGEM")
      );

      const inicializadas = etapasDetectadas.map((etp) => {
        let isConcluida = Boolean(etp.concluida);
        if (
          base.status === "finalizado" ||
          base.status_pcp === "concluido" ||
          (Number(base.percentual_concluido) || 0) >= 100
        ) {
          isConcluida = true;
        } else if (
          etp.id === "telha_superior" ||
          etp.id === "telha_inferior" ||
          etp.id === "bandeja_inferior" ||
          etp.id === "perfilacao_telha" ||
          etp.id === "perfilacao_telha_simples"
        ) {
          if (jaNaColagem) {
            isConcluida = true;
          }
        }
        return {
          ...etp,
          ativo: etp.ativo !== false,
          concluida: isConcluida
        };
      });

      mapa[ofKey] = inicializadas;
    });

    setEtapasPorOf(mapa);
    setOfAtivaId(listaOfs[0]?.id || listaOfs[0]?.of_nome || "unica");
  }, [open, pedido, ofAlvo, listaOfs]);

  // Identificador da OF atualmente selecionada
  const ofAtiva = useMemo(() => {
    return (
      listaOfs.find((o) => (o.id || o.of_nome || "unica") === ofAtivaId) ||
      listaOfs[0] ||
      null
    );
  }, [listaOfs, ofAtivaId]);

  const ofAtivaKey = ofAtiva?.id || ofAtiva?.of_nome || ofAtiva?.numero_pedido || "unica";
  const etapasAtuais = etapasPorOf[ofAtivaKey] || [];

  // Verifica se a OF ativa é Corte & Dobra
  const ehCorteDobra = useMemo(() => {
    if (!ofAtiva && !pedido) return false;
    const txt = `${ofAtiva?.produto || ""} ${ofAtiva?.item_produto || ""} ${ofAtiva?.descricao || ""} ${pedido?.produto || ""} ${pedido?.setor || ""}`.toLowerCase();
    return (
      ofAtiva?.setor === "corte_dobra" ||
      ofAtiva?.setor === "cd" ||
      pedido?.setor === "corte_dobra" ||
      pedido?.setor === "cd" ||
      /\b(dobra|dobradeira|guilhotina|desbobinadeira|chapa|perfil dobrado|rufo|calha|cartola|cantoneira|u enrijecido)\b/i.test(txt)
    );
  }, [ofAtiva, pedido]);

  // Alterna ativação/desativação de uma etapa no roteiro (ex: ligar/desligar Dobradeira)
  const handleToggleAtivoEtapa = (etapaId) => {
    setEtapasPorOf((prev) => {
      const lista = prev[ofAtivaKey] || [];
      const atualizada = lista.map((e) =>
        e.id === etapaId ? { ...e, ativo: !e.ativo, concluida: !e.ativo ? e.concluida : false } : e
      );
      return { ...prev, [ofAtivaKey]: atualizada };
    });
  };

  // Alterna o checkbox de conclusão de uma etapa individual
  const handleToggleConcluidaEtapa = (etapaId) => {
    setEtapasPorOf((prev) => {
      const lista = prev[ofAtivaKey] || [];
      const atualizada = lista.map((e) =>
        e.id === etapaId ? { ...e, concluida: !e.concluida } : e
      );
      return { ...prev, [ofAtivaKey]: atualizada };
    });
  };

  // Copia o roteiro de etapas ativas da OF atual para todas as outras OFs do pedido
  const handleCopiarRoteiroParaTodasOfs = () => {
    if (listaOfs.length <= 1) return;
    const roteiroModelo = etapasAtuais;
    setEtapasPorOf((prev) => {
      const novoMapa = { ...prev };
      listaOfs.forEach((ofItem) => {
        const k = ofItem.id || ofItem.of_nome || ofItem.numero_pedido || "unica";
        if (k !== ofAtivaKey) {
          const existentes = prev[k] || [];
          novoMapa[k] = existentes.map((e) => {
            const modelo = roteiroModelo.find((m) => m.id === e.id);
            return modelo ? { ...e, ativo: modelo.ativo } : e;
          });
        }
      });
      return novoMapa;
    });
    toast.success("Roteiro de etapas aplicado a todas as OFs do pedido!");
  };

  // Concluir Próxima Etapa da OF ativa
  const handleConcluirProxima = () => {
    let jaMarcou = false;
    setEtapasPorOf((prev) => {
      const lista = prev[ofAtivaKey] || [];
      const atualizada = lista.map((e) => {
        if (e.ativo !== false && !e.concluida && !jaMarcou) {
          jaMarcou = true;
          return { ...e, concluida: true };
        }
        return e;
      });
      return { ...prev, [ofAtivaKey]: atualizada };
    });
  };

  // Concluir Todas as etapas da OF ativa (ou de todas as OFs se for grupo)
  const handleMarcarTodas100 = () => {
    setEtapasPorOf((prev) => {
      const novoMapa = {};
      Object.keys(prev).forEach((k) => {
        novoMapa[k] = prev[k].map((e) =>
          e.ativo !== false ? { ...e, concluida: true } : e
        );
      });
      return novoMapa;
    });
    toast.info("Todas as etapas ativas foram marcadas como concluídas!");
  };

  // Métricas da OF ativa
  const etapasAtivasOfAtiva = etapasAtuais.filter((e) => e.ativo !== false);
  const totalEtapasAtivas = etapasAtivasOfAtiva.length;
  const concluidasCount = etapasAtivasOfAtiva.filter((e) => e.concluida).length;
  const todasMarcadasOfAtiva = totalEtapasAtivas > 0 && concluidasCount === totalEtapasAtivas;
  const nenhumaMarcada = concluidasCount === 0;

  // Próxima etapa a ser executada na fábrica após a seleção
  const proximaEtapaAposConclusao = useMemo(() => {
    return etapasAtivasOfAtiva.find((e) => !e.concluida);
  }, [etapasAtivasOfAtiva]);

  // Executa a confirmação da baixa
  const handleConfirmar = async () => {
    if (!pedido) return;
    setSalvando(true);

    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const numPed = pedido.numero_pedido || pedido.id;

      // Itera por cada OF da lista para salvar as etapas configuradas
      let totalConcluidasGeral = 0;
      let totalOfsConcluidas = 0;

      for (const ofItem of listaOfs) {
        const ofKey = ofItem.id || ofItem.of_nome || ofItem.numero_pedido || "unica";
        const etapasOf = etapasPorOf[ofKey] || [];
        const ativas = etapasOf.filter((e) => e.ativo !== false);
        const concluidas = ativas.filter((e) => e.concluida);
        const todasOf = ativas.length > 0 && concluidas.length === ativas.length;

        const targetId = ofItem.id || pedido.id;
        const targetPed = ofItem || pedido;

        if (todasOf) {
          totalOfsConcluidas++;
          // Baixa 100% nesta OF
          const itensOf = getItens(targetPed).map((i) => ({
            ...i,
            concluido: true,
            status: "concluido",
            status_detalhado: "Concluído"
          }));

          const nivelNum = normalizarPrioridadeNivelNumerico(
            targetPed.prioridade_nivel || pedido.prioridade_nivel,
            targetPed.tipo_prioridade || (targetPed.is_rota ? "ROTA" : targetPed.cliente_retira_agora ? "RETIRA_AGORA" : null)
          );

          if (targetId) {
            await base44.entities.PedidoOdoo.update(targetId, {
              status_pcp: "concluido",
              percentual_concluido: 100,
              onde_esta: "Expedição / Concluído",
              data_conclusao: todayIso,
              ...(typeof nivelNum === "number" && !isNaN(nivelNum) ? { prioridade_nivel: nivelNum } : {}),
              etapas_concluidas_json: JSON.stringify(etapasOf),
              ...(itensOf.length ? { itens_json: JSON.stringify(itensOf) } : {})
            });
          }

          // Finaliza OPs locais vinculadas a esta OF
          try {
            await finalizarOpsDoPedido({ pedido: targetPed, usuario });
          } catch (e) {
            console.warn("Falha ao finalizar OPs locais:", e);
          }
        } else if (concluidas.length > 0) {
          // Baixa parcial: avança para a próxima etapa ativa
          const prox = ativas.find((e) => !e.concluida);
          if (prox) {
            const maquinaDestino = prox.maquina;
            const novoPercentual = Math.max(
              10,
              Math.min(95, Math.round((concluidas.length / (ativas.length || 1)) * 100))
            );
            const statusOpNovo = maquinaDestino === "COLAGEM" ? "aguardando_colagem" : "pendente";
            const ondeEstaNovo = `Fila da ${maquinaDestino} (Galpão)`;

            if (targetId) {
              await base44.entities.PedidoOdoo.update(targetId, {
                maquina: maquinaDestino,
                status_pcp: "em_producao",
                status: statusOpNovo,
                onde_esta: ondeEstaNovo,
                percentual_concluido: novoPercentual,
                perfilacao_concluida: true,
                bloqueado_colagem: false,
                etapas_concluidas_json: JSON.stringify(etapasOf)
              });
            }

            // Encaminha máquina local no chão de fábrica:
            if (prox.setor === "cd") {
              const opsCD = await base44.entities.OrdemMaquinaCD.filter({
                numero_pedido: targetPed.numero_pedido || pedido.numero_pedido
              }).catch(() => []);

              if (opsCD && opsCD.length > 0) {
                for (const op of opsCD) {
                  await base44.entities.OrdemMaquinaCD.update(op.id, {
                    maquina: maquinaDestino,
                    status: "pendente"
                  });
                }
              } else {
                await base44.entities.OrdemMaquinaCD.create({
                  numero_pedido: targetPed.numero_pedido || pedido.numero_pedido,
                  cliente: targetPed.cliente_nome || targetPed.cliente || "Cliente",
                  vendedor: targetPed.vendedor_nome || "—",
                  produto: targetPed.produto || "Corte e Dobra",
                  maquina: maquinaDestino,
                  status: "pendente",
                  data: todayIso,
                  data_entrega: targetPed.data_entrega || todayIso,
                  unidade: targetPed.unidade || "Matriz AJL"
                }).catch(() => {});
              }
            } else {
              // Telhas
              const opsTelhas = await base44.entities.Pedido.filter({
                numero_pedido: targetPed.numero_pedido || pedido.numero_pedido
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
            }
          }
        }
      }

      // Se todas as OFs do pedido forem concluídas, fecha o grupo principal e notifica o Odoo
      const todasDoPedido100 = totalOfsConcluidas === listaOfs.length && listaOfs.length > 0;
      if (todasDoPedido100 && pedido.id) {
        await base44.entities.PedidoOdoo.update(pedido.id, {
          status_pcp: "concluido",
          percentual_concluido: 100,
          onde_esta: "Expedição / Concluído",
          data_conclusao: todayIso
        }).catch(() => {});

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

        toast.success(`🎉 Pedido #${numPed} concluído 100% com sucesso e notificado no Odoo ERP!`);
      } else {
        toast.success(`✅ Etapas salvas com sucesso! As ordens avançaram para as próximas máquinas.`);
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
  const ofNome = ofAtiva?.of_nome || ofAtiva?.of_odoo_id || ofAtiva?.id;

  const itensOf = getItens(ofAtiva);
  const primeiroItemOf = itensOf[0];
  const produtoNome = primeiroItemOf?.produto || ofAtiva?.produto || pedido.produto || "";
  const descricaoMedidas = primeiroItemOf?.descricao || ofAtiva?.descricao || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-w-[95vw] rounded-2xl p-5 border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-1.5 text-left pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase text-orange-600 dark:text-orange-400 flex items-center gap-1.5 tracking-wide">
              <Factory className="w-4 h-4" /> Finalização de Etapas de Produção
            </span>
            <Badge variant="outline" className="font-mono text-xs font-black bg-slate-50 dark:bg-slate-900">
              #{numPed}
            </Badge>
          </div>
          <DialogTitle className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>{listaOfs.length > 1 ? `Pedido #${numPed} (${listaOfs.length} OFs)` : `OF: ${ofNome}`}</span>
            {listaOfs.length > 1 && (
              <span className="text-[11px] font-normal text-slate-400">
                Selecione cada OF para configurar ou baixe tudo
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Cliente: <strong className="text-slate-700 dark:text-slate-200">{cliente}</strong>
            {produtoNome && (
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 mt-1 truncate" title={produtoNome}>
                Produto: {produtoNome}
              </span>
            )}
            {descricaoMedidas && descricaoMedidas !== produtoNome && (
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 italic mt-0.5 truncate" title={descricaoMedidas}>
                Medidas: {descricaoMedidas}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Abas de Navegação entre OFs se houver múltiplas */}
        {listaOfs.length > 1 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>OFs do Pedido:</span>
              <button
                type="button"
                onClick={handleCopiarRoteiroParaTodasOfs}
                className="text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer font-extrabold"
                title="Aplica a mesma seleção de etapas ativas da OF atual para todas as outras"
              >
                <Copy className="w-3 h-3" /> Aplicar este roteiro a todas as OFs
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {listaOfs.map((ofItem, idx) => {
                const k = ofItem.id || ofItem.of_nome || ofItem.numero_pedido || "unica";
                const isSelected = k === ofAtivaKey;
                const etapasDestaOf = etapasPorOf[k] || [];
                const ativasDestaOf = etapasDestaOf.filter((e) => e.ativo !== false);
                const concluidasDestaOf = ativasDestaOf.filter((e) => e.concluida).length;
                const cemPorcento = ativasDestaOf.length > 0 && concluidasDestaOf === ativasDestaOf.length;

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOfAtivaId(k)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>OF {idx + 1}/{listaOfs.length}</span>
                    {cemPorcento ? (
                      <span className="text-[10px] text-emerald-500 font-black">✓ 100%</span>
                    ) : concluidasDestaOf > 0 ? (
                      <span className="text-[10px] text-orange-500 font-extrabold">
                        {concluidasDestaOf}/{ativasDestaOf.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ✂️ Seletor de Etapas Ativas (Exclusivo para Corte & Dobra) */}
        {ehCorteDobra && (
          <div className="bg-orange-50/70 dark:bg-orange-950/20 p-3 rounded-xl border border-orange-200 dark:border-orange-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-orange-950 dark:text-orange-200">
              <span className="flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-orange-600" />
                Roteiro desta peça (escolha quais etapas ela possui):
              </span>
              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                Clique para ligar/desligar
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {etapasAtuais.map((etp) => {
                const isAtivo = etp.ativo !== false;
                return (
                  <button
                    key={etp.id}
                    type="button"
                    onClick={() => handleToggleAtivoEtapa(etp.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isAtivo
                        ? "bg-orange-600 hover:bg-orange-700 text-white shadow-sm ring-1 ring-orange-500"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 line-through opacity-70"
                    }`}
                    title={
                      isAtivo
                        ? `Etapa ${etp.tag || etp.nome} ATIVA. Clique para remover do roteiro desta peça.`
                        : `Etapa ${etp.tag || etp.nome} DESATIVADA. Clique para incluir no roteiro.`
                    }
                  >
                    {isAtivo ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <span className="text-xs font-bold">+</span>
                    )}
                    <span>{etp.tag || etp.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Barra de Progresso Resultante da OF Atual */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
            <span>Progresso da OF ({ofNome}):</span>
            <span
              className={
                todasMarcadasOfAtiva
                  ? "text-emerald-600 font-black"
                  : "text-orange-600 font-extrabold"
              }
            >
              {concluidasCount} de {totalEtapasAtivas} etapas ativas (
              {totalEtapasAtivas > 0
                ? Math.round((concluidasCount / totalEtapasAtivas) * 100)
                : 0}
              %)
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                todasMarcadasOfAtiva
                  ? "bg-emerald-500"
                  : concluidasCount > 0
                  ? "bg-orange-500"
                  : "bg-slate-300"
              }`}
              style={{
                width: `${
                  totalEtapasAtivas > 0
                    ? (concluidasCount / totalEtapasAtivas) * 100
                    : 0
                }%`
              }}
            />
          </div>
        </div>

        {/* Lista de Etapas Ativas com Checkboxes para Baixar */}
        <div className="space-y-2 py-1 max-h-[260px] overflow-y-auto pr-1">
          {totalEtapasAtivas === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Nenhuma etapa ativa selecionada para este item. Clique nos botões acima para ativar ao menos uma etapa.
            </div>
          ) : (
            etapasAtuais
              .filter((e) => e.ativo !== false)
              .map((etp, idx) => {
                const isChecked = etp.concluida;

                return (
                  <div
                    key={etp.id || idx}
                    onClick={() => handleToggleConcluidaEtapa(etp.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 shadow-xs"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleConcluidaEtapa(etp.id)}
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
                          <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                            ✓ Concluída
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {etp.maquina || "Pendente"}
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

        {/* Botões de Atalho */}
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
            onClick={handleMarcarTodas100}
            className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" /> Marcar Todas em 100%
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
              todasMarcadasOfAtiva
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                : "bg-orange-600 hover:bg-orange-700 shadow-sm"
            }`}
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : todasMarcadasOfAtiva ? (
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
