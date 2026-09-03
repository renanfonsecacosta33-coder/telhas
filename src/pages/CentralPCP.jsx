import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Inbox, Radio, Search, ArrowLeft, RefreshCw, Zap,
  Factory, Scissors, Wind, Layers, AlertTriangle, CheckCircle2, Star
} from "lucide-react";
import PedidoOdooCard from "@/components/pcp/PedidoOdooCard";
import PedidoOdooDetalheDialog from "@/components/pcp/PedidoOdooDetalheDialog";
import WebhookSimulatorDialog from "@/components/pcp/WebhookSimulatorDialog";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";
import CapacidadeDiariaIA from "@/components/pcp/CapacidadeDiariaIA";
import { calcularDataPrometidaSLA, toISODate, slaDiasPorCategoria, diasUteisRestantes } from "@/lib/sla";
import { parseItensPedido } from "@/lib/regrasFabrica";
import { notificarStatus } from "@/lib/biNotificador";
import { calcularProgressoRealPedido, statusPcpPorPercentual } from "@/lib/pedidoOdooHelper";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "pendente_distribuicao", label: "Pendentes", icon: AlertTriangle, color: "text-amber-500" },
  { id: "distribuido", label: "Distribuídos", icon: CheckCircle2, color: "text-blue-500" },
  { id: "em_producao", label: "Em Produção", icon: Factory, color: "text-indigo-500" },
  { id: "concluido", label: "Concluídos", icon: CheckCircle2, color: "text-emerald-500" }
];

