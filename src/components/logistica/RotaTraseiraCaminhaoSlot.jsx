import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Truck, Camera, Eye, X, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import ImageViewer from "@/components/ui/ImageViewer";
import { playFinishSound } from "@/lib/sounds";

const MAX_FOTOS_TRASEIRA = 6;

export default function RotaTraseiraCaminhaoSlot({ rotaId, fotosJson }) {
  const fotos = (() => {
    try {
      return JSON.parse(fotosJson || "[]");
    } catch {
      return [];
    }
  })();

  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const persist = async (novasFotos) => {
    await base44.entities.RotaEntrega.update(rotaId, {
      fotos_caminhao_traseira_json: JSON.stringify(novasFotos),
    });
    queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
    queryClient.invalidateQueries({ queryKey: ["rotas-arquivadas"] });
  };

  const handleFoto = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas.");
      return;
    }
    if (fotos.length >= MAX_FOTOS_TRASEIRA) {
      toast.error(`Limite máximo de ${MAX_FOTOS_TRASEIRA} fotos da traseira atingido.`);
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const novas = [...fotos, { url: file_url, nome: file.name, data: agora }];
      await persist(novas);
      toast.success(`Foto ${novas.length}/${MAX_FOTOS_TRASEIRA} — Traseira do Caminhão`);
      if (novas.length >= 1) {
        playFinishSound();
      }
    } catch (e) {
      toast.error("Erro ao enviar foto: " + (e?.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const removerFoto = async (idx) => {
    const novas = fotos.filter((_, i) => i !== idx);
    await persist(novas);
    toast.info("Foto da traseira removida.");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded bg-primary/10 text-primary">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-foreground">
            Traseira do Caminhão (Carga Geral)
          </span>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
          fotos.length > 0
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            : "bg-muted text-muted-foreground border-border"
        }`}>
          {fotos.length > 0 ? `✓ ${fotos.length} foto(s)` : "Aguardando foto"}
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* Botão de tirar foto com a câmera */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading || fotos.length >= MAX_FOTOS_TRASEIRA}
          className="h-16 w-16 shrink-0 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
          title="Tirar foto com câmera"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span className="text-[9px] font-bold">Câmera</span>
            </>
          )}
        </button>

        {/* Botão de escolher da galeria */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || fotos.length >= MAX_FOTOS_TRASEIRA}
          className="h-16 w-16 shrink-0 rounded-lg border-2 border-dashed border-border hover:border-foreground/30 bg-muted/30 hover:bg-muted/60 text-muted-foreground flex flex-col items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
          title="Escolher foto da galeria"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[9px] font-medium">Galeria</span>
        </button>

        {/* Miniaturas das fotos tiradas */}
        {fotos.map((f, idx) => (
          <div key={idx} className="relative h-16 w-20 shrink-0 rounded-lg border border-border overflow-hidden bg-muted group">
            <img src={f.url} alt={`Traseira ${idx + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => { setViewerUrl(f.url); setViewerName(`Traseira do Caminhão — Foto ${idx + 1}`); }}
                className="p-1 rounded-full bg-black/60 text-white hover:bg-black/90"
                title="Ampliar"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removerFoto(idx)}
                className="p-1 rounded-full bg-red-600/80 text-white hover:bg-red-700"
                title="Remover"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {f.data && (
              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[8px] text-center font-mono py-0.5">
                {f.data}
              </span>
            )}
          </div>
        ))}

        {fotos.length === 0 && (
          <div className="flex-1 text-[11px] text-muted-foreground pl-2 italic">
            Tire uma foto geral da traseira do caminhão após o carregamento para conferência da logística e expedição.
          </div>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  );
}
