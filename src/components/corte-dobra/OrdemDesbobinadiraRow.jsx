import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, Square, CheckCircle2, Timer, Coffee, Circle, AlertCircle, Clock, Camera, Loader2, Trash2, Layers, Image as ImageIcon, ScanLine, ShoppingCart, User, AlertTriangle, Ban } from "lucide-react";
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
import ApontamentoOpButton from "@/components/producao/ApontamentoOpButton";
import { PrioridadeBadge } from "@/lib/prioridadeHelper";
import SmartImage from "@/components/ui/SmartImage";
import { comprimirImagemParaUpload } from "@/lib/compressImage";

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

export default function OrdemDesbobinadiraRow({ ordem: o, onUpdate, onDelete, isGestor, zoom = "normal", ordens = [], pedidoSeq, bobinaCustoMap = {}, user, chapaVinculada, onGerarChapa }) {
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
  const [confirmarExclusaoOpen, setConfirmarExclusaoOpen] = useState(false);
  const [confirmarCancelarOpen, setConfirmarCancelarOpen] = useState(false);

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
    if (user?.permissions?.pular_foto_balanca) {
      // Odoo-style: se tem permissão, ignora a foto e finaliza com peso teórico num clique só
      handleFinalizarComPesoTeorico();
    } else {
      setFotoDialog(true);
    }
  };

  const handleUploadFoto = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    try {
      const fileOtimizado = await comprimirImagemParaUpload(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: fileOtimizado });
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

  const handleFinalizarComPesoTeorico = () => {
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    onUpdate(o.id, {
      status: "finalizado",
      foto_finalizacao_url: tempFotoUrl || null,
      peso_real_balanca_kg: null,
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
    });
    setConfirmarPesoDialog(false);
    setFotoDialog(false);
    toast.success("Ordem finalizada com Peso Teórico estimado!");
  };

  const handleConfirmarFinalizacao = () => {
    const pesoNum = Number(pesoRealLido);
    if (!pesoNum || pesoNum <= 0) {
      toast.error("Por favor, informe o peso real medido na balança ou escolha 'Usar Peso Teórico'.");
      return;
    }
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    onUpdate(o.id, {
      status: "finalizado",
      foto_finalizacao_url: tempFotoUrl || null,
      peso_real_balanca_kg: pesoNum,
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
    });
    setConfirmarPesoDialog(false);
    toast.success("Ordem finalizada e peso real atualizado!");
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
            </div>
            <div className="flex items-center gap-2">
              {o.foto_pedido_url && (
                <SmartImage
                  src={o.foto_pedido_url}
                  alt="Foto do pedido"
                  className="w-10 h-10 border-2 border-blue-400 shrink-0"
                  showBadge
                  badgeText="PED"
                  badgeColor="bg-blue-600"
                />
              )}
              {o.foto_finalizacao_url && (
                <SmartImage
                  src={o.foto_finalizacao_url}
                  alt="Finalização"
                  className="w-10 h-10 border-2 border-green-400 shrink-0"
                  showBadge
                  badgeText="FIN"
                  badgeColor="bg-green-600"
                />
              )}
              {o.foto_etiqueta_bobina_url && (
                <SmartImage
                  src={o.foto_etiqueta_bobina_url}
                  alt="Etiqueta da bobina"
                  className="w-10 h-10 border-2 border-orange-400 shrink-0"
                  showBadge
                  badgeText="ETIQ"
                  badgeColor="bg-orange-600"
                />
              )}
              {o.numero_pedido && <HistoricoPedidoButton numeroPedido={o.numero_pedido} size="sm" />}
              <ApontamentoOpButton ordem={o} ordem_tipo="desbobinadeira" label="Assinar" className="h-6 px-2 text-[10px] gap-1 text-orange-600 border-orange-300 hover:bg-orange-50" />
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
            {(o.numero_pedido || o.cliente) && (
              <div className="inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 my-0.5">
                {o.numero_pedido && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black font-mono bg-blue-600 text-white shadow-xs">
                    <ShoppingCart className="w-3 h-3 shrink-0" />
                    #{o.numero_pedido}
                    {pedidoSeq && <span className="ml-1 text-[10px] opacity-90">({pedidoSeq})</span>}
                  </span>
                )}
                {o.cliente && (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-foreground uppercase tracking-tight">
                    <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    {o.cliente}
                  </span>
                )}
              </div>
            )}
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
              o.destino === "pedido_direto"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-green-50 text-green-700 border-green-200"
            }`}>
              {o.destino === "pedido_direto" ? "📦 Pedido direto" : "🏭 Estoque"}
            </span>
            {o.destino === "estoque" && (
              chapaVinculada ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-mono">
                  📦 {chapaVinculada.codigo} no Estoque
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => onGerarChapa?.(o.id)}
                  className="h-5 px-2 text-[10px] gap-1 bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-400 hover:bg-amber-500/20 font-bold"
                  title="A chapa ainda não foi registrada na Chaparia. Clique para gerar agora."
                >
                  ⚠️ Gerar Chapa no Estoque
                </Button>
              )
            )}
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
              <PrioridadeBadge pedido={o} />
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
            </div>
            {/* Pedido e Cliente em Alto Destaque */}
            {(o.numero_pedido || o.cliente) && (
              <div className="flex flex-wrap items-center gap-2 my-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 shadow-xs">
                {o.numero_pedido && (
                  <div className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs sm:text-sm font-black font-mono bg-blue-600 dark:bg-blue-600 text-white shadow-xs tracking-wider">
                      <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                      #{o.numero_pedido}
                    </span>
                    {pedidoSeq && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-black bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-mono">
                        {pedidoSeq}
                      </span>
                    )}
                  </div>
                )}
                {o.numero_pedido && o.cliente && (
                  <span className="text-blue-300 dark:text-blue-700 font-bold hidden sm:inline">•</span>
                )}
                {o.cliente && (
                  <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{o.cliente}</span>
                  </div>
                )}
                {o.vendedor && (
                  <span className="text-[11px] text-muted-foreground ml-auto hidden sm:inline">
                    Vend: <strong className="text-foreground">{o.vendedor}</strong>
                  </span>
                )}
              </div>
            )}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 ${z.info} text-muted-foreground mt-1`}>
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
              <ApontamentoOpButton ordem={o} ordem_tipo="desbobinadeira" label="Assinar" className="text-orange-600 border-orange-300 hover:bg-orange-50" />
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
          {/* Se a ordem NÃO estiver finalizada e NÃO estiver cancelada: botão Cancelar disponível */}
          {o.status !== "finalizado" && o.status !== "cancelado" && (
            <Button
              size="sm"
              variant="outline"
              className={`${z.btn} text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40`}
              onClick={() => setConfirmarCancelarOpen(true)}
              title="Cancelar esta ordem da desbobinadeira"
            >
              Cancelar
            </Button>
          )}

          {/* Se a ordem ESTÁ cancelada: exibe Reativar e o botão EXCLUIR */}
          {o.status === "cancelado" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-semibold italic mr-1 flex items-center gap-1">
                <Ban className="w-3.5 h-3.5" /> Cancelada
              </span>
              <Button
                size="sm"
                variant="outline"
                className={`gap-1 ${z.btn} text-slate-700 border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
                onClick={() => {
                  onUpdate(o.id, { status: "pendente" });
                  toast.success(`OP #${o.numero_pedido || o.id} reativada para Pendente!`);
                }}
                title="Voltar status para Pendente"
              >
                ↩ Reativar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className={`gap-1 ${z.btn} bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm`}
                onClick={() => setConfirmarExclusaoOpen(true)}
                title="Excluir ordem permanentemente da fábrica"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            </div>
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

      {/* Dialog Finalizar — foto opcional com peso teórico */}
      <Dialog open={fotoDialog} onOpenChange={setFotoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Finalizar Ordem</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-orange-500" />
              <p className="font-semibold text-sm">Tirar foto da balança (Opcional)</p>
              <p className="text-xs text-muted-foreground">Você pode tirar a foto da balança para aferir o peso real ou continuar com o peso teórico estimado.</p>
              <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => handleUploadFoto(e.target.files[0])} />
              <input ref={fotoScanRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleUploadFoto(e.target.files[0])} />
              <UploadButton label="Tirar / Selecionar Foto da Balança" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploadingFoto} size="default" variant="default" />
            </div>

            {o.kg_estimado > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <p className="text-xs font-semibold text-slate-600">Peso Teórico Estimado</p>
                <p className="text-xl font-bold text-slate-800">≈ {o.kg_estimado.toFixed(1)} kg</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setFotoDialog(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={handleFinalizarComPesoTeorico} className="gap-1 border-slate-300">
              Usar Peso Teórico (≈ {(o.kg_estimado || 0).toFixed(1)} kg)
            </Button>
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

      {/* Dialog Confirmar Peso da Balança (Opcional) */}
      <Dialog open={confirmarPesoDialog} onOpenChange={setConfirmarPesoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-slate-800">
              ⚖️ Confirmar Peso da Balança (Opcional)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              Você pode informar o peso real exibido no visor digital ou continuar com o peso teórico estimado:
            </p>
            
            {/* Foto da Balança */}
            {tempFotoUrl && (
              <div className="border border-border rounded-xl overflow-hidden max-h-[220px] bg-slate-950 flex items-center justify-center shadow-inner">
                <img src={tempFotoUrl} alt="Foto da balança" className="max-h-[220px] w-auto object-contain" />
              </div>
            )}

            {/* Input de Peso */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold text-xs">Peso Real Aferido na Balança (KG)</Label>
              <Input 
                type="number" 
                value={pesoRealLido} 
                onChange={e => setPesoRealLido(e.target.value)} 
                className="text-center font-mono font-bold text-xl h-11 border-blue-300 text-blue-900 focus-visible:ring-blue-500" 
                placeholder="Digite o peso..."
                autoFocus
              />
              <p className="text-[10px] text-slate-400 text-center">
                *Opcional: Se deixar em branco ou escolher peso teórico, o sistema calculará o peso automático (≈ {(o.kg_estimado || 0).toFixed(1)} kg).
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmarPesoDialog(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={handleFinalizarComPesoTeorico} className="border-slate-300">
              Usar Peso Teórico (≈ {(o.kg_estimado || 0).toFixed(1)} kg)
            </Button>
            <Button onClick={handleConfirmarFinalizacao} className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Confirmar Peso Real
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação para CANCELAR ordem Desbobinadeira */}
      <Dialog open={confirmarCancelarOpen} onOpenChange={setConfirmarCancelarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              Cancelar Ordem da Desbobinadeira?
            </DialogTitle>
            <DialogDescription>
              A ordem de desbobinamento será marcada como <strong>Cancelada</strong>.
              Após cancelar, o botão de <strong>Excluir Definitivamente</strong> ficará liberado.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted rounded-lg text-xs space-y-1.5 border border-border">
            <p><strong className="text-foreground">OP:</strong> #{o.numero_pedido || o.id}</p>
            <p><strong className="text-foreground">Cliente:</strong> {o.cliente || "—"}</p>
            <p><strong className="text-foreground">Bobina:</strong> {o.bobina_codigo || "—"}</p>
            <p><strong className="text-foreground">Quantidade / Peso:</strong> {o.quantidade || 1} pç ({o.kg_estimado || 0} kg)</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmarCancelarOpen(false)}>
              Voltar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              onClick={() => {
                setConfirmarCancelarOpen(false);
                onUpdate(o.id, { status: "cancelado" });
                toast.warning(`OP #${o.numero_pedido || o.id} cancelada. Botão Excluir liberado.`);
              }}
            >
              Sim, Cancelar Ordem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação para EXCLUIR DEFINITIVAMENTE (Apenas ordens canceladas) */}
      <Dialog open={confirmarExclusaoOpen} onOpenChange={setConfirmarExclusaoOpen}>
        <DialogContent className="sm:max-w-md border-red-200 dark:border-red-900">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2 font-bold">
              <Trash2 className="w-5 h-5 text-red-600 shrink-0" />
              Excluir Ordem Definitivamente?
            </DialogTitle>
            <DialogDescription className="text-red-600/90 font-medium">
              Atenção: Esta ordem cancelada será apagada permanentemente do sistema da fábrica. Esta ação não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg text-xs space-y-1.5 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200">
            <p><strong>OP:</strong> #{o.numero_pedido || o.id}</p>
            <p><strong>Cliente:</strong> {o.cliente || "—"}</p>
            <p><strong>Bobina:</strong> {o.bobina_codigo || "—"}</p>
            <p><strong>Status Atual:</strong> Cancelada</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmarExclusaoOpen(false)}>
              Manter Cancelada
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1 shadow-md"
              onClick={async () => {
                setConfirmarExclusaoOpen(false);
                try {
                  if (typeof onDelete === "function") {
                    await onDelete(o.id);
                  } else {
                    await base44.entities.OrdemDesbobinadeira.delete(o.id);
                    toast.success(`OP #${o.numero_pedido || o.id} excluída com sucesso!`);
                  }
                } catch (err) {
                  console.error("Erro ao excluir OP:", err);
                  toast.error("Erro ao excluir ordem.");
                }
              }}
            >
              <Trash2 className="w-4 h-4" /> Sim, Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}