import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, Timer, ShoppingCart, User, Layers, 
  CheckCircle2, ArrowRight, Disc, Flame
} from "lucide-react";
import { calcularMetrosPedido } from "@/lib/metrosHelper";

const MAQUINA_CORES = {
  "TP - 25": {
    badge: "bg-blue-600 text-white",
    cardBg: "bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-blue-950/30 dark:to-indigo-950/20",
    border: "border-blue-300 dark:border-blue-700/60",
    textAccent: "text-blue-700 dark:text-blue-400"
  },
  "TP - 40": {
    badge: "bg-emerald-600 text-white",
    cardBg: "bg-gradient-to-br from-emerald-50/80 to-teal-50/40 dark:from-emerald-950/30 dark:to-teal-950/20",
    border: "border-emerald-300 dark:border-emerald-700/60",
    textAccent: "text-emerald-700 dark:text-emerald-400"
  },
  "ONDULADA": {
    badge: "bg-purple-600 text-white",
    cardBg: "bg-gradient-to-br from-purple-50/80 to-fuchsia-50/40 dark:from-purple-950/30 dark:to-fuchsia-950/20",
    border: "border-purple-300 dark:border-purple-700/60",
    textAccent: "text-purple-700 dark:text-purple-400"
  },
  "COLONIAL": {
    badge: "bg-amber-600 text-white",
    cardBg: "bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20",
    border: "border-amber-300 dark:border-amber-700/60",
    textAccent: "text-amber-700 dark:text-amber-400"
  },
  "BANDEJA": {
    badge: "bg-pink-600 text-white",
    cardBg: "bg-gradient-to-br from-pink-50/80 to-rose-50/40 dark:from-pink-950/30 dark:to-rose-950/20",
    border: "border-pink-300 dark:border-pink-700/60",
    textAccent: "text-pink-700 dark:text-pink-400"
  },
  "DESBOBINADOR": {
    badge: "bg-yellow-600 text-white",
    cardBg: "bg-gradient-to-br from-yellow-50/80 to-amber-50/40 dark:from-yellow-950/30 dark:to-amber-950/20",
    border: "border-yellow-300 dark:border-yellow-700/60",
    textAccent: "text-yellow-700 dark:text-yellow-400"
  },
  "CUMEEIRA": {
    badge: "bg-teal-600 text-white",
    cardBg: "bg-gradient-to-br from-teal-50/80 to-cyan-50/40 dark:from-teal-950/30 dark:to-cyan-950/20",
    border: "border-teal-300 dark:border-teal-700/60",
    textAccent: "text-teal-700 dark:text-teal-400"
  },
  "COLAGEM": {
    badge: "bg-rose-600 text-white",
    cardBg: "bg-gradient-to-br from-rose-50/80 to-red-50/40 dark:from-rose-950/30 dark:to-red-950/20",
    border: "border-rose-300 dark:border-rose-700/60",
    textAccent: "text-rose-700 dark:text-rose-400"
  },
};

