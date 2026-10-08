import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Play, CheckCircle2, Inbox, Factory, Calendar, User, Loader2, Plus,
  AlertTriangle, Star, CalendarClock, Clock, Search, ArrowUpDown, Flame,
  Store, Building2, Layers, XCircle, Zap, CheckSquare, Square,
  Undo2, ShieldAlert, Sparkles, PackageCheck, Trash2, ExternalLink, FileText, Send
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import ProducaoEmLoteModal from "@/components/pcp/ProducaoEmLoteModal";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";
import {
  isAutoRoteamentoTelhasAtivo,
  setAutoRoteamentoTelhasAtivo,
  rotearPedidoTelhaDiretoParaMaquina,
  processarLoteAutoRoteamentoTelhas
} from "@/lib/autoBobinaTelhasHelper";
import {
  getItens, itensPorGrupo, computePercentual, computePercentualGrupo,
  buildItensJson, statusPcpPorPercentual, STATUS_ITEM, saoPedidosIguais,
  localizarOpDoItem, normalizarUnidadeMedidaItem
} from "@/lib/pedidoOdooHelper";
import { formatDataBR, slaDiasPorCategoria, diasUteisRestantes } from "@/lib/sla";
import { urgenciaPrazo } from "@/lib/prazoUrgencia";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import AlterarPrazoFabrilDialog from "@/components/pcp/AlterarPrazoFabrilDialog";
import { notificarStatus } from "@/lib/biNotificador";
import { useFilial } from "@/contexts/FilialContext";
import FiltrosDataPCPBar from "@/components/pcp/FiltrosDataPCPBar";
import LocalizacaoStatusHero from "@/components/pcp/LocalizacaoStatusHero";
import BadgeDistribuicaoItem, { itemEstaDistribuido } from "@/components/pcp/BadgeDistribuicaoItem";
import FinalizarItemRapidoButton from "@/components/pcp/FinalizarItemRapidoButton";
import {
  extrairDataISO,
  calcularIntervaloPreset,
  obterDataCampoPedido,
  ordenarPedidosPCP
} from "@/lib/filtroDataHelper";

