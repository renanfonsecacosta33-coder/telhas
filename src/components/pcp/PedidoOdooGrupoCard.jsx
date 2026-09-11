import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, ChevronUp, Layers, User, Calendar, Zap, Send,
  Star, CheckCircle2, AlertTriangle, Factory, Clock, Trash2
} from "lucide-react";
import { formatDataBR } from "@/lib/sla";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import PedidoOdooCard from "@/components/pcp/PedidoOdooCard";
import { calcularProgressoRealPedido, classGrupo } from "@/lib/pedidoOdooHelper";
import { verificarEstoqueGrupo } from "@/lib/estoqueMaterialHelper";
import SimulacaoEstoqueMaterialDialog from "@/components/pcp/SimulacaoEstoqueMaterialDialog";

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
  onClickPedido,
  onDelete,
  onDeleteGrupo,
  onRetirarFila,
  onTogglePrioridade,
  onSetPrioridade,
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

  // Contagens de status das OFs filhas
  const pendentes = ofs.filter(p => p.status_pcp === "pendente_distribuicao" && !isOfConcluida(p));
  const distribuidos = ofs.filter(p => p.status_pcp === "distribuido" && !isOfConcluida(p));
  const emProducao = ofs.filter(p => p.status_pcp === "em_producao" && !isOfConcluida(p));
  const concluidas = ofs.filter(p => isOfConcluida(p));

  // Progresso Consolidado do Pedido (média do progresso de todas as OFs)
  const somaProgressos = ofs.reduce((acc, p) => {
    return acc + calcularProgressoRealPedido(p, pedidosProducao, ordensCD);
  }, 0);
  const progressoConsolidado = totalOfs > 0 ? Math.round(somaProgressos / totalOfs) : 0;
  const isPedidoTotalConcluido = concluidas.length === totalOfs && totalOfs > 0;

  // Prioridade / Urgência
  const isPrioritario = grupo.prioridade || ofs.some(p => p.prioridade);

  // Contagem de OFs por setor no grupo
  const contagemSetores = useMemo(() => {
    let telha = 0;
    let cd = 0;
    let frisada = 0;
    ofs.forEach(p => {
      const g = classGrupo(p);
      if (g === "telha") telha++;
      else if (g === "frisada") frisada++;
      else cd++;
    });
    return { telha, cd, frisada };
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

  // Manipulador de distribuição em lote de todas as pendentes deste pedido
  const handleDistribuirTodas = (e) => {
    e.stopPropagation();
    if (onDistribuirGrupo && pendentes.length > 0) {
      onDistribuirGrupo(pendentes);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border rounded-2xl transition-all shadow-sm ${
        isPrioritario
          ? "border-amber-400 dark:border-amber-600 ring-1 ring-amber-400/40"
          : isPedidoTotalConcluido
          ? "border-emerald-300 dark:border-emerald-800"
          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
      }`}
    >
      {/* Cabeçalho Executivo do Pedido (Clicável para Expandir/Minimizar) */}
      <div
        onClick={onToggle}
        className={`px-3.5 py-2.5 sm:px-5 sm:py-3 cursor-pointer select-none transition-colors ${
          expandido
            ? "bg-slate-50/80 dark:bg-slate-800/40 rounded-t-2xl border-b border-slate-200 dark:border-slate-800"
            : "hover:bg-slate-50/60 dark:hover:bg-slate-800/20 rounded-2xl"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Lado Esquerdo: Identificação do Pedido, Cliente e SLA */}
          <div className="flex items-start gap-2.5 min-w-0">
            {/* Checkbox de Seleção do Pedido Inteiro */}
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

            {/* Botão Ícone Chevron */}
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
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {isPrioritario && (
                  <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-[10px] gap-0.5">
                    <Star className="w-3 h-3 fill-white" /> URGENTE
                  </Badge>
                )}
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 leading-tight">
                  Pedido #{grupo.numero_pedido}
                </h3>
                <Badge
                  variant="outline"
                  className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 font-bold text-xs"
                >
                  <Layers className="w-3 h-3 mr-1 text-indigo-500" />
                  {totalOfs} {totalOfs === 1 ? "OF" : "OFs"}
                </Badge>
                {contagemSetores.telha > 0 && (
                  <Badge className="bg-blue-600 text-white border-blue-700 text-[10px] font-bold px-1.5 py-0 shadow-xs">
                    🏠 {contagemSetores.telha} Telha{contagemSetores.telha > 1 ? "s" : ""}
                  </Badge>
                )}
                {contagemSetores.cd > 0 && (
                  <Badge className="bg-orange-600 text-white border-orange-700 text-[10px] font-bold px-1.5 py-0 shadow-xs">
                    🏭 {contagemSetores.cd} C&D
                  </Badge>
                )}
                {contagemSetores.frisada > 0 && (
                  <Badge className="bg-teal-600 text-white border-teal-700 text-[10px] font-bold px-1.5 py-0 shadow-xs">
                    🌬️ {contagemSetores.frisada} Frisada{contagemSetores.frisada > 1 ? "s" : ""}
                  </Badge>
                )}
                {grupo.unidade && (
                  <Badge variant="secondary" className="text-[11px]">
                    {grupo.unidade}
                  </Badge>
                )}
                {statusEstoqueGrupo && (
                  <Badge
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSimulacaoGrupoOpen(true);
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 shadow-xs cursor-pointer hover:scale-105 transition-all ${
                      statusEstoqueGrupo.statusGeral === "disponivel" || statusEstoqueGrupo.statusGeral === "ok"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25"
                        : statusEstoqueGrupo.statusGeral === "desbobinar" || statusEstoqueGrupo.statusGeral === "parcial"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25"
                        : "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 hover:bg-red-500/25"
                    }`}
                    title="Clique para ver a simulação completa de matéria-prima das OFs deste pedido"
                  >
                    {statusEstoqueGrupo.badgeGeral}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200 truncate max-w-xs" title={grupo.cliente_nome}>
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {grupo.cliente_nome || "Cliente não informado"}
                </span>
                {grupo.vendedor_nome && grupo.vendedor_nome !== "—" && (
                  <span className="hidden sm:inline-block truncate max-w-xs text-slate-400">
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
            </div>
          </div>

          {/* Lado Central/Direito: Progresso Consolidado, Badges de Status e Ações */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 shrink-0">
            {/* Barra de Progresso Geral Consolidada */}
            <div className="min-w-[170px] sm:w-44 flex flex-col justify-center">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                <span className="text-slate-500 dark:text-slate-400">Progresso Geral</span>
                <span className={progressoConsolidado >= 100 ? "text-emerald-600" : "text-orange-600"}>
                  {progressoConsolidado}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progressoConsolidado >= 100
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-orange-500 to-amber-500"
                  }`}
                  style={{ width: `${progressoConsolidado}%` }}
                />
              </div>
            </div>

            {/* Badges de Status das OFs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {pendentes.length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60" title={`${pendentes.length} OF(s) pendente(s) de distribuição`}>
                  {pendentes.length} pendente{pendentes.length > 1 ? "s" : ""}
                </span>
              )}
              {distribuidos.length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60" title={`${distribuidos.length} OF(s) distribuída(s)`}>
                  {distribuidos.length} distribuída{distribuidos.length > 1 ? "s" : ""}
                </span>
              )}
              {emProducao.length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60" title={`${emProducao.length} OF(s) em produção nas máquinas`}>
                  {emProducao.length} em produção
                </span>
              )}
              {concluidas.length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60" title={`${concluidas.length} OF(s) 100% concluída(s)`}>
                  {concluidas.length} concluída{concluidas.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Botões de Ação do Grupo */}
            <div className="flex items-center gap-2">
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
                className="text-xs h-8 font-semibold text-slate-700 dark:text-slate-200 gap-1"
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

      {/* Grade de OFs Filhas (Exibida somente quando o grupo está Expandido) */}
      {expandido && (
        <div className="p-3 sm:p-4 bg-slate-50/70 dark:bg-slate-950/30 rounded-b-2xl border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3 px-1">
            <span className="font-semibold flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5 text-orange-500" />
              Ordens de Fabricação do Pedido #{grupo.numero_pedido} ({totalOfs})
            </span>
            <span className="text-[11px] text-muted-foreground">
              Clique em qualquer card para ver detalhes, fotos e checklists
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
            {ofs.map(p => (
              <PedidoOdooCard
                key={p.id}
                pedido={p}
                progressoReal={calcularProgressoRealPedido(p, pedidosProducao, ordensCD)}
                pedidosProducao={pedidosProducao}
                ordensCD={ordensCD}
                selecionado={selecionados.has(p.id)}
                onToggleSelect={onToggleSelect}
                onDistribuir={onDistribuir}
                onClick={() => onClickPedido && onClickPedido(p)}
                onDelete={onDelete}
                onRetirarFila={onRetirarFila}
                onTogglePrioridade={onTogglePrioridade}
                onSetPrioridade={onSetPrioridade}
                compacto={true}
                dentroDeGrupo={true}
                estoqueContext={estoqueContext}
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
