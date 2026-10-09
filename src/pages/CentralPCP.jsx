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
  ChevronDown, ChevronUp, Calendar, Filter, X, Clock, Trash2, CheckSquare, Square,
  Building2, ArrowRightLeft, Store, Globe, User, Briefcase, Hash, Package, ShieldCheck
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
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
import RecuperarPedidoOdooDialog from "@/components/pcp/RecuperarPedidoOdooDialog";
import AuditarRestaurarOpsDialog from "@/components/pcp/AuditarRestaurarOpsDialog";
import { reajustarTodasBobinasMaquinasAutomaticamente } from "@/lib/reajusteAutomaticoBobinas";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";
import CapacidadeDiariaIA from "@/components/pcp/CapacidadeDiariaIA";
import TransferirLojaDialog from "@/components/pcp/TransferirLojaDialog";
import { useFilial } from "@/contexts/FilialContext";
import { FILIAIS_PCP } from "@/lib/roteamentoPCP";
import { calcularDataPrometidaSLA, toISODate, slaDiasPorCategoria, diasUteisRestantes, formatDataBR } from "@/lib/sla";
import { parseItensPedido } from "@/lib/regrasFabrica";
import { notificarStatus } from "@/lib/biNotificador";
import {
  calcularProgressoRealPedido,
  statusPcpPorPercentual,
  enriquecerItensComStatusReal,
  itensPorGrupo,
  obterStatusExecucaoPedido
} from "@/lib/pedidoOdooHelper";
import {
  isAutoRoteamentoTelhasAtivo,
  rotearPedidoTelhaDiretoParaMaquina,
  rotearLoteTelhasAgrupadas
} from "@/lib/autoBobinaTelhasHelper";
import { getPesoOrdenacaoPrioridade } from "@/lib/prioridadeHelper";
import { verificarEstoquePedido } from "@/lib/estoqueMaterialHelper";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";

const TIPOS_BUSCA = [
  { id: "todos", label: "Todos", icon: Search, placeholder: "Buscar geral (nº pedido, cliente, vendedor ou modelo)..." },
  { id: "cliente", label: "Cliente", icon: User, placeholder: "Filtrar por nome ou razão social do cliente..." },
  { id: "vendedor", label: "Vendedor", icon: Briefcase, placeholder: "Filtrar por nome do vendedor..." },
  { id: "numero_pedido", label: "Nº Pedido / OF", icon: Hash, placeholder: "Filtrar por nº do pedido ou OF..." },
  { id: "modelo", label: "Modelo Material", icon: Package, placeholder: "Filtrar por modelo de material (ex: TP-40, Sanduíche)..." },
];

const MODELOS_RAPIDOS = [
  "TP-40",
  "TP-25",
  "Sanduíche EPS",
  "Ondulada 17",
  "Frisada",
  "Corte & Dobra",
  "Galvalume",
  "Pré-Pintada"
];

