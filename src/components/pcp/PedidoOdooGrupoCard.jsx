import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, ChevronUp, Layers, User, Calendar, Send,
  CheckCircle2, Trash2,
  ArrowRightLeft, RefreshCw
} from "lucide-react";
import { formatDataBR } from "@/lib/sla";
import { urgenciaPrazo } from "@/lib/prazoUrgencia";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import OfTimelineRow from "@/components/pcp/OfTimelineRow";
import { calcularProgressoRealPedido, classGrupo, obterStatusExecucaoPedido, getItens } from "@/lib/pedidoOdooHelper";
import { verificarEstoqueGrupo, extrairDemandaItem } from "@/lib/estoqueMaterialHelper";
import SimulacaoEstoqueMaterialDialog from "@/components/pcp/SimulacaoEstoqueMaterialDialog";
import {
  SeletorPrioridadeDropdown,
  PrioridadeBadge,
  BannerPrioridadeDestaque,
  isPedidoRetiraAgora,
  isPedidoRota
} from "@/lib/prioridadeHelper";

/**
 * Card Consolidado do Pedido de Venda (Acordeon Executivo).
 * Agrupa todas as Ordens de Fabricação (OFs) do mesmo pedido.
 * Por padrão, chega minimizado exibindo o resumo do pedido e progresso consolidado.
 * Ao clicar, expande a grade com os cards individuais de cada OF.
 */
