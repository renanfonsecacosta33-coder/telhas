import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Play, Pause, CheckCircle2, Timer, Coffee, Square, Circle,
  AlertCircle, Clock, Camera, Loader2, Layers, Package, ShoppingCart, Trash2, Image as ImageIcon,
  Edit3, History, Star
} from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getEtapaColor } from "@/components/corte-dobra/RetrabalhoDialog";
import { HistoricoPedidoButton } from "@/components/corte-dobra/HistoricoPedidoSidebar";
import ImageLink from "@/components/ui/ImageLink";
import DualPhotoGallery from "@/components/corte-dobra/DualPhotoGallery";

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
    pendente:          { label: "Pendente",          Icon: Circle,       color: "bg-slate-100 text-slate-600 border-slate-200" },
    aguardando_corte:  { label: "Aguard. Corte",     Icon: Clock,        color: "bg-orange-100 text-orange-700 border-orange-200" },
    em_producao:       { label: "Produzindo",        Icon: Clock,        color: "bg-amber-100 text-amber-700 border-amber-200" },
    pausado:           { label: "Pausado",           Icon: Pause,        color: "bg-purple-100 text-purple-700 border-purple-200" },
    finalizado:        { label: "Finalizado",        Icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" },
    cancelado:         { label: "Cancelado",         Icon: AlertCircle,  color: "bg-red-100 text-red-700 border-red-200" },
  }[status] || { label: status, Icon: Circle, color: "bg-slate-100 text-slate-600" };
  return (
    <Badge className={`border text-xs ${cfg.color}`}>
      <cfg.Icon className="w-3 h-3 mr-1" />
      {cfg.label}
    </Badge>
  );
}

// Cor da borda esquerda por máquina
const MAQUINA_BORDER = {
  "CORTE 3M":        "border-l-purple-400",
  "DOBRA 3M":        "border-l-blue-400",
  "CORTE 6M":        "border-l-indigo-400",
  "DOBRA FUNDO 6M":  "border-l-teal-400",
  "DOBRA INICIO 6M": "border-l-cyan-400",
  "PERFILADEIRA":    "border-l-green-400",
};

const ZOOM_CFG = {
  compacto: { card: "p-2.5", title: "text-sm", info: "text-xs", badge: "text-[10px]", cronText: "text-xs", cronLabel: "text-[10px]", cronPad: "px-2 py-1", btn: "h-7 text-xs", obs: "text-[11px] py-1", gap: "gap-1.5", mb: "mb-2" },
  normal:   { card: "p-4",   title: "text-base", info: "text-xs", badge: "text-xs", cronText: "text-sm", cronLabel: "text-xs", cronPad: "px-3 py-2", btn: "h-8 text-xs", obs: "text-xs py-1.5", gap: "gap-2", mb: "mb-3" },
  grande:   { card: "p-5",   title: "text-lg", info: "text-sm", badge: "text-sm", cronText: "text-base", cronLabel: "text-sm", cronPad: "px-4 py-2.5", btn: "h-10 text-sm", obs: "text-sm py-2", gap: "gap-2.5", mb: "mb-3" },
};

