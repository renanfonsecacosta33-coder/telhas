import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Factory, Download, Calendar, Database, TrendingUp, Trash2, Star, Truck, Inbox, Target, ShieldAlert, Layers, Trophy, Search, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import PedidoFormDialog from "@/components/producao/PedidoFormDialog";
import PedidoCard from "@/components/producao/PedidoCard";
import DiaResumoCard from "@/components/producao/DiaResumoCard";
import ProducaoDados from "@/pages/ProducaoDados";
import MetasProducaoDialog from "@/components/producao/MetasProducaoDialog";
import { useMetasProducao } from "@/hooks/useMetasProducao";
import AlertasEstoque from "@/components/producao/AlertasEstoque";
import OPImpressao from "@/components/producao/OPImpressao";
import { useFilial } from "@/contexts/FilialContext";
import ExpedicaoTab from "@/components/logistica/ExpedicaoTab";
import FilaPCPTelhas from "@/components/pcp/FilaPCPTelhas";
import KanbanBoard from "@/components/producao/KanbanBoard";
import FiltrosDataPCPBar from "@/components/pcp/FiltrosDataPCPBar";
import { extrairDataISO, calcularIntervaloPreset, ordenarPedidosPCP } from "@/lib/filtroDataHelper";
import { diasUteisRestantes } from "@/lib/sla";
import { prepararPresetNovaOrdemTelhas, getItens, computePercentual, statusPcpPorPercentual, buildItensJson } from "@/lib/pedidoOdooHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { isTelhaBandeja, montarTriadeTelhaBandeja } from "@/lib/bandejaHelper";

const MAQUINAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];

const MAQUINA_CORES = {
  "TP - 25": "bg-blue-100 text-blue-800 border-blue-200",
  "TP - 40": "bg-green-100 text-green-800 border-green-200",
  "ONDULADA": "bg-purple-100 text-purple-800 border-purple-200",
  "COLONIAL": "bg-orange-100 text-orange-800 border-orange-200",
  "BANDEJA": "bg-pink-100 text-pink-800 border-pink-200",
  "DESBOBINADOR": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "CUMEEIRA": "bg-teal-100 text-teal-800 border-teal-200",
  "COLAGEM": "bg-red-100 text-red-800 border-red-200",
};

