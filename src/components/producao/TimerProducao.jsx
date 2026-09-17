import React, { useState, useEffect, useMemo } from "react";
import { Clock, Play, Pause, CheckCircle, AlertTriangle, Flame, Timer, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatSegundos(totalSegundos) {
  if (isNaN(totalSegundos) || totalSegundos < 0) return "00:00:00";
  const h = Math.floor(totalSegundos / 3600);
  const m = Math.floor((totalSegundos % 3600) / 60);
  const s = Math.floor(totalSegundos % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function TimerProducao({
  ordem,
  maquinaNome,
  tipoSetor = "telhas",
  onPausar,
  onRetomar,
  onFinalizar,
}) {
  const [tempoDecorrido, setTempoDecorrido] = useState(0);

  const isEmProducao = ordem?.status === "em_producao";
  const isPausado = ordem?.status === "pausado";

  // Calcular segundos acumulados em tempo real
  useEffect(() => {
    if (!ordem) return;

    const baseSegundos = Number(ordem.tempo_producao_seg) || 0;
    const inicioTs = ordem.inicio_producao_ts ? new Date(ordem.inicio_producao_ts).getTime() : null;

    if (isEmProducao && inicioTs && !isNaN(inicioTs)) {
      const calcular = () => {
        const delta = Math.floor((Date.now() - inicioTs) / 1000);
        setTempoDecorrido(Math.max(0, baseSegundos + delta));
      };
      calcular();
      const interval = setInterval(calcular, 1000);
      return () => clearInterval(interval);
    } else {
      setTempoDecorrido(baseSegundos);
    }
  }, [ordem?.tempo_producao_seg, ordem?.inicio_producao_ts, isEmProducao, ordem?.id]);

  // Cálculo da Meta de Tempo Estimada (em segundos)
  const metaSegundos = useMemo(() => {
    if (!ordem) return 20 * 60; // 20 min padrão
    if (tipoSetor === "telhas") {
      const metros = Number(ordem.metros || ordem.quantidade_telhas || 50);
      // Média: ~1 minuto a cada 15 metros, mínimo 15 min, máx 2h
      const estMin = Math.max(15, Math.min(120, Math.round(metros / 15)));
      return estMin * 60;
    } else {
      // Corte e Dobra: ~1 minuto por peça/corte, mínimo 10 min
      const qtd = Number(ordem.quantidade || 10);
      const estMin = Math.max(10, Math.min(120, Math.round(qtd * 1.2)));
      return estMin * 60;
    }
  }, [ordem, tipoSetor]);

  if (!ordem || (!isEmProducao && !isPausado)) {
    return null;
  }

  const percentualMeta = metaSegundos > 0 ? Math.round((tempoDecorrido / metaSegundos) * 100) : 100;
  const isAcimaMeta = tempoDecorrido > metaSegundos;
  const isQuaseMeta = percentualMeta >= 85 && !isAcimaMeta;

  const ritmoStatus = isPausado
    ? { cor: "text-amber-500", label: "EM PAUSA", bg: "bg-amber-500/10 border-amber-500/30" }
    : isAcimaMeta
    ? { cor: "text-rose-500", label: "ACIMA DA META", bg: "bg-rose-500/10 border-rose-500/40 animate-pulse" }
    : isQuaseMeta
    ? { cor: "text-amber-400", label: "QUASE NA META", bg: "bg-amber-400/10 border-amber-400/30" }
    : { cor: "text-emerald-400", label: "RITMO EXCELENTE", bg: "bg-emerald-500/10 border-emerald-500/30" };

  const numeroPedidoLabel = ordem.numero_pedido ? `#${ordem.numero_pedido}` : ordem.id?.slice(-4);
  const produtoLabel = ordem.produto || ordem.tipo_peca || ordem.modelo || "Ordem de Produção";

  return (
    <div className="bg-slate-950 text-white border-2 border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Brilho superior temático */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 transition-colors ${
          isPausado ? "bg-amber-500" : isAcimaMeta ? "bg-rose-500" : "bg-emerald-500"
        }`}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Lado Esquerdo: Info da OP em andamento */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-[10px] font-black uppercase tracking-wider ${ritmoStatus.bg} ${ritmoStatus.cor}`}>
              <span className="w-2 h-2 rounded-full bg-current mr-1 animate-ping" />
              {ritmoStatus.label}
            </Badge>
            <span className="text-xs font-mono text-slate-400 font-semibold">
              {maquinaNome || "Máquina"}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
              Pedido {numeroPedidoLabel}
            </h3>
            <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
              {ordem.cliente}
            </span>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            {produtoLabel} {ordem.metros ? `· ${ordem.metros}m` : ordem.quantidade ? `· ${ordem.quantidade} peças` : ""}
          </p>
        </div>

        {/* Centro / Direita: Cronômetro Gigante */}
        <div className="flex items-center justify-between sm:justify-end gap-5">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 text-slate-400 text-[11px] font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Tempo de Produção</span>
            </div>

            <div className="font-mono text-3xl sm:text-4xl font-black tracking-wider text-white select-none drop-shadow-md">
              {formatSegundos(tempoDecorrido)}
            </div>

            <div className="flex items-center justify-end gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
              <span>Meta: ~{formatSegundos(metaSegundos)}</span>
              <span>·</span>
              <span className={isAcimaMeta ? "text-rose-400 font-bold" : "text-emerald-400"}>
                {percentualMeta}% da meta
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Progresso Visual de Tempo */}
      <div className="mt-3.5 pt-2 border-t border-slate-800/80">
        <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
          <span>Início de ciclo</span>
          <span>{isAcimaMeta ? `+${formatSegundos(tempoDecorrido - metaSegundos)} acima da meta` : "Meta de ciclo"}</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isPausado ? "bg-amber-500" : isAcimaMeta ? "bg-rose-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(100, percentualMeta)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
