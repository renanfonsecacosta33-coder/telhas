import React, { useState, useEffect } from "react";
import ImageLink from "@/components/ui/ImageLink";
import { Camera, FileText, Images } from "lucide-react";
import { extrairAnexosLista, extrairCroquiPedidoInfo } from "@/lib/croquiExtractor";
import { normalizarImagemBase64, isPdfUrl } from "@/lib/imagemBase64";

/**
 * Miniatura do croqui / anexos do pedido.
 * Suporta múltiplos anexos (1 a 10+):
 * - No card: exibe os 2 primeiros em destaque + faixa com as fotos adicionais (+X fotos)
 * - Na galeria completa (diálogo): exibe todos os anexos em grid responsivo
 * - Ao clicar em QUALQUER foto, abre o ImageViewer com navegação entre TODAS as fotos.
 */
export default function CroquiThumb({ pedido, alt, className = "", galeriaCompleta = false }) {
  let anexos = extrairAnexosLista(pedido);

  // Fallback se extrairAnexosLista não encontrou nada mas extrairCroquiPedidoInfo achou
  if (anexos.length === 0) {
    const { src: srcUnico, origem } = extrairCroquiPedidoInfo(pedido);
    if (srcUnico) {
      anexos = [{ src: srcUnico, label: origem || "Desenho Técnico" }];
    }
  }

  if (anexos.length === 0) return null;

  const viewerImages = anexos.map((a, i) => ({
    url: a.src,
    name: `${alt || "Croqui"} — ${a.label || `Foto ${i + 1}`}`
  }));

  // Modo Galeria Completa (ex: no diálogo de detalhes do pedido)
  if (galeriaCompleta) {
    return (
      <div className={`space-y-2 ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-semibold flex items-center gap-1.5">
            <Images className="w-3.5 h-3.5 text-blue-500" />
            Total de {anexos.length} {anexos.length === 1 ? "anexo" : "anexos disponíveis"}
          </span>
          <span className="text-[11px] text-muted-foreground">Clique para tela cheia com zoom e navegação</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {anexos.map((anexo, idx) => (
            <CroquiThumbItem
              key={idx}
              anexo={anexo}
              alt={alt}
              height={110}
              images={viewerImages}
              index={idx}
            />
          ))}
        </div>
      </div>
    );
  }

  // Modo Card (Central PCP, Galpões, etc.)
  const total = anexos.length;
  const isDupla = total >= 2;
  const temMaisDeDois = total > 2;

  return (
    <div className={`relative shrink-0 ${className}`} onClick={(e) => e.stopPropagation()}>
      {/* Grade principal: 1 foto (largura total) ou 2 fotos lado a lado */}
      <div className={`grid ${isDupla ? "grid-cols-2" : "grid-cols-1"} gap-1.5`}>
        {anexos.slice(0, 2).map((anexo, idx) => (
          <div key={idx} className="relative">
            <CroquiThumbItem
              anexo={anexo}
              alt={alt}
              height={isDupla ? 95 : 115}
              images={viewerImages}
              index={idx}
            />
            {/* Badge "+X fotos" sobre o 2º item se houver mais de 2 */}
            {idx === 1 && temMaisDeDois && (
              <span className="absolute top-1.5 right-1.5 pointer-events-none z-10 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow flex items-center gap-1 border border-white/20">
                <Camera className="w-2.5 h-2.5 text-orange-400" />
                +{total - 2}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Faixa horizontal de fotos adicionais (Anexo 3, 4, 5...) */}
      {temMaisDeDois && (
        <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
            Mais:
          </span>
          {anexos.slice(2).map((anexo, idx) => {
            const indexReal = idx + 2;
            return (
              <CroquiMiniThumbItem
                key={indexReal}
                anexo={anexo}
                index={indexReal}
                alt={alt}
                images={viewerImages}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Item individual da galeria — renderiza miniatura da imagem ou documento PDF,
 * permitindo clique para abrir o visualizador em tela cheia com rotação e zoom.
 */
function CroquiThumbItem({ anexo, alt, height, images, index = 0 }) {
  const [srcAtual, setSrcAtual] = useState(() => normalizarImagemBase64(anexo.src));
  const [falhouTotal, setFalhouTotal] = useState(false);

  useEffect(() => {
    setSrcAtual(normalizarImagemBase64(anexo.src));
    setFalhouTotal(false);
  }, [anexo.src]);

  const handleError = () => {
    if (srcAtual && srcAtual.includes("/web/content/")) {
      const novaUrl = srcAtual.replace("/web/content/", "/web/image/");
      setSrcAtual(novaUrl);
      return;
    }
    setFalhouTotal(true);
  };

  const isPdf = isPdfUrl(srcAtual);

  return (
    <div className="relative group overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800" style={{ height: `${height}px` }}>
      <ImageLink
        url={srcAtual}
        images={images}
        initialIndex={index}
        name={`${alt || "Croqui"} — ${anexo.label}`}
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
            loading="lazy"
            referrerPolicy="no-referrer"
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

/**
 * Miniatura compacta para a faixa horizontal de fotos adicionais (+3, +4...)
 */
function CroquiMiniThumbItem({ anexo, alt, images, index }) {
  const [srcAtual, setSrcAtual] = useState(() => normalizarImagemBase64(anexo.src));
  const [falhouTotal, setFalhouTotal] = useState(false);

  useEffect(() => {
    setSrcAtual(normalizarImagemBase64(anexo.src));
    setFalhouTotal(false);
  }, [anexo.src]);

  const handleError = () => {
    if (srcAtual && srcAtual.includes("/web/content/")) {
      const novaUrl = srcAtual.replace("/web/content/", "/web/image/");
      setSrcAtual(novaUrl);
      return;
    }
    setFalhouTotal(true);
  };

  const isPdf = isPdfUrl(srcAtual);

  return (
    <div className="relative shrink-0 group">
      <ImageLink
        url={srcAtual}
        images={images}
        initialIndex={index}
        name={`${alt || "Croqui"} — ${anexo.label}`}
        className="block"
      >
        <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm hover:ring-2 hover:ring-orange-500 transition-all flex items-center justify-center">
          {isPdf ? (
            <FileText className="w-4 h-4 text-red-600" />
          ) : falhouTotal ? (
            <Camera className="w-4 h-4 text-orange-500" />
          ) : (
            <img
              src={srcAtual}
              alt={anexo.label}
              referrerPolicy="no-referrer"
              onError={handleError}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </ImageLink>
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-slate-900/80 text-white px-1 rounded pointer-events-none whitespace-nowrap">
        {anexo.label.replace("Anexo ", "A")}
      </span>
    </div>
  );
}