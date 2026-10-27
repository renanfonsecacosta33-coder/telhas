import React, { useMemo } from "react";
import { Layers, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function BandejaColagemInfoPanel({ maquinaOrigem, pedido }) {
  const { fotoSuperior, fotoBandeja } = useMemo(() => {
    try {
      const vars = JSON.parse(pedido?.variacoes_telhas || "[]");
      const sup = (Array.isArray(vars) ? vars : []).map(v => v.foto_etapa1_url).filter(Boolean);
      const band = (Array.isArray(vars) ? vars : []).map(v => v.foto_etapa2_url).filter(Boolean);
      return { fotoSuperior: sup[0] || null, fotoBandeja: band[0] || null };
    } catch {
      return { fotoSuperior: null, fotoBandeja: null };
    }
  }, [pedido?.variacoes_telhas]);

  return (
    <div className="w-full bg-pink-50/90 dark:bg-pink-950/40 border-2 border-pink-300 dark:border-pink-800 rounded-2xl p-3 sm:p-4 mb-3 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-pink-600 shrink-0" />
          <div>
            <p className="font-bold text-xs uppercase tracking-wide text-pink-950 dark:text-pink-200">
              Telha Bandeja — Etapa Final de Colagem e Montagem
            </p>
            <p className="text-[11px] text-muted-foreground">
              Perfilação da Telha Superior ({maquinaOrigem || "TP - 40"}) e Bandeja Inferior já concluídas no fluxo de fábrica.
            </p>
          </div>
        </div>
        <Badge className="bg-emerald-600 text-white font-bold text-xs shrink-0 self-start sm:self-auto">
          ✓ Pronto para Colagem
        </Badge>
      </div>

      {(fotoSuperior || fotoBandeja) && (
        <div className="mt-3 pt-3 border-t border-pink-200 dark:border-pink-800/60 flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-black uppercase tracking-wide text-pink-700 dark:text-pink-300">
            Fotos das Etapas (conferência da colagem):
          </span>
          {[
            ["Telha Superior", fotoSuperior],
            ["Bandeja Inferior", fotoBandeja],
          ].filter(([, url]) => url).map(([label, url]) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-pink-300 text-pink-900 font-bold text-xs hover:bg-pink-100 transition-all shadow-xs"
              title={`Ver foto da etapa: ${label}`}
            >
              <Camera className="w-3.5 h-3.5 text-pink-600" />
              <img
                src={url}
                alt={label}
                className="w-8 h-8 rounded-md object-cover border border-pink-400"
              />
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}