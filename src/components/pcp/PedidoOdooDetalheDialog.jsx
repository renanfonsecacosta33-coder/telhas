import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { notificarStatus } from "@/lib/biNotificador";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Zap,
  Factory,
  Scissors,
  Wind,
  Package,
  CheckCircle2,
  Trash2,
  ImageIcon,
  Star,
  Undo2,
  RotateCcw,
  RefreshCw,
  ArrowRightLeft,
  CalendarClock,
  History,
  ChevronDown,
  Building2,
  Store,
  Calendar
} from "lucide-react";
import { formatDataBR, slaDiasPorCategoria } from "@/lib/sla";
import { hojeLocalISO } from "@/lib/dataLocal";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";
import PedidoItensLista from "@/components/pcp/PedidoItensLista";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import { extrairAnexosLista } from "@/lib/croquiExtractor";
import MaquinaSequenceCD from "@/components/pcp/MaquinaSequenceCD";
import EtapasTelhaSequence from "@/components/pcp/EtapasTelhaSequence";
import { parseItensPedido, progressoChecklist } from "@/lib/regrasFabrica";
import { getItens, classGrupo } from "@/lib/pedidoOdooHelper";
import { isLocalArmazenagemPinhais, sugerirMaquinaPadraoItem } from "@/lib/roteamentoPCP";
import { verificarEstoquePedido } from "@/lib/estoqueMaterialHelper";
import { SeletorPrioridadeDropdown, PrioridadeBadge } from "@/lib/prioridadeHelper";
import SimulacaoEstoqueMaterialDialog from "@/components/pcp/SimulacaoEstoqueMaterialDialog";
import AlterarPrazoFabrilDialog from "@/components/pcp/AlterarPrazoFabrilDialog";
import EditarItensOdooDialog from "@/components/pcp/EditarItensOdooDialog";

