import React, { useState, useEffect } from "react";
import { Image as ImageIcon, RefreshCw, FileText, ExternalLink, AlertCircle } from "lucide-react";
import { normalizarImagemBase64, isPdfUrl } from "@/lib/imagemBase64";
import ImageLink from "@/components/ui/ImageLink";

/**
 * SmartImage.jsx
 * 
 * Componente de Alta Performance para Renderização de Imagens no ERP AJL:
 * 1. Normalização Inteligente (Base64 pura do Odoo, /web/content/ -> /web/image/, Drive, etc.)
 * 2. Carregamento Assíncrono e Lazy Loading nativo (não bloqueia a thread de UI)
 * 3. Skeleton / Placeholder animado enquanto a foto carrega (elimina sensação de lentidão)
 * 4. Auto-Retry com fallback automático em caso de instabilidade de rede ou URLs do Odoo
 * 5. Suporte nativo a PDFs com ícone indicador
 * 6. Integração transparente com visualizador ampliado (ImageViewer com Zoom e Rotação)
 */
export default function SmartImage({
  src,
  alt = "Imagem",
  className = "",
  imgClassName = "w-full h-full object-cover",
  aspectRatio,
  clickable = true,
  onClick,
  showBadge = false,
  badgeText = "",
  badgeColor = "bg-blue-600",
}) {
  const [status, setStatus] = useState("loading"); // "loading" | "loaded" | "error"
  const [tentativas, setTentativas] = useState(0);
  const [currentSrc, setCurrentSrc] = useState("");

  const urlNormalizada = normalizarImagemBase64(src);
  const isPdf = isPdfUrl(urlNormalizada);

  // Inicializa ou atualiza o src quando a prop mudar
  useEffect(() => {
    if (!urlNormalizada) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    setTentativas(0);
    setCurrentSrc(urlNormalizada);
  }, [urlNormalizada]);

  const handleLoad = () => {
    setStatus("loaded");
  };

  const handleError = () => {
    // Tentativa 1 de recuperação inteligente: Se tiver /web/content/ no Odoo, tenta /web/image/
    if (tentativas === 0 && currentSrc.includes("/web/content/")) {
      setTentativas(1);
      setCurrentSrc(currentSrc.replace("/web/content/", "/web/image/"));
      return;
    }

    // Tentativa 2 de recuperação: Se tiver /web/image/ com query, tenta direto
    if (tentativas === 0 && currentSrc.startsWith("http://")) {
      setTentativas(1);
      setCurrentSrc(currentSrc.replace("http://", "https://"));
      return;
    }

    // Se já tentou ou não tem fallback automático, marca como erro
    setStatus("error");
  };

  const handleRetry = (e) => {
    e.stopPropagation();
    setStatus("loading");
    setTentativas(prev => prev + 1);
    // Adiciona timestamp para forçar bypass de cache corrompido
    const sep = currentSrc.includes("?") ? "&" : "?";
    setCurrentSrc(`${urlNormalizada}${sep}_t=${Date.now()}`);
  };

  // Se não houver fonte válida
  if (!src) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/60 text-slate-400 rounded-lg p-2 min-h-[60px] ${className}`}>
        <ImageIcon className="w-5 h-5 opacity-40 mb-1" />
        <span className="text-[10px] font-medium text-slate-400">Sem foto</span>
      </div>
    );
  }

  // Se for documento PDF
  if (isPdf) {
    const content = (
      <div className={`relative flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg p-3 min-h-[70px] border border-border group hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${className}`}>
        <FileText className="w-7 h-7 text-red-500 mb-1 group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Documento PDF</span>
        <span className="text-[9px] text-muted-foreground mt-0.5">Clique para abrir</span>
      </div>
    );

    if (clickable && !onClick) {
      return (
        <ImageLink url={urlNormalizada} name={alt} className="block w-full">
          {content}
        </ImageLink>
      );
    }
    return content;
  }

  // Conteúdo da Imagem com Skeleton e Fallback de Erro
  const imageElement = (
    <div
      className={`relative overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900 ${className}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      onClick={onClick}
    >
      {/* Skeleton animado enquanto carrega */}
      {status === "loading" && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-1.5 opacity-60">
            <ImageIcon className="w-5 h-5 text-slate-400 animate-bounce" />
            <span className="text-[9px] font-bold text-slate-500">Carregando...</span>
          </div>
        </div>
      )}

      {/* Estado de Erro com Botão de Recarregar */}
      {status === "error" && (
        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-2 text-center z-10 gap-1">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
            Falha ao carregar
          </span>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-1 flex items-center gap-1 text-[9px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Recarregar
          </button>
        </div>
      )}

      {/* Tag de Imagem com Decodificação Assíncrona e Lazy Load */}
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        className={`${imgClassName} transition-opacity duration-300 ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Badge Opcional (ex: PED, FIN, ETIQ) */}
      {showBadge && badgeText && (
        <span className={`absolute top-1 left-1 ${badgeColor} text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm z-20 pointer-events-none`}>
          {badgeText}
        </span>
      )}
    </div>
  );

  // Se for clicável e não tiver onClick customizado, envelopa com o ImageLink (visualizador com zoom/download)
  if (clickable && !onClick && status !== "error") {
    return (
      <ImageLink url={urlNormalizada} name={alt} className="block w-full">
        {imageElement}
      </ImageLink>
    );
  }

  return imageElement;
}
