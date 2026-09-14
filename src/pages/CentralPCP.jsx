import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Inbox, Radio, Search, ArrowLeft, RefreshCw, Zap, Send,
  Factory, Scissors, Wind, Layers, AlertTriangle, CheckCircle2, Star,
  ChevronDown, ChevronUp, Calendar, Filter, X, Clock, Trash2, CheckSquare, Square
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PedidoOdooCard from "@/components/pcp/PedidoOdooCard";
import PedidoOdooGrupoCard from "@/components/pcp/PedidoOdooGrupoCard";
import PedidoOdooDetalheDialog from "@/components/pcp/PedidoOdooDetalheDialog";
import WebhookSimulatorDialog from "@/components/pcp/WebhookSimulatorDialog";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";
import CapacidadeDiariaIA from "@/components/pcp/CapacidadeDiariaIA";
import { calcularDataPrometidaSLA, toISODate, slaDiasPorCategoria, diasUteisRestantes, formatDataBR } from "@/lib/sla";
import { parseItensPedido } from "@/lib/regrasFabrica";
import { notificarStatus } from "@/lib/biNotificador";
import { calcularProgressoRealPedido, statusPcpPorPercentual, enriquecerItensComStatusReal } from "@/lib/pedidoOdooHelper";
import { getPesoOrdenacaoPrioridade } from "@/lib/prioridadeHelper";
import { verificarEstoquePedido } from "@/lib/estoqueMaterialHelper";

