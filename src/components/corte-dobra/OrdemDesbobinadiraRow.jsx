import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Play, Pause, Square, CheckCircle2, Timer, Coffee, Circle, AlertCircle, Clock, Camera, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

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

export default function OrdemDesbobinadiraRow({ ordem: o, onUpdate, isGestor }) {
  const [pauseDialog, setPauseDialog] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState("");
  const [pauseTipo, setPauseTipo] = useState("setup");
  const [fotoDialog, setFotoDialog] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [tick, setTick] = useState(0);
  const fotoInputRef = useRef();

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

  const handleIniciar = () => {
    onUpdate(o.id, { status: "em_producao", inicio_producao_ts: new Date().toISOString() });
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

  const handleRetomar = () => {
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

  const handleFinalizar = () => {
    setPauseMotivo("");
    setFotoDialog(true);
  };

  const handleUploadFoto = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    // Acumula tempo de produção
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    // Desconta KG da bobina
    if (o.bobina_id && o.kg_estimado > 0) {
      const bobina = await base44.entities.Bobina.get(o.bobina_id).catch(() => null);
      if (bobina) {
        await base44.entities.Bobina.update(o.bobina_id, {
          peso_kg: Math.max(0, (bobina.peso_kg || 0) - o.kg_estimado),
        });
      }
    }
    onUpdate(o.id, {
      status: "finalizado",
      foto_finalizacao_url: file_url,
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
    });
    setUploadingFoto(false);
    setFotoDialog(false);
  };

  const showCronometro = o.status === "em_producao" || o.status === "pausado" || tempoProd > 0;

  return (
    <>
      <div className="border-l-4 border-l-orange-400 bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-base font-mono text-orange-600">{o.bobina_descricao || "Bobina"}</span>
              <StatusBadge status={o.status} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
              {o.quantidade > 0 && <span className="font-semibold text-foreground">{o.quantidade} peças</span>}
              {o.comprimento_mm > 0 && <span>{o.comprimento_mm}mm de corte</span>}
              {o.kg_estimado > 0 && (
                <span className="font-semibold text-emerald-700">≈ {o.kg_estimado.toFixed(1)} kg</span>
              )}
            </div>
          </div>
        </div>

        {/* Observações */}
        {o.observacoes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 text-xs text-yellow-800 mb-3">
            📋 {o.observacoes}
          </div>
        )}

        {/* Pausa ativa */}
        {o.status === "pausado" && o.motivo_pausa && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800 mb-3 flex items-center gap-2">
            <Pause className="w-3 h-3 flex-shrink-0" />
            <span>{o.motivo_pausa === "setup" ? "⚙️ Pausa para Setup de Máquina" : `⏸ Pausa: ${o.motivo_pausa}`}</span>
          </div>
        )}

        {/* Cronômetros */}
        {showCronometro && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className={`rounded-lg px-3 py-2 text-center ${o.status === "em_producao" ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Timer className="w-3 h-3 text-green-600" />
                <span className="text-xs text-muted-foreground">Produção</span>
              </div>
              <p className={`text-sm font-bold tabular-nums ${o.status === "em_producao" ? "text-green-700" : "text-slate-600"}`}>
                {formatTempo(tempoProd)}
              </p>
            </div>
            <div className={`rounded-lg px-3 py-2 text-center ${o.status === "pausado" && o.motivo_pausa !== "setup" ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Coffee className="w-3 h-3 text-amber-600" />
                <span className="text-xs text-muted-foreground">Pausa</span>
              </div>
              <p className={`text-sm font-bold tabular-nums ${o.status === "pausado" && o.motivo_pausa !== "setup" ? "text-amber-700" : "text-slate-600"}`}>
                {formatTempo(tempoPausa)}
              </p>
            </div>
            <div className={`rounded-lg px-3 py-2 text-center ${o.status === "pausado" && o.motivo_pausa === "setup" ? "bg-purple-50 border border-purple-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Square className="w-3 h-3 text-purple-600" />
                <span className="text-xs text-muted-foreground">Setup</span>
              </div>
              <p className={`text-sm font-bold tabular-nums ${o.status === "pausado" && o.motivo_pausa === "setup" ? "text-purple-700" : "text-slate-600"}`}>
                {formatTempo(tempoSetup)}
              </p>
            </div>
          </div>
        )}

        {/* Foto de finalização */}
        {o.foto_finalizacao_url && (
          <div className="mb-3">
            <a href={o.foto_finalizacao_url} target="_blank" rel="noopener noreferrer">
              <img src={o.foto_finalizacao_url} alt="Finalização" className="w-full max-h-40 object-cover rounded-lg border border-border" />
            </a>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 mt-3">
          {o.status === "pendente" && (
            <Button size="sm" className="gap-1 bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={handleIniciar}>
              <Play className="w-3 h-3" /> Iniciar
            </Button>
          )}
          {o.status === "em_producao" && (
            <>
              <Button size="sm" variant="outline" className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => { setPauseTipo("setup"); setPauseMotivo(""); setPauseDialog(true); }}>
                <Pause className="w-3 h-3" /> Pausar
              </Button>
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white border-0" onClick={handleFinalizar}>
                <CheckCircle2 className="w-3 h-3" /> Finalizar
              </Button>
            </>
          )}
          {o.status === "pausado" && (
            <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90 text-white border-0" onClick={handleRetomar}>
              <Play className="w-3 h-3" /> Retomar
            </Button>
          )}
          {isGestor && o.status === "finalizado" && (
            <Button size="sm" variant="outline" className="gap-1 text-slate-500" onClick={() => onUpdate(o.id, { status: "pendente", inicio_producao_ts: null })}>
              ↩ Reabrir
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
              <Button type="button" className="w-full gap-2" onClick={() => fotoInputRef.current.click()} disabled={uploadingFoto}>
                {uploadingFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {uploadingFoto ? "Enviando foto..." : "📷 Tirar / Selecionar Foto"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFotoDialog(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}