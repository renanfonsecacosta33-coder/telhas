import React, { useState, useMemo } from "react";
import {
  format, addMonths, subMonths, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, isToday, isBefore, startOfDay, addWeeks, subWeeks,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Truck, Star, CheckCircle2, AlertTriangle, Scale, Ruler,
  Layers, Search, AlertCircle, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  agruparPedidosPorCalendario,
  LIMITE_CAPACIDADE_TON_PADRAO,
  LIMITE_CAPACIDADE_METROS_PADRAO
} from "@/lib/calendarioPcpHelper";
import PainelDiaPcpDrawer from "@/components/pcp/PainelDiaPcpDrawer";

const DIAS_DA_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DIAS_DA_SEMANA_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default function CalendarioPcpView({
  gruposPedidos = [],
  pedidosFiltrados = [],
  pedidosProducao = [],
  ordensCD = [],
  onReagendarPedido,
  onOpenDetalhe,
  limiteTon = LIMITE_CAPACIDADE_TON_PADRAO,
  limiteMetros = LIMITE_CAPACIDADE_METROS_PADRAO,
  readOnly = false
}) {
  const [dataAtual, setDataAtual] = useState(new Date());
  const [modoVisualizacao, setModoVisualizacao] = useState("mes"); // "mes" | "semana"
  const [diaSelecionadoData, setDiaSelecionadoData] = useState(null);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [gavetaSemDataAberta, setGavetaSemDataAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");

  // Base de cálculo: prioriza grupos de pedidos (Vendas Mãe), ou lista de OFs
  const basePedidos = useMemo(() => {
    if (gruposPedidos && gruposPedidos.length > 0) return gruposPedidos;
    return pedidosFiltrados || [];
  }, [gruposPedidos, pedidosFiltrados]);

  // Agrupamento centralizado por data
  const { mapaDias, semData } = useMemo(() => {
    return agruparPedidosPorCalendario(basePedidos, {
      pedidosProducao,
      ordensCD,
      limiteTon,
      limiteMetros
    });
  }, [basePedidos, pedidosProducao, ordensCD, limiteTon, limiteMetros]);

  // Filtro de busca textual caso o usuário queira encontrar um pedido no calendário
  const pedidosFiltradosPorBusca = useMemo(() => {
    if (!termoBusca.trim()) return null;
    const term = termoBusca.toLowerCase().trim();
    const setIds = new Set();

    basePedidos.forEach(p => {
      const num = String(p.numero_pedido || "").toLowerCase();
      const cli = String(p.cliente_nome || p.cliente || "").toLowerCase();
      const ven = String(p.vendedor || "").toLowerCase();
      if (num.includes(term) || cli.includes(term) || ven.includes(term)) {
        setIds.add(p.id || p.numero_pedido);
      }
    });
    return setIds;
  }, [basePedidos, termoBusca]);

  // Dias gerados para a grade (Mensal ou Semanal)
  const diasDaGrade = useMemo(() => {
    if (modoVisualizacao === "semana") {
      const inicio = startOfWeek(dataAtual, { weekStartsOn: 1 });
      const fim = endOfWeek(dataAtual, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: inicio, end: fim });
    }

    const inicioMes = startOfMonth(dataAtual);
    const fimMes = endOfMonth(dataAtual);
    const inicioGrade = startOfWeek(inicioMes, { weekStartsOn: 1 });
    const fimGrade = endOfWeek(fimMes, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: inicioGrade, end: fimGrade });
  }, [dataAtual, modoVisualizacao]);

  // Navegação
  const avancar = () => {
    setDataAtual(prev => modoVisualizacao === "semana" ? addWeeks(prev, 1) : addMonths(prev, 1));
  };

  const retroceder = () => {
    setDataAtual(prev => modoVisualizacao === "semana" ? subWeeks(prev, 1) : subMonths(prev, 1));
  };

  const irParaHoje = () => {
    setDataAtual(new Date());
  };

  const abrirDia = (dataIso, dadosDoDia) => {
    const dadosFinais = dadosDoDia || {
      dataIso,
      todos: [],
      rotas: [],
      prontidoes: [],
      concluidos: [],
      atrasados: [],
      metrosTotal: 0,
      pesoKgTotal: 0,
      toneladasTotal: 0,
      sobrecarregado: false
    };
    setDiaSelecionadoData(dadosFinais);
    setDrawerAberto(true);
  };

  // Título do Período
  const tituloPeriodo = useMemo(() => {
    if (modoVisualizacao === "semana") {
      const inicio = startOfWeek(dataAtual, { weekStartsOn: 1 });
      const fim = endOfWeek(dataAtual, { weekStartsOn: 1 });
      return `${format(inicio, "dd 'de' MMM", { locale: ptBR })} a ${format(fim, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}`;
    }
    return format(dataAtual, "MMMM 'de' yyyy", { locale: ptBR });
  }, [dataAtual, modoVisualizacao]);

  // Contagem de pedidos no período visível (semana ou mês)
  const totalPedidosNoPeriodo = useMemo(() => {
    let count = 0;
    diasDaGrade.forEach(dia => {
      const iso = format(dia, "yyyy-MM-dd");
      const dInfo = mapaDias.get(iso);
      if (dInfo?.todos?.length) count += dInfo.todos.length;
    });
    return count;
  }, [diasDaGrade, mapaDias]);

  // Se o mês atual estiver vazio na grade, identifica em quais outros meses existem pedidos carregados
  const outrosMesesComPedidos = useMemo(() => {
    if (totalPedidosNoPeriodo > 0 || mapaDias.size === 0) return [];
    const mesesMap = new Map();
    mapaDias.forEach((diaInfo, dataIso) => {
      if (!diaInfo.todos?.length) return;
      try {
        const d = parseISO(dataIso);
        if (!isNaN(d.getTime())) {
          const chaveMes = format(d, "yyyy-MM");
          const labelMes = format(d, "MMMM 'de' yyyy", { locale: ptBR });
          if (!mesesMap.has(chaveMes)) {
            mesesMap.set(chaveMes, { data: d, label: labelMes, total: 0 });
          }
          mesesMap.get(chaveMes).total += diaInfo.todos.length;
        }
      } catch {}
    });
    return Array.from(mesesMap.values());
  }, [totalPedidosNoPeriodo, mapaDias]);

  return (
    <div className="space-y-4">
      {/* Barra de Controles e Filtros do Calendário */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Navegação de Mês/Semana */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={retroceder}
                className="h-8 w-8 p-0 cursor-pointer hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                title="Período Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={irParaHoje}
                className="h-8 px-3 text-xs font-bold cursor-pointer hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
              >
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={avancar}
                className="h-8 w-8 p-0 cursor-pointer hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                title="Próximo Período"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 capitalize px-2">
              {tituloPeriodo}
            </h2>
          </div>

          {/* Alternância Mês/Semana e Busca */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-48 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar cliente ou #S0..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="h-9 pl-8 text-xs font-medium bg-slate-50 dark:bg-slate-800/60"
              />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => setTermoBusca("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Alternador Mês / Semana */}
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setModoVisualizacao("mes")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  modoVisualizacao === "mes"
                    ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Mês
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao("semana")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  modoVisualizacao === "semana"
                    ? "bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Semana
              </button>
            </div>
          </div>
        </div>

        {/* Alerta de Carga Máxima Recomendada */}
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
              <Scale className="w-3.5 h-3.5 text-amber-500" />
              Capacidade Alerta: <span className="text-amber-600 font-extrabold">&gt; {limiteTon} Ton / dia</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Cargas de Rota
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Prontidões / Balcão
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Concluídos
            </span>
          </div>

          {semData.length > 0 && (
            <button
              type="button"
              onClick={() => setGavetaSemDataAberta(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>{semData.length} pedido(s) sem data programada</span>
              {gavetaSemDataAberta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Gaveta de Pedidos Sem Data Definida */}
        {gavetaSemDataAberta && semData.length > 0 && (
          <div className="mt-3.5 p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/80 rounded-xl animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                📦 Pedidos aguardando definição de data pelo PCP:
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400">
                Pedidos aguardando agendamento
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {semData.map(p => (
                <div
                  key={p.id || p.numero_pedido}
                  className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-amber-200/80 dark:border-amber-700/60 shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-black text-xs text-slate-900 dark:text-slate-100">
                      #{p.numero_pedido || p.id}
                    </div>
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate" title={p.cliente_nome || p.cliente}>
                      {p.cliente_nome || p.cliente || "Cliente s/ nome"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {p._metricas?.metrosTotal || 0}m • {p._metricas?.pesoKgTotal || 0}kg
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      setDiaSelecionadoData({
                        dataIso: null,
                        todos: [p],
                        rotas: [],
                        prontidoes: [p],
                        concluidos: [],
                        atrasados: [],
                        reagendados: [],
                        metrosTotal: p._metricas?.metrosTotal || 0,
                        pesoKgTotal: p._metricas?.pesoKgTotal || 0,
                        toneladasTotal: p._metricas?.toneladasTotal || 0,
                        sobrecarregado: false
                      });
                      setDrawerAberto(true);
                    }}
                    className="h-7 text-xs font-bold px-2.5 bg-orange-600 hover:bg-orange-700 text-white cursor-pointer shrink-0"
                  >
                    {readOnly ? "Ver" : "Agendar"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Banner de Navegação Inteligente se o mês atual estiver sem pedidos mas houver pedidos carregados */}
      {outrosMesesComPedidos.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-xs animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2.5">
            <CalendarIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold">
                Nenhum pedido encontrado em <span className="capitalize">{tituloPeriodo}</span>.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Os pedidos desta consulta estão agendados em outro(s) mês(es):
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {outrosMesesComPedidos.map((m, idx) => (
              <Button
                key={idx}
                size="sm"
                onClick={() => setDataAtual(m.data)}
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-xs cursor-pointer capitalize"
              >
                <span>Ir para {m.label}</span>
                <Badge variant="secondary" className="bg-white/20 text-white text-[10px] px-1.5 py-0 h-4">
                  {m.total} pedido(s)
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Aviso caso existam pedidos sem data definida e o mês atual esteja vazio */}
      {semData.length > 0 && totalPedidosNoPeriodo === 0 && outrosMesesComPedidos.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-xs animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold">
                Existem {semData.length} pedido(s) carregados aguardando definição de data pelo PCP.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Os pedidos não têm data programada gravada e por isso não aparecem nos dias do calendário.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setGavetaSemDataAberta(true)}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-xs cursor-pointer"
          >
            Abrir Pedidos sem Data ({semData.length})
          </Button>
        </div>
      )}

      {/* Visão Semanal: Colunas Expandidas com Cards Diretos */}
      {modoVisualizacao === "semana" ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 bg-slate-100 dark:bg-slate-800/40">
            {diasDaGrade.map((dia, idx) => {
              const dataIso = format(dia, "yyyy-MM-dd");
              const diaInfo = mapaDias.get(dataIso) || null;
              const ehHoje = isToday(dia);
              const isFimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
              const metros = diaInfo?.metrosTotal || 0;
              const toneladas = diaInfo?.toneladasTotal || 0;
              const sobrecarga = diaInfo?.sobrecarregado || false;
              const pctCarga = Math.min(100, Math.round((toneladas / limiteTon) * 100));
              const pedidosDia = diaInfo?.todos || [];

              return (
                <div
                  key={dataIso}
                  className={`flex flex-col min-h-[550px] ${
                    isFimDeSemana
                      ? "bg-slate-50/70 dark:bg-slate-900/60"
                      : "bg-white dark:bg-slate-900"
                  } ${ehHoje ? "ring-2 ring-orange-500 ring-inset bg-orange-50/20" : ""}`}
                >
                  {/* Cabeçalho da Coluna do Dia */}
                  <div
                    onClick={() => abrirDia(dataIso, diaInfo)}
                    className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 cursor-pointer hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                        {DIAS_DA_SEMANA[idx]}
                      </span>
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 text-xs font-black rounded-full ${
                          ehHoje
                            ? "bg-orange-600 text-white shadow-xs"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {format(dia, "d")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-[11px] font-bold">
                      <span className="text-slate-600 dark:text-slate-400">
                        {metros.toLocaleString("pt-BR")}m
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded-md ${
                          sobrecarga
                            ? "bg-red-600 text-white animate-pulse"
                            : "bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {toneladas.toFixed(1)} Ton
                      </span>
                    </div>

                    {/* Mini barra de carga */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full ${
                          sobrecarga ? "bg-red-500" : pctCarga >= 70 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${pctCarga}%` }}
                      />
                    </div>
                  </div>

                  {/* Lista de Cards daquele Dia */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[620px]">
                    {pedidosDia.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-slate-400 text-xs font-medium">
                        <span>Sem pedidos</span>
                      </div>
                    ) : (
                      pedidosDia.map(p => {
                        const met = p._metricas || {};
                        const numPed = p.numero_pedido || p.id;
                        const cliente = p.cliente_nome || p.cliente || "Cliente s/ nome";

                        return (
                          <div
                            key={p.id || numPed}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 p-2.5 shadow-2xs hover:border-orange-400 transition-all text-left"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-black text-xs text-slate-900 dark:text-slate-100">
                                #{numPed}
                              </span>

                              {met.isRota && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                  Rota
                                </span>
                              )}
                              {met.isRetiraAgora && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 animate-pulse">
                                  Retira
                                </span>
                              )}
                              {!met.isRota && !met.isRetiraAgora && met.isPrioridade && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                  Prioritário
                                </span>
                              )}
                              {met.isConcluido && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                  100%
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 truncate" title={cliente}>
                              {cliente}
                            </div>

                            <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1">
                              <span>{met.metrosTotal || 0}m</span>
                              <span>{met.pesoKgTotal || 0}kg</span>
                            </div>

                            {/* Data Prometida (SLA Odoo) */}
                            <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 font-medium">
                                Prometido: <strong className="text-slate-700 dark:text-slate-300">{met.dataPrometidaFormatada}</strong>
                              </span>
                              {met.reagendadoAposPrometido && (
                                <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 px-1 rounded-sm">
                                  Adiado
                                </span>
                              )}
                            </div>

                            {/* Progresso */}
                            <div className="mt-1.5">
                              <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${met.progresso >= 100 ? "bg-emerald-500" : "bg-orange-500"}`}
                                  style={{ width: `${met.progresso}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-1 mt-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDetalhe?.(p);
                                }}
                                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                              >
                                Detalhes
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Grade Mensal */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          
          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-center">
            {DIAS_DA_SEMANA_CURTO.map((dia, idx) => (
              <div
                key={dia}
                className={`py-2 text-xs font-black uppercase tracking-wider ${
                  idx >= 5 ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"
                }`}
              >
                <span className="hidden sm:inline">{DIAS_DA_SEMANA[idx]}</span>
                <span className="sm:hidden">{dia}</span>
              </div>
            ))}
          </div>

          {/* Matriz dos Dias */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-100 dark:bg-slate-800/40">
            {diasDaGrade.map(dia => {
              const dataIso = format(dia, "yyyy-MM-dd");
              const diaInfo = mapaDias.get(dataIso) || null;
              const ehMesmoMes = isSameMonth(dia, dataAtual);
              const ehHoje = isToday(dia);
              const ehPassado = isBefore(startOfDay(dia), startOfDay(new Date()));
              const isFimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;

              const temPedidos = diaInfo && diaInfo.todos.length > 0;
              const metros = diaInfo?.metrosTotal || 0;
              const toneladas = diaInfo?.toneladasTotal || 0;
              const sobrecarga = diaInfo?.sobrecarregado || false;

              // Se busca ativa, verifica se este dia contém algum resultado
              const temMatchBusca = pedidosFiltradosPorBusca
                ? diaInfo?.todos.some(p => pedidosFiltradosPorBusca.has(p.id || p.numero_pedido))
                : false;

              // Percentual de carga para mini barra
              const pctCarga = Math.min(100, Math.round((toneladas / limiteTon) * 100));

              return (
                <div
                  key={dataIso}
                  onClick={() => abrirDia(dataIso, diaInfo)}
                  className={`min-h-[110px] sm:min-h-[135px] p-1.5 sm:p-2 flex flex-col justify-between transition-all cursor-pointer select-none group ${
                    !ehMesmoMes
                      ? "bg-slate-50/50 dark:bg-slate-900/30 opacity-45"
                      : isFimDeSemana
                      ? "bg-slate-50/70 dark:bg-slate-900/50"
                      : "bg-white dark:bg-slate-900"
                  } ${
                    ehHoje ? "ring-2 ring-orange-500 ring-inset bg-orange-50/20 dark:bg-orange-950/10" : ""
                  } ${
                    temMatchBusca ? "ring-2 ring-blue-500 bg-blue-50/30" : ""
                  } hover:bg-slate-50 dark:hover:bg-slate-800/60`}
                >
                  {/* Topo do Dia */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 text-xs font-black rounded-full transition-colors ${
                        ehHoje
                          ? "bg-orange-600 text-white shadow-xs"
                          : ehPassado && !ehHoje
                          ? "text-slate-400 dark:text-slate-500"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {format(dia, "d")}
                    </span>

                    {/* Badges de Carga Fabril (Metros e Toneladas) */}
                    {temPedidos && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                          {metros >= 1000 ? `${(metros / 1000).toFixed(1)}k` : `${Math.round(metros)}`}m
                        </span>
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                            sobrecarga
                              ? "bg-red-600 text-white font-extrabold animate-pulse"
                            : toneladas >= limiteTon * 0.7
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                        title={`${toneladas} Toneladas`}
                      >
                        {toneladas.toFixed(1)}T
                      </span>
                    </div>
                  )}
                </div>

                {/* Mini Barra de Carga Fabril */}
                {temPedidos && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden my-1">
                    <div
                      className={`h-full transition-all ${
                        sobrecarga
                          ? "bg-red-500"
                          : pctCarga >= 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${pctCarga}%` }}
                    />
                  </div>
                )}

                {/* Pílulas de Contagem por Categoria */}
                <div className="space-y-1 mt-auto">
                  {diaInfo?.rotas && diaInfo.rotas.length > 0 && (
                    <div className="flex items-center justify-between text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 truncate">
                      <span className="flex items-center gap-1 truncate">
                        <Truck className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">Rotas</span>
                      </span>
                      <span className="font-black shrink-0">{diaInfo.rotas.length}</span>
                    </div>
                  )}

                  {diaInfo?.prontidoes && diaInfo.prontidoes.length > 0 && (
                    <div className="flex items-center justify-between text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50 truncate">
                      <span className="flex items-center gap-1 truncate">
                        <Star className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">Prontidão</span>
                      </span>
                      <span className="font-black shrink-0">{diaInfo.prontidoes.length}</span>
                    </div>
                  )}

                  {diaInfo?.concluidos && diaInfo.concluidos.length > 0 && (
                    <div className="flex items-center justify-between text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50 truncate">
                      <span className="flex items-center gap-1 truncate">
                        <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">Concluídos</span>
                      </span>
                      <span className="font-black shrink-0">{diaInfo.concluidos.length}</span>
                    </div>
                  )}

                  {diaInfo?.atrasados && diaInfo.atrasados.length > 0 && (
                    <div className="flex items-center justify-between text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-600 text-white animate-pulse truncate shadow-2xs">
                      <span className="flex items-center gap-1 truncate">
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">Atrasados</span>
                      </span>
                      <span className="shrink-0">{diaInfo.atrasados.length}</span>
                    </div>
                  )}

                  {diaInfo?.reagendados && diaInfo.reagendados.length > 0 && (
                    <div className="flex items-center justify-between text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 truncate" title={`${diaInfo.reagendados.length} pedidos agendados para data posterior à promessa original (Odoo)`}>
                      <span className="truncate">Adiados (pós-SLA)</span>
                      <span className="font-black shrink-0">{diaInfo.reagendados.length}</span>
                    </div>
                  )}

                  {!temPedidos && (
                    <div className="h-4 sm:h-6 flex items-center justify-center opacity-0 group-hover:opacity-60 transition-opacity">
                      <span className="text-[10px] text-slate-400 font-semibold">+ Ver</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Drawer Lateral do Dia */}
      <PainelDiaPcpDrawer
        aberto={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        diaData={diaSelecionadoData}
        onReagendarPedido={onReagendarPedido}
        onOpenDetalhes={onOpenDetalhe}
        limiteTon={limiteTon}
        readOnly={readOnly}
        pedidosProducao={pedidosProducao}
        ordensCD={ordensCD}
      />
    </div>
  );
}
