import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { RotateCw, Download, X, ZoomIn, ZoomOut, Loader2, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { isPdfUrl, normalizarImagemBase64 } from "@/lib/imagemBase64";

// Cache global em memória de imagens carregadas na sessão do usuário
const globalImageCache = new Set();

/**
 * Registra uma URL de imagem como já carregada e pronta para exibição instantânea
 */
export function registrarImagemCarregada(url) {
  if (!url) return;
  const limpo = normalizarImagemBase64(url);
  if (limpo) globalImageCache.add(limpo);
}

/**
 * Verifica se a imagem já está no cache ou é uma Data URI / Blob local
 */
export function isImagemEmCache(url) {
  if (!url) return false;
  const limpo = normalizarImagemBase64(url);
  if (!limpo) return false;
  // Imagens locais Base64 ou Blob já estão em memória no dispositivo do usuário
  if (limpo.startsWith("data:") || limpo.startsWith("blob:")) return true;
  return globalImageCache.has(limpo);
}

/**
 * Pré-carrega uma imagem no cache do navegador de forma silenciosa
 */
export function preCarregarImagem(url) {
  if (!url || isImagemEmCache(url) || isPdfUrl(url)) return;
  const limpo = normalizarImagemBase64(url);
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.onload = () => registrarImagemCarregada(limpo);
  img.src = limpo;
}

/**
 * Lightweight full-screen image viewer — opens instantly (no Radix Dialog animation),
 * shows a spinner while the image loads, supports rotate / zoom / download,
 * and seamlessly navigates between multiple images with keyboard and buttons.
 */
export default function ImageViewer({ url, name, images = [], initialIndex = 0, open, onClose }) {
  // Normaliza lista de imagens
  const listaImagens = useMemo(() => {
    if (images && images.length > 0) {
      return images.map(img => {
        const rawUrl = typeof img === "string" ? img : (img.url || img.src);
        return {
          url: normalizarImagemBase64(rawUrl),
          name: (typeof img === "object" ? (img.name || img.label) : null) || name || "Imagem",
        };
      });
    }
    if (url) {
      return [{ url: normalizarImagemBase64(url), name: name || "Imagem" }];
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
  const [loaded, setLoaded] = useState(() => isImagemEmCache(urlAtual));
  const imgRef = useRef(null);

  const isPdf = useCallback(() => isPdfUrl(urlAtual), [urlAtual]);

  // Carregamento inteligente e instantâneo
  useEffect(() => {
    if (!open || !urlAtual) return;
    setRotacao(0);
    setZoom(1);

    // Se já for PDF ou já estiver em cache/base64, marca como carregado imediatamente
    if (isPdf() || isImagemEmCache(urlAtual)) {
      setLoaded(true);
      return;
    }

    // Se a imagem no DOM já completou ou já tem dimensões válidas
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      registrarImagemCarregada(urlAtual);
      setLoaded(true);
      return;
    }

    setLoaded(false);

    // Timeout de segurança: nunca deixa o usuário preso em spinner infinito por mais de 1.2s
    const timeoutSeguranca = setTimeout(() => {
      setLoaded(true);
    }, 1200);

    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      clearTimeout(timeoutSeguranca);
      registrarImagemCarregada(urlAtual);
      setLoaded(true);
    };
    img.onerror = () => {
      clearTimeout(timeoutSeguranca);
      setLoaded(true);
    };
    img.src = urlAtual;

    // Se já estiver em cache no browser síncrono
    if (img.complete && img.naturalWidth > 0) {
      clearTimeout(timeoutSeguranca);
      registrarImagemCarregada(urlAtual);
      setLoaded(true);
    }

    // Preload silencioso das imagens vizinhas (próxima e anterior)
    if (listaImagens.length > 1) {
      const nextIdx = (indiceAtual + 1) % listaImagens.length;
      const prevIdx = (indiceAtual - 1 + listaImagens.length) % listaImagens.length;
      [nextIdx, prevIdx].forEach(idx => {
        const vizinhaUrl = listaImagens[idx]?.url;
        if (vizinhaUrl && !isPdfUrl(vizinhaUrl)) {
          preCarregarImagem(vizinhaUrl);
        }
      });
    }

    return () => clearTimeout(timeoutSeguranca);
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
      <div className="relative w-full h-full flex items-center justify-center overflow-auto p-4">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none bg-black/40 backdrop-blur-[2px]">
            <Loader2 className="w-8 h-8 text-white/80 animate-spin" />
            <span className="text-xs text-white/80 font-medium">Carregando imagem...</span>
          </div>
        )}
        {isPdf() ? (
          <iframe
            src={urlAtual}
            title={nomeAtual || "Documento"}
            className="w-full h-full border-0 rounded-lg"
          />
        ) : (
          <img
            ref={imgRef}
            src={urlAtual}
            alt={nomeAtual || "Imagem"}
            referrerPolicy="no-referrer"
            decoding="async"
            onLoad={() => {
              registrarImagemCarregada(urlAtual);
              setLoaded(true);
            }}
            onError={(e) => {
              if (e.currentTarget.src && e.currentTarget.src.includes("/web/content/")) {
                const nova = e.currentTarget.src.replace("/web/content/", "/web/image/");
                e.currentTarget.src = nova;
                registrarImagemCarregada(nova);
              }
              setLoaded(true);
            }}
            className="max-w-none transition-transform duration-200"
            style={{
              transform: `rotate(${rotacao}deg) scale(${zoom})`,
              maxHeight: isLandscape ? "90vw" : "90vh",
              maxWidth: isLandscape ? "90vh" : "95vw",
              filter: loaded ? "none" : "blur(4px)",
              opacity: loaded ? 1 : 0.85,
              transition: "filter 0.2s ease, opacity 0.2s ease, transform 0.2s ease",
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