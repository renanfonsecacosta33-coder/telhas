import React from "react";
import { Image as ImageIcon } from "lucide-react";
import ImageLink from "@/components/ui/ImageLink";

/**
 * Exibe duas fotos lado a lado: a foto do pedido (encarregado) e a foto de finalização (operador).
 * Se só uma existir, mostra apenas a que tiver.
 */
export default function DualPhotoGallery({ fotoPedidoUrl, fotoFinalizacaoUrl, z = "normal" }) {
  const padCls = z === "compacto" ? "p-1.5" : z === "grande" ? "p-3" : "p-2.5";
  const labelCls = z === "compacto" ? "text-[9px] px-1.5 py-0.5" : z === "grande" ? "text-xs px-2.5 py-1" : "text-[10px] px-2 py-0.5";
  const hImg = z === "compacto" ? "max-h-28" : z === "grande" ? "max-h-52" : "max-h-40";

  const hasPedido = !!fotoPedidoUrl;
  const hasFinal = !!fotoFinalizacaoUrl;

  if (!hasPedido && !hasFinal) return null;

  const single = hasPedido !== hasFinal; // true se só tem uma das duas

  const PhotoBlock = ({ url, label, badgeColor, iconColor }) => (
    <div className={`relative rounded-lg overflow-hidden border-2 ${single ? "w-full" : "flex-1"} ${badgeColor}`}>
      <ImageLink url={url} name={label} className="block">
        <img src={url} alt={label} className={`w-full ${hImg} object-cover`} />
      </ImageLink>
      <div className={`absolute top-1.5 left-1.5 ${labelCls} font-bold rounded-full flex items-center gap-0.5 ${badgeColor} ${iconColor}`}>
        <ImageIcon className="w-3 h-3" /> {label}
      </div>
      <ImageLink url={url} name={label}
        className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg hover:bg-black/80 transition-colors flex items-center gap-0.5">
        <ImageIcon className="w-3 h-3" /> Ampliar
      </ImageLink>
    </div>
  );

  return (
    <div className={`mb-3 ${padCls}`}>
      {single ? (
        hasPedido
          ? <PhotoBlock url={fotoPedidoUrl} label="Foto do Pedido" badgeColor="border-blue-300 bg-blue-600 text-white" iconColor="" />
          : <PhotoBlock url={fotoFinalizacaoUrl} label="Foto Finalização" badgeColor="border-green-300 bg-green-600 text-white" iconColor="" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <PhotoBlock url={fotoPedidoUrl} label="Foto do Pedido" badgeColor="border-blue-300 bg-blue-600 text-white" iconColor="" />
          <PhotoBlock url={fotoFinalizacaoUrl} label="Foto Finalização" badgeColor="border-green-300 bg-green-600 text-white" iconColor="" />
        </div>
      )}
    </div>
  );
}