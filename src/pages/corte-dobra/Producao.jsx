import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Factory,
  Calendar,
  Wrench,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  AlertTriangle,
  X,
  PackageX,
  Truck,
  Inbox,
  Layers,
  Zap,
  Clock,
  CheckCircle2,
  ListOrdered,
  Sparkles,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import OrdemFormDialogCD from "@/components/corte-dobra/OrdemFormDialogCD";
import OrdemCardCD from "@/components/corte-dobra/OrdemCardCD";
import OrdemDesbobinadiraRow from "@/components/corte-dobra/OrdemDesbobinadiraRow";
import DiaResumoCardCD from "@/components/corte-dobra/DiaResumoCardCD";
import OrdemMaquinaFormDialog from "@/components/corte-dobra/OrdemMaquinaFormDialog.jsx";
import OrdemMaquinaRow from "@/components/corte-dobra/OrdemMaquinaRow.jsx";
import RetrabalhoDialog from "@/components/corte-dobra/RetrabalhoDialog";
import ValidacaoEtiquetaChapaDialog from "@/components/corte-dobra/ValidacaoEtiquetaChapaDialog";
import OPSemMaterialTab from "@/components/corte-dobra/OPSemMaterialTab";
import { useFilial } from "@/contexts/FilialContext";
import ExpedicaoTab from "@/components/logistica/ExpedicaoTab";
import FilaPCPCorteDobra from "@/components/pcp/FilaPCPCorteDobra";
import { getItens, computePercentual, statusPcpPorPercentual, buildItensJson } from "@/lib/pedidoOdooHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { getPesoOrdenacaoPrioridade } from "@/lib/prioridadeHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import KanbanBoard from "@/components/producao/KanbanBoard";
import IniciarOpOperadoresDialog from "@/components/producao/IniciarOpOperadoresDialog";
import { useRegrasProducao } from "@/lib/regrasProducao";
import { extrairCroquiPedido } from "@/lib/croquiExtractor";