export default function PedidoOdooDetalheDialog({
  pedido, open, onOpenChange, onDistribuir, distribuindo,
  onExcluirOS, onRetirarFila, onTogglePrioridade, onSetPrioridade, onToggleItem,
  onDevolverPCP, onTransferir, onVerHistorico, showTracking = false, progressoReal, onAtualizado,
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
  const [alterarPrazoOpen, setAlterarPrazoOpen] = useState(false);
  const [editarItensOpen, setEditarItensOpen] = useState(false);
  const [salvandoProgramacao, setSalvandoProgramacao] = useState(false);
  const [itensLocais, setItensLocais] = useState([]);
  const [resetando, setResetando] = useState(false);

  // Inicializa programação local de itens quando o pedido muda
  useEffect(() => {
    if (!pedido) {
      setItensLocais([]);
      return;
    }
    const lista = parseItensPedido(pedido.itens_json);
    const hojeIso = hojeLocalISO();
    const dataPadrao = pedido.data_previsao_fabrica || pedido.data_entrega || hojeIso;

    const inicializados = lista.map((it, idx) => ({
      ...it,
      _idx: idx,
      maquina: it.maquina || sugerirMaquinaPadraoItem(it, pedido.unidade),
      data_programada: it.data_programada || dataPadrao,
      status: it.status || (pedido.status_pcp === "distribuido" ? "distribuido" : "pendente"),
      distribuido: Boolean(it.distribuido || pedido.status_pcp === "distribuido")
    }));
    setItensLocais(inicializados);
  }, [pedido]);

  const atualizarItemLocal = (idx, campo, valor) => {
    setItensLocais(prev => {
      const cp = [...prev];
      if (cp[idx]) {
        cp[idx] = { ...cp[idx], [campo]: valor };
      }
      return cp;
    });
  };

  const handleDistribuirItemIndividual = async (idx) => {
    const item = itensLocais[idx];
    if (!item || !onProgramarItem) return;
    await onProgramarItem(pedido, idx, {
      maquina: item.maquina,
      data_programada: item.data_programada,
      distribuir: true
    });
    atualizarItemLocal(idx, "distribuido", true);
    atualizarItemLocal(idx, "status", "distribuido");
  };

  const jaDistribuido = pedido?.status_pcp !== "pendente_distribuicao";

  const handleAcaoPrincipal = async () => {
    if (!pedido) return;
    setSalvandoProgramacao(true);
    try {
      if (!jaDistribuido) {
        // Pedido pendente: Salva e distribui todos os itens
        if (onProgramarTodosItens) {
          const formatados = itensLocais.map(it => ({
            ...it,
            status: "distribuido",
            distribuido: true
          }));
          await onProgramarTodosItens(pedido, formatados, true);
        } else if (onDistribuir) {
          await onDistribuir(pedido);
        }
      } else {
        // Pedido já distribuído: Salva alterações de máquinas e datas
        if (onProgramarTodosItens) {
          await onProgramarTodosItens(pedido, itensLocais, false);
          toast.success("Alterações na programação salvas com sucesso!");
        } else if (onDistribuir) {
          await onDistribuir(pedido);
        }
      }
    } catch (err) {
      toast.error("Erro ao salvar programação: " + (err.message || String(err)));
    } finally {
      setSalvandoProgramacao(false);
    }
  };

  const handleSincronizarOdoo = async () => {
    if (!pedido) return;
    setSincronizando(true);
    try {
      const pct = progressoReal != null ? progressoReal : (pedido.percentual_concluido || 0);
      const isConcluido = pedido.status_pcp === "concluido" || pct >= 100;

      let pedidoParaEnviar = pedido;
      if (isConcluido) {
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
        toast.error(`Aviso: O webhook do Odoo retornou erro 500 no processamento.`, { duration: 8000 });
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

  const handleResetarPedido = async () => {
    if (!pedido) return;
    if (!window.confirm(
      `🔄 ZERAR PRODUÇÃO DA OS #${pedido.numero_pedido}?\n\nIsso irá:\n• Zerar o progresso para 0%\n• Mudar status para 'Pendente de Distribuição'\n• Limpar máquinas e etapas atribuídas\n• Cancelar OPs vinculadas na fábrica\n• Notificar o Odoo ERP com evento de Reset (0%)`
    )) return;

    setResetando(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
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

      const itensAtuais = getItens(pedido);
      const itensZerados = itensAtuais.map(i => ({
        ...i,
        status: "pendente",
        status_detalhado: "Aguardando Início",
        concluido: false,
        maquina: ""
      }));

      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "pendente_distribuicao",
        percentual_concluido: 0,
        maquinas_json: "[]",
        etapas_telha_json: "[]",
        itens_json: JSON.stringify(itensZerados)
      });

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
  const chk = progressoChecklist(pedido.itens_json);
  const isPrioritario = !!pedido.prioridade;
  const pct = progressoReal != null ? progressoReal : (pedido.percentual_concluido || 0);
  const anexos = extrairAnexosLista(pedido);

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
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (confirmaExcluir || senhaDevolverOpen || simulacaoOpen || alterarPrazoOpen || editarItensOpen) {
              e.preventDefault();
            }
          }}
          className="w-[96vw] max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-3.5"
        >
          {/* Dialog Header acessível para leitores de tela */}
          <DialogHeader className="sr-only">
            <DialogTitle>Detalhes do Pedido #{pedido.numero_pedido}</DialogTitle>
            <DialogDescription>Detalhamento e programação industrial do pedido</DialogDescription>
          </DialogHeader>

          {/* 3. CABEÇALHO COMPACTO E HIERARQUIA VISUAL EM 1 LINHA */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-2.5">
            {/* Linha 1: Identificação Oficial + Ações Rápidas em Ícones/Botões Discretos */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-mono font-black text-sm px-2.5 py-0.5 shadow-xs tracking-wide">
                  #{pedido.numero_pedido}
                </Badge>
                {pedido.numero_oc && (
                  <Badge variant="outline" className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200">
                    {/^OC[\s:-]?/i.test(pedido.numero_oc) ? pedido.numero_oc : `OC: ${pedido.numero_oc}`}
                  </Badge>
                )}
                {pedido.of_nome ? (
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80">
                    OF: {pedido.of_nome}
                  </Badge>
                ) : pedido.of_odoo_id ? (
                  <Badge variant="outline" className="text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80">
                    OF: {pedido.of_odoo_id}
                  </Badge>
                ) : null}
                <PrioridadeBadge pedido={pedido} />
                {isPrioritario && !pedido.prioridade_logistica && (
                  <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse gap-0.5 text-xs font-bold">
                    <Star className="w-3 h-3 fill-white" /> Urgente
                  </Badge>
                )}
              </div>

              {/* Ações Rápidas no Canto Superior Direito */}
              <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSincronizarOdoo}
                  disabled={sincronizando}
                  className="h-7 px-2.5 text-xs gap-1.5 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-semibold"
                  title="Sincronizar dados em tempo real com o Odoo ERP"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? "animate-spin text-blue-600" : "text-blue-500"}`} />
                  <span className="hidden sm:inline">{sincronizando ? "Sincronizando..." : "Sincronizar"}</span>
                </Button>

                {onVerHistorico && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVerHistorico(pedido)}
                    className="h-7 px-2.5 text-xs gap-1.5 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                    title="Ver histórico de movimentações e logs"
                  >
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Histórico</span>
                  </Button>
                )}

                {onTransferir && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onTransferir(pedido)}
                    className="h-7 px-2.5 text-xs gap-1.5 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 font-semibold"
                    title="Transferir fabricação para outra filial"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" />
                    <span className="hidden sm:inline">Transferir</span>
                  </Button>
                )}

                {(onSetPrioridade || onTogglePrioridade) && (
                  <SeletorPrioridadeDropdown
                    pedido={pedido}
                    onSelectPrioridade={(nivel, data) => {
                      if (onSetPrioridade) onSetPrioridade(pedido, nivel, data);
                      else onTogglePrioridade(pedido);
                    }}
                    size="sm"
                    variant="outline"
                  />
                )}
              </div>
            </div>

            {/* Linha 2: Metadados Essenciais Fluidos e Compactos */}
            <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 flex-wrap pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Cliente:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[280px]" title={pedido.cliente_nome}>
                  {pedido.cliente_nome || "—"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Vendedor:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[150px]" title={pedido.vendedor_nome}>
                  {pedido.vendedor_nome || "—"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Prazo / Carregamento:</span>
                <span className="font-black text-orange-600 dark:text-orange-400 whitespace-nowrap">
                  {formatDataBR(pedido.data_previsao_fabrica || pedido.data_entrega)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAlterarPrazoOpen(true)}
                  className="h-5 px-1 text-[10px] text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-950 font-bold"
                  title="Alterar prazo interno da fábrica"
                >
                  <CalendarClock className="w-3 h-3" />
                </Button>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Fábrica:</span>
                <Badge className="text-[10px] h-5 font-bold bg-orange-500 text-white">
                  {pedido.unidade || "Matriz AJL"}
                </Badge>
                {pedido.loja_venda && pedido.unidade && pedido.loja_venda !== pedido.unidade && (
                  <Badge variant="outline" className="text-[9px] h-5 font-semibold text-purple-700 bg-purple-50 border-purple-200">
                    de {pedido.loja_venda}
                  </Badge>
                )}
                {isLocalArmazenagemPinhais(pedido.local_armazenagem || pedido.loja_estoque) && (
                  <Badge variant="outline" className="text-[9px] h-5 font-bold bg-emerald-50 text-emerald-700 border-emerald-300">
                    Estoque: Pinhais
                  </Badge>
                )}
              </div>
            </div>

            {/* Linha 3: Barra de Progresso Fina e Elegante */}
            <div className="pt-1">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-500 font-medium">Progresso Geral da Produção</span>
                <span className={`font-black ${pct >= 100 ? "text-emerald-600" : "text-orange-600"}`}>
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-amber-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Fotos e Croquis do Pedido (se houver) */}
          {anexos.length > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 overflow-hidden bg-white dark:bg-slate-900">
              <div className="bg-blue-50/70 dark:bg-blue-950/40 px-3 py-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-blue-800 dark:text-blue-200">
                    Croquis e Fotos ({anexos.length})
                  </span>
                </div>
                <span className="text-[10px] text-blue-500">Toque na imagem para ampliar</span>
              </div>
              <div className="p-2.5">
                <CroquiThumb
                  pedido={pedido}
                  alt={`Croqui do pedido #${pedido.numero_pedido}`}
                  galeriaCompleta={true}
                />
              </div>
            </div>
          )}

          {/* 1. FIM DA DUPLICAÇÃO DE ITENS (Lista Única Definitiva com Controles Integrados) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-orange-500" /> Itens do Pedido ({itens.length})
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditarItensOpen(true)}
                  className="h-7 text-xs font-bold gap-1 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                  title="Corrigir quantidades, medidas ou adicionar itens a esta OF"
                >
                  ✏️ Ajustar Medidas / Itens
                </Button>
                {chk.total > 1 && (
                  <span className="text-[11px] font-bold text-slate-500">
                    Checklist: {chk.concluidos}/{chk.total} ({chk.percentual}%)
                  </span>
                )}
              </div>
            </div>

            {itens.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">Nenhum item detalhado neste pedido.</p>
            ) : (
              <PedidoItensLista
                pedido={pedido}
                itensLocais={itensLocais}
                podeProgramar={Boolean(onProgramarItem || onProgramarTodosItens)}
                onAtualizarItemLocal={atualizarItemLocal}
                onDistribuirItem={onProgramarItem ? handleDistribuirItemIndividual : null}
                unidadePedido={pedido.unidade}
                estoqueContext={estoqueContext}
              />
            )}
          </div>

          {/* Rastreamento por máquina (Mini BI) — na visão do galpão após aceitar o pedido */}
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
            </div>
          )}

          {/* 4. RODAPÉ LIMPO COM 1 AÇÃO PRINCIPAL EM EVIDÊNCIA + MENU "MAIS AÇÕES ▾" */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex-wrap">
            {/* Ação Principal em Destaque */}
            <Button
              onClick={handleAcaoPrincipal}
              disabled={salvandoProgramacao || distribuindo}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold h-10 px-6 gap-2 shadow-sm flex-1 sm:flex-initial min-w-[220px]"
            >
              <Zap className="w-4 h-4" />
              <span>
                {distribuindo || salvandoProgramacao
                  ? "Processando..."
                  : !jaDistribuido
                  ? "⚡ Distribuir para Produção"
                  : "💾 Salvar Programação dos Itens"}
              </span>
            </Button>

            {/* Menu Dropdown "Mais Ações ▾" */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 px-3.5 gap-1.5 font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                  <span>Mais Ações</span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1">
                {onDevolverPCP && (pedido.status_pcp === "distribuido" || pedido.status_pcp === "em_producao") && (
                  <DropdownMenuItem
                    onClick={() => setSenhaDevolverOpen(true)}
                    className="gap-2 cursor-pointer font-medium text-amber-700 dark:text-amber-400 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/40"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    <span>Devolver ao PCP</span>
                  </DropdownMenuItem>
                )}

                {jaDistribuido && onRetirarFila && (
                  <DropdownMenuItem
                    onClick={() => onRetirarFila(pedido)}
                    className="gap-2 cursor-pointer font-medium text-amber-700 dark:text-amber-400 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/40"
                  >
                    <Undo2 className="w-4 h-4 text-amber-600" />
                    <span>Retirar da Fila</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={handleResetarPedido}
                  disabled={resetando}
                  className="gap-2 cursor-pointer font-medium text-sky-700 dark:text-sky-400 focus:text-sky-700 focus:bg-sky-50 dark:focus:bg-sky-950/40"
                >
                  <RotateCcw className={`w-4 h-4 text-sky-600 ${resetando ? "animate-spin" : ""}`} />
                  <span>Zerar Progresso (0%)</span>
                </DropdownMenuItem>

                {onExcluirOS && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setConfirmaExcluir(true)}
                      className="gap-2 cursor-pointer font-semibold text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      <span>Excluir Pedido / OS</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                    Motivo do Cancelamento / Exclusão <span className="text-red-600 font-extrabold">* (Obrigatório)</span>
                  </label>

                  {/* Atalhos Rápidos */}
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {[
                      "Cancelado pelo cliente",
                      "Alteração de medidas / modelo",
                      "Erro de cadastro / duplicado",
                      "Substituído por novo pedido",
                      "Cancelamento comercial"
                    ].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setMotivo(sug)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                          motivo === sug
                            ? "bg-red-600 text-white border-red-600 font-bold shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>

                  <Textarea
                    placeholder="Informe detalhadamente o motivo para registro formal no Histórico de Exclusões..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={2}
                    className="text-xs border-slate-300 dark:border-slate-700 focus-visible:ring-red-500"
                  />
                  {(!motivo || motivo.trim().length < 3) && (
                    <p className="text-[10px] text-red-600 font-bold">
                      ⚠️ Informe o motivo (mínimo 3 caracteres) para habilitar a exclusão.
                    </p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Manter OS</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              disabled={excluindo || !motivo || motivo.trim().length < 3}
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

      {pedido && (
        <AlterarPrazoFabrilDialog
          open={alterarPrazoOpen}
          onOpenChange={setAlterarPrazoOpen}
          pedido={pedido}
          onPrazoAlterado={(atualizado) => {
            if (onAtualizado) onAtualizado(atualizado);
          }}
        />
      )}

      {pedido && (
        <EditarItensOdooDialog
          open={editarItensOpen}
          onOpenChange={setEditarItensOpen}
          pedido={pedido}
          onSalvo={() => {
            onAtualizado?.();
          }}
        />
      )}
    </>
  );
}
