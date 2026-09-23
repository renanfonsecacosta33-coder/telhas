import React from "react";
import SmartImage from "@/components/ui/SmartImage";

/**
 * Exibe o croqui/foto do pedido enviado pelo Odoo (URL ou Base64).
 * Utiliza SmartImage para renderização assíncrona, lazy loading, skeleton e tratamento de PDF/Base64.
 */
export default function CroquiImage({
  url,
  alt = "Croqui do pedido",
  className = "",
  imgClassName = "w-full max-h-72 object-contain rounded-lg",
}) {
  if (!url) return null;
  return (
    <SmartImage
      src={url}
      alt={alt}
      className={className}
      imgClassName={imgClassName}
      clickable={true}
    />
  );
}