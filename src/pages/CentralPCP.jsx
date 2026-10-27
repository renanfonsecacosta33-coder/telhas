import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Inbox, Radio, Search, ArrowLeft, RefreshCw, Zap, Send, Factory, Layers, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Calendar, X, Clock, Trash2, Building2, ArrowRightLeft, Globe, User, Briefcase, Hash, Package, ShieldCheck, Target, BookOpen, RotateCcw, History, Activity } from "lucide-react";
import { executarExclusaoOsBackground } from "@/lib/excluirOsHelper"; import { sincronizarLoteOdoo } from "@/lib/sincronizarOdooHelper";
import { finalizarOpsDoPedido, cancelarOpsDoPedido, executarVarreduraEConciliacaoGeral, cancelarOpsDasOfsExatas, comRetryLimite } from "@/lib/conciliacaoPcpMaquinasHelper";
import RelatorioAuditoriaDiariaModal from "@/components/pcp/RelatorioAuditoriaDiariaModal";
import HistoricoExclusoesModal from "@/components/pcp/HistoricoExclusoesModal";
import CentralSaudeSistemaModal from "@/components/pcp/CentralSaudeSistemaModal";
import { registrarHistoricoExclusao, obterHistoricoExclusoes } from "@/lib/historicoExclusoesHelper";
import { executarAuditoriaDiariaCompleta, obterUltimoRelatorioAuditoria } from "@/lib/auditoriaDiariaHelper";
import BotaoDevolverLotePCP from "@/components/pcp/BotaoDevolverLotePCP";
import PainelFiltrosPCP from "@/components/pcp/PainelFiltrosPCP";
import PcpHeroTools from "@/components/pcp/PcpHeroTools";
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
import { Textarea } from "@/components/ui/textarea";
import PedidoOdooCard from "@/components/pcp/PedidoOdooCard";
import PedidoOdooGrupoCard from "@/components/pcp/PedidoOdooGrupoCard";
import PedidoOdooDetalheDialog from "@/components/pcp/PedidoOdooDetalheDialog";
import WebhookSimulatorDialog from "@/components/pcp/WebhookSimulatorDialog";
import RecuperarPedidoOdooDialog from "@/components/pcp/RecuperarPedidoOdooDialog";
import AuditarRestaurarOpsDialog from "@/components/pcp/AuditarRestaurarOpsDialog";
import GuiaOperacionalModal from "@/components/pops/GuiaOperacionalModal";
import { executarReparoBobininhasBanco } from "@/lib/repararBobininhasHelper";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";
import TransferirLojaDialog from "@/components/pcp/TransferirLojaDialog";
import ViewModeToggle from "@/components/ui/ViewModeToggle";
import FilaPCPTabelaView from "@/components/pcp/FilaPCPTabelaView";
import FilaPCPKanbanView from "@/components/pcp/FilaPCPKanbanView";
import HistoricoPedidoSidebar from "@/components/corte-dobra/HistoricoPedidoSidebar";
import { salvarCacheLocal, obterCacheLocal } from "@/lib/offlineStorage";
import { useFilial } from "@/contexts/FilialContext";
import { useOffline } from "@/contexts/OfflineContext";
import { FILIAIS_PCP } from "@/lib/roteamentoPCP";
import { calcularDataPrometidaSLA, toISODate, slaDiasPorCategoria, diasUteisRestantes, formatDataBR } from "@/lib/sla";
import { parseItensPedido } from "@/lib/regrasFabrica";
import { notificarStatus } from "@/lib/biNotificador";
import {
  calcularProgressoRealPedido, statusPcpPorPercentual, enriquecerItensComStatusReal,
  obterStatusExecucaoPedido, classGrupo
} from "@/lib/pedidoOdooHelper";
import useDistribuicaoPcp from "@/hooks/useDistribuicaoPcp";
import { getPesoOrdenacaoPrioridade } from "@/lib/prioridadeHelper";
import { verificarEstoquePedido } from "@/lib/estoqueMaterialHelper";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";

