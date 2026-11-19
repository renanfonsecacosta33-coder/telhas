import React, { useState } from "react";
import {
  X, Calendar, Truck, Star, CheckCircle2, AlertTriangle,
  ArrowRight, Clock, User, Layers, RefreshCw, ChevronRight,
  Maximize2, Sparkles, Scale, Ruler, ChevronDown, ChevronUp
} from "lucide-react";
import { format, parseISO, addDays, nextMonday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import ModalFinalizarEtapasCalendario from "@/components/pcp/ModalFinalizarEtapasCalendario";

export default function PainelDiaPcpDrawer({
  aberto,
  onClose,
  diaData,
  onReagendarPedido,
  onOpenDetalhes,
  limiteTon = 15,
  readOnly = false,
  pedidosProducao = [],
  ordensCD = []
}) {
  const [abaAtiva, setAbaAtiva] = useState("todas");

  // Controle de expansão de OFs inline no card
  const [ofsExpandidas, setOfsExpandidas] = useState(new Set());
  const toggleExpandirOfs = (pedId) => {
    setOfsExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(pedId)) next.delete(pedId);
      else next.add(pedId);
      return next;
    });
  };

  // Controle de finalização de etapas por modal
  const [modalEtapasOpen, setModalEtapasOpen] = useState(false);
  const [pedidoEtapasAlvo, setPedidoEtapasAlvo] = useState(null);
  const [ofEtapasAlvo, setOfEtapasAlvo] = useState(null);

  const abrirFinalizarEtapas = (ped, of = null) => {
    setPedidoEtapasAlvo(ped);
    setOfEtapasAlvo(of);
    setModalEtapasOpen(true);
  };

  if (!aberto || !diaData) return null;

  const {
    dataIso,
    todos = [],
    rotas = [],
    prontidoes = [],
    concluidos = [],
    atrasados = [],
    metrosTotal = 0,
    pesoKgTotal = 0,
    toneladasTotal = 0,
    sobrecarregado = false
  } = diaData;

  const dataFormatada = (() => {
    if (!dataIso) return "Sem data definida";
    try {
      const d = parseISO(dataIso);
      return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dataIso;
    }
  })();

  const pedidosExibidos = (() => {
    if (abaAtiva === "rotas") return rotas;
    if (abaAtiva === "prontidoes") return prontidoes;
    if (abaAtiva === "concluidos") return concluidos;
    if (abaAtiva === "atrasados") return atrasados;
    return todos;
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Direito */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
        
        {/* Cabeçalho do Drawer */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 rounded-lg">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 capitalize">
                    {dataFormatada}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Programação de Produção & Embarques do Dia
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cards de Métricas de Carga Diária */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <Ruler className="w-3.5 h-3.5 text-blue-500" /> Metragem
              </div>
              <div className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {metrosTotal.toLocaleString("pt-BR")} <span className="text-xs font-semibold text-slate-500">m</span>
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border shadow-2xs transition-colors ${
              sobrecarregado
                ? "bg-red-50/80 dark:bg-red-950/40 border-red-300 dark:border-red-800"
                : "bg-white dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/60"
            }`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <Scale className="w-3.5 h-3.5 text-amber-500" /> Carga Total
                </span>
                {sobrecarregado && (
                  <span className="text-[9px] font-extrabold uppercase bg-red-600 text-white px-1.5 py-0.2 rounded-full animate-pulse">
                    Alto
                  </span>
                )}
              </div>
              <div className={`text-base font-black mt-0.5 ${
                sobrecarregado ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
              }`}>
                {toneladasTotal.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs font-semibold text-slate-500">Ton</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <Layers className="w-3.5 h-3.5 text-purple-500" /> Pedidos
              </div>
              <div className="text-base font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {todos.length} <span className="text-xs font-semibold text-slate-500">venda(s)</span>
              </div>
            </div>
          </div>

          {/* Abas de Navegação interna do Dia */}
          <div className="flex items-center gap-1 mt-3.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setAbaAtiva("todas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                abaAtiva === "todas"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              Todos ({todos.length})
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("rotas")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                abaAtiva === "rotas"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              }`}
            >
              <Truck className="w-3 h-3" />
              Rotas ({rotas.length})
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("prontidoes")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                abaAtiva === "prontidoes"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              }`}
            >
              <Star className="w-3 h-3" />
              Prontidões ({prontidoes.length})
            </button>

            <button
              type="button"
              onClick={() => setAbaAtiva("concluidos")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                abaAtiva === "concluidos"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Concluídos ({concluidos.length})
            </button>

            {atrasados.length > 0 && (
              <button
                type="button"
                onClick={() => setAbaAtiva("atrasados")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  abaAtiva === "atrasados"
                    ? "bg-red-600 text-white shadow-xs animate-pulse"
                    : "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                Atrasados ({atrasados.length})
              </button>
            )}
          </div>
        </div>

        {/* Lista de Pedidos */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {pedidosExibidos.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                Nenhum pedido nesta categoria para o dia.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Alterne a aba ou selecione outro dia no calendário.
              </p>
            </div>
          ) : (
            pedidosExibidos.map(p => {
              const met = p._metricas || {};
              const ofs = p.ofs || [p];
              const numPed = p.numero_pedido || p.id;
              const cliente = p.cliente_nome || p.cliente || "Cliente não informado";
              const vendedor = p.vendedor || "—";
              const unidade = p.unidade || "Matriz AJL";

              return (
                <div
                  key={p.id || numPed}
                  className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-xs hover:border-orange-300 dark:hover:border-orange-500/50 transition-all"
                >
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                          #{numPed}
                        </span>
                        
                        {met.isRota && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <Truck className="w-3 h-3" /> Carga de Rota
                          </span>
                        )}

                        {met.isRetiraAgora && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800 animate-pulse">
                            ⚡ Retira Agora
                          </span>
                        )}

                        {!met.isRota && !met.isRetiraAgora && met.isPrioridade && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Star className="w-3 h-3" /> Prioritário
                          </span>
                        )}

                        {met.isConcluido && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> 100% Concluído
                          </span>
                        )}

                        {met.isAtrasado && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
                            ⚠️ Atrasado
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate" title={cliente}>
                        {cliente}
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>👤 {vendedor}</span>
                        <span>•</span>
                        <span>🏢 {unidade}</span>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => toggleExpandirOfs(p.id || numPed)}
                          className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md border text-[11px] transition-all cursor-pointer ${
                            ofsExpandidas.has(p.id || numPed)
                              ? "bg-orange-600 text-white border-orange-600 shadow-2xs"
                              : "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800 hover:bg-orange-100"
                          }`}
                          title="Clique para ver ou recolher as Ordens de Fabricação deste pedido"
                        >
                          <Layers className="w-3 h-3" />
                          <span>{ofsExpandidas.has(p.id || numPed) ? "Recolher OFs" : `Ver ${ofs.length} OF(s)`}</span>
                          {ofsExpandidas.has(p.id || numPed) ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {met.metrosTotal || 0}m
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500">
                        {met.pesoKgTotal || 0} kg
                      </div>
                    </div>
                  </div>

                  {/* Barra de Progresso no Chão de Fábrica */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                      <span>Progresso na Fábrica:</span>
                      <span className={met.progresso >= 100 ? "text-emerald-600 font-black" : "text-slate-700 dark:text-slate-300"}>
                        {met.progresso}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          met.progresso >= 100
                            ? "bg-emerald-500"
                            : met.progresso > 0
                            ? "bg-orange-500"
                            : "bg-slate-300 dark:bg-slate-600"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, met.progresso))}%` }}
                      />
                    </div>
                  </div>

                  {/* Comparativo de Datas: Prometido (SLA Odoo) vs Programado (PCP) */}
                  <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700/80 text-[11px] flex-wrap">
                    <div className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>Prometido (SLA):</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {met.dataPrometidaFormatada || "—"}
                      </span>
                    </div>

                    {met.dataProgramadaFormatada && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <div className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-orange-500" />
                          <span>Programado:</span>
                          <span className={`font-bold ${
                            met.reagendadoAposPrometido ? "text-amber-600 dark:text-amber-400 font-black" : "text-slate-800 dark:text-slate-200"
                          }`}>
                            {met.dataProgramadaFormatada}
                          </span>
                        </div>
                      </>
                    )}

                    {met.reagendadoAposPrometido && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 ml-auto">
                        Adiado pós-promessa
                      </span>
                    )}
                  </div>

                  {/* Pílulas de Máquinas Envolvidas */}
                  {met.maquinas && met.maquinas.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-2.5">
                      {met.maquinas.map(m => (
                        <span
                          key={m}
                          className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200/60 dark:border-slate-600/60"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Grade de OFs Expandida Inline */}
                  {ofsExpandidas.has(p.id || numPed) && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in-50 duration-150">
                      <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1.5 uppercase tracking-wide">
                          <Layers className="w-3.5 h-3.5 text-orange-500" /> Ordens de Fabricação ({ofs.length})
                        </span>
                        {!readOnly && !met.isConcluido && (
                          <button
                            type="button"
                            onClick={() => abrirFinalizarEtapas(p, null)}
                            className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Finalizar Pedido (100%)
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {ofs.map((pOf, idxOf) => {
                          const ofNome = pOf.of_nome || pOf.of_odoo_id || `OF #${idxOf + 1}`;
                          const prodOf = pOf.produto || pOf.descricao || pOf.item_produto || "Telhas";
                          const maqOf = pOf.maquina || pOf.onde_esta || "Mesa PCP";
                          const pctOf = pOf.percentual_concluido != null ? pOf.percentual_concluido : met.progresso;
                          const isOfDone = pctOf >= 100 || pOf.status_pcp === "concluido" || pOf.status === "finalizado";

                          return (
                            <div
                              key={pOf.id || idxOf}
                              className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-[11px]">
                                    {ofNome}
                                  </span>
                                  <Badge variant="outline" className="text-[9px] py-0 font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {maqOf}
                                  </Badge>
                                  {isOfDone ? (
                                    <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Concluída
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-semibold text-orange-600 dark:text-orange-400">
                                      {pctOf}% concluído
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5" title={prodOf}>
                                  {prodOf}
                                </div>
                              </div>

                              {!readOnly && !isOfDone && (
                                <Button
                                  size="sm"
                                  onClick={() => abrirFinalizarEtapas(p, pOf)}
                                  className="h-6 text-[10px] font-bold px-2.5 bg-orange-600 hover:bg-orange-700 text-white shrink-0 cursor-pointer shadow-2xs gap-1"
                                >
                                  <Sparkles className="w-2.5 h-2.5" /> Finalizar Etapa
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Botões de Ação do Card */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenDetalhes?.(p)}
                      className="h-7 text-xs font-bold gap-1 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" /> Detalhes
                    </Button>

                    {!readOnly && !met.isConcluido && (
                      <Button
                        size="sm"
                        onClick={() => abrirFinalizarEtapas(p, null)}
                        className="h-7 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs"
                        title="Finalizar etapas ou concluir 100% deste pedido"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Finalizar Etapas
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal de Finalização de Etapas Individual / Grupo */}
      <ModalFinalizarEtapasCalendario
        open={modalEtapasOpen}
        onOpenChange={setModalEtapasOpen}
        pedido={pedidoEtapasAlvo}
        ofAlvo={ofEtapasAlvo}
        pedidosProducao={pedidosProducao}
        ordensCD={ordensCD}
      />
    </>
  );
}
