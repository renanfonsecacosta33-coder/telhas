import React, { useState, useEffect, useCallback } from "react";
import { RotateCw, Download, X, ZoomIn, ZoomOut, Loader2 } from "lucide-react";

/**
 * Lightweight full-screen image viewer — opens instantly (no Radix Dialog animation),
 * shows a spinner while the image loads, supports rotate / zoom / download.
 */
export default function ImageViewer({ url, name, open, onClose }) {
  const [rotacao, setRotacao] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loaded, setLoaded] = useState(false);

  const isPdf = useCallback(() => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith(".pdf") || lower.includes(".pdf?");
  }, [url]);

  // Reset state + preload image as soon as the viewer opens (or url changes)
  useEffect(() => {
    if (!open || !url) return;
    setRotacao(0);
    setZoom(1);
    setLoaded(false);
    if (isPdf()) {
      setLoaded(true);
      return;
    }
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true);
    img.src = url;
  }, [open, url, isPdf]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleClose = useCallback(() => {
    setLoaded(false);
    onClose?.();
  }, [onClose]);

  if (!open || !url) return null;

  const isLandscape = rotacao === 90 || rotacao === 270;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 select-none">
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm">
        <span className="text-xs text-white/80 truncate font-medium max-w-[60%]" title={name}>
          {name || "Imagem"}
        </span>
        <div className="flex items-center gap-1.5">
          {!isPdf() && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-white/60 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer">
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
          <a href={url} download={name || "imagem"} target="_blank" rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Baixar">
            <Download className="w-4 h-4" />
          </a>
          <button onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-colors cursor-pointer"
            title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image / PDF container */}
      <div className="w-full h-full flex items-center justify-center overflow-auto">
        {!loaded && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            <span className="text-xs text-white/50">Carregando...</span>
          </div>
        )}
        {isPdf() ? (
          <iframe
            src={url}
            title={name || "Documento"}
            className="w-full h-full border-0"
            style={{ opacity: loaded ? 1 : 0 }}
          />
        ) : (
          <img
            src={url}
            alt={name || "Imagem"}
            onLoad={() => setLoaded(true)}
            className={`max-w-none transition-opacity duration-150 ${loaded ? "opacity-100" : "opacity-0 absolute"}`}
            style={{
              transform: `rotate(${rotacao}deg) scale(${zoom})`,
              maxHeight: isLandscape ? "90vw" : "92vh",
              maxWidth: isLandscape ? "92vh" : "95vw",
            }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}