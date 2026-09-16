import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, User, Tag, Layers, Factory, Scissors, Wind, Trash2, Star, ShieldAlert,
  Undo2, RefreshCw, Zap, CheckCircle2, ChevronDown, ChevronUp, Home,
  AlertTriangle, Clock, Disc, Building2, ArrowRightLeft, Store
} from "lucide-react";
import {
  formatDataBR,
  slaDiasPorCategoria
} from "@/lib/sla";
import { slaCountdown, slaCountdownCls, progressoChecklist } from "@/lib/regrasFabrica";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import PedidoItensLista from "@/components/pcp/PedidoItensLista";
import { notificarStatus } from "@/lib/biNotificador";
import { toast } from "sonner";
import { SeletorPrioridadeDropdown, PrioridadeBadge } from "@/lib/prioridadeHelper";
import { classGrupo } from "@/lib/pedidoOdooHelper";
import { verificarEstoquePedido } from "@/lib/estoqueMaterialHelper";
import SimulacaoEstoqueMaterialDialog from "@/components/pcp/SimulacaoEstoqueMaterialDialog";

// Cores estritas do Ecossistema AJL conforme menu do sistema:
// 🏠 Fábrica de Telhas → AZUL (#2563EB)
// 🏭 Corte & Dobra    → LARANJA (#EA580C)
// 🌬️ Frisada          → TEAL (#0D9488)
// 🔩 Avulso           → SLATE (#475569)
const SETOR_CARD_CFG = {
  telha: {
    label: "Fábrica de Telhas",
    curto: "🏠 Telha",
    borderLeft: "border-l-4 border-l-blue-600",
    borderBase: "border-blue-200/90 dark:border-blue-800/60 hover:border-blue-400 dark:hover:border-blue-600",
    bgTint: "bg-blue-50/15 dark:bg-blue-950/10",
    badgeCls: "bg-blue-600 text-white border-blue-700 shadow-xs",
    btnDistribuir: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20",
  },
  cd: {
    label: "Corte & Dobra",
    curto: "🏭 C&D",
    borderLeft: "border-l-4 border-l-orange-600",
    borderBase: "border-orange-200/90 dark:border-orange-800/60 hover:border-orange-400 dark:hover:border-orange-600",
    bgTint: "bg-orange-50/15 dark:bg-orange-950/10",
    badgeCls: "bg-orange-600 text-white border-orange-700 shadow-xs",
    btnDistribuir: "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/20",
  },
  frisada: {
    label: "Frisada",
    curto: "🌬️ Frisada",
    borderLeft: "border-l-4 border-l-teal-600",
    borderBase: "border-teal-200/90 dark:border-teal-800/60 hover:border-teal-400 dark:hover:border-teal-600",
    bgTint: "bg-teal-50/15 dark:bg-teal-950/10",
    badgeCls: "bg-teal-600 text-white border-teal-700 shadow-xs",
    btnDistribuir: "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-teal-500/20",
  },
  avulso: {
    label: "Avulso",
    curto: "🔩 Avulso",
    borderLeft: "border-l-4 border-l-slate-400",
    borderBase: "border-slate-200 dark:border-slate-800 hover:border-slate-400",
    bgTint: "bg-white dark:bg-slate-900",
    badgeCls: "bg-slate-600 text-white border-slate-700 shadow-xs",
    btnDistribuir: "bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white",
  }
};