export default function ProducaoAdmin() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filaContext, setFilaContext] = useState(null);
  const [viewMode, setViewMode] = useState("semana"); // "semana" | "dia"
  const [activeTab, setActiveTab] = useState("producao"); // "producao" | "dados"
  const [opOpen, setOpOpen] = useState(false);
  const [opPedido, setOpPedido] = useState(null);
  const [alertasVisivel, setAlertasVisivel] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // pedido a excluir
  const [metasDialogOpen, setMetasDialogOpen] = useState(false);
  const { metaGeral, calcularStatusMeta } = useMetasProducao();
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  // ── FILTROS AVANÇADOS E BUSCA ESTILO CENTRAL PCP ──
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos"); // "todos" | "mais_atrasados" | "hoje_amanha" | "prioritarios" | "nao_distribuidos"
  const [ordenacao, setOrdenacao] = useState("mais_atrasados");
  const [filtroDataCampo, setFiltroDataCampo] = useState("data"); // "data" | "data_entrega" | "data_prevista" | "created_date"
  const [filtroDataPreset, setFiltroDataPreset] = useState("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const diasDaSemana = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva }, "-data", 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Pedido.create(data),
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pre-baixa-bobinas-v2"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      setDialogOpen(false);
      toast.success("Pedido registrado!");

      const ctx = filaContext;
      setFilaContext(null);
      if (ctx) {
        try {
          // Busca atômica do PedidoOdoo mais recente pelo ID para evitar concorrência entre aberturas rápidas
          let pedFresco = null;
          try {
            pedFresco = await base44.entities.PedidoOdoo.get(ctx.pedidoId);
          } catch {
            const listP = await base44.entities.PedidoOdoo.filter({ id: ctx.pedidoId });
            pedFresco = listP?.[0];
          }
          const pedParaAtualizar = pedFresco || ctx.pedido;
          const itens = getItens(pedParaAtualizar);

          if (itens[ctx.itemIdx]) {
            itens[ctx.itemIdx] = {
              ...itens[ctx.itemIdx],
              status: "em_producao",
              maquina: variables?.maquina || itens[ctx.itemIdx]?.maquina || "",
            };
            const percentual = computePercentual(itens);
            const status_pcp = statusPcpPorPercentual(percentual, pedParaAtualizar.status_pcp);
            const updated = await base44.entities.PedidoOdoo.update(ctx.pedidoId, {
              itens_json: buildItensJson(itens),
              percentual_concluido: percentual,
              status_pcp,
            });
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
            await notificarStatus(updated, "maquina_inicio", {
              maquina_atual: variables?.maquina || "",
              item_nome: itens[ctx.itemIdx]?.produto || variables?.produto || "",
              inicio_fmt: new Date().toISOString(),
              status_novo: status_pcp,
            });
          }
        } catch (e) {
          console.error("[Fila PCP Telhas] erro ao atualizar item/webhook:", e?.message || e);
        }
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Pedido.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pedidos"] }); setDialogOpen(false); setEditItem(null); toast.success("Pedido atualizado!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Pedido.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pedidos"] }); toast.success("Pedido excluído!"); },
  });

  const handleSave = async (data) => {
    if (editItem && !editItem._presets && editItem.id) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      // Injeta identificadores atômicos
      const pedOdooId = filaContext?.pedidoId || data.pedido_odoo_id || null;
      const itemIdx = filaContext?.itemIdx != null ? filaContext.itemIdx : (data.item_idx != null ? data.item_idx : null);
      if (pedOdooId) data.pedido_odoo_id = pedOdooId;
      if (itemIdx != null) data.item_idx = itemIdx;

      // Verificação anti-duplicação precisa (NUNCA colidir itens diferentes do mesmo pedido)
      try {
        const pedNum = data.numero_pedido ? String(data.numero_pedido).trim() : "";
        if (pedNum) {
          const opsAtuais = await base44.entities.Pedido.filter({ numero_pedido: pedNum });
          const opExistente = opsAtuais.find(o => {
            if (o.status === "cancelado") return false;
            // Se temos o itemIdx e a OP gravada tem item_idx:
            if (itemIdx != null && o.item_idx != null) {
              return o.item_idx === itemIdx;
            }
            // Se não tem item_idx, só é a mesma OP se baterem todas as especificações físicas do corte:
            const mesmoCorteFisico = (
              o.produto === data.produto &&
              String(o.metros || 0) === String(data.metros || 0) &&
              String(o.tamanho_corte || o.comprimento || "") === String(data.tamanho_corte || data.comprimento || "")
            );
            return mesmoCorteFisico;
          });

          if (opExistente && opExistente.id) {
            updateMutation.mutate({ id: opExistente.id, data });
            return;
          }
        }
      } catch (errCheck) {
        console.warn("[ProducaoAdmin] Falha na verificação de OP existente:", errCheck);
      }

      if (isTelhaBandeja(data)) {
        const { ordemTelha, ordemBandeja, ordemColagem } = montarTriadeTelhaBandeja({ ...data, unidade: data.unidade || filialAtiva });
        try {
          await base44.entities.Pedido.create(ordemBandeja);
          await base44.entities.Pedido.create(ordemColagem);
        } catch (errBandeja) {
          console.error("[ProducaoAdmin] Erro ao criar ordens de Bandeja/Colagem:", errBandeja);
        }
        createMutation.mutate(ordemTelha);
        return;
      }

      createMutation.mutate(data);
    }
  };

  const openNew = (date = null, maquina = null) => {
    setEditItem(null);
    setDialogOpen(true);
    if (date || maquina) {
      setEditItem({ _presets: { data: date || selectedDay, maquina: maquina || "" } });
    }
  };

  const openEdit = (p) => { setEditItem(p); setDialogOpen(true); };

  const abrirOP = (p) => { setOpPedido(p); setOpOpen(true); };

  const togglePrioridade = (p) => {
    updateMutation.mutate({ id: p.id, data: { prioridade: !p.prioridade } });
  };

  const handleStatusChangeKanban = async (pedido, novoStatus) => {
    try {
      const patch = { status: novoStatus };
      if (novoStatus === "finalizado") {
        patch.data_finalizacao = format(new Date(), "yyyy-MM-dd");
      }
      await base44.entities.Pedido.update(pedido.id, patch);
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success(`Status alterado para ${novoStatus}!`);
    } catch (e) {
      toast.error("Erro ao alterar status: " + (e?.message || ""));
    }
  };

  const confirmarDelete = (id) => {
    const p = pedidos.find(x => x.id === id);
    setDeleteConfirm(p || { id });
  };

  // ── CONTROLE E FILTROS AVANÇADOS ──
  const temFiltroAtivo = Boolean(
    termoBusca.trim() ||
    filtroUrgencia !== "todos" ||
    (filtroDataPreset !== "todas" && filtroDataPreset !== "personalizada") ||
    Boolean(dataInicio) ||
    Boolean(dataFim) ||
    ordenacao !== "mais_atrasados"
  );

  const contadores = useMemo(() => {
    let atrasados = 0;
    let hojeAmanha = 0;
    let prioritarios = 0;
    let aguardando = 0;
    const hojeStr = format(new Date(), "yyyy-MM-dd");

    pedidos.forEach(p => {
      if (p.status === "cancelado") return;
      if (p.prioridade && p.status !== "finalizado") prioritarios++;
      if (p.status === "aguardando" || p.status === "pendente" || !p.status) aguardando++;

      if (p.status !== "finalizado") {
        const dataAlvo = p.data_entrega || p.data_prevista || p.data;
        if (dataAlvo) {
          const dtISO = extrairDataISO(dataAlvo);
          if (dtISO) {
            if (dtISO < hojeStr) {
              atrasados++;
            } else {
              const d = diasUteisRestantes(dtISO);
              if (d != null && d <= 1) hojeAmanha++;
            }
          }
        }
      }
    });

    return {
      total: pedidos.filter(p => p.status !== "cancelado").length,
      atrasados,
      hojeAmanha,
      prioritarios,
      naoDistribuidos: aguardando,
    };
  }, [pedidos]);

  const handleSelectPreset = (presetId) => {
    setFiltroDataPreset(presetId);
    if (presetId === "todas") {
      setDataInicio("");
      setDataFim("");
    } else {
      const { inicio, fim } = calcularIntervaloPreset(presetId);
      setDataInicio(inicio);
      setDataFim(fim);
    }
  };

  const handleLimparFiltros = () => {
    setTermoBusca("");
    setFiltroUrgencia("todos");
    setOrdenacao("mais_atrasados");
    setFiltroDataCampo("data");
    setFiltroDataPreset("todas");
    setDataInicio("");
    setDataFim("");
  };

  // Pedidos filtrados globalmente (em todas as datas e máquinas da fábrica)
  const pedidosFiltradosGlobal = useMemo(() => {
    let lista = pedidos.filter(p => p.status !== "cancelado");

    // 1. Busca textual inteligente sem falso-positivos
    if (termoBusca.trim()) {
      const q = termoBusca.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, "");

      lista = lista.filter(p => {
        // Pedido / Número
        const num = String(p.numero_pedido || "").toLowerCase().trim();
        const numDigits = num.replace(/\D/g, "");
        if (num.includes(q)) return true;
        if (qDigits && numDigits) {
          if (numDigits === qDigits || numDigits.endsWith(qDigits) || qDigits.endsWith(numDigits)) return true;
        }

        // Cliente e Vendedor
        if (String(p.cliente || "").toLowerCase().includes(q)) return true;
        if (String(p.vendedor || "").toLowerCase().includes(q)) return true;

        // Produto, Máquina, Bobina, RVM, Cor
        if (String(p.produto || "").toLowerCase().includes(q)) return true;
        if (String(p.maquina || "").toLowerCase().includes(q)) return true;
        if (String(p.bobina_superior || "").toLowerCase().includes(q)) return true;
        if (String(p.bobina_inferior || "").toLowerCase().includes(q)) return true;
        if (String(p.rvm_superior || "").toLowerCase().includes(q)) return true;
        if (String(p.rvm_inferior || "").toLowerCase().includes(q)) return true;
        if (String(p.cor_exigida || "").toLowerCase().includes(q)) return true;

        // OF e Observações
        if (String(p.of_nome || "").toLowerCase().includes(q)) return true;
        if (String(p.of_odoo_id || "").toLowerCase().includes(q)) return true;
        if (String(p.observacoes || "").toLowerCase().includes(q)) return true;
        if (String(p.observacoes_odoo || "").toLowerCase().includes(q)) return true;
        if (String(p.tamanho_corte || p.comprimento || "").toLowerCase().includes(q)) return true;

        return false;
      });
    }

    // 2. Filtro de Urgência
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    if (filtroUrgencia === "mais_atrasados") {
      lista = lista.filter(p => {
        if (p.status === "finalizado") return false;
        const dt = extrairDataISO(p.data_entrega || p.data_prevista || p.data);
        return dt && dt < hojeStr;
      });
    } else if (filtroUrgencia === "hoje_amanha") {
      lista = lista.filter(p => {
        if (p.status === "finalizado") return false;
        const dt = extrairDataISO(p.data_entrega || p.data_prevista || p.data);
        if (!dt) return false;
        const d = diasUteisRestantes(dt);
        return d != null && d >= 0 && d <= 1;
      });
    } else if (filtroUrgencia === "prioritarios") {
      lista = lista.filter(p => p.prioridade);
    } else if (filtroUrgencia === "nao_distribuidos") {
      lista = lista.filter(p => p.status === "aguardando" || p.status === "pendente" || !p.status);
    }

    // 3. Filtro por intervalo / campo de datas
    if (dataInicio || dataFim) {
      lista = lista.filter(p => {
        let valData = "";
        if (filtroDataCampo === "data") valData = p.data;
        else if (filtroDataCampo === "data_entrega") valData = p.data_entrega || p.data_prevista || p.data;
        else if (filtroDataCampo === "data_prevista") valData = p.data_prevista || p.data;
        else if (filtroDataCampo === "created_date") valData = p.created_date || p.data;
        else valData = p.data;

        const iso = extrairDataISO(valData);
        if (!iso) return false;
        if (dataInicio && iso < dataInicio) return false;
        if (dataFim && iso > dataFim) return false;
        return true;
      });
    }

    // 4. Ordenação
    return ordenarPedidosPCP(lista, ordenacao);
  }, [pedidos, termoBusca, filtroUrgencia, dataInicio, dataFim, filtroDataCampo, ordenacao]);

  // Pedidos da semana atual (ou filtrados pela pesquisa se ativo)
  const pedidosSemana = useMemo(() => {
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(weekEnd, "yyyy-MM-dd");
    const fonte = temFiltroAtivo ? pedidosFiltradosGlobal : pedidos;
    return fonte.filter(p => p.data >= startStr && p.data <= endStr);
  }, [pedidos, pedidosFiltradosGlobal, temFiltroAtivo, weekStart, weekEnd]);

  // Pedidos para exibição por máquina (visão global quando busca ativa, ou dia selecionado)
  const pedidosDia = useMemo(() => {
    if (temFiltroAtivo) {
      return pedidosFiltradosGlobal;
    }
    return pedidos
      .filter(p => p.data === selectedDay)
      .sort((a, b) => (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0));
  }, [pedidos, pedidosFiltradosGlobal, temFiltroAtivo, selectedDay]);

  const totalSemana = pedidosSemana.reduce((s, p) => s + calcularMetrosPedido(p), 0);

  const exportarSemana = () => {
    const linhas = ["Dia,Máquina,Cliente,Produto,Metros,Status"];
    pedidosSemana.forEach(p => {
      const m = calcularMetrosPedido(p);
      linhas.push(`${p.data},${p.maquina || ""},${p.cliente || ""},${p.produto || ""},${m.toFixed(1)},${p.status || ""}`);
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `producao_semana_${format(weekStart, "dd-MM-yyyy")}.csv`;
    a.click();
    toast.success("Exportado!");
  };

  return (
    <div className="space-y-6">
      {/* Alertas de Estoque */}
      {alertasVisivel && <AlertasEstoque onClose={() => setAlertasVisivel(false)} />}

      {/* Header + Abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="w-6 h-6" />
            Produção — Visão Admin
          </h1>
          <p className="text-sm text-muted-foreground">Todos os pedidos e produção diária</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "producao" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMetasDialogOpen(true)}
                className="gap-1.5 font-semibold text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/30"
              >
                <Target className="w-4 h-4 text-orange-500" />
                Metas do Dia
              </Button>
              <Button variant="outline" size="sm" onClick={exportarSemana} className="gap-1">
                <Download className="w-4 h-4" />
                Exportar
              </Button>
              <Button onClick={() => openNew()} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Pedido
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("producao")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "producao" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Factory className="w-4 h-4" />
          Produção
        </button>
        <Link
          to="/maquina/colagem"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-card hover:text-foreground hover:shadow"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          Colagem
        </Link>

        {/* Separador visual */}
        <div className="w-px bg-border mx-1 self-stretch" />

        {[
          { tab: "maq-tp40",         label: "TP - 40",       color: "bg-green-500",  path: "/maquina/tp40" },
          { tab: "maq-tp25",         label: "TP - 25",       color: "bg-blue-500",   path: "/maquina/tp25" },
          { tab: "maq-ondulada",     label: "Ondulada",      color: "bg-purple-500", path: "/maquina/ondulada" },
          { tab: "maq-colonial",     label: "Colonial",      color: "bg-orange-500", path: "/maquina/colonial" },
          { tab: "maq-bandeja",      label: "Bandeja",       color: "bg-pink-500",   path: "/maquina/bandeja" },
          { tab: "maq-desbobinador", label: "Desbobinador",  color: "bg-yellow-500", path: "/maquina/desbobinador" },
          { tab: "maq-cumeeira",     label: "Cumeeira",      color: "bg-teal-500",   path: "/maquina/cumeeira" },
        ].map(m => (
          <Link
            key={m.tab}
            to={m.path}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-card hover:text-foreground hover:shadow"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.color}`} />
            {m.label}
          </Link>
        ))}

        {/* Separador visual */}
        <div className="w-px bg-border mx-1 self-stretch" />

        <button
          onClick={() => setActiveTab("dados")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "dados" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Database className="w-4 h-4" />
          Dados
        </button>

        <button
          onClick={() => setActiveTab("expedicao")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "expedicao" ? "bg-card shadow text-blue-600" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Truck className="w-4 h-4" />
          Expedição
        </button>

        <button
          onClick={() => setActiveTab("fila_pcp")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "fila_pcp" ? "bg-card shadow text-orange-600" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Inbox className="w-4 h-4" />
          Fila PCP
        </button>

        {/* Separador visual */}
        <div className="w-px bg-border mx-1 self-stretch" />

        <Link
          to="/performance-operadores"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-amber-600 dark:text-amber-400 hover:bg-card hover:text-amber-500 hover:shadow font-semibold"
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          Ranking Equipe
        </Link>

        <Link
          to="/estoque-dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-teal-600 dark:text-teal-400 hover:bg-card hover:text-teal-500 hover:shadow font-semibold"
        >
          <Layers className="w-4 h-4 text-teal-500" />
          Estoque por Espessura
        </Link>

        <Link
          to="/dashboard-performance"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-card hover:text-foreground hover:shadow"
        >
          <TrendingUp className="w-4 h-4" />
          Performance
        </Link>

        <Link
          to="/dashboard-producao"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:bg-card hover:text-foreground hover:shadow"
        >
          <TrendingUp className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      {activeTab === "dados" && <ProducaoDados />}

      {activeTab === "expedicao" && <ExpedicaoTab tipo="telhas" filialAtiva={filialAtiva} />}

      {activeTab === "fila_pcp" && <FilaPCPTelhas onNovaOrdem={(pedido, item) => {
        setFilaContext({ pedidoId: pedido.id, itemIdx: item._idx, pedido, produtoFixo: item.produto || "" });
        if (item.existingOp) {
          // Se já existe OP para este pedido, abre diretamente para edição/revisão preservando todos os dados
          const op = item.existingOp;
          const presets = op._presets || {};
          setEditItem({
            ...presets,
            ...op,
            produto: op.produto || presets.produto || item.produto || "",
            numero_pedido: op.numero_pedido || presets.numero_pedido || pedido.numero_pedido || "",
            cliente: op.cliente || presets.cliente || pedido.cliente_nome || "",
            vendedor: op.vendedor || presets.vendedor || pedido.vendedor_nome || "",
            unidade: op.unidade || presets.unidade || pedido.unidade || filialAtiva || "Matriz AJL",
            metros: op.metros != null ? op.metros : (presets.metros != null ? presets.metros : item.quantidade),
            metragem_mm: op.metragem_mm != null ? op.metragem_mm : (presets.metragem_mm != null ? presets.metragem_mm : ""),
            quantidade_telhas: op.quantidade_telhas != null ? op.quantidade_telhas : (presets.quantidade_telhas != null ? presets.quantidade_telhas : item.quantidade),
            cor_exigida: op.cor_exigida || presets.cor_exigida || op.rvm_superior || "",
            observacoes_odoo: op.observacoes_odoo || presets.observacoes_odoo || item.descricao || "",
            _presets: undefined,
          });
        } else {
          setEditItem(prepararPresetNovaOrdemTelhas(pedido, item, filialAtiva));
        }
        setDialogOpen(true);
      }} />}

      {activeTab === "colagem" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Pedidos de Colagem</h2>
            <Button size="sm" onClick={() => { setActiveTab("producao"); setTimeout(() => openNew(selectedDay, "COLAGEM"), 100); }} className="gap-1">
              <Plus className="w-3 h-3" />
              Novo Pedido Colagem
            </Button>
          </div>
          {pedidos.filter(p => p.maquina === "COLAGEM").length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
              Nenhum pedido de colagem cadastrado
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.filter(p => p.maquina === "COLAGEM").sort((a, b) => b.data?.localeCompare(a.data)).map(p => (
                <PedidoCard key={p.id} pedido={p} maquinaCores={MAQUINA_CORES} onEdit={(p) => { setEditItem(p); setDialogOpen(true); }} onDelete={confirmarDelete} onStatusChange={(p, status) => updateMutation.mutate({ id: p.id, data: { ...p, status } })} onPrintOP={abrirOP} onTogglePrioridade={togglePrioridade} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "producao" && (<>

      {/* ── BARRA DE PESQUISA AVANÇADA E FILTROS ESTILO PCP ── */}
      <FiltrosDataPCPBar
        termoBusca={termoBusca}
        onBuscaChange={setTermoBusca}
        placeholderBusca="Buscar em toda a fábrica por pedido, OF, cliente, vendedor, produto, bobina..."
        filtroDataCampo={filtroDataCampo}
        onDataCampoChange={setFiltroDataCampo}
        filtroDataPreset={filtroDataPreset}
        onSelectPreset={handleSelectPreset}
        dataInicio={dataInicio}
        onDataInicioChange={setDataInicio}
        dataFim={dataFim}
        onDataFimChange={setDataFim}
        onLimparFiltros={handleLimparFiltros}
        filtroUrgencia={filtroUrgencia}
        onFiltroUrgenciaChange={setFiltroUrgencia}
        ordenacao={ordenacao}
        onOrdenacaoChange={setOrdenacao}
        contadores={contadores}
        labelNaoDistribuidos="Aguardando"
        opcoesDataCampo={[
          { value: "data", label: "📅 Data de Produção Programada" },
          { value: "data_entrega", label: "🚚 Data de Entrega Prometida (SLA)" },
          { value: "data_prevista", label: "🏭 Data Prevista" },
          { value: "created_date", label: "📥 Data de Cadastro / Entrada" },
        ]}
      />

      {/* Navegação de semana */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-bold text-lg">Semana de {format(weekStart, "dd 'de' MMM", { locale: ptBR })} a {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}</p>
            <Badge className="bg-primary/10 text-primary border border-primary/20">
              Total da semana: {totalSemana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
            </Badge>
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Dias da semana como abas */}
        <div className="grid grid-cols-7 gap-1">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const pedidosDoDia = pedidosSemana.filter(p => p.data === diaStr);
            const totalDia = pedidosDoDia.reduce((s, p) => s + calcularMetrosPedido(p), 0);
            const isSelected = selectedDay === diaStr;
            const isHoje = isToday(dia);
            const statusMeta = calcularStatusMeta(totalDia, metaGeral.min, metaGeral.max);
            const estourou = totalDia > 0 && statusMeta.status === "limite_estourado";
            const bateuMeta = totalDia > 0 && statusMeta.status === "meta_atingida";

            return (
              <button
                key={diaStr}
                onClick={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                className={`rounded-lg p-2 text-center transition-all border relative flex flex-col justify-between min-h-[72px] ${
                  isSelected
                    ? (estourou ? "bg-red-600 text-white border-red-700 shadow" : "bg-primary text-primary-foreground border-primary shadow")
                    : estourou
                    ? "border-red-500 bg-red-500/10 text-red-900 dark:text-red-200 hover:bg-red-500/15"
                    : bateuMeta
                    ? "border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : isHoje
                    ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-xs font-semibold uppercase">{format(dia, "EEE", { locale: ptBR })}</p>
                    {estourou && (
                      <span className={`text-[10px] ${isSelected ? "text-white" : "text-red-600 dark:text-red-400"}`} title="Capacidade máxima esgotada">
                        ⚠️
                      </span>
                    )}
                    {bateuMeta && !estourou && (
                      <span className={`text-[10px] ${isSelected ? "text-white" : "text-emerald-600 dark:text-emerald-400"}`} title="Meta atingida">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className={`text-lg font-bold leading-tight ${
                    isSelected ? "text-inherit" : estourou ? "text-red-700 dark:text-red-300" : isHoje ? "text-primary" : ""
                  }`}>
                    {format(dia, "dd")}
                  </p>
                </div>

                {pedidosDoDia.length > 0 ? (
                  <div className="w-full mt-1">
                    <div className={`text-[11px] leading-tight font-medium ${
                      isSelected ? "text-inherit opacity-90" : estourou ? "text-red-600 dark:text-red-400 font-bold" : bateuMeta ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground"
                    }`}>
                      {pedidosDoDia.length}p · {totalDia.toFixed(0)}m
                    </div>
                    {/* Barra sutil de capacidade no dia */}
                    <div className={`w-full ${isSelected ? "bg-white/25" : "bg-muted"} rounded-full h-1 mt-1 overflow-hidden`}>
                      <div
                        className={`h-full transition-all ${
                          estourou
                            ? (isSelected ? "bg-white" : "bg-red-500")
                            : bateuMeta
                            ? (isSelected ? "bg-white" : "bg-emerald-500")
                            : (isSelected ? "bg-white/70" : "bg-amber-400")
                        }`}
                        style={{ width: `${Math.min(100, (totalDia / (metaGeral.max || 3500)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground/60 mt-1">Livre</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle visão semana / dia / kanban */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={viewMode === "semana" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("semana")}
        >
          Visão Semana
        </Button>
        <Button
          variant={viewMode === "dia" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("dia")}
        >
          Visão Dia — {format(new Date(selectedDay + "T12:00:00"), "dd/MM", { locale: ptBR })}
        </Button>
        <Button
          variant={viewMode === "kanban" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("kanban")}
          className={`gap-1 ${viewMode === "kanban" ? "bg-indigo-600 hover:bg-indigo-700 text-white font-bold border-0" : ""}`}
        >
          <Layers className="w-3.5 h-3.5" />
          Visão Kanban
        </Button>
        <Link to="/estoque-dashboard">
          <Button variant="outline" size="sm" className="gap-1 text-teal-600 dark:text-teal-400 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40">
            <Layers className="w-3.5 h-3.5 text-teal-500" />
            Estoque por Espessura
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setSelectedDay(format(new Date(), "yyyy-MM-dd")); setCurrentWeek(new Date()); setViewMode("dia"); }}
          className="gap-1"
        >
          <Calendar className="w-3 h-3" />
          Hoje
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          itens={pedidosDia}
          tipoSetor="telhas"
          onStatusChange={handleStatusChangeKanban}
          onOpenDetails={(pedido) => {
            setEditItem(pedido);
            setDialogOpen(true);
          }}
        />
      ) : viewMode === "semana" ? (
        // Visão Semana — resumo por dia
        <div className="space-y-3">
          {temFiltroAtivo && (
            <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-medium">
                <Search className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Pesquisa Global Ativa:</strong> {pedidosFiltradosGlobal.length} pedido(s) encontrado(s) na fábrica ({pedidosSemana.length} nesta semana visível)
                  {termoBusca.trim() && <span> para "{termoBusca}"</span>}.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewMode("dia")} className="h-6 text-xs text-blue-700 dark:text-blue-300">
                  Ver Todos por Máquina
                </Button>
                <Button size="sm" variant="ghost" onClick={handleLimparFiltros} className="h-6 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                  <X className="w-3.5 h-3.5 mr-1" /> Limpar Filtros
                </Button>
              </div>
            </div>
          )}
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const pedidosDoDia = pedidosSemana.filter(p => p.data === diaStr);
            return (
              <DiaResumoCard
                key={diaStr}
                dia={dia}
                pedidos={pedidosDoDia}
                maquinaCores={MAQUINA_CORES}
                onVerDia={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                onNovoPedido={() => openNew(diaStr)}
              />
            );
          })}
        </div>
      ) : (
        // Visão Dia — por máquina
        <div className="space-y-4">
          {temFiltroAtivo && (
            <div className="bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-medium">
                <Search className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Pesquisa Global Ativa:</strong> Mostrando {pedidosDia.length} pedido(s) encontrado(s) em <strong>todas as datas e máquinas</strong> da fábrica
                  {termoBusca.trim() && <span> para "{termoBusca}"</span>}.
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={handleLimparFiltros} className="h-6 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50">
                <X className="w-3.5 h-3.5 mr-1" /> Voltar ao Dia Normal ({format(new Date(selectedDay + "T12:00:00"), "dd/MM")})
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {temFiltroAtivo ? (
                <span className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Search className="w-5 h-5 text-blue-600" />
                  Resultados da Pesquisa Global ({pedidosDia.length})
                </span>
              ) : (
                format(new Date(selectedDay + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })
              )}
            </h2>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border border-primary/20">
                {pedidosDia.length} pedidos · {pedidosDia.reduce((s, p) => s + calcularMetrosPedido(p), 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
              </Badge>
              {!temFiltroAtivo && (
                <Button size="sm" onClick={() => openNew(selectedDay)} className="gap-1">
                  <Plus className="w-3 h-3" />
                  Pedido
                </Button>
              )}
            </div>
          </div>

          {/* Card de Capacidade e Metas do Dia */}
          {(() => {
            const totalMetrosDia = pedidosDia.reduce((s, p) => s + calcularMetrosPedido(p), 0);
            const statusDia = calcularStatusMeta(totalMetrosDia, metaGeral.min, metaGeral.max);
            const estourou = totalMetrosDia > 0 && statusDia.status === "limite_estourado";

            return (
              <div className="bg-card border border-border rounded-xl p-3.5 space-y-2.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Target className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Capacidade do Dia:</span>
                    <span className="text-sm font-bold">
                      {totalMetrosDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / Meta Mín: <strong>{metaGeral.min.toLocaleString("pt-BR")}m</strong> · Teto/Trava: <strong>{metaGeral.max.toLocaleString("pt-BR")}m</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={statusDia.badgeVariant} className={`text-[11px] font-semibold ${statusDia.bgClass}`}>
                      {statusDia.label}
                    </Badge>
                    {metaGeral.travarMaximo && (
                      <Badge variant="outline" className="text-[10px] gap-1 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                        <ShieldAlert className="w-3 h-3 text-red-500" />
                        Trava Ativa
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMetasDialogOpen(true)}
                      className="h-6 px-2 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                    >
                      Ajustar Metas
                    </Button>
                  </div>
                </div>

                {/* Barra de progresso de capacidade */}
                <div className="space-y-1">
                  <div className="relative w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${statusDia.barClass}`}
                      style={{ width: `${Math.min(100, (totalMetrosDia / (metaGeral.max || 3500)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0m</span>
                    <span>Meta Mín: {metaGeral.min.toLocaleString("pt-BR")}m</span>
                    <span>Teto Máx: {metaGeral.max.toLocaleString("pt-BR")}m</span>
                  </div>
                </div>

                {estourou && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2 rounded-lg border border-red-200 dark:border-red-900/50">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      Capacidade diária esgotada! Excesso de <strong>+{statusDia.excesso.toLocaleString("pt-BR")}m</strong> além do limite ({metaGeral.max.toLocaleString("pt-BR")}m).
                      {metaGeral.travarMaximo ? " Novos agendamentos para este dia estão bloqueados." : " Trava desativada nas configurações."}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {MAQUINAS.map(maquina => {
            const pedidosMaquina = pedidosDia.filter(p => p.maquina === maquina);
            const totalMaq = pedidosMaquina.reduce((s, p) => s + calcularMetrosPedido(p), 0);
            return (
              <div key={maquina} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-3">
                    <Badge className={`border ${MAQUINA_CORES[maquina]}`}>{maquina}</Badge>
                    <span className="text-sm text-muted-foreground">{pedidosMaquina.length} pedido(s)</span>
                    {totalMaq > 0 && <span className="text-sm font-bold text-primary">{totalMaq.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openNew(selectedDay, maquina)} className="h-7 gap-1 text-xs">
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </Button>
                </div>
                {pedidosMaquina.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground italic">Sem pedidos para esta máquina</div>
                ) : (
                  <div className="divide-y divide-border">
                    {pedidosMaquina.map(p => (
                      <PedidoCard key={p.id} pedido={p} maquinaCores={MAQUINA_CORES} onEdit={openEdit} onDelete={confirmarDelete} onStatusChange={(p, status) => updateMutation.mutate({ id: p.id, data: { ...p, status } })} onPrintOP={abrirOP} onTogglePrioridade={togglePrioridade} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>)}

      <PedidoFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
        defaultDate={selectedDay}
      />

      <MetasProducaoDialog
        open={metasDialogOpen}
        onClose={() => setMetasDialogOpen(false)}
      />

      <OPImpressao open={opOpen} onClose={() => setOpOpen(false)} pedido={opPedido} />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Excluir Pedido
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja excluir este pedido? Esta ação é irreversível.</p>
              {deleteConfirm && (
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-foreground space-y-0.5">
                  {deleteConfirm.produto && <p><strong>Produto:</strong> {deleteConfirm.produto}</p>}
                  {deleteConfirm.cliente && <p><strong>Cliente:</strong> {deleteConfirm.cliente}</p>}
                  {deleteConfirm.data && <p><strong>Data:</strong> {deleteConfirm.data}</p>}
                  {deleteConfirm.metros && <p><strong>Metros:</strong> {deleteConfirm.metros}m</p>}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { deleteMutation.mutate(deleteConfirm.id); setDeleteConfirm(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}