const BadgeTempoSync = React.memo(function BadgeTempoSync({ dataUpdatedAt }) {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      if (dataUpdatedAt) {
        setSegundos(Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000)));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt]);

  return <span>Sincronizado {segundos === 0 ? "agora" : "há " + segundos + "s"}</span>;
});

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
  const [buscaDebounced, setBuscaDebounced] = useState("");

  // Debounce ultra-fluido de 180ms para eliminar qualquer travamento ao digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca);
    }, 180);
    return () => clearTimeout(timer);
  }, [busca]);

  const handleLimparBusca = () => {
    setBusca("");
    setBuscaDebounced("");
  };

  const handleSelecionarModeloRapido = (mod) => {
    const ativo = busca.toLowerCase().trim() === mod.toLowerCase().trim();
    const novo = ativo ? "" : mod;
    setBusca(novo);
    setBuscaDebounced(novo);
  };

  const [buscandoNoBanco, setBuscandoNoBanco] = useState(false);
  const handleBuscarNoBancoHistorico = async () => {
    const termo = (busca || "").trim();
    if (!termo) return;
    setBuscandoNoBanco(true);
    try {
      const termoLimpo = termo.replace(/^[Ss]0*/, "");
      const res = await Promise.all([
        base44.entities.PedidoOdoo.filter({ numero_pedido: termo }).catch(() => []),
        base44.entities.PedidoOdoo.filter({ numero_pedido: `S${termoLimpo.padStart(5, "0")}` }).catch(() => []),
        base44.entities.PedidoOdoo.filter({ of_nome: termo }).catch(() => []),
        base44.entities.PedidoOdoo.filter({ of_odoo_id: termo }).catch(() => []),
      ]);
      const achados = res.flat().filter(Boolean);
      if (achados.length > 0) {
        queryClient.setQueryData(["pedidos-odoo-pcp"], (prev = []) => {
          const idsExistentes = new Set(prev.map(p => p.id));
          const novos = achados.filter(p => !idsExistentes.has(p.id));
          return [...novos, ...prev];
        });
        toast({
          title: "Pedido encontrado no banco!",
          description: `${achados.length} ordem(ns) de fabricação recuperada(s) do histórico.`
        });
      } else {
        toast({
          title: "Não encontrado no histórico",
          description: `Nenhum pedido correspondente a "${termo}" foi localizado no banco de dados.`,
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({ title: "Erro na busca", description: err.message, variant: "destructive" });
    } finally {
      setBuscandoNoBanco(false);
    }
  };
  const [filtro, setFiltro] = useState("ativos");
  const [filtroMaterial, setFiltroMaterial] = useState("todos"); // "todos" | "com_material" | "sem_material"
  const [filtroSetor, setFiltroSetor] = useState("todos"); // "todos" | "telhas" | "corte_dobra" | "ambos"
  const [mostrarConcluidosEmTodos, setMostrarConcluidosEmTodos] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [recuperarModalOpen, setRecuperarModalOpen] = useState(false);
  const [auditarModalOpen, setAuditarModalOpen] = useState(false);
  const [popModalOpen, setPopModalOpen] = useState(false);
  const [popModalKey, setPopModalKey] = useState("PCP_CENTRAL");
  const [selecionados, setSelecionados] = useState(new Set());
  const [senhaGestorOpen, setSenhaGestorOpen] = useState(false);
  const [pedidoPrioridadePendente, setPedidoPrioridadePendente] = useState(null);
  const [pedidosExpandidos, setPedidosExpandidos] = useState(() => new Set());
  const [modoVisao, setModoVisao] = useState("agrupado");
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("ajl_viewmode_pcp_fila") || "cards";
    } catch {
      return "cards";
    }
  });
  const [otimizarPorBobina, setOtimizarPorBobina] = useState(false);
  const [pedidoHistoricoNumero, setPedidoHistoricoNumero] = useState(null);

  // Central PCP por Loja / Filial e Permissões de Usuário
  const filialCtx = useFilial();
  const { isOnline } = useOffline();
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
      if (percentual === 100) {
        finalizarOpsDoPedido({ pedido, usuario: "Central PCP" }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
          queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"] });
        }).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setPedidoSelecionado((prev) => prev ? { ...prev, ...atualizado } : prev);
    } catch (e) {
      toast({ title: "Erro ao atualizar item", description: e.message, variant: "destructive" });
    }
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

  // Modal de Exclusão Segura com Motivo Obrigatório e Histórico
  const [modalExclusao, setModalExclusao] = useState({
    aberto: false,
    pedidos: [],
    titulo: "",
    descricao: "",
    motivo: "",
    notificarOdoo: true
  });
  const [modalHistoricoExclusoesOpen, setModalHistoricoExclusoesOpen] = useState(false);
  const [modalSaudeOpen, setModalSaudeOpen] = useState(false);
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

  // ── BUSCA ILIMITADA BLINDADA COM CACHE LOCAL INDEXEDDB (TELA NUNCA VAZIA) ──
  const carregarPedidosOdooBlindado = async () => {
    const CHAVE_CACHE = "pedidos_odoo_pcp_cache_v2";

    // 1. Se estiver offline no navegador, resgata imediatamente do cache local do dispositivo
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const salvoOffline = await obterCacheLocal(CHAVE_CACHE);
      if (salvoOffline && Array.isArray(salvoOffline) && salvoOffline.length > 0) {
        return salvoOffline;
      }
    }

    try {
      // 2. Busca na nuvem otimizada (600 registros mais recentes - economia de 90% no tráfego de leitura)
      const dados = await base44.entities.PedidoOdoo.list("-data_recebimento", 600);
      if (dados && Array.isArray(dados) && dados.length > 0) {
        salvarCacheLocal(CHAVE_CACHE, dados).catch(() => {});
        return dados;
      }

      // Se a rede respondeu vazio inesperadamente, resgata o cache para NUNCA esvaziar a tela
      const salvoFallback = await obterCacheLocal(CHAVE_CACHE);
      if (salvoFallback && Array.isArray(salvoFallback) && salvoFallback.length > 0) {
        return salvoFallback;
      }
      return dados || [];
    } catch (errRede) {
      console.warn("[CentralPCP] Rede instável ou timeout ao buscar PedidoOdoo, resgatando cache IndexedDB:", errRede);
      const salvoLocal = await obterCacheLocal(CHAVE_CACHE);
      if (salvoLocal && Array.isArray(salvoLocal) && salvoLocal.length > 0) {
        return salvoLocal;
      }
      throw errRede;
    }
  };
  const [modalRelatorioAuditoriaOpen, setModalRelatorioAuditoriaOpen] = useState(false);
  const { data: pedidosRaw = [], isLoading: carregando, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["pedidos-odoo-pcp"],
    queryFn: carregarPedidosOdooBlindado,
    placeholderData: (previousData) => previousData, // Preserva 100% dos dados na tela durante revalidações
    staleTime: 30000,
    gcTime: 1000 * 60 * 60 * 24, // 24 horas retido em memória
    retry: 3,
    refetchInterval: (detalheOpen || modalSaudeOpen || modalExclusao.aberto || modalTransferir.aberto || modalRelatorioAuditoriaOpen) ? false : 30000,
    refetchOnWindowFocus: false
  });

  // Sincronização em tempo real (timer isolado em BadgeTempoSync para zero re-renderizações parasitas)

  // Handler e estado do Relatório de Auditoria Diária (carregamento leve e instantâneo da persistência)
  const [relatorioAuditoria, setRelatorioAuditoria] = useState(() => obterUltimoRelatorioAuditoria());
  const [executandoAuditoriaDiaria, setExecutandoAuditoriaDiaria] = useState(false);

  const [conciliandoMaquinas, setConciliandoMaquinas] = useState(false);
  const handleExecutarAuditoriaConciliacaoManual = async () => {
    setConciliandoMaquinas(true);
    try {
      const res = await executarVarreduraEConciliacaoGeral({ pedidosPcp: pedidos, queryClient, usuario: "Gestor PCP (Manual)" });
      toast({
        title: "Varredura e Conciliação Concluída!",
        description: `${res.totalProcessadas} OPs ajustadas (${res.telhasFinalizadas + res.cdFinalizadas} finalizadas, ${res.telhasCanceladas + res.cdCanceladas} canceladas). Filas dos operadores limpas.`
      });
    } catch (err) {
      toast({ title: "Falha na conciliação", description: err.message, variant: "destructive" });
    } finally {
      setConciliandoMaquinas(false);
    }
  };

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
      let chave = "";
      if (p.of_odoo_id) {
        chave = `OFID_${String(p.of_odoo_id).trim()}`;
      } else if (p.of_nome) {
        chave = `OFNOME_${String(p.of_nome).trim().toUpperCase()}`;
      } else if (p.numero_pedido) {
        const itensPrimeiro = (() => {
          try {
            const arr = typeof p.itens_json === "string" ? JSON.parse(p.itens_json) : p.itens_json;
            if (Array.isArray(arr) && arr.length > 0) {
              return `${arr[0]?.produto || ""}_${arr[0]?.quantidade || ""}_${arr[0]?.medida || ""}`;
            }
          } catch {}
          return "";
        })();
        chave = `PED_${String(p.numero_pedido).trim()}_${itensPrimeiro || p.id}`;
      } else {
        chave = `ID_${p.id}`;
      }

      if (!vistos.has(chave)) {
        vistos.add(chave);
        lista.push(p);
      }
    }
    return lista;
  }, [pedidosRaw]);

  const { data: pedidosProducao = [] } = useQuery({
    queryKey: ["pedidos-producao-todos"],
    queryFn: async () => {
      const CHAVE = "pedidos_producao_todos_cache_v2";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const c = await obterCacheLocal(CHAVE);
        if (c && c.length > 0) return c;
      }
      try {
        const res = await base44.entities.Pedido.list("-data", 500);
        if (res && res.length > 0) salvarCacheLocal(CHAVE, res).catch(() => {});
        return res;
      } catch (e) {
        const c = await obterCacheLocal(CHAVE);
        if (c && c.length > 0) return c;
        throw e;
      }
    },
    placeholderData: (prev) => prev,
    staleTime: 30000,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 3,
    refetchInterval: 30000,
    refetchOnWindowFocus: false
  });

  const { data: ordensCD = [] } = useQuery({
    queryKey: ["ordens-cd-todos"],
    queryFn: async () => {
      const CHAVE = "ordens_cd_todos_cache_v2";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const c = await obterCacheLocal(CHAVE);
        if (c && c.length > 0) return c;
      }
      try {
        const res = await base44.entities.OrdemMaquinaCD.list("-data", 500);
        if (res && res.length > 0) salvarCacheLocal(CHAVE, res).catch(() => {});
        return res;
      } catch (e) {
        const c = await obterCacheLocal(CHAVE);
        if (c && c.length > 0) return c;
        throw e;
      }
    },
    placeholderData: (prev) => prev,
    staleTime: 30000,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 3,
    refetchInterval: 30000,
    refetchOnWindowFocus: false
  });

  // Repara e sincroniza automaticamente qualquer Bobininha no banco de dados (ex: #S01195)
  const reparoBobininhasExecutadoRef = useRef(false);
  useEffect(() => {
    if (pedidosRaw.length > 0 && !reparoBobininhasExecutadoRef.current) {
      reparoBobininhasExecutadoRef.current = true;
      executarReparoBobininhasBanco(pedidosRaw, pedidosProducao).then(() => {
        // silencioso
      }).catch(() => {});
    }
  }, [pedidosRaw, pedidosProducao]);

  // Consultas de Matéria-Prima em Tempo Real para Análise de Disponibilidade no PCP
  const { data: bobinasEstoque = [] } = useQuery({
    queryKey: ["bobinas-estoque-pcp"],
    queryFn: async () => {
      const CHAVE = "bobinas_estoque_pcp_cache";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const c = await obterCacheLocal(CHAVE);
        if (c && c.length > 0) return c;
      }
      try {
        const res = await base44.entities.Bobina.filter({ arquivada: false }, null, 5000);
        if (res && res.length > 0) salvarCacheLocal(CHAVE, res).catch(() => {});
        return res;
      } catch (e) {
        const c = await obterCacheLocal(CHAVE);
        if (c && c.length > 0) return c;
        throw e;
      }
    },
    placeholderData: (prev) => prev,
    staleTime: 45000,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 3,
    refetchInterval: 60000
  });

  const { data: chapasEstoque = [] } = useQuery({
    queryKey: ["chapas-estoque-pcp"],
    queryFn: async () => {
      const CHAVE = "chapas_estoque_pcp_cache";
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const c = await obterCacheLocal(CHAVE);
        if (c && c.length > 0) return c;
      }
      try {
        const res = await base44.entities.ChapaCD.filter({ status: { $ne: "cancelado" } }, null, 5000);
        if (res && res.length > 0) salvarCacheLocal(CHAVE, res).catch(() => {});
        return res;
      } catch (e) {
        const c = await obterCacheLocal(CHAVE);
        if (c && c.length > 0) return c;
        throw e;
      }
    },
    placeholderData: (prev) => prev,
    staleTime: 45000,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 3,
    refetchInterval: 60000
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
  // Fila serializada anti-colisão e anti-rate-limit para operações de prioridade
  const filaPrioridadeRef = useRef(Promise.resolve());

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
      // Cancela SOMENTE as OPs desta OF — uma venda pode ter várias OFs irmãs no Odoo,
      // e casar apenas pelo numero_pedido cancelaria a produção da OF irmã.
      // A produção já finalizada permanece intocada.
      await cancelarOpsDasOfsExatas({ pedidos: [pedido], todayIso });
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
        status_pcp: "pendente_distribuicao", percentual_concluido: 0,
        retirado_manualmente_ts: new Date().toISOString(),
        maquinas_json: "[]", etapas_telha_json: "[]",
        itens_json: JSON.stringify(itensZerados), historico_log: JSON.stringify(novoLog)
      };
      if (pedido.galpao_responsavel !== undefined) updateData.galpao_responsavel = "";
      await comRetryLimite(() => base44.entities.PedidoOdoo.update(pedido.id, updateData));
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
      // Cancela SOMENTE as OPs desta OF — uma venda pode ter várias OFs irmãs no Odoo,
      // e casar apenas pelo numero_pedido cancelaria a produção da OF irmã.
      // A produção já finalizada permanece intocada.
      await cancelarOpsDasOfsExatas({ pedidos: [pedido], todayIso });
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
      await comRetryLimite(() => base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "pendente_distribuicao", percentual_concluido: 0,
        retirado_manualmente_ts: new Date().toISOString(),
        maquinas_json: "[]", etapas_telha_json: "[]",
        itens_json: JSON.stringify(itensZerados), historico_log: JSON.stringify(novoLog)
      }));
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
    if (!pedido) return;
    const pedidoId = pedido.id;
    const numPedido = pedido.numero_pedido;

    // ⚡ Resposta Instantânea: Fecha o diálogo e remove da tela imediatamente
    setDetalheOpen(false);
    setPedidoSelecionado(null);

        queryClient.setQueryData(["pedidos-odoo-pcp"], (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.filter((item) => item.id !== pedidoId);
    });

    queryClient.setQueryData(["pedidos-producao-todos"], (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.filter((item) => item.numero_pedido !== numPedido && item.id !== pedidoId);
    });

    queryClient.setQueryData(["ordens-cd-todos"], (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.filter((item) => item.numero_pedido !== numPedido);
    });

    toast({
      title: "🗑️ Excluindo OS #" + numPedido,
      description: "Removida da tela. Sincronizando com o Odoo em segundo plano...",
      className: "border-amber-500/40"
    });

    // Processamento em segundo plano com timeout
    executarExclusaoOsBackground({ pedido, pedidoId, numPedido, motivo, queryClient, toast });
  };

  const handleSolicitarFinalizar100 = (pedidosLista) => {
    const lista = (pedidosLista || []).filter(Boolean);
    if (!lista.length) return;
    setFinalizarPendentes(lista);
    setSenhaFinalizarOpen(true);
  };

  const [sincronizandoOdoo, setSincronizandoOdoo] = useState(false);
  const handleSincronizarLoteOdoo = (lista) =>
    sincronizarLoteOdoo(lista, { isPedidoConcluido, setSincronizandoOdoo, toast, queryClient });

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

        // 2. Finaliza OPs locais vinculadas na fábrica (Telhas, C&D e Desbobinador)
        try {
          await finalizarOpsDoPedido({ pedido, usuario: "Central PCP" });
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
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
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

  // Helper altamente resiliente com backoff exponencial e detecção de status HTTP 429 (Rate Limit)
  const executarComRetryRateLimit = async (fn, maxTentativas = 5, delayBase = 1000) => {
    let ultimoErro = null;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        return await fn();
      } catch (err) {
        ultimoErro = err;
        const msg = String(err?.message || "").toLowerCase();
        const status = err?.status || err?.statusCode || err?.response?.status;
        const isRateLimit =
          status === 429 ||
          msg.includes("rate limit") ||
          msg.includes("too many") ||
          msg.includes("429");

        if (isRateLimit && tentativa < maxTentativas) {
          const waitMs = delayBase * Math.pow(2, tentativa - 1) + Math.floor(Math.random() * 500);
          console.warn(`[PCP RateLimit] Tentativa ${tentativa}/${maxTentativas} aguardando ${waitMs}ms para retry após limite de taxa...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }
    throw ultimoErro;
  };

  const confirmarPrioridade = async (pedido, nivel) => {
    const isRetiraAgora = nivel === "RETIRA_AGORA";
    const isRota = nivel === "ROTA";
    const nivelNumerico = (!isRetiraAgora && !isRota && nivel) ? Number(nivel) : null;
    const ativa = Boolean(isRetiraAgora || isRota || nivelNumerico);
    const logExistente = (() => { try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; } })();
    const descr = isRetiraAgora
      ? "OF marcada como ⚡🚨 CLIENTE RETIRA AGORA (Balcão)."
      : isRota
      ? "OF marcada como 🚚 Pedido de Rota."
      : ativa
      ? `OF marcada como Prioridade P${nivelNumerico} (1 a 5 - sendo 1 mais urgente).`
      : "Prioridade removida.";

    const novoLog = [...logExistente, {
      data: new Date().toISOString(),
      usuario: "PCP",
      acao: ativa ? (isRetiraAgora ? "prioridade_retira_agora" : isRota ? "prioridade_rota" : `prioridade_p${nivelNumerico}`) : "prioridade_removida",
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
            prioridade_nivel: nivelNumerico,
            cliente_retira_agora: isRetiraAgora,
            cliente_retira: isRetiraAgora,
            retira_agora: isRetiraAgora,
            is_rota: isRota,
            rota: isRota,
            historico_log: JSON.stringify(novoLog)
          };
        }
        return p;
      });
    });

    try {
      const payloadOf = {
        prioridade: ativa,
        prioridade_nivel: nivelNumerico,
        cliente_retira_agora: isRetiraAgora,
        cliente_retira: isRetiraAgora,
        retira_agora: isRetiraAgora,
        is_rota: isRota,
        rota: isRota,
        ...(isRota ? { rota_ts: new Date().toISOString() } : {}),
        historico_log: JSON.stringify(novoLog)
      };

      // 2. Persiste a alteração no PedidoOdoo com proteção contra Rate Limit
      await executarComRetryRateLimit(() =>
        base44.entities.PedidoOdoo.update(pedido.id, payloadOf)
      );

      // 3. Propaga para as ordens ativas vinculadas daquela OF caso já existam nas máquinas (com espaçamento seguro)
      if (pedido.numero_pedido) {
        await new Promise((r) => setTimeout(r, 350));

        try {
          await executarComRetryRateLimit(() =>
            base44.entities.Pedido.updateMany(
              { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
              { $set: {
                prioridade: ativa,
                prioridade_nivel: nivelNumerico,
                cliente_retira_agora: isRetiraAgora,
                cliente_retira: isRetiraAgora,
                retira_agora: isRetiraAgora,
                is_rota: isRota,
                rota: isRota,
                ...(isRota ? { rota_ts: new Date().toISOString() } : {})
              } }
            )
          ).catch((e) => console.warn("Falha ao sincronizar prioridade na máquina:", e));
        } catch (_) {}

        await new Promise((r) => setTimeout(r, 350));

        try {
          await executarComRetryRateLimit(() =>
            base44.entities.OrdemMaquinaCD.updateMany(
              { numero_pedido: pedido.numero_pedido, status: { $ne: "cancelado" } },
              { $set: {
                prioridade: ativa,
                prioridade_nivel: nivelNumerico,
                cliente_retira_agora: isRetiraAgora,
                cliente_retira: isRetiraAgora,
                retira_agora: isRetiraAgora,
                is_rota: isRota,
                rota: isRota,
                ...(isRota ? { rota_ts: new Date().toISOString() } : {})
              } }
            )
          ).catch((e) => console.warn("Falha ao sincronizar prioridade no Corte & Dobra:", e));
        } catch (_) {}
      }

      toast({
        title: isRetiraAgora
          ? "⚡🚨 Cliente Retira Agora Definido"
          : isRota
          ? "🚚 Pedido de Rota Definido"
          : ativa
          ? `Prioridade P${nivelNumerico} Definida`
          : "Prioridade Removida",
        description: `#${pedido.numero_pedido} ${
          isRetiraAgora
            ? "marcado como prioridade máxima no balcão"
            : isRota
            ? "marcado como rota de entrega"
            : ativa
            ? `marcado com Prioridade P${nivelNumerico}`
            : "voltou para fila normal"
        }.`,
        className: isRetiraAgora
          ? "border-red-500/80 bg-red-50 dark:bg-red-950/50"
          : isRota
          ? "border-indigo-500/40"
          : ativa
          ? "border-amber-500/40"
          : "border-slate-400/40"
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
    const isRetiraAgora = nivel === "RETIRA_AGORA";
    const isRota = nivel === "ROTA";
    const nivelNumerico = (!isRetiraAgora && !isRota && nivel) ? Number(nivel) : null;
    const ativa = Boolean(isRetiraAgora || isRota || nivelNumerico);
    const descr = isRetiraAgora
      ? `Todo o Pedido #${grupo.numero_pedido} marcado como ⚡🚨 CLIENTE RETIRA AGORA (Balcão).`
      : isRota
      ? `Todo o Pedido #${grupo.numero_pedido} marcado como 🚚 Pedido de Rota.`
      : ativa
      ? `Todo o Pedido #${grupo.numero_pedido} marcado como Prioridade P${nivelNumerico}.`
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
            acao: ativa
              ? (isRetiraAgora ? "prioridade_grupo_retira_agora" : isRota ? "prioridade_grupo_rota" : `prioridade_grupo_p${nivelNumerico}`)
              : "prioridade_grupo_removida",
            detalhes: descr
          }];
          return {
            ...p,
            prioridade: ativa,
            prioridade_nivel: nivelNumerico,
            cliente_retira_agora: isRetiraAgora,
            cliente_retira: isRetiraAgora,
            retira_agora: isRetiraAgora,
            is_rota: isRota,
            rota: isRota,
            historico_log: JSON.stringify(novoLog)
          };
        }
        return p;
      });
    });

    try {
      const payloadUpdate = {
        prioridade: ativa,
        prioridade_nivel: nivelNumerico,
        cliente_retira_agora: isRetiraAgora,
        cliente_retira: isRetiraAgora,
        retira_agora: isRetiraAgora,
        is_rota: isRota,
        rota: isRota,
        ...(isRota ? { rota_ts: new Date().toISOString() } : {})
      };

      // 2. Atualiza todas as OFs do pedido de UMA SÓ VEZ com updateMany no PedidoOdoo
      if (grupo.numero_pedido) {
        await executarComRetryRateLimit(() =>
          base44.entities.PedidoOdoo.updateMany(
            { numero_pedido: grupo.numero_pedido },
            { $set: payloadUpdate }
          )
        );
      } else {
        // Fallback sequencial com espaçamento seguro de 350ms apenas se não houver numero_pedido
        for (let i = 0; i < ofs.length; i++) {
          const ofItem = ofs[i];
          if (i > 0) await new Promise((r) => setTimeout(r, 350));
          await executarComRetryRateLimit(() =>
            base44.entities.PedidoOdoo.update(ofItem.id, payloadUpdate)
          );
        }
      }

      // Intervalo seguro de 350ms para evitar estourar cota por rajada
      await new Promise((r) => setTimeout(r, 350));

      // 3. Propaga para as máquinas (perfiladeiras e Corte & Dobra) de forma blindada
      if (grupo.numero_pedido) {
        try {
          await executarComRetryRateLimit(() =>
            base44.entities.Pedido.updateMany(
              { numero_pedido: grupo.numero_pedido, status: { $ne: "cancelado" } },
              { $set: payloadUpdate }
            )
          ).catch((e) => console.warn("Falha ao sincronizar grupo com Pedido:", e));
        } catch (_) {}

        await new Promise((r) => setTimeout(r, 350));

        try {
          await executarComRetryRateLimit(() =>
            base44.entities.OrdemMaquinaCD.updateMany(
              { numero_pedido: grupo.numero_pedido, status: { $ne: "cancelado" } },
              { $set: payloadUpdate }
            )
          ).catch((e) => console.warn("Falha ao sincronizar grupo com OrdemMaquinaCD:", e));
        } catch (_) {}
      }

      toast({
        title: isRetiraAgora
          ? "⚡🚨 Cliente Retira Agora Definido"
          : isRota
          ? "🚚 Pedido de Rota Definido"
          : ativa
          ? `Prioridade P${nivelNumerico} no Pedido Todo`
          : "Prioridade Removida",
        description: `Todas as ${ofs.length} OFs do Pedido #${grupo.numero_pedido} foram atualizadas com sucesso!`,
        className: isRetiraAgora
          ? "border-red-500/80 bg-red-50 dark:bg-red-950/50"
          : isRota
          ? "border-indigo-500/40"
          : ativa
          ? "border-amber-500/40"
          : "border-slate-400/40"
      });
    } catch (e) {
      // Reverte cache se deu erro após todas as tentativas
      if (snapshotAnterior) {
        queryClient.setQueryData(["pedidos-odoo-pcp"], snapshotAnterior);
      }
      toast({ title: "Erro ao alterar prioridade do pedido", description: e.message, variant: "destructive" });
    }
  };

  const handleDefinirPrioridadeLote = async (nivel) => {
    if (selecionados.size === 0) return;
    const lista = (pedidos || []).filter(p => selecionados.has(p.id));
    if (lista.length === 0) return;

    const ativa = Boolean(nivel);
    const isRetiraAgora = nivel === "RETIRA_AGORA";
    const isRota = nivel === "ROTA";
    const nivelNumerico = (!isRetiraAgora && !isRota && nivel) ? Number(nivel) : null;
    const descr = isRetiraAgora
      ? "Marcado como ⚡🚨 Cliente Retira Agora em lote."
      : isRota
      ? "Marcado como 🚚 Pedido de Rota em lote."
      : ativa
      ? `Marcado como Prioridade P${nivelNumerico} em lote.`
      : "Prioridade removida em lote.";

    const ofIdsSet = new Set(lista.map(o => o.id));

    // 1. Atualização Otimista Imediata
    const snapshotAnterior = queryClient.getQueryData(["pedidos-odoo-pcp"]);
    queryClient.setQueryData(["pedidos-odoo-pcp"], (antigos = []) => {
      return antigos.map((p) => {
        if (ofIdsSet.has(p.id)) {
          const logExistente = (() => { try { return JSON.parse(p.historico_log || "[]"); } catch { return []; } })();
          const novoLog = [...logExistente, {
            data: new Date().toISOString(),
            usuario: "PCP",
            acao: ativa
              ? (isRetiraAgora ? "prioridade_lote_retira_agora" : isRota ? "prioridade_lote_rota" : `prioridade_lote_p${nivelNumerico}`)
              : "prioridade_lote_removida",
            detalhes: descr
          }];
          return {
            ...p,
            prioridade: ativa,
            prioridade_nivel: nivelNumerico,
            cliente_retira_agora: isRetiraAgora,
            cliente_retira: isRetiraAgora,
            retira_agora: isRetiraAgora,
            is_rota: isRota,
            rota: isRota,
            historico_log: JSON.stringify(novoLog)
          };
        }
        return p;
      });
    });

    toast({ title: `Atualizando prioridade de ${lista.length} ordem(ns)...` });

    try {
      const payloadLote = {
        prioridade: ativa,
        prioridade_nivel: nivelNumerico,
        cliente_retira_agora: isRetiraAgora,
        cliente_retira: isRetiraAgora,
        retira_agora: isRetiraAgora,
        is_rota: isRota,
        rota: isRota,
        ...(isRota ? { rota_ts: new Date().toISOString() } : {})
      };

      // 2. Atualiza por Pedido em lote com updateMany no PedidoOdoo
      const numerosPedidos = Array.from(new Set(lista.map(it => it.numero_pedido).filter(Boolean)));
      for (let i = 0; i < numerosPedidos.length; i++) {
        const numPed = numerosPedidos[i];
        if (i > 0) await new Promise(r => setTimeout(r, 350));
        await executarComRetryRateLimit(() =>
          base44.entities.PedidoOdoo.updateMany(
            { numero_pedido: numPed },
            { $set: payloadLote }
          )
        );
      }

      // Itens que eventualmente não tenham numero_pedido
      const semNumeroPedido = lista.filter(it => !it.numero_pedido);
      for (let i = 0; i < semNumeroPedido.length; i++) {
        const item = semNumeroPedido[i];
        await new Promise(r => setTimeout(r, 350));
        await executarComRetryRateLimit(() =>
          base44.entities.PedidoOdoo.update(item.id, payloadLote)
        );
      }

      // 3. Propagar para máquinas (Pedido e OrdemMaquinaCD) para os números de pedido afetados
      for (const numPed of numerosPedidos) {
        await new Promise(r => setTimeout(r, 350));
        try {
          await executarComRetryRateLimit(() =>
            base44.entities.Pedido.updateMany(
              { numero_pedido: numPed, status: { $ne: "cancelado" } },
              { $set: payloadLote }
            )
          ).catch((e) => console.warn("Falha ao sincronizar lote com Pedido:", e));
        } catch (_) {}

        await new Promise(r => setTimeout(r, 350));

        try {
          await executarComRetryRateLimit(() =>
            base44.entities.OrdemMaquinaCD.updateMany(
              { numero_pedido: numPed, status: { $ne: "cancelado" } },
              { $set: payloadLote }
            )
          ).catch((e) => console.warn("Falha ao sincronizar lote com OrdemMaquinaCD:", e));
        } catch (_) {}
      }

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      toast({ title: "Prioridade em lote atualizada com sucesso!", className: "border-emerald-500/40" });
    } catch (err) {
      console.error(err);
      if (snapshotAnterior) {
        queryClient.setQueryData(["pedidos-odoo-pcp"], snapshotAnterior);
      }
      toast({ title: "Erro ao atualizar prioridade em lote", description: err.message, variant: "destructive" });
    }
  };

  const { distribuindo, handleDistribuir, handleDistribuirLote } = useDistribuicaoPcp({
    bobinasEstoque, filialAtiva, queryClient, toast, setPedidoSelecionado, setSelecionados
  });

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

  // Mapa de pedidos que contêm ambos os setores (Telhas E Corte & Dobra) no mesmo pedido
  const numerosComAmbosSetores = useMemo(() => {
    const mapa = new Map();
    pedidosDaLoja.forEach(p => {
      const num = p.numero_pedido || `AVULSO_${p.id}`;
      if (!mapa.has(num)) mapa.set(num, { temTelha: false, temCD: false });
      const info = mapa.get(num);
      const g = classGrupo(p);
      if ((p.itens_telha_count || 0) > 0 || g === "telha") info.temTelha = true;
      if ((p.itens_cd_count || 0) > 0 || g === "cd") info.temCD = true;
    });
    const setAmbos = new Set();
    mapa.forEach((v, num) => {
      if (v.temTelha && v.temCD) setAmbos.add(num);
    });
    return setAmbos;
  }, [pedidosDaLoja]);

  // Estatísticas de Setores por OF (Grade Solta)
  const statsSetores = useMemo(() => {
    let telhas = 0;
    let cd = 0;
    let ambos = 0;
    pedidosDaLoja.forEach(p => {
      const g = classGrupo(p);
      const temTelha = (p.itens_telha_count || 0) > 0 || g === "telha";
      const temCD = (p.itens_cd_count || 0) > 0 || g === "cd";
      if (temTelha) telhas++;
      if (temCD) cd++;
      if (numerosComAmbosSetores.has(p.numero_pedido || `AVULSO_${p.id}`)) ambos++;
    });
    return { telhas, cd, ambos, total: pedidosDaLoja.length };
  }, [pedidosDaLoja, numerosComAmbosSetores]);

  // Estatísticas de Setores por Pedido (Modo Agrupado)
  const statsSetoresAgrupados = useMemo(() => {
    const mapaNums = new Map();
    pedidosDaLoja.forEach(p => {
      const num = p.numero_pedido || `AVULSO_${p.id}`;
      if (!mapaNums.has(num)) mapaNums.set(num, []);
      mapaNums.get(num).push(p);
    });

    let telhas = 0;
    let cd = 0;
    let ambos = 0;

    mapaNums.forEach((ofs, num) => {
      const temTelha = ofs.some(p => (p.itens_telha_count || 0) > 0 || classGrupo(p) === "telha");
      const temCD = ofs.some(p => (p.itens_cd_count || 0) > 0 || classGrupo(p) === "cd");
      if (temTelha && temCD) ambos++;
      if (temTelha) telhas++;
      if (temCD) cd++;
    });

    return { telhas, cd, ambos, total: mapaNums.size };
  }, [pedidosDaLoja]);

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

    // Filtro por Setor Industrial (Telhas / Corte e Dobra / Ambos)
    if (filtroSetor !== "todos") {
      const g = classGrupo(p);
      const temTelha = (p.itens_telha_count || 0) > 0 || g === "telha";
      const temCD = (p.itens_cd_count || 0) > 0 || g === "cd";
      const numPed = p.numero_pedido || `AVULSO_${p.id}`;
      const ehMisto = numerosComAmbosSetores.has(numPed);

      if (filtroSetor === "telhas" && !temTelha) return false;
      if (filtroSetor === "corte_dobra" && !temCD) return false;
      if (filtroSetor === "ambos" && !ehMisto) return false;
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

    if (!buscaDebounced || !buscaDebounced.trim()) return true;
    const q = buscaDebounced.toLowerCase().trim();

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
        if (!g.prioridade_nivel || getPesoOrdenacaoPrioridade(g) > 0) {
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

      // Se o otimizador de setup estiver ativo, agrupa pedidos pela mesma matéria-prima
      if (otimizarPorBobina) {
        const extrairChave = (g) => {
          const ofs = g.ofs || [];
          for (const o of ofs) {
            const txt = `${o.chapa || ""} ${o.espessura || ""} ${o.cor || ""} ${o.produto || ""} ${o.descricao || ""}`;
            const mEsp = txt.match(/\b(0[,\.]\d{2})\b/);
            const esp = mEsp ? mEsp[1].replace(",", ".") : "0.43";
            const mCor = txt.match(/\b(branco|azul|vermelho|verde|preto|cinza|marrom|amarelo|galvalume)\b/i);
            const cor = mCor ? mCor[1].toUpperCase() : "GALVALUME";
            return `${esp}_${cor}`;
          }
          return "0.43_GALVALUME";
        };
        const chaveA = extrairChave(a);
        const chaveB = extrairChave(b);
        if (chaveA !== chaveB) return chaveA.localeCompare(chaveB);
      }

      const da = new Date(a.ofs[0]?.data_recebimento || 0).getTime();
      const db = new Date(b.ofs[0]?.data_recebimento || 0).getTime();
      return da - db;
    });
  }, [pedidosFiltrados, pedidosAtivosEmTodos, filtro, otimizarPorBobina]);

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

  // Auto-expande resultados quando o usuário digita um novo termo de busca (sem sobrescrever cliques manuais)
  const ultimaBuscaExpandidaRef = useRef("");
  useEffect(() => {
    const termo = (buscaDebounced || "").trim();
    if (termo.length >= 2 && termo !== ultimaBuscaExpandidaRef.current) {
      ultimaBuscaExpandidaRef.current = termo;
      const novos = new Set();
      gruposPedidos.forEach(g => { if (g.numero_pedido) novos.add(g.numero_pedido); });
      gruposConcluidosEmTodos.forEach(g => { if (g.numero_pedido) novos.add(g.numero_pedido); });
      setPedidosExpandidos(prev => new Set([...prev, ...novos]));
    } else if (!termo && ultimaBuscaExpandidaRef.current) {
      ultimaBuscaExpandidaRef.current = "";
    }
  }, [buscaDebounced, gruposPedidos, gruposConcluidosEmTodos]);

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

  // ── EXCLUSÃO SUPER COMPLETA COM MOTIVO OBRIGATÓRIO E HISTÓRICO ──
  const solicitarExclusaoSelecionadas = () => {
    const lista = pedidos.filter(p => selecionados.has(p.id));
    if (lista.length === 0) return;
    setModalExclusao({
      aberto: true,
      pedidos: lista,
      titulo: `Excluir ${lista.length} Ordem(ns) de Fabricação Selecionada(s)?`,
      descricao: `As ${lista.length} ordens de fabricação selecionadas serão excluídas definitivamente da fila do PCP e canceladas em todas as máquinas de produção.`,
      motivo: "",
      notificarOdoo: true
    });
  };

  const solicitarExclusaoTodas = () => {
    if (pedidosFiltrados.length === 0) return;
    setModalExclusao({
      aberto: true,
      pedidos: pedidosFiltrados,
      titulo: `⚠️ Excluir TODAS as ${pedidosFiltrados.length} Ordem(ns) da Fila Atual?`,
      descricao: `ATENÇÃO: Todas as ${pedidosFiltrados.length} ordens de fabricação exibidas na visualização atual serão permanentemente canceladas e removidas do sistema.`,
      motivo: "",
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
      motivo: "",
      notificarOdoo: true
    });
  };

  const solicitarExclusaoIndividual = (pedido) => {
    setModalExclusao({
      aberto: true,
      pedidos: [pedido],
      titulo: `Excluir OF ${pedido.of_nome || pedido.of_odoo_id || '#' + pedido.numero_pedido}?`,
      descricao: `Esta ordem de fabricação (${pedido.cliente_nome || 'Cliente'}) será cancelada e removida da Central PCP e de todas as máquinas.`,
      motivo: "",
      notificarOdoo: true
    });
  };

  const executarExclusaoConfirmada = async () => {
    const lista = modalExclusao.pedidos;
    if (!lista || lista.length === 0) {
      setModalExclusao(prev => ({ ...prev, aberto: false }));
      return;
    }

    const motivoExclusao = modalExclusao.motivo?.trim() || "Exclusão solicitada na Central PCP";
    const me = await base44.auth.me().catch(() => null); const usuarioLogado = me?.full_name || me?.email || "Gestor PCP";
    const idsExcluir = new Set(lista.map(p => p.id));
    const notificarOdooFlag = modalExclusao.notificarOdoo;
    const numerosPedidos = [...new Set(lista.map(p => p.numero_pedido).filter(Boolean))];
    const totalItens = lista.length;
    const todayIso = new Date().toISOString().slice(0, 10);

    // ⚡ 1. Resposta Instantânea na Interface (UI Otimista < 0.1s)
    setModalExclusao({ aberto: false, pedidos: [], titulo: "", descricao: "", motivo: "", notificarOdoo: true });
    setSelecionados(prev => {
      const next = new Set(prev);
      idsExcluir.forEach(id => next.delete(id));
      return next;
    });

    queryClient.setQueryData(["pedidos-odoo-pcp"], (oldData) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.filter((item) => !idsExcluir.has(item.id));
    });

    if (!isOperador) {
      toast({
        title: `🗑️ Excluindo ${totalItens} ordem(ns)...`,
        description: `Motivo: ${motivoExclusao}. Cancelando nas máquinas e gravando histórico.`,
        className: "border-amber-500/40"
      });
    }

    // ⚡ 2. Processamento em Segundo Plano Totalmente Paralelizado e Auditável
    (async () => {
      try {
        // A) Grava formalmente no Histórico de Exclusões para consulta/auditoria
        await registrarHistoricoExclusao({
          pedidos: lista,
          motivo: motivoExclusao,
          usuario: usuarioLogado,
          todayIso
        }).catch(err => console.warn("[Exclusão] Falha ao registrar histórico:", err));

        // B) Cancela imediatamente as OPs locais vinculadas nas máquinas da fábrica (Telhas, C&D e Desbobinadeira)
        const promessasFabrica = lista.map(p =>
          cancelarOpsDoPedido({
            pedido: p,
            todayIso,
            usuario: usuarioLogado,
            motivo: motivoExclusao
          }).catch(err => console.warn("[Exclusão] Falha ao cancelar OPs locais:", err))
        );

        // C) Sincronização em Paralelo com o Webhook do Odoo
        const promessasOdoo = [];
        if (notificarOdooFlag) {
          const mapaPedidos = new Map();
          for (const p of lista) {
            if (p.numero_pedido && !mapaPedidos.has(p.numero_pedido) && p.odoo_id && !isPedidoTeste(p)) {
              mapaPedidos.set(p.numero_pedido, p);
            }
          }

          for (const [numPed, p] of mapaPedidos.entries()) {
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout Odoo (3s)")), 3000)
            );
            const callPromise = base44.functions.invoke("cancelarOrdemServicoOdoo", {
              pedido_id: p.id,
              numero_pedido: numPed,
              odoo_id: p.odoo_id,
              of_odoo_id: p.of_odoo_id,
              of_nome: p.of_nome,
              motivo: motivoExclusao,
              force: true,
            });
            promessasOdoo.push(Promise.race([callPromise, timeoutPromise]).catch(err => {
              console.warn(`[Exclusão Odoo Webhook - Pedido #${numPed}]`, err.message);
            }));
          }
        }

        // D) Exclusão em Paralelo Simultâneo de todas as entidades PedidoOdoo
        const promessasDelecao = lista.map(p =>
          base44.entities.PedidoOdoo.delete(p.id).catch(err => {
            console.warn(`[Exclusão PedidoOdoo] Falha ao deletar ID ${p.id}:`, err.message);
          })
        );

        // Aguarda todas as tarefas em segundo plano em paralelo
        await Promise.allSettled([...promessasFabrica, ...promessasOdoo, ...promessasDelecao]);

        // Invalidação final do cache para sincronia atômica total
        queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
        queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
        queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
        queryClient.invalidateQueries({ queryKey: ["pedidos"] });
        queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });

        if (!isOperador) {
          toast({
            title: `✅ ${totalItens} ordem(ns) cancelada(s) e excluída(s)`,
            description: `Removidas das máquinas e gravadas no Histórico de Exclusões com sucesso.`,
            className: "border-emerald-500/40"
          });
        }
      } catch (errBackground) {
        console.error("[Exclusão Background] Erro inesperado:", errBackground);
      }
    })();
  };

  const tipoBuscaAtual = TIPOS_BUSCA.find(t => t.id === tipoBusca) || TIPOS_BUSCA[0];
  const IconeTipoBusca = tipoBuscaAtual.icon;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Painel Lateral de Filtros (rail fixa escura) */}
      <PainelFiltrosPCP
        temAcessoGlobalCentrais={temAcessoGlobalCentrais}
        statsLoja={statsLoja}
        filiaisPcpExibidas={filiaisPcpExibidas}
        lojaSelecionada={lojaSelecionada}
        onMudarLoja={handleMudarLoja}
        stats={stats}
        busca={busca}
        setBusca={setBusca}
        onLimparBusca={handleLimparBusca}
        tiposBusca={TIPOS_BUSCA}
        tipoBusca={tipoBusca}
        setTipoBusca={setTipoBusca}
        modelosRapidos={MODELOS_RAPIDOS}
        onSelecionarModeloRapido={handleSelecionarModeloRapido}
        filtros={FILTROS}
        filtro={filtro}
        setFiltro={setFiltro}
        filtroSetor={filtroSetor}
        setFiltroSetor={setFiltroSetor}
        countsSetor={modoVisao === "agrupado" ? statsSetoresAgrupados : statsSetores}
        filtroMaterial={filtroMaterial}
        setFiltroMaterial={setFiltroMaterial}
        statsMaterial={statsMaterial}
        filtroDataCampo={filtroDataCampo}
        setFiltroDataCampo={setFiltroDataCampo}
        filtroDataPreset={filtroDataPreset}
        setFiltroDataPreset={setFiltroDataPreset}
        onSelectPreset={handleSelectPreset}
        filtroDataInicio={filtroDataInicio}
        setFiltroDataInicio={setFiltroDataInicio}
        filtroDataFim={filtroDataFim}
        setFiltroDataFim={setFiltroDataFim}
        filtroDataAtivo={filtroDataAtivo}
        onLimparFiltroData={limparFiltroData}
        totalFiltrados={pedidosFiltrados.length}
      />

      {/* Topo: título + ações essenciais */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-7 lg:pl-[268px] py-4 flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/setor")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="flex items-center gap-2.5 text-lg sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mr-auto">
          <Inbox className="w-6 h-6 text-orange-500" />
          Central PCP
        </h1>
        {!isOnline ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-bold text-amber-700 dark:text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>📶 Modo Local (Cache Ativo)</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <BadgeTempoSync dataUpdatedAt={dataUpdatedAt} />
          </div>
        )}
        <Button
          variant="outline"
          onClick={handleRefetchComFeedback}
          disabled={carregando}
          className="h-9 px-3.5 rounded-lg text-[13px] font-semibold text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5"
          title="Forçar atualização e sincronização imediata com o Odoo ERP"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin text-orange-500" : "text-emerald-600"}`} />
          Sincronizar
        </Button>
        <Button
          onClick={() => setWebhookOpen(true)}
          className="h-9 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white dark:text-emerald-50 text-[13px] font-semibold gap-1.5"
          title="Receber / Simular Webhook Odoo"
        >
          <Radio className="w-4 h-4" />
          Receber
        </Button>
      </div>

      {/* Faixa Hero: ferramentas de manutenção sobre a imagem do galpão */}
      <PcpHeroTools
        onRecuperarPedido={() => setRecuperarModalOpen(true)}
        onAuditar={() => setAuditarModalOpen(true)}
        onAbrirRelatorio={() => setModalRelatorioAuditoriaOpen(true)}
        onConciliacaoManual={handleExecutarAuditoriaConciliacaoManual}
        conciliando={conciliandoMaquinas}
        relatorioAuditoria={relatorioAuditoria}
        onAbrirSaude={() => setModalSaudeOpen(true)}
        onAbrirExclusoes={() => setModalHistoricoExclusoesOpen(true)}
        exclusoesCount={obterHistoricoExclusoes().length}
        onAbrirPop={(key) => { setPopModalKey(key); setPopModalOpen(true); }}
      />

      {/* Fila de Pedidos */}
      <div className="px-4 sm:px-7 lg:pl-[268px] pt-5 pb-12 flex flex-col gap-3.5">
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
            <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
              {busca && busca.trim().length >= 2 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBuscarNoBancoHistorico}
                  disabled={buscandoNoBanco}
                  className="text-xs bg-orange-600 hover:bg-orange-700 text-white font-bold gap-1.5 shadow-sm"
                  title="Faz uma consulta direta ao banco de dados por este pedido histórico"
                >
                  <Search className="w-3.5 h-3.5" />
                  {buscandoNoBanco ? "Consultando banco..." : `Buscar "${busca.trim()}" no Histórico Completo`}
                </Button>
              )}
              {(busca || filtroDataAtivo || filtro !== "ativos") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleLimparBusca();
                    limparFiltroData();
                    setFiltro("ativos");
                  }}
                  className="text-xs"
                >
                  Limpar Todos os Filtros
                </Button>
              )}
            </div>
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
                  <Button size="sm" disabled={distribuindo || excluindo}
                    onClick={() => handleDistribuirLote(pedidos.filter(p => selecionados.has(p.id)))}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs h-8 gap-1.5 shadow-sm font-bold">
                    <Zap className="w-3.5 h-3.5" />
                    {distribuindo ? "Distribuindo..." : `Distribuir Selecionadas (${selecionados.size})`}
                  </Button>
                )}

                {/* Transferir Selecionados de Central PCP / Filial */}
                {selecionados.size > 0 && (
                  <Button size="sm" variant="outline" disabled={distribuindo || excluindo}
                    onClick={() => setModalTransferir({ aberto: true, pedidos: pedidos.filter(p => selecionados.has(p.id)) })}
                    className="border-indigo-400 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs h-8 gap-1.5 font-bold">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
                    Transferir Loja ({selecionados.size})
                  </Button>
                )}

                {/* Devolver Selecionadas ao PCP (em massa) */}
                <BotaoDevolverLotePCP
                  selecionados={selecionados}
                  pedidos={pedidos}
                  queryClient={queryClient}
                  toast={toast}
                  disabled={distribuindo || excluindo || sincronizandoOdoo}
                  onDevolvidos={() => setSelecionados(new Set())}
                />

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
                  <Button size="sm" variant="outline" disabled={distribuindo || excluindo}
                    onClick={() => handleDistribuirLote(pedidosFiltrados.filter(p => p.status_pcp === "pendente_distribuicao"), { pularDevolvidosManualmente: true })}
                    className="border-orange-400 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-xs h-8 gap-1.5 font-bold">
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
                {/* Botão Otimizar Sequência por Bobina */}
                <button
                  type="button"
                  onClick={() => {
                    setOtimizarPorBobina(prev => {
                      const next = !prev;
                      if (next) {
                        toast({
                          title: "🎯 Fila otimizada por Bobina!",
                          description: "Pedidos agrupados por espessura e cor da bobina para minimizar trocas de setup e paradas de máquina."
                        });
                      } else {
                        toast({
                          title: "Fila retornada à ordenação padrão (FIFO / Prioridade)."
                        });
                      }
                      return next;
                    });
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                    otimizarPorBobina
                      ? "bg-purple-600 text-white border-purple-700 shadow-sm"
                      : "bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 border-purple-500/30"
                  }`}
                  title="Agrupar pedidos com a mesma bobina (espessura + cor) em sequência para evitar trocas na perfiladeira"
                >
                  <Target className="w-3.5 h-3.5" />
                  {otimizarPorBobina ? "Sequência Otimizada" : "Otimizar p/ Bobina"}
                </button>

                {/* Seletor Triplo: Cards | Tabela | Kanban */}
                <ViewModeToggle
                  value={viewMode}
                  onChange={setViewMode}
                  storageKey="pcp_fila"
                />

                {/* Expansão Rápida quando em modo Cards Agrupado */}
                {viewMode === "cards" && modoVisao === "agrupado" && (
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

                {/* Sub-alternador quando em modo Cards: Por Pedido vs Grade Solta */}
                {viewMode === "cards" && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setModoVisao("agrupado")}
                      className={`px-2 py-1 text-[11px] font-bold rounded transition-colors ${
                        modoVisao === "agrupado"
                          ? "bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Visualização agrupada por Pedido"
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
                      title="Visualização com OFs soltas em grade"
                    >
                      Grade Solta
                    </button>
                  </div>
                )}

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

            {/* Visualizações Condicionais: Tabela / Kanban / Cards */}
            {viewMode === "tabela" ? (
              <FilaPCPTabelaView
                pedidos={filtro === "todos" ? pedidosAtivosEmTodos : pedidosFiltrados}
                gruposPedidos={gruposPedidos}
                estoqueContext={estoqueContext}
                pedidosProducao={pedidosProducao}
                ordensCD={ordensCD}
                selecionados={selecionados}
                onToggleSelect={handleToggleSelect}
                onToggleSelectGrupo={handleToggleSelectGrupo}
                onOpenDetalhe={(p) => { setPedidoSelecionado(p); setDetalheOpen(true); }}
                onDistribuir={handleDistribuir}
                onDistribuirGrupo={handleDistribuirLote}
                onFinalizarOP={(p) => handleSolicitarFinalizar100([p])}
                onFinalizarGrupo100={(lista) => handleSolicitarFinalizar100(lista)}
                onOpenHistorico={(num) => setPedidoHistoricoNumero(num)}
                onSincronizarOdoo={(p) => handleSincronizarLoteOdoo([p])}
                onSincronizarGrupoOdoo={(lista) => handleSincronizarLoteOdoo(lista)}
                onSetPrioridade={handleSetPrioridade}
                onSetPrioridadeGrupo={handleSetPrioridadeGrupo}
              />
            ) : viewMode === "kanban" ? (
              <FilaPCPKanbanView
                pedidos={filtro === "todos" ? [...pedidosAtivosEmTodos, ...pedidosConcluidosEmTodos] : pedidosFiltrados}
                gruposPedidos={gruposPedidos}
                onOpenDetalhe={(p) => { setPedidoSelecionado(p); setDetalheOpen(true); }}
                onDistribuir={handleDistribuir}
                onDistribuirGrupo={handleDistribuirLote}
                onFinalizarOP={(p) => handleSolicitarFinalizar100([p])}
                onFinalizarGrupo100={(lista) => handleSolicitarFinalizar100(lista)}
                onOpenHistorico={(num) => setPedidoHistoricoNumero(num)}
                selecionados={selecionados}
                onToggleSelectGrupo={handleToggleSelectGrupo}
              />
            ) : modoVisao === "agrupado" ? (
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

            {/* Seção recolhível de Concluídos quando visualizando 'Todos' em modo Cards */}
            {viewMode === "cards" && filtro === "todos" && pedidosConcluidosEmTodos.length > 0 && (
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

      {/* Modal de Histórico de Exclusões PCP */}
      <HistoricoExclusoesModal
        open={modalHistoricoExclusoesOpen}
        onOpenChange={setModalHistoricoExclusoesOpen}
      />
      {/* Central de Saúde e Diagnóstico 360° */}
      <CentralSaudeSistemaModal
        open={modalSaudeOpen}
        onOpenChange={setModalSaudeOpen}
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

            {/* Campo Obrigatório: Motivo da Exclusão com Atalhos */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Motivo do Cancelamento / Exclusão <span className="text-red-500">* (Obrigatório)</span>
              </label>

              {/* Botões de atalho rápido */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Cancelado pelo Cliente",
                  "Pedido Duplicado",
                  "Erro de Medida/Modelo",
                  "Falta de Matéria-Prima",
                  "Cancelamento Comercial"
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setModalExclusao(prev => ({ ...prev, motivo: sug }))}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                      modalExclusao.motivo === sug
                        ? "bg-red-600 text-white border-red-600 font-bold shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {sug}
                  </button>
                ))}
              </div>

              <Textarea
                value={modalExclusao.motivo || ""}
                onChange={(e) => setModalExclusao(prev => ({ ...prev, motivo: e.target.value }))}
                placeholder="Informe detalhadamente o motivo da exclusão para registro no histórico..."
                className="text-xs min-h-[60px] bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus-visible:ring-red-500"
              />
              {(!modalExclusao.motivo || modalExclusao.motivo.trim().length < 3) && (
                <p className="text-[10px] text-red-500 font-medium">
                  ⚠️ Por favor, informe o motivo do cancelamento para prosseguir.
                </p>
              )}
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
              disabled={excluindo || !modalExclusao.motivo || modalExclusao.motivo.trim().length < 3}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Sidebar de Histórico Completo do Pedido */}
      <HistoricoPedidoSidebar
        open={Boolean(pedidoHistoricoNumero)}
        onClose={() => setPedidoHistoricoNumero(null)}
        numeroPedido={pedidoHistoricoNumero}
      />

      {/* Guia Operacional e Fluxograma do PCP */}
      <GuiaOperacionalModal
        open={popModalOpen}
        onOpenChange={setPopModalOpen}
        maquinaNome={popModalKey}
      />

      <RelatorioAuditoriaDiariaModal
        open={modalRelatorioAuditoriaOpen}
        onOpenChange={setModalRelatorioAuditoriaOpen}
        relatorio={relatorioAuditoria}
        executando={executandoAuditoriaDiaria}
        onExecutarNovamente={async () => {
          setExecutandoAuditoriaDiaria(true);
          try {
            const novoRel = await executarAuditoriaDiariaCompleta({ queryClient, usuario: "Gestor PCP (Manual)" });
            setRelatorioAuditoria(novoRel);
            toast({
              title: "Auditoria Diária Concluída!",
              description: `Score de Saúde: ${novoRel.scoreSaude}% — ${novoRel.statusGeral}`
            });
          } finally {
            setExecutandoAuditoriaDiaria(false);
          }
        }}
      />

      {/* Barra Flutuante de Ações em Lote */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-4xl w-[94%] sm:w-auto flex-wrap sm:flex-nowrap justify-between">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span className="text-xs font-bold text-slate-200 whitespace-nowrap">
              {selecionados.size} {selecionados.size === 1 ? "selecionada" : "selecionadas"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Distribuir */}
            <Button
              size="sm"
              disabled={distribuindo}
              onClick={() => {
                const lista = (pedidos || []).filter(p => selecionados.has(p.id) && p.status_pcp === "pendente_distribuicao");
                if (lista.length === 0) {
                  toast({ title: "Nenhuma das ordens selecionadas está pendente de distribuição." });
                  return;
                }
                handleDistribuirLote(lista);
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 px-2.5 font-bold gap-1"
              title="Distribuir ordens pendentes selecionadas para produção"
            >
              <Send className="w-3 h-3" />
              <span>Distribuir</span>
            </Button>

            {/* Prioridades rápidas */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDefinirPrioridadeLote("RETIRA_AGORA")}
              className="bg-red-600/30 hover:bg-red-600/50 text-red-200 border-red-500/60 text-xs h-7 px-2 font-bold animate-pulse"
              title="Definir CLIENTE RETIRA AGORA para as selecionadas"
            >
              ⚡🚨 RETIRA
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDefinirPrioridadeLote(1)}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40 text-xs h-7 px-2 font-bold"
              title="Definir Prioridade P1 (Máxima) para as selecionadas"
            >
              🔥 P1
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDefinirPrioridadeLote(2)}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 text-xs h-7 px-2 font-bold"
              title="Definir Prioridade P2 para as selecionadas"
            >
              ⚡ P2
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDefinirPrioridadeLote("ROTA")}
              className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/40 text-xs h-7 px-2 font-bold"
              title="Definir ROTA para as selecionadas"
            >
              🚚 ROTA
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDefinirPrioridadeLote(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 text-xs h-7 px-2 font-bold"
              title="Remover prioridade (Normal)"
            >
              Normal
            </Button>

            {/* Sincronizar Odoo */}
            <Button
              size="sm"
              variant="outline"
              disabled={sincronizandoOdoo}
              onClick={() => {
                const lista = (pedidos || []).filter(p => selecionados.has(p.id));
                handleSincronizarLoteOdoo(lista);
              }}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 text-xs h-7 px-2 font-bold gap-1"
              title="Sincronizar status das selecionadas com o Odoo"
            >
              <RefreshCw className={`w-3 h-3 ${sincronizandoOdoo ? "animate-spin" : ""}`} />
              <span>Odoo</span>
            </Button>

            {/* Apagar */}
            <Button
              size="sm"
              variant="destructive"
              disabled={excluindo}
              onClick={solicitarExclusaoSelecionadas}
              className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-2 font-bold"
              title="Excluir selecionadas"
            >
              <Trash2 className="w-3 h-3" />
            </Button>

            {/* Limpar seleção */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelecionados(new Set())}
              className="text-slate-400 hover:text-white text-xs h-7 px-2"
            >
              Desmarcar
            </Button>
          </div>
        </div>
      )}
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