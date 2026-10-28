import React, { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { getEnvio, subscribeEnvio } from "@/lib/envioDistribuicaoStore";

/**
 * Progresso animado de envio da OF para as máquinas (Central PCP).
 * - Enquanto o envio está em andamento: porcentagem subindo (assintótica até 99%)
 *   + cronômetro do tempo decorrido, para dar visibilidade à demora.
 * - Concluído: mostra quanto tempo durou o envio e há quanto tempo foi enviado.
 */

export function useEnvioDistribuicao(pedidoId) {
  const [envio, setEnvio] = useState(() => getEnvio(pedidoId));

  useEffect(() => {
    const unsub = subscribeEnvio(pedidoId, () => setEnvio(getEnvio(pedidoId)));
    return unsub;
  }, [pedidoId]);

  // Ticker: enquanto envia (200ms) e depois (1s, para o "enviado há X" contar)
  useEffect(() => {
    if (!envio) return;
    const interval = envio.fimTs ? 1000 : 200;
    const t = setInterval(() => setEnvio(getEnvio(pedidoId)), interval);
    return () => clearInterval(t);
  }, [pedidoId, envio?.inicioTs, envio?.fimTs]);

  return envio;
}

// Curva assintótica: sobe rápido no começo e desacelera perto de 99%,
// esperando o término real (quando salta para 100%).
function pctAnimado(inicioTs, fimTs) {
  if (fimTs) return 100;
  const decorrido = (Date.now() - inicioTs) / 1000;
  return Math.min(99, Math.round(100 * (1 - Math.exp(-decorrido / 9))));
}

function formatSeg(seg) {
  if (seg < 60) return `${Math.round(seg)}s`;
  const min = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return s > 0 ? `${min}min ${s}s` : `${min}min`;
}

/**
 * Badge visual do envio.
 * variante "pill"   → pílula completa para cards (padrão)
 * variante "inline" → texto puro para dentro de botões em lote
 */
export default function BadgeEnvio({ pedidoId, variante = "pill", statusPcp }) {
  const envio = useEnvioDistribuicao(pedidoId);
  if (!envio) return null;

  // Envio terminado mas OF ainda "pendente_distribuicao" = a gravação não
  // confirmou: não anunciar como enviada (o botão Distribuir continua válido).
  if (envio.fimTs && statusPcp === "pendente_distribuicao") return null;

  const emAndamento = !envio.fimTs;
  const pct = pctAnimado(envio.inicioTs, envio.fimTs);
  const decorridoSeg = ((envio.fimTs || Date.now()) - envio.inicioTs) / 1000;
  const enviadoHaSeg = envio.fimTs ? (Date.now() - envio.fimTs) / 1000 : 0;

  if (variante === "inline") {
    return (
      <span className="inline-flex items-center gap-1 font-mono">
        {emAndamento ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {pct}% · {formatSeg(decorridoSeg)}
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" />
            Enviado em {formatSeg(decorridoSeg)}
          </>
        )}
      </span>
    );
  }

  if (emAndamento) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-500/10 dark:bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap"
        title={`Enviando para as máquinas — ${pct}% (${formatSeg(decorridoSeg)} decorridos)`}
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Enviando p/ Máquinas {pct}%
        <span className="font-mono text-amber-600/80 dark:text-amber-400/80">{formatSeg(decorridoSeg)}</span>
        <span className="relative block w-10 h-1 rounded-full overflow-hidden bg-amber-200 dark:bg-amber-900/50">
          <span
            className="absolute inset-y-0 left-0 bg-amber-500 rounded-full transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/10 dark:bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
      title={`Enviado para as máquinas em ${formatSeg(decorridoSeg)} — há ${formatSeg(enviadoHaSeg)}`}
    >
      <Send className="w-3 h-3" />
      Enviado em {formatSeg(decorridoSeg)} · há {formatSeg(enviadoHaSeg)}
    </span>
  );
}