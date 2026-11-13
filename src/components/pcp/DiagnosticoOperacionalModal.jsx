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
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Wrench,
  Zap,
  ArrowRight,
  Factory,
  Building2,
  CalendarDays,
  Hash,
  Scale,
  Check,
  X
} from "lucide-react";
import {
  rodarDiagnosticoOperacional,
  corrigirInconsistenciaOperacional,
  autoCorrigirTodasInconsistencias
} from "@/lib/diagnosticoOperacionalHelper";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";

export default function DiagnosticoOperacionalModal({ open, onOpenChange, pedidosPcp = [] }) {
  const queryClient = useQueryClient();
  const { filialAtual } = useFilial();

  const [carregando, setCarregando] = useState(false);
  const [corrigindoId, setCorrigindoId] = useState(null);
  const [corrigindoTudo, setCorrigindoTudo] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState("todos"); // "todos" | "duplicados" | "colagem" | "fantasma"
  const [filtroBusca, setFiltroBusca] = useState("");

  // Estado para o Modal de Comparação & Resolução Lado a Lado
  const [itemComparacao, setItemComparacao] = useState(null);

  const executarDiagnostico = async () => {
    setCarregando(true);
    try {
      const res = await rodarDiagnosticoOperacional({ pedidosPcp });
      setDiagnostico(res);
    } catch (err) {
      toast.error(`Falha ao calcular diagnóstico: ${err.message}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (open) {
      executarDiagnostico();
    }
  }, [open, pedidosPcp?.length]);

  const handleConfirmarCancelamentoCopia = async (item) => {
    setCorrigindoId(item.id);
    try {
      const res = await corrigirInconsistenciaOperacional({ item, queryClient });
      if (res.sucesso) {
        setItemComparacao(null);
        await executarDiagnostico();
      }
    } finally {
      setCorrigindoId(null);
    }
  };

  const handleCorrigirTudo = async () => {
    if (!diagnostico?.listaInconsistencias?.length) return;
    const qtd = diagnostico.listaInconsistencias.length;
    if (!window.confirm(`Deseja conciliar e cancelar automaticamente todas as ${qtd} ordens excedentes e descompassos detectados?`)) {
      return;
    }

    setCorrigindoTudo(true);
    try {
      const res = await autoCorrigirTodasInconsistencias({
        listaInconsistencias: diagnostico.listaInconsistencias,
        queryClient
      });
      toast.success(`Conciliação concluída: ${res.sucessos} de ${res.total} pedidos ajustados com sucesso!`);
      await executarDiagnostico();
    } finally {
      setCorrigindoTudo(false);
    }
  };

  // Filtragem da lista
  const itensFiltrados = useMemo(() => {
    if (!diagnostico?.listaInconsistencias) return [];
    return diagnostico.listaInconsistencias.filter(item => {
      // Filtro por aba
      if (abaAtiva === "duplicados" && !item.tipo.startsWith("duplicado")) return false;
      if (abaAtiva === "colagem" && item.tipo !== "descompasso_colagem") return false;
      if (abaAtiva === "fantasma" && item.tipo !== "op_fantasma") return false;

      // Filtro por busca de texto
      if (filtroBusca.trim()) {
        const termo = filtroBusca.toLowerCase().trim();
        const texto = `${item.numeroPedido} ${item.ofNome} ${item.cliente} ${item.loja} ${item.descricao} ${item.motivoExato} ${item.ondeDizEstar}`.toLowerCase();
        if (!texto.includes(termo)) return false;
      }
      return true;
    });
  }, [diagnostico, abaAtiva, filtroBusca]);

  const score = diagnostico?.scoreIntegridade ?? 100;
  const scoreBadge =
    score >= 90
      ? { label: "Excelente", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300" }
      : score >= 70
      ? { label: "Atenção Operacional", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300" }
      : { label: "Crítico", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-300" };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          className="w-[96vw] max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 dark:bg-orange-500/25 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    Diagnóstico Operacional &amp; Auditoria de Duplicados
                    <Badge variant="outline" className={`text-[11px] font-bold ${scoreBadge.cls}`}>
                      {scoreBadge.label} ({score}%)
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                    Varredura com <strong>Regra Estrita</strong>: identifica duplicidades reais por código individual e medidas idênticas, separando por Loja e Setor.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={executarDiagnostico}
                  disabled={carregando}
                  className="gap-1.5 text-xs font-semibold h-8"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${carregando ? "animate-spin text-orange-500" : ""}`} />
                  {carregando ? "Auditando..." : "Recalcular"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* ═══════════════════════════════════════════════════════════════
              3 CARDS PRINCIPAIS DE TELEMETRIA E ÍNDICES
          ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 my-3">
            {/* Card 1: Índice de Duplicados */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Copy className="w-3.5 h-3.5 text-red-500" />
                    Índice de Duplicidade Real
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-2xl font-black font-mono ${
                      diagnostico?.indiceDuplicados > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {diagnostico?.indiceDuplicados ?? 0}%
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      ({diagnostico?.totalDuplicadosGeral ?? 0} cópias reais)
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] font-mono ${
                  diagnostico?.totalDuplicadosGeral > 0
                    ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                }`}>
                  {diagnostico?.totalDuplicadosGeral > 0 ? "Requer Atenção" : "0 Duplicados"}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                <strong>{diagnostico?.totalDuplicadosPcp ?? 0}</strong> no PCP · <strong>{diagnostico?.totalDuplicadosChaoFabrica ?? 0}</strong> nas máquinas
              </p>
            </div>

            {/* Card 2: Índice de Descompasso Máquinas / Colagem */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-amber-500" />
                    Descompasso de Máquinas
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-2xl font-black font-mono ${
                      diagnostico?.indiceDescompasso > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {diagnostico?.indiceDescompasso ?? 0}%
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      ({diagnostico?.totalDescompassoGeral ?? 0} ordens)
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] font-mono ${
                  diagnostico?.totalDescompassoGeral > 0
                    ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                }`}>
                  {diagnostico?.totalDescompassoGeral > 0 ? "Inconsistências" : "100% Sincronizado"}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                <strong>{diagnostico?.totalDescompassoColagem ?? 0}</strong> erro Colagem · <strong>{diagnostico?.totalDescompassoMaquinas ?? 0}</strong> OPs fantasmas/presas
              </p>
            </div>

            {/* Card 3: Score Geral de Integridade */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Score de Integridade
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                      {score}%
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      de confiabilidade
                    </span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold">
                  ✓
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                Baseado na auditoria de <strong>{diagnostico?.totalPedidosAnalisados ?? 0}</strong> ordens ativas
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              BARRA DE ABAS, FILTROS E BUSCA
          ═══════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: "todos", label: "Todos", count: diagnostico?.totalInconsistencias ?? 0 },
                { id: "duplicados", label: "Duplicados Reais", count: diagnostico?.totalDuplicadosGeral ?? 0 },
                { id: "colagem", label: "Erro na Colagem", count: diagnostico?.totalDescompassoColagem ?? 0 },
                { id: "fantasma", label: "Máquinas Fantasmas", count: diagnostico?.totalDescompassoMaquinas ?? 0 }
              ].map(aba => (
                <button
                  key={aba.id}
                  type="button"
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    abaAtiva === aba.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <span>{aba.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    abaAtiva === aba.id
                      ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                  }`}>
                    {aba.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar pedido, loja, cliente ou código..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              TABELA DE ITENS AUDITADOS (COM LOJA, SETOR, DATA E MOTIVO)
          ═══════════════════════════════════════════════════════════════ */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 my-2">
            {carregando ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
                <span>Aplicando Regra Estrita e cruzando especificações físicas com o chão de fábrica...</span>
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Nenhuma duplicidade real ou descompasso encontrado!
                </p>
                <p className="text-xs text-slate-500 max-w-md">
                  Itens com o mesmo número de pedido mas com medidas diferentes foram validados como legítimos (não duplicados).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">Pedido &amp; Código</th>
                      <th className="py-2.5 px-3">Setor &amp; Loja</th>
                      <th className="py-2.5 px-3">Cliente / Chegada</th>
                      <th className="py-2.5 px-3">Por que está duplicado? (Motivo)</th>
                      <th className="py-2.5 px-3">Onde diz que está</th>
                      <th className="py-2.5 px-3 text-right">O que fazer?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {itensFiltrados.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Pedido e Código Individual */}
                        <td className="py-2.5 px-3 font-mono">
                          <span className="font-bold text-sm text-orange-600 dark:text-orange-400 block">
                            #{item.numeroPedido}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mt-0.5" title="Código individual da OF">
                            <Hash className="w-2.5 h-2.5" />
                            {item.codigoIndividual || item.ofNome || "Sem Código"}
                          </span>
                        </td>

                        {/* Setor e Loja */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            {/* Setor: Telha ou C&D */}
                            {item.setor === "cd" ? (
                              <Badge variant="outline" className="text-[10px] font-bold bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300">
                                🏭 Corte &amp; Dobra
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300">
                                🏠 Fábrica de Telhas
                              </Badge>
                            )}

                            {/* Loja / Filial */}
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {item.loja || "Matriz AJL"}
                            </span>
                          </div>
                        </td>

                        {/* Cliente e Data de Chegada */}
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[170px]" title={item.cliente}>
                            {item.cliente}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                            <CalendarDays className="w-3 h-3 text-slate-400" />
                            {item.dataChegada || "—"}
                          </span>
                        </td>

                        {/* Motivo Exato do Problema */}
                        <td className="py-2.5 px-3 max-w-xs">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold px-1.5 py-0.5 mb-1 ${
                              item.tipo.startsWith("duplicado")
                                ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300"
                                : item.tipo === "descompasso_colagem"
                                ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                            }`}
                          >
                            {item.categoria}
                          </Badge>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                            {item.motivoExato || item.descricao}
                          </p>
                        </td>

                        {/* Onde diz que está */}
                        <td className="py-2.5 px-3 font-medium">
                          <span className="text-slate-700 dark:text-slate-300 block">
                            {item.ondeDizEstar}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {item.situacaoReal}
                          </span>
                        </td>

                        {/* Ação: Comparar & Resolver */}
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => setItemComparacao(item)}
                            className="h-7 px-2.5 text-xs font-bold gap-1 bg-orange-600 hover:bg-orange-700 text-white cursor-pointer shadow-xs"
                            title="Abre a comparação lado a lado da ordem original com a cópia para você escolher o que resolver com segurança"
                          >
                            <Scale className="w-3 h-3" />
                            Comparar &amp; Resolver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RODAPÉ COM BOTÕES DE AÇÃO EM LOTE
          ═══════════════════════════════════════════════════════════════ */}
          <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {diagnostico?.totalInconsistencias > 0 ? (
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {diagnostico.totalInconsistencias} duplicidade(s) estrita(s) ou descompasso(s) detectado(s).
                </span>
              ) : (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Nenhuma duplicidade ativa na fábrica.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs font-semibold"
              >
                Fechar
              </Button>

              {diagnostico?.totalInconsistencias > 0 && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleCorrigirTudo}
                  disabled={corrigindoTudo || carregando}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold gap-1.5 shadow-sm"
                >
                  <Zap className={`w-3.5 h-3.5 ${corrigindoTudo ? "animate-spin" : ""}`} />
                  {corrigindoTudo ? "Conciliando..." : `Conciliar e Cancelar Cópias (${diagnostico.totalInconsistencias})`}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL DE COMPARAÇÃO & RESOLUÇÃO LADO A LADO (O QUE É O RESOLVER)
      ═══════════════════════════════════════════════════════════════ */}
      {itemComparacao && (
        <Dialog open={!!itemComparacao} onOpenChange={(o) => !o && setItemComparacao(null)}>
          <DialogContent
            onPointerDownOutside={(e) => e.preventDefault()}
            className="w-[94vw] max-w-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl"
          >
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-600 font-bold">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black">
                    Resolver Duplicidade: Pedido #{itemComparacao.numeroPedido}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    {itemComparacao.motivoExato}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
              {/* Coluna 1: Ordem Original que será mantida */}
              <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      1. Ordem Original (Fica Ativa)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
                      Manter
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <p><strong>Loja:</strong> {itemComparacao.loja}</p>
                    <p><strong>Setor:</strong> {itemComparacao.setor === "cd" ? "Corte & Dobra" : "Fábrica de Telhas"}</p>
                    <p><strong>Cliente:</strong> {itemComparacao.cliente}</p>
                    <p><strong>Onde está:</strong> {itemComparacao.ondeDizEstar}</p>
                    {itemComparacao.ordemOriginal?.comprimento && (
                      <p><strong>Medida:</strong> {itemComparacao.ordemOriginal.comprimento}m ({itemComparacao.ordemOriginal.quantidade} peças)</p>
                    )}
                    <p className="text-[10px] text-slate-500 font-mono">
                      ID: {itemComparacao.ordemOriginal?.id || "Registro Original"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                  ✓ Esta ordem continuará na fila de produção normalmente.
                </div>
              </div>

              {/* Coluna 2: Cópia Excedente que será cancelada */}
              <div className="p-3.5 rounded-xl border border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" />
                      2. Cópia Excedente (Duplicada)
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-red-100 text-red-800 border-red-300">
                      Será Cancelada
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <p><strong>Problema:</strong> {itemComparacao.categoria}</p>
                    <p><strong>Motivo:</strong> Duplicidade idêntica detectada</p>
                    <p><strong>Data de Entrada:</strong> {itemComparacao.dataChegada}</p>
                    {itemComparacao.ordemDuplicada?.comprimento && (
                      <p><strong>Medida:</strong> {itemComparacao.ordemDuplicada.comprimento}m ({itemComparacao.ordemDuplicada.quantidade} peças)</p>
                    )}
                    <p className="text-[10px] text-slate-500 font-mono">
                      ID: {itemComparacao.ordemDuplicada?.id || itemComparacao.id}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-red-200 dark:border-red-800/60 text-[11px] text-red-700 dark:text-red-300 font-semibold">
                  ⚠️ Ao cancelar, esta cópia sai da máquina e evita corte duplo.
                </div>
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItemComparacao(null)}
                className="text-xs"
              >
                Voltar
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={corrigindoId === itemComparacao.id}
                onClick={() => handleConfirmarCancelamentoCopia(itemComparacao)}
                className="text-xs font-bold gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {corrigindoId === itemComparacao.id ? "Cancelando Cópia..." : "Confirmar Cancelamento da Cópia"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
