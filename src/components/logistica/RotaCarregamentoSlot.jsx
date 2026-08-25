import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import UploadButton from "@/components/ui/UploadButton";
import ImageViewer from "@/components/ui/ImageViewer";

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

export default function RotaCarregamentoSlot({ rotaId, dep, url, nome }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.RotaEntrega.update(rotaId, {
        [`imagem_carregamento_${dep}_url`]: file_url,
        [`imagem_carregamento_${dep}_nome`]: file.name,
      });
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      toast.success(`Carregamento — ${DEP_LABEL[dep]} ✓`);
    } catch (e) {
      toast.error("Erro: " + (e?.message || ""));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col">
      {url ? (
        <button
          onClick={() => { setViewerUrl(url); setViewerName(nome); }}
          className={`relative h-20 w-full rounded-lg border-2 ${DEP_RING[dep]} overflow-hidden bg-muted group`}
          title={`Ver carregamento — ${DEP_LABEL[dep]}`}
        >
          <img src={url} alt="carregamento" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className={`absolute bottom-0 inset-x-0 ${DEP_BAR[dep]} text-white text-[9px] text-center py-0.5 font-medium`}>
            {DEP_LABEL[dep]} ✓
          </span>
        </button>
      ) : (
        <div className={`h-20 w-full rounded-lg border-2 border-dashed ${DEP_RING[dep]} flex flex-col items-center justify-center gap-1 p-1`}>
          <UploadButton
            label={DEP_LABEL[dep]}
            cameraRef={cameraRef}
            fileRef={fileRef}
            uploading={uploading}
            className="h-auto py-1.5"
          />
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])} />
      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  );
}