export default function CentralPCP() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [distribuindo, setDistribuindo] = useState(false);
  const [senhaGestorOpen, setSenhaGestorOpen] = useState(false);
  const [pedidoPrioridadePendente, setPedidoPrioridadePendente] = useState(null);

  const { data: pedidos = [], isLoading: carregando, refetch } = useQuery({
    queryKey: ["pedidos-odoo-pcp"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 200),
    refetchInterval: 10000
  });

  const { data: pedidosProducao = [] } = useQuery({
    queryKey: ["pedidos-producao-todos"],
    queryFn: () => base44.entities.Pedido.list("-data", 500),
    refetchInterval: 10000
  });

  const { data: ordensCD = [] } = useQuery({
    queryKey: ["ordens-cd-todos"],
    queryFn: () => base44.entities.OrdemMaquinaCD.list("-data", 500),
    refetchInterval: 10000
  });

  // Subscription: atualiza percentual/status em tempo real quando os galpões concluem itens
  useEffect(() => {
    const unsubscribe = base44.entities.PedidoOdoo.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Sincronização 100% Automática em Tempo Real com o Odoo ERP:
  // Detecta alterações no progresso real das máquinas e sincroniza tanto o banco quanto o Odoo
  const syncEmAndamentoRef = useRef(new Set());

  useEffect(() => {
    if (!pedidos.length) return;

    pedidos.forEach(async (p) => {
      if (!p.id || !p.numero_pedido) return;
      const progressoReal = calcularProgressoRealPedido(p, pedidosProducao, ordensCD);
      const statusReal = statusPcpPorPercentual(progressoReal, p.status_pcp);

      // Sincroniza automaticamente se o percentual ou status diferir do gravado
      const syncKey = `${p.id}_${progressoReal}_${statusReal}`;
      if (
        (progressoReal !== p.percentual_concluido || (p.status_pcp !== "concluido" && statusReal === "concluido")) &&
        !syncEmAndamentoRef.current.has(syncKey)
      ) {
        syncEmAndamentoRef.current.add(syncKey);
        try {
          const atualizado = await base44.entities.PedidoOdoo.update(p.id, {
            percentual_concluido: progressoReal,
            status_pcp: statusReal
          });
          // Notifica Mini BI do Odoo automaticamente em tempo real
          await notificarStatus(atualizado, "progresso_automatico", {
            percentual_concluido: progressoReal,
            status_novo: statusReal,
            item_nome: `Pedido #${p.numero_pedido}`
          });
        } catch (err) {
          console.error("[CentralPCP AutoSync] falha na sincronizacao automatica:", p.numero_pedido, err);
          syncEmAndamentoRef.current.delete(syncKey);
        }
      }
    });
  }, [pedidos, pedidosProducao, ordensCD]);

  const handleReceberWebhook = async (pedidosParsed) => {
    const novos = pedidosParsed.map((p) => {
      const sla = slaDiasPorCategoria(p);
      const dataPrometida = calcularDataPrometidaSLA(p.data_recebimento, sla);
      const log = [{
        data: new Date().toISOString(),
        usuario: "Webhook Odoo",
        acao: "recebimento",
        detalhes: `Pedido recebido via webhook. SLA ${sla}d úteis.`
      }];
      if (p.itens_frisada_count > 0) {
        log.push({
          data: new Date().toISOString(),
          usuario: "Sistema PCP",
          acao: "direcionamento_frisada",
          detalhes: `${p.itens_frisada_count} item(ns) frisada(s) direcionado(s) à Fila da Frisada na Expedição.`
        });
      }
      return {
        odoo_id: p.odoo_id,
        numero_pedido: p.numero_pedido,
        cliente_nome: p.cliente_nome,
        vendedor_nome: p.vendedor_nome,
        foto_pedido_url: p.foto_pedido_url || null,
        data_recebimento: p.data_recebimento,
        data_entrega: toISODate(dataPrometida),
        unidade: p.unidade,
        status_pcp: "pendente_distribuicao",
        percentual_concluido: 0,
        total_itens: p.total_itens,
        itens_telha_count: p.itens_telha_count,
        itens_cd_count: p.itens_cd_count,
        itens_frisada_count: p.itens_frisada_count,
        espessuras_tags: JSON.stringify(p.espessuras_tags),
        itens_json: p.itens_json,
        historico_log: JSON.stringify(log)
      };
    });

    try {
      await base44.entities.PedidoOdoo.bulkCreate(novos);
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      toast({
        title: `${novos.length} pedido(s) recebido(s)`,
        description: "Pedidos Odoo adicionados à fila PCP em ordem de chegada.",
        className: "border-emerald-500/40"
      });
    } catch (e) {
      toast({ title: "Erro ao receber pedidos", description: e.message, variant: "destructive" });
    }
  };

  const isPedidoTeste = (pedido) => {
    const num = String(pedido?.numero_pedido || "").toUpperCase();
    return num.includes("TESTE") || num.includes("SO-TESTE") || pedido?.numero_pedido === "283427" || !pedido?.odoo_id;
  };

  const handleExcluirCard = async (pedido) => {
    const teste = isPedidoTeste(pedido);
    const msg = teste
      ? `🧪 EXCLUSÃO DE PEDIDO DE TESTE\n\nExcluir o pedido de teste #${pedido.numero_pedido} diretamente do App?\n\nPedidos de teste/simulação são removidos imediatamente, sem chamar o Odoo.`
      : `🗑️ EXCLUSÃO GLOBAL DE OS\n\nExcluir a OS #${pedido.numero_pedido} de TODAS as telas (Central PCP, Galpão Telhas, Galpão Corte & Dobra e Expedição)?\n\nO App enviará o cancelamento ao Odoo primeiro. Somente se o Odoo confirmar (200 OK) a OS será removida globalmente.`;
    if (!window.confirm(msg)) return;
    await handleExcluirOS(pedido, "");
  };

  const handleDevolverPCP = async (pedido) => {
    try {
      const me = await base44.auth.me().catch(() => null);
      const usuario = me?.email || "Gestor";
      const todayIso = new Date().toISOString().slice(0, 10);
      // Cancela as Ordens de Produção vinculadas nos galpões
      await base44.entities.OrdemMaquinaCD.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      );
      await base44.entities.OrdemDesbobinadeira.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      );
      await base44.entities.Pedido.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      );
      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario,
        acao: "Devolvido ao PCP",
        detalhes: "Retirado da fila do galpão pelo gestor"
      }];
      const updateData = {
        status_pcp: "pendente_distribuicao",
        historico_log: JSON.stringify(novoLog)
      };
      if (pedido.galpao_responsavel !== undefined) updateData.galpao_responsavel = "";
      await base44.entities.PedidoOdoo.update(pedido.id, updateData);
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      // Mini BI — evento devolvido_pcp
      await notificarStatus({ ...pedido, ...updateData }, "devolvido_pcp", { status_novo: "pendente_distribuicao", operador: usuario });
      setDetalheOpen(false);
      setPedidoSelecionado(null);
      toast({
        title: "↩️ Pedido devolvido ao PCP!",
        description: `#${pedido.numero_pedido} voltou para a Central PCP.`,
        className: "border-amber-500/40"
      });
    } catch (e) {
      toast({ title: "Erro ao devolver ao PCP", description: e.message, variant: "destructive" });
    }
  };

  const handleRetirarFila = async (pedido) => {
    if (!window.confirm(
      `↩️ RETIRAR DA FILA\n\nRetirar a OS #${pedido.numero_pedido} da fila dos galpões (Telhas / Corte & Dobra) e devolvê-la para a Central PCP?`
    )) return;
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      // Cancela as Ordens de Produção vinculadas nos galpões
      await base44.entities.OrdemMaquinaCD.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      );
      await base44.entities.OrdemDesbobinadeira.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      );
      await base44.entities.Pedido.updateMany(
        { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
        { $set: { status: "cancelado", data_finalizacao: todayIso } }
      );
      // Devolve o pedido para a Central PCP
      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: "retirada_fila_galpao",
        detalhes: "Pedido retirado da fila dos galpões e devolvido para a Central PCP."
      }];
      await base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "pendente_distribuicao",
        percentual_concluido: 0,
        historico_log: JSON.stringify(novoLog)
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setDetalheOpen(false);
      setPedidoSelecionado(null);
      toast({
        title: "↩️ OS retirada da fila",
        description: `#${pedido.numero_pedido} devolvida para a Central PCP.`,
        className: "border-amber-500/40"
      });
    } catch (e) {
      toast({ title: "Erro ao retirar da fila", description: e.message, variant: "destructive" });
    }
  };

  const handleExcluirOS = async (pedido, motivo) => {
    try {
      const res = await base44.functions.invoke("cancelarOrdemServicoOdoo", {
        numero_pedido: pedido.numero_pedido,
        odoo_id: pedido.odoo_id,
        motivo,
      });
      // Trava atômica: Odoo não confirmou (status ≠ 200/201) → nada foi excluído no App.
      if (res?.status && res.status !== "ok") {
        toast({
          title: "❌ FALHA NO CANCELAMENTO ODOO",
          description: "O Odoo não confirmou o cancelamento da ordem de fabricação. A OS foi mantida na fábrica!",
          variant: "destructive",
          duration: 9000,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setDetalheOpen(false);
      setPedidoSelecionado(null);
      toast({
        title: res?.message || "Ordem de Serviço cancelada no Odoo e removida do App!",
        description: `Odoo ID ${res?.odoo_id || pedido.odoo_id}.`,
        className: "border-emerald-500/40"
      });
    } catch (e) {
      // Erro de rede/execução → nada foi excluído no App.
      toast({
        title: "❌ FALHA NO CANCELAMENTO ODOO",
        description: "O Odoo não confirmou o cancelamento da ordem de fabricação. A OS foi mantida na fábrica!",
        variant: "destructive",
        duration: 9000,
      });
    }
  };

  const handleToggleItem = async (pedido, idx) => {
    try {
      const itens = parseItensPedido(pedido.itens_json);
      if (!itens[idx]) return;
      itens[idx] = { ...itens[idx], concluido: !itens[idx].concluido };
      const concluidos = itens.filter((i) => i.concluido).length;
      const percentual = itens.length > 0 ? Math.round((concluidos / itens.length) * 100) : 0;
      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: JSON.stringify(itens),
        percentual_concluido: percentual,
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setPedidoSelecionado((prev) => prev ? { ...prev, ...atualizado } : prev);
    } catch (e) {
      toast({ title: "Erro ao atualizar item", description: e.message, variant: "destructive" });
    }
  };

  const handleTogglePrioridade = (pedido) => {
    // Regra 1: ativar prioridade exige PIN do gestor; desativar é livre.
    if (!pedido.prioridade) {
      setPedidoPrioridadePendente(pedido);
      setSenhaGestorOpen(true);
    } else {
      confirmarPrioridade(pedido, false);
    }
  };

  const confirmarPrioridade = async (pedido, novoValor) => {
    try {
      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: novoValor ? "prioridade_ativada" : "prioridade_removida",
        detalhes: novoValor ? "Pedido marcado como Prioridade Alta / Urgente (autorizado via PIN do gestor)." : "Prioridade removida."
      }];
      await base44.entities.PedidoOdoo.update(pedido.id, {
        prioridade: novoValor,
        historico_log: JSON.stringify(novoLog)
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      toast({
        title: novoValor ? "Prioridade ativada" : "Prioridade removida",
        description: `#${pedido.numero_pedido} ${novoValor ? "marcado como URGENTE" : "voltou para fila normal"}.`,
        className: novoValor ? "border-amber-500/40" : "border-slate-400/40"
      });
    } catch (e) {
      toast({ title: "Erro ao alterar prioridade", description: e.message, variant: "destructive" });
    }
  };

  const handleDistribuir = async (pedido) => {
    setDistribuindo(true);
    try {
      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: "distribuicao_automatica",
        detalhes: "Pedido distribuído automaticamente para os galpões (Telhas→Barracão Telhas, C&D→Barracão C&D, Frisada→Expedição)."
      }];
      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "distribuido",
        percentual_concluido: 15,
        historico_log: JSON.stringify(novoLog)
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setPedidoSelecionado({ ...pedido, ...atualizado });
      // Mini BI — evento distribuido
      await notificarStatus(atualizado, "distribuido", { status_novo: "distribuido", percentual_concluido: 15 });
      toast({
        title: "Pedido distribuído!",
        description: `#${pedido.numero_pedido} enviado para os galpões.`,
        className: "border-blue-500/40"
      });
    } catch (e) {
      toast({ title: "Erro ao distribuir", description: e.message, variant: "destructive" });
    } finally {
      setDistribuindo(false);
    }
  };

  // Filtros + busca
  const pedidosFiltrados = pedidos.filter(p => {
    if (filtro !== "todos" && p.status_pcp !== filtro) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      String(p.numero_pedido || "").toLowerCase().includes(q) ||
      String(p.cliente_nome || "").toLowerCase().includes(q) ||
      String(p.vendedor_nome || "").toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    // FIFO por data_recebimento (mais antigo primeiro)
    const da = new Date(a.data_recebimento || 0).getTime();
    const db = new Date(b.data_recebimento || 0).getTime();
    return da - db;
  });

  const stats = {
    total: pedidos.length,
    pendentes: pedidos.filter(p => p.status_pcp === "pendente_distribuicao").length,
    distribuidos: pedidos.filter(p => p.status_pcp === "distribuido").length,
    atrasados: pedidos.filter(p => diasUteisRestantes(p.data_entrega) < 0 && p.status_pcp !== "concluido").length
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/setor")} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                <Inbox className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                Central PCP
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 hidden sm:block">
                Aba Mãe · Integração Odoo ERP · Fila FIFO de pedidos industriais
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={carregando}>
              <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={() => setWebhookOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
            >
              <Radio className="w-4 h-4" />
              <span className="hidden sm:inline">Receber / Simular Webhook Odoo</span>
              <span className="sm:hidden">Webhook</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total na Fila" value={stats.total} icon={<Layers className="w-4 h-4" />} color="text-slate-600" />
        <StatCard label="Pendentes" value={stats.pendentes} icon={<AlertTriangle className="w-4 h-4" />} color="text-amber-500" />
        <StatCard label="Distribuídos" value={stats.distribuidos} icon={<CheckCircle2 className="w-4 h-4" />} color="text-blue-500" />
        <StatCard label="Atrasados" value={stats.atrasados} icon={<AlertTriangle className="w-4 h-4" />} color="text-red-500" />
      </div>

      {/* Busca + Filtros */}
      <div className="px-4 sm:px-6 pb-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nº pedido, cliente ou vendedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filtro === f.id
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {f.icon && <f.icon className={`w-3.5 h-3.5 ${filtro !== f.id ? f.color : ""}`} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fila de Pedidos */}
      <div className="px-4 sm:px-6 pb-12">
        {carregando ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Nenhum pedido na fila</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Clique em "Receber / Simular Webhook Odoo" para importar pedidos do ERP.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-500 dark:text-slate-400">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <span className="font-semibold">Fila FIFO</span> — {pedidosFiltrados.length} pedido(s) em ordem de chegada
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pedidosFiltrados.map(p => (
                <PedidoOdooCard
                  key={p.id}
                  pedido={p}
                  progressoReal={calcularProgressoRealPedido(p, pedidosProducao, ordensCD)}
                  pedidosProducao={pedidosProducao}
                  ordensCD={ordensCD}
                  onClick={() => { setPedidoSelecionado(p); setDetalheOpen(true); }}
                  onDelete={handleExcluirCard}
                  onRetirarFila={handleRetirarFila}
                  onTogglePrioridade={handleTogglePrioridade}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <PedidoOdooDetalheDialog
        pedido={pedidoSelecionado}
        progressoReal={pedidoSelecionado ? calcularProgressoRealPedido(pedidoSelecionado, pedidosProducao, ordensCD) : null}
        open={detalheOpen}
        onOpenChange={setDetalheOpen}
        onDistribuir={handleDistribuir}
        distribuindo={distribuindo}
        onExcluirOS={handleExcluirOS}
        onRetirarFila={handleRetirarFila}
        onDevolverPCP={handleDevolverPCP}
        onTogglePrioridade={handleTogglePrioridade}
        onToggleItem={handleToggleItem}
      />
      <SenhaGestorDialog
        open={senhaGestorOpen}
        onOpenChange={setSenhaGestorOpen}
        titulo="Autorizar Prioridade Alta"
        descricao="Para marcar este pedido como Prioridade Alta / Urgente, digite o PIN de liberação do PCP/Gestor."
        onAutorizado={() => {
          if (pedidoPrioridadePendente) {
            confirmarPrioridade(pedidoPrioridadePendente, true);
            setPedidoPrioridadePendente(null);
          }
        }}
      />
      <WebhookSimulatorDialog
        open={webhookOpen}
        onOpenChange={setWebhookOpen}
        onReceber={handleReceberWebhook}
      />
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}