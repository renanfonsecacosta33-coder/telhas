import React, { useState, useEffect } from "react";
import { Clock, Pause, Settings } from "lucide-react";

function formatTempo(seg) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = Math.floor(seg % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CronometroProducao({ pedido }) {
  const [, setTick] = useState(0);

  const isProducao = pedido.status === "em_producao";
  const isPausado = pedido.status === "pausado";

  useEffect(() => {
    if (!isProducao && !isPausado) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isProducao, isPausado, pedido.inicio_producao_ts, pedido.inicio_pausa_ts]);

  if (!isProducao && !isPausado) return null;

  let sessaoSeg = 0;
  if (isProducao && pedido.inicio_producao_ts) {
    sessaoSeg = Math.max(0, Math.floor((Date.now() - new Date(pedido.inicio_producao_ts).getTime()) / 1000));
  } else if (isPausado && pedido.inicio_pausa_ts) {
    sessaoSeg = Math.max(0, Math.floor((Date.now() - new Date(pedido.inicio_pausa_ts).getTime()) / 1000));
  }

  const totalProducao = (pedido.tempo_producao_seg || 0) + (isProducao ? sessaoSeg : 0);
  const totalSetup = pedido.tempo_setup_seg || 0;
  const totalPausa = (pedido.tempo_pausa_seg || 0) + (isPausado ? sessaoSeg : 0);

  return (
    <div
      className={`flex items-center flex-wrap gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs font-mono ${
        isProducao
          ? "bg-amber-50 border border-amber-200"
          : "bg-orange-50 border border-orange-200"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {isProducao ? (
          <Clock className={`w-3.5 h-3.5 text-amber-600 ${sessaoSeg > 0 ? "animate-pulse" : ""}`} />
        ) : (
          <Pause className="w-3.5 h-3.5 text-orange-600" />
        )}
        <span className={isProducao ? "text-amber-700 font-bold" : "text-orange-700 font-bold"}>
          {isProducao ? "Produzindo" : "Pausado"}: {formatTempo(sessaoSeg)}
        </span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="w-3 h-3" />
        Total: {formatTempo(totalProducao)}
      </div>
      {totalSetup > 0 && (
        <div className="flex items-center gap-1.5 text-blue-600">
          <Settings className="w-3 h-3" />
          Setup: {formatTempo(totalSetup)}
        </div>
      )}
      {totalPausa > 0 && (
        <div className="flex items-center gap-1.5 text-orange-600">
          <Pause className="w-3 h-3" />
          Pausa: {formatTempo(totalPausa)}
        </div>
      )}
    </div>
  );
}