const STATUS_PCP = {
  pendente_distribuicao: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
  distribuido: { label: "Distribuído", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  em_producao: { label: "Em Produção", cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40" },
  concluido: { label: "Concluído", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" }
};

export default function PedidoOdooCard({
  pedido, onClick, onDelete, onRetirarFila, onTogglePrioridade, onSetPrioridade,
  progressoReal, pedidosProducao = [], ordensCD = [],
  selecionado = false, onToggleSelect, onDistribuir, onTransferir,
  defaultMinimizado, compacto = false, dentroDeGrupo = false,
  estoqueContext = null
}) {
  const [hover, setHover] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [simulacaoModalOpen, setSimulacaoModalOpen] = useState(false);
  const pct = progressoReal != null ? progressoReal : (pedido.percentual_concluido || 0);
  const isConcluido = pedido.status_pcp === "concluido" || pct >= 100;
  const [expandidoManual, setExpandidoManual] = useState(defaultMinimizado === false);
  const minimizado = isConcluido && !expandidoManual;

  const statusEstoque = useMemo(() => {
    if (!estoqueContext) return null;
    return verificarEstoquePedido(pedido, estoqueContext);
  }, [pedido, estoqueContext]);

  const st = STATUS_PCP[pedido.status_pcp] || (isConcluido ? STATUS_PCP.concluido : STATUS_PCP.pendente_distribuicao);
  const sla = slaDiasPorCategoria(pedido);
  const chk = progressoChecklist(pedido.itens_json);
  const espessuras = (() => {
    try { return JSON.parse(pedido.espessuras_tags || "[]"); } catch { return []; }
  })();
  const isPrioritario = !!pedido.prioridade;
  const podeRetirarFila = pedido.status_pcp === "distribuido" || pedido.status_pcp === "em_producao";
  const handleSincronizarOdoo = async (e) => {
    e.stopPropagation();
    setSincronizando(true);
    try {
      await notificarStatus(pedido, "sincronizacao_manual", {
        percentual_concluido: pct,
        status_novo: pedido.status_pcp || "em_producao",
        item_nome: `Pedido #${pedido.numero_pedido}`
      });
      toast.success(`Pedido #${pedido.numero_pedido} sincronizado com o Odoo ERP!`);
    } catch (err) {
      toast.error("Falha ao sincronizar com o Odoo ERP");
    } finally {
      setSincronizando(false);
    }
  };

  if (minimizado) {
    return (
      <div
        onClick={onClick}
        className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-3.5 hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer flex flex-col justify-between gap-2.5 group"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {isPrioritario && (
                  <Badge className="bg-amber-500 text-white border-amber-600 text-[9px] gap-0.5 px-1.5 py-0">
                    <Star className="w-2.5 h-2.5 fill-white" /> URGENTE
                  </Badge>
                )}
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 leading-none">
                  #{pedido.numero_pedido}
                </h3>
                {pedido.of_nome ? (
                  <Badge variant="outline" className="text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 px-1.5 py-0">
                    OF: {pedido.of_nome}
                  </Badge>
                ) : pedido.of_odoo_id ? (
                  <Badge variant="outline" className="text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 px-1.5 py-0">
                    OF: {pedido.of_odoo_id}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5">
                {pedido.cliente_nome || "Cliente não informado"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className="bg-emerald-600 text-white border-emerald-700 text-[10px] font-bold px-2 py-0.5 shadow-xs">
              Concluído 100%
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-slate-700 dark:text-slate-300">{pedido.total_itens || 1} item(ns)</span>
            <span>•</span>
            <span className="truncate max-w-[120px]">{pedido.vendedor_nome || "—"}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(pedido); }}
                title="Excluir pedido"
                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpandidoManual(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 transition-colors"
              title="Expandir card completo com croquis e itens"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Expandir
            </button>
          </div>
        </div>
      </div>
    );
  }

  const itens = (() => {
    try {
      const arr = typeof pedido.itens_json === "string" ? JSON.parse(pedido.itens_json || "[]") : (pedido.itens || []);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  })();

  const grupoSetor = (() => {
    if (itens.length > 0) {
      return classGrupo(itens[0]);
    }
    return classGrupo(pedido);
  })();

  const cfgSetor = SETOR_CARD_CFG[grupoSetor] || SETOR_CARD_CFG.cd;
  const isCompacto = compacto || dentroDeGrupo;

  if (isCompacto) {
    return (
      <div
        onClick={onClick}
        className={`${cfgSetor.bgTint} ${cfgSetor.borderLeft} border rounded-xl p-2.5 hover:shadow-md transition-all cursor-pointer flex flex-col gap-2 ${
          isPrioritario
            ? "border-amber-400 dark:border-amber-600 ring-1 ring-amber-300/50"
            : isConcluido
            ? "border-emerald-300 dark:border-emerald-800"
            : cfgSetor.borderBase
        }`}
      >
        {/* Cabeçalho Compacto: Focado na identificação da OF, setor e status */}
        <div className="flex items-start justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
            {onToggleSelect && (
              <div
                onClick={(e) => { e.stopPropagation(); onToggleSelect(pedido); }}
                className="shrink-0"
                title="Selecionar OP"
              >
                <input
                  type="checkbox"
                  checked={!!selecionado}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
              </div>
            )}
            {isPrioritario && (
              <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-[9px] px-1 py-0 gap-0.5">
                <Star className="w-2.5 h-2.5 fill-white" /> URGENTE
              </Badge>
            )}
            <Badge className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0 leading-tight ${cfgSetor.badgeCls}`}>
              {cfgSetor.curto}
            </Badge>
            <span
              className="font-extrabold text-xs text-indigo-700 dark:text-indigo-300 font-mono bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200/80 truncate max-w-[170px]"
              title={pedido.of_nome || (pedido.of_odoo_id ? `OF: ${pedido.of_odoo_id}` : `#${pedido.numero_pedido}`)}
            >
              {pedido.of_nome || (pedido.of_odoo_id ? `OF: ${pedido.of_odoo_id}` : `#${pedido.numero_pedido}`)}
            </span>
            <Badge className={`border text-[9px] px-1.5 py-0 leading-tight ${st.cls}`}>{st.label}</Badge>
            {statusEstoque && (
              <Badge
                onClick={(e) => {
                  e.stopPropagation();
                  setSimulacaoModalOpen(true);
                }}
                className={`text-[9px] font-bold px-1.5 py-0 leading-tight border cursor-pointer hover:scale-105 hover:shadow-xs transition-all ${
                  statusEstoque.statusGeral === "disponivel" || statusEstoque.statusGeral === "ok"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                    : statusEstoque.statusGeral === "desbobinar" || statusEstoque.statusGeral === "parcial"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                    : "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 hover:bg-red-500/25"
                }`}
                title="Clique para ver a simulação completa de bobinas e consumo"
              >
                {statusEstoque.shortBadge}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleSincronizarOdoo}
              disabled={sincronizando}
              title="Sincronizar com Odoo ERP"
              className="p-1 rounded text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${sincronizando ? "animate-spin" : ""}`} />
            </button>
            {onTransferir && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTransferir(pedido); }}
                title="Transferir para outra Central PCP / Filial"
                className="p-1 rounded text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors"
              >
                <ArrowRightLeft className="w-3 h-3" />
              </button>
            )}
            {(onSetPrioridade || onTogglePrioridade) && (
              <div onClick={(e) => e.stopPropagation()}>
                <SeletorPrioridadeDropdown
                  pedido={pedido}
                  onSelectPrioridade={(nivel) => {
                    if (onSetPrioridade) onSetPrioridade(pedido, nivel);
                    else onTogglePrioridade(pedido);
                  }}
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1 text-[10px]"
                />
              </div>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(pedido); }}
                title="Excluir"
                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de Itens Compacta */}
        <PedidoItensLista
          pedido={pedido}
          itensJson={pedido.itens_json}
          pedidosProducao={pedidosProducao}
          ordensCD={ordensCD}
          compacto={true}
          estoqueContext={estoqueContext}
        />

        {/* Botões Rápidos */}
        {pedido.status_pcp === "pendente_distribuicao" && onDistribuir && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDistribuir(pedido); }}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold ${cfgSetor.btnDistribuir} text-white shadow-xs transition-all h-7`}
              title="Distribuir esta OF para os galpões"
            >
              <Zap className="w-3 h-3" />
              Distribuir
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all h-7"
              title="Ver detalhes técnicos desta OF"
            >
              Detalhes
            </button>
          </div>
        )}

        {podeRetirarFila && onRetirarFila && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRetirarFila(pedido); }}
            className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors h-6"
          >
            <Undo2 className="w-3 h-3" />
            Retirar da Fila
          </button>
        )}

        {simulacaoModalOpen && (
          <SimulacaoEstoqueMaterialDialog
            open={simulacaoModalOpen}
            onOpenChange={setSimulacaoModalOpen}
            pedido={pedido}
            statusEstoque={statusEstoque}
            estoqueContext={estoqueContext}
          />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`${cfgSetor.bgTint} ${cfgSetor.borderLeft} border rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer flex flex-col gap-3 ${
        isPrioritario
          ? "border-amber-400 dark:border-amber-600 ring-1 ring-amber-300/50"
          : isConcluido
          ? "border-emerald-300 dark:border-emerald-800"
          : cfgSetor.borderBase
      }`}
    >
      <div className="flex items-start gap-2.5">
        {onToggleSelect && (
          <div
            onClick={(e) => { e.stopPropagation(); onToggleSelect(pedido); }}
            className="pt-0.5 shrink-0"
            title="Selecionar OP"
          >
            <input
              type="checkbox"
              checked={!!selecionado}
              onChange={() => {}}
              className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
            />
          </div>
        )}
        <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isPrioritario && (
                <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-[10px] gap-0.5">
                  <Star className="w-3 h-3 fill-white" /> URGENTE
                </Badge>
              )}
              <Badge className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 leading-tight ${cfgSetor.badgeCls}`}>
                {cfgSetor.curto}
              </Badge>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 leading-none">
                #{pedido.numero_pedido}
              </h3>
              {pedido.of_nome ? (
                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80">
                  OF: {pedido.of_nome}
                </Badge>
              ) : pedido.of_odoo_id ? (
                <Badge variant="outline" className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/80">
                  OF: {pedido.of_odoo_id}
                </Badge>
              ) : pedido.odoo_id ? (
                <span className="text-[10px] text-slate-400 font-mono">Odoo:{pedido.odoo_id}</span>
              ) : null}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5">
              {pedido.cliente_nome || "Cliente não informado"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSincronizarOdoo}
              disabled={sincronizando}
              title="Sincronizar em tempo real com o Mini BI do Odoo ERP"
              className="p-1 rounded-md text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? "animate-spin" : ""}`} />
            </button>
            {onTransferir && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTransferir(pedido); }}
                title="Transferir para outra Central PCP / Filial"
                className="p-1 rounded-md text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {(onSetPrioridade || onTogglePrioridade) && (
              <div onClick={(e) => e.stopPropagation()}>
                <SeletorPrioridadeDropdown
                  pedido={pedido}
                  onSelectPrioridade={(nivel) => {
                    if (onSetPrioridade) onSetPrioridade(pedido, nivel);
                    else onTogglePrioridade(pedido);
                  }}
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5"
                />
              </div>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(pedido); }}
                title="Excluir pedido"
                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <PrioridadeBadge pedido={pedido} />
            <Badge className={`border ${st.cls}`}>{st.label}</Badge>
            {statusEstoque && (
              <Badge
                onClick={(e) => {
                  e.stopPropagation();
                  setSimulacaoModalOpen(true);
                }}
                className={`text-[10px] font-bold px-2 py-0.5 border cursor-pointer hover:scale-105 hover:shadow-xs transition-all ${
                  statusEstoque.statusGeral === "disponivel" || statusEstoque.statusGeral === "ok"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                    : statusEstoque.statusGeral === "desbobinar" || statusEstoque.statusGeral === "parcial"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                    : "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 hover:bg-red-500/25"
                }`}
                title="Clique para ver a simulação completa de bobinas e consumo"
              >
                {statusEstoque.badgeGeral}
              </Badge>
            )}
            {isConcluido && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandidoManual(false);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors border border-emerald-300 dark:border-emerald-700"
                title="Minimizar card concluído"
              >
                <ChevronUp className="w-3 h-3 text-emerald-600" />
                Minimizar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{pedido.vendedor_nome || "—"}</span>
        </div>

        {/* Informações de Loja de Venda e Fábrica de Produção */}
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          {pedido.loja_venda && (
            <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 gap-1 py-0">
              <Store className="w-2.5 h-2.5 text-slate-400" />
              <span>Venda: {pedido.loja_venda}</span>
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] font-semibold bg-orange-50/60 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 gap-1 py-0">
            <Building2 className="w-2.5 h-2.5 text-orange-500" />
            <span>PCP: {pedido.unidade || "Matriz AJL"}</span>
          </Badge>
          {pedido.loja_venda && pedido.unidade && pedido.loja_venda !== pedido.unidade && (
            <Badge variant="outline" className="text-[9px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200/80 gap-0.5 py-0" title={`Vendido em ${pedido.loja_venda} direcionado para produção em ${pedido.unidade}`}>
              🔄 Roteado
            </Badge>
          )}
          {pedido.unidade_transferida_de && (
            <Badge variant="outline" className="text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 gap-0.5 py-0" title={`Transferido de ${pedido.unidade_transferida_de}. Motivo: ${pedido.motivo_transferencia || 'Transferência manual'}`}>
              ↔️ De {pedido.unidade_transferida_de}
            </Badge>
          )}
        </div>
      </div>

      {/* SLA Countdown (Regra 6) */}
      <SlaCountdownBadge dataPrometida={pedido.data_entrega} />

      {/* Lista de Itens com Barras de Progresso Individuais e Etapas (Telha+EPS+Manta) */}
      <PedidoItensLista
        pedido={pedido}
        itensJson={pedido.itens_json}
        pedidosProducao={pedidosProducao}
        ordensCD={ordensCD}
        estoqueContext={estoqueContext}
      />

      {/* Barra de Progresso Geral do Pedido (Combinando todos os itens) */}
      {(() => {
        const pct = progressoReal != null ? progressoReal : (pedido.percentual_concluido || 0);
        return (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Progresso Geral do Pedido
              </span>
              <span className={`font-black text-sm ${pct >= 100 ? "text-emerald-600" : "text-orange-600"}`}>
                {pct}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-amber-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDataBR(pedido.data_entrega)}</span>
        </div>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span className="text-slate-500 dark:text-slate-400">SLA {sla}d úteis</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
        {pedido.itens_telha_count > 0 && (
          <Badge className="bg-blue-600 text-white border-blue-700 text-[10px] shadow-xs">
            <Home className="w-3 h-3 mr-0.5" />{pedido.itens_telha_count} Telha
          </Badge>
        )}
        {pedido.itens_cd_count > 0 && (
          <Badge className="bg-orange-600 text-white border-orange-700 text-[10px] shadow-xs">
            <Scissors className="w-3 h-3 mr-0.5" />{pedido.itens_cd_count} C&D
          </Badge>
        )}
        {pedido.itens_frisada_count > 0 && (
          <Badge className="bg-teal-600 text-white border-teal-700 text-[10px] shadow-xs">
            <Wind className="w-3 h-3 mr-0.5" />{pedido.itens_frisada_count} Frisada
          </Badge>
        )}
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 ml-auto">
          <Layers className="w-3 h-3" />{pedido.total_itens || 0} itens
        </span>
      </div>

      {espessuras.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Tag className="w-3 h-3 text-slate-400" />
          {espessuras.map((e, idx) => (
            <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {e.espessura}mm
            </span>
          ))}
        </div>
      )}
      {pedido.status_pcp === "pendente_distribuicao" && onDistribuir && (
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDistribuir(pedido); }}
            className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${cfgSetor.btnDistribuir} text-white shadow-sm transition-all`}
            title="Distribuir este pedido individualmente para os galpões"
          >
            <Zap className="w-3.5 h-3.5" />
            Distribuir Pedido
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all"
            title="Programar máquinas e datas de produção dos itens"
          >
            <Calendar className="w-3.5 h-3.5 text-orange-500" />
            Itens
          </button>
        </div>
      )}

      {podeRetirarFila && onRetirarFila && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRetirarFila(pedido); }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Retirar da Fila do Galpão
        </button>
      )}

      {simulacaoModalOpen && (
        <SimulacaoEstoqueMaterialDialog
          open={simulacaoModalOpen}
          onOpenChange={setSimulacaoModalOpen}
          pedido={pedido}
          statusEstoque={statusEstoque}
          estoqueContext={estoqueContext}
        />
      )}
    </div>
  );
}