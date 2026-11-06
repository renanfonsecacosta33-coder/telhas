import React, { useEffect, useRef, useState } from "react";
import { Clock, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

function hhmmss(totalSeg) {
  const s = Math.max(0, Math.floor(totalSeg || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

/**
 * Cronômetro de produção exibido ao vendedor.
 * Conta em tempo real quando a OP está rodando e congela quando pausa/finaliza.
 */
export default function CronometroProducaoVendedor({ seg = 0, segPausa = 0, rodando = false, emPausa = false }) {
  const [tick, setTick] = useState(Date.now());
  const baseRef = useRef({ seg, ts: Date.now() });

  useEffect(() => {
    baseRef.current = { seg, ts: Date.now() };
    setTick(Date.now());
  }, [seg, rodando]);

  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rodando]);

  const decorrido = rodando
    ? (baseRef.current.seg || 0) + Math.floor((tick - baseRef.current.ts) / 1000)
    : (seg || 0);

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md shrink-0",
            rodando ? "bg-emerald-50 dark:bg-emerald-950" : emPausa ? "bg-amber-50 dark:bg-amber-950" : "bg-slate-100 dark:bg-slate-800"
          )}
        >
          {rodando ? (
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Pause className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-none">
            {rodando ? "Produzindo agora" : emPausa ? "Em pausa" : "Tempo de produção"}
          </p>
          <p className="font-mono font-extrabold text-[18px] leading-tight tabular-nums text-[#2F4F4F] dark:text-emerald-300">
            {hhmmss(decorrido)}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        {segPausa > 0 && (
          <p className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 leading-tight">
            pausa {hhmmss(segPausa)}
          </p>
        )}
        {rodando && (
          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ao vivo
          </span>
        )}
      </div>
    </div>
  );
}