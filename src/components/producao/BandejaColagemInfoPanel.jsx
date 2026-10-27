import React from "react";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function BandejaColagemInfoPanel({ maquinaOrigem }) {
  return (
    <div className="w-full bg-pink-50/90 dark:bg-pink-950/40 border-2 border-pink-300 dark:border-pink-800 rounded-2xl p-3 sm:p-4 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
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
  );
}