function formatTempoAoVivo(segundos) {
  const s = Math.max(0, Math.floor(segundos || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export default function PainelMaquinasAtivasAdmin({ pedidos = [], onAbrirOp, onFiltrarAguardando }) {
  const [agora, setAgora] = useState(() => Date.now());

  // Cronômetro em tempo real atualizando a cada 1 segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setAgora(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtra as ordens em produção ou pausadas nas máquinas de telhas
  const ordensAtivas = useMemo(() => {
    return (pedidos || []).filter(p => p.status === "em_producao" || p.status === "pausado");
  }, [pedidos]);

  const totalEmProducao = ordensAtivas.filter(p => p.status === "em_producao").length;
  const totalPausadas = ordensAtivas.filter(p => p.status === "pausado").length;

  // Estado vazio discreto e elegante
  if (ordensAtivas.length === 0) {
    return (
      <div className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span>Máquinas em Standby</span>
              <span className="text-xs font-normal text-muted-foreground">• Nenhuma perfiladeira produzindo agora</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Todas as máquinas estão livres aguardando o início das próximas ordens da fila.
            </p>
          </div>
        </div>
        {onFiltrarAguardando && (
          <Button
            variant="outline"
            size="sm"
            onClick={onFiltrarAguardando}
            className="gap-1.5 text-xs font-bold shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span>Ver Fila de Pedidos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-slate-900/90 border-2 border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
      {/* Cabeçalho do Painel */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">
                <span>Pedidos Sendo Feitos nas Máquinas Agora</span>
              </h2>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {totalEmProducao} {totalEmProducao === 1 ? "máquina rodando" : "máquinas rodando"} ao vivo
              {totalPausadas > 0 && ` • ${totalPausadas} em pausa`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-2.5 py-1 uppercase tracking-wider">
            ● Ao Vivo
          </Badge>
        </div>
      </div>

      {/* Grade de Cards das Máquinas Ativas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {ordensAtivas.map((p) => {
          const maquinaNome = p.maquina || "TP - 25";
          const estilo = MAQUINA_CORES[maquinaNome] || {
            badge: "bg-slate-700 text-white",
            cardBg: "bg-slate-50 dark:bg-slate-900/60",
            border: "border-slate-300 dark:border-slate-700",
            textAccent: "text-slate-700 dark:text-slate-300"
          };

          const isPausado = p.status === "pausado";

          // Cálculo do tempo decorrido ao vivo
          let tempoSeg = p.tempo_producao_seg || 0;
          if (!isPausado && p.inicio_producao_ts) {
            const ms = agora - new Date(p.inicio_producao_ts).getTime();
            if (ms > 0) tempoSeg += Math.floor(ms / 1000);
          }

          const metrosCalculados = calcularMetrosPedido(p);
          const metragemPlanejada = Number(p.metragem_planejada || p.metros_planejados || 0);
          const metrosExibicao = metragemPlanejada > 0 ? metragemPlanejada : metrosCalculados;

          return (
            <div
              key={p.id}
              onClick={() => onAbrirOp?.(p)}
              className={`rounded-xl border-2 ${estilo.border} ${estilo.cardBg} p-3.5 flex flex-col justify-between gap-2.5 hover:shadow-md hover:scale-[1.01] transition-all duration-200 cursor-pointer relative group`}
            >
              {/* Topo: Máquina + Badge de Status + Cronômetro */}
              <div className="flex items-center justify-between gap-1.5">
                <span className={`px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider shadow-2xs ${estilo.badge}`}>
                  {maquinaNome}
                </span>

                <div className="flex items-center gap-1.5">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold tabular-nums border shadow-2xs ${
                    isPausado 
                      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300" 
                      : "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                  }`}>
                    {isPausado ? <Pause className="w-3 h-3 text-amber-600" /> : <Timer className="w-3 h-3 text-emerald-600 animate-spin" style={{ animationDuration: "3s" }} />}
                    <span>{formatTempoAoVivo(tempoSeg)}</span>
                  </div>
                </div>
              </div>

              {/* Meio: Pedido + Cliente + Vendedor */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black font-mono bg-blue-600 text-white shadow-2xs">
                    <ShoppingCart className="w-3 h-3" />
                    {p.numero_pedido ? `#${p.numero_pedido}` : `OP #${String(p.id).slice(-6).toUpperCase()}`}
                  </span>
                  {p.numero_oc && (
                    <span className="text-[11px] font-bold text-muted-foreground font-mono">
                      (OC: {p.numero_oc})
                    </span>
                  )}
                </div>

                {p.cliente && (
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate uppercase flex items-center gap-1 mt-0.5">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{p.cliente}</span>
                  </p>
                )}

                {p.vendedor && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    Vendedor: <strong className="text-slate-700 dark:text-slate-300">{p.vendedor}</strong>
                  </p>
                )}
              </div>

              {/* Base: Produto + Metragem + Bobina */}
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-end justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    {p.item_produto || p.modelo || p.produto || "Telha"}
                  </p>
                  {p.bobina_superior && (
                    <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <Disc className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                      <span className="truncate">Bobina: {p.bobina_superior}</span>
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-baseline justify-end gap-0.5 leading-none">
                    <span className={`text-lg sm:text-xl font-black ${estilo.textAccent} leading-none`}>
                      {metrosExibicao.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(metrosExibicao) ? 0 : 1, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs font-bold text-slate-500">m</span>
                  </div>
                  {p.quantidade_telhas && Number(p.quantidade_telhas) !== metrosExibicao && (
                    <span className="text-[10px] text-muted-foreground font-semibold block mt-0.5">
                      {p.quantidade_telhas} {Number(p.quantidade_telhas) === 1 ? "telha" : "telhas"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
