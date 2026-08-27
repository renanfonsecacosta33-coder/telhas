import React from "react";
import ImageLink from "@/components/ui/ImageLink";
import { extrairCroquiPedidoInfo } from "@/lib/croquiExtractor";

/**
 * Miniatura (thumbnail) de 120px do croqui/desenho técnico do pedido,
 * exibida DIRETO NO TOPO do card. Clicável para expandir (ImageViewer).
 *
 * Lê TODAS as variações de campos de anexo/foto (anexo_1, anexo_2, anexo1,
 * anexo2, anexo_1_url, anexo_2_url, foto_pedido_url, foto_pedido, imagens_anexos)
 * e exibe o selo da origem ("📷 Desenho Técnico / Anexo 1", etc.).
 *
 * Props:
 *  - pedido: objeto PedidoOdoo
 *  - alt: rótulo acessível
 *  - className: classes extras do wrapper
 */
export default function CroquiThumb({ pedido, alt, className = "" }) {
  const { src, origem } = extrairCroquiPedidoInfo(pedido);
  if (!src) return null;

  const selo = origem ? `📷 Desenho Técnico / ${origem}` : "📷 Desenho Técnico";

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
          style={{ width: "100%", height: "100px", objectFit: "cover" }}
          className="w-[120px] h-[120px] object-cover rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm group-hover:opacity-90 transition-opacity"
        />
      </ImageLink>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5">
        {selo}
      </span>
    </div>
  );
}