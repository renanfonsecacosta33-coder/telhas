import React from "react";
import { Image as ImageIcon, FileText } from "lucide-react";
import SmartImage from "@/components/ui/SmartImage";
import ImageLink from "@/components/ui/ImageLink";

/**
 * Exibe fotos lado a lado: Foto do Pedido (PED), Foto do Material (MAT) e Foto de Finalização (FIN).
 * Utiliza SmartImage para renderização ultrarrápida com lazy loading, skeleton e normalização de URLs/Base64.
 */
export default function DualPhotoGallery({ fotoPedidoUrl, fotoMaterialUrl, fotoFinalizacaoUrl, z = "normal", labelMaterial }) {
  const labelCls = z === "compacto" ? "text-[9px] px-1.5 py-0.5" : z === "grande" ? "text-xs px-2.5 py-1" : "text-[10px] px-2 py-0.5";
  const hImg = z === "compacto" ? "h-28" : z === "grande" ? "h-52" : "h-40";

  const hasPedido = !!fotoPedidoUrl;
  const showMaterial = !!fotoMaterialUrl && !fotoFinalizacaoUrl;
  const hasFinal = !!fotoFinalizacaoUrl;

  if (!hasPedido && !showMaterial && !hasFinal) return null;

  const photos = [];
  if (hasPedido) photos.push({ url: fotoPedidoUrl, label: "Foto do Pedido", borderCls: "border-blue-300 dark:border-blue-700", badgeCls: "bg-blue-600 text-white" });
  if (showMaterial) photos.push({ url: fotoMaterialUrl, label: labelMaterial || "Foto do Material", borderCls: "border-orange-300 dark:border-orange-700", badgeCls: "bg-orange-600 text-white" });
  if (hasFinal) photos.push({ url: fotoFinalizacaoUrl, label: "Foto Finalização", borderCls: "border-green-300 dark:border-green-700", badgeCls: "bg-green-600 text-white" });

  const single = photos.length === 1;
  const gridCls = photos.length === 3 ? "grid-cols-3" : "grid-cols-2";

  const renderPhotoBlock = (p, i) => {
    return (
      <div key={i} className={`relative rounded-xl overflow-hidden border-2 shadow-sm ${single ? "w-full" : "flex-1"} ${p.borderCls}`}>
        <SmartImage
          src={p.url}
          alt={p.label}
          className={`w-full ${hImg}`}
          imgClassName="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          clickable={true}
        />
        <div className={`absolute top-1.5 left-1.5 ${labelCls} font-bold rounded-full flex items-center gap-0.5 shadow pointer-events-none z-10 ${p.badgeCls}`}>
          <ImageIcon className="w-3 h-3" /> {p.label}
        </div>
        <ImageLink
          url={p.url}
          name={p.label}
          className="absolute bottom-1.5 right-1.5 bg-black/70 hover:bg-black/90 text-white text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1 z-10 backdrop-blur-sm"
        >
          <ImageIcon className="w-3 h-3" /> Ampliar
        </ImageLink>
      </div>
    );
  };

  return (
    <div className="mb-3">
      {single ? (
        <div className="flex">{renderPhotoBlock(photos[0], 0)}</div>
      ) : (
        <div className={`grid ${gridCls} gap-2`}>
          {photos.map((p, i) => renderPhotoBlock(p, i))}
        </div>
      )}
    </div>
  );
}