export default function PedidoOdooGrupoCard({
  grupo,
  expandido = false,
  onToggle,
  pedidosProducao = [],
  ordensCD = [],
  selecionados = new Set(),
  onToggleSelect,
  onToggleSelectGrupo,
  onDistribuir,
  onDistribuirGrupo,
  onTransferir,
  onTransferirGrupo,
  onFinalizarGrupo100,
  onSincronizarGrupoOdoo,
  onClickPedido,
  onDelete,
  onDeleteGrupo,
  onRetirarFila,
  onTogglePrioridade,
  onSetPrioridade,
  onSetPrioridadeGrupo,
  estoqueContext = null
}) {
  const [simulacaoGrupoOpen, setSimulacaoGrupoOpen] = useState(false);
  const ofs = grupo.ofs || [];
  const totalOfs = ofs.length;
  const idsDoGrupo = ofs.map(p => p.id);
  const totalSelecionadosNoGrupo = idsDoGrupo.filter(id => selecionados.has(id)).length;
  const todosSelecionadosNoGrupo = totalOfs > 0 && totalSelecionadosNoGrupo === totalOfs;
  const algumSelecionadoNoGrupo = totalSelecionadosNoGrupo > 0 && !todosSelecionadosNoGrupo;

  // Identifica se uma OF individual está 100% concluída
  const isOfConcluida = (p) => {
    if (!p) return false;
    if (p.status_pcp === "concluido") return true;
    const prog = calcularProgressoRealPedido(p, pedidosProducao, ordensCD);
    if (prog >= 100) return true;
    if (p.percentual_concluido != null && p.percentual_concluido >= 100) return true;
    return false;
  };
  // Diagnóstico preciso em tempo real de execução no chão de fábrica
  const statusExecucaoOfs = useMemo(() => {
    return ofs.map(p => ({
      pedido: p,
      isConcluida: isOfConcluida(p),
      diag: obterStatusExecucaoPedido(p, pedidosProducao, ordensCD)
    }));
  }, [ofs, pedidosProducao, ordensCD]);

  const produzindoAgora = statusExecucaoOfs.filter(s => !s.isConcluida && s.diag.produzindoAgora);
  const aguardandoInicio = statusExecucaoOfs.filter(s => !s.isConcluida && s.diag.aguardandoInicio);
  const pendentes = ofs.filter(p => p.status_pcp === "pendente_distribuicao" && !isOfConcluida(p));
  const distribuidos = ofs.filter(p => p.status_pcp === "distribuido" && !isOfConcluida(p) && !produzindoAgora.some(x => x.pedido.id === p.id) && !aguardandoInicio.some(x => x.pedido.id === p.id));
  const concluidas = ofs.filter(p => isOfConcluida(p));

  // Progresso Consolidado do Pedido (média do progresso de todas as OFs)
  const somaProgressos = ofs.reduce((acc, p) => {
    return acc + calcularProgressoRealPedido(p, pedidosProducao, ordensCD);
  }, 0);
  const progressoConsolidado = totalOfs > 0 ? Math.round(somaProgressos / totalOfs) : 0;
  const isPedidoTotalConcluido = concluidas.length === totalOfs && totalOfs > 0;

  // Prioridade / Urgência
  const isPrioritario = grupo.prioridade || ofs.some(p => p.prioridade || p.prioridade_nivel);

  // Contagem de OFs e somatórios reais por setor no grupo
  const contagemSetores = useMemo(() => {
    let telhaOfs = 0;
    let telhasPecasTotal = 0;
    let telhasMetrosTotal = 0;
    let cdOfs = 0;
    let cdPecasTotal = 0;
    let frisadaOfs = 0;
    let frisadaPecasTotal = 0;

    ofs.forEach(p => {
      const g = classGrupo(p);
      const itensDoPed = getItens(p);

      if (g === "telha") {
        telhaOfs++;
        itensDoPed.forEach(it => {
          const dem = extrairDemandaItem(it);
          telhasPecasTotal += (dem?.pecas || 1);
          telhasMetrosTotal += (dem?.metros || 0);
        });
      } else if (g === "frisada") {
        frisadaOfs++;
        itensDoPed.forEach(it => {
          const dem = extrairDemandaItem(it);
          frisadaPecasTotal += (dem?.pecas || 1);
        });
      } else {
        cdOfs++;
        itensDoPed.forEach(it => {
          const dem = extrairDemandaItem(it);
          cdPecasTotal += (dem?.pecas || 1);
        });
      }
    });

    return {
      telha: telhaOfs,
      telhasPecasTotal,
      telhasMetrosTotal: Math.round(telhasMetrosTotal * 100) / 100,
      cd: cdOfs,
      cdPecasTotal,
      frisada: frisadaOfs,
      frisadaPecasTotal
    };
  }, [ofs]);

  // Verificação consolidada de estoque de matéria-prima (Bobinas e Chapas)
  const statusEstoqueGrupo = useMemo(() => {
    if (!estoqueContext) return null;
    return verificarEstoqueGrupo(ofs, estoqueContext);
  }, [ofs, estoqueContext]);

  // Diagnóstico consolidado de todos os itens do pedido para o modal de simulação
  const statusEstoqueConsolidado = useMemo(() => {
    if (!statusEstoqueGrupo) return null;
    const allAnalises = (statusEstoqueGrupo.analisesOfs || []).flatMap(a => a.diagnostico?.analises || []);
    return {
      statusGeral: statusEstoqueGrupo.statusGeral,
      pesoTotalKg: statusEstoqueGrupo.pesoTotalGrupoKg,
      opaMensagemGeral: `Pedido Consolidado #${grupo.numero_pedido}: ${statusEstoqueGrupo.badgeGeral}. ${statusEstoqueGrupo.ofsOk}/${statusEstoqueGrupo.totalOfs} OFs com matéria-prima disponível.`,
      analises: allAnalises
    };
  }, [statusEstoqueGrupo, grupo]);

  const lojaVendaDoGrupo = grupo.loja_venda || ofs[0]?.loja_venda || "";
  const unidadeDoGrupo = grupo.unidade || ofs[0]?.unidade || "Matriz AJL";
  const isAlgumaTransferida = ofs.some(p => Boolean(p.unidade_transferida_de));

  // Urgência de prazo: tingir o card de vermelho progressivamente conforme o SLA se aproxima
  const urgencia = urgenciaPrazo(grupo.data_entrega, { concluido: isPedidoTotalConcluido });

  // STATUS DOMINANTE: um único selo em máxima evidência, com hierarquia clara
  // (Concluído > Atrasado > Vence hoje > Em produção > Fila da máquina > Distribuído > Pendente)
  const statusHero = (() => {
    if (isPedidoTotalConcluido) {
      return { txt: "✓ Concluído 100%", cls: "bg-emerald-600 text-white border border-emerald-700" };
    }
    if (urgencia?.atrasado) {
      return { txt: `⏰ ${urgencia.badgeTexto}`, cls: "bg-red-600 text-white border border-red-700 animate-pulse" };
    }
    if (urgencia?.dias === 0) {
      return { txt: "⏰ Vence hoje!", cls: "bg-amber-600 text-white border border-amber-700 animate-pulse" };
    }
    if (produzindoAgora.length > 0) {
      return { txt: `⚡ Em produção (${produzindoAgora.length})`, cls: "bg-blue-600 text-white border border-blue-700" };
    }
    if (aguardandoInicio.length > 0) {
      return { txt: `⏳ Fila da máquina (${aguardandoInicio.length})`, cls: "bg-amber-500 text-white border border-amber-600" };
    }
    if (distribuidos.length > 0) {
      return { txt: `📦 Distribuído (${distribuidos.length})`, cls: "bg-indigo-600 text-white border border-indigo-700" };
    }
    return { txt: "📥 Aguardando distribuição", cls: "bg-slate-700 text-white border border-slate-800" };
  })();

  // Resumo textual das OFs (substitui a nuvem de badges antigas)
  const resumoOfs = [
    `${concluidas.length}/${totalOfs} concluída${totalOfs > 1 ? "s" : ""}`,
    produzindoAgora.length > 0 && `${produzindoAgora.length} produzindo`,
    aguardandoInicio.length > 0 && `${aguardandoInicio.length} na fila da máquina`,
    distribuidos.length > 0 && `${distribuidos.length} distribuída${distribuidos.length > 1 ? "s" : ""}`,
    pendentes.length > 0 && `${pendentes.length} pendente${pendentes.length > 1 ? "s" : ""}`
  ].filter(Boolean).join(" · ");

  // Manipulador de distribuição em lote de todas as pendentes deste pedido
  const handleDistribuirTodas = (e) => {
    e.stopPropagation();
    if (onDistribuirGrupo && pendentes.length > 0) {
      onDistribuirGrupo(pendentes);
    }
  };

  const ehRetiraAgoraGrupo = isPedidoRetiraAgora(grupo) || ofs.some(p => isPedidoRetiraAgora(p));
  const ehRotaGrupo = !ehRetiraAgoraGrupo && (isPedidoRota(grupo) || ofs.some(p => isPedidoRota(p)));
  const cardPrioCls = ehRetiraAgoraGrupo
    ? "ring-2 ring-red-500 border-2 border-red-500 bg-red-50/30 dark:bg-red-950/20 shadow-lg shadow-red-500/10"
    : ehRotaGrupo
    ? "ring-1 ring-indigo-400/60 border-l-4 border-l-indigo-600 bg-indigo-50/15 dark:bg-indigo-950/15"
    : "";

  return (
    <div
      className={`${isPedidoTotalConcluido && !cardPrioCls ? "bg-emerald-50/70 dark:bg-emerald-950/25" : "bg-white dark:bg-slate-900"} border rounded-2xl transition-all shadow-sm relative overflow-hidden ${
        cardPrioCls || (urgencia?.borderLeftClass || "")
      } ${
        cardPrioCls
          ? ""
          : isPrioritario
          ? "border-amber-400 dark:border-amber-600 ring-1 ring-amber-400/40"
          : isPedidoTotalConcluido
          ? "border-emerald-300 dark:border-emerald-800"
          : urgencia?.ringClass || "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      <BannerPrioridadeDestaque
        pedido={ehRetiraAgoraGrupo ? { prioridade_nivel: "RETIRA_AGORA" } : ehRotaGrupo ? { prioridade_nivel: "ROTA" } : grupo}
      />
      {/* Cabeçalho Executivo do Pedido (Clicável para Expandir/Minimizar) */}
      <div
        onClick={onToggle}
        className={`px-4 py-3 cursor-pointer select-none transition-colors ${
          expandido
            ? "bg-slate-50/80 dark:bg-slate-800/40 rounded-t-2xl border-b border-slate-200 dark:border-slate-800"
            : "hover:bg-slate-50/60 dark:hover:bg-slate-800/20 rounded-2xl"
        }`}
      >
        <div className="flex flex-col xl:flex-row xl:items-center gap-x-5 gap-y-3">
          {/* Zona 1: Identidade + Status Dominante em Máxima Evidência */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {onToggleSelectGrupo && (
              <div
                onClick={(e) => { e.stopPropagation(); onToggleSelectGrupo(grupo); }}
                className="pt-1.5 shrink-0"
                title={todosSelecionadosNoGrupo ? "Desmarcar todas as OPs deste pedido" : "Selecionar todas as OPs deste pedido"}
              >
                <input
                  type="checkbox"
                  checked={todosSelecionadosNoGrupo}
                  ref={el => { if (el) el.indeterminate = algumSelecionadoNoGrupo; }}
                  onChange={() => {}}
                  className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
              </div>
            )}

            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${
                expandido
                  ? "bg-orange-500 text-white shadow-sm rotate-180"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              {/* Linha 1: Pedido + ÚNICO selo de status dominante */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 leading-tight">
                  Pedido #{grupo.numero_pedido}
                </h3>
                {grupo.numero_oc && (
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {/^OC[\s:-]?/i.test(grupo.numero_oc) ? grupo.numero_oc : `OC ${grupo.numero_oc}`}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wide shadow-sm ${statusHero.cls}`}
                >
                  {statusHero.txt}
                </span>
                {isPrioritario && <PrioridadeBadge pedido={grupo} />}
              </div>

              {/* Linha 2: Cliente · Vendedor · Entrega · SLA */}
              <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 truncate max-w-xs" title={grupo.cliente_nome}>
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {grupo.cliente_nome || "Cliente não informado"}
                </span>
                {grupo.vendedor_nome && grupo.vendedor_nome !== "—" && (
                  <span className="hidden sm:inline-block truncate max-w-xs">
                    Vendedor: <strong className="text-slate-600 dark:text-slate-300">{grupo.vendedor_nome}</strong>
                  </span>
                )}
                {grupo.data_entrega && (
                  <span className="flex items-center gap-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Entrega: <strong className="text-slate-700 dark:text-slate-200">{formatDataBR(grupo.data_entrega)}</strong>
                  </span>
                )}
                <SlaCountdownBadge dataPrometida={grupo.data_entrega} />
              </div>

              {/* Linha 3: Composição resumida com pontos coloridos por setor */}
              <div className="flex items-center gap-x-3 gap-y-1 text-[11px] flex-wrap mt-1">
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-bold">
                  <Layers className="w-3 h-3 text-slate-400" />
                  {totalOfs} {totalOfs === 1 ? "OF" : "OFs"}
                </span>
                {contagemSetores.telha > 0 && (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    ● {contagemSetores.telhasPecasTotal > 1 ? `${contagemSetores.telhasPecasTotal} Telhas` : "1 Telha"}
                    {contagemSetores.telhasMetrosTotal > 0 ? ` (${contagemSetores.telhasMetrosTotal}m)` : ""}
                  </span>
                )}
                {contagemSetores.cd > 0 && (
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">● {contagemSetores.cd} C&D</span>
                )}
                {contagemSetores.frisada > 0 && (
                  <span className="text-teal-600 dark:text-teal-400 font-semibold">
                    ● {contagemSetores.frisada} Frisada{contagemSetores.frisada > 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-slate-400 dark:text-slate-500">
                  {unidadeDoGrupo}
                  {lojaVendaDoGrupo && lojaVendaDoGrupo !== unidadeDoGrupo && ` · Venda: ${lojaVendaDoGrupo}`}
                </span>
                {isAlgumaTransferida && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">↔ Transferido</span>
                )}
                {statusEstoqueGrupo && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSimulacaoGrupoOpen(true); }}
                    className={`px-2 py-0.5 rounded-md font-bold hover:scale-105 transition-all ${
                      statusEstoqueGrupo.statusGeral === "disponivel" || statusEstoqueGrupo.statusGeral === "ok"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                        : statusEstoqueGrupo.statusGeral === "desbobinar" || statusEstoqueGrupo.statusGeral === "parcial"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                        : "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/40"
                    }`}
                    title="Clique para ver a simulação completa de matéria-prima das OFs deste pedido"
                  >
                    {statusEstoqueGrupo.badgeGeral}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Lado Direito: Progresso Consolidado, Resumo das OFs e Ações */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between xl:justify-end gap-3 shrink-0">
            {/* Zona 2: Progresso Consolidado + Resumo textual das OFs */}
            <div className="shrink-0 w-full sm:w-56 flex flex-col justify-center gap-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-500 dark:text-slate-400">Progresso Geral</span>
                <span className={progressoConsolidado >= 100 ? "text-emerald-600" : "text-orange-600"}>
                  {progressoConsolidado}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progressoConsolidado >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-amber-500"
                  }`}
                  style={{ width: `${progressoConsolidado}%` }}
                />
              </div>
              {resumoOfs && (
                <span className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate" title={resumoOfs}>
                  {resumoOfs}
                </span>
              )}
            </div>

            {/* Zona 3: Botões de Ação do Grupo */}
            <div className="flex items-center gap-2 flex-wrap">
              {(onSetPrioridadeGrupo || onSetPrioridade) && (
                <div onClick={(e) => e.stopPropagation()} title="Definir prioridade ou rota para todo o pedido">
                  <SeletorPrioridadeDropdown
                    pedido={grupo}
                    onSelectPrioridade={(nivel) => {
                      if (onSetPrioridadeGrupo) onSetPrioridadeGrupo(grupo, nivel);
                      else if (onSetPrioridade) onSetPrioridade(grupo, nivel);
                    }}
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 font-bold border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  />
                </div>
              )}

              {pendentes.length > 0 && onDistribuirGrupo && (
                <Button
                  size="sm"
                  onClick={handleDistribuirTodas}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs h-8 gap-1.5 shadow-sm"
                  title={`Distribuir todas as ${pendentes.length} OFs pendentes deste pedido`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Distribuir Todas</span> ({pendentes.length})
                </Button>
              )}

              {onFinalizarGrupo100 && !isPedidoTotalConcluido && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFinalizarGrupo100(ofs);
                  }}
                  className="h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                  title={`Finalizar Pedido #${grupo.numero_pedido} em 100% (exige senha de gestor)`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Finalizar 100%
                </button>
              )}

              {onSincronizarGrupoOdoo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSincronizarGrupoOdoo(ofs);
                  }}
                  className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
                    isPedidoTotalConcluido
                      ? "border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shadow-xs"
                      : "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                  title={`Sincronizar/Reenviar Pedido #${grupo.numero_pedido} (${totalOfs} OFs) com o Odoo ERP`}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Sincronizar Odoo</span>
                </button>
              )}

              {onTransferirGrupo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransferirGrupo(grupo);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors border border-slate-200 dark:border-slate-700 hover:border-indigo-300 h-8 w-8 flex items-center justify-center shrink-0"
                  title={`Transferir Pedido #${grupo.numero_pedido} (${totalOfs} OFs) para outra filial`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {onDeleteGrupo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteGrupo(grupo);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border border-slate-200 dark:border-slate-700 hover:border-red-300 h-8 w-8 flex items-center justify-center shrink-0"
                  title={`Excluir Pedido #${grupo.numero_pedido} (${totalOfs} OFs)`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle?.();
                }}
                className="text-xs h-8 font-semibold text-slate-700 dark:text-slate-200 gap-1 cursor-pointer"
              >
                {expandido ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Minimizar
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Ver {totalOfs} {totalOfs === 1 ? "OF" : "OFs"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Vertical das OFs Filhas (Exibida somente quando o grupo está Expandido) */}
      {expandido && (
        <div className="px-4 sm:px-5 py-4 bg-[#edf1ef] dark:bg-slate-950/40 rounded-b-2xl border-t border-[#cbd5d1] dark:border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap min-h-[28px]">
            <span className="text-sm font-bold tracking-[-.02em] text-[#243532] dark:text-slate-200">
              Ordens de Fabricação do Pedido #{grupo.numero_pedido} ({totalOfs})
            </span>
            <span className="text-[11px] text-[#687773] dark:text-slate-500">
              Clique em qualquer card para ver detalhes, fotos e checklists
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {ofs.map(p => (
              <OfTimelineRow
                key={p.id}
                pedido={p}
                progressoReal={calcularProgressoRealPedido(p, pedidosProducao, ordensCD)}
                pedidosProducao={pedidosProducao}
                ordensCD={ordensCD}
                selecionado={selecionados.has(p.id)}
                onToggleSelect={onToggleSelect}
                onDistribuir={onDistribuir}
                onFinalizar100={onFinalizarGrupo100 ? (p) => onFinalizarGrupo100([p]) : null}
                onRetirarFila={onRetirarFila}
                onClick={() => onClickPedido && onClickPedido(p)}
              />
            ))}
          </div>
        </div>
      )}

      {simulacaoGrupoOpen && (
        <SimulacaoEstoqueMaterialDialog
          open={simulacaoGrupoOpen}
          onOpenChange={setSimulacaoGrupoOpen}
          pedido={{ numero_pedido: grupo.numero_pedido, cliente_nome: grupo.cliente_nome }}
          statusEstoque={statusEstoqueConsolidado}
          estoqueContext={estoqueContext}
        />
      )}
    </div>
  );
}