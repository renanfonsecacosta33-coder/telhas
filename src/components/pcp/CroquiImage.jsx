import React from "react";
import ImageLink from "@/components/ui/ImageLink";
import { normalizarImagemBase64 } from "@/lib/imagemBase64";

/**
 * Exibe o croqui/foto do pedido enviado pelo Odoo (URL ou Base64).
 * - Normaliza strings Base64 puras adicionando o prefixo data:image/png;base64,
 *   quando necessário.
 * - Permite clicar para expandir (rotate, zoom, download) via ImageViewer.
 *
 * Props:
 *  - url: string (URL http ou Base64 do Odoo)
 *  - alt: rótulo acessível / nome do arquivo no visualizador
 *  - className: classes do botão wrapper (block por padrão)
 *  - imgClassName: classes do <img> interno
 */
export default function CroquiImage({
  url,
  alt = "Croqui do pedido",
  className = "",
  imgClassName = "w-full max-h-72 object-contain rounded-lg",
}) {
  const src = normalizarImagemBase64(url);
  if (!src) return null;
  return (
    <ImageLink url={src} name={alt} className={`block ${className}`}>
      <img src={src} alt={alt} className={imgClassName} />
    </ImageLink>
  );
}