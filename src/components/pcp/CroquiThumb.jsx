import React, { useState } from "react";
import ImageLink from "@/components/ui/ImageLink";
import { extrairCroquiPedidoInfo, extrairBase64Fallback } from "@/lib/croquiExtractor";

/**
 * Miniatura (thumbnail) do croqui/desenho técnico do pedido, exibida DIRETO
 * NO TOPO do card. Clicável para expandir (ImageViewer).
 *
 * Inspeciona anexo_1_url, anexo_2_url, anexo_1_base64 e anexo_2_base64.
 * Renderiza <img> com width 100% e altura 120px. Caso a URL externa do Odoo
 * falhe ao carregar, o onError tenta o fallback Data URI construído do Base64.
 */
export default function CroquiThumb({ pedido, alt, className = "" }) {
  const { src: srcInicial, origem } = extrairCroquiPedidoInfo(pedido);
  const fallback = extrairBase64Fallback(pedido);
  const [srcAtual, setSrcAtual] = useState(srcInicial);
  const [tentouFallback, setTentouFallback] = useState(false);

  if (!srcAtual) return null;

  const selo = origem ? `📷 Desenho Técnico / ${origem}` : "📷 Desenho Técnico";

  const handleError = () => {
    // Se a URL externa falhou e ainda há um fallback Data URI, tenta uma vez.
    if (!tentouFallback && fallback && fallback !== srcAtual) {
      setTentouFallback(true);
      setSrcAtual(fallback);
    }
  };

  return (
    <div className={`relative shrink-0 ${className}`}>
      <ImageLink
        url={srcAtual}
        name={alt || `Croqui #${pedido?.numero_pedido || ""}`}
        className="block group"
      >
        <img
          src={srcAtual}
          alt={alt || "Desenho Técnico / Croqui"}
          onError={handleError}
          style={{ width: "100%", height: "120px", objectFit: "cover" }}
          className="w-full h-[120px] object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm group-hover:opacity-90 transition-opacity"
        />
      </ImageLink>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5">
        {selo}
      </span>
    </div>
  );
}