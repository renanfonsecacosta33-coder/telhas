import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Play, Pause, Camera, CheckCircle2, RotateCcw, Wrench } from "lucide-react";
import { format } from "date-fns";

const hhmmss = (s) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/**
 * Controle de UMA OrdemMaquinaCD direto na Central PCP (Ivaiporã).
 * Inicia, pausa, retoma e finaliza com foto — independente das outras OPs,
 * permitindo rodar vários itens ao mesmo tempo.
 */
export default function OpCDControleLinha({ op, pedido, onSalvar }) {
  const [salvando, setSalvando] = useState(false);
  const [pausaOpen, setPausaOpen] = useState(false);
  const [pausaTipo, setPausaTipo] = useState("setup");
  const [pausaMotivo, setPausaMotivo] = useState("");
  const [fotoOpen, setFotoOpen] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const fotoRef = useRef(null);

  const status = op.status || "pendente";
  const emProducao = status === "em_producao";
  const pausado = status === "pausado";

  useEffect(() => {
    if (!emProducao && !pausado) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [emProducao, pausado]);

  const tempoProducaoSeg = () => {
    let seg = Number(op.tempo_producao_seg) || 0;
    if (emProducao && op.inicio_producao_ts) {
      const i = new Date(op.inicio_producao_ts).getTime();
      if (!isNaN(i)) seg += Math.floor((agora - i) / 1000);
    }
    return Math.max(0, seg);
  };

  const tempoPausaSeg = () => {
    let seg = Number(op.tempo_pausa_seg) || 0;
    if (pausado && op.inicio_pausa_ts) {
      const i = new Date(op.inicio_pausa_ts).getTime();
      if (!isNaN(i)) seg += Math.floor((agora - i) / 1000);
    }
    return Math.max(0, seg);
  };

  const atualizar = async (patch) => {
    setSalvando(true);
    try {
      await onSalvar(op, patch);
    } finally {
      setSalvando(false);
    }
  };

  const iniciar = () =>
    atualizar({ status: "em_producao", inicio_producao_ts: new Date().toISOString(), inicio_pausa_ts: null, motivo_pausa: null });

  const confirmarPausa = () => {
    const motivo = pausaTipo === "setup" ? "setup" : (pausaMotivo.trim() || "pausa");
    atualizar({
      status: "pausado",
      tempo_producao_seg: tempoProducaoSeg(),
      inicio_producao_ts: null,
      inicio_pausa_ts: new Date().toISOString(),
      motivo_pausa: motivo,
    });
    setPausaOpen(false);
    setPausaMotivo("");
    setPausaTipo("setup");
  };

  const retomar = () => {
    let pausaSeg = Number(op.tempo_pausa_seg) || 0;
    let setupSeg = Number(op.tempo_setup_seg) || 0;
    if (op.inicio_pausa_ts) {
      const delta = Math.max(0, Math.floor((agora - new Date(op.inicio_pausa_ts).getTime()) / 1000));
      if (op.motivo_pausa === "setup") setupSeg += delta;
      else pausaSeg += delta;
    }
    let historico = [];
    try { historico = JSON.parse(op.historico_pausas || "[]"); } catch { historico = []; }
    if (op.inicio_pausa_ts) {
      historico.push({
        motivo: op.motivo_pausa,
        inicio: op.inicio_pausa_ts,
        fim: new Date().toISOString(),
        segundos: Math.floor((agora - new Date(op.inicio_pausa_ts).getTime()) / 1000),
      });
    }
    atualizar({
      status: "em_producao",
      tempo_pausa_seg: pausaSeg,
      tempo_setup_seg: setupSeg,
      inicio_pausa_ts: null,
      motivo_pausa: null,
      historico_pausas: JSON.stringify(historico),
      inicio_producao_ts: new Date().toISOString(),
    });
  };

  const enviarFoto = async (file) => {
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await onSalvar(op, {
        status: "finalizado",
        tempo_producao_seg: tempoProducaoSeg(),
        inicio_producao_ts: null,
        inicio_pausa_ts: null,
        quantidade_produzida: Number(op.quantidade) || op.quantidade_produzida || null,
        data_finalizacao: format(new Date(), "yyyy-MM-dd"),
        foto_finalizacao_url: file_url,
      });
      toast.success("Peça finalizada com foto registrada!");
      setFotoOpen(false);
    } catch (e) {
      toast.error("Erro ao finalizar: " + (e?.message || ""));
    } finally {
      setEnviandoFoto(false);
    }
  };

  return (
    <div
      className="rounded-lg border border-[#f0d6bd] dark:border-orange-900 bg-white dark:bg-slate-900 px-2 py-1.5 flex flex-wrap items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 dark:bg-orange-950 px-1.5 py-1 text-[10px] font-extrabold uppercase text-orange-800 dark:text-orange-300">
        <Wrench className="w-3 h-3" /> {op.maquina}
      </span>
      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[220px]" title={op.tipo_peca}>
        {op.tipo_peca || "Peça"} {op.quantidade ? `· ${op.quantidade} pç` : ""}
        {op.dimensoes_livres ? ` · ${op.dimensoes_livres}` : ""}
      </span>

      {emProducao && (
        <>
          <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">{hhmmss(tempoProducaoSeg())}</span>
          <Button size="sm" variant="outline" onClick={() => { setPausaTipo("setup"); setPausaOpen(true); }} disabled={salvando} className="h-7 gap-1 text-[11px]">
            <Pause className="w-3 h-3" /> Pausar
          </Button>
        </>
      )}

      {pausado && (
        <>
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
            Pausado{op.motivo_pausa ? ` (${op.motivo_pausa})` : ""} · {hhmmss(tempoPausaSeg())}
          </span>
          <Button size="sm" variant="outline" onClick={retomar} disabled={salvando} className="h-7 gap-1 text-[11px]">
            <RotateCcw className="w-3 h-3" /> Retomar
          </Button>
        </>
      )}

      {!emProducao && !pausado && (
        <Button size="sm" onClick={iniciar} disabled={salvando} className="h-7 gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white">
          <Play className="w-3 h-3" /> Iniciar
        </Button>
      )}

      {(emProducao || pausado) && (
        <Button size="sm" onClick={() => setFotoOpen(true)} disabled={salvando} className="h-7 gap-1 text-[11px] bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="w-3 h-3" /> Finalizar
        </Button>
      )}

      <Dialog open={pausaOpen} onOpenChange={setPausaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Pausar produção — {op.maquina}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={pausaTipo === "setup" ? "default" : "outline"} onClick={() => setPausaTipo("setup")} className="h-9 text-xs">Setup de máquina</Button>
              <Button variant={pausaTipo === "outro" ? "default" : "outline"} onClick={() => setPausaTipo("outro")} className="h-9 text-xs">Outro motivo</Button>
            </div>
            {pausaTipo === "outro" && (
              <Input value={pausaMotivo} onChange={(e) => setPausaMotivo(e.target.value)} placeholder="Motivo da pausa" className="text-sm" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPausaOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarPausa}>Pausar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fotoOpen} onOpenChange={setFotoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Finalizar — Foto Obrigatória</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-4 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-slate-500" />
              <p className="font-semibold text-sm">Tire a foto da peça pronta</p>
              <p className="text-xs text-muted-foreground">Obrigatória para registrar a conclusão em {op.maquina}</p>
              <input
                ref={fotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => enviarFoto(e.target.files?.[0])}
              />
              <Button onClick={() => fotoRef.current?.click()} disabled={enviandoFoto} className="gap-2">
                <Camera className="w-4 h-4" /> {enviandoFoto ? "Enviando..." : "Tirar / Enviar Foto"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFotoOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}