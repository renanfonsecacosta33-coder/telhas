import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, Calendar, Factory, Layers, Star, AlertTriangle } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import OrdemMaquinaFormDialog from "@/components/corte-dobra/OrdemMaquinaFormDialog.jsx";
import RetrabalhoDialog from "@/components/corte-dobra/RetrabalhoDialog";
import { useFilial } from "@/contexts/FilialContext";
import FiltroChapa from "@/components/corte-dobra/FiltroChapa";
import ChatFloatingButton from "@/components/chat/ChatFloatingButton";
import FinalizarExpedienteButton from "@/components/expediente/FinalizarExpedienteButton";
import ImageViewer from "@/components/ui/ImageViewer";
import { extractEspessuraFromDesc } from "@/components/corte-dobra/CorChapaDot";

import WorkListPanel from "@/components/corte-dobra/Cockpit/WorkListPanel";
import DetalheOPPanel from "@/components/corte-dobra/Cockpit/DetalheOPPanel";
import InsumosCQPanel from "@/components/corte-dobra/Cockpit/InsumosCQPanel";
import ActionBar from "@/components/corte-dobra/Cockpit/ActionBar";
import StatusFooter from "@/components/corte-dobra/Cockpit/StatusFooter";
import {
  PausaDialog, FinalizarFotoDialog, ModificacaoBlankDialog,
  BloqueioDialog, PrioridadeDialog, SucataDialog, AproveitamentoWrapper,
} from "@/components/corte-dobra/Cockpit/CockpitDialogs";