export default function OrdemMaquinaRow({ ordem: o, onUpdate, onDelete, isGestor, zoom = "normal", ordens = [], pedidoSeq }) {
  const z = ZOOM_CFG[zoom] || ZOOM_CFG.normal;
  const [pauseDialog, setPauseDialog] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState("");
  const [pauseTipo, setPauseTipo] = useState("setup");
  const [fotoDialog, setFotoDialog] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [tick, setTick] = useState(0);
  const [bloqueioDialog, setBloqueioDialog] = useState(false);
  const [ordemBloqueante, setOrdemBloqueante] = useState(null);
  const [acaoPendente, setAcaoPendente] = useState(null);
  const [prioridadeDialog, setPrioridadeDialog] = useState(false);
  const [ordemPrioritaria, setOrdemPrioritaria] = useState(null);
  const [modificacaoDialog, setModificacaoDialog] = useState(false);
  const [modBlank, setModBlank] = useState(false);
  const [modDescricao, setModDescricao] = useState("");
  const [pendingFotoUrl, setPendingFotoUrl] = useState(null);
  const [pendingProdSeg, setPendingProdSeg] = useState(0);
  const fotoInputRef = useRef();
  const fotoScanRef = useRef();

  const isGuilhotina = o.maquina === "CORTE 3M" || o.maquina === "CORTE 6M";

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
      other.id !== o.id &&
      other.maquina === o.maquina &&
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
    onUpdate(o.id, { status: "em_producao", inicio_producao_ts: new Date().toISOString() });
  };

  const handleIniciar = () => {
    if (verificarBloqueio("iniciar")) return;
    // Se não é prioritária e existe uma prioritária pendente na mesma máquina, bloquear
    if (!o.prioridade) {
      const pri = (ordens || []).find(other =>
        other.id !== o.id &&
        other.maquina === o.maquina &&
        other.prioridade === true &&
        other.status !== "finalizado" &&
        other.status !== "cancelado"
      );
      if (pri) {
        setOrdemPrioritaria(pri);
        setPrioridadeDialog(true);
        return;
      }
    }
    doIniciar();
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
    setPauseMotivo("");
  };

  const doRetomar = () => {
    let pausaSeg = o.tempo_pausa_seg || 0;
    let setupSeg = o.tempo_setup_seg || 0;
    let deltaSeg = 0;
    if (o.inicio_pausa_ts) {
      deltaSeg = Math.floor((Date.now() - new Date(o.inicio_pausa_ts).getTime()) / 1000);
      if (o.motivo_pausa === "setup") setupSeg += deltaSeg;
      else pausaSeg += deltaSeg;
    }
    const historico = JSON.parse(o.historico_pausas || "[]");
    historico.push({ motivo: o.motivo_pausa, inicio: o.inicio_pausa_ts, fim: new Date().toISOString(), segundos: deltaSeg });
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
    setBloqueioDialog(false);
    if (acaoPendente === "iniciar") doIniciar();
    else if (acaoPendente === "retomar") doRetomar();
    setAcaoPendente(null);
    setOrdemBloqueante(null);
  };

  const handleFinalizar = () => {
    setPauseMotivo("");
    setFotoDialog(true);
  };

  const handleUploadFoto = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    // Baixa automática de chapa da chaparia
    if (o.chapa_cd_id && (o.quantidade || 0) > 0) {
      try {
        const chapa = await base44.entities.ChapaCD.get(o.chapa_cd_id);
        if (chapa) {
          const novaQtd = Math.max(0, (chapa.quantidade_disponivel || 0) - o.quantidade);
          await base44.entities.ChapaCD.update(o.chapa_cd_id, {
            quantidade_disponivel: novaQtd,
            status: novaQtd === 0 ? "consumido" : chapa.status,
          });
        }
      } catch (e) { /* silencioso */ }
    }

    // Desconto de bobina direta
    if (o.chapa_origem === "direto" && o.bobina_id && (o.peso_kg || 0) > 0) {
      try {
        const bobina = await base44.entities.Bobina.get(o.bobina_id);
        if (bobina) {
          await base44.entities.Bobina.update(o.bobina_id, {
            peso_kg: Math.max(0, (bobina.peso_kg || 0) - o.peso_kg),
          });
        }
      } catch (e) { /* silencioso */ }
    }

    // Se for guilhotina, pedir info de modificação de blank antes de finalizar
    if (isGuilhotina) {
      setPendingFotoUrl(file_url);
      setPendingProdSeg(prodSeg);
      setModBlank(false);
      setModDescricao("");
      setUploadingFoto(false);
      setFotoDialog(false);
      setModificacaoDialog(true);
      return;
    }

    await finalizarOrdem(file_url, prodSeg, false, "");
    setUploadingFoto(false);
    setFotoDialog(false);
  };

  const finalizarOrdem = async (fotoUrl, prodSeg, modBlankVal, modDescVal) => {
    onUpdate(o.id, {
      status: "finalizado",
      foto_finalizacao_url: fotoUrl,
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
      modificacao_blank: modBlankVal,
      modificacao_descricao: modBlankVal && modDescVal.trim() ? modDescVal.trim() : null,
    });
    // Se for ordem de corte com dobra vinculada, desbloquear a dobra e repassar OBD
    if (o.ordem_dobra_maquina) {
      try {
        const ordensDobra = await base44.entities.OrdemMaquinaCD.filter({ ordem_corte_id: o.id, status: "aguardando_corte" });
        for (const od of ordensDobra) {
          const obsDobra = modBlankVal && modDescVal.trim()
            ? `OBD: ${modDescVal.trim()}`
            : null;
          const updateData = { status: "pendente" };
          if (obsDobra) {
            updateData.observacoes = od.observacoes
              ? `${od.observacoes}\n${obsDobra}`
              : obsDobra;
          }
          await base44.entities.OrdemMaquinaCD.update(od.id, updateData);
        }
        if (modBlankVal && modDescVal.trim()) {
          toast.success("OBD repassada para a dobra!");
        }
      } catch (e) { /* silencioso */ }
    }
  };

  const confirmarModificacao = async () => {
    setModificacaoDialog(false);
    await finalizarOrdem(pendingFotoUrl, pendingProdSeg, modBlank, modDescricao);
    setPendingFotoUrl(null);
    setPendingProdSeg(0);
    setModBlank(false);
    setModDescricao("");
  };

  const showCronometro = o.status === "em_producao" || o.status === "pausado" || tempoProd > 0;
  const borderColor = MAQUINA_BORDER[o.maquina] || "border-l-gray-400";
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
              <span className="font-bold text-sm">{o.tipo_peca || "—"}</span>
              {o.dimensoes_livres && (
                <span className="text-[11px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{o.dimensoes_livres}</span>
              )}
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Finalizado
              </Badge>
              {o.quantidade > 0 && <span className="text-xs font-semibold text-foreground">{o.quantidade} pç</span>}
              {o.peso_kg > 0 && <span className="text-xs font-semibold text-emerald-700">≈ {o.peso_kg.toFixed(1)} kg</span>}
              {o.modificacao_blank && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                  <Edit3 className="w-2.5 h-2.5 mr-0.5" /> Blank modificado
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {o.numero_pedido && <HistoricoPedidoButton numeroPedido={o.numero_pedido} size="sm" />}
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
            <span className="inline-flex items-center gap-0.5">
              {o.chapa_origem === "chaparia" ? <Layers className="w-2.5 h-2.5 text-orange-500" /> : <Package className="w-2.5 h-2.5 text-blue-500" />}
              <span className="font-mono">{o.chapa_origem === "chaparia" ? (o.chapa_descricao || "Chapa") : (o.bobina_descricao || o.chapa_descricao || "Bobina")}</span>
            </span>
            {o.numero_pedido && (
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground/70">Pedido:</span>
                <span className="font-semibold text-foreground font-mono">{o.numero_pedido}</span>
                {pedidoSeq && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">{pedidoSeq}</span>
                )}
              </span>
            )}
            {o.cliente && (
              <span className="inline-flex items-center gap-1">
                <span className="text-muted-foreground/70">Cliente:</span>
                <span className="font-semibold text-foreground">{o.cliente}</span>
              </span>
            )}
            {o.data_finalizacao && (
              <span className="text-green-600 font-semibold">✓ {format(new Date(o.data_finalizacao + "T12:00:00"), "dd/MM")}</span>
            )}
          </div>
        </div>

        {/* Fotos: Pedido (encarregado) + Finalização (operador) */}
        {(o.foto_pedido_url || o.foto_finalizacao_url) && (
          <DualPhotoGallery fotoPedidoUrl={o.foto_pedido_url} fotoFinalizacaoUrl={o.foto_finalizacao_url} z={zoom} />
        )}

        {/* Observações (finalizado) */}
        {o.observacoes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 text-yellow-800 text-xs whitespace-pre-line mb-2">
            📋 {o.observacoes}
          </div>
        )}

        {/* Dialog Bloqueio — OP em andamento (mantém para consistência) */}
        <Dialog open={bloqueioDialog} onOpenChange={setBloqueioDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>⚠️ OP em Andamento</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Já existe uma OP em andamento nesta máquina:</p>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <p className="font-semibold text-amber-900">{ordemBloqueante?.tipo_peca || ordemBloqueante?.chapa_descricao || "OP"}</p>
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
  const borderColorRet = etpCor ? etpCor.border : borderColor;
  const bgRet = etpCor ? etpCor.bg : "bg-white";

  return (
    <>
      <div className={`border-l-4 ${borderColorRet} ${bgRet} rounded-xl ${z.card} shadow-sm hover:shadow-md transition-shadow`}>
        {/* Header */}
        <div className={`flex items-start justify-between ${z.gap} ${z.mb}`}>
          <div className="flex-1 min-w-0">
            <div className={`flex items-center ${z.gap} flex-wrap mb-1`}>
              {retrabalho && (
                <Badge className={`${etpCor?.badge} text-white border-red-600 animate-pulse text-xs`}>
                  <AlertCircle className="w-3 h-3 mr-0.5" /> RETRABALHO{o.retrabalho_etapa > 1 ? ` E${o.retrabalho_etapa}` : ""}
                </Badge>
              )}
              <span className={`font-bold ${z.title}`}>{o.tipo_peca || "—"}</span>
              {o.dimensoes_livres && (
                <span className={`${z.info} text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded`}>{o.dimensoes_livres}</span>
              )}
              <StatusBadge status={o.status} />
              {o.prioridade && (
                <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-xs">
                  <Star className="w-3 h-3 mr-0.5 fill-white" /> PRIORIDADE
                </Badge>
              )}
              {o.data < format(new Date(), "yyyy-MM-dd") && o.status !== "finalizado" && o.status !== "cancelado" && (
                <Badge className="bg-red-500 text-white border-red-600 animate-pulse text-xs">⚠️ Prioridade (Dia Anterior)</Badge>
              )}
            </div>

            {/* Material */}
            <div className={`flex items-center ${z.gap} ${z.info} text-muted-foreground flex-wrap mb-1`}>
              {o.chapa_origem === "chaparia" ? (
                <><Layers className="w-3 h-3 text-orange-500" /><span className="font-mono">{o.chapa_descricao || "Chapa do estoque"}</span></>
              ) : (
                <><Package className="w-3 h-3 text-blue-500" /><span className="font-mono">{o.bobina_descricao || o.chapa_descricao || "Bobina direta"}</span></>
              )}
            </div>

            {/* Desenvolvimento */}
            {o.desenvolvimento_descricao && (
              <div className={`flex items-center gap-1 ${z.info} text-emerald-700 mb-1`}>
                <span className="text-emerald-500">📐</span>
                <span className="font-medium">{o.desenvolvimento_descricao}</span>
              </div>
            )}

            {/* Pedido */}
            {o.numero_pedido && (
              <div className={`flex items-center gap-1 ${z.info}`}>
                <ShoppingCart className="w-3 h-3 text-blue-500" />
                <span className="font-bold text-blue-700">#{o.numero_pedido}</span>
                {pedidoSeq && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">{pedidoSeq}</span>
                )}
                {o.cliente && <span className="text-muted-foreground">— {o.cliente}</span>}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`${z.info} font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded`}>{o.quantidade || 0} pç</span>
            {o.peso_kg > 0 && <span className={`${z.info} text-muted-foreground`}>{o.peso_kg}kg</span>}
            {o.modificacao_blank && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                <Edit3 className="w-2.5 h-2.5 mr-0.5" /> OBD
              </Badge>
            )}
            {o.numero_pedido && <HistoricoPedidoButton numeroPedido={o.numero_pedido} />}
          </div>
        </div>

        {/* Fotos: Pedido (encarregado) + Finalização (operador) */}
        {(o.foto_pedido_url || o.foto_finalizacao_url) && (
          <DualPhotoGallery fotoPedidoUrl={o.foto_pedido_url} fotoFinalizacaoUrl={o.foto_finalizacao_url} z={zoom} />
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



        {/* Quantidade produzida (finalizado) */}
        {o.status === "finalizado" && o.quantidade_produzida > 0 && (
          <div className="text-xs text-green-700 font-semibold mb-2">✓ {o.quantidade_produzida} peças produzidas</div>
        )}

        {/* Bloqueio por corte pendente */}
        {o.status === "aguardando_corte" && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 text-xs text-orange-700 mb-2 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Aguardando finalização do corte para liberar
          </div>
        )}

        {/* Ações */}
        <div className={`flex items-center justify-end ${z.gap} mt-3`}>
          {o.status === "pendente" && (
            <Button size="sm" className={`gap-1 ${z.btn} bg-amber-500 hover:bg-amber-600 text-white border-0`} onClick={handleIniciar}>
              <Play className="w-3 h-3" /> Iniciar
            </Button>
          )}
          {o.status === "aguardando_corte" && (
            <Button size="sm" variant="outline" className={`gap-1 ${z.btn} border-orange-300 text-orange-600`} disabled>
              <Clock className="w-3 h-3" /> Aguardando Corte
            </Button>
          )}
          {o.status === "em_producao" && (
            <>
              <Button size="sm" variant="outline" className={`gap-1 ${z.btn} border-amber-300 text-amber-700 hover:bg-amber-50`}
                onClick={() => { setPauseTipo("setup"); setPauseMotivo(""); setPauseDialog(true); }}>
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
          {isGestor && o.status === "finalizado" && (
            <Button size="sm" variant="outline" className={`gap-1 ${z.btn} text-slate-500`}
              onClick={() => onUpdate(o.id, { status: "pendente", inicio_producao_ts: null })}>
              ↩ Reabrir
            </Button>
          )}
          {isGestor && o.status === "pendente" && (
            <Button size="sm" variant="outline" className={`${z.btn} text-red-500 border-red-200`}
              onClick={() => onUpdate(o.id, { status: "cancelado" })}>Cancelar</Button>
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
                <p className="text-xs text-muted-foreground mt-1">Ajuste, troca de chapa, etc.</p>
              </button>
              <button onClick={() => setPauseTipo("outro")}
                className={`border-2 rounded-xl p-4 text-center transition-all ${pauseTipo === "outro" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Coffee className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                <p className="font-semibold text-sm">Outro Motivo</p>
                <p className="text-xs text-muted-foreground mt-1">Especifique abaixo</p>
              </button>
            </div>
            {pauseTipo === "outro" && (
              <Textarea placeholder="Descreva o motivo da pausa..." value={pauseMotivo}
                onChange={e => setPauseMotivo(e.target.value)} className="h-20" autoFocus />
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
            <div className="bg-slate-50 border border-border rounded-xl p-4 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-slate-500" />
              <p className="font-semibold text-sm">Tire uma foto do material produzido</p>
              <p className="text-xs text-muted-foreground">Obrigatória para registrar a conclusão da ordem</p>
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

      {/* Dialog Modificação de Blank (Guilhotina) */}
      <Dialog open={modificacaoDialog} onOpenChange={setModificacaoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-amber-500" />
              Modificação no Blank?
            </DialogTitle>
            <DialogDescription>
              Você fez alguma modificação no blank ou na peça durante o corte?
              Esta informação será repassada como <strong className="text-foreground">OBD (Obs. de Dobra)</strong> para a dobradeira.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setModBlank(false)}
                className={`border-2 rounded-xl p-4 text-center transition-all ${!modBlank ? "border-green-500 bg-green-50" : "border-border hover:border-green-300"}`}>
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <p className="font-semibold text-sm">Não</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sem modificação</p>
              </button>
              <button onClick={() => setModBlank(true)}
                className={`border-2 rounded-xl p-4 text-center transition-all ${modBlank ? "border-amber-500 bg-amber-50" : "border-border hover:border-amber-300"}`}>
                <Edit3 className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                <p className="font-semibold text-sm">Sim</p>
                <p className="text-xs text-muted-foreground mt-0.5">Houve modificação</p>
              </button>
            </div>
            {modBlank && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Descreva a modificação (OBD)</Label>
                <Textarea
                  value={modDescricao}
                  onChange={(e) => setModDescricao(e.target.value)}
                  placeholder="Ex: Ajustei o blank em 5mm na lateral direita para caber na chapa..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModificacaoDialog(false)}>Cancelar</Button>
            <Button onClick={confirmarModificacao} disabled={modBlank && !modDescricao.trim()}
              className="bg-green-600 hover:bg-green-700 gap-2">
              <CheckCircle2 className="w-4 h-4" /> Confirmar Finalização
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
              <p className="font-semibold text-amber-900">{ordemBloqueante?.tipo_peca || ordemBloqueante?.chapa_descricao || "OP"}</p>
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

      {/* Dialog Prioridade — OP prioritária existe na máquina */}
      <Dialog open={prioridadeDialog} onOpenChange={setPrioridadeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-amber-500 fill-amber-500" /> OP Prioritária Pendente</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Existe uma OP marcada como <strong className="text-amber-600">prioritária</strong> nesta máquina que ainda não foi finalizada:</p>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
              <p className="font-semibold text-amber-900">{ordemPrioritaria?.tipo_peca || ordemPrioritaria?.chapa_descricao || "OP"}</p>
              {ordemPrioritaria?.numero_pedido && <p className="text-xs text-amber-700">Pedido: {ordemPrioritaria.numero_pedido}</p>}
              {ordemPrioritaria?.cliente && <p className="text-xs text-amber-700">Cliente: {ordemPrioritaria.cliente}</p>}
              <p className="text-xs text-amber-700 mt-1">Finalize a OP prioritária antes de iniciar outras.</p>
            </div>
            {isGestor ? (
              <p className="text-xs text-muted-foreground">Como gestor, você pode autorizar o início desta OP mesmo com a prioritária pendente.</p>
            ) : (
              <p className="text-xs text-red-600 font-semibold">⚠️ Apenas o gestor (Hudson) pode autorizar o início de uma OP não prioritária enquanto existe uma prioritária pendente.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPrioridadeDialog(false); setOrdemPrioritaria(null); }}>Cancelar</Button>
            {isGestor && (
              <Button className="bg-amber-500 hover:bg-amber-600 gap-1" onClick={() => { setPrioridadeDialog(false); setOrdemPrioritaria(null); doIniciar(); }}>
                <Star className="w-4 h-4" /> Autorizar início
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}