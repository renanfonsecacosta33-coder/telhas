import React from "react";
import ImageLink from "@/components/ui/ImageLink";
import { extrairCroquiPedido } from "@/lib/croquiExtractor";

/**
 * Miniatura (thumbnail) de 120px do croqui/desenho técnico do pedido,
 * exibida DIRETO NA FRENTE do card. Clicável para expandir (ImageViewer).
 *
 * Props:
 *  - pedido: objeto PedidoOdoo (procura em foto_pedido_url, anexo_1_url,
 *            anexo_2_url, Base64 ou anexos dos itens)
 *  - alt: rótulo acessível
 *  - className: classes extras do wrapper
 */
export default function CroquiThumb({ pedido, alt, className = "" }) {
  const src = extrairCroquiPedido(pedido);
  if (!src) return null;
  return (
    <div className={`relative shrink-0 ${className}`}>
      <ImageLink
        url={src}
        name={alt || `Croqui #${pedido?.numero_pedido || ""}`}
        className="block group"
      >
        <img
          src={src}
          alt={alt || "Desenho Técnico / Croqui"}
          className="w-[120px] h-[120px] object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm group-hover:opacity-90 transition-opacity"
        />
      </ImageLink>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5">
        📷 Desenho Técnico
      </span>
    </div>
  );
}