import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  History, Search, Calendar, Wrench, Download,
  CheckCircle2, X, Filter, User, Layers, ArrowUpDown,
  Scissors, Factory, Clock, Camera
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { formatDataHoraBR } from "@/lib/reconstruirHistoricoHelper";
import HistoricoPedidoSidebar from "@/components/corte-dobra/HistoricoPedidoSidebar";
import { useFilial } from "@/contexts/FilialContext";

const MAQUINAS_CD = [
  "Todas",
  "DESBOBINADEIRA",
  "CORTE 3M",
  "DOBRA 3M",
  "CORTE 6M",
  "DOBRA FUNDO 6M",
  "DOBRA INICIO 6M",
  "PERFILADEIRA",
];

export default function HistoricoGeralCD() {
  const { filialAtiva } = useFilial();
  const [busca, setBusca] = useState("");
  const [maquinaFiltro, setMaquinaFiltro] = useState("Todas");
  const [presetData, setPresetData] = useState("este_mes");
  const [dataInicio, setDataInicio] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [ordenacao, setOrdenacao] = useState("mais_recentes");
  const [pedidoHistoricoNumero, setPedidoHistoricoNumero] = useState(null);

  // Consulta ordens de Desbobinadeira
  const { data: ordensDesb = [] } = useQuery({
    queryKey: ["historico-cd-desb", filialAtiva],
    queryFn: async () => {
      const lista = await base44.entities.OrdemDesbobinadeira.list("-data", 1000).catch(() => []);
      if (!filialAtiva || filialAtiva === "todas") return lista;
      return lista.filter(o => (o.unidade || "Matriz AJL") === filialAtiva);
    },
    refetchInterval: 15000,
  });

  // Consulta ordens de Máquinas (Corte/Dobra/Perfiladeira)
  const { data: ordensMaq = [] } = useQuery({
    queryKey: ["historico-cd-maq", filialAtiva],
    queryFn: async () => {
      const lista = await base44.entities.OrdemMaquinaCD.list("-data", 1000).catch(() => []);
      if (!filialAtiva || filialAtiva === "todas") return lista;
      return lista.filter(o => (o.unidade || "Matriz AJL") === filialAtiva);
    },
    refetchInterval: 15000,
  });

  // Unifica as ordens de Corte e Dobra
  const todasOrdens = useMemo(() => {
    const dFmt = ordensDesb.map(o => ({
      ...o,
      _tipo: "desbobinadeira",
      maquina: o.maquina || "DESBOBINADEIRA",
      descricaoItem: o.bobina_descricao || o.produto || "Bobina Aço",
      qtdPecas: Number(o.quantidade) || 1,
      peso: Number(o.peso_kg) || 0,
    }));

    const mFmt = ordensMaq.map(o => ({
      ...o,
      _tipo: "maquina",
      maquina: o.maquina || "CORTE / DOBRA",
      descricaoItem: `${o.tipo_peca || "Peça"} ${o.chapa_descricao ? `(${o.chapa_descricao})` : ""}`,
      qtdPecas: Number(o.quantidade) || 1,
      peso: Number(o.peso_kg) || 0,
    }));

    return [...dFmt, ...mFmt];
  }, [ordensDesb, ordensMaq]);

  // Presets de Data
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

  // Filtragem
  const ordensFiltradas = useMemo(() => {
    return todasOrdens.filter(o => {
      const dt = o.data_finalizacao ? o.data_finalizacao.slice(0, 10) : o.data;
      if (dataInicio && dt && dt < dataInicio) return false;
      if (dataFim && dt && dt > dataFim) return false;

      if (maquinaFiltro !== "Todas" && !o.maquina?.includes(maquinaFiltro)) return false;

      if (busca.trim()) {
        const q = busca.toLowerCase().trim();
        const num = String(o.numero_pedido || "").toLowerCase();
        const oc = String(o.numero_oc || "").toLowerCase();
        const cli = String(o.cliente || "").toLowerCase();
        const desc = String(o.descricaoItem || "").toLowerCase();
        const maq = String(o.maquina || "").toLowerCase();
        const op = String(o.operadores || o.operador || "").toLowerCase();

        const match = num.includes(q) || oc.includes(q) || cli.includes(q) || desc.includes(q) || maq.includes(q) || op.includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const dtA = a.data_finalizacao || a.data || a.created_date || "";
      const dtB = b.data_finalizacao || b.data || b.created_date || "";
      if (ordenacao === "mais_antigos") return dtA.localeCompare(dtB);
      if (ordenacao === "maior_quantidade") return (b.qtdPecas || 0) - (a.qtdPecas || 0);
      return dtB.localeCompare(dtA);
    });
  }, [todasOrdens, dataInicio, dataFim, maquinaFiltro, busca, ordenacao]);

  // KPIs
  const kpis = useMemo(() => {
    let pecasTotal = 0;
    let pesoTotal = 0;
    let concluidas = 0;
    const pedidosSet = new Set();

    ordensFiltradas.forEach(o => {
      pecasTotal += o.qtdPecas || 0;
      pesoTotal += o.peso || 0;
      if (o.status === "finalizado" || o.data_finalizacao) concluidas++;
      if (o.numero_pedido) pedidosSet.add(String(o.numero_pedido).trim());
    });

    return {
      totalOrdens: ordensFiltradas.length,
      concluidas,
      pecasTotal,
      pesoTotal: Math.round(pesoTotal),
      pedidosUnicos: pedidosSet.size,
    };
  }, [ordensFiltradas]);

  const exportarCSV = () => {
    if (ordensFiltradas.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    const headers = ["Pedido", "OC", "Data Finalizacao", "Data Agendada", "Maquina", "Cliente", "Pecas/Qtd", "Descricao", "Status", "Operadores"];
    const linhas = ordensFiltradas.map(o => [
      `"${o.numero_pedido || ""}"`,
      `"${o.numero_oc || ""}"`,
      `"${o.data_finalizacao || ""}"`,
      `"${o.data || ""}"`,
      `"${o.maquina || ""}"`,
      `"${(o.cliente || "").replace(/"/g, '""')}"`,
      o.qtdPecas || 0,
      `"${(o.descricaoItem || "").replace(/"/g, '""')}"`,
      `"${o.status || ""}"`,
      `"${(o.operadores || o.operador || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...linhas.map(l => l.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `historico_corte_dobra_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Histórico exportado com sucesso!");
  };

  return (
    <div className="space-y-4">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-orange-500" />
            Histórico Geral de Produção — Corte e Dobra
          </h2>
          <p className="text-xs text-muted-foreground">
            Consulta consolidada de desbobinadeiras, guilhotinas e dobradeiras
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

      {/* ── KPIS CONSOLIDADOS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground block">Ordens no Período</span>
          <p className="text-2xl font-black text-foreground mt-0.5">
            {kpis.totalOrdens} <span className="text-xs font-normal text-muted-foreground">({kpis.concluidas} finalizadas)</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground block">Peças Produzidas</span>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-0.5">
            {kpis.pecasTotal.toLocaleString("pt-BR")} pçs
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground block">Peso Total Estimado</span>
          <p className="text-2xl font-black text-foreground mt-0.5">
            ~{kpis.pesoTotal.toLocaleString("pt-BR")} kg
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground block">Pedidos Atendidos</span>
          <p className="text-2xl font-black text-foreground mt-0.5">
            {kpis.pedidosUnicos}
          </p>
        </div>
      </div>

      {/* ── BARRA DE FILTROS ── */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por pedido, OC, cliente, peça, máquina, operador..."
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
                {MAQUINAS_CD.map(m => (
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
                <option value="maior_quantidade">Maior Quantidade</option>
              </select>
            </div>
          </div>
        </div>

        {/* Presets de Data */}
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

      {/* ── TABELA ── */}
      {ordensFiltradas.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="font-bold text-sm">Nenhuma ordem encontrada para este filtro.</p>
          <p className="text-xs opacity-70 mt-1">Tente ampliar o período ou selecionar "Todo o Histórico".</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-black text-muted-foreground uppercase select-none">
                <th className="py-3 px-3">Pedido / OC</th>
                <th className="py-3 px-3">Data / Conclusão</th>
                <th className="py-3 px-3">Cliente</th>
                <th className="py-3 px-3">Máquina</th>
                <th className="py-3 px-3">Material / Peça</th>
                <th className="py-3 px-3">Quantidade</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Rastreabilidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {ordensFiltradas.map((ordem) => {
                const isFinalizado = ordem.status === "finalizado" || Boolean(ordem.data_finalizacao);

                return (
                  <tr key={`${ordem._tipo}_${ordem.id}`} className="hover:bg-muted/30 transition-colors">
                    {/* Pedido / OC */}
                    <td className="py-2.5 px-3 font-mono">
                      <span className="font-black text-xs bg-muted px-2 py-0.5 rounded border border-border block w-fit">
                        #{ordem.numero_pedido || ordem.numero_oc || "S/N"}
                      </span>
                      {ordem.numero_oc && ordem.numero_oc !== ordem.numero_pedido && (
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          OC: {ordem.numero_oc}
                        </span>
                      )}
                    </td>

                    {/* Data */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-foreground block">
                        {ordem.data_finalizacao ? formatDataHoraBR(ordem.data_finalizacao) : (ordem.data || "—")}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        Agendado: {ordem.data || "—"}
                      </span>
                    </td>

                    {/* Cliente */}
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-foreground block truncate max-w-[180px]">
                        {ordem.cliente || "Cliente Balcão"}
                      </span>
                      {ordem.unidade && (
                        <span className="text-[10px] text-muted-foreground block">
                          {ordem.unidade}
                        </span>
                      )}
                    </td>

                    {/* Máquina */}
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px] font-bold border-orange-500/30 text-orange-700 dark:text-orange-300">
                        {ordem.maquina}
                      </Badge>
                      {(ordem.operadores || ordem.operador) && (
                        <span className="text-[10px] text-muted-foreground block mt-0.5 truncate max-w-[120px]">
                          Op: {ordem.operadores || ordem.operador}
                        </span>
                      )}
                    </td>

                    {/* Material / Peça */}
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-foreground block truncate max-w-[180px]">
                        {ordem.descricaoItem}
                      </span>
                      {ordem.espessura && (
                        <span className="text-[10px] text-muted-foreground block">
                          Chapa {ordem.espessura}mm
                        </span>
                      )}
                    </td>

                    {/* Quantidade */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-black text-orange-600 dark:text-orange-400 block text-xs">
                        {ordem.qtdPecas} pç(s)
                      </span>
                      {ordem.peso > 0 && (
                        <span className="text-[10px] text-muted-foreground block">
                          ~{ordem.peso} kg
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3">
                      <Badge className={isFinalizado ? "bg-emerald-600 text-white font-bold text-[10px]" : "bg-orange-500 text-white font-bold text-[10px]"}>
                        {isFinalizado ? "Concluído" : "Em Processo"}
                      </Badge>
                    </td>

                    {/* Ações */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPedidoHistoricoNumero(ordem.numero_pedido || ordem.numero_oc)}
                        className="h-7 px-2 text-xs font-bold gap-1 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/40 hover:text-orange-600"
                        title="Ver Linha do Tempo e Todas as Etapas do Pedido"
                      >
                        <History className="w-3.5 h-3.5 text-orange-500" />
                        <span>Timeline</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SIDEBAR DE HISTÓRICO DE PEDIDO ── */}
      {pedidoHistoricoNumero && (
        <HistoricoPedidoSidebar
          open={Boolean(pedidoHistoricoNumero)}
          onClose={() => setPedidoHistoricoNumero(null)}
          numeroPedido={pedidoHistoricoNumero}
        />
      )}
    </div>
  );
}
