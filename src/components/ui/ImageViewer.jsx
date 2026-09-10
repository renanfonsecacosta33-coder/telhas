import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { RotateCw, Download, X, ZoomIn, ZoomOut, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { isPdfUrl } from "@/lib/imagemBase64";

/**
 * Lightweight full-screen image viewer — opens instantly (no Radix Dialog animation),
 * shows a spinner while the image loads, supports rotate / zoom / download,
 * and seamlessly navigates between multiple images with keyboard and buttons.
 */
export default function ImageViewer({ url, name, images = [], initialIndex = 0, open, onClose }) {
  // Normaliza lista de imagens
  const listaImagens = useMemo(() => {
    if (images && images.length > 0) {
      return images.map(img => typeof img === "string" ? { url: img, name: name || "Imagem" } : { url: img.url || img.src, name: img.name || img.label || name || "Imagem" });
    }
    if (url) {
      return [{ url, name: name || "Imagem" }];
    }
    return [];
  }, [images, url, name]);

  const [indiceAtual, setIndiceAtual] = useState(initialIndex || 0);

  // Sincroniza índice inicial ao abrir
  useEffect(() => {
    if (!open) return;
    if (initialIndex >= 0 && initialIndex < listaImagens.length) {
      setIndiceAtual(initialIndex);
    } else if (url) {
      const idx = listaImagens.findIndex(i => i.url === url);
      setIndiceAtual(idx >= 0 ? idx : 0);
    } else {
      setIndiceAtual(0);
    }
  }, [open, url, initialIndex, listaImagens]);

  const itemAtual = listaImagens[indiceAtual] || listaImagens[0] || { url: "", name: "" };
  const urlAtual = itemAtual.url;
  const nomeAtual = itemAtual.name;

  const [rotacao, setRotacao] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const isPdf = useCallback(() => isPdfUrl(urlAtual), [urlAtual]);

  // Reset state + preload image as soon as viewer opens or image changes
  useEffect(() => {
    if (!open || !urlAtual) return;
    setRotacao(0);
    setZoom(1);
    setLoaded(false);
    if (isPdf()) {
      setLoaded(true);
      return;
    }
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true);
    img.src = urlAtual;

    // Preload próxima imagem se houver
    if (listaImagens.length > 1) {
      const nextIdx = (indiceAtual + 1) % listaImagens.length;
      const nextUrl = listaImagens[nextIdx]?.url;
      if (nextUrl && !isPdfUrl(nextUrl)) {
        const pre = new Image();
        pre.referrerPolicy = "no-referrer";
        pre.src = nextUrl;
      }
    }
  }, [open, urlAtual, isPdf, indiceAtual, listaImagens]);

  const handlePrev = useCallback(() => {
    if (listaImagens.length <= 1) return;
    setIndiceAtual(prev => (prev - 1 + listaImagens.length) % listaImagens.length);
  }, [listaImagens]);

  const handleNext = useCallback(() => {
    if (listaImagens.length <= 1) return;
    setIndiceAtual(prev => (prev + 1) % listaImagens.length);
  }, [listaImagens]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, handlePrev, handleNext]);

  const handleClose = useCallback(() => {
    setLoaded(false);
    onClose?.();
  }, [onClose]);

  if (!open || !urlAtual) return null;

  const isLandscape = rotacao === 90 || rotacao === 270;
  const temMultiplas = listaImagens.length > 1;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 select-none">
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0 max-w-[60%]">
          <span className="text-xs text-white/90 truncate font-bold" title={nomeAtual}>
            {nomeAtual || "Imagem"}
          </span>
          {temMultiplas && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/15 text-white/80 shrink-0">
              {indiceAtual + 1} de {listaImagens.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!isPdf() && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Diminuir Zoom">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-white/60 w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Aumentar Zoom">
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-white/20 mx-1" />
              <button onClick={() => setRotacao(r => (r + 90) % 360)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Girar 90°">
                <RotateCw className="w-4 h-4" />
              </button>
            </>
          )}
          <a href={urlAtual} download={nomeAtual || "imagem"} target="_blank" rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Baixar">
            <Download className="w-4 h-4" />
          </a>
          <button onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-colors cursor-pointer"
            title="Fechar (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Prev / Next buttons */}
      {temMultiplas && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all border border-white/10 shadow-lg cursor-pointer"
            title="Foto anterior (Seta esquerda)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all border border-white/10 shadow-lg cursor-pointer"
            title="Próxima foto (Seta direita)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Image / PDF container */}
      <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
        {!loaded && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            <span className="text-xs text-white/50">Carregando imagem...</span>
          </div>
        )}
        {isPdf() ? (
          <iframe
            src={urlAtual}
            title={nomeAtual || "Documento"}
            className="w-full h-full border-0 rounded-lg"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        ) : (
          <img
            src={urlAtual}
            alt={nomeAtual || "Imagem"}
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            className={`max-w-none transition-opacity duration-150 ${loaded ? "opacity-100" : "opacity-0 absolute"}`}
            style={{
              transform: `rotate(${rotacao}deg) scale(${zoom})`,
              maxHeight: isLandscape ? "90vw" : "90vh",
              maxWidth: isLandscape ? "90vh" : "95vw",
            }}
            draggable={false}
          />
        )}
      </div>

      {/* Bottom Mini Thumbnails Strip */}
      {temMultiplas && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 max-w-[90vw] overflow-x-auto no-scrollbar">
          {listaImagens.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setIndiceAtual(idx)}
              className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                idx === indiceAtual
                  ? "border-orange-500 scale-110 shadow-md ring-2 ring-orange-500/40"
                  : "border-white/20 hover:border-white/60 opacity-60 hover:opacity-100"
              }`}
              style={{ width: "40px", height: "40px" }}
              title={img.name}
            >
              <img
                src={img.url}
                alt={img.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}