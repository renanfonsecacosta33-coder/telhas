import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RotateCw, Download, X, ZoomIn, ZoomOut } from "lucide-react";

export default function ImageViewer({ url, name, open, onClose }) {
  const [rotacao, setRotacao] = useState(0);
  const [zoom, setZoom] = useState(1);

  if (!url) return null;

  const reset = () => { setRotacao(0); setZoom(1); };

  const handleClose = () => { reset(); onClose?.(); };

  const isLandscape = rotacao === 90 || rotacao === 270;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/95 border-border">
        {/* Toolbar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm">
          <span className="text-xs text-white/80 truncate font-medium max-w-[60%]" title={name}>
            {name || "Imagem"}
          </span>
          <div className="flex items-center gap-1.5">
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

        {/* Image container */}
        <div className="w-full h-[95vh] flex items-center justify-center overflow-auto">
          <img
            src={url}
            alt={name || "Imagem"}
            className="max-w-none transition-transform duration-200 select-none"
            style={{
              transform: `rotate(${rotacao}deg) scale(${zoom})`,
              maxHeight: isLandscape ? "90vw" : "92vh",
              maxWidth: isLandscape ? "92vh" : "95vw",
            }}
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}