const MAQUINAS_OUTRAS = [
  { id: "CORTE 3M",       label: "Guilhotina 3m",       cor: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "DOBRA 3M",       label: "Dobradeira 3m",        cor: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "CORTE 6M",       label: "Guilhotina 6m",        cor: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "DOBRA FUNDO 6M", label: "Dobradeira Fundo 6m",  cor: "bg-teal-100 text-teal-800 border-teal-200" },
  { id: "DOBRA INICIO 6M",label: "Dobradeira Início 6m", cor: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { id: "PERFILADEIRA",   label: "Perfiladeira",         cor: "bg-green-100 text-green-800 border-green-200" },
];

export default function ProducaoCD() {
  const [user, setUser] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState("maquinas");
  const [zoom, setZoom] = useState("normal"); // compacto | normal | grande
  const [buscaPedido, setBuscaPedido] = useState("");
  const [dialogRetrabalho, setDialogRetrabalho] = useState(false);
  const [ordemRetrabalho, setOrdemRetrabalho] = useState(null);

  // Dialog Desbobinadeira
  const [dialogDesb, setDialogDesb] = useState(false);
  const [editDesb, setEditDesb] = useState(null);

  // Dialog outras máquinas
  const [dialogMaq, setDialogMaq] = useState(false);
  const [editMaq, setEditMaq] = useState(null);
  const [maquinaAtiva, setMaquinaAtiva] = useState(null);
  // Contexto da Fila PCP — rastreia de qual item a OP foi criada para atualizar status + webhook
  const [filaContext, setFilaContext] = useState(null);
  const [validacaoChapaOpen, setValidacaoChapaOpen] = useState(false);
  const [ordemValidandoChapa, setOrdemValidandoChapa] = useState(null);
  const [operadoresDialogOpen, setOperadoresDialogOpen] = useState(false);
  const [ordemParaOperadores, setOrdemParaOperadores] = useState(null);

  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();
  const regras = useRegrasProducao();

  const aplicarStatusKanban = async (item, novoStatus, extras = {}) => {
    try {
      const isDesb = !item.maquina || item.maquina === "DESBOBINADEIRA" || item.maquina?.startsWith?.("DESBOBINADEIRA");
      const entity = isDesb ? base44.entities.OrdemDesbobinadeira : base44.entities.OrdemMaquinaCD;
      const patch = { status: novoStatus, ...extras };
      if (novoStatus === "finalizado") {
        patch.data_finalizacao = new Date().toISOString();
      }
      await entity.update(item.id, patch);
      queryClient.invalidateQueries({ queryKey: ["ordens-cd"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      toast.success(`Status alterado para ${novoStatus}!`);
    } catch (e) {
      toast.error("Erro ao alterar status: " + (e?.message || ""));
    }
  };

  const handleStatusChangeKanban = async (item, novoStatus) => {
    if (novoStatus === "em_producao") {
      // Seleção de operadores é exigência configurável em Configurações
      if (regras.exigirOperadorInicio) {
        setOrdemParaOperadores(item);
        setOperadoresDialogOpen(true);
      } else {
        await aplicarStatusKanban(item, novoStatus, { inicio_producao_ts: new Date().toISOString() });
      }
      return;
    }
    await aplicarStatusKanban(item, novoStatus);
  };

  const handleConfirmarOperadores = async (operadores) => {
    if (!ordemParaOperadores) return;
    await aplicarStatusKanban(ordemParaOperadores, "em_producao", {
      inicio_producao_ts: new Date().toISOString(),
      operadores_json: JSON.stringify(operadores)
    });
    toast.success(`OP iniciada com ${operadores.length} operador(es)!`);
  };

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const diasDaSemana = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Ordens Desbobinadeira
  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens-desbobinadeira", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 10000,
  });

  // Ordens outras máquinas
  const { data: ordensMaq = [] } = useQuery({
    queryKey: ["ordens-maquina-cd", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 10000,
  });

  // Mutations Desbobinadeira
  const createDesb = useMutation({
    mutationFn: (data) => base44.entities.OrdemDesbobinadeira.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }); setDialogDesb(false); toast.success("Ordem criada!"); },
  });
  const updateDesb = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemDesbobinadeira.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] }),
  });
  const deleteDesb = useMutation({
    mutationFn: (id) => base44.entities.OrdemDesbobinadeira.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
      toast.success("Ordem excluída com sucesso!");
    },
  });

  // Mutations outras máquinas
  const createMaq = useMutation({
    mutationFn: (data) => base44.entities.OrdemMaquinaCD.create(data),
    onSuccess: (_saved, data) => {
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      setDialogMaq(false);
      toast.success(data?.material_em_falta ? "OP criada e enviada para 'OP sem Material'!" : "Ordem criada!");
    },
    onError: (err) => {
      toast.error("Erro ao criar ordem: " + (err?.message || "Falha na operação"));
      console.error("[createMaq error]:", err);
    }
  });
  const updateMaq = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemMaquinaCD.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] }),
    onError: (err) => {
      toast.error("Erro ao atualizar ordem: " + (err?.message || "Falha na operação"));
      console.error("[updateMaq error]:", err);
    }
  });
  const deleteMaq = useMutation({
    mutationFn: (id) => base44.entities.OrdemMaquinaCD.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      toast.success("Ordem excluída com sucesso!");
    },
  });

  // Handlers Prioridade / Rota / Status (Desbobinadeira)
  const handleSelectPrioridadeDesb = (ordem, nivel) => {
    updateDesb.mutate({
      id: ordem.id,
      data: {
        prioridade_nivel: nivel,
        prioridade: Boolean(nivel),
      },
    });
    toast.success(nivel ? `Marcado como Prioridade P${nivel}!` : "Prioridade removida.");
  };

  const handleToggleRotaDesb = (ordem) => {
    const novaRota = !ordem.rota;
    updateDesb.mutate({
      id: ordem.id,
      data: {
        rota: novaRota,
        rota_ts: novaRota ? new Date().toISOString() : null,
      },
    });
    toast.success(novaRota ? "Marcado como Rota de Entrega!" : "Rota removida.");
  };

  const handleStatusChangeDesb = (ordem, novoStatus) => {
    const dataUpdate = { status: novoStatus };
    if (novoStatus === "em_producao" && !ordem.inicio_producao_ts) {
      dataUpdate.inicio_producao_ts = new Date().toISOString();
    }
    if (novoStatus === "finalizado") {
      dataUpdate.data_finalizacao = new Date().toISOString();
    }
    updateDesb.mutate({ id: ordem.id, data: dataUpdate });
    toast.success(`Status atualizado para ${novoStatus}!`);
  };

  // Handlers Prioridade / Rota / Status (Outras Máquinas)
  const handleSelectPrioridadeMaq = (ordem, nivel) => {
    updateMaq.mutate({
      id: ordem.id,
      data: {
        prioridade_nivel: nivel,
        prioridade: Boolean(nivel),
      },
    });
    toast.success(nivel ? `Marcado como Prioridade P${nivel}!` : "Prioridade removida.");
  };

  const handleToggleRotaMaq = (ordem) => {
    const novaRota = !ordem.rota;
    updateMaq.mutate({
      id: ordem.id,
      data: {
        rota: novaRota,
        rota_ts: novaRota ? new Date().toISOString() : null,
      },
    });
    toast.success(novaRota ? "Marcado como Rota de Entrega!" : "Rota removida.");
  };

  const handleStatusChangeMaq = async (ordem, novoStatus) => {
    const dataUpdate = { status: novoStatus };
    if (novoStatus === "em_producao" && !ordem.inicio_producao_ts) {
      dataUpdate.inicio_producao_ts = new Date().toISOString();
    }
    if (novoStatus === "finalizado") {
      dataUpdate.data_finalizacao = new Date().toISOString();
    }
    updateMaq.mutate({ id: ordem.id, data: dataUpdate });
    toast.success(`Status atualizado para ${novoStatus}!`);

    // Sincronizar com PedidoOdoo e Mini BI do Odoo
    if (ordem.numero_pedido) {
      try {
        const pedList = await base44.entities.PedidoOdoo.filter({ numero_pedido: String(ordem.numero_pedido).trim() });
        if (pedList && pedList.length > 0) {
          const ped = pedList[0];
          const itens = getItens(ped);
          const itemIdx = itens.findIndex(i =>
            String(i.produto || "").toLowerCase().includes(String(ordem.peca || "").toLowerCase()) ||
            /(chapa|perfil|barra|dobra|corte)/i.test(String(i.produto || i.categoria || ""))
          );
          if (itemIdx >= 0) {
            itens[itemIdx] = {
              ...itens[itemIdx],
              status: novoStatus === "finalizado" ? "concluido" : (novoStatus === "em_producao" ? "em_producao" : itens[itemIdx].status),
              status_detalhado: novoStatus === "finalizado" ? "Concluído" : (novoStatus === "em_producao" ? `Em Produção (${ordem.maquina || "C&D"})` : itens[itemIdx].status_detalhado),
              concluido: novoStatus === "finalizado" ? true : itens[itemIdx].concluido
            };
          }
          const pct = computePercentual(itens);
          const novoStatusPcp = statusPcpPorPercentual(pct, ped.status_pcp);
          const pedAtualizado = await base44.entities.PedidoOdoo.update(ped.id, {
            itens_json: buildItensJson(itens),
            percentual_concluido: pct,
            status_pcp: novoStatusPcp
          });
          const ev = novoStatus === "finalizado" && pct >= 100 ? "concluido" : (novoStatus === "em_producao" ? "maquina_inicio" : "maquina_fim");
          await notificarStatus(pedAtualizado, ev, {
            maquina_atual: ordem.maquina || "",
            status_novo: novoStatusPcp,
            percentual_concluido: pct,
            item_nome: ordem.peca || `Item #${ordem.numero_pedido}`
          });
        }
      } catch (errSync) {
        console.warn("[ProducaoCD] Falha ao sincronizar com PedidoOdoo:", errSync);
      }
    }
  };

  const handleEtiquetaChapaAprovadaProducao = (fotoUrl, motivo, statusValidacao) => {
    if (!ordemValidandoChapa) return;
    const inicioTs = new Date().toISOString();
    const dataUpdate = {
      status: "em_producao",
      inicio_producao_ts: inicioTs,
      foto_etiqueta_chapa_url: fotoUrl,
      foto_material_url: ordemValidandoChapa.foto_material_url || fotoUrl,
      validacao_etiqueta_chapa_status: statusValidacao || "aprovado",
      validacao_etiqueta_chapa_motivo: motivo || null,
    };
    updateMaq.mutate({ id: ordemValidandoChapa.id, data: dataUpdate });
    setValidacaoChapaOpen(false);
    setOrdemValidandoChapa(null);
    toast.success("Produção na guilhotina iniciada com foto da etiqueta da chapa!");
  };

  const isGestor = user?.role === "admin" || user?.full_name?.toLowerCase().includes("hudson");
  const maquinaDoUsuario = user?.maquina;

  const openNewDesb = (date = null) => {
    setEditDesb(date ? { _presets: { data: date } } : null);
    setDialogDesb(true);
  };
  const openEditDesb = (item) => { setEditDesb(item); setDialogDesb(true); };
  const handleSaveDesb = (data) => {
    // Se a máquina inicial não for Desbobinadeira, criar como OrdemMaquinaCD
    if (data.maquina_inicial && !data.maquina_inicial.startsWith("DESBOBINADEIRA")) {
      const maqData = {
        ...data,
        maquina: data.maquina_inicial,
        quantidade: Number(data.quantidade),
        peso_kg: data.kg_estimado || undefined,
        chapa_cd_id: data.chapa_cd_id || "",
        chapa_descricao: data.chapa_descricao || "",
        chapa_origem: "chaparia",
        tipo_peca: data.tipo_peca || "—",
        dimensoes_livres: data.dimensoes_livres || "",
        status: data.material_em_falta ? "aguardando_material" : "pendente",
      };
      delete maqData.bobina_id;
      delete maqData.comprimento_mm;
      delete maqData.kg_estimado;
      delete maqData.destino;
      delete maqData.guilhotina;
      delete maqData.tamanho_corte_guilhotina;
      delete maqData.maquina_inicial;
      createMaq.mutate(maqData);
      setDialogDesb(false);
      return;
    }
    if (editDesb && !editDesb._presets && editDesb.id) { updateDesb.mutate({ id: editDesb.id, data }); setDialogDesb(false); }
    else createDesb.mutate(data);
  };

  const openNewMaq = (maquina, date = null) => {
    setMaquinaAtiva(maquina);
    setEditMaq(date ? { _presets: { data: date } } : null);
    setDialogMaq(true);
  };

  // Abrir formulário completo de Nova Ordem ou Revisão a partir de um item da Fila PCP
  const openNewFromFila = (pedido, item) => {
    setMaquinaAtiva(null);
    setFilaContext({ pedidoId: pedido.id, itemIdx: item._idx, pedido, produtoFixo: item.produto || "" });

    // Se já existe OP criada nas máquinas para este item do pedido, abre para EDIÇÃO/REVISÃO direta
    if (item.existingOp && item.existingOp.id) {
      setMaquinaAtiva(item.existingOp.maquina || null);
      setEditMaq(item.existingOp);
      setDialogMaq(true);
      return;
    }

    // Extrai especificação da descrição (ex: "60 peças" ou "50 PÇS c/ 2000\")
    const descItem = item.descricao || item.observacao || pedido.observacoes || "";
    const esp = extrairEspecificacao(descItem, item.quantidade, item.unidade);

    // Se na descrição vier "60 peças" (ou similar), a quantidade da ordem de produção passa a ser 60!
    const qtdFinal = esp.quantidade || item.quantidade || "";
    const pesoKgFinal = String(item.unidade || "").toLowerCase().includes("kg") ? item.quantidade : (item.peso_kg || "");

    const dimensoesFinais = esp.dimensoes_fmt || item.medida || (esp.comprimento_mm ? `${esp.comprimento_mm}mm` : "");
    const tipoPecaFinal = esp.tipo_label || item.produto || "";

    setMaquinaAtiva(item.maquina || null);
    setEditMaq({
      data: selectedDay,
      maquina: item.maquina || "",
      numero_pedido: pedido.numero_pedido || "",
      numero_oc: pedido.numero_oc || "",
      cliente: pedido.cliente_nome || "",
      vendedor: pedido.vendedor_nome || "",
      tipo_peca: tipoPecaFinal,
      dimensoes_livres: dimensoesFinais,
      quantidade: qtdFinal,
      peso_kg: pesoKgFinal,
      chapa_cd_id: item.chapa_cd_id || (item.material_tipo === "chapa" ? item.material_id : "") || "",
      bobina_id: item.bobina_id || (item.material_tipo === "bobina" ? item.material_id : "") || "",
      chapa_descricao: item.material_descricao || item.chapa_descricao || "",
      chapa_origem: item.material_tipo === "bobina" ? "bobina" : "chaparia",
      material_espessura: item.espessura ? String(item.espessura) : "",
      observacoes: descItem,
      foto_pedido_url: item.foto_url || item.imagem_url || pedido.foto_pedido_url || extrairCroquiPedido(pedido) || "",
      pedido_odoo_id: pedido.id || "",
      of_odoo_id: pedido.of_odoo_id || "",
      of_nome: pedido.of_nome || "",
      item_idx: item._idx != null ? item._idx : 0,
      unidade: filialAtiva || pedido.unidade || "Matriz AJL"
    });
    setDialogMaq(true);
  };
  const openEditMaq = (item) => { setMaquinaAtiva(item.maquina); setEditMaq(item); setDialogMaq(true); };
  const handleSaveMaq = async (data) => {
    if (editMaq && !editMaq._presets && editMaq.id) {
      updateMaq.mutate({ id: editMaq.id, data }, {
        onSuccess: async () => {
          setDialogMaq(false);
          toast.success("Ordem atualizada com sucesso!");
          const ctx = filaContext;
          setFilaContext(null);
          if (!ctx) return;
          try {
            const itens = getItens(ctx.pedido);
            if (itens[ctx.itemIdx]) {
              itens[ctx.itemIdx] = {
                ...itens[ctx.itemIdx],
                status: data.material_em_falta ? "aguardando_material" : "em_producao",
                maquina: data.maquina || "",
              };
              const percentual = computePercentual(itens);
              const status_pcp = statusPcpPorPercentual(percentual, ctx.pedido.status_pcp);
              const updated = await base44.entities.PedidoOdoo.update(ctx.pedidoId, {
                itens_json: buildItensJson(itens),
                percentual_concluido: percentual,
                status_pcp,
              });
              queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });
              queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
              await notificarStatus(updated, "maquina_inicio", {
                maquina_atual: data.maquina || "",
                item_nome: itens[ctx.itemIdx]?.produto || "",
                inicio_fmt: new Date().toISOString(),
                status_novo: status_pcp,
              });
            }
          } catch (e) {
            console.error("[Fila PCP] erro ao sincronizar item após edição:", e?.message || e);
          }
        },
      });
    } else {
      // Verificação anti-duplicação: checar se já existe OP antes de criar
      try {
        const pedNum = data.numero_pedido ? String(data.numero_pedido).trim() : "";
        const itemIdx = filaContext?.itemIdx != null ? filaContext.itemIdx : null;
        const pedOdooId = filaContext?.pedidoId || null;

        if (pedNum) {
          const opsAtuais = await base44.entities.OrdemMaquinaCD.filter({ numero_pedido: pedNum });
          const opExistente = opsAtuais.find(o => {
            if (o.status === "cancelado") return false;
            if (pedOdooId && o.pedido_odoo_id && o.pedido_odoo_id === pedOdooId) {
              if (itemIdx != null && o.item_idx != null) return o.item_idx === itemIdx;
              return true;
            }
            if (itemIdx != null && o.item_idx != null && o.item_idx === itemIdx) return true;
            return o.tipo_peca === data.tipo_peca && String(o.quantidade) === String(data.quantidade);
          });

          if (opExistente && opExistente.id) {
            updateMaq.mutate({ id: opExistente.id, data }, {
              onSuccess: () => {
                setDialogMaq(false);
                toast.success("Ordem existente revisada e atualizada!");
              }
            });
            return;
          }
        }
      } catch (errVerif) {
        console.warn("[Producao CD] Aviso na verificação anti-duplicação:", errVerif);
      }

      createMaq.mutate({ ...data, unidade: filialAtiva || "Matriz AJL" }, {
        onSuccess: async () => {
          const ctx = filaContext;
          setFilaContext(null);
          if (!ctx) return;
          try {
            // Atualiza o status do item no itens_json para "aguardando_material" ou "em_producao" + máquina
            const itens = getItens(ctx.pedido);
            if (itens[ctx.itemIdx]) {
              itens[ctx.itemIdx] = {
                ...itens[ctx.itemIdx],
                status: data.material_em_falta ? "aguardando_material" : "em_producao",
                maquina: data.maquina || "",
              };
              const percentual = computePercentual(itens);
              const status_pcp = statusPcpPorPercentual(percentual, ctx.pedido.status_pcp);
              const updated = await base44.entities.PedidoOdoo.update(ctx.pedidoId, {
                itens_json: buildItensJson(itens),
                percentual_concluido: percentual,
                status_pcp,
              });
              queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });
              queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
              // Dispara webhook Mini BI — evento maquina_inicio
              await notificarStatus(updated, "maquina_inicio", {
                maquina_atual: data.maquina || "",
                item_nome: itens[ctx.itemIdx]?.produto || "",
                inicio_fmt: new Date().toISOString(),
                status_novo: status_pcp,
              });
            }
          } catch (e) {
            console.error("[Fila PCP] erro ao atualizar item/webhook:", e?.message || e);
          }
        },
      });
    }
  };

  // Dados semana (Desbobinadeira)
  const ordensSemana = useMemo(() => {
    const s = format(weekStart, "yyyy-MM-dd");
    const e = format(weekEnd, "yyyy-MM-dd");
    return ordens.filter(o => o.data >= s && o.data <= e);
  }, [ordens, weekStart, weekEnd]);

  const ordensDia = useMemo(() => {
    const base = ordens.filter(o => o.status !== "aguardando_material");
    if (buscaPedido.trim()) {
      const q = buscaPedido.toLowerCase().trim();
      return base.filter(o => (o.numero_pedido || "").toLowerCase().includes(q) || (o.numero_oc || "").toLowerCase().includes(q) || (o.bobina_descricao || "").toLowerCase().includes(q));
    }
    const hoje = format(new Date(), "yyyy-MM-dd");
    if (selectedDay !== hoje) return base.filter(o => o.data === selectedDay);
    const atrasadas = base.filter(o => o.data < hoje && o.status !== "finalizado" && o.status !== "cancelado");
    return [...atrasadas, ...base.filter(o => o.data === selectedDay)];
  }, [ordens, selectedDay, buscaPedido]);

  const ordensMaqDia = useMemo(() => {
    const base = ordensMaq.filter(o => o.status !== "aguardando_material");
    if (buscaPedido.trim()) {
      const q = buscaPedido.toLowerCase().trim();
      return base.filter(o => (o.numero_pedido || "").toLowerCase().includes(q) || (o.numero_oc || "").toLowerCase().includes(q) || (o.tipo_peca || "").toLowerCase().includes(q) || (o.chapa_descricao || "").toLowerCase().includes(q));
    }
    const hoje = format(new Date(), "yyyy-MM-dd");
    if (selectedDay !== hoje) return base.filter(o => o.data === selectedDay);
    const atrasadas = base.filter(o => o.data < hoje && o.status !== "finalizado" && o.status !== "cancelado");
    return [...atrasadas, ...base.filter(o => o.data === selectedDay)];
  }, [ordensMaq, selectedDay, buscaPedido]);

  const totalSemanaOrdens = ordensSemana.length;
  const totalSemanaPecas = ordensSemana.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);

  const exportarSemana = () => {
    const linhas = ["Dia,Maquina,Bobina/Chapa,Tipo Peça,Quantidade,Status"];
    ordensSemana.forEach(o => {
      linhas.push(`${o.data},DESBOBINADEIRA,${o.bobina_descricao || ""},—,${o.quantidade || 0},${o.status || ""}`);
    });
    ordensMaq.filter(o => {
      const s = format(weekStart, "yyyy-MM-dd"); const e = format(weekEnd, "yyyy-MM-dd");
      return o.data >= s && o.data <= e;
    }).forEach(o => {
      linhas.push(`${o.data},${o.maquina},${o.chapa_descricao || ""},${o.tipo_peca || ""},${o.quantidade || 0},${o.status || ""}`);
    });
    const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `cd_semana_${format(weekStart, "dd-MM-yyyy")}.csv`; a.click();
    toast.success("Exportado!");
  };

  const ordenarOrdensCD = (lista) => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    return [...lista].sort((a, b) => {
      // 1. Finalizados e cancelados vão pro final
      const aConcluido = (a.status === "finalizado" || a.status === "cancelado") ? 1 : 0;
      const bConcluido = (b.status === "finalizado" || b.status === "cancelado") ? 1 : 0;
      if (aConcluido !== bConcluido) return aConcluido - bConcluido;

      // 2. Atrasadas pendentes vêm pro topo
      const aAtrasada = (!aConcluido && a.data < hoje) ? 0 : 1;
      const bAtrasada = (!bConcluido && b.data < hoje) ? 0 : 1;
      if (aAtrasada !== bAtrasada) return aAtrasada - bAtrasada;

      // 3. Em produção ou pausado primeiro
      const statusScore = { em_producao: 0, pausado: 1, pendente: 2, finalizado: 3, cancelado: 4 };
      const aScore = statusScore[a.status] ?? 2;
      const bScore = statusScore[b.status] ?? 2;
      if (aScore !== bScore && (aScore < 2 || bScore < 2)) {
        return aScore - bScore;
      }

      // 4. Peso de Prioridade / Rota (P1 = 0, Rota = 0.5, P2 = 1, P3 = 2, P4 = 3, P5 = 4, sem = 10)
      const aPeso = getPesoOrdenacaoPrioridade(a);
      const bPeso = getPesoOrdenacaoPrioridade(b);
      if (aPeso !== bPeso) return aPeso - bPeso;

      if (aScore !== bScore) return aScore - bScore;

      return (a.created_at || "").localeCompare(b.created_at || "");
    });
  };

  const ordensDiaOrdenadas = ordenarOrdensCD(ordensDia);
  const totalOrdensDia = ordensDia.length + ordensMaqDia.length;

  const todasOrdensDiaOrdenadas = useMemo(() => {
    return ordenarOrdensCD([...ordensDia, ...ordensMaqDia]);
  }, [ordensDia, ordensMaqDia]);

  const totalSemMaterial = useMemo(() => {
    const dSem = ordens.filter(o => o.status === "aguardando_material" || o.material_em_falta).length;
    const mSem = ordensMaq.filter(o => o.status === "aguardando_material" || o.material_em_falta).length;
    return dSem + mSem;
  }, [ordens, ordensMaq]);

  const kpisDia = useMemo(() => {
    const todas = [...ordensDia, ...ordensMaqDia];
    const emProducao = todas.filter(o => o.status === "em_producao");
    const pecasEmProducao = emProducao.reduce((acc, o) => acc + (Number(o.quantidade) || 0), 0);

    const pendentes = todas.filter(o => o.status === "pendente" || o.status === "aguardando_corte" || o.status === "pausado");
    const pecasPendentes = pendentes.reduce((acc, o) => acc + (Number(o.quantidade) || 0), 0);

    const finalizadas = todas.filter(o => o.status === "finalizado");
    const pecasFinalizadas = finalizadas.reduce((acc, o) => acc + (Number(o.quantidade) || 0), 0);

    return {
      emProducaoCount: emProducao.length,
      pecasEmProducao,
      pendentesCount: pendentes.length,
      pecasPendentes,
      finalizadasCount: finalizadas.length,
      pecasFinalizadas,
      semMaterialCount: totalSemMaterial,
      totalOrdens: todas.length
    };
  }, [ordensDia, ordensMaqDia, totalSemMaterial]);

  // Operador restrito: redireciona para mensagem de acesso negado se não for Desbobinadeira
  if (user && !isGestor) {
    if (!maquinaDoUsuario) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <span className="text-3xl">🔧</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Máquina não configurada</h2>
          <p className="text-muted-foreground max-w-sm">Peça ao administrador para configurar a máquina associada ao seu usuário.</p>
        </div>
      );
    }
    // Operador de outra máquina tentando acessar esta página geral
    const maquinasCD = ["CORTE 3M", "DOBRA 3M", "CORTE 6M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA", "DESBOBINADEIRA 01", "DESBOBINADEIRA 02", "DESBOBINADEIRA"];
    if (!maquinasCD.includes(maquinaDoUsuario)) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
          <p className="text-muted-foreground max-w-sm">Você não tem acesso a esta seção. Sua máquina: <strong>{maquinaDoUsuario}</strong>.</p>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-orange-500" />
            Produção — Corte e Dobra
          </h1>
          <p className="text-sm text-muted-foreground">Ordens de produção do setor</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarSemana} className="gap-1">
            <Download className="w-4 h-4" /> Exportar
          </Button>
          {isGestor && (
            <Button onClick={() => openNewDesb(selectedDay)} className="gap-2 bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4" /> Nova Ordem
            </Button>
          )}
        </div>
      </div>

      {/* Cards de KPIs Operacionais do Dia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Em Produção Agora */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-500 animate-pulse" /> Em Produção Agora
            </span>
            <Badge className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px] font-bold">
              {kpisDia.pecasEmProducao} pçs
            </Badge>
          </div>
          <p className="text-2xl font-black mt-1 text-foreground">
            {kpisDia.emProducaoCount} <span className="text-xs font-normal text-muted-foreground">OP(s)</span>
          </p>
        </div>

        {/* 2. Na Fila Pendentes */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Na Fila (Pendentes)
            </span>
            <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-bold">
              {kpisDia.pecasPendentes} pçs
            </Badge>
          </div>
          <p className="text-2xl font-black mt-1 text-foreground">
            {kpisDia.pendentesCount} <span className="text-xs font-normal text-muted-foreground">OP(s)</span>
          </p>
        </div>

        {/* 3. Sem Chapa / Alerta */}
        <button
          type="button"
          onClick={() => setViewMode("sem_material")}
          className={`text-left rounded-xl p-3.5 border transition-all cursor-pointer shadow-2xs ${
            kpisDia.semMaterialCount > 0
              ? "bg-red-50/60 dark:bg-red-950/30 border-red-300 dark:border-red-800/60 hover:bg-red-100/40"
              : "bg-card border-border hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className={`w-3.5 h-3.5 ${kpisDia.semMaterialCount > 0 ? "text-red-500 animate-bounce" : "text-slate-400"}`} />
              Sem Chapa / Alerta
            </span>
            {kpisDia.semMaterialCount > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold">
                Ação Req.
              </Badge>
            )}
          </div>
          <p className={`text-2xl font-black mt-1 ${kpisDia.semMaterialCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
            {kpisDia.semMaterialCount} <span className="text-xs font-normal text-muted-foreground">travada(s)</span>
          </p>
        </button>

        {/* 4. Finalizadas Hoje */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Finalizadas Hoje
            </span>
            <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
              {kpisDia.pecasFinalizadas} pçs ✓
            </Badge>
          </div>
          <p className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
            {kpisDia.finalizadasCount} <span className="text-xs font-normal text-muted-foreground">OP(s)</span>
          </p>
        </div>
      </div>

      {/* Navegador de Semana e Dias por Pílula */}
      <div className="bg-card border border-border rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-foreground text-sm flex items-center gap-2 flex-wrap">
                Semana de {format(weekStart, "dd 'de' MMM", { locale: ptBR })} a {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}
                <Badge variant="outline" className="text-[10px] py-0 border-orange-500/30 text-orange-600 font-bold">
                  {totalSemanaOrdens} ordens · {totalSemanaPecas} pçs finalizadas
                </Badge>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const hojeStr = format(new Date(), "yyyy-MM-dd");
                setSelectedDay(hojeStr);
                setCurrentWeek(new Date());
              }}
              className="h-8 text-xs font-bold gap-1 px-3"
              title="Ir para o dia de hoje"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Hoje</span>
            </Button>

            <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-muted/40">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCurrentWeek(w => subWeeks(w, 1))}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCurrentWeek(w => addWeeks(w, 1))}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Próxima semana"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Pílulas de Dias */}
        <div className="grid grid-cols-7 gap-1.5 overflow-x-auto pb-0.5">
          {diasDaSemana.map((dia) => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const ordensDoDia = ordensSemana.filter(o => o.data === diaStr);
            const ordensMaqDoDia = ordensMaq.filter(o => o.data === diaStr);
            const totalOrdens = ordensDoDia.length + ordensMaqDoDia.length;
            const pecasDia = [...ordensDoDia, ...ordensMaqDoDia].filter(o => o.status === "finalizado").reduce((s, o) => s + (Number(o.quantidade) || 0), 0);
            const isSelected = selectedDay === diaStr;
            const isHoje = isToday(dia);

            return (
              <button
                key={diaStr}
                onClick={() => setSelectedDay(diaStr)}
                className={`rounded-xl p-2 text-center transition-all cursor-pointer border flex flex-col items-center justify-between ${
                  isSelected
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm scale-101 ring-2 ring-orange-500/30"
                    : isHoje
                    ? "border-orange-400/60 bg-orange-500/10 text-foreground font-bold hover:bg-orange-500/15"
                    : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                }`}
              >
                {isHoje && (
                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 rounded-full mb-0.5 ${isSelected ? "bg-white text-orange-600" : "bg-orange-500 text-white"}`}>
                    Hoje
                  </span>
                )}
                <span className={`text-[10px] uppercase font-extrabold ${isSelected ? "text-white/90" : "text-muted-foreground"}`}>
                  {format(dia, "EEE", { locale: ptBR })}
                </span>
                <span className={`text-base font-black ${isSelected ? "text-white" : "text-foreground"}`}>
                  {format(dia, "dd")}
                </span>
                <div className="mt-1">
                  {totalOrdens > 0 ? (
                    <Badge variant="outline" className={`text-[10px] py-0 px-1.5 font-bold ${isSelected ? "bg-white/20 text-white border-white/30" : "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30"}`}>
                      {totalOrdens} op{pecasDia > 0 ? ` · ${pecasDia}p` : ""}
                    </Badge>
                  ) : (
                    <span className={`text-[10px] opacity-40 ${isSelected ? "text-white" : ""}`}>—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Abas Principais + Busca + Zoom */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-3">
        {/* Abas */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={viewMode === "maquinas" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("maquinas")}
            className={`gap-1.5 text-xs font-bold ${viewMode === "maquinas" ? "bg-orange-500 hover:bg-orange-600 text-white shadow-xs" : ""}`}
          >
            <Factory className="w-3.5 h-3.5" />
            <span>Por Máquinas</span>
          </Button>

          <Button
            variant={viewMode === "lista" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("lista")}
            className={`gap-1.5 text-xs font-bold ${viewMode === "lista" ? "bg-orange-500 hover:bg-orange-600 text-white shadow-xs" : ""}`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Lista Geral ({totalOrdensDia})</span>
          </Button>

          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
            className={`gap-1.5 text-xs font-bold ${viewMode === "kanban" ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs" : ""}`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Quadro Kanban</span>
          </Button>

          <Button
            variant={viewMode === "fila_pcp" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("fila_pcp")}
            className={`gap-1.5 text-xs font-bold ${viewMode === "fila_pcp" ? "bg-orange-500 hover:bg-orange-600 text-white shadow-xs" : ""}`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Fila PCP</span>
          </Button>

          <Button
            variant={viewMode === "sem_material" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("sem_material")}
            className={`gap-1.5 text-xs font-bold ${viewMode === "sem_material" ? "bg-red-600 hover:bg-red-700 text-white shadow-xs" : ""}`}
          >
            <PackageX className="w-3.5 h-3.5" />
            <span>Sem Material</span>
            {totalSemMaterial > 0 && (
              <Badge className="bg-white text-red-600 text-[10px] py-0 px-1 font-black ml-0.5">
                {totalSemMaterial}
              </Badge>
            )}
          </Button>
        </div>

        {/* Busca Rápida + Links Estoque & Expedição + Zoom */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={buscaPedido}
              onChange={(e) => setBuscaPedido(e.target.value)}
              placeholder="Buscar por nº pedido ou OC..."
              className="h-8 pl-8 pr-3 rounded-md border border-input bg-card text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-48"
            />
            {buscaPedido && (
              <button
                onClick={() => setBuscaPedido("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Link to="/corte-dobra/estoque-dashboard">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-teal-600 dark:text-teal-400 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40">
              <Layers className="w-3.5 h-3.5 text-teal-500" /> Estoque
            </Button>
          </Link>

          <Link to="/logistica">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40">
              <Truck className="w-3.5 h-3.5 text-blue-500" /> Expedição
            </Button>
          </Link>

          {/* Zoom */}
          <div className="flex items-center gap-0.5 bg-muted/40 border border-border rounded-lg p-0.5">
            <Button
              variant={zoom === "compacto" ? "default" : "ghost"}
              size="sm"
              onClick={() => setZoom("compacto")}
              className="h-7 px-2 text-[11px]"
              title="Compacto"
            >
              <ZoomOut className="w-3 h-3" />
            </Button>
            <Button
              variant={zoom === "normal" ? "default" : "ghost"}
              size="sm"
              onClick={() => setZoom("normal")}
              className="h-7 px-2 text-[11px]"
              title="Normal"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button
              variant={zoom === "grande" ? "default" : "ghost"}
              size="sm"
              onClick={() => setZoom("grande")}
              className="h-7 px-2 text-[11px]"
              title="Grande"
            >
              <ZoomIn className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" /></div>
      ) : viewMode === "sem_material" ? (
        <OPSemMaterialTab />
      ) : viewMode === "expedicao" ? (
        <ExpedicaoTab tipo="cd" filialAtiva={filialAtiva} />
      ) : viewMode === "fila_pcp" ? (
        <FilaPCPCorteDobra onNovaOrdem={(pedido, item) => openNewFromFila(pedido, item)} />
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          itens={[...ordensDiaOrdenadas, ...ordensMaqDia]}
          tipoSetor="corte_dobra"
          onStatusChange={handleStatusChangeKanban}
          onOpenDetails={(item) => {
            if (!item.maquina || item.maquina === "DESBOBINADEIRA" || item.maquina?.startsWith?.("DESBOBINADEIRA")) {
              openEditDesb(item);
            } else {
              openEditMaq(item);
            }
          }}
        />
      ) : viewMode === "lista" ? (
        /* ── VISÃO LISTA GERAL UNIFICADA DO DIA ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-bold capitalize flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              {format(new Date(selectedDay + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 font-bold">
              {todasOrdensDiaOrdenadas.length} ordens no total
            </Badge>
          </div>

          {todasOrdensDiaOrdenadas.length === 0 ? (
            <div className="bg-muted/20 border border-dashed border-border rounded-xl p-8 text-center space-y-2">
              <Factory className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Nenhuma ordem registrada neste dia</p>
              <p className="text-xs text-muted-foreground">Clique em "Nova Ordem" ou selecione pedidos na aba "Fila PCP".</p>
              {isGestor && (
                <Button size="sm" onClick={() => openNewDesb(selectedDay)} className="bg-orange-500 hover:bg-orange-600 gap-1.5 mt-2">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Ordem
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {todasOrdensDiaOrdenadas.map((o) => {
                const isMaq = o.maquina && o.maquina !== "DESBOBINADEIRA" && !o.maquina?.startsWith?.("DESBOBINADEIRA");
                return (
                  <OrdemCardCD
                    key={o.id}
                    ordem={o}
                    tipo={isMaq ? "maquina" : "desbobinadeira"}
                    isGestor={isGestor}
                    user={user}
                    onEdit={isMaq ? openEditMaq : openEditDesb}
                    onDelete={(id) => isMaq ? deleteMaq.mutate(id) : deleteDesb.mutate(id)}
                    onStatusChange={isMaq ? handleStatusChangeMaq : handleStatusChangeDesb}
                    onSelectPrioridade={isMaq ? handleSelectPrioridadeMaq : handleSelectPrioridadeDesb}
                    onToggleRota={isMaq ? handleToggleRotaMaq : handleToggleRotaDesb}
                    onRetrabalho={(ord) => { setOrdemRetrabalho(isMaq ? ord : { ...ord, _desb: true }); setDialogRetrabalho(true); }}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── VISÃO POR MÁQUINAS (PADRÃO) ── */
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-bold capitalize flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              {format(new Date(selectedDay + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 font-bold">{totalOrdensDia} ordens no total</Badge>
          </div>

          {/* ── DESBOBINADEIRA ── */}
          {(isGestor || !maquinaDoUsuario || maquinaDoUsuario === "DESBOBINADEIRA" || maquinaDoUsuario?.startsWith?.("DESBOBINADEIRA")) && (
            <MaquinaBloco
              label="DESBOBINADEIRA"
              cor="bg-orange-100 text-orange-800 border-orange-200"
              ordens={ordensDiaOrdenadas}
              isGestor={isGestor}
              onAdd={() => openNewDesb(selectedDay)}
              renderRow={(o) => (
                <OrdemCardCD
                  key={o.id}
                  ordem={o}
                  tipo="desbobinadeira"
                  isGestor={isGestor}
                  user={user}
                  onEdit={openEditDesb}
                  onDelete={(id) => deleteDesb.mutate(id)}
                  onStatusChange={handleStatusChangeDesb}
                  onSelectPrioridade={handleSelectPrioridadeDesb}
                  onToggleRota={handleToggleRotaDesb}
                  onRetrabalho={(ord) => { setOrdemRetrabalho({ ...ord, _desb: true }); setDialogRetrabalho(true); }}
                />
              )}
            />
          )}

          {/* ── OUTRAS MÁQUINAS ── */}
          {MAQUINAS_OUTRAS.filter(maq => isGestor || !maquinaDoUsuario || maquinaDoUsuario === maq.id).map(maq => {
            const ordensDaMaq = ordenarOrdensCD(ordensMaqDia.filter(o => o.maquina === maq.id));
            return (
              <MaquinaBloco key={maq.id}
                label={maq.label}
                cor={maq.cor}
                ordens={ordensDaMaq}
                isGestor={isGestor}
                onAdd={() => openNewMaq(maq.id, selectedDay)}
                renderRow={(o) => (
                  <OrdemCardCD
                    key={o.id}
                    ordem={o}
                    tipo="maquina"
                    isGestor={isGestor}
                    user={user}
                    onEdit={openEditMaq}
                    onDelete={(id) => deleteMaq.mutate(id)}
                    onStatusChange={handleStatusChangeMaq}
                    onSelectPrioridade={handleSelectPrioridadeMaq}
                    onToggleRota={handleToggleRotaMaq}
                    onRetrabalho={(ord) => { setOrdemRetrabalho(ord); setDialogRetrabalho(true); }}
                  />
                )}
              />
            );
          })}
        </div>
      )}

      <OrdemFormDialogCD
        open={dialogDesb}
        onClose={() => { setDialogDesb(false); setEditDesb(null); }}
        onSave={handleSaveDesb}
        editItem={editDesb && !editDesb._presets ? editDesb : null}
        defaultDate={editDesb?._presets?.data || selectedDay}
        isGestor={isGestor}
      />

      <OrdemMaquinaFormDialog
        open={dialogMaq}
        onClose={() => { setDialogMaq(false); setEditMaq(null); setFilaContext(null); }}
        onSave={handleSaveMaq}
        editItem={editMaq && !editMaq._presets ? editMaq : null}
        defaultDate={editMaq?._presets?.data || selectedDay}
        maquina={maquinaAtiva}
        produtoFixo={filaContext?.produtoFixo}
      />

      <RetrabalhoDialog
        open={dialogRetrabalho}
        onClose={() => { setDialogRetrabalho(false); setOrdemRetrabalho(null); }}
        ordemOrigem={ordemRetrabalho}
        onCreate={() => {
          queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
          queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
        }}
      />

      {/* Dialog Validação de Etiqueta da Chapa (Guilhotina) */}
      <ValidacaoEtiquetaChapaDialog
        open={validacaoChapaOpen}
        onClose={() => { setValidacaoChapaOpen(false); setOrdemValidandoChapa(null); }}
        ordem={ordemValidandoChapa}
        onAprovado={handleEtiquetaChapaAprovadaProducao}
        isGestor={isGestor}
      />

      {/* Dialog para Seleção de Operadores ao Iniciar OP */}
      <IniciarOpOperadoresDialog
        open={operadoresDialogOpen}
        onOpenChange={setOperadoresDialogOpen}
        ordem={ordemParaOperadores}
        maquinaNome={ordemParaOperadores?.maquina || "DESBOBINADEIRA"}
        onConfirm={handleConfirmarOperadores}
      />
    </div>
  );
}

function MaquinaBloco({ label, cor, ordens, isGestor, onAdd, renderRow }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <Badge className={`border ${cor}`}>{label}</Badge>
          <span className="text-sm text-muted-foreground">{ordens.length} ordem(ns)</span>
          {ordens.filter(o => o.status === "finalizado").length > 0 && (
            <span className="text-sm font-bold text-green-600">
              {ordens.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0)} pç ✓
            </span>
          )}
        </div>
        {isGestor && (
          <Button variant="ghost" size="sm" onClick={onAdd} className="h-7 gap-1 text-xs">
            <Plus className="w-3 h-3" /> Adicionar
          </Button>
        )}
      </div>

      {ordens.length === 0 ? (
        <div className="px-4 py-6 flex flex-col items-center gap-2">
          <Factory className="w-7 h-7 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground">Sem ordens para este dia</p>
          {isGestor && (
            <Button size="sm" onClick={onAdd} className="gap-1 bg-orange-500 hover:bg-orange-600 mt-1">
              <Plus className="w-3 h-3" /> Nova Ordem
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">{ordens.map(o => renderRow(o))}</div>
      )}
    </div>
  );
}