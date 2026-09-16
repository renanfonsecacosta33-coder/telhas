import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { notificarStatus } from "@/lib/biNotificador";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Factory, Scissors, Wind, Tag, Ruler, Package, CheckCircle2, Trash2, ImageIcon, ExternalLink, Star, ShieldAlert, Undo2, RotateCcw, RefreshCw, Disc, AlertTriangle, Layers, Building2, ArrowRightLeft, Store } from "lucide-react";
import { formatDataBR, slaDiasPorCategoria } from "@/lib/sla";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import PedidoItensLista from "@/components/pcp/PedidoItensLista";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import { extrairAnexosLista } from "@/lib/croquiExtractor";
import MaquinaSequenceCD from "@/components/pcp/MaquinaSequenceCD";
import EtapasTelhaSequence from "@/components/pcp/EtapasTelhaSequence";
import { parseItensPedido, progressoChecklist } from "@/lib/regrasFabrica";
import { getItens, classGrupo } from "@/lib/pedidoOdooHelper";
import { verificarEstoquePedido } from "@/lib/estoqueMaterialHelper";
import ProgramadorItensSection from "./ProgramadorItensSection";
import { SeletorPrioridadeDropdown, PrioridadeBadge } from "@/lib/prioridadeHelper";
import SimulacaoEstoqueMaterialDialog from "@/components/pcp/SimulacaoEstoqueMaterialDialog";