export default function CentralPCP() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ativos");
  const [filtroMaterial, setFiltroMaterial] = useState("todos"); // "todos" | "com_material" | "sem_material"
  const [mostrarConcluidosEmTodos, setMostrarConcluidosEmTodos] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [distribuindo, setDistribuindo] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [senhaGestorOpen, setSenhaGestorOpen] = useState(false);
  const [pedidoPrioridadePendente, setPedidoPrioridadePendente] = useState(null);
  const [pedidosExpandidos, setPedidosExpandidos] = useState(() => new Set());
  const [modoVisao, setModoVisao] = useState("agrupado");

  // Filtros de Data
  const [filtroDataPreset, setFiltroDataPreset] = useState("todas"); // "todas" | "hoje" | "amanha" | "semana" | "atrasados" | "personalizada"
  const [filtroDataCampo, setFiltroDataCampo] = useState("data_entrega"); // "data_entrega" | "data_recebimento"
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  // Modal de Exclusão Segura
  const [modalExclusao, setModalExclusao] = useState({
    aberto: false,
    pedidos: [],
    titulo: "",
    descricao: "",
    notificarOdoo: true
  });
  const [excluindo, setExcluindo] = useState(false);

  const formatToLocalDateInput = (date) => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const extrairDataISO = (val) => {
    if (!val) return "";
    if (typeof val === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
        return val.slice(0, 10);
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return formatToLocalDateInput(d);
      }
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
      return formatToLocalDateInput(val);
    }
    return "";
  };

  const filtroDataAtivo = filtroDataPreset !== "todas" || Boolean(filtroDataInicio) || Boolean(filtroDataFim);

  const limparFiltroData = () => {
    setFiltroDataPreset("todas");
    setFiltroDataInicio("");
    setFiltroDataFim("");
  };

  const handleSelectPreset = (presetId) => {
    setFiltroDataPreset(presetId);
    const hojeStr = formatToLocalDateInput(new Date());

    if (presetId === "todas") {
      setFiltroDataInicio("");
      setFiltroDataFim("");
    } else if (presetId === "hoje") {
      setFiltroDataInicio(hojeStr);
      setFiltroDataFim(hojeStr);
    } else if (presetId === "amanha") {
      const am = new Date();
      am.setDate(am.getDate() + 1);
      const amStr = formatToLocalDateInput(am);
      setFiltroDataInicio(amStr);
      setFiltroDataFim(amStr);
    } else if (presetId === "semana") {
      const em7 = new Date();
      em7.setDate(em7.getDate() + 7);
      setFiltroDataInicio(hojeStr);
      setFiltroDataFim(formatToLocalDateInput(em7));
    } else if (presetId === "atrasados") {
      setFiltroDataInicio("");
      setFiltroDataFim(hojeStr);
    }
  };

  const { data: pedidosRaw = [], isLoading: carregando, refetch } = useQuery({
    queryKey: ["pedidos-odoo-pcp"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 200),
    refetchInterval: 10000
  });

  // Deduplicação estrita de OFs: garante exibição de cada OF apenas uma vez
  const pedidos = useMemo(() => {
    const vistos = new Set();
    const lista = [];
    for (const p of pedidosRaw) {
      if (!p) continue;
      const chave = p.numero_pedido && (p.of_nome || p.of_odoo_id)
        ? `${p.numero_pedido}___${p.of_nome || p.of_odoo_id}`
        : (p.of_nome || p.of_odoo_id || p.id);
      if (!vistos.has(chave)) {
        vistos.add(chave);
        lista.push(p);
      }
    }
    return lista;
  }, [pedidosRaw]);

  // Auto-limpeza silenciosa em segundo plano: remove registros clones redundantes no banco
  const limpezaExecutadaRef = useRef(false);
  useEffect(() => {
    if (!pedidosRaw.length || limpezaExecutadaRef.current) return;

    const vistos = new Map();
    const duplicadosParaRemover = [];

    pedidosRaw.forEach(p => {
      if (!p.id || !p.numero_pedido) return;
      const ofIdent = p.of_nome || p.of_odoo_id;
      if (!ofIdent) return;
      const chave = `${p.numero_pedido}___${ofIdent}`;
      if (vistos.has(chave)) {
        duplicadosParaRemover.push(p.id);
      } else {
        vistos.set(chave, p.id);
      }
    });

    if (duplicadosParaRemover.length > 0) {
      limpezaExecutadaRef.current = true;
      console.log(`[CentralPCP] Limpando ${duplicadosParaRemover.length} registros duplicados de PedidoOdoo...`);
      Promise.allSettled(
        duplicadosParaRemover.map(id => base44.entities.PedidoOdoo.delete(id))
      ).then(() => {
        queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      });
    }
  }, [pedidosRaw, queryClient]);

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

  // Consultas de Matéria-Prima em Tempo Real para Análise de Disponibilidade no PCP
  const { data: bobinasEstoque = [] } = useQuery({
    queryKey: ["bobinas-estoque-pcp"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false }),
    refetchInterval: 15000
  });

  const { data: chapasEstoque = [] } = useQuery({
    queryKey: ["chapas-estoque-pcp"],
    queryFn: () => base44.entities.ChapaCD.filter({ status: { $ne: "cancelado" } }),
    refetchInterval: 15000
  });

  const estoqueContext = useMemo(() => ({
    bobinas: bobinasEstoque,
    chapas: chapasEstoque
  }), [bobinasEstoque, chapasEstoque]);

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

      // Sincroniza SOMENTE se o percentual ou status realmente mudarem
      const syncKey = `${p.id}_${progressoReal}_${statusReal}`;
      if (
        (progressoReal !== p.percentual_concluido ||
         (p.status_pcp !== "concluido" && statusReal === "concluido")) &&
        !syncEmAndamentoRef.current.has(syncKey)
      ) {
        syncEmAndamentoRef.current.add(syncKey);
        try {
          const itensEnriquecidos = enriquecerItensComStatusReal(p, pedidosProducao, ordensCD);
          const itensJsonEnriquecido = JSON.stringify(itensEnriquecidos);
          const atualizado = await base44.entities.PedidoOdoo.update(p.id, {
            percentual_concluido: progressoReal,
            status_pcp: statusReal,
            itens_json: itensJsonEnriquecido
          });
          // Notifica Mini BI do Odoo automaticamente em tempo real com itens descritivos
          await notificarStatus(atualizado, "progresso_automatico", {
            percentual_concluido: progressoReal,
            status_novo: statusReal,
            item_nome: `Pedido #${p.numero_pedido}`
          });
        } catch (err) {
          console.error("[CentralPCP AutoSync] falha na sincronizacao automatica:", p.numero_pedido, err);
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
        of_odoo_id: p.of_odoo_id || p.odoo_id || null,
        of_nome: p.of_nome || null,
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
      const itensAtuais = parseItensPedido(pedido.itens_json);
      const itensZerados = itensAtuais.map(i => ({
        ...i,
        status: "pendente",
        status_detalhado: "Pendente de Distribuição",
        concluido: false,
        maquina: ""
      }));
      const updateData = {
        status_pcp: "pendente_distribuicao",
        percentual_concluido: 0,
        maquinas_json: "[]",
        etapas_telha_json: "[]",
        itens_json: JSON.stringify(itensZerados),
        historico_log: JSON.stringify(novoLog)
      };
      if (pedido.galpao_responsavel !== undefined) updateData.galpao_responsavel = "";
      await base44.entities.PedidoOdoo.update(pedido.id, updateData);
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
      // Mini BI — evento devolvido_pcp
      await notificarStatus({ ...pedido, ...updateData }, "devolvido_pcp", { status_novo: "pendente_distribuicao", percentual_concluido: 0, operador: usuario }).catch(() => {});
      setDetalheOpen(false);
      setPedidoSelecionado(null);
      toast({
        title: "↩️ Pedido devolvido ao PCP!",
        description: `#${pedido.numero_pedido} voltou para a Central PCP (0%).`,
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
      const itensAtuais = parseItensPedido(pedido.itens_json);
      const itensZerados = itensAtuais.map(i => ({
        ...i,
        status: "pendente",
        status_detalhado: "Pendente de Distribuição",
        concluido: false,
        maquina: ""
      }));
      await base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "pendente_distribuicao",
        percentual_concluido: 0,
        maquinas_json: "[]",
        etapas_telha_json: "[]",
        itens_json: JSON.stringify(itensZerados),
        historico_log: JSON.stringify(novoLog)
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
      await notificarStatus(pedido, "retirada_fila_galpao", { status_novo: "pendente_distribuicao", percentual_concluido: 0 }).catch(() => {});
      setDetalheOpen(false);
      setPedidoSelecionado(null);
      toast({
        title: "↩️ OS retirada da fila",
        description: `#${pedido.numero_pedido} devolvida para a Central PCP (0%).`,
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
      // Trava atômica: Odoo não confirmou (status ≠ 200/201) → oferece forçar limpeza no App.
      if (res?.status && res.status !== "ok") {
        const confirmarForcar = window.confirm(
          `⚠️ O ODOO RETORNOU ERRO NO CANCELAMENTO (Status: ${res?.odoo_status || 500})\n\nDeseja FORÇAR a exclusão da OS #${pedido.numero_pedido} diretamente do App de Fábricas para limpar a fila e resetar o pedido?`
        );
        if (confirmarForcar) {
          await base44.functions.invoke("cancelarOrdemServicoOdoo", {
            numero_pedido: pedido.numero_pedido,
            odoo_id: pedido.odoo_id,
            motivo,
            force: true,
          });
          queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
          queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
          setDetalheOpen(false);
          setPedidoSelecionado(null);
          toast({
            title: "🧹 OS Removida do App (Forçado)",
            description: `OS #${pedido.numero_pedido} e ordens vinculadas foram limpas do App.`,
            className: "border-amber-500/40"
          });
          return;
        }
        toast({
          title: "❌ FALHA NO CANCELAMENTO ODOO",
          description: "O Odoo não confirmou o cancelamento da ordem de fabricação. A OS foi mantida na fábrica!",
          variant: "destructive",
          duration: 9000,
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      setDetalheOpen(false);
      setPedidoSelecionado(null);
      toast({
        title: res?.message || "Ordem de Serviço cancelada no Odoo e removida do App!",
        description: `Odoo ID ${res?.odoo_id || pedido.odoo_id}.`,
        className: "border-emerald-500/40"
      });
    } catch (e) {
      // Erro de rede/execução → oferece forçar exclusão local
      const confirmarForcar = window.confirm(
        `⚠️ O ODOO NÃO RESPONDEU AO CANCELAMENTO\n\nDeseja FORÇAR a exclusão da OS #${pedido.numero_pedido} diretamente do App de Fábricas para limpar a fila e resetar o pedido?`
      );
      if (confirmarForcar) {
        try {
          await base44.functions.invoke("cancelarOrdemServicoOdoo", {
            numero_pedido: pedido.numero_pedido,
            odoo_id: pedido.odoo_id,
            motivo,
            force: true,
          });
          queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
          queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
          setDetalheOpen(false);
          setPedidoSelecionado(null);
          toast({
            title: "🧹 OS Removida do App (Forçado)",
            description: `OS #${pedido.numero_pedido} e ordens vinculadas foram limpas do App.`,
            className: "border-amber-500/40"
          });
          return;
        } catch (errForcar) {
          console.error("Falha ao forçar exclusão:", errForcar);
        }
      }
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

  const handleSetPrioridade = (pedido, nivel) => {
    const nivelNum = nivel ? Number(nivel) : null;
    // Se for P1 ou P2 (alta urgência), exige PIN do gestor caso não seja admin
    if (nivelNum === 1 || nivelNum === 2) {
      setPedidoPrioridadePendente({ pedido, nivel: nivelNum });
      setSenhaGestorOpen(true);
    } else {
      confirmarPrioridade(pedido, nivelNum);
    }
  };

  const handleTogglePrioridade = (pedido) => {
    if (!pedido.prioridade) {
      handleSetPrioridade(pedido, 1);
    } else {
      confirmarPrioridade(pedido, null);
    }
  };

  const confirmarPrioridade = async (pedido, nivelNum) => {
    try {
      const ativa = Boolean(nivelNum);
      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: ativa ? `prioridade_p${nivelNum}` : "prioridade_removida",
        detalhes: ativa ? `Pedido marcado como Prioridade P${nivelNum} (1 a 5 - sendo 1 a mais urgente).` : "Prioridade removida."
      }];
      await base44.entities.PedidoOdoo.update(pedido.id, {
        prioridade: ativa,
        prioridade_nivel: nivelNum,
        historico_log: JSON.stringify(novoLog)
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      toast({
        title: ativa ? `Prioridade P${nivelNum} Definida` : "Prioridade Removida",
        description: `#${pedido.numero_pedido} ${ativa ? `marcado com Prioridade P${nivelNum} (1 mais urgente)` : "voltou para fila normal"}.`,
        className: ativa ? "border-amber-500/40" : "border-slate-400/40"
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
      setDistribuindo(false);
      toast({
        title: "Pedido distribuído!",
        description: `#${pedido.numero_pedido} enviado para os galpões.`,
        className: "border-blue-500/40"
      });
      // Mini BI — notificação em segundo plano (não trava a interface do operador)
      notificarStatus(atualizado, "distribuido", { status_novo: "distribuido", percentual_concluido: 15 }).catch(() => {});
    } catch (e) {
      toast({ title: "Erro ao distribuir", description: e.message, variant: "destructive" });
    } finally {
      setDistribuindo(false);
    }
  };

  // Distribuição em Lote (Todos os Selecionados ou Todos os Pendentes)
  const handleDistribuirLote = async (pedidosADistribuir) => {
    if (!pedidosADistribuir || pedidosADistribuir.length === 0) return;
    setDistribuindo(true);
    try {
      let sucesso = 0;
      for (const ped of pedidosADistribuir) {
        try {
          const logExistente = (() => { try { return JSON.parse(ped.historico_log || "[]"); } catch { return []; } })();
          const novoLog = [...logExistente, {
            data: new Date().toISOString(),
            usuario: "PCP",
            acao: "distribuicao_lote",
            detalhes: "Pedido distribuído em lote para os galpões de produção (Telhas, C&D e Frisada)."
          }];
          const atualizado = await base44.entities.PedidoOdoo.update(ped.id, {
            status_pcp: "distribuido",
            percentual_concluido: 15,
            historico_log: JSON.stringify(novoLog)
          });
          // Notificação em segundo plano sem bloquear o loop
          notificarStatus(atualizado, "distribuido", { status_novo: "distribuido", percentual_concluido: 15 }).catch(() => {});
          sucesso++;
        } catch (err) {
          console.error("[PCP Distribuir Lote] falha ao distribuir pedido:", ped.numero_pedido, err);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setSelecionados(new Set());
      setDistribuindo(false);
      toast({
        title: `🚀 ${sucesso} pedidos distribuídos!`,
        description: `Todas as ordens selecionadas foram encaminhadas simultaneamente para as filas dos galpões.`,
        className: "border-emerald-500/40"
      });
    } catch (e) {
      toast({ title: "Erro na distribuição em lote", description: e.message, variant: "destructive" });
    } finally {
      setDistribuindo(false);
    }
  };

  const handleToggleSelect = (pedido) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(pedido.id)) next.delete(pedido.id);
      else next.add(pedido.id);
      return next;
    });
  };

  const handleSelectAllPendentes = (marcarTodos) => {
    if (marcarTodos) {
      const ids = pedidosFiltrados
        .filter(p => p.status_pcp === "pendente_distribuicao")
        .map(p => p.id);
      setSelecionados(new Set(ids));
    } else {
      setSelecionados(new Set());
    }
  };

  // Programação e Distribuição por Item
  const handleProgramarItem = async (pedido, idx, { maquina, data_programada, distribuir = false }) => {
    try {
      const itens = parseItensPedido(pedido.itens_json);
      if (!itens[idx]) return;

      const itemAtualizado = {
        ...itens[idx],
        maquina: maquina || itens[idx].maquina || "",
        data_programada: data_programada || itens[idx].data_programada || new Date().toISOString().slice(0, 10),
        status: distribuir ? "distribuido" : (itens[idx].status || "pendente"),
        distribuido: distribuir ? true : (itens[idx].distribuido || false)
      };
      itens[idx] = itemAtualizado;

      const algumDistribuido = itens.some(i => i.distribuido || i.status === "distribuido" || i.status === "concluido");
      const novoStatusPcp = algumDistribuido && pedido.status_pcp === "pendente_distribuicao" 
        ? "distribuido" 
        : pedido.status_pcp;

      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: distribuir ? "distribuicao_item" : "programacao_item",
        detalhes: `Item "${itemAtualizado.produto || itemAtualizado.descricao}" programado para máquina ${itemAtualizado.maquina || "Padrão"} na data ${itemAtualizado.data_programada}.${distribuir ? " (Distribuído ao galpão)" : ""}`
      }];

      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: JSON.stringify(itens),
        status_pcp: novoStatusPcp,
        historico_log: JSON.stringify(novoLog)
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setPedidoSelecionado({ ...pedido, ...atualizado });

      if (distribuir) {
        notificarStatus(atualizado, "distribuido", {
          status_novo: novoStatusPcp,
          item_nome: itemAtualizado.produto || `Item #${idx + 1}`,
          maquina_atual: itemAtualizado.maquina || ""
        }).catch(() => {});
      }

      toast({
        title: distribuir ? "Item distribuído!" : "Item programado!",
        description: `Item #${idx + 1} direcionado para ${itemAtualizado.maquina || "Galpão"} (${itemAtualizado.data_programada}).`,
        className: "border-blue-500/40"
      });
    } catch (err) {
      toast({ title: "Erro ao programar item", description: err.message, variant: "destructive" });
    }
  };

  const handleProgramarTodosItens = async (pedido, itensProgramados, distribuir = true) => {
    try {
      const algumDistribuido = itensProgramados.some(i => i.distribuido || i.status === "distribuido");
      const novoStatusPcp = (distribuir || algumDistribuido) && pedido.status_pcp === "pendente_distribuicao"
        ? "distribuido"
        : pedido.status_pcp;

      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: "programacao_itens_completa",
        detalhes: `Programação de todos os itens do pedido #${pedido.numero_pedido} salva e distribuída.`
      }];

      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: JSON.stringify(itensProgramados),
        status_pcp: novoStatusPcp,
        percentual_concluido: novoStatusPcp === "distribuido" && pedido.percentual_concluido < 15 ? 15 : pedido.percentual_concluido,
        historico_log: JSON.stringify(novoLog)
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setPedidoSelecionado({ ...pedido, ...atualizado });

      if (distribuir) {
        notificarStatus(atualizado, "distribuido", {
          status_novo: novoStatusPcp,
          percentual_concluido: 15
        }).catch(() => {});
      }

      toast({
        title: "Itens programados com sucesso!",
        description: `Todos os itens do pedido #${pedido.numero_pedido} foram programados e enviados aos galpões.`,
        className: "border-emerald-500/40"
      });
    } catch (err) {
      toast({ title: "Erro ao programar itens", description: err.message, variant: "destructive" });
    }
  };

  // Identifica se um pedido está 100% concluído
  const isPedidoConcluido = (p) => {
    if (!p) return false;
    if (p.status_pcp === "concluido") return true;
    const prog = calcularProgressoRealPedido(p, pedidosProducao, ordensCD);
    if (prog >= 100) return true;
    if (p.percentual_concluido != null && p.percentual_concluido >= 100) return true;
    return false;
  };

  const stats = {
    total: pedidos.length,
    ativos: pedidos.filter(p => !isPedidoConcluido(p)).length,
    pendentes: pedidos.filter(p => p.status_pcp === "pendente_distribuicao" && !isPedidoConcluido(p)).length,
    distribuidos: pedidos.filter(p => p.status_pcp === "distribuido" && !isPedidoConcluido(p)).length,
    em_producao: pedidos.filter(p => p.status_pcp === "em_producao" && !isPedidoConcluido(p)).length,
    concluidos: pedidos.filter(p => isPedidoConcluido(p)).length,
    atrasados: pedidos.filter(p => diasUteisRestantes(p.data_entrega) < 0 && !isPedidoConcluido(p)).length
  };

  const FILTROS = [
    { id: "ativos", label: "Fila Ativa", count: stats.ativos, icon: Zap, color: "text-orange-500" },
    { id: "pendente_distribuicao", label: "Pendentes", count: stats.pendentes, icon: AlertTriangle, color: "text-amber-500" },
    { id: "distribuido", label: "Distribuídos", count: stats.distribuidos, icon: CheckCircle2, color: "text-blue-500" },
    { id: "em_producao", label: "Em Produção", count: stats.em_producao, icon: Factory, color: "text-indigo-500" },
    { id: "concluido", label: "Concluídos", count: stats.concluidos, icon: CheckCircle2, color: "text-emerald-500" },
    { id: "todos", label: "Todos", count: stats.total, icon: Layers, color: "text-slate-500" }
  ];

  // Estatísticas de Matéria-Prima em Tempo Real (Bobinas e Chapas)
  const statsMaterial = useMemo(() => {
    let comMaterial = 0;
    let semMaterial = 0;
    pedidos.forEach(p => {
      const diag = verificarEstoquePedido(p, estoqueContext);
      if (diag.statusGeral === "ok" || diag.statusGeral === "desbobinar") {
        comMaterial++;
      } else {
        semMaterial++;
      }
    });
    return { comMaterial, semMaterial };
  }, [pedidos, estoqueContext]);

  // Filtros + busca
  const pedidosFiltrados = pedidos.filter(p => {
    const concluido = isPedidoConcluido(p);

    if (filtro === "ativos") {
      if (concluido) return false;
    } else if (filtro === "concluido") {
      if (!concluido) return false;
    } else if (filtro === "pendente_distribuicao") {
      if (concluido || p.status_pcp !== "pendente_distribuicao") return false;
    } else if (filtro === "distribuido") {
      if (concluido || p.status_pcp !== "distribuido") return false;
    } else if (filtro === "em_producao") {
      if (concluido || p.status_pcp !== "em_producao") return false;
    } else if (filtro !== "todos") {
      if (p.status_pcp !== filtro) return false;
    }

    // Filtro por Matéria-Prima em Estoque
    if (filtroMaterial !== "todos") {
      const diag = verificarEstoquePedido(p, estoqueContext);
      const temMaterial = diag.statusGeral === "ok" || diag.statusGeral === "desbobinar";
      if (filtroMaterial === "com_material" && !temMaterial) return false;
      if (filtroMaterial === "sem_material" && temMaterial) return false;
    }

    // Filtro por Data
    if (filtroDataAtivo) {
      const dataAlvoStr = filtroDataCampo === "data_recebimento" ? p.data_recebimento : p.data_entrega;
      const dataAlvoISO = extrairDataISO(dataAlvoStr);

      if (!dataAlvoISO) {
        return false;
      }

      const hojeStr = formatToLocalDateInput(new Date());

      if (filtroDataPreset === "atrasados") {
        if (dataAlvoISO >= hojeStr || concluido) return false;
      } else if (filtroDataInicio && filtroDataFim) {
        const dMin = filtroDataInicio <= filtroDataFim ? filtroDataInicio : filtroDataFim;
        const dMax = filtroDataInicio <= filtroDataFim ? filtroDataFim : filtroDataInicio;
        if (dataAlvoISO < dMin || dataAlvoISO > dMax) return false;
      } else if (filtroDataInicio) {
        if (dataAlvoISO !== filtroDataInicio) return false;
      } else if (filtroDataFim) {
        if (dataAlvoISO > filtroDataFim) return false;
      }
    }

    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      String(p.numero_pedido || "").toLowerCase().includes(q) ||
      String(p.of_nome || "").toLowerCase().includes(q) ||
      String(p.of_odoo_id || "").toLowerCase().includes(q) ||
      String(p.odoo_id || "").toLowerCase().includes(q) ||
      String(p.identificacao_1 || "").toLowerCase().includes(q) ||
      String(p.identificacao_2 || "").toLowerCase().includes(q) ||
      String(p.descricao || "").toLowerCase().includes(q) ||
      String(p.cliente_nome || "").toLowerCase().includes(q) ||
      String(p.vendedor_nome || "").toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (filtro === "concluido") {
      return new Date(b.data_recebimento || 0).getTime() - new Date(a.data_recebimento || 0).getTime();
    }
    // 1º: Prioridade 1 a 5 (P1 é a mais urgente absoluta!)
    const priDiff = getPesoOrdenacaoPrioridade(a) - getPesoOrdenacaoPrioridade(b);
    if (priDiff !== 0) return priDiff;

    // 2º: FIFO por data_recebimento (mais antigo primeiro)
    const da = new Date(a.data_recebimento || 0).getTime();
    const db = new Date(b.data_recebimento || 0).getTime();
    return da - db;
  });

  const pedidosAtivosEmTodos = filtro === "todos" ? pedidosFiltrados.filter(p => !isPedidoConcluido(p)) : pedidosFiltrados;
  const pedidosConcluidosEmTodos = filtro === "todos" ? pedidosFiltrados.filter(p => isPedidoConcluido(p)) : [];

  // Agrupa pedidos por numero_pedido mantendo a ordenação de prioridade/FIFO
  const gruposPedidos = useMemo(() => {
    const map = new Map();
    const lista = filtro === "todos" ? pedidosAtivosEmTodos : pedidosFiltrados;
    lista.forEach(p => {
      const num = p.numero_pedido || `AVULSO_${p.id}`;
      if (!map.has(num)) {
        map.set(num, {
          numero_pedido: p.numero_pedido || "Sem Número",
          cliente_nome: p.cliente_nome || "—",
          vendedor_nome: p.vendedor_nome || "—",
          data_entrega: p.data_entrega,
          unidade: p.unidade,
          prioridade: !!p.prioridade,
          prioridade_nivel: p.prioridade_nivel,
          ofs: []
        });
      }
      const g = map.get(num);
      const ofKey = p.of_nome || p.of_odoo_id || p.id;
      const jaExiste = g.ofs.some(o => (o.of_nome || o.of_odoo_id || o.id) === ofKey);
      if (!jaExiste) {
        g.ofs.push(p);
      }
      if (p.prioridade && !g.prioridade) {
        g.prioridade = true;
        g.prioridade_nivel = p.prioridade_nivel;
      }
      if (!g.cliente_nome || g.cliente_nome === "—") g.cliente_nome = p.cliente_nome;
      if (!g.vendedor_nome || g.vendedor_nome === "—") g.vendedor_nome = p.vendedor_nome;
      if (!g.data_entrega) g.data_entrega = p.data_entrega;
    });
    return Array.from(map.values());
  }, [pedidosFiltrados, pedidosAtivosEmTodos, filtro]);

  const gruposConcluidosEmTodos = useMemo(() => {
    if (filtro !== "todos") return [];
    const map = new Map();
    pedidosConcluidosEmTodos.forEach(p => {
      const num = p.numero_pedido || `AVULSO_${p.id}`;
      if (!map.has(num)) {
        map.set(num, {
          numero_pedido: p.numero_pedido || "Sem Número",
          cliente_nome: p.cliente_nome || "—",
          vendedor_nome: p.vendedor_nome || "—",
          data_entrega: p.data_entrega,
          unidade: p.unidade,
          prioridade: !!p.prioridade,
          prioridade_nivel: p.prioridade_nivel,
          ofs: []
        });
      }
      const g = map.get(num);
      const ofKey = p.of_nome || p.of_odoo_id || p.id;
      const jaExiste = g.ofs.some(o => (o.of_nome || o.of_odoo_id || o.id) === ofKey);
      if (!jaExiste) {
        g.ofs.push(p);
      }
    });
    return Array.from(map.values());
  }, [pedidosConcluidosEmTodos, filtro]);

  // Se o usuário pesquisar por algo (ex: '1337790' ou 'Nytro'), auto-expande os pedidos que bateram na busca
  useEffect(() => {
    if (busca && busca.trim().length >= 2) {
      const numsParaExpandir = new Set(gruposPedidos.map(g => g.numero_pedido));
      setPedidosExpandidos(numsParaExpandir);
    }
  }, [busca, gruposPedidos]);

  const toggleExpandirPedido = (num) => {
    setPedidosExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const expandirTodos = () => {
    const todos = new Set(gruposPedidos.map(g => g.numero_pedido));
    if (filtro === "todos") {
      gruposConcluidosEmTodos.forEach(g => todos.add(g.numero_pedido));
    }
    setPedidosExpandidos(todos);
  };

  const recolherTodos = () => {
    setPedidosExpandidos(new Set());
  };

  // ── SELEÇÃO INTELIGENTE DE TODAS AS OPS ──────────────────────────
  const todosFiltradosSelecionados = pedidosFiltrados.length > 0 && pedidosFiltrados.every(p => selecionados.has(p.id));
  const algumFiltradoSelecionado = pedidosFiltrados.length > 0 && pedidosFiltrados.some(p => selecionados.has(p.id)) && !todosFiltradosSelecionados;

  const handleToggleSelectGrupo = (grupo) => {
    const ids = (grupo.ofs || []).map(p => p.id);
    setSelecionados(prev => {
      const next = new Set(prev);
      const todosJaSelecionados = ids.every(id => next.has(id));
      if (todosJaSelecionados) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSelectByCriteria = (criterio) => {
    if (criterio === "todos") {
      const ids = pedidosFiltrados.map(p => p.id);
      setSelecionados(new Set(ids));
    } else if (criterio === "pendentes") {
      const ids = pedidosFiltrados
        .filter(p => p.status_pcp === "pendente_distribuicao" && !isPedidoConcluido(p))
        .map(p => p.id);
      setSelecionados(new Set(ids));
    } else if (criterio === "distribuidos") {
      const ids = pedidosFiltrados
        .filter(p => p.status_pcp === "distribuido" && !isPedidoConcluido(p))
        .map(p => p.id);
      setSelecionados(new Set(ids));
    } else if (criterio === "em_producao") {
      const ids = pedidosFiltrados
        .filter(p => p.status_pcp === "em_producao" && !isPedidoConcluido(p))
        .map(p => p.id);
      setSelecionados(new Set(ids));
    } else if (criterio === "concluidos") {
      const ids = pedidosFiltrados
        .filter(p => isPedidoConcluido(p))
        .map(p => p.id);
      setSelecionados(new Set(ids));
    } else if (criterio === "nenhum") {
      setSelecionados(new Set());
    }
  };

  const handleMasterCheckboxToggle = () => {
    if (todosFiltradosSelecionados) {
      setSelecionados(prev => {
        const next = new Set(prev);
        pedidosFiltrados.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelecionados(prev => {
        const next = new Set(prev);
        pedidosFiltrados.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

  // ── EXCLUSÃO SUPER COMPLETA (SELECIONADAS, TODAS, GRUPO OU INDIVIDUAL) ──
  const solicitarExclusaoSelecionadas = () => {
    const lista = pedidos.filter(p => selecionados.has(p.id));
    if (lista.length === 0) return;
    setModalExclusao({
      aberto: true,
      pedidos: lista,
      titulo: `Excluir ${lista.length} Ordem(ns) de Fabricação Selecionada(s)?`,
      descricao: `As ${lista.length} ordens de fabricação selecionadas serão excluídas definitivamente da fila do PCP e dos galpões de produção.`,
      notificarOdoo: true
    });
  };

  const solicitarExclusaoTodas = () => {
    if (pedidosFiltrados.length === 0) return;
    setModalExclusao({
      aberto: true,
      pedidos: pedidosFiltrados,
      titulo: `⚠️ Excluir TODAS as ${pedidosFiltrados.length} Ordem(ns) da Fila Atual?`,
      descricao: `ATENÇÃO: Todas as ${pedidosFiltrados.length} ordens de fabricação exibidas na visualização atual serão permanentemente apagadas do sistema.`,
      notificarOdoo: true
    });
  };

  const solicitarExclusaoGrupo = (grupo) => {
    const ofs = grupo.ofs || [];
    if (ofs.length === 0) return;
    setModalExclusao({
      aberto: true,
      pedidos: ofs,
      titulo: `Excluir Pedido #${grupo.numero_pedido} (${ofs.length} OFs)?`,
      descricao: `Você está prestes a excluir o Pedido #${grupo.numero_pedido} (${grupo.cliente_nome}) e todas as suas ${ofs.length} Ordens de Fabricação vinculadas.`,
      notificarOdoo: true
    });
  };

  const solicitarExclusaoIndividual = (pedido) => {
    setModalExclusao({
      aberto: true,
      pedidos: [pedido],
      titulo: `Excluir OF ${pedido.of_nome || pedido.of_odoo_id || '#' + pedido.numero_pedido}?`,
      descricao: `Esta ordem de fabricação (${pedido.cliente_nome || 'Cliente'}) será removida da Central PCP e das filas de produção.`,
      notificarOdoo: true
    });
  };

  const executarExclusaoConfirmada = async () => {
    const lista = modalExclusao.pedidos;
    if (!lista || lista.length === 0) {
      setModalExclusao(prev => ({ ...prev, aberto: false }));
      return;
    }

    setExcluindo(true);
    let excluidos = 0;
    let erros = 0;
    const todayIso = new Date().toISOString().slice(0, 10);
    const numerosPedidos = [...new Set(lista.map(p => p.numero_pedido).filter(Boolean))];

    try {
      // 1) Cancela registros vinculados nos galpões de produção
      for (const num of numerosPedidos) {
        try {
          await base44.entities.OrdemMaquinaCD.updateMany(
            { numero_pedido: num, status: { $ne: "cancelado" } },
            { $set: { status: "cancelado", data_finalizacao: todayIso } }
          ).catch(() => {});
          await base44.entities.OrdemDesbobinadeira.updateMany(
            { numero_pedido: num, status: { $ne: "cancelado" } },
            { $set: { status: "cancelado", data_finalizacao: todayIso } }
          ).catch(() => {});
          await base44.entities.Pedido.updateMany(
            { numero_pedido: num, status: { $ne: "cancelado" } },
            { $set: { status: "cancelado", data_finalizacao: todayIso } }
          ).catch(() => {});
        } catch (e) {
          console.warn("[Exclusão] Falha ao atualizar ordens do galpão para pedido", num, e);
        }
      }

      // 2) Exclui cada PedidoOdoo e notifica o Odoo se aplicável
      for (const p of lista) {
        try {
          if (modalExclusao.notificarOdoo && p.odoo_id && !isPedidoTeste(p)) {
            base44.functions.invoke("cancelarOrdemServicoOdoo", {
              pedido_id: p.id,
              numero_pedido: p.numero_pedido,
              odoo_id: p.odoo_id,
              of_odoo_id: p.of_odoo_id,
              of_nome: p.of_nome,
              force: true,
            }).catch((err) => console.warn("[Exclusão Odoo Webhook]", err));
          }

          await base44.entities.PedidoOdoo.delete(p.id);
          excluidos++;
        } catch (err) {
          console.error("[Exclusão] Falha ao deletar PedidoOdoo:", p.id, err);
          erros++;
        }
      }

      // Remove IDs excluídos do set de selecionados
      setSelecionados(prev => {
        const next = new Set(prev);
        lista.forEach(p => next.delete(p.id));
        return next;
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });

      toast({
        title: `🗑️ ${excluidos} ordem(ns) de fabricação excluída(s)`,
        description: erros > 0
          ? `${excluidos} excluídas com sucesso. ${erros} falharam.`
          : `As ordens foram removidas com sucesso da Central PCP e dos galpões.`,
        className: "border-red-500/40"
      });
    } catch (e) {
      toast({
        title: "Erro ao excluir ordens",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setExcluindo(false);
      setModalExclusao({ aberto: false, pedidos: [], titulo: "", descricao: "", notificarOdoo: true });
    }
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
      <div className="px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Fila Ativa" value={stats.ativos} icon={<Zap className="w-4 h-4" />} color="text-orange-500" />
        <StatCard label="Pendentes" value={stats.pendentes} icon={<AlertTriangle className="w-4 h-4" />} color="text-amber-500" />
        <StatCard label="Distribuídos" value={stats.distribuidos} icon={<CheckCircle2 className="w-4 h-4" />} color="text-blue-500" />
        <StatCard label="Concluídos" value={stats.concluidos} icon={<CheckCircle2 className="w-4 h-4" />} color="text-emerald-500" />
        <StatCard label="Atrasados" value={stats.atrasados} icon={<AlertTriangle className="w-4 h-4" />} color="text-red-500" />
      </div>

      {/* Busca + Filtros */}
      <div className="px-4 sm:px-6 pb-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por nº pedido, OF, cliente ou vendedor..."
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
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              {f.icon && <f.icon className={`w-3.5 h-3.5 ${filtro !== f.id ? f.color : ""}`} />}
              <span>{f.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                filtro === f.id
                  ? "bg-white/20 dark:bg-slate-900/20 text-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Barra de Filtro Rápido de Matéria-Prima em Estoque (Bobinas & Chapas) */}
      <div className="px-4 sm:px-6 pb-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 shrink-0 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            Estoque MP:
          </span>
          <button
            type="button"
            onClick={() => setFiltroMaterial("todos")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filtroMaterial === "todos"
                ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
            }`}
          >
            Todas as OPs
          </button>
          <button
            type="button"
            onClick={() => setFiltroMaterial("com_material")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filtroMaterial === "com_material"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100/60"
            }`}
            title="Ordens de Fabricação com matéria-prima em estoque (bobinas ou chapas disponíveis)"
          >
            <span>🟢 Com Material ({statsMaterial.comMaterial})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroMaterial("sem_material")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filtroMaterial === "sem_material"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100/60"
            }`}
            title="Ordens de Fabricação sem matéria-prima suficiente em estoque"
          >
            <span>🔴 Sem Material ({statsMaterial.semMaterial})</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtro por Data */}
      <div className="px-4 sm:px-6 pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Lado Esquerdo: Identificador + Campo Alvo + Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span>Filtrar Data:</span>
            </div>

            {/* Alternar Campo: Entrega vs Chegada */}
            <select
              value={filtroDataCampo}
              onChange={(e) => setFiltroDataCampo(e.target.value)}
              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
            >
              <option value="data_entrega">📅 Prazo de Entrega (SLA)</option>
              <option value="data_recebimento">📥 Chegada no PCP</option>
            </select>

            {/* Divisor sutil */}
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            {/* Presets Rápidos */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "todas", label: "Todas" },
                { id: "hoje", label: "Hoje" },
                { id: "amanha", label: "Amanhã" },
                { id: "semana", label: "Próx. 7 Dias" },
                { id: "atrasados", label: "Atrasados" },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    filtroDataPreset === p.id
                      ? "bg-orange-500 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lado Direito: Seleção Manual de Data (De e Até) + Limpar */}
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-medium">De:</span>
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => {
                  setFiltroDataInicio(e.target.value);
                  setFiltroDataPreset("personalizada");
                }}
                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 h-7"
              />
              <span className="text-[11px] font-medium">Até:</span>
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => {
                  setFiltroDataFim(e.target.value);
                  setFiltroDataPreset("personalizada");
                }}
                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 h-7"
              />
            </div>

            {filtroDataAtivo && (
              <button
                type="button"
                onClick={limparFiltroData}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors border border-rose-200 dark:border-rose-900/50 h-7 shrink-0"
                title="Limpar filtro de data"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>

        {/* Indicador Ativo de Filtro de Data */}
        {filtroDataAtivo && (
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30 border border-orange-200/80 dark:border-orange-900/40 rounded-lg px-3 py-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span>
                Filtrando por <strong>{filtroDataCampo === "data_entrega" ? "Prazo de Entrega" : "Chegada no PCP"}</strong>:{" "}
                {filtroDataPreset === "hoje" && "Hoje"}
                {filtroDataPreset === "amanha" && "Amanhã"}
                {filtroDataPreset === "semana" && "Próximos 7 dias"}
                {filtroDataPreset === "atrasados" && "Pedidos atrasados (vencidos)"}
                {filtroDataPreset === "personalizada" && (
                  filtroDataInicio && filtroDataFim && filtroDataInicio !== filtroDataFim
                    ? `${formatDataBR(filtroDataInicio)} até ${formatDataBR(filtroDataFim)}`
                    : formatDataBR(filtroDataInicio || filtroDataFim)
                )}
                {filtroDataPreset !== "hoje" && filtroDataPreset !== "amanha" && filtroDataPreset !== "semana" && filtroDataPreset !== "atrasados" && filtroDataPreset !== "personalizada" && "Personalizado"}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-bold">{pedidosFiltrados.length} OFs encontradas</span>
            </div>
            <button
              type="button"
              onClick={limparFiltroData}
              className="text-orange-600 hover:text-orange-800 dark:hover:text-orange-200 font-semibold underline text-[10px] shrink-0 ml-2"
            >
              Remover filtro
            </button>
          </div>
        )}
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
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {busca || filtroDataAtivo || filtro !== "ativos"
                ? "Nenhum pedido encontrado para os filtros selecionados"
                : "Nenhum pedido na fila"}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              {busca || filtroDataAtivo || filtro !== "ativos"
                ? "Tente ajustar o termo de busca, trocar a data ou limpar os filtros para visualizar outros pedidos."
                : "Clique em \"Receber / Simular Webhook Odoo\" para importar pedidos do ERP."}
            </p>
            {(busca || filtroDataAtivo || filtro !== "ativos") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBusca("");
                  limparFiltroData();
                  setFiltro("ativos");
                }}
                className="mt-3 text-xs"
              >
                Limpar Todos os Filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Barra de Distribuição em Lote e Ações Rápidas do PCP */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 mb-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-sm">
              {/* Lado Esquerdo: Checkbox Mestre + Atalhos de Seleção + Badge de Selecionados */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={todosFiltradosSelecionados}
                    ref={(el) => {
                      if (el) el.indeterminate = algumFiltradoSelecionado;
                    }}
                    onChange={handleMasterCheckboxToggle}
                    className="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer"
                  />
                  <span>
                    Selecionar Todas ({pedidosFiltrados.length})
                  </span>
                </label>

                {/* Atalhos rápidos de seleção */}
                <div className="flex items-center gap-1 text-[11px] overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-slate-400 font-medium text-[10px]">Filtrar:</span>
                  <button
                    type="button"
                    onClick={() => handleSelectByCriteria("pendentes")}
                    className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 font-semibold border border-amber-200/60 transition-colors"
                    title="Selecionar apenas OFs com status Pendente"
                  >
                    Pendentes ({stats.pendentes})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectByCriteria("distribuidos")}
                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-semibold border border-blue-200/60 transition-colors"
                    title="Selecionar apenas OFs já distribuídas"
                  >
                    Distribuídas ({stats.distribuidos})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectByCriteria("em_producao")}
                    className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-semibold border border-indigo-200/60 transition-colors"
                    title="Selecionar apenas OFs em produção"
                  >
                    Em Produção ({stats.em_producao})
                  </button>
                  {stats.concluidos > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectByCriteria("concluidos")}
                      className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold border border-emerald-200/60 transition-colors"
                      title="Selecionar apenas OFs concluídas"
                    >
                      Concluídas ({stats.concluidos})
                    </button>
                  )}
                </div>

                {/* Badge de Selecionados com botão de desmarcar */}
                {selecionados.size > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 font-bold">
                      {selecionados.size} selecionada(s)
                    </Badge>
                    <button
                      type="button"
                      onClick={() => handleSelectByCriteria("nenhum")}
                      className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline font-medium"
                      title="Desmarcar todas"
                    >
                      Desmarcar
                    </button>
                  </div>
                )}
              </div>

              {/* Lado Direito: Ações em Lote (Distribuir, Apagar Selecionadas, Apagar Todas) */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Distribuir Selecionados */}
                {selecionados.size > 0 && (
                  <Button
                    size="sm"
                    disabled={distribuindo || excluindo}
                    onClick={() => {
                      const lista = pedidos.filter(p => selecionados.has(p.id));
                      handleDistribuirLote(lista);
                    }}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs h-8 gap-1.5 shadow-sm font-bold"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {distribuindo ? "Distribuindo..." : `Distribuir Selecionadas (${selecionados.size})`}
                  </Button>
                )}

                {/* Distribuir TODOS os Pendentes da fila */}
                {selecionados.size === 0 && pedidosFiltrados.filter(p => p.status_pcp === "pendente_distribuicao").length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={distribuindo || excluindo}
                    onClick={() => {
                      const pendentes = pedidosFiltrados.filter(p => p.status_pcp === "pendente_distribuicao");
                      handleDistribuirLote(pendentes);
                    }}
                    className="border-orange-400 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-xs h-8 gap-1.5 font-bold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {distribuindo ? "Distribuindo..." : `Distribuir Todos os Pendentes (${pedidosFiltrados.filter(p => p.status_pcp === "pendente_distribuicao").length})`}
                  </Button>
                )}

                {/* APAGAR SELECIONADAS */}
                {selecionados.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={distribuindo || excluindo}
                    onClick={solicitarExclusaoSelecionadas}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs h-8 gap-1.5 shadow-sm font-bold"
                    title="Excluir todas as ordens de fabricação selecionadas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {excluindo ? "Apagando..." : `Apagar Selecionadas (${selecionados.size})`}
                  </Button>
                )}

                {/* APAGAR TODAS DA FILA ATUAL */}
                {pedidosFiltrados.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={distribuindo || excluindo}
                    onClick={solicitarExclusaoTodas}
                    className="border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs h-8 gap-1.5 font-semibold"
                    title={`Excluir todas as ${pedidosFiltrados.length} ordens de fabricação exibidas nesta fila`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Apagar Todas ({pedidosFiltrados.length})</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mb-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Zap className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-semibold">
                  {filtro === "concluido" ? "Pedidos Concluídos" : "Fila FIFO"}
                </span> — {gruposPedidos.length} pedido(s) ({pedidosFiltrados.length} OFs)
                {filtro === "ativos" && " na fila ativa"}
                {filtro === "todos" && " no total"}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Botões Expandir / Recolher Todos */}
                {modoVisao === "agrupado" && gruposPedidos.length > 0 && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={expandirTodos}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                      title="Expandir todas as OFs de todos os pedidos"
                    >
                      Expandir Todos
                    </button>
                    <button
                      type="button"
                      onClick={recolherTodos}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                      title="Recolher e minimizar todas as OFs"
                    >
                      Recolher Todos
                    </button>
                  </div>
                )}

                {/* Alternador de Modo: Por Pedido vs Grade Solta */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setModoVisao("agrupado")}
                    className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                      modoVisao === "agrupado"
                        ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Visualização limpa agrupada por Pedido (Minimizada)"
                  >
                    Por Pedido
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVisao("cards")}
                    className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                      modoVisao === "cards"
                        ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Visualização clássica com todas as OFs soltas em grade"
                  >
                    Grade Solta
                  </button>
                </div>

                {filtro !== "concluido" && stats.concluidos > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiltro("concluido")}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Ver Concluídos ({stats.concluidos})
                  </button>
                )}
                {filtro === "concluido" && (
                  <button
                    type="button"
                    onClick={() => setFiltro("ativos")}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 transition-all border border-orange-500/20"
                  >
                    <Zap className="w-3.5 h-3.5 text-orange-600" />
                    Voltar à Fila Ativa ({stats.ativos})
                  </button>
                )}
              </div>
            </div>

            {/* Lista Principal de Pedidos: Agrupados ou Grade */}
            {modoVisao === "agrupado" ? (
              <div className="space-y-3">
                {gruposPedidos.map(grupo => (
                  <PedidoOdooGrupoCard
                    key={grupo.numero_pedido}
                    grupo={grupo}
                    expandido={pedidosExpandidos.has(grupo.numero_pedido)}
                    onToggle={() => toggleExpandirPedido(grupo.numero_pedido)}
                    pedidosProducao={pedidosProducao}
                    ordensCD={ordensCD}
                    selecionados={selecionados}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectGrupo={handleToggleSelectGrupo}
                    onDistribuir={handleDistribuir}
                    onDistribuirGrupo={handleDistribuirLote}
                    onClickPedido={(p) => { setPedidoSelecionado(p); setDetalheOpen(true); }}
                    onDelete={solicitarExclusaoIndividual}
                    onDeleteGrupo={solicitarExclusaoGrupo}
                    onRetirarFila={handleRetirarFila}
                    onTogglePrioridade={handleTogglePrioridade}
                    onSetPrioridade={handleSetPrioridade}
                    estoqueContext={estoqueContext}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(filtro === "todos" ? pedidosAtivosEmTodos : pedidosFiltrados).map(p => (
                  <PedidoOdooCard
                    key={p.id}
                    pedido={p}
                    progressoReal={calcularProgressoRealPedido(p, pedidosProducao, ordensCD)}
                    pedidosProducao={pedidosProducao}
                    ordensCD={ordensCD}
                    selecionado={selecionados.has(p.id)}
                    onToggleSelect={handleToggleSelect}
                    onDistribuir={handleDistribuir}
                    onClick={() => { setPedidoSelecionado(p); setDetalheOpen(true); }}
                    onDelete={solicitarExclusaoIndividual}
                    onRetirarFila={handleRetirarFila}
                    onTogglePrioridade={handleTogglePrioridade}
                    onSetPrioridade={handleSetPrioridade}
                    estoqueContext={estoqueContext}
                  />
                ))}
              </div>
            )}

            {/* Seção recolhível de Concluídos quando visualizando 'Todos' */}
            {filtro === "todos" && pedidosConcluidosEmTodos.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        Pedidos Concluídos ({pedidosConcluidosEmTodos.length} OFs em {gruposConcluidosEmTodos.length} pedidos)
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Pedidos 100% finalizados nas máquinas e prontos para expedição
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMostrarConcluidosEmTodos(!mostrarConcluidosEmTodos)}
                    className="text-xs h-8 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/50"
                  >
                    {mostrarConcluidosEmTodos ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5 mr-1" />
                        Minimizar Concluídos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5 mr-1" />
                        Mostrar Concluídos ({gruposConcluidosEmTodos.length} pedidos)
                      </>
                    )}
                  </Button>
                </div>

                {mostrarConcluidosEmTodos && (
                  modoVisao === "agrupado" ? (
                    <div className="space-y-3">
                      {gruposConcluidosEmTodos.map(grupo => (
                        <PedidoOdooGrupoCard
                          key={grupo.numero_pedido}
                          grupo={grupo}
                          expandido={pedidosExpandidos.has(grupo.numero_pedido)}
                          onToggle={() => toggleExpandirPedido(grupo.numero_pedido)}
                          pedidosProducao={pedidosProducao}
                          ordensCD={ordensCD}
                          selecionados={selecionados}
                          onToggleSelect={handleToggleSelect}
                          onToggleSelectGrupo={handleToggleSelectGrupo}
                          onDistribuir={handleDistribuir}
                          onDistribuirGrupo={handleDistribuirLote}
                          onClickPedido={(p) => { setPedidoSelecionado(p); setDetalheOpen(true); }}
                          onDelete={solicitarExclusaoIndividual}
                          onDeleteGrupo={solicitarExclusaoGrupo}
                          onRetirarFila={handleRetirarFila}
                          onTogglePrioridade={handleTogglePrioridade}
                          onSetPrioridade={handleSetPrioridade}
                          estoqueContext={estoqueContext}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {pedidosConcluidosEmTodos.map(p => (
                        <PedidoOdooCard
                          key={p.id}
                          pedido={p}
                          progressoReal={calcularProgressoRealPedido(p, pedidosProducao, ordensCD)}
                          pedidosProducao={pedidosProducao}
                          ordensCD={ordensCD}
                          selecionado={selecionados.has(p.id)}
                          onToggleSelect={handleToggleSelect}
                          onDistribuir={handleDistribuir}
                          onClick={() => { setPedidoSelecionado(p); setDetalheOpen(true); }}
                          onDelete={solicitarExclusaoIndividual}
                          onRetirarFila={handleRetirarFila}
                          onTogglePrioridade={handleTogglePrioridade}
                          onSetPrioridade={handleSetPrioridade}
                          estoqueContext={estoqueContext}
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
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
        onSetPrioridade={handleSetPrioridade}
        onToggleItem={handleToggleItem}
        onProgramarItem={handleProgramarItem}
        onProgramarTodosItens={handleProgramarTodosItens}
        estoqueContext={estoqueContext}
        onAtualizado={() => {
          queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
          queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
        }}
      />
      <SenhaGestorDialog
        open={senhaGestorOpen}
        onOpenChange={setSenhaGestorOpen}
        titulo="Autorizar Prioridade Alta"
        descricao="Para marcar este pedido como Prioridade Alta / Urgente (P1 ou P2), digite o PIN de liberação do PCP/Gestor."
        onAutorizado={() => {
          if (pedidoPrioridadePendente) {
            confirmarPrioridade(pedidoPrioridadePendente.pedido, pedidoPrioridadePendente.nivel ?? 1);
            setPedidoPrioridadePendente(null);
          }
        }}
      />
      <WebhookSimulatorDialog
        open={webhookOpen}
        onOpenChange={setWebhookOpen}
        onReceber={handleReceberWebhook}
      />

      {/* Modal Seguro de Confirmação de Exclusão (Lote, Grupo ou Individual) */}
      <AlertDialog
        open={modalExclusao.aberto}
        onOpenChange={(aberto) => {
          if (!excluindo) setModalExclusao(prev => ({ ...prev, aberto }));
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 text-left">
                  {modalExclusao.titulo}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 text-left">
                  Esta ação é destrutiva e removerá os registros da fila do PCP.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-slate-700 dark:text-slate-300">
              {modalExclusao.descricao}
            </p>

            {/* Resumo das OFs afetadas */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto space-y-1.5">
              <div className="flex items-center justify-between font-bold text-[11px] text-slate-500 pb-1 border-b border-slate-200 dark:border-slate-700">
                <span>Total de Ordens a excluir:</span>
                <Badge variant="destructive" className="text-[10px] h-5">
                  {modalExclusao.pedidos.length} {modalExclusao.pedidos.length === 1 ? "OF" : "OFs"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {modalExclusao.pedidos.map(p => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 font-mono text-[10px] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5"
                  >
                    #{p.numero_pedido}
                    {p.of_nome && ` (${p.of_nome})`}
                  </span>
                ))}
              </div>
            </div>

            {/* Checkbox opcional de sincronização com Odoo */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300 text-[11px] pt-1">
              <input
                type="checkbox"
                checked={modalExclusao.notificarOdoo}
                onChange={(e) => setModalExclusao(prev => ({ ...prev, notificarOdoo: e.target.checked }))}
                className="w-3.5 h-3.5 rounded text-red-600 border-slate-300 focus:ring-red-500 cursor-pointer"
              />
              <span>Sincronizar cancelamento no webhook do Odoo ERP (quando disponível)</span>
            </label>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={excluindo} className="text-xs h-9">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executarExclusaoConfirmada();
              }}
              disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 gap-1.5"
            >
              {excluindo ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sim, Excluir Definitivamente ({modalExclusao.pedidos.length})</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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