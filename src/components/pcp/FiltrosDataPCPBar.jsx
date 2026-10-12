import React from "react";
import {
  Search, Calendar, Filter, X, ArrowUpDown, Flame, Clock, Star,
  AlertTriangle, ArrowRight, Inbox, CheckCircle2, Factory,
  LayoutList, Table, Columns3, AlertOctagon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function FiltrosDataPCPBar({
  termoBusca,
  onBuscaChange,
  placeholderBusca = "Buscar pedido, OF, cliente, vendedor...",
  filtroDataCampo = "data_recebimento",
  onDataCampoChange,
  filtroDataPreset = "todas",
  onSelectPreset,
  dataInicio = "",
  onDataInicioChange,
  dataFim = "",
  onDataFimChange,
  onLimparFiltros,
  filtroUrgencia = "todos",
  onFiltroUrgenciaChange,
  ordenacao = "mais_atrasados",
  onOrdenacaoChange,
  contadores = {
    total: 0,
    atrasados: 0,
    atrasadosCriticos: 0,
    atrasadosModerados: 0,
    hojeAmanha: 0,
    prioritarios: 0,
    emProducao: 0,
    finalizados: 0,
    naoDistribuidos: 0
  },
  labelNaoDistribuidos = "Não Distribuídos",
  opcoesDataCampo = null,
  viewMode = "cards", // "cards" | "tabela" | "kanban"
  onViewModeChange,
}) {
  const filtroDataAtivo = Boolean(dataInicio) || Boolean(dataFim) || (filtroDataPreset !== "todas" && filtroDataPreset !== "personalizada");
  const temFiltroAtivo = filtroDataAtivo || Boolean(termoBusca) || filtroUrgencia !== "todos" || ordenacao !== "mais_atrasados";

  return (
    <div className="space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
      {/* ── LINHA 1: BARRA DE BUSCA E ORDENAÇÃO ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Campo de Busca Rápida com Lupa */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={termoBusca}
            onChange={(e) => onBuscaChange(e.target.value)}
            placeholder={placeholderBusca}
            className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
          />
          {termoBusca && (
            <button
              type="button"
              onClick={() => onBuscaChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Seletor de Ordenação e Alternador de Estilo de Visão */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Alternador de Visão (Cards | Tabela | Kanban) */}
          {onViewModeChange && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => onViewModeChange("cards")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
                title="Visão em Lista de Cards Detalhados"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("tabela")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === "tabela"
                    ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
                title="Visão em Tabela Compacta (Estilo Planilha/Odoo)"
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabela</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("kanban")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === "kanban"
                    ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
                title="Visão em Quadro Kanban PCP"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          )}

          {/* Seletor de Ordenação */}
          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-orange-500 shrink-0" />
            <select
              value={ordenacao}
              onChange={(e) => onOrdenacaoChange(e.target.value)}
              className="h-8 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
            >
              <option value="mais_atrasados">🚨 Mais Atrasados Primeiro</option>
              <option value="urgencia_sla">⏱️ Menor Prazo Restante (SLA)</option>
              <option value="data_entrega_asc">📅 Data de Entrega (Mais Próxima)</option>
              <option value="data_entrada_desc">📥 Data de Entrada (Mais Recentes)</option>
              <option value="data_entrada_asc">⏳ Ordem de Chegada (FIFO)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── LINHA 2: CHIPS DE URGÊNCIA E STATUS (TODOS, ATRASADOS, HOJE, EM PRODUÇÃO, CONCLUÍDOS) ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={filtroUrgencia === "todos" ? "default" : "outline"}
            onClick={() => onFiltroUrgenciaChange("todos")}
            className={`h-7 text-xs font-bold gap-1 px-2.5 ${
              filtroUrgencia === "todos"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                : "text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            }`}
          >
            Todos ({contadores.total})
          </Button>

          {/* Botão Principal de Atrasados */}
          <Button
            size="sm"
            variant={filtroUrgencia === "mais_atrasados" ? "default" : "outline"}
            onClick={() => onFiltroUrgenciaChange("mais_atrasados")}
            className={`h-7 text-xs font-bold gap-1 px-2.5 border-red-300 dark:border-red-900 ${
              filtroUrgencia === "mais_atrasados"
                ? "bg-red-600 text-white hover:bg-red-700 shadow-xs"
                : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            🚨 Mais Atrasados ({contadores.atrasados})
          </Button>

          {/* Sub-chips de atraso quando há atrasados */}
          {contadores.atrasadosCriticos > 0 && (
            <Button
              size="sm"
              variant={filtroUrgencia === "atraso_critico" ? "default" : "outline"}
              onClick={() => onFiltroUrgenciaChange("atraso_critico")}
              className={`h-7 text-xs font-black gap-1 px-2 border-red-400 dark:border-red-800 ${
                filtroUrgencia === "atraso_critico"
                  ? "bg-red-700 text-white shadow-xs animate-pulse"
                  : "text-red-700 dark:text-red-300 hover:bg-red-100/50"
              }`}
              title="Atraso crítico maior ou igual a 5 dias úteis"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
              🔥 Crítico &gt;5d ({contadores.atrasadosCriticos})
            </Button>
          )}

          {contadores.atrasadosModerados > 0 && (
            <Button
              size="sm"
              variant={filtroUrgencia === "atraso_moderado" ? "default" : "outline"}
              onClick={() => onFiltroUrgenciaChange("atraso_moderado")}
              className={`h-7 text-xs font-bold gap-1 px-2 border-amber-400 dark:border-amber-800 ${
                filtroUrgencia === "atraso_moderado"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-800 dark:text-amber-300 hover:bg-amber-100/50"
              }`}
              title="Atraso de 1 a 4 dias úteis"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              ⚠️ 1-4d ({contadores.atrasadosModerados})
            </Button>
          )}

          <Button
            size="sm"
            variant={filtroUrgencia === "hoje_amanha" ? "default" : "outline"}
            onClick={() => onFiltroUrgenciaChange("hoje_amanha")}
            className={`h-7 text-xs font-bold gap-1 px-2.5 border-amber-300 dark:border-amber-900 ${
              filtroUrgencia === "hoje_amanha"
                ? "bg-amber-600 text-white hover:bg-amber-700 shadow-xs"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            ⏳ Vence Hoje / Amanhã ({contadores.hojeAmanha})
          </Button>

          {/* Novo Chip: Em Produção */}
          <Button
            size="sm"
            variant={filtroUrgencia === "em_producao" ? "default" : "outline"}
            onClick={() => onFiltroUrgenciaChange("em_producao")}
            className={`h-7 text-xs font-bold gap-1 px-2.5 border-blue-300 dark:border-blue-900 ${
              filtroUrgencia === "em_producao"
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-xs"
                : "text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            }`}
          >
            <Factory className="w-3.5 h-3.5 text-blue-500" />
            ⚙️ Em Produção ({contadores.emProducao || 0})
          </Button>

          {/* Novo Chip: Finalizados 100% */}
          <Button
            size="sm"
            variant={filtroUrgencia === "finalizados" ? "default" : "outline"}
            onClick={() => onFiltroUrgenciaChange("finalizados")}
            className={`h-7 text-xs font-bold gap-1 px-2.5 border-emerald-300 dark:border-emerald-900 ${
              filtroUrgencia === "finalizados"
                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ✅ Concluídos ({contadores.finalizados || 0})
          </Button>

          {contadores.prioritarios > 0 && (
            <Button
              size="sm"
              variant={filtroUrgencia === "prioritarios" ? "default" : "outline"}
              onClick={() => onFiltroUrgenciaChange("prioritarios")}
              className={`h-7 text-xs font-bold gap-1 px-2.5 border-amber-400 ${
                filtroUrgencia === "prioritarios"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              ⭐ Prioritários ({contadores.prioritarios})
            </Button>
          )}

          {contadores.naoDistribuidos > 0 && (
            <Button
              size="sm"
              variant={filtroUrgencia === "nao_distribuidos" ? "default" : "outline"}
              onClick={() => onFiltroUrgenciaChange("nao_distribuidos")}
              className={`h-7 text-xs font-bold gap-1 px-2.5 border-sky-300 dark:border-sky-900 ${
                filtroUrgencia === "nao_distribuidos"
                  ? "bg-sky-600 text-white hover:bg-sky-700 shadow-xs"
                  : "text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              📥 {labelNaoDistribuidos} ({contadores.naoDistribuidos})
            </Button>
          )}
        </div>

        {temFiltroAtivo && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onLimparFiltros}
            className="h-7 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 ml-auto"
          >
            <X className="w-3.5 h-3.5" /> Limpar Filtros
          </Button>
        )}
      </div>

      {/* ── LINHA 3: FILTRO AVANÇADO DE DATA (DATA X ATÉ DATA Y / ENTRADA VS ENTREGA) ── */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
        {/* Seletor de Tipo de Data e Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Filtrar por:</span>
            <select
              value={filtroDataCampo}
              onChange={(e) => onDataCampoChange(e.target.value)}
              className="h-7 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 font-bold text-blue-700 dark:text-blue-300 focus:outline-none cursor-pointer"
            >
              {opcoesDataCampo && opcoesDataCampo.length > 0 ? (
                opcoesDataCampo.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              ) : (
                <>
                  <option value="data_recebimento">📥 Data de Entrada no PCP</option>
                  <option value="data_entrega">🚚 Data de Entrega Prometida (SLA)</option>
                  <option value="data_previsao_fabrica">🏭 Previsão da Fábrica</option>
                </>
              )}
            </select>
          </div>

          {/* Presets Rápidos de Data */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: "todas", label: "Todas as Datas" },
              { id: "hoje", label: "Hoje" },
              { id: "ontem", label: "Ontem" },
              { id: "ultimos_7d", label: "Últimos 7 Dias" },
              { id: "este_mes", label: "Este Mês" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-all ${
                  filtroDataPreset === p.id
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Seleção Manual de Intervalo (Data X até Data Y) */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-500">De:</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => onDataInicioChange(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-medium h-6"
            />
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500">Até:</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => onDataFimChange(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none font-medium h-6"
            />
          </div>

          {filtroDataAtivo && (
            <button
              type="button"
              onClick={() => onSelectPreset("todas")}
              className="p-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md border border-rose-200 dark:border-rose-900/50"
              title="Limpar intervalo de datas"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}