import React, { useState } from "react";
import ImageLink from "@/components/ui/ImageLink";
import { extrairAnexosLista, extrairCroquiPedidoInfo, extrairBase64Fallback } from "@/lib/croquiExtractor";

// URLs do Odoo exigem sessão autenticada. Estes atributos contornam o
// bloqueio cross-domain para o domínio ajlferroeaco.odoo.com.
const isOdooDomain = (src) =>
  typeof src === "string" && src.includes("ajlferroeaco.odoo.com");
const odooImgProps = (src) =>
  isOdooDomain(src)
    ? { referrerPolicy: "no-referrer", crossOrigin: "anonymous" }
    : {};

/**
 * Miniatura (thumbnail) do croqui/desenho técnico do pedido, exibida NO TOPO
 * do card. Suporta GALERIA de múltiplos anexos (Anexo 1 + Anexo 2 lado a lado).
 *
 * - Se o pedido tiver Anexo 1 E Anexo 2: exibe 2 thumbnails de 100px lado a
 *   lado, cada um clicável para zoom em tela cheia, com tags "Anexo 1"/"Anexo 2".
 * - Se houver apenas um anexo: exibe miniatura única (120px).
 *
 * Decodificação universal:
 *  - Base64 puro → prefixa `data:image/png;base64,` para renderização imediata.
 *  - URL interna do Odoo (/web/content/...) → usa Base64 do anexo para abrir
 *    sem exigir login de sessão no Odoo.
 */
export default function CroquiThumb({ pedido, alt, className = "" }) {
  const anexos = extrairAnexosLista(pedido);

  // Fallback único (compat) quando não há anexos estruturados mas há foto/croqui genérico
  if (anexos.length === 0) {
    const { src: srcUnico } = extrairCroquiPedidoInfo(pedido);
    const fallbackUnico = extrairBase64Fallback(pedido);
    if (!srcUnico) return null;
    return (
      <div className={`relative shrink-0 ${className}`}>
        <ImageLink
          url={srcUnico}
          name={alt || `Croqui #${pedido?.numero_pedido || ""}`}
          className="block group"
        >
          <img
            src={srcUnico}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            alt=""
            style={{ width: "100%", height: "120px", objectFit: "cover" }}
            className="w-full h-[120px] object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm group-hover:opacity-90 transition-opacity"
            {...odooImgProps(srcUnico)}
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

  const handleError = () => {
    if (!tentouFallback && anexo.fallback && anexo.fallback !== srcAtual) {
      setTentouFallback(true);
      setSrcAtual(anexo.fallback);
    }
  };

  return (
    <div className="relative">
      <ImageLink
        url={srcAtual}
        name={`${alt} — ${anexo.label}`}
        className="block group"
      >
        <img
          src={srcAtual}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          alt=""
          onError={handleError}
          style={{ width: "100%", height: `${height}px`, objectFit: "cover" }}
          className="w-full object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm group-hover:opacity-90 transition-opacity"
          {...odooImgProps(srcAtual)}
        />
      </ImageLink>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5">
        📷 {anexo.label}
      </span>
    </div>
  );
}