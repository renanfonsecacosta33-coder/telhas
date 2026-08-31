import React, { useState } from "react";
import ImageLink from "@/components/ui/ImageLink";
import { Camera, Image as ImageIcon } from "lucide-react";
import { extrairAnexosLista, extrairCroquiPedidoInfo, extrairBase64Fallback } from "@/lib/croquiExtractor";

/**
 * Miniatura (thumbnail) do croqui/desenho técnico do pedido, exibida NO TOPO
 * do card. Suporta GALERIA de múltiplos anexos (Anexo 1 + Anexo 2 lado a lado).
 */
export default function CroquiThumb({ pedido, alt, className = "" }) {
  const anexos = extrairAnexosLista(pedido);

  // Fallback único (compat) quando não há anexos estruturados mas há foto/croqui genérico
  if (anexos.length === 0) {
    const { src: srcUnico } = extrairCroquiPedidoInfo(pedido);
    if (!srcUnico) return null;
    return (
      <div className={`relative shrink-0 ${className}`} style={{ height: "120px" }}>
        <ImageLink
          url={srcUnico}
          name={alt || `Croqui #${pedido?.numero_pedido || ""}`}
          className="block group w-full h-full"
        >
          <img
            src={srcUnico}
            alt=""
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            style={{ width: "100%", height: "120px", objectFit: "cover" }}
            className="w-full h-[120px] object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm group-hover:opacity-90 transition-opacity"
          />
        </ImageLink>
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded-full shadow">
          📷 Desenho Técnico
        </span>
      </div>
    );
  }

  // Galeria: 1 ou 2 anexos lado a lado
  const isGaleriaDupla = anexos.length >= 2;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div className={`grid ${isGaleriaDupla ? "grid-cols-2" : "grid-cols-1"} gap-1.5`}>
        {anexos.slice(0, 2).map((anexo, idx) => (
          <CroquiThumbItem
            key={idx}
            anexo={anexo}
            alt={alt || `Croqui #${pedido?.numero_pedido || ""}`}
            height={isGaleriaDupla ? 100 : 120}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Item individual da galeria — gerencia seu próprio estado de onError e
 * fallback para Base64 quando a URL externa falha.
 */
function CroquiThumbItem({ anexo, alt, height }) {
  const [srcAtual, setSrcAtual] = useState(anexo.src);
  const [tentouFallback, setTentouFallback] = useState(false);
  const [falhouTotal, setFalhouTotal] = useState(false);

  const handleError = () => {
    if (!tentouFallback && anexo.fallback && anexo.fallback !== srcAtual) {
      setTentouFallback(true);
      setSrcAtual(anexo.fallback);
    } else {
      setFalhouTotal(true);
    }
  };

  return (
    <div className="relative" style={{ height: `${height}px` }}>
      <ImageLink
        url={srcAtual}
        name={`${alt} — ${anexo.label}`}
        className="block group w-full h-full"
      >
        {falhouTotal ? (
          <div
            style={{ height: `${height}px` }}
            className="w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors p-2 text-center"
          >
            <Camera className="w-5 h-5 mb-1 opacity-70 text-orange-500" />
            <span className="text-[10px] font-medium leading-tight">Ver Foto (Clique)</span>
          </div>
        ) : (
          <img
            src={srcAtual}
            alt=""
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={handleError}
            style={{ width: "100%", height: `${height}px`, objectFit: "cover" }}
            className="w-full object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm group-hover:opacity-90 transition-opacity"
          />
        )}
      </ImageLink>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5">
        📷 {anexo.label}
      </span>
    </div>
  );
}