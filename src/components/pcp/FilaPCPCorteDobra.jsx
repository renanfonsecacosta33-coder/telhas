import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel
} from "@/components/ui/alert-dialog";
import {
  Play, CheckCircle2, CheckCircle, ChevronDown, Inbox, Scissors, Calendar, User, Loader2, Layers,
  Star, CalendarClock, Factory, PackageX, RefreshCw
} from "lucide-react";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import {
  getItens, classGrupo, isItemCD, computePercentual, buildItensJson,
  statusPcpPorPercentual, STATUS_ITEM, MAQUINAS_CD,
  localizarOpDoItem, saoPedidosIguais, normalizarUnidadeMedidaItem
} from "@/lib/pedidoOdooHelper";
import { formatDataBR, diasUteisRestantes } from "@/lib/sla";
import { urgenciaPrazo } from "@/lib/prazoUrgencia";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import AlterarPrazoFabrilDialog from "@/components/pcp/AlterarPrazoFabrilDialog";
import { notificarStatus } from "@/lib/biNotificador";
import { useFilial } from "@/contexts/FilialContext";
import { salvarCacheLocal, obterCacheLocal } from "@/lib/offlineStorage";
import FiltrosDataPCPBar from "@/components/pcp/FiltrosDataPCPBar";
import LocalizacaoStatusHero from "@/components/pcp/LocalizacaoStatusHero";
import BadgeDistribuicaoItem, { itemEstaDistribuido } from "@/components/pcp/BadgeDistribuicaoItem";
import FinalizarItemRapidoButton from "@/components/pcp/FinalizarItemRapidoButton";
import {
  extrairDataISO,
  calcularIntervaloPreset,
  obterDataCampoPedido
} from "@/lib/filtroDataHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import SelecionarMaterialPedidoDialog from "@/components/corte-dobra/SelecionarMaterialPedidoDialog";

