import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Disc,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  Calculator,
  Scale,
  Ruler,
  Scissors,
  Home,
  Wind,
  Package,
  Boxes,
  HelpCircle,
} from "lucide-react";
import { verificarEstoquePedido, verificarEstoqueItem } from "@/lib/estoqueMaterialHelper";
import { stripHtml } from "@/lib/stripHtml";

export default function SimulacaoEstoqueMaterialDialog({
  open,
  onOpenChange,
  pedido = null,
  analiseItem = null,
  statusEstoque = null,
  estoqueContext = null,
}) {
  // Se veio statusEstoque direto ou se precisamos calcular a partir de pedido + estoqueContext
  const diagnosticoGeral = useMemo(() => {
    if (statusEstoque) return statusEstoque;
    if (pedido && estoqueContext) {
      return verificarEstoquePedido(pedido, estoqueContext);
    }
    return null;
  }, [statusEstoque, pedido, estoqueContext]);

  // Lista de análises de itens disponíveis
  const analisesLista = useMemo(() => {
    if (analiseItem) return [analiseItem];
    if (diagnosticoGeral?.analises?.length > 0) return diagnosticoGeral.analises;
    return [];
  }, [analiseItem, diagnosticoGeral]);

  // Item ativo selecionado nas abas
  const [itemIndexAtivo, setItemIndexAtivo] = useState(0);

  // Garante que o index ativo esteja dentro dos limites
  const activeIdx = Math.min(Math.max(0, itemIndexAtivo), Math.max(0, analisesLista.length - 1));
  const analiseAtiva = analisesLista[activeIdx] || null;

  if (!analiseAtiva && !diagnosticoGeral) return null;

  const numPed = pedido?.numero_pedido || analiseAtiva?.itemOriginal?.numero_pedido || "—";
  const cliNome = pedido?.cliente_nome || analiseAtiva?.itemOriginal?.cliente_nome || "Cliente";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <Disc className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Simulação de Matéria-Prima & Bobinas</span>
                  <Badge variant="outline" className="text-[11px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                    OF #{numPed}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {cliNome} • Simulação rigorosa de peso a usar e saldo em estoque antes vs depois do uso
                </DialogDescription>
              </div>
            </div>

            {diagnosticoGeral && (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Peso Total Pedido</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {diagnosticoGeral.pesoTotalKg?.toLocaleString("pt-BR")} kg
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* 1. BANNER OPA: INDICAÇÃO EXPLÍCITA CONFORME SOLICITADO */}
        {(() => {
          const status = analiseAtiva?.status || diagnosticoGeral?.statusGeral;
          const isOk = status === "disponivel";
          const isParcial = status === "parcial";

          return (
            <div
              className={`rounded-2xl p-4 border transition-all shadow-sm ${
                isOk
                  ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100"
                  : isParcial
                  ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100"
                  : "bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isOk
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                      : isParcial
                      ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                      : "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                  }`}
                >
                  {isOk ? <Sparkles className="w-5 h-5" /> : isParcial ? <Clock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm sm:text-base font-extrabold flex items-center gap-2 flex-wrap">
                    {isOk ? (
                      <span>
                        🎉 Opa, temos sim matéria-prima{analiseAtiva?.espessura ? ` (${analiseAtiva.espessura}mm)` : ""} para fazer este pedido!
                      </span>
                    ) : isParcial ? (
                      <span>⚠️ Saldo Parcial de Matéria-Prima / Requer Desbobinar</span>
                    ) : (
                      <span>🔴 Falta Matéria-Prima no Estoque</span>
                    )}
                  </h4>
                  <p className="text-xs font-medium opacity-90 mt-1">
                    {analiseAtiva?.opaMensagem || diagnosticoGeral?.opaMensagemGeral}
                  </p>

                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex-wrap text-xs">
                    <span className="font-bold flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                      Consumo Estimado:{" "}
                      <strong className="text-slate-900 dark:text-white font-extrabold">
                        {(analiseAtiva?.calculoPeso?.pesoKg || diagnosticoGeral?.pesoTotalKg || 0).toLocaleString("pt-BR")} kg
                      </strong>
                    </span>
                    {analiseAtiva?.espessura && (
                      <span className="font-medium flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        Espessura: <strong>{analiseAtiva.espessura}mm</strong>
                      </span>
                    )}
                    {analiseAtiva?.cor && (
                      <span className="font-medium">
                        Cor: <strong>{analiseAtiva.cor}</strong>
                      </span>
                    )}
                    {analiseAtiva?.demanda?.metros > 0 && (
                      <span className="font-medium flex items-center gap-1">
                        <Ruler className="w-3.5 h-3.5 text-slate-500" />
                        Metragem: <strong>{analiseAtiva.demanda.metros}m</strong>
                        {analiseAtiva.demanda.isSanduiche && (
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold">
                            ({analiseAtiva.demanda.metrosNecessarios}m em 2 faces)
                          </span>
                        )}
                      </span>
                    )}
                    {analiseAtiva?.demanda?.pecas > 0 && (
                      <span className="font-medium flex items-center gap-1">
                        <Scissors className="w-3.5 h-3.5 text-slate-500" />
                        Peças: <strong>{analiseAtiva.demanda.pecas} un</strong>
                        {analiseAtiva.demanda.pecasOrigem === "estimado" && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold">
                            (est. a partir de {analiseAtiva.demanda.qtdOdoo} kg)
                          </span>
                        )}
                        {analiseAtiva.demanda.pecasOrigem === "obs" && (
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">
                            (conf. OBS)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. SELETOR DE ITENS (SE HOUVER MAIS DE UM ITEM NO PEDIDO) */}
        {analisesLista.length > 1 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Selecione o Item para Simular ({analisesLista.length} itens no pedido):
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
              {analisesLista.map((an, idx) => {
                const ativo = idx === activeIdx;
                const status = an.status;
                const isOk = status === "disponivel";
                const isParcial = status === "parcial";

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setItemIndexAtivo(idx)}
                    className={`px-3 py-2 rounded-xl text-left border text-xs font-semibold transition-all shrink-0 flex items-center gap-2 ${
                      ativo
                        ? "bg-white dark:bg-slate-900 border-orange-500 shadow-sm ring-1 ring-orange-500/30"
                        : "bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:bg-slate-200/60 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOk ? "bg-emerald-500" : isParcial ? "bg-amber-500" : "bg-rose-500"
                      }`}
                    />
                    <div className="max-w-[170px] truncate">
                      <p className="font-bold text-slate-900 dark:text-white truncate">
                        {stripHtml(an.produto || an.descricao || `Item #${idx + 1}`)}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {an.calculoPeso?.pesoKg || 0} kg • {an.espessura ? an.espessura + "mm" : "S/esp"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. DETALHES DO ITEM SELECIONADO & CÁLCULO DE PESO */}
        {analiseAtiva && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-3 shadow-2xs">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Produto & Demanda do Pedido
                </span>
                <h5 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {stripHtml(analiseAtiva.produto || analiseAtiva.descricao || "Item")}
                </h5>
                {analiseAtiva.descricao && analiseAtiva.descricao !== analiseAtiva.produto && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5">
                    {stripHtml(analiseAtiva.descricao)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  className={`text-xs font-bold px-2.5 py-1 ${
                    analiseAtiva.status === "disponivel"
                      ? "bg-emerald-600 text-white"
                      : analiseAtiva.status === "parcial"
                      ? "bg-amber-600 text-white"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  {analiseAtiva.status === "disponivel"
                    ? "Estoque 100% OK"
                    : analiseAtiva.status === "parcial"
                    ? "Parcial / Desbobinar"
                    : "Falta Material"}
                </Badge>
              </div>
            </div>

            {/* FÓRMULA FÍSICA APLICADA */}
            {analiseAtiva.calculoPeso?.formula && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2 text-xs">
                <Calculator className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">
                    Cálculo Rigoroso do Peso Usado:
                  </span>
                  <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                    {analiseAtiva.calculoPeso.formula}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. e 5. SIMULAÇÃO DE MATERIAIS COMPATÍVEIS
            Ordem inteligente: para Corte & Dobra (CD), exibe Chapas Cortadas PRIMEIRO, depois Bobinas para Desbobinar.
            Para Telhas e Frisadas, exibe Bobinas. */}
        {(() => {
          const isCD = analiseAtiva?.setor === "cd";

          const secaoBobinas = analiseAtiva?.bobinasSimuladas?.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Disc className="w-4 h-4 text-orange-500" />
                  {isCD ? "Bobinas para Desbobinar" : "Bobinas Compatíveis"}
                  {analiseAtiva.espessura ? ` (${analiseAtiva.espessura}mm)` : ""} em Estoque ({analiseAtiva.bobinasSimuladas.length}):
                </h5>
                <span className="text-[11px] text-slate-500">
                  Comparativo: <strong>Peso Agora</strong> ➔ <strong>Consumo</strong> ➔ <strong>Peso Depois</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analiseAtiva.bobinasSimuladas.map((b, bIdx) => {
                  const daParaFazer = b.daParaFazer;

                  return (
                    <div
                      key={b.id || bIdx}
                      className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 shadow-sm ${
                        daParaFazer
                          ? "bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400"
                          : "bg-slate-50 dark:bg-slate-900/60 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      <div>
                        {/* Header do Card da Bobina */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                                {b.codigo}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                                {b.chapa}mm
                              </Badge>
                              {b.cor && (
                                <Badge variant="outline" className="text-[10px] font-medium">
                                  {b.cor}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {b.unidade} • Status: <strong>{b.status}</strong>
                            </p>
                          </div>

                          <Badge
                            className={`text-[10px] font-bold px-2 py-0.5 ${
                              daParaFazer
                                ? "bg-emerald-600 text-white"
                                : "bg-amber-600 text-white"
                            }`}
                          >
                            {daParaFazer ? "✅ Dá p/ Fazer 100%" : "⚠️ Parcial"}
                          </Badge>
                        </div>

                        {/* COMPARAÇÃO DOS NÚMEROS: AGORA -> CONSUMO -> DEPOIS */}
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                          {/* Peso Agora */}
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                              Peso Agora
                            </span>
                            <span className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 block mt-0.5">
                              {b.pesoAtualKg?.toLocaleString("pt-BR")} kg
                            </span>
                            {b.metrosAtual > 0 && (
                              <span className="text-[10px] text-slate-500 font-mono block">
                                {b.metrosAtual?.toLocaleString("pt-BR")} m
                              </span>
                            )}
                          </div>

                          {/* Consumo do Pedido */}
                          <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
                              Consumo Pedido
                            </span>
                            <span className="text-sm sm:text-base font-extrabold text-orange-700 dark:text-orange-300 block mt-0.5">
                              - {b.pesoConsumoKg?.toLocaleString("pt-BR")} kg
                            </span>
                            {b.metrosConsumo > 0 && (
                              <span className="text-[10px] text-orange-600/80 font-mono block">
                                - {b.metrosConsumo?.toLocaleString("pt-BR")} m
                              </span>
                            )}
                          </div>

                          {/* Peso Depois de Usada */}
                          <div
                            className={`p-2 rounded-xl border ${
                              daParaFazer
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                                : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100"
                            }`}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                              Peso DEPOIS
                            </span>
                            <span className="text-sm sm:text-base font-black block mt-0.5">
                              {b.pesoAposUsoKg?.toLocaleString("pt-BR")} kg
                            </span>
                            {b.metrosAposUso != null && (
                              <span className="text-[10px] opacity-80 font-mono block">
                                {b.metrosAposUso?.toLocaleString("pt-BR")} m
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Barra de Progresso Visual de Consumo da Bobina */}
                        <div className="mt-3 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Percentual da bobina utilizado:</span>
                            <strong className="text-slate-800 dark:text-slate-200">{b.pctUso}%</strong>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                daParaFazer
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                  : "bg-gradient-to-r from-amber-500 to-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, b.pctUso)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Conclusão */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        {daParaFazer ? (
                          <p className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Dá para fabricar 100% nesta bobina! Sobrarão <strong>{b.sobraKg?.toLocaleString("pt-BR")} kg</strong>.
                            </span>
                          </p>
                        ) : (
                          <p className="text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Bobina insuficiente sozinha. Faltam <strong>{Math.abs(b.sobraKg)?.toLocaleString("pt-BR")} kg</strong> para completar.
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );

          const secaoChapas = analiseAtiva?.chapasSimuladas?.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h5 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Scissors className="w-4 h-4 text-orange-600" />
                  Lotes de Chapas Cortadas Prontas
                  {analiseAtiva.espessura ? ` (${analiseAtiva.espessura}mm)` : ""} em Estoque ({analiseAtiva.chapasSimuladas.length}):
                </h5>
                <span className="text-[11px] text-slate-500">
                  Comparativo: <strong>Peças Agora</strong> ➔ <strong>Peças Depois</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analiseAtiva.chapasSimuladas.map((c, cIdx) => {
                  const daParaFazer = c.daParaFazer;

                  return (
                    <div
                      key={c.id || cIdx}
                      className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 shadow-sm ${
                        daParaFazer
                          ? "bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800"
                          : "bg-slate-50 dark:bg-slate-900/60 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                              {c.codigo}
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Dimensões: <strong>{c.largura_mm} x {c.comprimento_mm} mm</strong> • Chapa <strong>{c.espessura_mm}mm</strong>
                            </p>
                          </div>

                          <Badge
                            className={`text-[10px] font-bold px-2 py-0.5 ${
                              daParaFazer ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                            }`}
                          >
                            {daParaFazer ? "✅ Chapas Suficientes" : "⚠️ Faltam Chapas"}
                          </Badge>
                        </div>

                        {/* COMPARAÇÃO DE PEÇAS E PESO */}
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <span className="text-[9px] font-bold uppercase text-slate-400 block">Peças Agora</span>
                            <span className="text-base font-extrabold text-slate-800 dark:text-slate-100 block mt-0.5">
                              {c.pecasAtual} un
                            </span>
                            <span className="text-[10px] text-slate-500 block">~{c.pesoAtualKg} kg</span>
                          </div>

                          <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-900/40">
                            <span className="text-[9px] font-bold uppercase text-orange-600 dark:text-orange-400 block">Consumo</span>
                            <span className="text-base font-extrabold text-orange-700 dark:text-orange-300 block mt-0.5">
                              - {c.pecasConsumo} un
                            </span>
                            <span className="text-[10px] text-orange-600/80 block">~{c.pesoConsumoKg} kg</span>
                          </div>

                          <div
                            className={`p-2 rounded-xl border ${
                              daParaFazer
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                                : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100"
                            }`}
                          >
                            <span className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Peças DEPOIS</span>
                            <span className="text-base font-black block mt-0.5">
                              {c.pecasAposUso} un
                            </span>
                            <span className="text-[10px] opacity-80 block">~{c.pesoAposUsoKg} kg</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        {daParaFazer ? (
                          <p className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Dá para fabricar 100% neste lote! Sobram <strong>{c.sobraPecas} chapas</strong>.
                            </span>
                          </p>
                        ) : (
                          <p className="text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Lote insuficiente. Faltam <strong>{Math.abs(c.sobraPecas)} chapas</strong>.
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );

          return isCD ? (
            <>
              {secaoChapas}
              {secaoBobinas}
            </>
          ) : (
            <>
              {secaoBobinas}
              {secaoChapas}
            </>
          );
        })()}

        {/* 6. ESTADO VAZIO (SEM MATERIAL COMPATÍVEL) */}
        {analiseAtiva &&
          analiseAtiva.bobinasSimuladas?.length === 0 &&
          analiseAtiva.chapasSimuladas?.length === 0 && (
            <div className="p-6 rounded-2xl border-2 border-dashed border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10 text-center space-y-2">
              <Boxes className="w-8 h-8 text-rose-500 mx-auto" />
              <h6 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                {analiseAtiva.espessura
                  ? `Nenhuma matéria-prima compatível (${analiseAtiva.espessura}mm) no estoque`
                  : "Espessura da matéria-prima não identificada"}
              </h6>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {analiseAtiva.espessura ? (
                  <>
                    Não há bobinas nem lotes de chapas com espessura{" "}
                    <strong>{analiseAtiva.espessura}mm</strong>{" "}
                    {analiseAtiva.setor === "telha" && analiseAtiva.cor ? (
                      <>e cor <strong>{analiseAtiva.cor}</strong> </>
                    ) : null}
                    disponíveis no estoque do setor{" "}
                    <strong>{analiseAtiva.setor === "cd" ? "Corte & Dobra" : analiseAtiva.setor === "telha" ? "Fábrica de Telhas" : "Frisadas"}</strong>.
                  </>
                ) : (
                  "Não foi possível extrair a espessura deste item. Defina a espessura no produto ou na descrição do pedido no Odoo para consultar o estoque."
                )}
              </p>
            </div>
          )}

        {/* Rodapé com botão de fechar */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            className="text-xs font-bold"
          >
            Fechar Simulação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
