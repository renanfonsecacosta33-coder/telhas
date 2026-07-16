import React, { useState } from "react";
import { ImageOff, FileText } from "lucide-react";
import ImageLink from "@/components/ui/ImageLink";

/**
 * Exibe uma imagem com fallback elegante (placeholder cinza) se a URL
 * for inválida, estiver vazia ou falhar ao carregar. Suporta PDF.
 */
export default function SafeImage({ url, name = "Imagem", className = "", imgClassName = "", showAmpliar = true }) {
  const [erro, setErro] = useState(false);

  if (!url || erro) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 border border-slate-200 rounded-xl ${className}`}>
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <ImageOff className="w-6 h-6" />
          <span className="text-[10px] font-medium">Sem imagem</span>
        </div>
      </div>
    );
  }

  const isPdf = url.toLowerCase().endsWith(".pdf") || url.toLowerCase().includes(".pdf?");

  if (isPdf) {
    return (
      <ImageLink url={url} name={name} className={`block relative rounded-xl overflow-hidden border border-slate-200 ${className}`}>
        <div className={`w-full h-full flex items-center justify-center bg-slate-50 ${imgClassName}`}>
          <div className="flex flex-col items-center gap-1 text-slate-500">
            <FileText className="w-8 h-8" />
            <span className="text-[10px] font-medium">PDF — toque para abrir</span>
          </div>
        </div>
      </ImageLink>
    );
  }

  return (
    <ImageLink url={url} name={name} className={`block relative rounded-xl overflow-hidden border border-slate-200 ${className}`}>
      <img
        src={url}
        alt={name}
        className={`w-full h-full object-cover ${imgClassName}`}
        onError={() => setErro(true)}
      />
    </ImageLink>
  );
}