export default function MaquinaCDPanel({ maquinaId, maquinaLabel, cor }) {
  const { filialAtiva } = useFilial();
  const [user, setUser] = useState(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState("dia");
  const [dialog, setDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [buscaPedido, setBuscaPedido] = useState("");
  const [filtroEspessura, setFiltroEspessura] = useState("todas");
  const [filtroChapa, setFiltroChapa] = useState("todas");
  const [dialogRetrabalho, setDialogRetrabalho] = useState(false);
  const [ordemRetrabalho, setOrdemRetrabalho] = useState(null);

  // ─── Cockpit state ───
  const [ordemSelecionada, setOrdemSelecionada] = useState(null);
  const [medicao1, setMedicao1] = useState("");
  const [medicao2, setMedicao2] = useState("");
  const [cqAprovado, setCqAprovado] = useState(null);

  // Dialog state
  const [pausaDialog, setPausaDialog] = useState(false);
  const [fotoDialog, setFotoDialog] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [modificacaoDialog, setModificacaoDialog] = useState(false);
  const [aproveitamentoDialog, setAproveitamentoDialog] = useState(false);
  const [bloqueioDialog, setBloqueioDialog] = useState(false);
  const [ordemBloqueante, setOrdemBloqueante] = useState(null);
  const [acaoPendente, setAcaoPendente] = useState(null);
  const [prioridadeDialog, setPrioridadeDialog] = useState(false);
  const [ordemPrioritaria, setOrdemPrioritaria] = useState(null);
  const [sucataDialog, setSucataDialog] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  // Pending state para finalização (guilhotina flow)
  const [pendingFotoUrl, setPendingFotoUrl] = useState(null);
  const [pendingProdSeg, setPendingProdSeg] = useState(0);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  function parseMaquinas(maquina) {
    if (!maquina) return [];
    try {
      const parsed = JSON.parse(maquina);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch {
      return [maquina];
    }
  }

  const isGestor = user?.role === "admin" || user?.role === "super_admin" || user?.gerencia === true || user?.full_name?.toLowerCase().includes("hudson");
  const maquinasDoUsuario = parseMaquinas(user?.maquina);
  const isOperadorRestrito = user && !isGestor;

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const diasDaSemana = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens-maquina-cd", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 10000,
  });

  const { data: ordensDesbob = [] } = useQuery({
    queryKey: ["ordens-desbobinadeira", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 10000,
  });

  const ordensDaMaquina = useMemo(
    () => ordens.filter(o => o.maquina === maquinaId),
    [ordens, maquinaId]
  );

  const pedidoSeqMap = useMemo(() => {
    const map = {};
    const groups = {};
    const todas = [...ordens, ...ordensDesbob];
    for (const o of todas) {
      if (!o.numero_pedido) continue;
      if (!groups[o.numero_pedido]) groups[o.numero_pedido] = [];
      groups[o.numero_pedido].push(o);
    }
    for (const items of Object.values(groups)) {
      const unique = Array.from(new Map(items.map(i => [i.id, i])).values());
      unique.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
      const total = unique.length;
      unique.forEach((item, idx) => { map[item.id] = `${idx + 1}/${total}`; });
    }
    return map;
  }, [ordens, ordensDesbob]);

  const ordensSemana = useMemo(() => {
    const s = format(weekStart, "yyyy-MM-dd");
    const e = format(weekEnd, "yyyy-MM-dd");
    return ordensDaMaquina.filter(o => o.data >= s && o.data <= e);
  }, [ordensDaMaquina, weekStart, weekEnd]);

  const ordensDia = useMemo(() => {
    if (buscaPedido.trim()) {
      const q = buscaPedido.toLowerCase().trim();
      return ordensDaMaquina.filter(o => (o.numero_pedido || "").toLowerCase().includes(q) || (o.tipo_peca || "").toLowerCase().includes(q) || (o.chapa_descricao || "").toLowerCase().includes(q) || (o.cliente || "").toLowerCase().includes(q));
    }
    const hoje = format(new Date(), "yyyy-MM-dd");
    const isHoje = selectedDay === hoje;
    const doDia = ordensDaMaquina.filter(o => o.data === selectedDay);
    const priComp = (a, b) => (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0);
    if (!isHoje) {
      return doDia.sort((a, b) => {
        const p = priComp(a, b);
        if (p !== 0) return p;
        const ord = { em_producao: 0, pausado: 1, aguardando_corte: 2, pendente: 3, finalizado: 4, cancelado: 5 };
        return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
      });
    }
    const atrasadas = ordensDaMaquina.filter(o => o.data < hoje && o.status !== "finalizado" && o.status !== "cancelado");
    return [...atrasadas, ...doDia].sort((a, b) => {
      const p = priComp(a, b);
      if (p !== 0) return p;
      const aAtrasada = a.data < hoje ? 0 : 1;
      const bAtrasada = b.data < hoje ? 0 : 1;
      if (aAtrasada !== bAtrasada) return aAtrasada - bAtrasada;
      const ord = { em_producao: 0, pausado: 1, aguardando_corte: 2, pendente: 3, finalizado: 4, cancelado: 5 };
      return (ord[a.status] ?? 3) - (ord[b.status] ?? 3);
    });
  }, [ordensDaMaquina, selectedDay, buscaPedido]);

  const updateMaq = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OrdemMaquinaCD.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] }),
  });
  const createMaq = useMutation({
    mutationFn: (data) => base44.entities.OrdemMaquinaCD.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] }); },
  });

  const handleSave = async (data) => {
    if (editItem && !editItem._presets && editItem.id) {
      updateMaq.mutate({ id: editItem.id, data });
      setDialog(false);
    } else {
      const saved = await createMaq.mutateAsync(data);
      toast.success("Ordem criada!");
      if (data.ordem_dobra_maquina && data.chapa_cd_id) {
        await base44.entities.OrdemMaquinaCD.create({
          data: data.data, maquina: data.ordem_dobra_maquina, tipo_peca: data.tipo_peca,
          dimensoes_livres: data.dimensoes_livres, quantidade: data.quantidade, peso_kg: data.peso_kg,
          numero_pedido: data.numero_pedido, cliente: data.cliente, chapa_cd_id: data.chapa_cd_id,
          chapa_descricao: data.chapa_descricao, chapa_origem: "chaparia",
          desenvolvimento_id: data.desenvolvimento_id, desenvolvimento_descricao: data.desenvolvimento_descricao,
          ordem_corte_id: saved.id, status: "aguardando_corte",
          foto_pedido_url: data.foto_pedido_url || null, foto_material_url: data.foto_material_url || null,
          observacoes: `Gerado automaticamente do ${data.maquina}`,
        });
        queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
        toast.success("Ordem de dobra vinculada criada!");
      }
      setDialog(false);
    }
  };

  const openNew = (date = null) => { setEditItem(date ? { _presets: { data: date } } : null); setDialog(true); };
  const openEdit = (item) => { setEditItem(item); setDialog(true); };

  // Lista para o WorkListPanel (visão semana mostra toda a semana, dia mostra o dia)
  const listaWorkList = viewMode === "semana" ? ordensSemana : ordensDia;

  // Auto-selecionar a primeira OP não finalizada ao carregar
  useEffect(() => {
    if (!ordemSelecionada && listaWorkList.length > 0) {
      const primeira = listaWorkList.find(o => o.status !== "finalizado" && o.status !== "cancelado") || listaWorkList[0];
      setOrdemSelecionada(primeira);
    }
    // Se a OP selecionada não está mais na lista, limpar
    if (ordemSelecionada && !listaWorkList.find(o => o.id === ordemSelecionada.id)) {
      const primeira = listaWorkList.find(o => o.status !== "finalizado" && o.status !== "cancelado") || listaWorkList[0] || null;
      setOrdemSelecionada(primeira);
    }
  }, [listaWorkList]);

  // ─── Ações do Cockpit (lógica de negócio) ───
  const o = ordemSelecionada;
  const isGuilhotina = o?.maquina === "CORTE 3M" || o?.maquina === "CORTE 6M";

  const verificarBloqueio = (acao) => {
    if (!o) return false;
    const ativa = (ordensDaMaquina || []).find(other =>
      other.id !== o.id && other.maquina === o.maquina &&
      (other.status === "em_producao" || other.status === "pausado")
    );
    if (ativa) {
      if (isGestor) {
        setOrdemBloqueante(ativa);
        setAcaoPendente(acao);
        setBloqueioDialog(true);
      } else {
        toast.error("Já existe uma OP em andamento nesta máquina. Finalize ou pause a OP atual antes de iniciar outra.");
      }
      return true;
    }
    return false;
  };

  const doIniciar = () => {
    if (!o) return;
    updateMaq.mutate({ id: o.id, data: { status: "em_producao", inicio_producao_ts: new Date().toISOString() } });
    setOrdemSelecionada(prev => prev ? { ...prev, status: "em_producao", inicio_producao_ts: new Date().toISOString() } : prev);
  };

  const handleIniciar = () => {
    if (!o) return;
    if (verificarBloqueio("iniciar")) return;
    if (!o.prioridade) {
      const pri = (ordensDaMaquina || []).find(other =>
        other.id !== o.id && other.maquina === o.maquina && other.prioridade === true &&
        other.status !== "finalizado" && other.status !== "cancelado"
      );
      if (pri) {
        setOrdemPrioritaria(pri);
        setPrioridadeDialog(true);
        return;
      }
    }
    doIniciar();
  };

  const handlePausar = () => setPausaDialog(true);

  const confirmarPausa = (motivo) => {
    if (!o) return;
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    updateMaq.mutate({ id: o.id, data: {
      status: "pausado", tempo_producao_seg: prodSeg, inicio_producao_ts: null,
      inicio_pausa_ts: new Date().toISOString(), motivo_pausa: motivo,
    }});
    setOrdemSelecionada(prev => prev ? { ...prev, status: "pausado", tempo_producao_seg: prodSeg, inicio_producao_ts: null, inicio_pausa_ts: new Date().toISOString(), motivo_pausa: motivo } : prev);
  };

  const confirmarBloqueio = () => {
    setBloqueioDialog(false);
    if (acaoPendente === "iniciar") doIniciar();
    setAcaoPendente(null);
    setOrdemBloqueante(null);
  };

  const calcularProdSeg = () => {
    if (!o) return 0;
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    return prodSeg;
  };

  const descontarEstoques = async () => {
    if (!o) return;
    if (o.chapa_cd_id && (o.quantidade || 0) > 0) {
      try {
        const chapa = await base44.entities.ChapaCD.get(o.chapa_cd_id);
        if (chapa) {
          const novaQtd = Math.max(0, (chapa.quantidade_disponivel || 0) - o.quantidade);
          await base44.entities.ChapaCD.update(o.chapa_cd_id, {
            quantidade_disponivel: novaQtd, status: novaQtd === 0 ? "consumido" : chapa.status,
          });
        }
      } catch {}
    }
    if (o.chapa_origem === "direto" && o.bobina_id && (o.peso_kg || 0) > 0) {
      try {
        const bobina = await base44.entities.Bobina.get(o.bobina_id);
        if (bobina) {
          await base44.entities.Bobina.update(o.bobina_id, {
            peso_kg: Math.max(0, (bobina.peso_kg || 0) - o.peso_kg),
          });
        }
      } catch {}
    }
  };

  const handleConcluir = async () => {
    if (!o) return;
    if (isGuilhotina) {
      await descontarEstoques();
      const prodSeg = calcularProdSeg();
      setPendingProdSeg(prodSeg);
      setPendingFotoUrl(null);
      setAproveitamentoDialog(true);
      return;
    }
    setFotoDialog(true);
  };

  const handleUploadFoto = async (file) => {
    if (!file || !o) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const prodSeg = calcularProdSeg();
      await descontarEstoques();
      await finalizarOrdem(file_url, prodSeg, false, "");
    } catch (err) {
      toast.error("Erro ao enviar foto: " + (err.message || ""));
    }
    setUploadingFoto(false);
    setFotoDialog(false);
  };

  const finalizarOrdem = async (fotoUrl, prodSeg, modBlankVal, modDescVal) => {
    if (!o) return;
    updateMaq.mutate({ id: o.id, data: {
      status: "finalizado", foto_finalizacao_url: fotoUrl, tempo_producao_seg: prodSeg,
      inicio_producao_ts: null, data_finalizacao: format(new Date(), "yyyy-MM-dd"),
      modificacao_blank: modBlankVal,
      modificacao_descricao: modBlankVal && modDescVal.trim() ? modDescVal.trim() : null,
    }});
    setOrdemSelecionada(prev => prev ? { ...prev, status: "finalizado", foto_finalizacao_url: fotoUrl, tempo_producao_seg: prodSeg, inicio_producao_ts: null } : prev);

    if (o.ordem_dobra_maquina) {
      try {
        const ordensDobra = await base44.entities.OrdemMaquinaCD.filter({ ordem_corte_id: o.id, status: "aguardando_corte" });
        for (const od of ordensDobra) {
          const obsDobra = modBlankVal && modDescVal.trim() ? `OBD: ${modDescVal.trim()}` : null;
          const updateData = { status: "pendente" };
          if (o.foto_pedido_url) updateData.foto_pedido_url = o.foto_pedido_url;
          if (obsDobra) updateData.observacoes = od.observacoes ? `${od.observacoes}\n${obsDobra}` : obsDobra;
          await base44.entities.OrdemMaquinaCD.update(od.id, updateData);
        }
        if (modBlankVal && modDescVal.trim()) toast.success("OBD repassada para a dobra!");
      } catch {}
    }
  };

  const handleAproveitamentoConfirm = () => setModificacaoDialog(true);

  const confirmarModificacao = async (modBlank, modDesc) => {
    await finalizarOrdem(pendingFotoUrl, pendingProdSeg, modBlank, modDesc);
    setPendingFotoUrl(null);
    setPendingProdSeg(0);
  };

  const handleSucata = (motivo, qtdPerdida) => {
    if (!o) return;
    const hist = JSON.parse(o.historico_pausas || "[]");
    hist.push({ motivo: `SUCATA/PARADA: ${motivo}`, inicio: new Date().toISOString(), fim: new Date().toISOString(), segundos: 0, quantidade_perdida: qtdPerdida });
    const obs = `${o.observacoes || ""}\n⚠️ PARADA/SUCATA: ${motivo}${qtdPerdida > 0 ? ` (${qtdPerdida} pç perdidas)` : ""}`.trim();
    updateMaq.mutate({ id: o.id, data: { observacoes: obs, historico_pausas: JSON.stringify(hist) }});
    setOrdemSelecionada(prev => prev ? { ...prev, observacoes: obs, historico_pausas: JSON.stringify(hist) } : prev);
    toast.success("Parada/sucata registrada no histórico.");
  };

  const handleRegistrarCQ = () => {
    if (!o || !medicao1 || !medicao2 || cqAprovado === null) return;
    const cqText = `CQ: Med1=${medicao1}mm, Med2=${medicao2}mm, Resultado=${cqAprovado ? "APROVADO" : "REPROVADO"}`;
    const obs = `${o.observacoes || ""}\n📋 ${cqText}`.trim();
    updateMaq.mutate({ id: o.id, data: { observacoes: obs }});
    setOrdemSelecionada(prev => prev ? { ...prev, observacoes: obs } : prev);
    toast.success("Inspeção de CQ registrada!");
    setMedicao1("");
    setMedicao2("");
    setCqAprovado(null);
  };

  const handleAmpliarFoto = () => {
    if (!o) return;
    const foto = o.foto_pedido_url || o.foto_material_url || o.foto_finalizacao_url;
    if (foto) setImageViewerOpen(true);
    else toast.info("Esta OP não possui foto.");
  };

  const fotoPrincipalViewer = o?.foto_pedido_url || o?.foto_material_url || o?.foto_finalizacao_url || "";
  const espessuraOrdem = o ? (extractEspessuraFromDesc(o.chapa_descricao) || extractEspessuraFromDesc(o.bobina_descricao)) : null;

  // ─── Guards de acesso ───
  if (user && isOperadorRestrito && maquinasDoUsuario.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><span className="text-3xl">🔧</span></div>
        <h2 className="text-xl font-bold mb-2">Máquina não configurada</h2>
        <p className="text-muted-foreground max-w-sm">Peça ao administrador para configurar a máquina associada ao seu usuário.</p>
      </div>
    );
  }
  if (user && isOperadorRestrito && !maquinasDoUsuario.includes(maquinaId)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><span className="text-3xl">🚫</span></div>
        <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
        <p className="text-muted-foreground max-w-sm">Você só pode acessar as ordens das suas máquinas: <strong>{maquinasDoUsuario.join(", ")}</strong>.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header compacto */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-slate-600" />
            <h1 className="text-base font-bold text-slate-800">{maquinaLabel}</h1>
          </div>
          {/* Navegação semana compacta */}
          <div className="hidden md:flex items-center gap-1 ml-2">
            <button onClick={() => setCurrentWeek(w => subWeeks(w, 1))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-xs font-medium text-slate-500 min-w-[140px] text-center">
              {format(weekStart, "dd/MM", { locale: ptBR })} — {format(weekEnd, "dd/MM", { locale: ptBR })}
            </span>
            <button onClick={() => setCurrentWeek(w => addWeeks(w, 1))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FiltroChapa chapas={[...new Set(ordensSemana.map(o => o.chapa_descricao).filter(Boolean))].sort()} value={filtroChapa} onChange={setFiltroChapa} />
          {isGestor && (
            <Button onClick={() => openNew(selectedDay)} size="sm" className="gap-1">
              <Plus className="w-4 h-4" /> Nova OP
            </Button>
          )}
          <FinalizarExpedienteButton
            maquina={maquinaId} setor="corte_dobra"
            pedidosAtivos={ordensDia.filter(o => o.status === "em_producao" || o.status === "pausado")}
            filialAtiva={filialAtiva} user={user}
            onPausarTodas={async () => {
              const ativas = ordensDia.filter(o => o.status === "em_producao");
              for (const ord of ativas) {
                let prodSeg = ord.tempo_producao_seg || 0;
                if (ord.inicio_producao_ts) {
                  prodSeg += Math.floor((Date.now() - new Date(ord.inicio_producao_ts).getTime()) / 1000);
                }
                await base44.entities.OrdemMaquinaCD.update(ord.id, {
                  status: "pausado", tempo_producao_seg: prodSeg, inicio_producao_ts: null,
                  inicio_pausa_ts: new Date().toISOString(), motivo_pausa: "expediente",
                });
              }
              queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
            }}
          />
        </div>
      </div>

      {/* Cockpit — 3 colunas */}
      <div className="flex-1 flex overflow-hidden">
        {/* PAINEL ESQUERDO — Work List */}
        <div className="w-full md:w-1/4 flex-shrink-0 min-w-0">
          <WorkListPanel
            ordens={listaWorkList}
            ordemSelecionada={ordemSelecionada}
            onSelectOrdem={setOrdemSelecionada}
            buscaPedido={buscaPedido}
            setBuscaPedido={setBuscaPedido}
            viewMode={viewMode}
            setViewMode={setViewMode}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            user={user}
            maquinaLabel={maquinaLabel}
          />
        </div>

        {/* PAINEL CENTRAL — Detalhe da OP + Action Bar */}
        <div className="hidden md:flex flex-col flex-1 min-w-0 border-x border-slate-200">
          <DetalheOPPanel
            ordem={o}
            pedidoSeq={o ? pedidoSeqMap[o.id] : null}
            user={user}
            ordens={ordensDaMaquina}
            isGestor={isGestor}
            onAmpliarFoto={handleAmpliarFoto}
          />
          <ActionBar
            ordem={o}
            onIniciar={handleIniciar}
            onPausar={handlePausar}
            onConcluir={handleConcluir}
            onSucata={() => setSucataDialog(true)}
            onAmpliarFoto={handleAmpliarFoto}
            isGestor={isGestor}
          />
        </div>

        {/* PAINEL DIREITO — Insumos e CQ */}
        <div className="hidden lg:block w-1/4 flex-shrink-0 min-w-0">
          <InsumosCQPanel
            ordem={o}
            medicao1={medicao1} setMedicao1={setMedicao1}
            medicao2={medicao2} setMedicao2={setMedicao2}
            cqAprovado={cqAprovado} setCqAprovado={setCqAprovado}
            onRegistrarCQ={handleRegistrarCQ}
          />
        </div>
      </div>

      {/* Rodapé de status */}
      <StatusFooter user={user} maquinaLabel={maquinaLabel} />

      {/* ─── Diálogos ─── */}
      <PausaDialog open={pausaDialog} onClose={() => setPausaDialog(false)} onConfirm={confirmarPausa} />
      <FinalizarFotoDialog open={fotoDialog} onClose={() => setFotoDialog(false)} onUpload={handleUploadFoto} uploading={uploadingFoto} />
      <ModificacaoBlankDialog open={modificacaoDialog} onClose={() => setModificacaoDialog(false)} onConfirm={confirmarModificacao} />
      <AproveitamentoWrapper open={aproveitamentoDialog} onClose={() => setAproveitamentoDialog(false)} ordem={o} espessura={espessuraOrdem} onConfirm={handleAproveitamentoConfirm} />
      <BloqueioDialog open={bloqueioDialog} onClose={() => { setBloqueioDialog(false); setAcaoPendente(null); setOrdemBloqueante(null); }} ordemBloqueante={ordemBloqueante} isGestor={isGestor} onConfirm={confirmarBloqueio} />
      <PrioridadeDialog open={prioridadeDialog} onClose={() => { setPrioridadeDialog(false); setOrdemPrioritaria(null); }} ordemPrioritaria={ordemPrioritaria} isGestor={isGestor} onConfirm={() => { setPrioridadeDialog(false); setOrdemPrioritaria(null); doIniciar(); }} />
      <SucataDialog open={sucataDialog} onClose={() => setSucataDialog(false)} onConfirm={handleSucata} />

      <ImageViewer url={fotoPrincipalViewer} name={`OP ${o?.numero_pedido || ""}`} open={imageViewerOpen} onClose={() => setImageViewerOpen(false)} />

      <OrdemMaquinaFormDialog
        open={dialog}
        onClose={() => { setDialog(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem && !editItem._presets ? editItem : null}
        defaultDate={editItem?._presets?.data || selectedDay}
        maquina={maquinaId}
      />
      <RetrabalhoDialog
        open={dialogRetrabalho}
        onClose={() => { setDialogRetrabalho(false); setOrdemRetrabalho(null); }}
        ordemOrigem={ordemRetrabalho}
        onCreate={() => queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] })}
      />
      <ChatFloatingButton canal_id={maquinaId} canal_label={maquinaLabel} currentUser={user} />
    </div>
  );
}