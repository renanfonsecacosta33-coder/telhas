import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, X, Camera, Film, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import ImageViewer from "@/components/ui/ImageViewer";
import { playFinishSound } from "@/lib/sounds";

const DEP_LABEL = { telhas: "Telhas", corte_dobra: "Corte e Dobra", expedicao: "Expedição" };
const DEP_RING = {
  telhas: "border-blue-300",
  corte_dobra: "border-orange-300",
  expedicao: "border-purple-300",
};
const DEP_BAR = {
  telhas: "bg-blue-700/80",
  corte_dobra: "bg-orange-700/80",
  expedicao: "bg-purple-700/80",
};
const MAX_FOTOS = 3;

export default function RotaCarregamentoSlot({ rotaId, dep, fotosJson, videoUrl, videoNome }) {
  const fotos = (() => {
    try { return JSON.parse(fotosJson || "[]"); } catch { return []; }
  })();
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const cameraRef = useRef(null);
  const videoRef = useRef(null);
  const queryClient = useQueryClient();

  const persist = async (novasFotos, novoVideo) => {
    const updates = {};
    if (novasFotos !== undefined) updates[`fotos_${dep}_json`] = JSON.stringify(novasFotos);
    if (novoVideo !== undefined) {
      updates[`video_${dep}_url`] = novoVideo.url || "";
      updates[`video_${dep}_nome`] = novoVideo.nome || "";
    }
    await base44.entities.RotaEntrega.update(rotaId, updates);
    queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
  };

  const handleFoto = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) { toast.error("Apenas imagens."); return; }
    if (fotos.length >= MAX_FOTOS) { toast.error(`Máximo de ${MAX_FOTOS} fotos.`); return; }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const novas = [...fotos, { url: file_url, nome: file.name }];
      await persist(novas, undefined);
      toast.success(`Foto ${novas.length}/${MAX_FOTOS} — ${DEP_LABEL[dep]}`);
      if (novas.length >= MAX_FOTOS) {
        setShowCheck(true);
        playFinishSound();
        setTimeout(() => setShowCheck(false), 2500);
      }
    } catch (e) {
      toast.error("Erro: " + (e?.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const handleVideo = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("video/")) { toast.error("Apenas vídeos."); return; }
    if (file.size > 60 * 1024 * 1024) { toast.error("Vídeo muito grande (máx 60MB)."); return; }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await persist(undefined, { url: file_url, nome: file.name });
      toast.success(`Vídeo anexado — ${DEP_LABEL[dep]}`);
    } catch (e) {
      toast.error("Erro: " + (e?.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const removerFoto = async (idx) => {
    const novas = fotos.filter((_, i) => i !== idx);
    await persist(novas, undefined);
  };

  const removerVideo = async () => {
    await persist(undefined, { url: "", nome: "" });
  };

  const completo = fotos.length >= MAX_FOTOS;

  return (
    <div className="relative flex flex-col gap-1.5">
      <div className={`flex items-center justify-between px-2 py-1 rounded-md ${DEP_BAR[dep]} text-white text-[10px] font-bold`}>
        <span>{DEP_LABEL[dep]}</span>
        <span>{fotos.length}/{MAX_FOTOS} {videoUrl ? "· 🎬" : ""}</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {fotos.map((f, i) => (
          <div key={i} className="relative h-16 rounded-md border-2 border-slate-200 dark:border-slate-700 overflow-hidden group">
            <img src={f.url} alt={f.nome} className="h-full w-full object-cover cursor-pointer" onClick={() => { setViewerUrl(f.url); setViewerName(f.nome); }} />
            <button onClick={() => removerFoto(i)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="w-2.5 h-2.5" />
            </button>
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center">{i + 1}</span>
          </div>
        ))}
        {fotos.length < MAX_FOTOS && (
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className={`h-16 rounded-md border-2 border-dashed ${DEP_RING[dep]} flex flex-col items-center justify-center gap-0.5 hover:bg-muted/50 disabled:opacity-50 transition-colors`}
          >
            {uploading ? <Camera className="w-4 h-4 animate-pulse text-slate-400" /> : <Plus className="w-4 h-4 text-slate-400" />}
            <span className="text-[8px] text-slate-400">Foto</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {videoUrl ? (
          <div className="relative flex-1 h-12 rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center gap-1.5 px-1.5 bg-muted/30">
            <Film className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-[10px] text-slate-600 dark:text-slate-300 truncate flex-1">{videoNome || "video.mp4"}</span>
            <a href={videoUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-semibold">ver</a>
            <button onClick={removerVideo} className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center">
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => videoRef.current?.click()}
            disabled={uploading}
            className="flex-1 h-12 rounded-md border-2 border-dashed border-purple-300 flex items-center justify-center gap-1 text-[10px] text-purple-600 font-semibold hover:bg-purple-50 dark:hover:bg-purple-950/30 disabled:opacity-50 transition-colors"
          >
            <Film className="w-3.5 h-3.5" /> Vídeo (1)
          </button>
        )}
      </div>

      {completo && !showCheck && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
          <CheckCircle2 className="w-3 h-3" /> Fotos completas
        </div>
      )}

      {showCheck && (
        <div className="absolute inset-0 z-20 rounded-lg bg-emerald-500/95 flex flex-col items-center justify-center gap-1">
          <CheckCircle2 className="w-10 h-10 text-white" />
          <span className="text-xs font-bold text-white">{DEP_LABEL[dep]} concluído! ✓</span>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { handleFoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => { handleVideo(e.target.files?.[0]); e.target.value = ""; }} />
      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  );
}