export default function FilaPCPCorteDobra({ onNovaOrdem }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [atualizando, setAtualizando] = useState(null);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos"); // "todos" | "mais_atrasados" | "hoje_amanha" | "prioritarios"
  const [ordenacao, setOrdenacao] = useState("mais_atrasados"); // "mais_atrasados" | "urgencia_sla" | "data_entrega_asc" | "data_entrada_desc" | "data_entrada_asc"
  const [filtroDataCampo, setFiltroDataCampo] = useState("data_recebimento"); // "data_recebimento" | "data_entrega" | "data_previsao_fabrica"
  const [filtroDataPreset, setFiltroDataPreset] = useState("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [pedidoPrazoModal, setPedidoPrazoModal] = useState(null);
  const [materialModal, setMaterialModal] = useState(null);
  const [retirarModal, setRetirarModal] = useState(null);
  const [finalizadosPorGrupo, setFinalizadosPorGrupo] = useState({});

  const toggleFinalizadosGrupo = (espessura) => {
    setFinalizadosPorGrupo(prev => ({
      ...prev,
      [espessura]: !prev[espessura]
    }));
  };

  const filialCtx = useFilial();
  const filialAtiva = filialCtx?.filialAtiva;
  // Finalização rápida de item — exclusiva de administradores
  const isAdmin = ["admin", "super_admin"].includes(filialCtx?.user?.role);
  // Retirar da máquina — PCP (gestores e admins) podem retirar um item da máquina
  const canRetirarDaMaquina = ["admin", "super_admin", "gestor"].includes(filialCtx?.user?.role);

  // Busca otimizada (600 registros mais recentes) e cache IndexedDB (sincronizada com Central PCP)
  const carregarPedidosOdooCD = async () => {
    const CHAVE_CACHE = "pedidos_odoo_pcp_cache_v2";

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const salvoOffline = await obterCacheLocal(CHAVE_CACHE);
      if (salvoOffline && Array.isArray(salvoOffline) && salvoOffline.length > 0) {
        return salvoOffline;
      }
    }

    try {
      const dados = await base44.entities.PedidoOdoo.list("-data_recebimento", 600);
      if (dados && Array.isArray(dados) && dados.length > 0) {
        salvarCacheLocal(CHAVE_CACHE, dados).catch(() => {});
        return dados;
      }

      const salvoFallback = await obterCacheLocal(CHAVE_CACHE);
      if (salvoFallback && Array.isArray(salvoFallback) && salvoFallback.length > 0) {
        return salvoFallback;
      }
      return dados || [];
    } catch (errRede) {
      console.warn("[FilaPCPCorteDobra] Rede instável, resgatando cache IndexedDB:", errRede);
      const salvoLocal = await obterCacheLocal(CHAVE_CACHE);
      if (salvoLocal && Array.isArray(salvoLocal) && salvoLocal.length > 0) {
        return salvoLocal;
      }
      throw errRede;
    }
  };

  const { data: pedidosRaw = [], isLoading, isFetching } = useQuery({
    queryKey: ["pedidos-odoo-pcp"],
    queryFn: carregarPedidosOdooCD,
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  });

  // Deduplicação estrita de pedidos em memória para C&D
  const pedidos = useMemo(() => {
    const vistos = new Set();
    const lista = [];
    for (const p of pedidosRaw) {
      if (!p) continue;
      const chave = p.of_odoo_id 
        ? `OFID_${p.of_odoo_id}` 
        : (p.of_nome ? `OFNOME_${p.of_nome}` : (p.numero_pedido ? `PED_${p.numero_pedido}` : `ID_${p.id}`));
      if (!vistos.has(chave)) {
        vistos.add(chave);
        lista.push(p);
      }
    }
    return lista;
  }, [pedidosRaw]);

  const { data: ordensMaquina = [] } = useQuery({
    queryKey: ["ordens-maquina-cd-todas"],
    queryFn: () => base44.entities.OrdemMaquinaCD.list("-data", 500),
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  });

  const { data: ordensDesb = [] } = useQuery({
    queryKey: ["ordens-desb-todas"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 500),
    refetchInterval: 30000,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  });

  // Comparação tolerante de filial (ex: "Matriz" vs "Matriz AJL")
  const atendeFilial = (unidadePedido) => {
    if (!filialAtiva || filialAtiva === "todas") return true;
    const uPed = String(unidadePedido || "Matriz AJL").trim().toLowerCase();
    const uAtiva = String(filialAtiva).trim().toLowerCase();
    if (uPed === uAtiva) return true;
    if (uAtiva.includes("matriz") && (uPed.includes("matriz") || !unidadePedido)) return true;
    if (uPed.includes(uAtiva) || uAtiva.includes(uPed)) return true;
    return false;
  };

  // Base completa de TODOS os pedidos que possuem itens de Corte & Dobra da filial ativa
  const todosPedidosCD = useMemo(() => {
    return pedidos
      .filter(p => atendeFilial(p.unidade))
      .filter(p => {
        if (p.setor === "corte_dobra" || p.setor === "cd") return true;
        const itens = getItens(p);
        if (itens.length === 0) {
          return (p.itens_cd_count || 0) > 0;
        }
        return itens.some(i => isItemCD(i, p));
      });
  }, [pedidos, filialAtiva]);

  // Pedidos distribuídos/em produção com itens de CD
  const filaBase = useMemo(() => {
    return todosPedidosCD.filter(p => ["distribuido", "em_producao"].includes(p.status_pcp));
  }, [todosPedidosCD]);

  // Pedidos de C&D ainda NÃO distribuídos
  const naoDistribuidos = useMemo(() => {
    return todosPedidosCD.filter(p => !p.status_pcp || ["pendente_distribuicao", "pendente"].includes(p.status_pcp));
  }, [todosPedidosCD]);

  // Contagem de OFs/itens por número de pedido (marcação de pedidos com múltiplas entradas)
  const contagemPorPedido = useMemo(() => {
    const mapa = new Map();
    pedidos.forEach(p => {
      const num = String(p.numero_pedido || "").trim();
      if (!num) return;
      mapa.set(num, (mapa.get(num) || 0) + 1);
    });
    return mapa;
  }, [pedidos]);

  // Contadores executivos de prazo e status
  const contadores = useMemo(() => {
    let atrasados = 0;
    let atrasadosCriticos = 0;
    let atrasadosModerados = 0;
    let hojeAmanha = 0;
    let prioritarios = 0;
    let emProducao = 0;
    let finalizados = 0;
    let pendentesDistribuicao = 0;

    todosPedidosCD.forEach(p => {
      const isConcluido = p.status_pcp === "concluido" || (p.percentual_concluido != null && p.percentual_concluido >= 100);

      if (isConcluido) {
        finalizados++;
      } else {
        if (p.status_pcp === "em_producao") emProducao++;
        if (!p.status_pcp || ["pendente_distribuicao", "pendente"].includes(p.status_pcp)) {
          pendentesDistribuicao++;
        }
        if (p.prioridade) prioritarios++;

        const dataAlvo = p.data_previsao_fabrica || p.data_entrega;
        const d = diasUteisRestantes(dataAlvo);
        if (d != null && !isNaN(d)) {
          if (d < 0) {
            atrasados++;
            if (d <= -5) atrasadosCriticos++;
            else atrasadosModerados++;
          } else if (d === 0 || d === 1) {
            hojeAmanha++;
          }
        }
      }
    });

    return {
      total: todosPedidosCD.filter(p => p.status_pcp !== "concluido" && (p.percentual_concluido == null || p.percentual_concluido < 100)).length,
      totalGeral: todosPedidosCD.length,
      atrasados,
      atrasadosCriticos,
      atrasadosModerados,
      hojeAmanha,
      prioritarios,
      emProducao,
      finalizados,
      naoDistribuidos: pendentesDistribuicao
    };
  }, [todosPedidosCD]);

  // Handlers de Preset e Limpeza
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
    setFiltroDataCampo("data_recebimento");
    setFiltroDataPreset("todas");
    setDataInicio("");
    setDataFim("");
  };

  // Agrupar itens de CD por espessura (bitola) com filtros de urgência, status, data e ordenação
  const gruposEspessura = useMemo(() => {
    const mapa = new Map();

    todosPedidosCD.forEach(pedido => {
      const isConcluido = pedido.status_pcp === "concluido" || (pedido.percentual_concluido != null && pedido.percentual_concluido >= 100);
      const dataAlvo = pedido.data_previsao_fabrica || pedido.data_entrega;
      const d = diasUteisRestantes(dataAlvo);

      // 1. Filtros de Urgência e Status
      if (filtroUrgencia === "mais_atrasados") {
        if (isConcluido || !(d != null && d < 0)) return;
      } else if (filtroUrgencia === "atraso_critico") {
        if (isConcluido || !(d != null && d <= -5)) return;
      } else if (filtroUrgencia === "atraso_moderado") {
        if (isConcluido || !(d != null && d < 0 && d > -5)) return;
      } else if (filtroUrgencia === "hoje_amanha") {
        if (isConcluido || !(d != null && (d === 0 || d === 1))) return;
      } else if (filtroUrgencia === "prioritarios") {
        if (isConcluido || !pedido.prioridade) return;
      } else if (filtroUrgencia === "em_producao") {
        if (isConcluido || pedido.status_pcp !== "em_producao") return;
      } else if (filtroUrgencia === "finalizados") {
        if (!isConcluido) return;
      } else if (filtroUrgencia === "nao_distribuidos") {
        if (isConcluido || (pedido.status_pcp && !["pendente_distribuicao", "pendente"].includes(pedido.status_pcp))) return;
      } else if (filtroUrgencia === "todos") {
        // No filtro 'todos', se não há busca ativa por texto, esconde os 100% concluídos para focar no que há para fazer
        if (!termoBusca.trim() && isConcluido) return;
      }

      // 2. Filtro de Intervalo de Datas (Data X até Data Y)
      if (dataInicio || dataFim) {
        const valData = obterDataCampoPedido(pedido, filtroDataCampo);
        const dataIso = extrairDataISO(valData);
        if (!dataIso) return;
        if (dataInicio && dataIso < dataInicio) return;
        if (dataFim && dataIso > dataFim) return;
      }

      // 3. Filtro de busca textual inteligente
      if (termoBusca.trim()) {
        const q = termoBusca.toLowerCase().trim();
        const qDigits = q.replace(/\D/g, "");
        const num = String(pedido.numero_pedido || "").toLowerCase().trim();
        const numDigits = num.replace(/\D/g, "");
        const matchNum = num.includes(q) || Boolean(qDigits && numDigits && (numDigits === qDigits || numDigits.endsWith(qDigits) || qDigits.endsWith(numDigits) || saoPedidosIguais(num, q)));
        const ofNome = String(pedido.of_nome || "").toLowerCase();
        const ofOdooId = String(pedido.of_odoo_id || "").toLowerCase();
        const cliente = String(pedido.cliente_nome || "").toLowerCase();
        const vendedor = String(pedido.vendedor_nome || "").toLowerCase();
        const itensLimpos = getItens(pedido);
        const matchItem = itensLimpos.some(it => {
          const prod = String(it.produto || "").toLowerCase();
          const desc = String(it.descricao || "").toLowerCase();
          const med = String(it.medida || "").toLowerCase();
          return prod.includes(q) || desc.includes(q) || med.includes(q);
        });

        if (!matchNum && !ofNome.includes(q) && !ofOdooId.includes(q) && !cliente.includes(q) && !vendedor.includes(q) && !matchItem) {
          return;
        }
      }

      const itens = getItens(pedido);

      // Exibe TODOS os itens de C&D do pedido
      itens.forEach(item => {
        if (!isItemCD(item, pedido)) return;

        let esp = item.espessura;
        if (!esp || esp === "—") {
          const matchEsp = String(item.produto || item.descricao || "").match(/(\d+[.,]\d+)/);
          esp = matchEsp ? matchEsp[1].replace(",", ".") : "Sob Medida";
        }
        if (!mapa.has(esp)) mapa.set(esp, []);
        mapa.get(esp).push({ pedido, item, idx: item._idx != null ? item._idx : 0 });
      });
    });

    const todasOps = [...ordensMaquina, ...ordensDesb];

    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([espessura, itens]) => {
        // Ordena os itens daquela bitola de acordo com a ordenação selecionada (ex: mais atrasados primeiro)
        const itensOrdenados = [...itens].sort((a, b) => {
          const pedA = a.pedido;
          const pedB = b.pedido;
          if (pedA.prioridade && !pedB.prioridade) return -1;
          if (!pedA.prioridade && pedB.prioridade) return 1;

          const dataAlvoA = pedA.data_previsao_fabrica || pedA.data_entrega;
          const dataAlvoB = pedB.data_previsao_fabrica || pedB.data_entrega;
          const dA = diasUteisRestantes(dataAlvoA) ?? 999;
          const dB = diasUteisRestantes(dataAlvoB) ?? 999;

          if (ordenacao === "mais_atrasados" || ordenacao === "urgencia_sla") {
            if (dA !== dB) return dA - dB;
            return new Date(pedA.data_recebimento || 0) - new Date(pedB.data_recebimento || 0);
          }
          if (ordenacao === "data_entrega_asc") {
            const dtA = extrairDataISO(dataAlvoA) || "9999-99-99";
            const dtB = extrairDataISO(dataAlvoB) || "9999-99-99";
            if (dtA !== dtB) return dtA.localeCompare(dtB);
            return new Date(pedA.data_recebimento || 0) - new Date(pedB.data_recebimento || 0);
          }
          if (ordenacao === "data_entrada_desc") {
            return new Date(pedB.data_recebimento || 0) - new Date(pedA.data_recebimento || 0);
          }
          // data_entrada_asc (FIFO)
          return new Date(pedA.data_recebimento || 0) - new Date(pedB.data_recebimento || 0);
        });

        // Identifica se o item já foi finalizado para minimizar no final da fila daquela bitola
        const itensCompletos = itensOrdenados.map(entry => {
          const { pedido, item } = entry;
          let isConcluido = Boolean(item.concluido || item.status === "concluido");
          if (!isConcluido) {
            const opsDoPed = todasOps.filter(o => {
              if (!o.numero_pedido || String(o.status || "").toLowerCase() === "cancelado") return false;
              if (o.pedido_odoo_id && pedido?.id) return o.pedido_odoo_id === pedido.id;
              if (pedido?.of_odoo_id && o.of_odoo_id) return String(o.of_odoo_id).trim().toUpperCase() === String(pedido.of_odoo_id).trim().toUpperCase();
              if (o.pedido_odoo_id || o.of_odoo_id) return false;
              return saoPedidosIguais(o.numero_pedido, pedido.numero_pedido);
            });
            const opReal = localizarOpDoItem(item, opsDoPed, [item]);
            if (opReal && opReal.status === "finalizado") {
              isConcluido = true;
            }
          }
          return { ...entry, isConcluido };
        });

        const itensAtivos = itensCompletos.filter(it => !it.isConcluido);
        const itensConcluidos = itensCompletos.filter(it => it.isConcluido);

        return {
          espessura,
          itens: itensCompletos,
          itensAtivos,
          itensConcluidos,
          totalItens: itensCompletos.length
        };
      });
  }, [filaBase, naoDistribuidos, todosPedidosCD, ordensMaquina, ordensDesb, filtroUrgencia, ordenacao, filtroDataCampo, dataInicio, dataFim, termoBusca]);

  const handleAtualizar = async (pedido, idx, updates) => {
    setAtualizando(`${pedido.id}-${idx}`);
    try {
      const itens = getItens(pedido);
      itens[idx] = { ...itens[idx], ...updates };
      const percentual = computePercentual(itens);
      const status_pcp = statusPcpPorPercentual(percentual, pedido.status_pcp);
      await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: buildItensJson(itens),
        percentual_concluido: percentual,
        status_pcp
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    } catch (e) {
      toast({ title: "Erro ao atualizar item", description: e.message, variant: "destructive" });
    } finally {
      setAtualizando(null);
    }
  };

  // Retirar da Máquina: cancela a OP alocada na máquina e devolve o item para a fila (não distribuído)
  const handleRetirarDaMaquina = async () => {
    if (!retirarModal) return;
    const { pedido, idx, op } = retirarModal;
    setAtualizando(`${pedido.id}-${idx}`);
    try {
      const isDesb = String(op.maquina || "").startsWith("DESBOBINADEIRA");
      if (isDesb) {
        await base44.entities.OrdemDesbobinadeira.update(op.id, { status: "cancelado" });
      } else {
        await base44.entities.OrdemMaquinaCD.update(op.id, { status: "cancelado" });
      }
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd-todas"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desb-todas"] });
      // Reseta o item: volta a ficar não distribuído / pendente
      await handleAtualizar(pedido, idx, { maquina: "", status: "pendente", concluido: false });
      toast({
        title: "Item retirado da máquina",
        description: `A OP em ${op.maquina} foi cancelada e o item voltou para a fila do PCP.`
      });
    } catch (e) {
      toast({ title: "Erro ao retirar da máquina", description: e.message, variant: "destructive" });
    } finally {
      setAtualizando(null);
      setRetirarModal(null);
    }
  };

  // Renderizador individual de cada card de peça/item de C&D
  const renderItemCard = ({ pedido, item, idx }) => {
    const opsDoPedido = [...ordensMaquina, ...ordensDesb].filter(o => {
      if (!o.numero_pedido || String(o.status || "").toLowerCase() === "cancelado") return false;
      if (o.pedido_odoo_id && pedido?.id) return o.pedido_odoo_id === pedido.id;
      if (pedido?.of_odoo_id && o.of_odoo_id) return String(o.of_odoo_id).trim().toUpperCase() === String(pedido.of_odoo_id).trim().toUpperCase();
      if (o.pedido_odoo_id || o.of_odoo_id) return false;
      return saoPedidosIguais(o.numero_pedido, pedido.numero_pedido);
    });
    const opReal = localizarOpDoItem(item, opsDoPedido, [item]);
    const itemDistribuido = itemEstaDistribuido(
      item,
      opReal,
      pedido,
      getItens(pedido).some(i => i.distribuido === true || i.distribuido === false)
    );

    let statusItem = "pendente";
    let maquinaItem = item.maquina || "";

    if (opReal) {
      maquinaItem = opReal.maquina || maquinaItem;
      if (opReal.status === "finalizado") {
        statusItem = "concluido";
      } else if (["em_producao", "pausado", "aguardando_corte", "pendente"].includes(opReal.status)) {
        statusItem = "em_producao";
      }
    }

    if (item.concluido) {
      statusItem = "concluido";
    }

    const st = STATUS_ITEM[statusItem] || STATUS_ITEM.pendente;
    const emProd = statusItem === "em_producao";
    const concluido = statusItem === "concluido";
    const key = `${pedido.id}-${idx}`;

    // ── CÁLCULO DE DATA E URGÊNCIA ──
    const dataAlvoUrgencia = pedido.data_previsao_fabrica || pedido.data_entrega;
    const restantes = diasUteisRestantes(dataAlvoUrgencia);
    const urgencia = urgenciaPrazo(dataAlvoUrgencia, { concluido });
    const isAtrasado = restantes != null && restantes < 0;
    const isHoje = restantes === 0;
    const isAmanha = restantes === 1;
    const isPrioritario = Boolean(pedido.prioridade);

    const ordensDoPedido = ordensMaquina.filter(o => {
      if (!o.numero_pedido) return false;
      return saoPedidosIguais(o.numero_pedido, pedido.numero_pedido);
    });

    const unidItem = normalizarUnidadeMedidaItem(item, "cd");
    const descItem = item.descricao || item.produto;
    const espItem = extrairEspecificacao(descItem, item.quantidade, unidItem) || {};

    return (
      <div
        key={key}
        className={`rounded-xl border transition-all p-3.5 space-y-2.5 relative overflow-hidden shadow-2xs bg-card ${
          concluido
            ? "bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-300"
            : isPrioritario
            ? "border-l-4 border-l-amber-500 border-amber-300 hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
            : isAtrasado
            ? "border-l-4 border-l-red-600 ring-1 ring-red-400/20 border-red-300 dark:border-red-900/50 hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
            : isHoje || isAmanha
            ? "border-l-4 border-l-amber-500 border-amber-300 hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
            : "border-l-4 border-l-orange-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
        }`}
      >
        <div className="relative z-10 space-y-2.5">
          {/* ══════════════ PAINEL HERO: ONDE ESTÁ & STATUS EM MÁXIMA EVIDÊNCIA ══════════════ */}
          <LocalizacaoStatusHero
            pedido={pedido}
            ops={ordensDoPedido}
            percentual={concluido ? 100 : (emProd ? 50 : 0)}
            setor="cd"
          />

          {/* Instrução do Vendedor */}
          <InstrucaoVendedorCard
            descricao={item.descricao || item.produto}
            quantidadeOdoo={item.quantidade}
            espessura={item.espessura}
            unidade={normalizarUnidadeMedidaItem(item, "cd")}
          />

          {/* Cabeçalho do Item */}
          <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <CroquiThumb pedido={pedido} alt={`Croqui #${pedido.numero_pedido}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {isPrioritario && (
                    <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-[10px] gap-0.5 px-1.5 py-0">
                      <Star className="w-2.5 h-2.5 fill-white" /> URGENTE
                    </Badge>
                  )}
                  <span className="font-extrabold text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    #{pedido.numero_pedido}
                  </span>
                  {pedido.of_nome && (
                    <Badge variant="outline" className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
                      OF: {pedido.of_nome}
                    </Badge>
                  )}
                  {(contagemPorPedido.get(String(pedido.numero_pedido || "").trim()) || 1) > 1 && (
                    <Badge
                      className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40 text-[10px] font-bold shrink-0"
                      title="Este número de pedido possui múltiplas OFs/itens na fila"
                    >
                      <Layers className="w-3 h-3 mr-0.5" /> {contagemPorPedido.get(String(pedido.numero_pedido || "").trim())} itens deste pedido
                    </Badge>
                  )}
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {item.produto || "—"}
                  </span>
                  <BadgeDistribuicaoItem distribuido={itemDistribuido} maquina={maquinaItem} />
                  <Badge className={`shrink-0 border text-[10px] font-bold px-2 py-0.5 ${st.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot} mr-1.5`} />
                    {st.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {pedido.cliente_nome || "—"}
                  </span>
                  <span>Medida: <strong>{item.medida || espItem?.dimensoes_fmt || "—"}</strong></span>
                  <span>
                    Quantidade:{" "}
                    <strong className="text-orange-600">
                      {espItem?.quantidade ? `${espItem.quantidade} pçs` : `${item.quantidade}x`}
                    </strong>
                    {unidItem === "KG" && item.quantidade != null && (
                      <span className="text-slate-400 font-normal ml-1">({item.quantidade} KG)</span>
                    )}
                    {unidItem === "MT" && espItem.quantidade && espItem.quantidade !== item.quantidade && (
                      <span className="text-slate-400 font-normal ml-1">({item.quantidade} MT)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Data e SLA do Item */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <Calendar className="w-3 h-3 text-blue-600" />
                <span>Entrega:</span>
                <strong>{formatDataBR(pedido.data_entrega)}</strong>
              </div>

              {pedido.data_previsao_fabrica && (
                <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/40 px-2 py-0.5 rounded border border-orange-300 text-[11px] font-semibold text-orange-900 dark:text-orange-200">
                  <Factory className="w-3 h-3 text-orange-600" />
                  <span>Fábrica:</span>
                  <strong>{formatDataBR(pedido.data_previsao_fabrica)}</strong>
                </div>
              )}

              <SlaCountdownBadge
                dataPrometida={pedido.data_entrega}
                dataPrevisaoFabrica={pedido.data_previsao_fabrica}
              />
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPedidoPrazoModal(pedido)}
              className="h-6 text-[11px] font-bold text-orange-700 dark:text-orange-300 gap-1 hover:bg-orange-100/60 ml-auto"
            >
              <CalendarClock className="w-3 h-3 text-orange-600" />
              Ajustar Prazo Fabril
            </Button>
          </div>

          {/* Checklist individual: máquina + medição + qtd produzida */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Select
              value={maquinaItem || ""}
              onValueChange={(v) => handleAtualizar(pedido, idx, { maquina: v })}
              disabled={concluido}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs font-semibold">
                <SelectValue placeholder="Selecionar máquina..." />
              </SelectTrigger>
              <SelectContent>
                {MAQUINAS_CD.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
              </SelectContent>
            </Select>

            <Input
              type="text"
              placeholder="Medição (mm)"
              defaultValue={item.medicao || ""}
              onBlur={(e) => {
                const val = e.target.value;
                if (val !== (item.medicao || "")) {
                  handleAtualizar(pedido, idx, { medicao: val });
                }
              }}
              className="h-8 w-28 text-xs font-mono"
              disabled={concluido}
            />

            <Input
              type="number"
              min="0"
              placeholder="Qtd produzida"
              defaultValue={item.quantidade_produzida || ""}
              onBlur={(e) => {
                const val = Number(e.target.value || 0);
                if (val !== (item.quantidade_produzida || 0)) {
                  handleAtualizar(pedido, idx, { quantidade_produzida: val });
                }
              }}
              className="h-8 w-28 text-xs font-bold"
              disabled={concluido}
            />

            {/* Botão Selecionar Chapa / Bobina */}
            {item.material_codigo ? (
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {item.material_codigo} {item.material_dimensoes ? `(${item.material_dimensoes})` : ""}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMaterialModal({ pedido, item, idx })}
                  className="h-5 px-1.5 text-[10px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-500/20 font-bold"
                  title="Trocar ou desvincular material"
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMaterialModal({ pedido, item, idx })}
                className="h-8 text-xs font-semibold gap-1.5 border-dashed border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
              >
                <Layers className="w-3.5 h-3.5" />
                Selecionar Chapa / Bobina
              </Button>
            )}

            {/* Botão Revisar Ordem */}
            {onNovaOrdem && (
              <Button
                size="sm"
                onClick={() => {
                  notificarStatus(pedido, "revisando_ordem", {
                    status_novo: "em_revisao",
                    item_nome: item.produto || item.descricao || "",
                    maquina_atual: maquinaItem || "Corte & Dobra"
                  });
                  onNovaOrdem(pedido, {
                    ...item,
                    _idx: item._idx != null ? item._idx : idx,
                    maquina: maquinaItem,
                    data: item.data_programada || pedido.data_previsao_fabrica || pedido.data_entrega,
                    existingOp: opReal || null
                  });
                }}
                className="h-8 text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shrink-0 shadow-xs gap-1"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Revisar Ordem {maquinaItem ? `[${maquinaItem}]` : ""}</span>
              </Button>
            )}

            {/* Botão Retirar da Máquina — cancela a OP alocada e devolve o item à fila */}
            {canRetirarDaMaquina && opReal && !concluido && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRetirarModal({ pedido, item, idx, op: opReal })}
                disabled={atualizando === `${pedido.id}-${idx}`}
                className="h-8 text-xs font-bold gap-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
                title="Cancela a OP nesta máquina e devolve o item para a fila do PCP"
              >
                <PackageX className="w-3.5 h-3.5" />
                <span>Retirar da Máquina</span>
              </Button>
            )}

            {concluido && (
              <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40 text-[10px] font-bold h-8 px-2 gap-1 ml-auto">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Concluído
              </Badge>
            )}

            {isAdmin && !concluido && (
              <FinalizarItemRapidoButton
                carregando={atualizando === `${pedido.id}-${idx}`}
                onFinalizar={() => handleAtualizar(pedido, idx, { status: "concluido", concluido: true })}
                className="ml-auto"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      {/* ══════════════ CABEÇALHO EXECUTIVO E BARRA AVANÇADA DE FILTROS PCP ══════════════ */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Fila PCP — Aguardando Produção (Corte & Dobra)
              </h2>
              <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 font-bold text-xs">
                {contadores.total} pedido(s)
              </Badge>
              {isFetching && (
                <span className="text-[11px] text-sky-600 dark:text-sky-400 flex items-center gap-1 font-semibold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ordens de corte, dobra e perfis com controle de prazos, pesquisa rápida e filtros de data
            </p>
          </div>
        </div>

        <FiltrosDataPCPBar
          termoBusca={termoBusca}
          onBuscaChange={setTermoBusca}
          placeholderBusca="Buscar pedido, cliente, chapa, vendedor..."
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
        />
      </div>

      {/* ══════════════ LISTA DE GRUPOS POR BITOLA ══════════════ */}
      {isLoading && pedidos.length === 0 ? (
        <div className="p-8 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sincronizando fila de produção Corte & Dobra...</span>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-card/60 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
              <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : gruposEspessura.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Nenhum pedido de Corte & Dobra nos filtros atuais
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {filtroUrgencia !== "todos" || dataInicio || dataFim || termoBusca
              ? "Experimente limpar os filtros ou alterar o intervalo de datas."
              : "Não há ordens aguardando produção neste setor."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {gruposEspessura.map(grupo => {
            const isAberto = Boolean(finalizadosPorGrupo[grupo.espessura] || termoBusca.trim());
            return (
              <div key={grupo.espessura} className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Layers className="w-4 h-4 text-sky-500" />
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Chapa / Bitola {grupo.espessura}mm
                  </span>
                  <Badge variant="outline" className="text-[11px] font-bold text-sky-700 dark:text-sky-300 border-sky-300 bg-sky-50 dark:bg-sky-950/40">
                    {grupo.itensAtivos.length} peça(s) a produzir
                  </Badge>
                  {grupo.itensConcluidos.length > 0 && (
                    <Badge variant="outline" className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
                      {grupo.itensConcluidos.length} concluída(s) ✓
                    </Badge>
                  )}
                  <span className="text-[10px] text-slate-400 ml-auto hidden sm:inline">
                    ↑ Setup de bobina agrupado por bitola
                  </span>
                </div>

                {/* 1. Itens Ativos (A Produzir) */}
                {grupo.itensAtivos.length === 0 && grupo.itensConcluidos.length > 0 ? (
                  <div className="p-4 text-center rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Todas as {grupo.itensConcluidos.length} peças desta bitola já foram produzidas/concluídas!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {grupo.itensAtivos.map(renderItemCard)}
                  </div>
                )}

                {/* 2. Peças Concluídas / Finalizadas (Minimizadas no final da lista) */}
                {grupo.itensConcluidos.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleFinalizadosGrupo(grupo.espessura)}
                      className="flex items-center justify-between p-3 bg-slate-100/90 dark:bg-slate-850 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-xl cursor-pointer select-none transition-all border border-slate-200/80 dark:border-slate-700/80"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                              Peças Concluídas / Finalizadas (Bitola {grupo.espessura}mm)
                            </span>
                            <Badge variant="outline" className="text-[10px] font-bold bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-300">
                              {grupo.itensConcluidos.length}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {isAberto
                              ? "Lista expandida — Clique para recolher e manter minimizado"
                              : "Minimizadas no final da fila — Clique para expandir detalhes"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <span>{isAberto ? "Minimizar" : "Expandir"}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAberto ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    {isAberto && (
                      <div className="space-y-3 pt-3 opacity-90">
                        {grupo.itensConcluidos.map(renderItemCard)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Seleção e Reserva de Chapa / Bobina */}
      {materialModal && (
        <SelecionarMaterialPedidoDialog
          open={Boolean(materialModal)}
          onOpenChange={(aberto) => { if (!aberto) setMaterialModal(null); }}
          pedido={materialModal.pedido}
          item={materialModal.item}
          idx={materialModal.idx}
          onMaterialVinculado={() => setMaterialModal(null)}
        />
      )}

      {/* Diálogo de confirmação — Retirar da Máquina */}
      <AlertDialog open={Boolean(retirarModal)} onOpenChange={(aberto) => { if (!aberto) setRetirarModal(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar da Máquina?</AlertDialogTitle>
            <AlertDialogDescription>
              {retirarModal && (
                <>
                  A OP <strong>{retirarModal.op.numero_pedido || "da ordem"}</strong> em{" "}
                  <strong>{retirarModal.op.maquina}</strong> será <strong>cancelada</strong> e o item
                  {" "}<strong>{retirarModal.item.produto || ""}</strong> do pedido{" "}
                  <strong>#{retirarModal.pedido.numero_pedido}</strong> voltará para a fila do PCP
                  (não distribuído). Esta ação não pode ser desfeita automaticamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={atualizando === (retirarModal ? `${retirarModal.pedido.id}-${retirarModal.idx}` : null)}>Manter na Máquina</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRetirarDaMaquina(); }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <PackageX className="w-4 h-4 mr-1" />
              {atualizando === (retirarModal ? `${retirarModal.pedido.id}-${retirarModal.idx}` : null) ? "Retirando..." : "Sim, Retirar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Alteração de Prazo Fabril */}
      {pedidoPrazoModal && (
        <AlterarPrazoFabrilDialog
          open={Boolean(pedidoPrazoModal)}
          onOpenChange={(aberto) => { if (!aberto) setPedidoPrazoModal(null); }}
          pedido={pedidoPrazoModal}
          onPrazoAlterado={() => {
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
            setPedidoPrazoModal(null);
          }}
        />
      )}
    </div>
  );
}