export default function CentralPCP() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [tipoBusca, setTipoBusca] = useState("todos"); // "todos" | "cliente" | "vendedor" | "numero_pedido" | "modelo"
  const [filtro, setFiltro] = useState("ativos");
  const [filtroMaterial, setFiltroMaterial] = useState("todos"); // "todos" | "com_material" | "sem_material"
  const [mostrarConcluidosEmTodos, setMostrarConcluidosEmTodos] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [recuperarModalOpen, setRecuperarModalOpen] = useState(false);
  const [auditarModalOpen, setAuditarModalOpen] = useState(false);
  const [distribuindo, setDistribuindo] = useState(false);
  const [selecionados, setSelecionados] = useState(new Set());
  const [senhaGestorOpen, setSenhaGestorOpen] = useState(false);
  const [pedidoPrioridadePendente, setPedidoPrioridadePendente] = useState(null);
  const [pedidosExpandidos, setPedidosExpandidos] = useState(() => new Set());
  const [modoVisao, setModoVisao] = useState("agrupado");

  // Central PCP por Loja / Filial e Permissões de Usuário
  const filialCtx = useFilial();
  const filialAtiva = filialCtx?.filialAtiva || "Matriz AJL";
  const isOperador = filialCtx?.user?.role === "operador";

  const filiaisPcpExibidas = useMemo(() => {
    if (!filialCtx?.filiaisPermitidas || filialCtx.filiaisPermitidas.length === 0) {
      return FILIAIS_PCP;
    }
    return FILIAIS_PCP.filter(f => filialCtx.filiaisPermitidas.includes(f.id));
  }, [filialCtx?.filiaisPermitidas]);

  const temAcessoGlobalCentrais = !filialCtx?.filiaisPermitidas || filialCtx.filiaisPermitidas.length > 1;

  const [lojaSelecionada, setLojaSelecionada] = useState(() => {
    return localStorage.getItem("pcp_loja_selecionada") || "todas";
  });

  // Garante que o usuário com acesso restrito não fique em "todas" ou em loja não permitida
  useEffect(() => {
    if (!temAcessoGlobalCentrais && filiaisPcpExibidas.length === 1) {
      setLojaSelecionada(filiaisPcpExibidas[0].id);
    } else if (lojaSelecionada !== "todas" && !filiaisPcpExibidas.some(f => f.id === lojaSelecionada)) {
      setLojaSelecionada(temAcessoGlobalCentrais ? "todas" : (filiaisPcpExibidas[0]?.id || "Matriz AJL"));
    }
  }, [temAcessoGlobalCentrais, filiaisPcpExibidas, lojaSelecionada]);

  const handleMudarLoja = (lojaId) => {
    setLojaSelecionada(lojaId);
    localStorage.setItem("pcp_loja_selecionada", lojaId);
  };

  // Finalizar 100% com Senha de Gestor (PIN 0000)
  const [senhaFinalizarOpen, setSenhaFinalizarOpen] = useState(false);
  const [finalizarPendentes, setFinalizarPendentes] = useState(null);

  // Modal de Transferência de Loja entre Centrais PCP
  const [modalTransferir, setModalTransferir] = useState({
    aberto: false,
    pedidos: []
  });

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

  const { data: pedidosRaw = [], isLoading: carregando, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["pedidos-odoo-pcp"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 1000),
    refetchInterval: 25000,
    refetchOnWindowFocus: true
  });

  // Contador de segundos decorridos desde a última sincronização automática com o Odoo
  const [segundosDesdeSync, setSegundosDesdeSync] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      if (dataUpdatedAt) {
        const seg = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000));
        setSegundosDesdeSync(seg);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt]);

  // Executa auditoria e readequação de máquinas e bobinas em segundo plano ao abrir o PCP
  useEffect(() => {
    reajustarTodasBobinasMaquinasAutomaticamente().then(res => {
      if (res && res.totalReajustadas > 0) {
        queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
        queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      }
    }).catch(() => {});
  }, [queryClient]);

  const handleRefetchComFeedback = async () => {
    try {
      const res = await refetch();
      const total = res.data?.length || pedidos.length;
      toast({ title: "Central PCP sincronizada!", description: `${total} ordens carregadas do Odoo ERP.` });
    } catch (e) {
      toast({ title: "Falha ao sincronizar pedidos com o Odoo.", description: e.message, variant: "destructive" });
    }
  };

  // Deduplicação estrita de OFs em memória: garante exibição de cada OF apenas uma vez SEM APAGAR nada do banco!
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

  const { data: pedidosProducao = [] } = useQuery({
    queryKey: ["pedidos-producao-todos"],
    queryFn: () => base44.entities.Pedido.list("-data", 500),
    refetchInterval: 25000
  });

  const { data: ordensCD = [] } = useQuery({
    queryKey: ["ordens-cd-todos"],
    queryFn: () => base44.entities.OrdemMaquinaCD.list("-data", 500),
    refetchInterval: 25000
  });

  // Consultas de Matéria-Prima em Tempo Real para Análise de Disponibilidade no PCP
  const { data: bobinasEstoque = [] } = useQuery({
    queryKey: ["bobinas-estoque-pcp"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false }),
    refetchInterval: 30000
  });

  const { data: chapasEstoque = [] } = useQuery({
    queryKey: ["chapas-estoque-pcp"],
    queryFn: () => base44.entities.ChapaCD.filter({ status: { $ne: "cancelado" } }),
    refetchInterval: 30000
  });

  // Pré-baixas acumuladas em tempo real de todas as OPs ativas (Telhas + Corte e Dobra)
  const { preBaixaMap, preBaixaMetrosMap, preBaixaOpsMap } = usePreBaixaBobinas("all");

  const estoqueContext = useMemo(() => ({
    bobinas: bobinasEstoque,
    chapas: chapasEstoque,
    preBaixaMap,
    preBaixaMetrosMap,
    preBaixaOpsMap
  }), [bobinasEstoque, chapasEstoque, preBaixaMap, preBaixaMetrosMap, preBaixaOpsMap]);

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
      let statusReal = statusPcpPorPercentual(progressoReal, p.status_pcp);

      // Se o pedido está pendente de distribuição no PCP, NÃO deve ser alterado automaticamente para 'em_producao'
      // a menos que esteja realmente concluído (100%)
      if (p.status_pcp === "pendente_distribuicao" && statusReal !== "concluido") {
        statusReal = "pendente_distribuicao";
      }

      // Sincroniza SOMENTE se o percentual ou status realmente mudarem
      const syncKey = `${p.id}_${progressoReal}_${statusReal}`;
      if (
        ((progressoReal !== p.percentual_concluido && p.status_pcp !== "pendente_distribuicao") ||
         (p.status_pcp !== "concluido" && statusReal === "concluido") ||
         (p.status_pcp !== "pendente_distribuicao" && p.status_pcp !== statusReal)) &&
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

  const handleSolicitarFinalizar100 = (pedidosLista) => {
    const lista = (pedidosLista || []).filter(Boolean);
    if (!lista.length) return;
    setFinalizarPendentes(lista);
    setSenhaFinalizarOpen(true);
  };

  const [sincronizandoOdoo, setSincronizandoOdoo] = useState(false);

  const handleSincronizarLoteOdoo = async (pedidosParaSincronizar) => {
    const lista = (pedidosParaSincronizar || []).filter(Boolean);
    if (!lista.length) return;
    setSincronizandoOdoo(true);
    let okCount = 0;
    let failCount = 0;

    for (const p of lista) {
      try {
        const itens = parseItensPedido(p.itens_json);
        const isConc = isPedidoConcluido(p);
        const itensSinc = isConc
          ? itens.map(i => ({ ...i, concluido: true, status: "concluido", status_detalhado: "Concluído" }))
          : itens;

        const res = await notificarStatus(
          {
            ...p,
            percentual_concluido: isConc ? 100 : (p.percentual_concluido || 0),
            status_pcp: isConc ? "concluido" : (p.status_pcp || "em_producao"),
            itens_json: JSON.stringify(itensSinc)
          },
          isConc ? "concluido" : "sincronizacao_manual",
          {
            percentual_concluido: isConc ? 100 : (p.percentual_concluido || 0),
            status_novo: isConc ? "concluido" : (p.status_pcp || "em_producao"),
            item_nome: `Pedido #${p.numero_pedido}`
          }
        );
        if (res && res.ok) okCount++;
        else failCount++;
      } catch (err) {
        console.error("Erro sincronizando pedido com Odoo:", p.numero_pedido, err);
        failCount++;
      }
    }

    setSincronizandoOdoo(false);
    if (failCount === 0) {
      toast({
        title: "Sincronização com Odoo concluída!",
        description: `${okCount} OF(s) sincronizada(s) com sucesso no Odoo ERP como Finalizado/Concluído.`
      });
    } else {
      toast({
        title: "Sincronização com Odoo realizada",
        description: `${okCount} enviada(s) com sucesso, ${failCount} falha(s).`,
        variant: failCount > 0 && okCount === 0 ? "destructive" : "default"
      });
    }
    queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
  };

  const confirmarFinalizar100 = async () => {
    if (!finalizarPendentes?.length) return;
    try {
      await Promise.all(finalizarPendentes.map(async (pedido) => {
        const itens = parseItensPedido(pedido.itens_json).map(i => ({
          ...i,
          concluido: true,
          status: "concluido",
          status_detalhado: "Concluído"
        }));

        const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
          ...(itens.length ? { itens_json: JSON.stringify(itens) } : {}),
          percentual_concluido: 100,
          status_pcp: "concluido"
        });

        // 1. Notifica o Odoo ERP imediatamente como CONCLUÍDO (100%)
        try {
          await notificarStatus(
            {
              ...pedido,
              ...atualizado,
              percentual_concluido: 100,
              status_pcp: "concluido",
              itens_json: JSON.stringify(itens)
            },
            "concluido",
            {
              percentual_concluido: 100,
              status_novo: "concluido",
              item_nome: `Pedido #${pedido.numero_pedido}`
            }
          );
        } catch (notifErr) {
          console.warn("[CentralPCP] Falha ao notificar Odoo em finalizar 100%:", notifErr);
        }

        // 2. Finaliza OPs locais vinculadas na fábrica
        try {
          const opsTelhas = await base44.entities.Pedido.filter({ pedido_odoo_id: pedido.id });
          for (const op of opsTelhas) {
            if (op.status !== "finalizado" && op.status !== "cancelado") {
              await base44.entities.Pedido.update(op.id, { status: "finalizado", concluido: true });
            }
          }
        } catch (opErr) {
          console.warn("[CentralPCP] Falha ao finalizar OPs locais:", opErr);
        }

        return atualizado;
      }));

      toast({
        title: "Pedido finalizado e enviado ao Odoo!",
        description: `${finalizarPendentes.length} OF(s) marcada(s) como 100% concluída(s) e notificadas no Odoo ERP.`
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
    } catch (e) {
      toast({ title: "Erro ao finalizar", description: e.message, variant: "destructive" });
    } finally {
      setFinalizarPendentes(null);
    }
  };

  const handleSetPrioridade = (pedido, nivel) => {
    // Se for P1 ou P2 (alta urgência), exige PIN do gestor caso não seja admin
    if (nivel === 1 || nivel === 2 || nivel === "1" || nivel === "2") {
      setPedidoPrioridadePendente({ pedido, nivel: Number(nivel), isGrupo: false });
      setSenhaGestorOpen(true);
    } else {
      confirmarPrioridade(pedido, nivel);
    }
  };

  const handleTogglePrioridade = (pedido) => {
    if (!pedido.prioridade) {
      handleSetPrioridade(pedido, 1);
    } else {
      confirmarPrioridade(pedido, null);
    }
  };

  // Helper resiliente com retry exponencial para evitar e contornar erros de Rate Limit da API
  const executarComRetryRateLimit = async (fn, maxTentativas = 4, delayBase = 350) => {
    let ultimoErro = null;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        return await fn();
      } catch (err) {
        ultimoErro = err;
        const msg = String(err?.message || "").toLowerCase();
        const isRateLimit =
          err?.status === 429 ||
          err?.statusCode === 429 ||
          msg.includes("rate limit") ||
          msg.includes("too many");

        if (isRateLimit && tentativa < maxTentativas) {
          const waitMs = delayBase * Math.pow(2, tentativa - 1) + Math.floor(Math.random() * 150);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }
    throw ultimoErro;
  };

  const confirmarPrioridade = async (pedido, nivel) => {
    const ativa = Boolean(nivel);
    const isRota = nivel === "ROTA";
    const nivelVal = isRota ? "ROTA" : (nivel ? Number(nivel) : null);
    const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
    const descr = isRota
      ? "OF marcada como 🚚 Pedido de Rota."
      : ativa
      ? `OF marcada como Prioridade P${nivelVal} (1 a 5 - sendo 1 mais urgente).`
      : "Prioridade removida.";

    const novoLog = [...logExistente, {
      data: new Date().toISOString(),
      usuario: "PCP",
      acao: ativa ? (isRota ? "prioridade_rota" : `prioridade_p${nivelVal}`) : "prioridade_removida",
      detalhes: descr
    }];

    // 1. Atualização Otimista Imediata no Cache do React Query
    const snapshotAnterior = queryClient.getQueryData(["pedidos-odoo-pcp"]);
    queryClient.setQueryData(["pedidos-odoo-pcp"], (antigos = []) => {
      return antigos.map((p) => {
        if (p.id === pedido.id) {
          return {
            ...p,
            prioridade: ativa,
            prioridade_nivel: nivelVal,
            is_rota: isRota,
            historico_log: JSON.stringify(novoLog)
          };
        }
        return p;
      });
    });

    try {
      // 2. Persiste a alteração no PedidoOdoo com proteção contra Rate Limit
      await executarComRetryRateLimit(() =>
        base44.entities.PedidoOdoo.update(pedido.id, {
          prioridade: ativa,
          prioridade_nivel: nivelVal,
          is_rota: isRota,
          historico_log: JSON.stringify(novoLog)
        })
      );

      // 3. Propaga para as ordens ativas vinculadas daquela OF caso já existam nas máquinas
      if (pedido.numero_pedido) {
        try {
          await executarComRetryRateLimit(() =>
            base44.entities.Pedido.updateMany(
              { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
              { $set: { prioridade: ativa, prioridade_nivel: nivelVal, is_rota: isRota } }
            )
          ).catch(() => {});
        } catch (_) {}

        try {
          await executarComRetryRateLimit(() =>
            base44.entities.OrdemMaquinaCD.updateMany(
              { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
              { $set: { prioridade: ativa, prioridade_nivel: nivelVal, is_rota: isRota } }
            )
          ).catch(() => {});
        } catch (_) {}
      }

      toast({
        title: isRota ? "🚚 Pedido de Rota Definido" : ativa ? `Prioridade P${nivelVal} Definida` : "Prioridade Removida",
        description: `#${pedido.numero_pedido} ${isRota ? "marcado como rota de entrega" : ativa ? `marcado com Prioridade P${nivelVal}` : "voltou para fila normal"}.`,
        className: isRota ? "border-indigo-500/40" : ativa ? "border-amber-500/40" : "border-slate-400/40"
      });
    } catch (e) {
      // Reverte em caso de falha irreversível
      if (snapshotAnterior) {
        queryClient.setQueryData(["pedidos-odoo-pcp"], snapshotAnterior);
      }
      toast({ title: "Erro ao alterar prioridade", description: e.message, variant: "destructive" });
    }
  };

  // DEFINIR PRIORIDADE PARA O PEDIDO TODO (Propaga para todas as OFs do grupo)
  const handleSetPrioridadeGrupo = (grupo, nivel) => {
    if (nivel === 1 || nivel === 2 || nivel === "1" || nivel === "2") {
      setPedidoPrioridadePendente({ grupo, nivel: Number(nivel), isGrupo: true });
      setSenhaGestorOpen(true);
    } else {
      confirmarPrioridadeGrupo(grupo, nivel);
    }
  };

  const confirmarPrioridadeGrupo = async (grupo, nivel) => {
    const ofs = grupo.ofs || [];
    const ativa = Boolean(nivel);
    const isRota = nivel === "ROTA";
    const nivelVal = isRota ? "ROTA" : (nivel ? Number(nivel) : null);
    const descr = isRota
      ? `Todo o Pedido #${grupo.numero_pedido} marcado como 🚚 Pedido de Rota.`
      : ativa
      ? `Todo o Pedido #${grupo.numero_pedido} marcado como Prioridade P${nivelVal}.`
      : `Prioridade removida de todo o Pedido #${grupo.numero_pedido}.`;

    const ofIdsSet = new Set(ofs.map((o) => o.id));

    // 1. Atualização Otimista Imediata no Cache do React Query
    const snapshotAnterior = queryClient.getQueryData(["pedidos-odoo-pcp"]);
    queryClient.setQueryData(["pedidos-odoo-pcp"], (antigos = []) => {
      return antigos.map((p) => {
        if (ofIdsSet.has(p.id)) {
          const logExistente = (() => { try { return JSON.parse(p.historico_log || "[]"); } catch { return []; } })();
          const novoLog = [...logExistente, {
            data: new Date().toISOString(),
            usuario: "PCP",
            acao: ativa ? (isRota ? "prioridade_grupo_rota" : `prioridade_grupo_p${nivelVal}`) : "prioridade_grupo_removida",
            detalhes: descr
          }];
          return {
            ...p,
            prioridade: ativa,
            prioridade_nivel: nivelVal,
            is_rota: isRota,
            historico_log: JSON.stringify(novoLog)
          };
        }
        return p;
      });
    });

    try {
      // 2. Atualiza cada OF sequencialmente com pequeno intervalo (120ms) e retry contra Rate Limit
      for (let i = 0; i < ofs.length; i++) {
        const ofItem = ofs[i];
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 120));
        }

        const logExistente = (() => { try { return JSON.parse(ofItem.historico_log || "[]"); } catch { return []; } })();
        const novoLog = [...logExistente, {
          data: new Date().toISOString(),
          usuario: "PCP",
          acao: ativa ? (isRota ? "prioridade_grupo_rota" : `prioridade_grupo_p${nivelVal}`) : "prioridade_grupo_removida",
          detalhes: descr
        }];

        await executarComRetryRateLimit(() =>
          base44.entities.PedidoOdoo.update(ofItem.id, {
            prioridade: ativa,
            prioridade_nivel: nivelVal,
            is_rota: isRota,
            historico_log: JSON.stringify(novoLog)
          })
        );
      }

      // 3. Propaga para as máquinas (perfiladeiras e Corte & Dobra) de forma blindada
      if (grupo.numero_pedido) {
        try {
          await executarComRetryRateLimit(() =>
            base44.entities.Pedido.updateMany(
              { numero_pedido: grupo.numero_pedido, status: { $ne: "cancelado" } },
              { $set: { prioridade: ativa, prioridade_nivel: nivelVal, is_rota: isRota } }
            )
          ).catch(() => {});
        } catch (_) {}

        try {
          await executarComRetryRateLimit(() =>
            base44.entities.OrdemMaquinaCD.updateMany(
              { numero_pedido: grupo.numero_pedido, status: { $ne: "cancelado" } },
              { $set: { prioridade: ativa, prioridade_nivel: nivelVal, is_rota: isRota } }
            )
          ).catch(() => {});
        } catch (_) {}
      }

      toast({
        title: isRota ? "🚚 Pedido de Rota Definido" : ativa ? `Prioridade P${nivelVal} no Pedido Todo` : "Prioridade Removida",
        description: `Todas as ${ofs.length} OFs do Pedido #${grupo.numero_pedido} foram atualizadas com sucesso!`,
        className: isRota ? "border-indigo-500/40" : ativa ? "border-amber-500/40" : "border-slate-400/40"
      });
    } catch (e) {
      // Reverte cache se deu erro após todas as tentativas
      if (snapshotAnterior) {
        queryClient.setQueryData(["pedidos-odoo-pcp"], snapshotAnterior);
      }
      toast({ title: "Erro ao alterar prioridade do pedido", description: e.message, variant: "destructive" });
    }
  };

  const handleDistribuir = async (pedido) => {
    setDistribuindo(true);
    try {
      const autoTelhasAtivo = isAutoRoteamentoTelhasAtivo();
      let telhasAutoRoteadas = 0;
      let bobinasVinculadas = 0;

      const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP",
        acao: autoTelhasAtivo ? "distribuicao_automatica_telhas_bobina" : "distribuicao_automatica",
        detalhes: autoTelhasAtivo
          ? "Pedido distribuído com Piloto Automático de Telhas (encaminhado direto às perfiladeiras com bobina selecionada pelo Odoo)."
          : "Pedido distribuído automaticamente para os galpões (Telhas→Barracão Telhas, C&D→Barracão C&D, Frisada→Expedição)."
      }];

      const itens = parseItensPedido(pedido.itens_json);
      const telhas = itensPorGrupo(itens, "telha");

      // SE PILOTO AUTOMÁTICO DE TELHAS ESTIVER ATIVO:
      // Agrupa automaticamente itens idênticos (mesma máquina, modelo, espessura e cor)
      // em 1 ÚNICA OP na máquina com múltiplos cortes consolidados!
      // ITENS DE CORTE E DOBRA NÃO SÃO TOCADOS (permanecem no fluxo anterior)!
      if (autoTelhasAtivo && telhas.length > 0) {
        const telhasParaRoteamento = itens
          .map((it, idx) => ({ ...it, _idx: idx }))
          .filter((it, idx) => {
            const ehTelha = telhas.some(t => (t._idx != null ? t._idx === idx : t.produto === it.produto));
            return ehTelha && it.status !== "concluido";
          });

        if (telhasParaRoteamento.length > 0) {
          try {
            const resAgrupado = await rotearLoteTelhasAgrupadas({
              pedido,
              itensTelhas: telhasParaRoteamento,
              todasBobinas: bobinasEstoque,
              filialAtiva: pedido.unidade || filialAtiva
            });

            telhasAutoRoteadas = telhasParaRoteamento.length;
            bobinasVinculadas = resAgrupado.opsCriadas.filter(op => op.bobina_superior_id).length;

            Object.entries(resAgrupado.itensAtualizadosMap || {}).forEach(([idxStr, dadosItem]) => {
              const i = Number(idxStr);
              if (itens[i]) {
                itens[i] = {
                  ...itens[i],
                  ...dadosItem
                };
              }
            });
          } catch (errAuto) {
            console.warn("[CentralPCP] Falha no roteamento agrupado de telhas:", errAuto);
          }
        }
      }

      // Distribui os demais itens (C&D continua intacto)
      const itensDistribuidos = itens.map(it => ({
        ...it,
        status: it.status === "concluido" ? "concluido" : (it.status === "em_producao" ? "em_producao" : "distribuido"),
        distribuido: true
      }));

      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: JSON.stringify(itensDistribuidos),
        status_pcp: "distribuido",
        percentual_concluido: 15,
        historico_log: JSON.stringify(novoLog)
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-pcp"] });
      setPedidoSelecionado({ ...pedido, ...atualizado });
      setDistribuindo(false);

      if (autoTelhasAtivo && telhasAutoRoteadas > 0) {
        toast({
          title: "⚡ Telhas Roteadas Direto p/ Máquinas!",
          description: `#${pedido.numero_pedido}: ${telhasAutoRoteadas} telha(s) nas perfiladeiras (${bobinasVinculadas} com bobina vinculada pelo Odoo). C&D na fila normal.`,
          className: "border-amber-500/40"
        });
      } else {
        toast({
          title: "Pedido distribuído!",
          description: `#${pedido.numero_pedido} enviado para os galpões.`,
          className: "border-blue-500/40"
        });
      }
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
      const autoTelhasAtivo = isAutoRoteamentoTelhasAtivo();
      let sucesso = 0;
      let telhasCount = 0;

      for (const ped of pedidosADistribuir) {
        try {
          const itens = parseItensPedido(ped.itens_json);
          const telhas = itensPorGrupo(itens, "telha");

          if (autoTelhasAtivo && telhas.length > 0) {
            const telhasParaRoteamento = itens
              .map((it, idx) => ({ ...it, _idx: idx }))
              .filter((it, idx) => {
                const ehTelha = telhas.some(t => (t._idx != null ? t._idx === idx : t.produto === it.produto));
                return ehTelha && it.status !== "concluido";
              });

            if (telhasParaRoteamento.length > 0) {
              try {
                const resAgrupado = await rotearLoteTelhasAgrupadas({
                  pedido: ped,
                  itensTelhas: telhasParaRoteamento,
                  todasBobinas: bobinasEstoque,
                  filialAtiva: ped.unidade || filialAtiva
                });

                telhasCount += telhasParaRoteamento.length;

                Object.entries(resAgrupado.itensAtualizadosMap || {}).forEach(([idxStr, dadosItem]) => {
                  const i = Number(idxStr);
                  if (itens[i]) {
                    itens[i] = {
                      ...itens[i],
                      ...dadosItem
                    };
                  }
                });
              } catch (errAuto) {
                console.warn("[CentralPCP Lote] Falha no auto-roteamento de telha:", errAuto);
              }
            }
          }

          const itensDistribuidos = itens.map(it => ({
            ...it,
            status: it.status === "concluido" ? "concluido" : (it.status === "em_producao" ? "em_producao" : "distribuido"),
            distribuido: true
          }));

          const logExistente = (() => { try { return JSON.parse(ped.historico_log || "[]"); } catch { return []; } })();
          const novoLog = [...logExistente, {
            data: new Date().toISOString(),
            usuario: "PCP",
            acao: "distribuicao_lote",
            detalhes: autoTelhasAtivo
              ? "Pedido distribuído em lote com Piloto Automático de Telhas direto para as perfiladeiras."
              : "Pedido distribuído em lote para os galpões de produção (Telhas, C&D e Frisada)."
          }];

          const atualizado = await base44.entities.PedidoOdoo.update(ped.id, {
            itens_json: JSON.stringify(itensDistribuidos),
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
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-pcp"] });
      setSelecionados(new Set());
      setDistribuindo(false);
      toast({
        title: `🚀 ${sucesso} pedidos distribuídos!`,
        description: autoTelhasAtivo && telhasCount > 0
          ? `${sucesso} pedido(s) distribuído(s) — ${telhasCount} item(ns) de telhas enviados direto às máquinas com bobina automática. C&D na fila normal.`
          : `Todas as ordens selecionadas foram encaminhadas simultaneamente para as filas dos galpões.`,
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

      // Se este item específico está sendo distribuído, garante que outros itens sem marcação
      // fiquem com distribuido: false, para não irem juntos para o galpão prematuramente
      if (distribuir) {
        itens.forEach((it, i) => {
          if (i !== idx && it.distribuido === undefined) {
            it.distribuido = false;
          }
        });
      }

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

  // Contadores de pedidos ativos por Loja / Filial
  const statsLoja = useMemo(() => {
    const contagens = {
      todas: pedidos.filter(p => !isPedidoConcluido(p)).length,
      "Matriz AJL": 0,
      "Pinhais": 0,
      "Ivaiporã": 0,
      "Ponta Grossa": 0,
    };
    pedidos.forEach(p => {
      if (isPedidoConcluido(p)) return;
      const un = p.unidade || "Matriz AJL";
      if (contagens[un] !== undefined) {
        contagens[un]++;
      } else {
        contagens["Matriz AJL"]++;
      }
    });
    return contagens;
  }, [pedidos, pedidosProducao, ordensCD]);

  // Pedidos pertencentes à Central PCP selecionada (ou todos se 'todas')
  const pedidosDaLoja = useMemo(() => {
    if (lojaSelecionada === "todas") return pedidos;
    return pedidos.filter(p => (p.unidade || "Matriz AJL") === lojaSelecionada);
  }, [pedidos, lojaSelecionada]);

  // Diagnóstico em tempo real do chão de fábrica para cada pedido
  const mapaExecucaoPorId = useMemo(() => {
    const map = new Map();
    pedidosDaLoja.forEach(p => {
      map.set(p.id, obterStatusExecucaoPedido(p, pedidosProducao, ordensCD));
    });
    return map;
  }, [pedidosDaLoja, pedidosProducao, ordensCD]);

  const stats = useMemo(() => {
    let ativos = 0;
    let pendentes = 0;
    let distribuidos = 0;
    let produzindoAgora = 0;
    let aguardandoMaquina = 0;
    let concluidos = 0;
    let atrasados = 0;

    pedidosDaLoja.forEach(p => {
      const conc = isPedidoConcluido(p);
      const diag = mapaExecucaoPorId.get(p.id);

      if (conc) {
        concluidos++;
      } else {
        ativos++;
        if (p.status_pcp === "pendente_distribuicao") pendentes++;
        if (p.status_pcp === "distribuido") distribuidos++;
        if (diag?.produzindoAgora) produzindoAgora++;
        if (diag?.aguardandoInicio) aguardandoMaquina++;
        if (diasUteisRestantes(p.data_entrega) < 0) atrasados++;
      }
    });

    return {
      total: pedidosDaLoja.length,
      ativos,
      pendentes,
      distribuidos,
      produzindo_agora: produzindoAgora,
      aguardando_maquina: aguardandoMaquina,
      concluidos,
      atrasados
    };
  }, [pedidosDaLoja, mapaExecucaoPorId]);

  const FILTROS = [
    { id: "ativos", label: "Fila Ativa", count: stats.ativos, icon: Zap, color: "text-orange-500" },
    { id: "produzindo_agora", label: "⚡ Produzindo Agora", count: stats.produzindo_agora, icon: Zap, color: "text-blue-500" },
    { id: "aguardando_maquina", label: "⏳ Na Máquina", count: stats.aguardando_maquina, icon: Clock, color: "text-amber-500" },
    { id: "pendente_distribuicao", label: "Pendentes PCP", count: stats.pendentes, icon: AlertTriangle, color: "text-amber-500" },
    { id: "distribuido", label: "Distribuídos", count: stats.distribuidos, icon: Factory, color: "text-indigo-500" },
    { id: "concluido", label: "Concluídos", count: stats.concluidos, icon: CheckCircle2, color: "text-emerald-500" },
    { id: "todos", label: "Todos", count: stats.total, icon: Layers, color: "text-slate-500" }
  ];

  // Estatísticas de Matéria-Prima em Tempo Real (Bobinas e Chapas)
  const statsMaterial = useMemo(() => {
    let comMaterial = 0;
    let semMaterial = 0;
    pedidosDaLoja.forEach(p => {
      const diag = verificarEstoquePedido(p, estoqueContext);
      if (diag.statusGeral === "ok" || diag.statusGeral === "desbobinar") {
        comMaterial++;
      } else {
        semMaterial++;
      }
    });
    return { comMaterial, semMaterial };
  }, [pedidosDaLoja, estoqueContext]);

  // Filtros + busca
  const pedidosFiltrados = pedidosDaLoja.filter(p => {
    const concluido = isPedidoConcluido(p);
    const diag = mapaExecucaoPorId.get(p.id);

    if (filtro === "ativos") {
      if (concluido) return false;
    } else if (filtro === "concluido") {
      if (!concluido) return false;
    } else if (filtro === "produzindo_agora") {
      if (concluido || !diag?.produzindoAgora) return false;
    } else if (filtro === "aguardando_maquina") {
      if (concluido || !diag?.aguardandoInicio) return false;
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

    if (!busca || !busca.trim()) return true;
    const q = busca.toLowerCase().trim();

    if (tipoBusca === "cliente") {
      return String(p.cliente_nome || "").toLowerCase().includes(q);
    }

    if (tipoBusca === "vendedor") {
      return String(p.vendedor_nome || "").toLowerCase().includes(q);
    }

    if (tipoBusca === "numero_pedido") {
      return (
        String(p.numero_pedido || "").toLowerCase().includes(q) ||
        String(p.numero_oc || "").toLowerCase().includes(q) ||
        String(p.of_nome || "").toLowerCase().includes(q) ||
        String(p.of_odoo_id || "").toLowerCase().includes(q) ||
        String(p.odoo_id || "").toLowerCase().includes(q)
      );
    }

    const itensTexto = (() => {
      try {
        const arr = typeof p.itens_json === "string" ? JSON.parse(p.itens_json || "[]") : (p.itens || []);
        return arr.map(i => `${i.produto || ""} ${i.descricao || ""} ${i.modelo || ""} ${i.tipo || ""} ${i.maquina || ""}`).join(" ");
      } catch { return ""; }
    })();

    if (tipoBusca === "modelo") {
      return (
        String(p.descricao || "").toLowerCase().includes(q) ||
        String(p.identificacao_1 || "").toLowerCase().includes(q) ||
        String(p.identificacao_2 || "").toLowerCase().includes(q) ||
        itensTexto.toLowerCase().includes(q)
      );
    }

    // tipoBusca === "todos"
    return (
      String(p.numero_pedido || "").toLowerCase().includes(q) ||
      String(p.numero_oc || "").toLowerCase().includes(q) ||
      String(p.of_nome || "").toLowerCase().includes(q) ||
      String(p.of_odoo_id || "").toLowerCase().includes(q) ||
      String(p.odoo_id || "").toLowerCase().includes(q) ||
      String(p.identificacao_1 || "").toLowerCase().includes(q) ||
      String(p.identificacao_2 || "").toLowerCase().includes(q) ||
      String(p.descricao || "").toLowerCase().includes(q) ||
      String(p.cliente_nome || "").toLowerCase().includes(q) ||
      String(p.vendedor_nome || "").toLowerCase().includes(q) ||
      itensTexto.toLowerCase().includes(q)
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
          numero_oc: p.numero_oc || "",
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
      if (!g.numero_oc && p.numero_oc) {
        g.numero_oc = p.numero_oc;
      }
      const ofKey = p.of_nome || p.of_odoo_id || p.id;
      const jaExiste = g.ofs.some(o => (o.of_nome || o.of_odoo_id || o.id) === ofKey);
      if (!jaExiste) {
        g.ofs.push(p);
      }
      if (p.prioridade) {
        g.prioridade = true;
      }
      if (p.prioridade_nivel) {
        if (!g.prioridade_nivel || getPesoOrdenacaoPrioridade(p) < getPesoOrdenacaoPrioridade(g)) {
          g.prioridade_nivel = p.prioridade_nivel;
        }
      }
      if (p.is_rota || p.prioridade_nivel === "ROTA") {
        g.is_rota = true;
        if (!g.prioridade_nivel || getPesoOrdenacaoPrioridade(g) > 0.5) {
          g.prioridade_nivel = "ROTA";
        }
      }
      if (!g.cliente_nome || g.cliente_nome === "—") g.cliente_nome = p.cliente_nome;
      if (!g.vendedor_nome || g.vendedor_nome === "—") g.vendedor_nome = p.vendedor_nome;
      if (!g.data_entrega) g.data_entrega = p.data_entrega;
    });
    return Array.from(map.values()).sort((a, b) => {
      const priDiff = getPesoOrdenacaoPrioridade(a) - getPesoOrdenacaoPrioridade(b);
      if (priDiff !== 0) return priDiff;
      const da = new Date(a.ofs[0]?.data_recebimento || 0).getTime();
      const db = new Date(b.ofs[0]?.data_recebimento || 0).getTime();
      return da - db;
    });
  }, [pedidosFiltrados, pedidosAtivosEmTodos, filtro]);

  const gruposConcluidosEmTodos = useMemo(() => {
    if (filtro !== "todos") return [];
    const map = new Map();
    pedidosConcluidosEmTodos.forEach(p => {
      const num = p.numero_pedido || `AVULSO_${p.id}`;
      if (!map.has(num)) {
        map.set(num, {
          numero_pedido: p.numero_pedido || "Sem Número",
          numero_oc: p.numero_oc || "",
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
      if (!g.numero_oc && p.numero_oc) {
        g.numero_oc = p.numero_oc;
      }
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

      if (!isOperador) {
        toast({
          title: `🗑️ ${excluidos} ordem(ns) de fabricação excluída(s)`,
          description: erros > 0
            ? `${excluidos} excluídas com sucesso. ${erros} falharam.`
            : `As ordens foram removidas com sucesso da Central PCP e dos galpões.`,
          className: "border-red-500/40"
        });
      }
    } catch (e) {
      if (!isOperador) {
        toast({
          title: "Erro ao excluir ordens",
          description: e.message,
          variant: "destructive"
        });
      }
    } finally {
      setExcluindo(false);
      setModalExclusao({ aberto: false, pedidos: [], titulo: "", descricao: "", notificarOdoo: true });
    }
  };

  const tipoBuscaAtual = TIPOS_BUSCA.find(t => t.id === tipoBusca) || TIPOS_BUSCA[0];
  const IconeTipoBusca = tipoBuscaAtual.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
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
                Aba Mãe · Integração Odoo ERP · Roteamento Industrial por Loja
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Indicador de Sincronização em Tempo Real */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Sincronizado {segundosDesdeSync === 0 ? "agora" : `há ${segundosDesdeSync}s`}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefetchComFeedback}
              disabled={carregando}
              className="h-8 gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Forçar atualização e sincronização imediata com o Odoo ERP"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? "animate-spin text-orange-500" : "text-emerald-600"}`} />
              <span className="hidden md:inline">Sincronizar</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRecuperarModalOpen(true)}
              className="h-8 gap-1.5 text-xs font-bold text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/40"
              title="Localizar pedido ou OF que sumiu ou verificar status no banco"
            >
              <Search className="w-3.5 h-3.5 text-orange-500" />
              <span>Recuperar Pedido</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAuditarModalOpen(true)}
              className="h-8 gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              title="Auditar OPs no chão de fábrica e restaurar modelos e bobinas corrompidos"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Auditar & Restaurar OPs</span>
              <span className="md:hidden">Auditar</span>
            </Button>

            <Button
              onClick={() => setWebhookOpen(true)}
              size="sm"
              className="h-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold"
            >
              <Radio className="w-3.5 h-3.5 mr-1" />
              <span className="hidden lg:inline">Receber / Simular Webhook Odoo</span>
              <span className="lg:hidden">Webhook</span>
            </Button>
          </div>
        </div>

        {/* Barra de Seleção de Central PCP por Loja / Filial */}
        <div className="px-4 sm:px-6 py-2 bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-1.5 mr-1">
              <Building2 className="w-3.5 h-3.5 text-orange-500" />
              Central PCP:
            </span>

            {/* Aba Todas as Centrais (Apenas se tiver acesso global a mais de 1 filial) */}
            {temAcessoGlobalCentrais && (
              <button
                type="button"
                onClick={() => handleMudarLoja("todas")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  lojaSelecionada === "todas"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Todas as Centrais</span>
                <Badge className={`text-[10px] px-1.5 py-0 leading-tight ${
                  lojaSelecionada === "todas"
                    ? "bg-white/25 dark:bg-slate-900/30 text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}>
                  {statsLoja.todas}
                </Badge>
              </button>
            )}

            {/* Abas das Filiais Autorizadas */}
            {filiaisPcpExibidas.map((f) => {
              const count = statsLoja[f.id] || 0;
              const ativa = lojaSelecionada === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleMudarLoja(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    ativa
                      ? "bg-orange-500 text-white shadow-sm ring-1 ring-orange-400"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80"
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    ativa
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <span className="text-[11px] text-slate-400">Exibindo Fila de:</span>
            <Badge variant="outline" className="text-xs font-bold border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400">
              {lojaSelecionada === "todas" ? "Visão Global (Todas as Fábricas)" : `Fábrica: ${lojaSelecionada}`}
            </Badge>
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
      <div className="px-4 sm:px-6 pb-3 flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/30 focus-within:border-orange-500 transition-all">
              {/* Dropdown Seletor do Tipo de Busca */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-l-lg transition-colors shrink-0"
                    title="Alternar tipo de filtro"
                  >
                    <IconeTipoBusca className="w-3.5 h-3.5 text-orange-500" />
                    <span className="hidden sm:inline font-bold">{tipoBuscaAtual.label}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-1">
                  <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Filtrar Busca Por
                  </div>
                  {TIPOS_BUSCA.map((t) => {
                    const ItemIcon = t.icon;
                    const isSelected = tipoBusca === t.id;
                    return (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => setTipoBusca(t.id)}
                        className={`flex items-center gap-2 cursor-pointer text-xs rounded-md py-1.5 px-2 font-medium ${
                          isSelected
                            ? "bg-orange-500 text-white font-bold hover:bg-orange-600 focus:bg-orange-600 focus:text-white"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <ItemIcon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-slate-400"}`} />
                        <span className="flex-1">{t.label}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Input de Pesquisa */}
              <input
                type="text"
                placeholder={tipoBuscaAtual.placeholder}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none min-w-0"
              />

              {/* Botão X para Limpar Busca */}
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="p-1 mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Chips Rápidos para Modelo do Material */}
            {tipoBusca === "modelo" && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 shrink-0">Modelos Rápidos:</span>
                {MODELOS_RAPIDOS.map((mod) => {
                  const ativo = busca.toLowerCase().trim() === mod.toLowerCase().trim();
                  return (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => setBusca(ativo ? "" : mod)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                        ativo
                          ? "bg-orange-500 text-white shadow-xs"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {mod}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar self-start">
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

                {/* Transferir Selecionados de Central PCP / Filial */}
                {selecionados.size > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={distribuindo || excluindo}
                    onClick={() => {
                      const lista = pedidos.filter(p => selecionados.has(p.id));
                      setModalTransferir({ aberto: true, pedidos: lista });
                    }}
                    className="border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs h-8 gap-1.5 font-bold"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                    Transferir Loja ({selecionados.size})
                  </Button>
                )}

                {/* Sincronizar Selecionadas com o Odoo */}
                {selecionados.size > 0 && (
                  <Button
                    size="sm"
                    disabled={sincronizandoOdoo || distribuindo || excluindo}
                    onClick={() => {
                      const lista = pedidos.filter(p => selecionados.has(p.id));
                      handleSincronizarLoteOdoo(lista);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 shadow-sm font-bold"
                    title="Enviar e sincronizar status de todas as ordens selecionadas com o Odoo ERP"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoOdoo ? "animate-spin" : ""}`} />
                    {sincronizandoOdoo ? "Sincronizando..." : `Sincronizar Odoo (${selecionados.size})`}
                  </Button>
                )}

                {/* Sincronizar TODOS os Concluídos da lista com o Odoo */}
                {filtro === "concluido" && selecionados.size === 0 && pedidosFiltrados.length > 0 && (
                  <Button
                    size="sm"
                    disabled={sincronizandoOdoo || distribuindo || excluindo}
                    onClick={() => handleSincronizarLoteOdoo(pedidosFiltrados)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 shadow-sm font-bold"
                    title="Enviar todas as ordens desta lista para o Odoo ERP como Finalizado/Concluído"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoOdoo ? "animate-spin" : ""}`} />
                    {sincronizandoOdoo ? "Sincronizando..." : `Sincronizar Todos com Odoo (${pedidosFiltrados.length})`}
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
                    onSetPrioridadeGrupo={handleSetPrioridadeGrupo}
                    onTransferir={(p) => setModalTransferir({ aberto: true, pedidos: [p] })}
                    onTransferirGrupo={(g) => setModalTransferir({ aberto: true, pedidos: g.ofs || [] })}
                    onFinalizarGrupo100={(lista) => handleSolicitarFinalizar100(lista)}
                    onSincronizarGrupoOdoo={(lista) => handleSincronizarLoteOdoo(lista)}
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
                    onTransferir={(ped) => setModalTransferir({ aberto: true, pedidos: [ped] })}
                    onFinalizar100={(ped) => handleSolicitarFinalizar100([ped])}
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
                          onSetPrioridadeGrupo={handleSetPrioridadeGrupo}
                          onTransferir={(p) => setModalTransferir({ aberto: true, pedidos: [p] })}
                          onTransferirGrupo={(g) => setModalTransferir({ aberto: true, pedidos: g.ofs || [] })}
                          onFinalizarGrupo100={(lista) => handleSolicitarFinalizar100(lista)}
                          onSincronizarGrupoOdoo={(lista) => handleSincronizarLoteOdoo(lista)}
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
                          onTransferir={(ped) => setModalTransferir({ aberto: true, pedidos: [ped] })}
                          onFinalizar100={(ped) => handleSolicitarFinalizar100([ped])}
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
        onTransferir={(p) => setModalTransferir({ aberto: true, pedidos: [p] })}
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
            if (pedidoPrioridadePendente.isGrupo) {
              confirmarPrioridadeGrupo(pedidoPrioridadePendente.grupo, pedidoPrioridadePendente.nivel ?? 1);
            } else {
              confirmarPrioridade(pedidoPrioridadePendente.pedido, pedidoPrioridadePendente.nivel ?? 1);
            }
            setPedidoPrioridadePendente(null);
          }
        }}
        />
        <SenhaGestorDialog
        open={senhaFinalizarOpen}
        onOpenChange={setSenhaFinalizarOpen}
        titulo="Finalizar Pedido em 100%"
        descricao="Para marcar este(s) pedido(s) como 100% concluído(s) imediatamente, digite o PIN de liberação do Gestor."
        aviso="Finalizar 100% exige autorização do Gestor."
        onAutorizado={confirmarFinalizar100}
        />
      <WebhookSimulatorDialog
        open={webhookOpen}
        onOpenChange={setWebhookOpen}
        onReceber={handleReceberWebhook}
      />
      <RecuperarPedidoOdooDialog
        open={recuperarModalOpen}
        onOpenChange={setRecuperarModalOpen}
        onSucesso={() => {
          refetch();
        }}
        onAbrirSimuladorWebhook={(numero) => {
          setWebhookOpen(true);
        }}
      />
      <AuditarRestaurarOpsDialog
        open={auditarModalOpen}
        onOpenChange={setAuditarModalOpen}
        onSucesso={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
          queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"] });
        }}
      />
      <TransferirLojaDialog
        open={modalTransferir.aberto}
        onOpenChange={(aberto) => setModalTransferir(prev => ({ ...prev, aberto }))}
        pedidos={modalTransferir.pedidos}
        onSuccess={() => {
          setSelecionados(new Set());
          setPedidoSelecionado(null);
          setDetalheOpen(false);
        }}
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