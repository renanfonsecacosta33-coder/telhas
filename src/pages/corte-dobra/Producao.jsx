import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, Factory, Calendar, Wrench, Download, ZoomIn, ZoomOut, Maximize2, Search, AlertTriangle, X, PackageX, Truck, Inbox } from "lucide-react";
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
  const [viewMode, setViewMode] = useState("semana");
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

  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] }); setDialogMaq(false); toast.success("Ordem criada!"); },
  });
  const updateMaq = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemMaquinaCD.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] }),
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
    if (novoStatus === "em_producao") {
      const isGuilhotina = ordem.maquina === "CORTE 3M" || ordem.maquina === "CORTE 6M";
      if (isGuilhotina) {
        setOrdemValidandoChapa(ordem);
        setValidacaoChapaOpen(true);
        return;
      }
    }
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
    if (data.maquina_inicial && data.maquina_inicial !== "DESBOBINADEIRA") {
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

  // Abrir formulário completo de Nova Ordem a partir de um item da Fila PCP
  const openNewFromFila = (pedido, item) => {
    setMaquinaAtiva(null);
    setFilaContext({ pedidoId: pedido.id, itemIdx: item._idx, pedido, produtoFixo: item.produto || "" });
    setEditMaq({
      data: selectedDay,
      numero_pedido: pedido.numero_pedido || "",
      cliente: pedido.cliente_nome || "",
      vendedor: pedido.vendedor_nome || "",
      tipo_peca: item.produto || "",
      dimensoes_livres: item.medida || "",
      quantidade: item.quantidade || "",
      material_espessura: item.espessura ? String(item.espessura) : "",
    });
    setDialogMaq(true);
  };
  const openEditMaq = (item) => { setMaquinaAtiva(item.maquina); setEditMaq(item); setDialogMaq(true); };
  const handleSaveMaq = (data) => {
    if (editMaq && !editMaq._presets && editMaq.id) {
      updateMaq.mutate({ id: editMaq.id, data });
      setDialogMaq(false);
    } else {
      createMaq.mutate(data, {
        onSuccess: async () => {
          const ctx = filaContext;
          setFilaContext(null);
          if (!ctx) return;
          try {
            // Atualiza o status do item no itens_json para "em_producao" + máquina
            const itens = getItens(ctx.pedido);
            if (itens[ctx.itemIdx]) {
              itens[ctx.itemIdx] = {
                ...itens[ctx.itemIdx],
                status: "em_producao",
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
      return base.filter(o => (o.numero_pedido || "").toLowerCase().includes(q) || (o.bobina_descricao || "").toLowerCase().includes(q));
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
      return base.filter(o => (o.numero_pedido || "").toLowerCase().includes(q) || (o.tipo_peca || "").toLowerCase().includes(q) || (o.chapa_descricao || "").toLowerCase().includes(q));
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
    const maquinasCD = ["CORTE 3M", "DOBRA 3M", "CORTE 6M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA", "DESBOBINADEIRA"];
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

      {/* Navegação de semana */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => subWeeks(w, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-bold text-lg">
              Semana de {format(weekStart, "dd 'de' MMM", { locale: ptBR })} a {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}
            </p>
            <Badge className="bg-orange-100 text-orange-700 border-orange-200">
              {totalSemanaOrdens} ordens · {totalSemanaPecas} peças finalizadas
            </Badge>
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(w => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const ordensDoDia = ordensSemana.filter(o => o.data === diaStr);
            const pecasDia = ordensDoDia.filter(o => o.status === "finalizado").reduce((s, o) => s + (o.quantidade || 0), 0);
            const isSelected = selectedDay === diaStr;
            const isHoje = isToday(dia);
            return (
              <button key={diaStr} onClick={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                className={`rounded-lg p-2 text-center transition-all duration-200 cursor-pointer border ${isSelected ? "bg-orange-500 text-white border-orange-500" : isHoje ? "border-orange-400/50 bg-orange-50" : "border-border hover:bg-muted/50"}`}>
                <p className="text-xs font-semibold uppercase">{format(dia, "EEE", { locale: ptBR })}</p>
                <p className={`text-lg font-bold ${isSelected ? "" : isHoje ? "text-orange-500" : ""}`}>{format(dia, "dd")}</p>
                {ordensDoDia.length > 0 && (
                  <div className={`text-xs mt-0.5 ${isSelected ? "text-white/80" : "text-muted-foreground"}`}>
                    {ordensDoDia.length}o{pecasDia > 0 ? ` · ${pecasDia}p` : ""}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle + Busca */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Busca por pedido */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={buscaPedido}
              onChange={(e) => { setBuscaPedido(e.target.value); if (e.target.value.trim()) setViewMode("dia"); }}
              placeholder="Buscar por nº pedido..."
              className="h-9 pl-8 pr-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-52"
            />
            {buscaPedido && (
              <button onClick={() => setBuscaPedido("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button variant={viewMode === "semana" ? "default" : "outline"} size="sm" onClick={() => setViewMode("semana")}>Visão Semana</Button>
          <Button variant={viewMode === "dia" ? "default" : "outline"} size="sm" onClick={() => setViewMode("dia")}
            className={viewMode === "dia" ? "bg-orange-500 hover:bg-orange-600 border-0" : ""}>
            Visão Dia — {format(new Date(selectedDay + "T12:00:00"), "dd/MM", { locale: ptBR })}
          </Button>
          <Button variant={viewMode === "sem_material" ? "default" : "outline"} size="sm" onClick={() => setViewMode("sem_material")}
            className={`gap-1 ${viewMode === "sem_material" ? "bg-amber-500 hover:bg-amber-600 border-0 text-white" : ""}`}>
            <PackageX className="w-3 h-3" /> OP sem Material
          </Button>
          <Button variant={viewMode === "expedicao" ? "default" : "outline"} size="sm" onClick={() => setViewMode("expedicao")}
            className={`gap-1 ${viewMode === "expedicao" ? "bg-blue-500 hover:bg-blue-600 border-0 text-white" : ""}`}>
            <Truck className="w-3 h-3" /> Expedição
          </Button>
          <Button variant={viewMode === "fila_pcp" ? "default" : "outline"} size="sm" onClick={() => setViewMode("fila_pcp")}
            className={`gap-1 ${viewMode === "fila_pcp" ? "bg-orange-500 hover:bg-orange-600 border-0 text-white" : ""}`}>
            <Inbox className="w-3 h-3" /> Fila PCP
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSelectedDay(format(new Date(), "yyyy-MM-dd")); setCurrentWeek(new Date()); setViewMode("dia"); }} className="gap-1">
            <Calendar className="w-3 h-3" /> Hoje
          </Button>
        </div>
        {/* Zoom */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
          <Button variant={zoom === "compacto" ? "default" : "ghost"} size="sm" onClick={() => setZoom("compacto")}
            className="h-7 px-2 gap-1 text-xs" title="Visualização compacta">
            <ZoomOut className="w-3.5 h-3.5" /> Compacto
          </Button>
          <Button variant={zoom === "normal" ? "default" : "ghost"} size="sm" onClick={() => setZoom("normal")}
            className="h-7 px-2 gap-1 text-xs" title="Visualização normal">
            <Maximize2 className="w-3.5 h-3.5" /> Normal
          </Button>
          <Button variant={zoom === "grande" ? "default" : "ghost"} size="sm" onClick={() => setZoom("grande")}
            className="h-7 px-2 gap-1 text-xs" title="Visualização grande">
            <ZoomIn className="w-3.5 h-3.5" /> Grande
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" /></div>
      ) : viewMode === "semana" ? (
        <div className="space-y-3">
          {diasDaSemana.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const ordensDoDia = ordensSemana.filter(o => o.data === diaStr);
            return (
              <DiaResumoCardCD key={diaStr} dia={dia} ordens={ordensDoDia}
                onVerDia={() => { setSelectedDay(diaStr); setViewMode("dia"); }}
                onNovaOrdem={() => openNewDesb(diaStr)} />
            );
          })}
        </div>
      ) : viewMode === "sem_material" ? (
        <OPSemMaterialTab />
      ) : viewMode === "expedicao" ? (
        <ExpedicaoTab tipo="cd" filialAtiva={filialAtiva} />
      ) : viewMode === "fila_pcp" ? (
        <FilaPCPCorteDobra onNovaOrdem={(pedido, item) => openNewFromFila(pedido, item)} />
      ) : (
        // ── VISÃO DIA ──
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold capitalize">
              {format(new Date(selectedDay + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </h2>
            <Badge className="bg-orange-100 text-orange-700 border-orange-200">{totalOrdensDia} ordens no total</Badge>
          </div>

          {/* ── DESBOBINADEIRA ── */}
          {(isGestor || !maquinaDoUsuario || maquinaDoUsuario === "DESBOBINADEIRA") && (
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