import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, Square, CheckCircle2, Timer, Coffee, Circle, AlertCircle, Clock, Camera, Loader2, Trash2, Layers, Image as ImageIcon, DollarSign, ScanLine } from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getEtapaColor } from "@/components/corte-dobra/RetrabalhoDialog";
import { HistoricoPedidoButton } from "@/components/corte-dobra/HistoricoPedidoSidebar";
import ImageLink from "@/components/ui/ImageLink";
import CorChapaDot from "@/components/corte-dobra/CorChapaDot";
import ValidacaoEtiquetaDialog from "@/components/corte-dobra/ValidacaoEtiquetaDialog";
import DualPhotoGallery from "@/components/corte-dobra/DualPhotoGallery";
import ChatPedidoButton from "@/components/chat/ChatPedidoButton";

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function StatusBadge({ status }) {
  const cfg = {
    pendente:    { label: "Pendente",     Icon: Circle,       color: "bg-slate-100 text-slate-600 border-slate-200" },
    em_producao: { label: "Produzindo",   Icon: Clock,        color: "bg-amber-100 text-amber-700 border-amber-200" },
    pausado:     { label: "Pausado",      Icon: Pause,        color: "bg-purple-100 text-purple-700 border-purple-200" },
    finalizado:  { label: "Finalizado",   Icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" },
    cancelado:   { label: "Cancelado",    Icon: AlertCircle,  color: "bg-red-100 text-red-700 border-red-200" },
  }[status] || { label: status, Icon: Circle, color: "bg-slate-100 text-slate-600" };
  return (
    <Badge className={`border text-xs ${cfg.color}`}>
      <cfg.Icon className="w-3 h-3 mr-1" />
      {cfg.label}
    </Badge>
  );
}

const ZOOM_CFG = {
  compacto: { card: "p-2.5", title: "text-sm", info: "text-xs", badge: "text-[10px]", cronText: "text-xs", cronLabel: "text-[10px]", cronPad: "px-2 py-1", btn: "h-7 text-xs", obs: "text-[11px] py-1", gap: "gap-1.5", mb: "mb-2" },
  normal:   { card: "p-4",   title: "text-base", info: "text-sm", badge: "text-xs", cronText: "text-sm", cronLabel: "text-xs", cronPad: "px-3 py-2", btn: "h-8 text-xs", obs: "text-xs py-1.5", gap: "gap-2", mb: "mb-3" },
  grande:   { card: "p-5",   title: "text-lg", info: "text-base", badge: "text-sm", cronText: "text-base", cronLabel: "text-sm", cronPad: "px-4 py-2.5", btn: "h-10 text-sm", obs: "text-sm py-2", gap: "gap-2.5", mb: "mb-3" },
};

export default function OrdemDesbobinadiraRow({ ordem: o, onUpdate, onDelete, isGestor, zoom = "normal", ordens = [], pedidoSeq, bobinaCustoMap = {}, user }) {
  const z = ZOOM_CFG[zoom] || ZOOM_CFG.normal;
  const [pauseDialog, setPauseDialog] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState("");
  const [pauseTipo, setPauseTipo] = useState("setup");
  const [fotoDialog, setFotoDialog] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [confirmarPesoDialog, setConfirmarPesoDialog] = useState(false);
  const [pesoRealLido, setPesoRealLido] = useState("");
  const [tempFotoUrl, setTempFotoUrl] = useState("");
  const [tick, setTick] = useState(0);
  const [bloqueioDialog, setBloqueioDialog] = useState(false);
  const [ordemBloqueante, setOrdemBloqueante] = useState(null);
  const [acaoPendente, setAcaoPendente] = useState(null);
  const fotoInputRef = useRef();
  const fotoScanRef = useRef();
  const [validacaoDialog, setValidacaoDialog] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  let tempoProd = o.tempo_producao_seg || 0;
  let tempoPausa = o.tempo_pausa_seg || 0;
  let tempoSetup = o.tempo_setup_seg || 0;

  if (o.status === "em_producao" && o.inicio_producao_ts) {
    tempoProd += Math.floor((now - new Date(o.inicio_producao_ts).getTime()) / 1000);
  }
  if (o.status === "pausado" && o.inicio_pausa_ts) {
    const delta = Math.floor((now - new Date(o.inicio_pausa_ts).getTime()) / 1000);
    if (o.motivo_pausa === "setup") tempoSetup += delta;
    else tempoPausa += delta;
  }

  const verificarBloqueio = (acao) => {
    const ativa = (ordens || []).find(other =>
      other.id !== o.id && (other.status === "em_producao" || other.status === "pausado")
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
    onUpdate(o.id, { status: "em_producao", inicio_producao_ts: new Date().toISOString() });
  };

  const handleIniciar = () => {
    if (verificarBloqueio("iniciar")) return;
    setValidacaoDialog(true);
  };

  const handleEtiquetaAprovada = (fotoUrl, motivo) => {
    setValidacaoDialog(false);
    onUpdate(o.id, {
      status: "em_producao",
      inicio_producao_ts: new Date().toISOString(),
      foto_etiqueta_bobina_url: fotoUrl,
      validacao_etiqueta_status: "aprovado",
      validacao_etiqueta_motivo: motivo || null,
    });
  };

  const confirmarPausa = () => {
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    const motivo = pauseTipo === "setup" ? "setup" : (pauseMotivo.trim() || "pausa");
    onUpdate(o.id, {
      status: "pausado",
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      inicio_pausa_ts: new Date().toISOString(),
      motivo_pausa: motivo,
    });
    setPauseDialog(false);
  };

  const doRetomar = () => {
    let pausaSeg = o.tempo_pausa_seg || 0;
    let setupSeg = o.tempo_setup_seg || 0;
    if (o.inicio_pausa_ts) {
      const delta = Math.floor((Date.now() - new Date(o.inicio_pausa_ts).getTime()) / 1000);
      if (o.motivo_pausa === "setup") setupSeg += delta;
      else pausaSeg += delta;
    }
    const historico = JSON.parse(o.historico_pausas || "[]");
    historico.push({ motivo: o.motivo_pausa, inicio: o.inicio_pausa_ts, fim: new Date().toISOString() });
    onUpdate(o.id, {
      status: "em_producao",
      tempo_pausa_seg: pausaSeg,
      tempo_setup_seg: setupSeg,
      inicio_pausa_ts: null,
      motivo_pausa: null,
      historico_pausas: JSON.stringify(historico),
      inicio_producao_ts: new Date().toISOString(),
    });
  };

  const handleRetomar = () => {
    if (verificarBloqueio("retomar")) return;
    doRetomar();
  };

  const confirmarBloqueio = () => {
    const acao = acaoPendente;
    setBloqueioDialog(false);
    setAcaoPendente(null);
    setOrdemBloqueante(null);
    if (acao === "iniciar") setValidacaoDialog(true);
    else if (acao === "retomar") doRetomar();
  };

  const handleFinalizar = () => {
    setPauseMotivo("");
    setFotoDialog(true);
  };

  const handleUploadFoto = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setTempFotoUrl(file_url);
      setPesoRealLido(Math.round(o.kg_estimado || 0).toString());
      setConfirmarPesoDialog(true);
      setFotoDialog(false);
    } catch (err) {
      toast.error("Erro no upload da foto: " + err.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleConfirmarFinalizacao = () => {
    const pesoNum = Number(pesoRealLido);
    if (!pesoNum || pesoNum <= 0) {
      toast.error("Por favor, informe o peso real medido na balança.");
      return;
    }
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    onUpdate(o.id, {
      status: "finalizado",
      foto_finalizacao_url: tempFotoUrl,
      peso_real_balanca_kg: pesoNum,
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
    });
    setConfirmarPesoDialog(false);
    toast.success("Ordem finalizada e estoque atualizado!");
  };

  const showCronometro = o.status === "em_producao" || o.status === "pausado" || tempoProd > 0;
  const isFinalizado = o.status === "finalizado";

  if (isFinalizado) {
    const etpCorFin = o.is_retrabalho ? getEtapaColor(o.retrabalho_etapa) : null;
    return (
      <>
        <div className={`border-l-4 ${etpCorFin ? etpCorFin.border : "border-l-green-400"} ${etpCorFin ? etpCorFin.bg : "bg-green-50/60"} rounded-lg p-2.5 shadow-sm hover:shadow-md transition-all`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {o.is_retrabalho && (
                <Badge className={`${etpCorFin?.badge} text-white border-red-600 text-[10px]`}>
                  <AlertCircle className="w-3 h-3 mr-0.5" /> RETRABALHO{o.retrabalho_etapa > 1 ? ` E${o.retrabalho_etapa}` : ""}
                </Badge>
              )}
              <span className={`font-bold text-sm font-mono ${etpCorFin ? etpCorFin.text : "text-green-700"}`}>{o.bobina_descricao || "Bobina"}</span>
              {o.espessura_utilizada && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <CorChapaDot espessura={o.espessura_utilizada} size="xs" />
                  <Layers className="w-2.5 h-2.5" /> {o.espessura_utilizada}mm
                </span>
              )}
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Finalizado
              </Badge>
              {o.quantidade > 0 && <span className="text-xs font-semibold text-foreground">{o.quantidade} pç</span>}
              {o.comprimento_mm > 0 && <span className="text-xs text-muted-foreground">{o.comprimento_mm}mm</span>}
              {o.kg_estimado > 0 && <span className="text-xs font-semibold text-emerald-700">≈ {o.kg_estimado.toFixed(1)} kg</span>}
              {o.peso_real_balanca_kg > 0 && (
                <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  ⚖️ Balança: {o.peso_real_balanca_kg.toLocaleString("pt-BR")} kg
                </span>
              )}
              {isGestor && o.kg_estimado > 0 && bobinaCustoMap[o.bobina_id] && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-green-700">
                  <DollarSign className="w-2.5 h-2.5" />
                  {(o.kg_estimado * bobinaCustoMap[o.bobina_id]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {o.foto_pedido_url && (
                <ImageLink url={o.foto_pedido_url} name="Foto do Pedido" className="flex-shrink-0 block">
                  <div className="relative">
                    <img src={o.foto_pedido_url} alt="Foto do pedido" className="w-10 h-10 object-cover rounded border-2 border-blue-400" />
                    <span className="absolute -top-1 -left-1 bg-blue-600 text-white text-[8px] font-bold px-1 rounded-full leading-tight">PED</span>
                  </div>
                </ImageLink>
              )}
              {o.foto_finalizacao_url && (
                <ImageLink url={o.foto_finalizacao_url} name="Foto de Finalização" className="flex-shrink-0 block">
                  <div className="relative">
                    <img src={o.foto_finalizacao_url} alt="Finalização" className="w-10 h-10 object-cover rounded border-2 border-green-400" />
                    <span className="absolute -top-1 -left-1 bg-green-600 text-white text-[8px] font-bold px-1 rounded-full leading-tight">FIN</span>
                  </div>
                </ImageLink>
              )}
              {o.foto_etiqueta_bobina_url && (
                <ImageLink url={o.foto_etiqueta_bobina_url} name="Etiqueta da Bobina" className="flex-shrink-0 block">
                  <div className="relative">
                    <img src={o.foto_etiqueta_bobina_url} alt="Etiqueta da bobina" className="w-10 h-10 object-cover rounded border-2 border-orange-400" />
                    <span className="absolute -top-1 -left-1 bg-orange-600 text-white text-[8px] font-bold px-1 rounded-full leading-tight">ETIQ</span>
                  </div>
                </ImageLink>
              )}
              {o.numero_pedido && <HistoricoPedidoButton numeroPedido={o.numero_pedido} size="sm" />}
              <ChatPedidoButton canal_id={o.id} canal_label={`OP DESB ${o.numero_pedido || o.id.slice(-6).toUpperCase()}`} currentUser={user} />
              {isGestor && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={() => onUpdate(o.id, { status: "pendente", inicio_producao_ts: null, foto_finalizacao_url: null, data_finalizacao: null })}>
                    ↩ Reabrir
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => { if (window.confirm("Excluir esta ordem? Esta ação não pode ser desfeita.")) onDelete(o.id); }}>
                    <Trash2 className="w-2.5 h-2.5" /> Excluir
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
            {o.numero_pedido && (
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground/70">Pedido:</span>
                <span className="font-semibold text-foreground font-mono">{o.numero_pedido}</span>
                {pedidoSeq && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">{pedidoSeq}</span>
                )}
              </span>
            )}
            {o.cliente && (
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground/70">Cliente:</span>
                <span className="font-semibold text-foreground">{o.cliente}</span>
              </span>
            )}
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
              o.destino === "pedido_direto"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-green-50 text-green-700 border-green-200"
            }`}>
              {o.destino === "pedido_direto" ? "📦 Pedido direto" : "🏭 Estoque"}
            </span>
            {o.guilhotina && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-50 text-orange-700 border-orange-200">
                🔪 {o.guilhotina}{o.tamanho_corte_guilhotina ? ` — ${o.tamanho_corte_guilhotina}mm` : ""}
              </span>
            )}
            {o.data_finalizacao && (
              <span className="text-green-600 font-semibold">✓ {format(new Date(o.data_finalizacao + "T12:00:00"), "dd/MM", { locale: ptBR })}</span>
            )}
          </div>
          {o.observacoes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5 text-[11px] text-yellow-800 mt-1">
              📋 {o.observacoes}
            </div>
          )}
        </div>

        {/* Dialog Bloqueio — OP em andamento (mantém para consistência) */}
        <Dialog open={bloqueioDialog} onOpenChange={setBloqueioDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>⚠️ OP em Andamento</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Já existe uma OP em andamento nesta máquina:</p>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <p className="font-semibold text-amber-900">{ordemBloqueante?.bobina_descricao || "OP"}</p>
                {ordemBloqueante?.numero_pedido && <p className="text-xs text-amber-700">Pedido: {ordemBloqueante.numero_pedido}</p>}
                {ordemBloqueante?.cliente && <p className="text-xs text-amber-700">Cliente: {ordemBloqueante.cliente}</p>}
                <p className="text-xs text-amber-700 mt-1">Status: {ordemBloqueante?.status === "em_producao" ? "Em produção" : "Pausado"}</p>
              </div>
              <p className="text-xs text-muted-foreground">Iniciar outra OP simultaneamente pode causar problemas de controle. Deseja continuar mesmo assim?</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setBloqueioDialog(false); setAcaoPendente(null); setOrdemBloqueante(null); }}>Cancelar</Button>
              <Button className="bg-amber-500 hover:bg-amber-600" onClick={confirmarBloqueio}>Iniciar mesmo assim</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const retrabalho = o.is_retrabalho;
  const etpCor = retrabalho ? getEtapaColor(o.retrabalho_etapa) : null;

  return (
    <>
      <div className={`border-l-4 ${etpCor ? etpCor.border : "border-l-orange-400"} ${etpCor ? etpCor.bg : "bg-white"} rounded-xl ${z.card} shadow-sm hover:shadow-md transition-shadow`}>
        {/* Header */}
        <div className={`flex items-start justify-between ${z.gap} ${z.mb}`}>
          <div className="flex-1 min-w-0">
            <div className={`flex items-center ${z.gap} flex-wrap mb-1`}>
              {retrabalho && (
                <Badge className={`${etpCor?.badge} text-white border-red-600 animate-pulse text-xs`}>
                  <AlertCircle className="w-3 h-3 mr-0.5" /> RETRABALHO{o.retrabalho_etapa > 1 ? ` E${o.retrabalho_etapa}` : ""}
                </Badge>
              )}
              <span className={`font-bold ${z.title} font-mono ${etpCor ? etpCor.text : "text-orange-600"}`}>{o.bobina_descricao || "Bobina"}</span>
              {o.espessura_utilizada && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <CorChapaDot espessura={o.espessura_utilizada} size="xs" />
                  <Layers className="w-3 h-3" /> {o.espessura_utilizada}mm
                </span>
              )}
              <StatusBadge status={o.status} />
              {o.data < format(new Date(), "yyyy-MM-dd") && o.status !== "finalizado" && o.status !== "cancelado" && (
                <Badge className="bg-red-500 text-white border-red-600 animate-pulse text-xs">⚠️ Prioridade (Dia Anterior)</Badge>
              )}
            </div>
            <div className={`flex flex-wrap gap-x-4 gap-y-0.5 ${z.info} text-muted-foreground`}>
              {o.quantidade > 0 && <span className="font-semibold text-foreground">{o.quantidade} peças</span>}
              {o.comprimento_mm > 0 && <span>{o.comprimento_mm}mm de corte</span>}
              {o.kg_estimado > 0 && (
                <span className="font-semibold text-emerald-700">≈ {o.kg_estimado.toFixed(1)} kg</span>
              )}
              {isGestor && o.kg_estimado > 0 && bobinaCustoMap[o.bobina_id] && (
                <span className="inline-flex items-center gap-0.5 font-bold text-green-700">
                  <DollarSign className="w-3 h-3" />
                  {(o.kg_estimado * bobinaCustoMap[o.bobina_id]).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 ${z.info} text-muted-foreground mt-1`}>
              {o.numero_pedido && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-muted-foreground/70">Pedido:</span>
                  <span className="font-semibold text-foreground font-mono">{o.numero_pedido}</span>
                  {pedidoSeq && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">{pedidoSeq}</span>
                  )}
                </span>
              )}
              {o.cliente && (
                <span className="inline-flex items-center gap-1">
                  <span className="text-muted-foreground/70">Cliente:</span>
                  <span className="font-semibold text-foreground">{o.cliente}</span>
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                o.destino === "pedido_direto"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-green-50 text-green-700 border-green-200"
              }`}>
                {o.destino === "pedido_direto" ? "📦 Pedido direto" : "🏭 Estoque"}
              </span>
              {o.guilhotina && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border bg-orange-50 text-orange-700 border-orange-200">
                  🔪 {o.guilhotina}{o.tamanho_corte_guilhotina ? ` — ${o.tamanho_corte_guilhotina}mm` : ""}
                </span>
              )}
              {o.numero_pedido && <HistoricoPedidoButton numeroPedido={o.numero_pedido} />}
              <ChatPedidoButton canal_id={o.id} canal_label={`OP DESB ${o.numero_pedido || o.id.slice(-6).toUpperCase()}`} currentUser={user} />
              </div>
              </div>
              </div>

        {/* Fotos: Pedido + Etiqueta da Bobina + Finalização */}
        {(o.foto_pedido_url || o.foto_etiqueta_bobina_url || o.foto_finalizacao_url) && (
          <DualPhotoGallery
            fotoPedidoUrl={o.foto_pedido_url}
            fotoMaterialUrl={o.foto_etiqueta_bobina_url}
            fotoFinalizacaoUrl={o.foto_finalizacao_url}
            labelMaterial="Etiqueta da Bobina"
            z={zoom}
          />
        )}

        {/* Observações */}
        {o.observacoes && (
          <div className={`bg-yellow-50 border border-yellow-200 rounded-lg px-3 ${z.obs} text-yellow-800 ${z.mb}`}>
            📋 {o.observacoes}
          </div>
        )}

        {/* Pausa ativa */}
        {o.status === "pausado" && o.motivo_pausa && (
          <div className={`bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 ${z.obs} text-amber-800 ${z.mb} flex items-center gap-2`}>
            <Pause className="w-3 h-3 flex-shrink-0" />
            <span>{o.motivo_pausa === "setup" ? "⚙️ Pausa para Setup de Máquina" : `⏸ Pausa: ${o.motivo_pausa}`}</span>
          </div>
        )}

        {/* Cronômetros */}
        {showCronometro && (
          <div className={`grid grid-cols-3 ${z.gap} ${z.mb}`}>
            <div className={`rounded-lg ${z.cronPad} text-center ${o.status === "em_producao" ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Timer className="w-3 h-3 text-green-600" />
                <span className={`${z.cronLabel} text-muted-foreground`}>Produção</span>
              </div>
              <p className={`${z.cronText} font-bold tabular-nums ${o.status === "em_producao" ? "text-green-700" : "text-slate-600"}`}>
                {formatTempo(tempoProd)}
              </p>
            </div>
            <div className={`rounded-lg ${z.cronPad} text-center ${o.status === "pausado" && o.motivo_pausa !== "setup" ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Coffee className="w-3 h-3 text-amber-600" />
                <span className={`${z.cronLabel} text-muted-foreground`}>Pausa</span>
              </div>
              <p className={`${z.cronText} font-bold tabular-nums ${o.status === "pausado" && o.motivo_pausa !== "setup" ? "text-amber-700" : "text-slate-600"}`}>
                {formatTempo(tempoPausa)}
              </p>
            </div>
            <div className={`rounded-lg ${z.cronPad} text-center ${o.status === "pausado" && o.motivo_pausa === "setup" ? "bg-purple-50 border border-purple-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Square className="w-3 h-3 text-purple-600" />
                <span className={`${z.cronLabel} text-muted-foreground`}>Setup</span>
              </div>
              <p className={`${z.cronText} font-bold tabular-nums ${o.status === "pausado" && o.motivo_pausa === "setup" ? "text-purple-700" : "text-slate-600"}`}>
                {formatTempo(tempoSetup)}
              </p>
            </div>
          </div>
        )}



        {/* Ações */}
        <div className={`flex items-center justify-end ${z.gap} mt-3`}>
          {o.status === "pendente" && (
            <Button size="sm" className={`gap-1 ${z.btn} bg-amber-500 hover:bg-amber-600 text-white border-0`} onClick={handleIniciar}>
              <Play className="w-3 h-3" /> Iniciar
            </Button>
          )}
          {o.status === "em_producao" && (
            <>
              <Button size="sm" variant="outline" className={`gap-1 ${z.btn} border-amber-300 text-amber-700 hover:bg-amber-50`} onClick={() => { setPauseTipo("setup"); setPauseMotivo(""); setPauseDialog(true); }}>
                <Pause className="w-3 h-3" /> Pausar
              </Button>
              <Button size="sm" className={`gap-1 ${z.btn} bg-green-600 hover:bg-green-700 text-white border-0`} onClick={handleFinalizar}>
                <CheckCircle2 className="w-3 h-3" /> Finalizar
              </Button>
            </>
          )}
          {o.status === "pausado" && (
            <Button size="sm" className={`gap-1 ${z.btn} bg-primary hover:bg-primary/90 text-white border-0`} onClick={handleRetomar}>
              <Play className="w-3 h-3" /> Retomar
            </Button>
          )}
          {o.status === "finalizado" && isGestor && (
            <Button size="sm" variant="outline" className={`gap-1 ${z.btn} text-amber-600 border-amber-300 hover:bg-amber-50`}
              onClick={() => onUpdate(o.id, { status: "pendente", inicio_producao_ts: null, foto_finalizacao_url: null, data_finalizacao: null })}>
              ↩ Reabrir
            </Button>
          )}
          {o.status === "finalizado" && !isGestor && (
            <span className={`${z.obs} text-muted-foreground italic`}>Finalizado — bloqueado</span>
          )}
          {isGestor && (
            <Button size="sm" variant="outline" className={`gap-1 ${z.btn} text-red-600 border-red-300 hover:bg-red-50`}
              onClick={() => { if (window.confirm("Excluir esta ordem? Esta ação não pode ser desfeita.")) onDelete(o.id); }}>
              <Trash2 className="w-3 h-3" /> Excluir
            </Button>
          )}
        </div>
      </div>

      {/* Dialog Pausa */}
      <Dialog open={pauseDialog} onOpenChange={setPauseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Pausar Ordem</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Qual o motivo da pausa?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPauseTipo("setup")}
                className={`border-2 rounded-xl p-4 text-center transition-all ${pauseTipo === "setup" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Square className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <p className="font-semibold text-sm">Setup de Máquina</p>
                <p className="text-xs text-muted-foreground mt-1">Ajuste, troca de bobina, etc.</p>
              </button>
              <button onClick={() => setPauseTipo("outro")}
                className={`border-2 rounded-xl p-4 text-center transition-all ${pauseTipo === "outro" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Coffee className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                <p className="font-semibold text-sm">Outro Motivo</p>
                <p className="text-xs text-muted-foreground mt-1">Especifique abaixo</p>
              </button>
            </div>
            {pauseTipo === "outro" && (
              <Textarea placeholder="Descreva o motivo da pausa..." value={pauseMotivo} onChange={e => setPauseMotivo(e.target.value)} className="h-20" autoFocus />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialog(false)}>Cancelar</Button>
            <Button onClick={confirmarPausa} disabled={pauseTipo === "outro" && !pauseMotivo.trim()} className="gap-1">
              <Pause className="w-4 h-4" /> Confirmar Pausa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Finalizar — foto obrigatória */}
      <Dialog open={fotoDialog} onOpenChange={setFotoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Finalizar — Foto Obrigatória</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-orange-500" />
              <p className="font-semibold text-sm">Tire uma foto do material cortado</p>
              <p className="text-xs text-muted-foreground">A foto é obrigatória para registrar a conclusão da ordem</p>
              <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => handleUploadFoto(e.target.files[0])} />
              <input ref={fotoScanRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleUploadFoto(e.target.files[0])} />
              <UploadButton label="Tirar / Selecionar Foto" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploadingFoto} size="default" variant="default" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFotoDialog(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Bloqueio — OP em andamento */}
      <Dialog open={bloqueioDialog} onOpenChange={setBloqueioDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>⚠️ OP em Andamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Já existe uma OP em andamento nesta máquina:</p>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
              <p className="font-semibold text-amber-900">{ordemBloqueante?.bobina_descricao || "OP"}</p>
              {ordemBloqueante?.numero_pedido && <p className="text-xs text-amber-700">Pedido: {ordemBloqueante.numero_pedido}</p>}
              {ordemBloqueante?.cliente && <p className="text-xs text-amber-700">Cliente: {ordemBloqueante.cliente}</p>}
              <p className="text-xs text-amber-700 mt-1">Status: {ordemBloqueante?.status === "em_producao" ? "Em produção" : "Pausado"}</p>
            </div>
            <p className="text-xs text-muted-foreground">Iniciar outra OP simultaneamente pode causar problemas de controle. Deseja continuar mesmo assim?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBloqueioDialog(false); setAcaoPendente(null); setOrdemBloqueante(null); }}>Cancelar</Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={confirmarBloqueio}>Iniciar mesmo assim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog Validação de Etiqueta da Bobina */}
      <ValidacaoEtiquetaDialog
        open={validacaoDialog}
        onClose={() => setValidacaoDialog(false)}
        ordem={o}
        onAprovado={handleEtiquetaAprovada}
      />

      {/* Dialog Confirmar Peso da Balança */}
      <Dialog open={confirmarPesoDialog} onOpenChange={setConfirmarPesoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-slate-800">
              ⚖️ Confirmar Peso da Balança
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              Verifique a foto da balança e informe o peso exato (KG) exibido no visor digital:
            </p>
            
            {/* Foto da Balança */}
            {tempFotoUrl && (
              <div className="border border-border rounded-xl overflow-hidden max-h-[240px] bg-slate-950 flex items-center justify-center shadow-inner">
                <img src={tempFotoUrl} alt="Foto da balança" className="max-h-[240px] w-auto object-contain" />
              </div>
            )}

            {/* Input de Peso */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold text-xs">Peso Real Aferido (KG)</Label>
              <Input 
                type="number" 
                value={pesoRealLido} 
                onChange={e => setPesoRealLido(e.target.value)} 
                className="text-center font-mono font-bold text-xl h-11 border-blue-300 text-blue-900 focus-visible:ring-blue-500" 
                placeholder="Digite o peso da balança..."
                autoFocus
              />
              <p className="text-[10px] text-slate-400 text-center">
                *O estoque da chapa gerada e o saldo da bobina serão atualizados com este peso real.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmarPesoDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarFinalizacao} className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Confirmar e Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}