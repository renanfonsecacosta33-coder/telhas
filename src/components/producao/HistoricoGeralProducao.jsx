import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  History, Search, Calendar, Factory, Download,
  CheckCircle2, X, Filter, User, Layers, ArrowUpDown,
  Printer, Camera, Clock, Sparkles, TrendingUp
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { formatDataHoraBR } from "@/lib/reconstruirHistoricoHelper";
import HistoricoPedidoTelhasSidebar from "@/components/producao/HistoricoPedidoTelhasSidebar";
import OPImpressao from "@/components/producao/OPImpressao";
import { useFilial } from "@/contexts/FilialContext";

const MAQUINAS = ["Todas", "TP - 40", "TP - 25", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];

export default function HistoricoGeralProducao() {
  const { filialAtiva } = useFilial();
  const [busca, setBusca] = useState("");
  const [maquinaFiltro, setMaquinaFiltro] = useState("Todas");
  const [presetData, setPresetData] = useState("este_mes");
  const [dataInicio, setDataInicio] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [ordenacao, setOrdenacao] = useState("mais_recentes"); // "mais_recentes" | "mais_antigos" | "maior_metragem"
  const [historicoPedidoSelecionado, setHistoricoPedidoSelecionado] = useState(null);
  const [opModalPedido, setOpModalPedido] = useState(null);

  // Busca todos os pedidos da fábrica
  const { data: todosPedidos = [], isLoading } = useQuery({
    queryKey: ["historico-producao-todos", filialAtiva],
    queryFn: async () => {
      const lista = await base44.entities.Pedido.list("-created_date", 1000).catch(() => []);
      if (!filialAtiva || filialAtiva === "todas") return lista;
      return lista.filter(p => (p.unidade || "Matriz AJL") === filialAtiva);
    },
    refetchInterval: 15000,
  });

  // Troca de preset de datas
  const aplicarPreset = (p) => {
    setPresetData(p);
    const hoje = new Date();
    if (p === "todas") {
      setDataInicio("");
      setDataFim("");
    } else if (p === "hoje") {
      const hStr = format(hoje, "yyyy-MM-dd");
      setDataInicio(hStr);
      setDataFim(hStr);
    } else if (p === "ontem") {
      const oStr = format(subDays(hoje, 1), "yyyy-MM-dd");
      setDataInicio(oStr);
      setDataFim(oStr);
    } else if (p === "ultimos_7d") {
      setDataInicio(format(subDays(hoje, 7), "yyyy-MM-dd"));
      setDataFim(format(hoje, "yyyy-MM-dd"));
    } else if (p === "ultimos_30d") {
      setDataInicio(format(subDays(hoje, 30), "yyyy-MM-dd"));
      setDataFim(format(hoje, "yyyy-MM-dd"));
    } else if (p === "este_mes") {
      setDataInicio(format(startOfMonth(hoje), "yyyy-MM-dd"));
      setDataFim(format(endOfMonth(hoje), "yyyy-MM-dd"));
    } else if (p === "mes_passado") {
      const ant = subMonths(hoje, 1);
      setDataInicio(format(startOfMonth(ant), "yyyy-MM-dd"));
      setDataFim(format(endOfMonth(ant), "yyyy-MM-dd"));
    } else if (p === "ano_atual") {
      setDataInicio(format(startOfYear(hoje), "yyyy-MM-dd"));
      setDataFim(format(hoje, "yyyy-MM-dd"));
    }
  };

  // Filtragem dos pedidos históricos
  const pedidosFiltrados = useMemo(() => {
    return todosPedidos.filter(p => {
      // 1. Data de finalização ou data de produção
      const dataAlvo = p.data_finalizacao || p.data || (p.created_date ? p.created_date.slice(0, 10) : "");
      if (dataInicio && dataAlvo && dataAlvo < dataInicio) return false;
      if (dataFim && dataAlvo && dataAlvo > dataFim) return false;

      // 2. Filtro de Máquina
      if (maquinaFiltro !== "Todas" && p.maquina !== maquinaFiltro) return false;

      // 3. Busca textual
      if (busca.trim()) {
        const q = busca.toLowerCase().trim();
        const num = String(p.numero_pedido || "").toLowerCase();
        const cli = String(p.cliente || "").toLowerCase();
        const vend = String(p.vendedor || "").toLowerCase();
        const prod = String(p.produto || "").toLowerCase();
        const maq = String(p.maquina || "").toLowerCase();
        const bob = String(p.bobina_superior || p.bobina_inferior || "").toLowerCase();

        const match = num.includes(q) || cli.includes(q) || vend.includes(q) || prod.includes(q) || maq.includes(q) || bob.includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      if (ordenacao === "mais_antigos") {
        return new Date(a.data_finalizacao || a.data || a.created_date || 0) - new Date(b.data_finalizacao || b.data || b.created_date || 0);
      }
      if (ordenacao === "maior_metragem") {
        return (Number(b.metros) || 0) - (Number(a.metros) || 0);
      }
      // Padrão: mais recentes primeiro
      return new Date(b.data_finalizacao || b.data || b.created_date || 0) - new Date(a.data_finalizacao || a.data || a.created_date || 0);
    });
  }, [todosPedidos, dataInicio, dataFim, maquinaFiltro, busca, ordenacao]);

  // KPIs consolidados do histórico
  const kpis = useMemo(() => {
    let metrosTotal = 0;
    let pecasTotal = 0;
    let concluidos = 0;
    const clientesSet = new Set();

    pedidosFiltrados.forEach(p => {
      metrosTotal += Number(p.metros) || 0;
      pecasTotal += Number(p.qtd_telhas) || Number(p.quantidade) || 1;
      if (p.status === "finalizado" || p.data_finalizacao) concluidos++;
      if (p.cliente) clientesSet.add(p.cliente.trim().toUpperCase());
    });

    const pesoEstimadoKg = Math.round(metrosTotal * 3.85);

    return {
      totalRegistros: pedidosFiltrados.length,
      concluidos,
      metrosTotal: +metrosTotal.toFixed(1),
      pecasTotal,
      pesoEstimadoKg,
      totalClientes: clientesSet.size,
    };
  }, [pedidosFiltrados]);

  // Exportação CSV do histórico
  const exportarCSV = () => {
    if (pedidosFiltrados.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    const headers = ["Pedido", "Data Finalizacao", "Data Agendada", "Maquina", "Cliente", "Vendedor", "Produto", "Metros", "Pecas", "Status", "Operador", "Bobina"];
    const linhas = pedidosFiltrados.map(p => [
      `"${p.numero_pedido || ""}"`,
      `"${p.data_finalizacao || ""}"`,
      `"${p.data || ""}"`,
      `"${p.maquina || ""}"`,
      `"${(p.cliente || "").replace(/"/g, '""')}"`,
      `"${(p.vendedor || "").replace(/"/g, '""')}"`,
      `"${(p.produto || "").replace(/"/g, '""')}"`,
      p.metros || 0,
      p.qtd_telhas || p.quantidade || 0,
      `"${p.status || ""}"`,
      `"${(p.operador || "").replace(/"/g, '""')}"`,
      `"${p.bobina_superior || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...linhas.map(l => l.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `historico_producao_telhas_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Histórico exportado com sucesso!");
  };

  return (
    <div className="space-y-4">
      {/* ── CABEÇALHO DO HISTÓRICO GERAL ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-orange-500" />
            Histórico Geral de Produção — Telhas
          </h2>
          <p className="text-xs text-muted-foreground">
            Consulta consolidada de todas as ordens produzidas e rastreabilidade total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportarCSV}
            className="h-8 text-xs font-bold gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* ── KPIS CONSOLIDADOS DO PERÍODO ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground block">Ordens no Período</span>
          <p className="text-2xl font-black text-foreground mt-0.5">
            {kpis.totalRegistros} <span className="text-xs font-normal text-muted-foreground">({kpis.concluidos} concluídas)</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground block">Metragem Produzida</span>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-0.5">
            {kpis.metrosTotal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground block">Peso Total Estimado</span>
          <p className="text-2xl font-black text-foreground mt-0.5">
            ~{kpis.pesoEstimadoKg.toLocaleString("pt-BR")} kg
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground block">Clientes Atendidos</span>
          <p className="text-2xl font-black text-foreground mt-0.5">
            {kpis.totalClientes}
          </p>
        </div>
      </div>

      {/* ── BARRA DE FILTROS DO HISTÓRICO ── */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
        {/* Linha 1: Busca e Máquina */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por pedido, cliente, vendedor, máquina, bobina..."
              className="pl-9 h-9 text-xs"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1 font-bold text-muted-foreground">
              <Factory className="w-3.5 h-3.5 text-orange-500" />
              <span>Máquina:</span>
              <select
                value={maquinaFiltro}
                onChange={(e) => setMaquinaFiltro(e.target.value)}
                className="h-8 text-xs bg-muted/50 border border-border rounded-lg px-2 font-bold cursor-pointer"
              >
                {MAQUINAS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 font-bold text-muted-foreground">
              <ArrowUpDown className="w-3.5 h-3.5 text-orange-500" />
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value)}
                className="h-8 text-xs bg-muted/50 border border-border rounded-lg px-2 font-bold cursor-pointer"
              >
                <option value="mais_recentes">Mais Recentes Primeiro</option>
                <option value="mais_antigos">Mais Antigos Primeiro</option>
                <option value="maior_metragem">Maior Metragem</option>
              </select>
            </div>
          </div>
        </div>

        {/* Linha 2: Presets de Período e Intervalo Livre */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-border/60 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="font-bold text-muted-foreground shrink-0 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" /> Período:
            </span>
            {[
              { id: "hoje", label: "Hoje" },
              { id: "ontem", label: "Ontem" },
              { id: "ultimos_7d", label: "Últimos 7d" },
              { id: "este_mes", label: "Este Mês" },
              { id: "mes_passado", label: "Mês Passado" },
              { id: "ano_atual", label: "Ano Atual" },
              { id: "todas", label: "Todo o Histórico" },
            ].map(p => (
              <Button
                key={p.id}
                size="sm"
                variant={presetData === p.id ? "default" : "outline"}
                onClick={() => aplicarPreset(p.id)}
                className={`h-7 text-xs font-bold px-2.5 ${presetData === p.id ? "bg-orange-600 text-white" : ""}`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground">De:</span>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPresetData("custom");
              }}
              className="h-7 text-xs w-32"
            />
            <span className="text-[11px] font-semibold text-muted-foreground">Até:</span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPresetData("custom");
              }}
              className="h-7 text-xs w-32"
            />
          </div>
        </div>
      </div>

      {/* ── LISTA / TABELA DE REGISTROS DO HISTÓRICO ── */}
      {pedidosFiltrados.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-bold text-sm">Nenhum registro encontrado para este filtro.</p>
          <p className="text-xs opacity-70 mt-1">Tente ampliar o período ou selecionar "Todo o Histórico".</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-black text-muted-foreground uppercase select-none">
                <th className="py-3 px-3">Pedido / OF</th>
                <th className="py-3 px-3">Conclusão / Data</th>
                <th className="py-3 px-3">Cliente / Vendedor</th>
                <th className="py-3 px-3">Produto & Metragem</th>
                <th className="py-3 px-3">Máquina & Equipe</th>
                <th className="py-3 px-3">Bobina Utilizada</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Rastreabilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {pedidosFiltrados.map((pedido) => {
                const isFinalizado = pedido.status === "finalizado" || Boolean(pedido.data_finalizacao);
                const metros = Number(pedido.metros) || 0;
                const pecas = Number(pedido.qtd_telhas) || Number(pedido.quantidade) || 1;

                return (
                  <tr key={pedido.id} className="hover:bg-muted/30 transition-colors">
                    {/* Pedido */}
                    <td className="py-2.5 px-3 font-mono">
                      <span className="font-black text-xs bg-muted px-2 py-0.5 rounded border border-border block w-fit">
                        #{pedido.numero_pedido || pedido.id?.slice(-6)?.toUpperCase()}
                      </span>
                      {pedido.of_odoo_id && (
                        <span className="text-[10px] text-muted-foreground block mt-0.5 truncate max-w-[120px]">
                          OF: {pedido.of_odoo_id}
                        </span>
                      )}
                    </td>

                    {/* Data */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-foreground block">
                        {pedido.data_finalizacao ? formatDataHoraBR(pedido.data_finalizacao) : (pedido.data || "—")}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Agendado: {pedido.data || "—"}
                      </span>
                    </td>

                    {/* Cliente / Vendedor */}
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-foreground block truncate max-w-[180px]">
                        {pedido.cliente || "Cliente Balcão"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block truncate max-w-[180px]">
                        Vend: {pedido.vendedor || "—"}
                      </span>
                    </td>

                    {/* Produto & Metragem */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-black text-orange-600 dark:text-orange-400 block text-xs">
                        {metros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                      </span>
                      <span className="text-[10px] text-muted-foreground block truncate max-w-[160px]">
                        {pecas} pç(s) · {pedido.produto || "TELHA"}
                      </span>
                    </td>

                    {/* Máquina & Operador */}
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px] font-bold border-orange-500/30 text-orange-700 dark:text-orange-300">
                        {pedido.maquina || "TP - 40"}
                      </Badge>
                      {pedido.operador && (
                        <span className="text-[10px] text-muted-foreground block mt-0.5 truncate max-w-[120px]">
                          Op: {pedido.operador}
                        </span>
                      )}
                    </td>

                    {/* Bobina */}
                    <td className="py-2.5 px-3">
                      {pedido.bobina_superior ? (
                        <Badge variant="outline" className="text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300">
                          {pedido.bobina_superior}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      <Badge className={isFinalizado ? "bg-emerald-600 text-white font-bold text-[10px]" : "bg-orange-500 text-white font-bold text-[10px]"}>
                        {isFinalizado ? "Concluído" : "Em Aberto"}
                      </Badge>
                    </td>

                    {/* Ações / Rastreabilidade */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setHistoricoPedidoSelecionado(pedido)}
                          className="h-7 px-2 text-xs font-bold gap-1 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600"
                          title="Ver Linha do Tempo e Auditoria Completa"
                        >
                          <History className="w-3.5 h-3.5 text-orange-500" />
                          <span>Timeline</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOpModalPedido(pedido)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Reimprimir Ordem de Produção (OP)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GAVETA DE RASTREABILIDADE DO PEDIDO SELECIONADO ── */}
      {historicoPedidoSelecionado && (
        <HistoricoPedidoTelhasSidebar
          open={Boolean(historicoPedidoSelecionado)}
          onClose={() => setHistoricoPedidoSelecionado(null)}
          pedidoId={historicoPedidoSelecionado.id}
          pedidoNumero={historicoPedidoSelecionado.numero_pedido}
          pedidoObj={historicoPedidoSelecionado}
        />
      )}

      {/* ── MODAL DE IMPRESSÃO DE OP ── */}
      {opModalPedido && (
        <OPImpressao
          pedido={opModalPedido}
          open={Boolean(opModalPedido)}
          onClose={() => setOpModalPedido(null)}
        />
      )}
    </div>
  );
}
