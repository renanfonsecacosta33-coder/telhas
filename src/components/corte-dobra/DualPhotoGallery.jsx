import React from "react";
import { Image as ImageIcon } from "lucide-react";
import ImageLink from "@/components/ui/ImageLink";

/**
 * Exibe duas fotos lado a lado: a foto do pedido (encarregado) e a foto de finalização (operador).
 * Se só uma existir, mostra apenas a que tiver.
 */
export default function DualPhotoGallery({ fotoPedidoUrl, fotoFinalizacaoUrl, z = "normal" }) {
  const labelCls = z === "compacto" ? "text-[9px] px-1.5 py-0.5" : z === "grande" ? "text-xs px-2.5 py-1" : "text-[10px] px-2 py-0.5";
  const hImg = z === "compacto" ? "max-h-28" : z === "grande" ? "max-h-52" : "max-h-40";

  const hasPedido = !!fotoPedidoUrl;
  const hasFinal = !!fotoFinalizacaoUrl;

  if (!hasPedido && !hasFinal) return null;

  const single = hasPedido !== hasFinal;

  const PhotoBlock = ({ url, label, borderCls, badgeCls }) => (
    <div className={`relative rounded-lg overflow-hidden border-2 ${single ? "w-full" : "flex-1"} ${borderCls}`}>
      <ImageLink url={url} name={label} className="block">
        <img src={url} alt={label} className={`w-full ${hImg} object-cover`} />
      </ImageLink>
      <div className={`absolute top-1.5 left-1.5 ${labelCls} font-bold rounded-full flex items-center gap-0.5 ${badgeCls}`}>
        <ImageIcon className="w-3 h-3" /> {label}
      </div>
      <ImageLink url={url} name={label}
        className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg hover:bg-black/80 transition-colors flex items-center gap-0.5">
        <ImageIcon className="w-3 h-3" /> Ampliar
      </ImageLink>
    </div>
  );

  return (
    <div className="mb-3">
      {single ? (
        hasPedido
          ? <PhotoBlock url={fotoPedidoUrl} label="Foto do Pedido" borderCls="border-blue-300" badgeCls="bg-blue-600 text-white" />
          : <PhotoBlock url={fotoFinalizacaoUrl} label="Foto Finalização" borderCls="border-green-300" badgeCls="bg-green-600 text-white" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <PhotoBlock url={fotoPedidoUrl} label="Foto do Pedido" borderCls="border-blue-300" badgeCls="bg-blue-600 text-white" />
          <PhotoBlock url={fotoFinalizacaoUrl} label="Foto Finalização" borderCls="border-green-300" badgeCls="bg-green-600 text-white" />
        </div>
      )}
    </div>
  );
}