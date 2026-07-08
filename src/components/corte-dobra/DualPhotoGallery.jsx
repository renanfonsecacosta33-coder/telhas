import React from "react";
import { Image as ImageIcon, FileText } from "lucide-react";
import ImageLink from "@/components/ui/ImageLink";

/**
 * Exibe fotos lado a lado: Foto do Pedido (PED), Foto do Material (MAT) e Foto de Finalização (FIN).
 * A foto do material só aparece quando não há foto de finalização (OP ainda não finalizada na Guilhotina).
 */
export default function DualPhotoGallery({ fotoPedidoUrl, fotoMaterialUrl, fotoFinalizacaoUrl, z = "normal" }) {
  const labelCls = z === "compacto" ? "text-[9px] px-1.5 py-0.5" : z === "grande" ? "text-xs px-2.5 py-1" : "text-[10px] px-2 py-0.5";
  const hImg = z === "compacto" ? "max-h-28" : z === "grande" ? "max-h-52" : "max-h-40";

  const hasPedido = !!fotoPedidoUrl;
  // Mostra a foto do material apenas se não houver foto de finalização (evita redundância)
  const showMaterial = !!fotoMaterialUrl && !fotoFinalizacaoUrl;
  const hasFinal = !!fotoFinalizacaoUrl;

  if (!hasPedido && !showMaterial && !hasFinal) return null;

  const photos = [];
  if (hasPedido) photos.push({ url: fotoPedidoUrl, label: "Foto do Pedido", borderCls: "border-blue-300", badgeCls: "bg-blue-600 text-white" });
  if (showMaterial) photos.push({ url: fotoMaterialUrl, label: "Foto do Material", borderCls: "border-orange-300", badgeCls: "bg-orange-600 text-white" });
  if (hasFinal) photos.push({ url: fotoFinalizacaoUrl, label: "Foto Finalização", borderCls: "border-green-300", badgeCls: "bg-green-600 text-white" });

  const single = photos.length === 1;
  const gridCls = photos.length === 3 ? "grid-cols-3" : "grid-cols-2";

  const renderPhotoBlock = (p, i) => {
    const isPdf = p.url?.toLowerCase().endsWith(".pdf") || p.url?.toLowerCase().includes(".pdf?");
    return (
    <div key={i} className={`relative rounded-lg overflow-hidden border-2 ${single ? "w-full" : "flex-1"} ${p.borderCls}`}>
      <ImageLink url={p.url} name={p.label} className="block">
        {isPdf ? (
          <div className={`w-full ${hImg} min-h-[112px] flex items-center justify-center bg-muted`}>
            <FileText className="w-10 h-10 text-muted-foreground" />
          </div>
        ) : (
          <img src={p.url} alt={p.label} className={`w-full ${hImg} object-cover`} />
        )}
      </ImageLink>
      <div className={`absolute top-1.5 left-1.5 ${labelCls} font-bold rounded-full flex items-center gap-0.5 ${p.badgeCls}`}>
        {isPdf ? <FileText className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />} {p.label}
      </div>
      <ImageLink url={p.url} name={p.label}
        className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg hover:bg-black/80 transition-colors flex items-center gap-0.5">
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