export default function PedidoOdooDetalheDialog({
  pedido, open, onOpenChange, onDistribuir, distribuindo,
  onExcluirOS, onRetirarFila, onTogglePrioridade, onSetPrioridade, onToggleItem,
  onDevolverPCP, onTransferir, showTracking = false, progressoReal, onAtualizado,
  onProgramarItem, onProgramarTodosItens,
  estoqueContext = null
}) {
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [senhaDevolverOpen, setSenhaDevolverOpen] = useState(false);
  const [simulacaoOpen, setSimulacaoOpen] = useState(false);
  const [itemSimulacaoSelecionado, setItemSimulacaoSelecionado] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [operadorNome, setOperadorNome] = useState("");
  const [sincronizando, setSincronizando] = useState(false);

  const handleSincronizarOdoo = async () => {
    if (!pedido) return;
    setSincronizando(true);
    try {
      const pct = progressoReal != null ? progressoReal : (pedido.percentual_concluido || 0);
      const isConcluido = pedido.status_pcp === "concluido" || pct >= 100;

      let pedidoParaEnviar = pedido;
      if (isConcluido) {
        // Assegura que todos os itens estejam salvos como concluídos
        const itensAtuais = getItens(pedido);
        const itensAtualizados = itensAtuais.map(i => ({
          ...i,
          status: "concluido",
          status_detalhado: "Concluído",
          concluido: true
        }));
        pedidoParaEnviar = await base44.entities.PedidoOdoo.update(pedido.id, {
          status_pcp: "concluido",
          percentual_concluido: 100,
          itens_json: JSON.stringify(itensAtualizados)
        });
        onAtualizado?.();
      }

      const notifRes = await notificarStatus(pedidoParaEnviar, isConcluido ? "concluido" : "sincronizacao_manual", {
        percentual_concluido: isConcluido ? 100 : pct,
        status_novo: isConcluido ? "concluido" : (pedido.status_pcp || "em_producao"),
        item_nome: `Pedido #${pedido.numero_pedido}`
      });

      if (notifRes && !notifRes.ok) {
        toast.error(`Aviso: O webhook do Odoo retornou erro 500 no processamento. Verifique o log do script do Odoo com o suporte/Gui.`, { duration: 8000 });
      } else {
        toast.success(isConcluido
          ? `OF #${pedido.numero_pedido} marcada como 100% CONCLUÍDA no Odoo ERP!`
          : `Pedido #${pedido.numero_pedido} sincronizado com o Odoo ERP!`
        );
      }
    } catch (err) {
      toast.error("Falha ao sincronizar com o Odoo ERP: " + (err.message || "tente novamente"));
    } finally {
      setSincronizando(false);
    }
  };

  const [resetando, setResetando] = useState(false);

  const handleResetarPedido = async () => {
    if (!pedido) return;
    if (!window.confirm(
      `🔄 ZERAR PRODUÇÃO DA OS #${pedido.numero_pedido}?\n\nIsso irá:\n• Zerar o progresso para 0%\n• Mudar status para 'Pendente de Distribuição'\n• Limpar máquinas e etapas atribuídas\n• Cancelar OPs vinculadas na fábrica\n• Notificar o Odoo ERP com evento de Reset (0%)`
    )) return;

    setResetando(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      // 1. Cancela OPs vinculadas na fábrica
      await base44.entities.OrdemMaquinaCD.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      ).catch(() => {});
      await base44.entities.OrdemDesbobinadeira.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      ).catch(() => {});
      await base44.entities.Pedido.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      ).catch(() => {});

      // 2. Limpa itens para status inicial
      const itensAtuais = getItens(pedido);
      const itensZerados = itensAtuais.map(i => ({
        ...i,
        status: "pendente",
        status_detalhado: "Aguardando Início",
        concluido: false,
        maquina: ""
      }));

      // 3. Atualiza PedidoOdoo
      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "pendente_distribuicao",
        percentual_concluido: 0,
        maquinas_json: "[]",
        etapas_telha_json: "[]",
        itens_json: JSON.stringify(itensZerados)
      });

      // 4. Notifica Odoo do Reset em segundo plano (sem travar a interface)
      notificarStatus(atualizado, "reset", {
        percentual_concluido: 0,
        status_novo: "Aguardando Início",
        item_nome: `Pedido #${pedido.numero_pedido}`
      }).catch(() => {});

      toast.success(`OS #${pedido.numero_pedido} zerada para 0% com sucesso!`);
      onAtualizado?.();
      onOpenChange?.(false);
    } catch (err) {
      toast.error("Erro ao zerar OS: " + (err.message || String(err)));
    } finally {
      setResetando(false);
    }
  };

  // Rastreamento (Mini BI) só na visão do operador (galpão). Busca o nome do operador logado.
  useEffect(() => {
    if (!showTracking) return;
    base44.auth.me()
      .then((u) => setOperadorNome(u?.full_name || u?.email || ""))
      .catch(() => {});
  }, [showTracking]);

  const statusEstoque = useMemo(() => {
    if (!estoqueContext || !pedido) return null;
    return verificarEstoquePedido(pedido, estoqueContext);
  }, [pedido, estoqueContext]);

  if (!pedido) return null;

  const itens = parseItensPedido(pedido.itens_json);
  const espessuras = (() => {
    try { return JSON.parse(pedido.espessuras_tags || "[]"); } catch { return []; }
  })();
  const sla = slaDiasPorCategoria(pedido);
  const chk = progressoChecklist(pedido.itens_json);
  const isPrioritario = !!pedido.prioridade;

  const grupoIcon = {
    telha: <Factory className="w-3.5 h-3.5" />,
    cd: <Scissors className="w-3.5 h-3.5" />,
    frisada: <Wind className="w-3.5 h-3.5" />
  };
  const grupoColor = {
    telha: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    cd: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
    frisada: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30"
  };

  const jaDistribuido = pedido.status_pcp !== "pendente_distribuicao";

  const handleToggleItemLocal = (idx) => {
    if (onToggleItem) {
      onToggleItem(pedido, idx);
    }
  };

  const confirmarExclusao = async () => {
    setExcluindo(true);
    try {
      await onExcluirOS(pedido, motivo);
    } finally {
      setExcluindo(false);
      setConfirmaExcluir(false);
      setMotivo("");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {isPrioritario && (
                <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse gap-0.5 shrink-0">
                  <Star className="w-3 h-3 fill-white" /> URGENTE
                </Badge>
              )}
              <span>Pedido #{pedido.numero_pedido}</span>
              {pedido.of_nome ? (
                <Badge variant="outline" className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 shrink-0">
                  OF: {pedido.of_nome}
                </Badge>
              ) : pedido.of_odoo_id ? (
                <Badge variant="outline" className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 shrink-0">
                  OF: {pedido.of_odoo_id}
                </Badge>
              ) : pedido.odoo_id ? (
                <span className="text-xs font-mono text-slate-400 shrink-0">Odoo:{pedido.odoo_id}</span>
              ) : null}
              {statusEstoque && (
                <Badge
                  onClick={() => {
                    setItemSimulacaoSelecionado(null);
                    setSimulacaoOpen(true);
                  }}
                  className={`text-xs font-bold px-2 py-0.5 border cursor-pointer hover:scale-105 hover:shadow-xs transition-all ${
                    statusEstoque.statusGeral === "disponivel" || statusEstoque.statusGeral === "ok"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25"
                      : statusEstoque.statusGeral === "desbobinar" || statusEstoque.statusGeral === "parcial"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25"
                      : "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 hover:bg-red-500/25"
                  }`}
                  title="Clique para ver a simulação completa de bobinas e consumo"
                >
                  {statusEstoque.badgeGeral}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Detalhamento técnico e distribuição para os galpões
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Cliente</p>
              <p className="font-medium text-slate-800 dark:text-slate-100 truncate" title={pedido.cliente_nome}>{pedido.cliente_nome || "—"}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Vendedor</p>
              <p className="font-medium text-slate-800 dark:text-slate-100 truncate" title={pedido.vendedor_nome}>{pedido.vendedor_nome || "—"}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Data Prometida</p>
              <p className="font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{formatDataBR(pedido.data_entrega)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">SLA</p>
              <p className="font-medium text-orange-600 dark:text-orange-400 whitespace-nowrap">{sla} dias úteis</p>
            </div>
          </div>

          {/* Localização Comercial e Unidade Fabril de Produção */}
          <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <Store className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-500">Loja de Venda:</span>
                <Badge variant="outline" className="font-bold text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                  {pedido.loja_venda || "Matriz AJL"}
                </Badge>
                {pedido.empresa_venda && pedido.empresa_venda !== pedido.loja_venda && (
                  <span className="text-[10px] text-slate-400 hidden md:inline truncate max-w-[180px]" title={pedido.empresa_venda}>
                    ({pedido.empresa_venda})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <Building2 className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-slate-500">Fábrica (PCP):</span>
                <Badge className="font-bold text-xs bg-orange-500 text-white">
                  {pedido.unidade || "Matriz AJL"}
                </Badge>
              </div>

              {pedido.loja_venda && pedido.unidade && pedido.loja_venda !== pedido.unidade && (
                <Badge variant="outline" className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200">
                  🔄 Roteado de {pedido.loja_venda}
                </Badge>
              )}

              {pedido.unidade_transferida_de && (
                <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200" title={pedido.motivo_transferencia}>
                  ↔️ De {pedido.unidade_transferida_de}
                </Badge>
              )}
            </div>

            {onTransferir && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTransferir(pedido)}
                className="gap-1.5 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold shrink-0 ml-auto"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                Transferir Fábrica
              </Button>
            )}
          </div>

          {/* SLA Countdown (Regra 6) */}
          <div className="flex items-center gap-2 flex-wrap">
            <SlaCountdownBadge dataPrometida={pedido.data_entrega} />
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSincronizarOdoo}
                disabled={sincronizando}
                className="gap-1.5 border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? "animate-spin" : ""}`} />
                {sincronizando ? "Sincronizando..." : "Sincronizar com Odoo"}
              </Button>
              <PrioridadeBadge pedido={pedido} />
              {(onSetPrioridade || onTogglePrioridade) && (
                <SeletorPrioridadeDropdown
                  pedido={pedido}
                  onSelectPrioridade={(nivel) => {
                    if (onSetPrioridade) onSetPrioridade(pedido, nivel);
                    else onTogglePrioridade(pedido);
                  }}
                  size="sm"
                  variant="outline"
                />
              )}
            </div>
          </div>

          {/* Fotos e Croquis do Pedido (Odoo) — Todos os anexos em grade completa com visualizador */}
          {extrairAnexosLista(pedido).length > 0 && (
            <div className="rounded-xl border-2 border-blue-300 dark:border-blue-800 overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-950/40 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300 truncate">
                    Fotos e Croquis do Pedido ({extrairAnexosLista(pedido).length})
                  </span>
                </div>
                <span className="text-[11px] font-medium text-blue-500 dark:text-blue-400 shrink-0">Clique na imagem para expandir</span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3">
                <CroquiThumb
                  pedido={pedido}
                  alt={`Croqui do pedido #${pedido.numero_pedido}`}
                  galeriaCompleta={true}
                />
              </div>
            </div>
          )}

          {/* Barra de progresso geral */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
            {(() => {
              const pct = progressoReal != null ? progressoReal : (pedido.percentual_concluido || 0);
              return (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Progresso Geral da Produção</span>
                    <span className={`text-sm font-bold ${pct >= 100 ? "text-emerald-600" : "text-orange-600"}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-amber-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {pct >= 100 && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 100% concluído — pronto para enviar evento de conclusão ao Odoo ERP.
                    </p>
                  )}
                </>
              );
            })()}
          </div>

          {espessuras.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 font-semibold">Espessuras de chapa:</span>
              {espessuras.map((e, i) => (
                <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {e.espessura}mm
                </span>
              ))}
            </div>
          )}

          {/* Conferência de Matéria-Prima em Tempo Real (Estoque) */}
          {statusEstoque && (
            <div className={`rounded-xl border p-3.5 space-y-3 ${
              statusEstoque.statusGeral === "disponivel" || statusEstoque.statusGeral === "ok"
                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                : statusEstoque.statusGeral === "desbobinar" || statusEstoque.statusGeral === "parcial"
                ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                : "bg-red-50/40 dark:bg-red-950/20 border-red-300 dark:border-red-800"
            }`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Disc className={`w-4 h-4 ${
                    statusEstoque.statusGeral === "disponivel" || statusEstoque.statusGeral === "ok"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : statusEstoque.statusGeral === "desbobinar" || statusEstoque.statusGeral === "parcial"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                  }`} />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                      Conferência de Matéria-Prima em Tempo Real (Estoque)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Peso Total a Usar: <strong>{statusEstoque.pesoTotalKg?.toLocaleString("pt-BR")} kg</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setItemSimulacaoSelecionado(null);
                      setSimulacaoOpen(true);
                    }}
                    className="h-7 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-xs"
                  >
                    🔍 Simulação de Bobinas & Saldo
                  </Button>
                  <Badge className={`text-xs font-bold ${
                    statusEstoque.statusGeral === "disponivel" || statusEstoque.statusGeral === "ok"
                      ? "bg-emerald-600 text-white"
                      : statusEstoque.statusGeral === "desbobinar" || statusEstoque.statusGeral === "parcial"
                      ? "bg-amber-600 text-white"
                      : "bg-red-600 text-white"
                  }`}>
                    {statusEstoque.badgeGeral}
                  </Badge>
                </div>
              </div>

              {/* Mensagem OPA em destaque */}
              <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {statusEstoque.opaMensagemGeral}
                </p>
              </div>

              {/* Resumo dos Itens e Simulação Individual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {statusEstoque.analises.map((a, idx) => {
                  const bPrincipal = a.bobinasSimuladas?.[0];
                  const chPrincipal = a.chapasSimuladas?.[0];

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-2 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                            {a.produto || a.descricao || `Item #${idx + 1}`}
                          </span>
                          <Badge className={`text-[10px] shrink-0 font-bold ${
                            a.status === "disponivel"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300"
                              : a.status === "parcial"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300"
                              : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300"
                          }`}>
                            {a.shortBadge}
                          </Badge>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Consumo estimado: <strong>{a.calculoPeso?.pesoKg?.toLocaleString("pt-BR") || 0} kg</strong>
                          {a.espessura && ` • Espessura ${a.espessura}mm`}
                          {a.cor && ` • Cor ${a.cor}`}
                        </p>

                        {/* Comparativo Antes vs Depois da Bobina Principal */}
                        {bPrincipal && (
                          <div className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-[11px] space-y-1">
                            <div className="flex items-center justify-between text-slate-500">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                Bobina {bPrincipal.codigo}
                              </span>
                              <span className={bPrincipal.daParaFazer ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                                {bPrincipal.daParaFazer ? "✅ 100% OK" : "⚠️ Parcial"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[10px]">
                              <span>Agora: <strong>{bPrincipal.pesoAtualKg?.toLocaleString("pt-BR")}kg</strong></span>
                              <span className="text-orange-600 font-bold">- {bPrincipal.pesoConsumoKg?.toLocaleString("pt-BR")}kg</span>
                              <span className="text-emerald-600 font-bold">DEPOIS: {bPrincipal.pesoAposUsoKg?.toLocaleString("pt-BR")}kg</span>
                            </div>
                          </div>
                        )}

                        {/* Comparativo de Chapas Cortadas */}
                        {chPrincipal && (
                          <div className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-[11px] space-y-1">
                            <div className="flex items-center justify-between text-slate-500">
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                Chapa {chPrincipal.codigo}
                              </span>
                              <span className={chPrincipal.daParaFazer ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                                {chPrincipal.daParaFazer ? "✅ Chapas OK" : "⚠️ Faltam"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[10px]">
                              <span>Agora: <strong>{chPrincipal.pecasAtual} un</strong></span>
                              <span className="text-orange-600 font-bold">- {chPrincipal.pecasConsumo} un</span>
                              <span className="text-emerald-600 font-bold">DEPOIS: {chPrincipal.pecasAposUso} un</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          {a.bobinasSimuladas?.length || a.chapasSimuladas?.length || 0} lote(s) disponível(is)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setItemSimulacaoSelecionado(a);
                            setSimulacaoOpen(true);
                          }}
                          className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                        >
                          🔍 Ver Simulação
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Checklist de Itens Agrupados (Regra 4) + Roteamento (Regra 3) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Package className="w-4 h-4" /> Itens Agrupados ({itens.length})
              </h4>
              {chk.total > 1 && (
                <span className="text-[11px] font-bold text-slate-500">
                  Checklist: {chk.concluidos}/{chk.total} ({chk.percentual}%)
                </span>
              )}
            </div>
            {itens.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum item detalhado.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {onProgramarItem && onProgramarTodosItens && (
                  <ProgramadorItensSection
                    pedido={pedido}
                    onProgramarItem={onProgramarItem}
                    onProgramarTodosItens={onProgramarTodosItens}
                  />
                )}
                <PedidoItensLista
                  pedido={pedido}
                  itensJson={pedido.itens_json}
                  estoqueContext={estoqueContext}
                />
              </div>
            )}
          </div>

          {/* Rastreamento por máquina (Mini BI) — APENAS na visão do galpão (operador), após aceitar o pedido */}
          {showTracking && (pedido.status_pcp === "distribuido" || pedido.status_pcp === "em_producao") && (
            <div className="space-y-3 rounded-xl border-2 border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/10 p-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Factory className="w-4 h-4 text-orange-500" /> Rastreamento de Produção (Mini BI)
              </h4>
              {pedido.itens_cd_count > 0 && (
                <MaquinaSequenceCD pedido={pedido} operadorNome={operadorNome} onAtualizado={onAtualizado} />
              )}
              {pedido.itens_telha_count > 0 && (
                <EtapasTelhaSequence pedido={pedido} operadorNome={operadorNome} onAtualizado={onAtualizado} />
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Cada ação dispara automaticamente o webhook do Mini BI para o Odoo.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              onClick={() => onDistribuir(pedido)}
              disabled={distribuindo || jaDistribuido}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white flex-1"
            >
              <Zap className="w-4 h-4" />
              {jaDistribuido ? "Já Distribuído" : distribuindo ? "Distribuindo..." : "Distribuir para os Galpões"}
            </Button>
            {jaDistribuido && onRetirarFila && (
              <Button
                variant="outline"
                onClick={() => onRetirarFila(pedido)}
                className="sm:w-auto border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <Undo2 className="w-4 h-4" /> Retirar da Fila
              </Button>
            )}
            {onDevolverPCP && (pedido.status_pcp === "distribuido" || pedido.status_pcp === "em_producao") && (
              <Button
                variant="outline"
                onClick={() => setSenhaDevolverOpen(true)}
                className="sm:w-auto border-amber-400 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <RotateCcw className="w-4 h-4" /> Devolver ao PCP
              </Button>
            )}
            <Button
              variant="outline"
              disabled={resetando}
              onClick={handleResetarPedido}
              className="sm:w-auto border-sky-500 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 font-semibold"
              title="Zerar progresso para 0% e resetar a OS para o início"
            >
              <RotateCcw className={`w-4 h-4 mr-1.5 ${resetando ? "animate-spin" : ""}`} />
              {resetando ? "Zerando..." : "Zerar OS (0%)"}
            </Button>
            {onExcluirOS && (
              <Button
                variant="destructive"
                onClick={() => setConfirmaExcluir(true)}
                className="sm:w-auto"
              >
                <Trash2 className="w-4 h-4" /> Excluir OS
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmaExcluir} onOpenChange={setConfirmaExcluir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" /> Excluir Ordem de Serviço (OS)
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p className="text-foreground font-semibold">
                  🗑️ EXCLUSÃO GLOBAL — remove a OS de TODAS as telas simultaneamente.
                </p>
                <p>
                  Pedido <strong>#{pedido.numero_pedido}</strong>{pedido.odoo_id ? ` · Odoo: ${pedido.odoo_id}` : ""}. Esta ação:
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                  <li>Envia o cancelamento ao Webhook do Odoo (com api_key + odoo_id numérico).</li>
                  <li>Se o Odoo responder <strong>200 OK</strong> → remove a OS globalmente:</li>
                  <li className="ml-4">• Central PCP · Galpão Telhas · Galpão Corte & Dobra · Expedição</li>
                  <li>Se o Odoo <strong>falhar</strong> → a exclusão é bloqueada e a OS permanece na tela com alerta de erro.</li>
                </ul>
                <Textarea
                  placeholder="Motivo do cancelamento (opcional)..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Manter OS</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={excluindo}
              onClick={confirmarExclusao}
            >
              {excluindo ? "Cancelando..." : "Sim, excluir OS"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SenhaGestorDialog
        open={senhaDevolverOpen}
        onOpenChange={setSenhaDevolverOpen}
        titulo="Devolver ao PCP"
        descricao="Para devolver este pedido à Central PCP, digite o PIN de liberação do Gestor."
        onAutorizado={() => onDevolverPCP?.(pedido)}
      />

      {simulacaoOpen && (
        <SimulacaoEstoqueMaterialDialog
          open={simulacaoOpen}
          onOpenChange={setSimulacaoOpen}
          pedido={pedido}
          analiseItem={itemSimulacaoSelecionado}
          statusEstoque={statusEstoque}
          estoqueContext={estoqueContext}
        />
      )}
    </>
  );
}