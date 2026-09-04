import React, { useState, useEffect } from "react";
import ImageLink from "@/components/ui/ImageLink";
import { Camera, FileText } from "lucide-react";
import { extrairAnexosLista, extrairCroquiPedidoInfo } from "@/lib/croquiExtractor";
import { normalizarImagemBase64, isPdfUrl } from "@/lib/imagemBase64";

/**
 * Miniatura (thumbnail) do croqui/desenho técnico do pedido, exibida NO TOPO
 * do card. Suporta GALERIA de múltiplos anexos (Anexo 1 + Anexo 2 lado a lado).
 */
export default function CroquiThumb({ pedido, alt, className = "" }) {
  const anexos = extrairAnexosLista(pedido);

  // Fallback único (compat) quando não há anexos estruturados mas há foto/croqui genérico
  if (anexos.length === 0) {
    const { src: srcUnico, origem } = extrairCroquiPedidoInfo(pedido);
    if (!srcUnico) return null;
    return (
      <div className={`relative shrink-0 ${className}`}>
        <CroquiThumbItem
          anexo={{ src: srcUnico, label: origem || "Desenho Técnico" }}
          alt={alt || `Croqui #${pedido?.numero_pedido || ""}`}
          height={120}
        />
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
 * Item individual da galeria — renderiza miniatura da imagem ou documento PDF,
 * permitindo clique para abrir o visualizador em tela cheia com rotação e zoom.
 */
function CroquiThumbItem({ anexo, alt, height }) {
  const [srcAtual, setSrcAtual] = useState(() => normalizarImagemBase64(anexo.src));
  const [falhouTotal, setFalhouTotal] = useState(false);

  useEffect(() => {
    setSrcAtual(normalizarImagemBase64(anexo.src));
    setFalhouTotal(false);
  }, [anexo.src]);

  const handleError = () => {
    setFalhouTotal(true);
  };

  const isPdf = isPdfUrl(srcAtual);

  return (
    <div className="relative group overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800" style={{ height: `${height}px` }}>
      <ImageLink
        url={srcAtual}
        name={`${alt} — ${anexo.label}`}
        className="block w-full h-full"
      >
        {isPdf ? (
          <div
            style={{ height: `${height}px` }}
            className="w-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900/50 p-2 text-center group-hover:bg-red-100/50 transition-colors"
          >
            <FileText className="w-7 h-7 text-red-600 mb-1" />
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 leading-tight">Documento PDF</span>
            <span className="text-[9px] text-muted-foreground">Clique para visualizar</span>
          </div>
        ) : falhouTotal ? (
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
            alt={anexo.label || "Miniatura"}
            onError={handleError}
            style={{ width: "100%", height: `${height}px`, objectFit: "cover" }}
            className="w-full object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm group-hover:opacity-90 transition-opacity"
          />
        )}
      </ImageLink>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5 pointer-events-none z-10">
        📷 {anexo.label}
      </span>
    </div>
  );
}