export default function FilaPCPTelhas({ onNovaOrdem }) {
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
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [modalLoteOpen, setModalLoteOpen] = useState(false);
  const [senhaFinalizarOpen, setSenhaFinalizarOpen] = useState(false);
  const [pedidoParaFinalizar100, setPedidoParaFinalizar100] = useState(null);
  const [autoRoteamentoAtivo, setAutoRoteamentoAtivo] = useState(() => isAutoRoteamentoTelhasAtivo());
  const [processandoAutoRoteamento, setProcessandoAutoRoteamento] = useState(false);

  const filialCtx = useFilial();
  const filialAtiva = filialCtx?.filialAtiva;
  // Finalização rápida de item — exclusiva de administradores
  const isAdmin = ["admin", "super_admin"].includes(filialCtx?.user?.role);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-odoo-telhas"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 200),
    refetchInterval: 10000
  });

  // Consulta as Ordens de Produção reais nas máquinas da fábrica
  const { data: pedidosProducao = [] } = useQuery({
    queryKey: ["pedidos-producao-todos"],
    queryFn: () => base44.entities.Pedido.list("-data", 500),
    refetchInterval: 10000
  });

  // Consulta estoque de Bobinas de Telhas para seleção automática minuciosa
  const { data: bobinasEstoque = [] } = useQuery({
    queryKey: ["bobinas-estoque-telhas-pcp"],
    queryFn: () => base44.entities.Bobina.list("-created_date", 400),
    refetchInterval: 12000
  });

  // Consulta tolerâncias configuradas de espessura
  const { data: tolerancias = [] } = useQuery({
    queryKey: ["tolerancias-espessura"],
    queryFn: () => base44.entities.ToleranciaEspessura.list().catch(() => []),
    staleTime: 60000
  });

  const MAQUINAS_TELHAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];

  const isOpDeTelhas = (op) => {
    if (!op) return false;
    const maq = String(op.maquina || "").toUpperCase();
    if (MAQUINAS_TELHAS.some(m => maq.includes(m.replace(/\s+/g, "")) || maq.includes(m))) return true;
    const prod = String(op.produto || "").toUpperCase();
    if (/(TELHA|CUMEEIRA|BOBININHA|BANDEJA|COLAGEM|PAINEL)/i.test(prod)) return true;
    return false;
  };

  const buscarOpsDoPedido = (pedido, producaoList = []) => {
    if (!pedido || !producaoList || producaoList.length === 0) return [];
    if (pedido._isOpAvulsa && pedido._opOrigem) return [pedido._opOrigem];

    return producaoList.filter(op => {
      if (!op || String(op.status || "").toLowerCase() === "cancelado") return false;
      if (op.pedido_odoo_id && pedido?.id) {
        return op.pedido_odoo_id === pedido.id;
      }
      if (pedido?.of_odoo_id && op.of_odoo_id) {
        return String(op.of_odoo_id).trim().toUpperCase() === String(pedido.of_odoo_id).trim().toUpperCase();
      }
      if (saoPedidosIguais(op.numero_pedido, pedido.numero_pedido)) return true;
      if (op.cliente && pedido.cliente_nome && op.cliente.trim().toUpperCase() === pedido.cliente_nome.trim().toUpperCase()) {
        if (!op.pedido_odoo_id) return true;
      }
      return false;
    });
  };

  // 1. Filtragem base da filial e dos itens do setor de Telhas (com suporte a OPs da fábrica)
  const filaBase = useMemo(() => {
    // A. Pedidos do Odoo
    const listaOdoo = pedidos.filter(p => {
      const atendeFilial = !filialAtiva || filialAtiva === "todas" || (p.unidade || "Matriz AJL") === filialAtiva;
      if (!atendeFilial) return false;

      const telhas = itensPorGrupo(getItens(p), "telha");
      const temItensTelha = telhas.length > 0;
      const ops = buscarOpsDoPedido(p, pedidosProducao);
      const temOpFabrica = ops.length > 0;

      // Se não tem itens de telha nem OP de telha na máquina, descarta
      if (!temItensTelha && !temOpFabrica) return false;

      // Se já possui OP ativa na fábrica (ex: TP - 40), DEVE aparecer na fila PCP
      if (temOpFabrica) return true;

      // Se o usuário está buscando por texto, permite encontrar qualquer pedido de telha
      if (termoBusca.trim()) return true;

      // Caso padrão do PCP: pedidos distribuídos ou em produção
      if (["distribuido", "em_producao"].includes(p.status_pcp)) return true;

      return telhas.some(it => ["distribuido", "em_producao", "concluido"].includes(it.status) || it.distribuido === true);
    });

    // B. OPs criadas diretamente no chão de fábrica (tabela Pedido) que não vieram do Odoo
    const opsJaVinculadas = new Set();
    listaOdoo.forEach(p => {
      const ops = buscarOpsDoPedido(p, pedidosProducao);
      ops.forEach(op => opsJaVinculadas.add(op.id));
    });

    const opsAvulsas = pedidosProducao.filter(op => {
      if (!op.id || opsJaVinculadas.has(op.id)) return false;
      if (String(op.status || "").toLowerCase() === "cancelado") return false;
      if (!isOpDeTelhas(op)) return false;
      const atendeFilial = !filialAtiva || filialAtiva === "todas" || (op.unidade || "Matriz AJL") === filialAtiva;
      return atendeFilial;
    });

    const pedidosAvulsosFabrica = opsAvulsas.map(op => {
      const qtd = Number(op.qtd_telhas || op.quantidade) || 1;
      const met = Number(op.metros) || (Number(op.metragem_mm) ? +(Number(op.metragem_mm) / 1000).toFixed(2) : 1);
      const descItem = op.descricao || `${qtd} peças ${op.metragem_mm ? `x ${op.metragem_mm}mm` : (op.metros ? `x ${op.metros}m` : "")}`.trim();
      const itemSintetico = {
        _idx: 0,
        produto: op.produto || `TELHA (Máquina ${op.maquina || "TP - 40"})`,
        descricao: descItem,
        medida: op.metragem_mm ? `${op.metragem_mm}mm` : `${met}m`,
        quantidade: met,
        espessura: op.espessura || op.chapa || "0.43",
        maquina: op.maquina || "TP - 40",
        status: op.status === "finalizado" ? "concluido" : (op.status || "em_producao"),
        distribuido: true
      };

      return {
        id: `op_${op.id}`,
        _isOpAvulsa: true,
        _opOrigem: op,
        numero_pedido: op.numero_pedido || op.id?.slice(-6)?.toUpperCase(),
        of_nome: op.of_odoo_id || `OP ${op.maquina || "Fábrica"}`,
        cliente_nome: op.cliente || "Cliente Balcão",
        vendedor_nome: op.vendedor || "—",
        unidade: op.unidade || "Matriz AJL",
        data_entrega: op.data || op.created_date,
        data_previsao_fabrica: op.data_previsao || op.data,
        data_recebimento: op.created_date || op.data,
        status_pcp: op.status === "finalizado" ? "concluido" : "em_producao",
        prioridade: Boolean(op.prioridade),
        itens: [itemSintetico],
        itens_json: JSON.stringify([itemSintetico]),
        percentual_concluido: op.status === "finalizado" ? 100 : (op.status === "em_producao" ? 50 : 30)
      };
    });

    return [...listaOdoo, ...pedidosAvulsosFabrica];
  }, [pedidos, pedidosProducao, filialAtiva, termoBusca]);

  // Pedidos de Telhas ainda NÃO distribuídos (status_pcp = pendente_distribuicao)
  const naoDistribuidos = useMemo(() => {
    return pedidos.filter(p => {
      if (p.status_pcp !== "pendente_distribuicao") return false;
      if (filialAtiva && filialAtiva !== "todas" && (p.unidade || "Matriz AJL") !== filialAtiva) return false;
      return itensPorGrupo(getItens(p), "telha").length > 0;
    });
  }, [pedidos, filialAtiva]);

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

  // Contadores executivos de prazo para os botões de filtro rápido
  const contadores = useMemo(() => {
    let atrasados = 0;
    let hojeAmanha = 0;
    let prioritarios = 0;

    filaBase.forEach(p => {
      if (p.prioridade) prioritarios++;
      const dataAlvo = p.data_previsao_fabrica || p.data_entrega;
      const d = diasUteisRestantes(dataAlvo);
      if (d != null && !isNaN(d)) {
        if (d < 0) atrasados++;
        else if (d <= 1) hojeAmanha++;
      }
    });

    return {
      total: filaBase.length,
      atrasados,
      hojeAmanha,
      prioritarios,
      naoDistribuidos: naoDistribuidos.length
    };
  }, [filaBase, naoDistribuidos]);

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

  // 2. Aplicação de busca, filtros de urgência e filtro de período de datas
  const filaFiltrada = useMemo(() => {
    let lista = filtroUrgencia === "nao_distribuidos" ? [...naoDistribuidos] : [...filaBase];

    // Busca textual inteligente e sem falsos positivos de IDs internos
    if (termoBusca.trim()) {
      const q = termoBusca.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, "");

      lista = lista.filter(p => {
        // 1. Número do pedido (exato, substring ou match numérico de loja)
        const num = String(p.numero_pedido || "").toLowerCase().trim();
        const numDigits = num.replace(/\D/g, "");
        if (num.includes(q)) return true;
        if (qDigits && numDigits) {
          if (numDigits === qDigits) return true;
          if (numDigits.endsWith(qDigits) || qDigits.endsWith(numDigits)) return true;
          if (saoPedidosIguais(num, q)) return true;
        }

        // 2. OF e IDs Odoo
        const ofNome = String(p.of_nome || "").toLowerCase();
        const ofOdooId = String(p.of_odoo_id || "").toLowerCase();
        const odooId = String(p.odoo_id || "").toLowerCase();
        if (ofNome.includes(q) || ofOdooId.includes(q) || odooId.includes(q)) return true;

        // 3. Cliente e Vendedor
        const cliente = String(p.cliente_nome || p.cliente || "").toLowerCase();
        const vendedor = String(p.vendedor_nome || p.vendedor || "").toLowerCase();
        if (cliente.includes(q) || vendedor.includes(q)) return true;

        // 4. OPs reais da fábrica associadas a este pedido
        const ops = buscarOpsDoPedido(p, pedidosProducao);
        for (const op of ops) {
          const opNum = String(op.numero_pedido || "").toLowerCase().trim();
          const opNumDigits = opNum.replace(/\D/g, "");
          if (opNum.includes(q)) return true;
          if (qDigits && opNumDigits && (opNumDigits === qDigits || opNumDigits.endsWith(qDigits) || qDigits.endsWith(opNumDigits))) return true;
          if (String(op.cliente || "").toLowerCase().includes(q)) return true;
          if (String(op.vendedor || "").toLowerCase().includes(q)) return true;
          if (String(op.maquina || "").toLowerCase().includes(q)) return true;
          if (String(op.bobina_superior || "").toLowerCase().includes(q)) return true;
          if (String(op.produto || "").toLowerCase().includes(q)) return true;
        }

        // 5. Itens limpos (texto legível de produto/medida, SEM varrer JSON bruto)
        const itens = getItens(p);
        for (const it of itens) {
          const prod = String(it.produto || "").toLowerCase();
          const desc = String(it.descricao || "").toLowerCase();
          const med = String(it.medida || "").toLowerCase();
          const obs = String(it.observacao || "").toLowerCase();
          if (prod.includes(q) || desc.includes(q) || med.includes(q) || obs.includes(q)) return true;
        }

        return false;
      });
    }

    // Filtros de urgência
    if (filtroUrgencia === "mais_atrasados") {
      lista = lista.filter(p => {
        const d = diasUteisRestantes(p.data_previsao_fabrica || p.data_entrega);
        return d != null && d < 0;
      });
    } else if (filtroUrgencia === "hoje_amanha") {
      lista = lista.filter(p => {
        const d = diasUteisRestantes(p.data_previsao_fabrica || p.data_entrega);
        return d != null && (d === 0 || d === 1);
      });
    } else if (filtroUrgencia === "prioritarios") {
      lista = lista.filter(p => Boolean(p.prioridade));
    }

    // Filtro por período de datas (Data X até Data Y)
    if (dataInicio || dataFim) {
      lista = lista.filter(p => {
        const valData = obterDataCampoPedido(p, filtroDataCampo);
        const dataIso = extrairDataISO(valData);
        if (!dataIso) return false;
        if (dataInicio && dataIso < dataInicio) return false;
        if (dataFim && dataIso > dataFim) return false;
        return true;
      });
    }

    // 3. Ordenação inteligente
    return ordenarPedidosPCP(lista, ordenacao);
  }, [filaBase, naoDistribuidos, termoBusca, filtroUrgencia, ordenacao, filtroDataCampo, dataInicio, dataFim]);

  // Itens elegíveis para envio em lote (itens pendentes / não concluídos da fila atual)
  const todosItensPendentes = useMemo(() => {
    const list = [];
    filaFiltrada.forEach(pedido => {
      const itens = getItens(pedido);
      const telhas = itensPorGrupo(itens, "telha");
      const opsDoPedido = buscarOpsDoPedido(pedido, pedidosProducao);
      telhas.forEach((item, idx) => {
        const opDoItem = localizarOpDoItem(item, opsDoPedido, telhas);
        const isConcluido = (opDoItem && opDoItem.status === "finalizado") || item.status === "concluido";
        if (!isConcluido) {
          const itemIdx = item._idx != null ? item._idx : idx;
          list.push({
            key: `${pedido.id}_${itemIdx}`,
            pedido,
            item,
            idx: itemIdx
          });
        }
      });
    });
    return list;
  }, [filaFiltrada, pedidosProducao]);

  // Itens de telha que ainda NÃO possuem OP criada em máquina na fábrica
  const itensTelhasSemOp = useMemo(() => {
    const list = [];
    filaFiltrada.forEach(pedido => {
      if (pedido._isOpAvulsa) return;
      const itens = getItens(pedido);
      const telhas = itensPorGrupo(itens, "telha");
      const opsDoPedido = buscarOpsDoPedido(pedido, pedidosProducao);
      telhas.forEach((item, idx) => {
        const op = localizarOpDoItem(item, opsDoPedido, telhas);
        const hasOpValida = op && op.status !== "cancelado";
        const isConcluido = item.status === "concluido" || (op && op.status === "finalizado");
        if (!hasOpValida && !isConcluido) {
          const itemIdx = item._idx != null ? item._idx : idx;
          list.push({ pedido, item, itemIdx, key: `${pedido.id}_${itemIdx}` });
        }
      });
    });
    return list;
  }, [filaFiltrada, pedidosProducao]);

  const handleToggleAutoRoteamento = (checked) => {
    setAutoRoteamentoAtivo(checked);
    setAutoRoteamentoTelhasAtivo(checked);
    toast({
      title: checked ? "⚡ Piloto Automático Ativado!" : "Piloto Automático Desativado",
      description: checked
        ? "Pedidos de telhas serão direcionados às máquinas com seleção automática de bobina compatível."
        : "Distribuição automática de telhas pausada. Modo manual mantido.",
      className: checked ? "border-amber-500/40" : undefined
    });
  };

  // ── AUTO-ROTEAR ITEM INDIVIDUAL PARA MÁQUINA COM SELEÇÃO DE BOBINA ──
  const handleAutoRotearItem = async (pedido, item, itemIdx) => {
    setAtualizando(`auto-rotear-${pedido.id}-${itemIdx}`);
    try {
      const res = await rotearPedidoTelhaDiretoParaMaquina({
        pedido,
        item,
        itemIdx,
        todasBobinas: bobinasEstoque,
        filialAtiva: pedido.unidade || filialAtiva,
        tolerancias
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-telhas-pcp"] });

      if (res.bobina) {
        toast({
          title: `⚡ Enviado para ${res.maquina}!`,
          description: `Bobina ${res.bobina.codigo} (${res.bobina.cor || 'Natural'} - Chapa ${res.bobina.espessura}) vinculada automaticamente.`,
          className: "border-emerald-500/40"
        });
      } else {
        toast({
          title: `⚠️ Enviado para ${res.maquina} sem bobina`,
          description: `Nenhuma bobina compatível em estoque. OP criada aguardando seleção manual na máquina.`,
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Erro ao rotear item",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setAtualizando(null);
    }
  };

  // ── AUTO-ROTEAR TODOS OS ITENS DE TELHA DE UM PEDIDO ──
  const handleAutoRotearPedido = async (pedido) => {
    setAtualizando(`auto-rotear-ped-${pedido.id}`);
    try {
      const itens = getItens(pedido);
      const telhas = itensPorGrupo(itens, "telha");
      const opsDoPedido = buscarOpsDoPedido(pedido, pedidosProducao);

      let vinculados = 0;
      let bobinasCount = 0;

      for (let i = 0; i < itens.length; i++) {
        const it = itens[i];
        const ehTelha = telhas.some(t => (t._idx != null ? t._idx === i : t.produto === it.produto));
        if (!ehTelha) continue;

        const op = localizarOpDoItem(it, opsDoPedido, telhas);
        const hasOp = op && op.status !== "cancelado";
        if (hasOp || it.status === "concluido") continue;

        const res = await rotearPedidoTelhaDiretoParaMaquina({
          pedido,
          item: it,
          itemIdx: i,
          todasBobinas: bobinasEstoque,
          filialAtiva: pedido.unidade || filialAtiva,
          tolerancias
        });
        vinculados++;
        if (res.bobina) bobinasCount++;
      }

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-telhas-pcp"] });

      toast({
        title: `⚡ Pedido #${pedido.numero_pedido} roteado!`,
        description: `${vinculados} item(ns) enviado(s) para as máquinas (${bobinasCount} com bobina vinculada automaticamente).`,
        className: "border-emerald-500/40"
      });
    } catch (err) {
      toast({
        title: "Erro ao rotear pedido",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setAtualizando(null);
    }
  };

  // ── AUTO-ROTEAR EM LOTE TODOS OS ITENS PENDENTES DA FILA ──
  const handleAutoRotearLote = async () => {
    if (itensTelhasSemOp.length === 0) return;
    setProcessandoAutoRoteamento(true);
    try {
      let sucessos = 0;
      let comBobina = 0;
      const erros = [];

      for (const entry of itensTelhasSemOp) {
        try {
          const res = await rotearPedidoTelhaDiretoParaMaquina({
            pedido: entry.pedido,
            item: entry.item,
            itemIdx: entry.itemIdx,
            todasBobinas: bobinasEstoque,
            filialAtiva: entry.pedido.unidade || filialAtiva,
            tolerancias
          });
          sucessos++;
          if (res?.bobina) comBobina++;
        } catch (errItem) {
          console.warn("[AutoRotearLote] Falha ao rotear item:", errItem);
          erros.push(errItem.message || "Erro desconhecido");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-telhas-pcp"] });

      if (sucessos > 0) {
        toast({
          title: `🚀 Roteamento Automático Concluído!`,
          description: `${sucessos} item(ns) de telhas distribuídos para as máquinas (${comBobina} com bobina automática eleita).`,
          className: "border-emerald-500/40"
        });
      } else if (erros.length > 0) {
        toast({
          title: "Aviso no roteamento",
          description: `Erros: ${erros.slice(0, 2).join("; ")}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Itens sincronizados",
          description: "Nenhum novo item pendente para enviar às máquinas.",
        });
      }
    } catch (err) {
      toast({
        title: "Erro no auto-roteamento em lote",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setProcessandoAutoRoteamento(false);
    }
  };

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
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    } catch (e) {
      toast({ title: "Erro ao atualizar item", description: e.message, variant: "destructive" });
    } finally {
      setAtualizando(null);
    }
  };

  // ── DEVOLVER PEDIDO INTEIRO PARA A CENTRAL PCP (ESTORNO DE FILA) ──
  const handleDevolverPedidoCentralPCP = async (pedido) => {
    if (!window.confirm(
      `↩️ DEVOLVER PARA A CENTRAL PCP\n\nDeseja retirar o pedido #${pedido.numero_pedido} da fila das máquinas e devolvê-lo para a Central PCP?\n\n• As OPs vinculadas nas máquinas serão canceladas.\n• O pedido voltará para "Pendente de Distribuição" na Central PCP.`
    )) return;

    setAtualizando(`devolver-${pedido.id}`);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);

      // 1. Cancela Ordens de Produção vinculadas nas perfiladeiras/máquinas da fábrica
      try {
        const ops = await base44.entities.Pedido.filter({
          pedido_odoo_id: pedido.id
        }).catch(() => []);

        for (const op of ops) {
          if (op.status !== "finalizado" && op.status !== "cancelado") {
            await base44.entities.Pedido.update(op.id, {
              status: "cancelado",
              data_finalizacao: todayIso
            });
          }
        }
      } catch (errOps) {
        console.warn("[FilaPCPTelhas] Erro ao cancelar OPs locais:", errOps);
      }

      // 2. Reseta itens do pedido para pendente de máquina
      const itens = getItens(pedido);
      const itensZerados = itens.map(i => ({
        ...i,
        status: "pendente",
        status_detalhado: "Pendente de Distribuição",
        concluido: false,
        distribuido: false,
        maquina: ""
      }));

      // 3. Atualiza PedidoOdoo
      const logExistente = (() => {
        try { return JSON.parse(pedido.historico_log || "[]"); }
        catch { return []; }
      })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: filialCtx?.user?.full_name || filialCtx?.user?.email || "PCP",
        acao: "devolvido_central_pcp",
        detalhes: `Pedido #${pedido.numero_pedido} devolvido da Fila de Telhas para a Central PCP.`
      }];

      await base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "pendente_distribuicao",
        percentual_concluido: 0,
        maquinas_json: "[]",
        etapas_telha_json: "[]",
        itens_json: buildItensJson(itensZerados),
        historico_log: JSON.stringify(novoLog)
      });

      // 4. Notifica Mini BI
      await notificarStatus(pedido, "retirada_fila_galpao", {
        status_novo: "pendente_distribuicao",
        percentual_concluido: 0
      }).catch(() => {});

      // 5. Invalida queries
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });

      toast({
        title: "↩️ Pedido devolvido ao PCP!",
        description: `Pedido #${pedido.numero_pedido} retornou para a Central PCP com sucesso.`
      });
    } catch (err) {
      toast({
        title: "Erro ao devolver pedido",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setAtualizando(null);
    }
  };

  // ── DEVOLVER ITEM INDIVIDUAL PARA A CENTRAL PCP ──
  const handleDevolverItemCentralPCP = async (pedido, itemIdx) => {
    if (!window.confirm(`Deseja devolver este item do pedido #${pedido.numero_pedido} para a Central PCP?`)) return;

    setAtualizando(`devolver-item-${pedido.id}-${itemIdx}`);
    try {
      // 1. Cancela OP específica deste item se existir
      try {
        const ops = await base44.entities.Pedido.filter({
          pedido_odoo_id: pedido.id,
          item_idx: itemIdx
        }).catch(() => []);

        for (const op of ops) {
          if (op.status !== "finalizado" && op.status !== "cancelado") {
            await base44.entities.Pedido.update(op.id, {
              status: "cancelado"
            });
          }
        }
      } catch (errOp) {
        console.warn("[FilaPCPTelhas] Erro ao cancelar OP do item:", errOp);
      }

      // 2. Atualiza item no PedidoOdoo
      const itens = getItens(pedido);
      if (itens[itemIdx]) {
        itens[itemIdx] = {
          ...itens[itemIdx],
          status: "pendente",
          distribuido: false,
          maquina: ""
        };
      }
      const pct = computePercentual(itens);
      const statusPcp = statusPcpPorPercentual(pct, pedido.status_pcp);

      await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: buildItensJson(itens),
        percentual_concluido: pct,
        status_pcp: statusPcp
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });

      toast({
        title: "↩️ Item devolvido!",
        description: `Item devolvido para a triagem da Central PCP.`
      });
    } catch (err) {
      toast({
        title: "Erro ao devolver item",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setAtualizando(null);
    }
  };

  // ── FINALIZAR 100% FORÇADO COM SENHA DO GESTOR (PIN 0000) ──
  const solicitarFinalizar100 = (pedido) => {
    setPedidoParaFinalizar100(pedido);
    setSenhaFinalizarOpen(true);
  };

  const confirmarFinalizar100 = async () => {
    if (!pedidoParaFinalizar100) return;
    const pedido = pedidoParaFinalizar100;
    setAtualizando(`finalizar-100-${pedido.id}`);

    try {
      // 1. Marca todos os itens como concluído
      const itens = getItens(pedido).map(i => ({
        ...i,
        concluido: true,
        status: "concluido",
        status_detalhado: "Concluído"
      }));

      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: buildItensJson(itens),
        percentual_concluido: 100,
        status_pcp: "concluido"
      });

      // 2. Notifica Odoo ERP via webhook como concluído (100%)
      try {
        await notificarStatus(
          {
            ...pedido,
            ...atualizado,
            percentual_concluido: 100,
            status_pcp: "concluido",
            itens_json: buildItensJson(itens)
          },
          "concluido",
          {
            percentual_concluido: 100,
            status_novo: "concluido",
            item_nome: `Pedido #${pedido.numero_pedido}`
          }
        );
      } catch (notifErr) {
        console.warn("[FilaPCPTelhas] Falha ao notificar Odoo em finalizar 100%:", notifErr);
      }

      // 3. Finaliza OPs locais vinculadas na fábrica
      try {
        const opsTelhas = await base44.entities.Pedido.filter({ pedido_odoo_id: pedido.id }).catch(() => []);
        for (const op of opsTelhas) {
          if (op.status !== "finalizado" && op.status !== "cancelado") {
            await base44.entities.Pedido.update(op.id, { status: "finalizado", concluido: true });
          }
        }
      } catch (opErr) {
        console.warn("[FilaPCPTelhas] Falha ao finalizar OPs locais:", opErr);
      }

      toast({
        title: "⚡ Pedido 100% Concluído!",
        description: `Pedido #${pedido.numero_pedido} marcado como 100% concluído e sincronizado com o Odoo ERP.`
      });

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    } catch (e) {
      toast({
        title: "Erro ao finalizar pedido",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setPedidoParaFinalizar100(null);
      setAtualizando(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" /> Carregando fila PCP de Telhas...
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      {/* ══════════════ CABEÇALHO EXECUTIVO E BARRA AVANÇADA DE FILTROS PCP ══════════════ */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Fila PCP — Aguardando Produção (Telhas)
                </h2>
                <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 font-bold text-xs">
                  {contadores.total} pedido(s)
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ordens do barracão de telhas com controle de prazo de entrega e roteamento direto às máquinas
              </p>
            </div>
          </div>

          {/* PAINEL DE CONTROLE DE AUTOMAÇÃO DE BOBINAS & MÁQUINAS (EXCLUSIVO TELHAS) */}
          <div className="flex items-center gap-2.5 flex-wrap ml-auto">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                autoRoteamentoAtivo
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200 shadow-2xs"
                  : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}
              title="Ativa o roteamento direto para as máquinas com seleção automática minuciosa de bobina pelo Odoo"
            >
              <Zap className={`w-4 h-4 ${autoRoteamentoAtivo ? "text-amber-600 dark:text-amber-400 fill-amber-500" : "text-slate-400"}`} />
              <div className="text-xs font-bold leading-tight">
                <span>Piloto Automático Telhas</span>
                <span className="block text-[10px] font-normal text-muted-foreground">Auto-Bobina Odoo</span>
              </div>
              <Switch
                checked={autoRoteamentoAtivo}
                onCheckedChange={handleToggleAutoRoteamento}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>

            {itensTelhasSemOp.length > 0 && (
              <Button
                size="sm"
                onClick={handleAutoRotearLote}
                disabled={processandoAutoRoteamento}
                className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs h-9 px-3 gap-1.5 shadow-sm rounded-xl cursor-pointer"
                title="Roteia todos os itens de telha pendentes direto para as máquinas elegendo a melhor bobina no estoque"
              >
                {processandoAutoRoteamento ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Rotear Direto ({itensTelhasSemOp.length})</span>
              </Button>
            )}
          </div>
        </div>

        <FiltrosDataPCPBar
          termoBusca={termoBusca}
          onBuscaChange={setTermoBusca}
          placeholderBusca="Buscar pedido, OF, cliente, vendedor, telha..."
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

      {/* ══════════════ BARRA DE SELEÇÃO EM LOTE ══════════════ */}
      {todosItensPendentes.length > 0 && (
        <div className="mx-4 sm:mx-6 my-2 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (itensSelecionados.length === todosItensPendentes.length) {
                  setItensSelecionados([]);
                } else {
                  setItensSelecionados(todosItensPendentes);
                }
              }}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              {itensSelecionados.length === todosItensPendentes.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-orange-600" />
                  Desmarcar Todos ({itensSelecionados.length})
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Selecionar Todos os Pendentes ({todosItensPendentes.length})
                </>
              )}
            </Button>
            {itensSelecionados.length > 0 && (
              <span className="text-xs text-slate-500 font-medium">
                {itensSelecionados.length} selecionado(s) · {itensSelecionados.reduce((a, b) => a + Number(b.item?.quantidade || 0), 0)} m
              </span>
            )}
          </div>

          {itensSelecionados.length > 0 && (
            <Button
              size="sm"
              onClick={() => setModalLoteOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-8 px-3 gap-1.5 shadow-sm ml-auto"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              Colocar {itensSelecionados.length} em Produção
            </Button>
          )}
        </div>
      )}

      {/* ══════════════ LISTA DE PEDIDOS DA FILA ══════════════ */}
      {filaFiltrada.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Nenhum pedido encontrado com os filtros atuais
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {filtroUrgencia !== "todos" || dataInicio || dataFim || termoBusca
              ? "Experimente limpar os filtros ou alterar o intervalo de datas."
              : "Não há ordens distribuídas aguardando produção neste momento."}
          </p>
        </div>
      ) : (
        <div className="p-3 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          {filaFiltrada.map(pedido => {
            const itens = getItens(pedido);
            const telhas = itensPorGrupo(itens, "telha");

            // Busca se existe Ordem de Produção real criada para este pedido na fábrica
            const opsDoPedido = buscarOpsDoPedido(pedido, pedidosProducao);

            let somaProgresso = 0;
            telhas.forEach((t) => {
              const op = localizarOpDoItem(t, opsDoPedido, telhas);
              if (op) {
                if (op.status === "finalizado") somaProgresso += 1.0;
                else if (op.status === "aguardando_colagem") somaProgresso += 0.75;
                else if (op.status === "em_producao") somaProgresso += 0.50;
                else if (op.status === "pausado") somaProgresso += 0.40;
                else if (op.status === "pendente") somaProgresso += 0.30;
                else somaProgresso += 0.25;
              } else if (t.status === "concluido") {
                somaProgresso += 1.0;
              } else if (t.status === "em_producao" || t.maquina) {
                somaProgresso += 0.30;
              }
            });

            const pctTelha = telhas.length > 0
              ? Math.min(100, Math.round((somaProgresso / telhas.length) * 100))
              : (pedido.percentual_concluido || 0);
            const pctGeral = Math.max(pctTelha, computePercentual(itens), pedido.percentual_concluido || 0);
            const pacoteConcluido = pctTelha === 100;

            // ── CÁLCULO DE DATA E URGÊNCIA ──
            const dataAlvoUrgencia = pedido.data_previsao_fabrica || pedido.data_entrega;
            const restantes = diasUteisRestantes(dataAlvoUrgencia);
            const isAtrasado = restantes != null && restantes < 0;
            const isHoje = restantes === 0;
            const isAmanha = restantes === 1;
            const isPrioritario = Boolean(pedido.prioridade);

            // Itens do setor
            const algumItemTemDistribuido = telhas.some(i => i.distribuido === true || i.distribuido === false);
            const telhasParaExibir = telhas;
            const qtdNaoDistribuidos = telhas.filter(t =>
              !itemEstaDistribuido(t, localizarOpDoItem(t, opsDoPedido, telhas), pedido, algumItemTemDistribuido)
            ).length;

            if (telhasParaExibir.length === 0) return null;

            // Itens pendentes deste pedido específico para seleção em lote
            const itensPendentesPedido = telhasParaExibir.map((t, i) => {
              const op = localizarOpDoItem(t, opsDoPedido, telhas);
              const isConc = (op && op.status === "finalizado") || t.status === "concluido";
              const finalIdx = t._idx != null ? t._idx : i;
              return { key: `${pedido.id}_${finalIdx}`, pedido, item: t, idx: finalIdx, isConc };
            }).filter(x => !x.isConc);

            const todosDestePedidoSelecionados = itensPendentesPedido.length > 0 && itensPendentesPedido.every(x => itensSelecionados.some(s => s.key === x.key));

            return (
              <div
                key={pedido.id}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all relative overflow-hidden bg-card shadow-sm hover:shadow-md ${
                  pacoteConcluido
                    ? "border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/15 dark:bg-emerald-950/10"
                    : isPrioritario
                    ? "border-amber-400 dark:border-amber-600/80 ring-1 ring-amber-400/20"
                    : isAtrasado
                    ? "border-red-400 dark:border-red-800/80 ring-2 ring-red-500/20 bg-red-50/10 dark:bg-red-950/10"
                    : isHoje || isAmanha
                    ? "border-amber-300 dark:border-amber-700/80"
                    : "border-blue-200 dark:border-blue-800/60"
                }`}
              >
                <div className="relative z-10 space-y-3.5">
                  {/* ══════════════ PAINEL HERO: ONDE ESTÁ & STATUS EM MÁXIMA EVIDÊNCIA ══════════════ */}
                  <LocalizacaoStatusHero
                    pedido={pedido}
                    ops={opsDoPedido}
                    percentual={pctTelha}
                    setor="telhas"
                  />

                  {/* ══════════════ CABEÇALHO DO BLOCO (CARD VISUAL TOP) ══════════════ */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {itensPendentesPedido.length > 0 && (
                        <div className="pt-1.5 shrink-0" title="Selecionar todos os itens pendentes deste pedido">
                          <Checkbox
                            checked={todosDestePedidoSelecionados}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setItensSelecionados(prev => {
                                  const novos = itensPendentesPedido.filter(p => !prev.some(s => s.key === p.key));
                                  return [...prev, ...novos];
                                });
                              } else {
                                const keysRemover = new Set(itensPendentesPedido.map(p => p.key));
                                setItensSelecionados(prev => prev.filter(s => !keysRemover.has(s.key)));
                              }
                            }}
                            aria-label={`Selecionar todos os itens do pedido #${pedido.numero_pedido}`}
                          />
                        </div>
                      )}
                      <CroquiThumb pedido={pedido} alt={`Croqui #${pedido.numero_pedido}`} className="mt-0.5" />
                      
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Linha 1: Número, Badges de Urgência e Status Fábrica */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg font-black text-slate-900 dark:text-white font-mono tracking-tight bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                            #{pedido.numero_pedido}
                          </span>

                          {isPrioritario && (
                            <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-[10px] gap-1 px-2 py-0.5 font-bold shadow-xs">
                              <Star className="w-3 h-3 fill-white" /> URGENTE
                            </Badge>
                          )}

                          {pedido._isOpAvulsa ? (
                            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300">
                              OP Fábrica ({pedido._opOrigem?.maquina || "Telhas"})
                            </Badge>
                          ) : pedido.of_nome ? (
                            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                              OF: {pedido.of_nome}
                            </Badge>
                          ) : pedido.of_odoo_id ? (
                            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                              OF: {pedido.of_odoo_id}
                            </Badge>
                          ) : null}

                          {(contagemPorPedido.get(String(pedido.numero_pedido || "").trim()) || 1) > 1 && (
                            <Badge
                              className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40 text-[10px] font-bold"
                              title="Este número de pedido possui múltiplos itens na fila"
                            >
                              <Layers className="w-3 h-3 mr-0.5" /> {contagemPorPedido.get(String(pedido.numero_pedido || "").trim())} itens
                            </Badge>
                          )}

                          {pacoteConcluido ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Pacote Concluído
                            </Badge>
                          ) : opsDoPedido.length > 0 ? (
                            <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 text-[10px] font-bold">
                              ⚙️ Em Produção na Fábrica
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 text-[10px] font-bold">
                              Aguardando Produção
                            </Badge>
                          )}

                          {!pacoteConcluido && qtdNaoDistribuidos > 0 && (
                            <Badge
                              className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 text-[10px] font-black uppercase"
                              title="Itens deste pedido ainda sem máquina"
                            >
                              <XCircle className="w-3 h-3 mr-0.5" />
                              {qtdNaoDistribuidos} não distribuído(s)
                            </Badge>
                          )}
                        </div>

                        {/* Linha 2: Cliente, Vendedor e Loja */}
                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 flex-wrap pt-0.5">
                          <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 text-sm">
                            <User className="w-4 h-4 text-blue-600 shrink-0" />
                            {pedido.cliente_nome || "Cliente Balcão"}
                          </span>
                          {pedido.vendedor_nome && pedido.vendedor_nome !== "—" && (
                            <span className="text-slate-500 font-medium">
                              Vendedor: <strong className="text-slate-800 dark:text-slate-200">{pedido.vendedor_nome}</strong>
                            </span>
                          )}
                          {pedido.loja_venda && (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Store className="w-3 h-3 text-slate-400" /> {pedido.loja_venda}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito Superior: Progresso e Ações Rápidas do Pedido */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Progresso Telhas</span>
                        <span className={`text-base font-black ${pctTelha >= 100 ? "text-emerald-600" : "text-orange-600"}`}>
                          {pctTelha}%
                        </span>
                      </div>
                      <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pctTelha >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-amber-500"}`}
                          style={{ width: `${pctTelha}%` }}
                        />
                      </div>

                      {/* ══════════════ BOTÕES DE AÇÃO DO PEDIDO (AUTO-ROTEAR, DEVOLVER AO PCP & FINALIZAR 100%) ══════════════ */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {/* 0. AUTO-ROTEAR PEDIDO DIRETO PARA MÁQUINAS COM BOBINA */}
                        {!pedido._isOpAvulsa && !pacoteConcluido && (
                          <Button
                            size="sm"
                            disabled={atualizando === `auto-rotear-ped-${pedido.id}`}
                            onClick={() => handleAutoRotearPedido(pedido)}
                            className="h-7 px-2.5 text-xs font-bold gap-1 bg-amber-500 hover:bg-amber-600 text-white shadow-2xs cursor-pointer"
                            title="Roteia itens de telha deste pedido direto para as máquinas perfiladeiras elegendo a melhor bobina no estoque"
                          >
                            {atualizando === `auto-rotear-ped-${pedido.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Zap className="w-3.5 h-3.5 fill-current" />
                            )}
                            <span>Rotear Telhas</span>
                          </Button>
                        )}

                        {/* 1. DEVOLVER PARA A CENTRAL PCP */}
                        {!pedido._isOpAvulsa && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={atualizando === `devolver-${pedido.id}`}
                            onClick={() => handleDevolverPedidoCentralPCP(pedido)}
                            className="h-7 px-2.5 text-xs font-bold gap-1 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 shadow-2xs"
                            title="Retirar da fila de produção e devolver para a triagem da Central PCP"
                          >
                            <Undo2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>{atualizando === `devolver-${pedido.id}` ? "Devolvendo..." : "Devolver ao PCP"}</span>
                          </Button>
                        )}

                        {/* 2. FINALIZAR 100% FORÇADO COM SENHA 0000 */}
                        {!pacoteConcluido && (
                          <Button
                            size="sm"
                            disabled={atualizando === `finalizar-100-${pedido.id}`}
                            onClick={() => solicitarFinalizar100(pedido)}
                            className="h-7 px-2.5 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                            title="Forçar conclusão em 100% com PIN de Gestor (0000) e sincronizar com o Odoo ERP"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{atualizando === `finalizar-100-${pedido.id}` ? "Finalizando..." : "Finalizar 100%"}</span>
                          </Button>
                        )}

                        {/* 3. AJUSTAR PRAZO FABRIL */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPedidoPrazoModal(pedido)}
                          className="h-7 px-2 text-xs font-semibold gap-1 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          title="Reprogramar data da fábrica e notificar vendedor"
                        >
                          <CalendarClock className="w-3.5 h-3.5 text-orange-600" />
                          <span className="hidden sm:inline">Prazo</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* ══════════════ BLOCO DE DATAS, PRAZO FABRIL & SLA ══════════════ */}
                  <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 shadow-2xs">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Entrega Prometida:</span>
                        <strong className="text-slate-900 dark:text-white font-mono">
                          {formatDataBR(pedido.data_entrega)}
                        </strong>
                      </div>

                      {pedido.data_previsao_fabrica && (
                        <div
                          className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-lg border border-orange-300 dark:border-orange-800 font-semibold text-orange-900 dark:text-orange-200 shadow-2xs"
                          title={pedido.motivo_alteracao_prazo ? `Motivo: ${pedido.motivo_alteracao_prazo}` : "Previsão calculada pela fábrica"}
                        >
                          <Factory className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>Previsão Fábrica:</span>
                          <strong className="text-orange-950 dark:text-orange-100 font-mono">
                            {formatDataBR(pedido.data_previsao_fabrica)}
                          </strong>
                        </div>
                      )}

                      <SlaCountdownBadge
                        dataPrometida={pedido.data_entrega}
                        dataPrevisaoFabrica={pedido.data_previsao_fabrica}
                      />
                    </div>
                  </div>

                  {/* ══════════════ SUB-BLOCOS DE ITENS DO PEDIDO ══════════════ */}
                  <div className="space-y-2.5 pt-1">
                    {telhasParaExibir.map((item, idx) => {
                      const opDoItem = localizarOpDoItem(item, opsDoPedido, telhas);
                      const itemDistribuido = itemEstaDistribuido(item, opDoItem, pedido, algumItemTemDistribuido);
                      let statusItem = "pendente";
                      let maquinaItem = item.maquina || "";

                      if (opDoItem) {
                        maquinaItem = opDoItem.maquina || maquinaItem;
                        if (opDoItem.status === "finalizado") {
                          statusItem = "concluido";
                        } else if (["em_producao", "pausado", "aguardando_colagem", "pendente"].includes(opDoItem.status)) {
                          statusItem = "em_producao";
                        }
                      } else if (item.status === "concluido") {
                        statusItem = "concluido";
                      } else if (item.status === "em_producao") {
                        statusItem = "em_producao";
                      }

                      const st = STATUS_ITEM[statusItem] || STATUS_ITEM.pendente;
                      const emProd = statusItem === "em_producao";
                      const concluido = statusItem === "concluido";
                      const finalIdx = item._idx != null ? item._idx : idx;
                      const itemKey = `${pedido.id}_${finalIdx}`;
                      const isItemSelecionado = itensSelecionados.some(s => s.key === itemKey);

                      return (
                        <div
                          key={finalIdx}
                          className={`p-3.5 rounded-xl border-2 transition-all ${
                            isItemSelecionado
                              ? "border-orange-500 bg-orange-50/40 dark:bg-orange-950/20 shadow-xs ring-1 ring-orange-500/30"
                              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
                          } space-y-2.5`}
                        >
                          <div className="flex items-start gap-2.5">
                            {!concluido && (
                              <div className="pt-1 shrink-0" title="Selecionar item para envio em lote">
                                <Checkbox
                                  checked={isItemSelecionado}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setItensSelecionados(prev => [
                                        ...prev.filter(s => s.key !== itemKey),
                                        { key: itemKey, pedido, item, idx: finalIdx }
                                      ]);
                                    } else {
                                      setItensSelecionados(prev => prev.filter(s => s.key !== itemKey));
                                    }
                                  }}
                                  aria-label={`Selecionar item ${item.produto}`}
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <InstrucaoVendedorCard
                                descricao={item.descricao || item.produto}
                                quantidadeOdoo={item.quantidade}
                                espessura={item.espessura}
                                unidade={normalizarUnidadeMedidaItem(item, "telha")}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                                {item.produto || item.descricao || "Telha / Perfil"}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                                {item.medida && <span>Medida: <strong className="text-foreground">{item.medida}</strong></span>}
                                <span>Metragem Linear: <strong className="text-orange-600 dark:text-orange-400 font-bold">{item.quantidade} MT</strong></span>
                                {item.espessura && <span>· Chapa <strong>{item.espessura}mm</strong></span>}
                                {maquinaItem && (
                                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                                    · Máquina: {maquinaItem}
                                  </span>
                                )}
                              </div>
                            </div>

                            <BadgeDistribuicaoItem distribuido={itemDistribuido} maquina={maquinaItem} />
                            <Badge className={`shrink-0 border text-[10px] font-bold px-2 py-0.5 ${st.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot} mr-1.5`} />
                              {st.label}
                            </Badge>

                            {/* AÇÕES DO ITEM */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* Devolver Item individual ao PCP */}
                              {!pedido._isOpAvulsa && !concluido && itemDistribuido && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={atualizando === `devolver-item-${pedido.id}-${finalIdx}`}
                                  onClick={() => handleDevolverItemCentralPCP(pedido, finalIdx)}
                                  className="h-8 px-2 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 gap-1 font-semibold"
                                  title="Devolver este item específico para triagem da Central PCP"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Devolver Item</span>
                                </Button>
                              )}

                              {/* Roteamento Automático Direto com Bobina deste Item */}
                              {!pedido._isOpAvulsa && !concluido && (!opDoItem || opDoItem.status === "cancelado") && (
                                <Button
                                  size="sm"
                                  disabled={atualizando === `auto-rotear-${pedido.id}-${finalIdx}`}
                                  onClick={() => handleAutoRotearItem(pedido, item, finalIdx)}
                                  className="h-8 px-2.5 text-xs font-bold gap-1 bg-amber-500 hover:bg-amber-600 text-white shadow-xs cursor-pointer"
                                  title="Enviar este item direto para a perfiladeira com melhor bobina compatível do estoque selecionada pelo Odoo"
                                >
                                  {atualizando === `auto-rotear-${pedido.id}-${finalIdx}` ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Zap className="w-3.5 h-3.5 fill-current" />
                                  )}
                                  <span>Auto-Máquina</span>
                                </Button>
                              )}

                              {onNovaOrdem && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (pedido._isOpAvulsa && pedido._opOrigem) {
                                      onNovaOrdem(pedido, {
                                        ...item,
                                        _idx: 0,
                                        maquina: item.maquina || pedido._opOrigem.maquina,
                                        data: pedido.data_entrega,
                                        existingOp: pedido._opOrigem
                                      });
                                      return;
                                    }
                                    notificarStatus(pedido, "revisando_ordem", {
                                      status_novo: "em_revisao",
                                      item_nome: item.produto || item.descricao || "",
                                      maquina_atual: maquinaItem || "PCP / Fábrica"
                                    });
                                    onNovaOrdem(pedido, {
                                      ...item,
                                      _idx: finalIdx,
                                      maquina: maquinaItem,
                                      data: item.data_programada || pedido.data_previsao_fabrica || pedido.data_entrega,
                                      existingOp: opDoItem || null
                                    });
                                  }}
                                  className={
                                    concluido
                                      ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 h-8 px-3 gap-1.5 text-xs font-semibold"
                                      : emProd
                                      ? "bg-amber-500 hover:bg-amber-600 text-white h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs"
                                      : "bg-orange-500 hover:bg-orange-600 text-white h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs"
                                  }
                                >
                                  {concluido ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Concluído</span>
                                    </>
                                  ) : emProd ? (
                                    <>
                                      <Play className="w-3.5 h-3.5 fill-white" />
                                      <span>Revisar Ordem {maquinaItem ? `[${maquinaItem}]` : ""}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3.5 h-3.5 fill-white" />
                                      <span>Iniciar Produção</span>
                                    </>
                                  )}
                                </Button>
                              )}

                              {isAdmin && !pedido._isOpAvulsa && !concluido && (
                                <FinalizarItemRapidoButton
                                  carregando={atualizando === `${pedido.id}-${item._idx}`}
                                  onFinalizar={() => handleAtualizar(pedido, item._idx, { status: "concluido", concluido: true })}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Validação de Senha do Gestor (PIN 0000) para Finalizar 100% Forçado */}
      <SenhaGestorDialog
        open={senhaFinalizarOpen}
        onOpenChange={setSenhaFinalizarOpen}
        titulo="Finalizar Pedido em 100% (Forçado)"
        descricao={
          pedidoParaFinalizar100
            ? `Digite o PIN do Gestor (0000) para concluir imediatamente o Pedido #${pedidoParaFinalizar100.numero_pedido}, marcar todas as OPs como concluídas e notificar o Odoo ERP.`
            : "Digite o PIN do Gestor (0000) para concluir o pedido."
        }
        aviso="Finalizar 100% forçado exige autorização do Gestor (PIN 0000)."
        onAutorizado={confirmarFinalizar100}
      />

      {/* Modal de Alteração de Prazo Fabril acessível diretamente da Fila PCP */}
      {pedidoPrazoModal && (
        <AlterarPrazoFabrilDialog
          open={Boolean(pedidoPrazoModal)}
          onOpenChange={(aberto) => { if (!aberto) setPedidoPrazoModal(null); }}
          pedido={pedidoPrazoModal}
          onPrazoAlterado={() => {
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
            setPedidoPrazoModal(null);
          }}
        />
      )}

      {/* Modal de Produção em Lote */}
      <ProducaoEmLoteModal
        open={modalLoteOpen}
        onOpenChange={setModalLoteOpen}
        itensSelecionados={itensSelecionados}
        onConcluido={() => {
          setItensSelecionados([]);
          queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
        }}
      />
    </div>
  );
}