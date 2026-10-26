import React, { useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle, BellRing, CheckCircle2, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Toca um sinal sonoro de alerta no tablet/PC do operador
 * usando a Web Audio API (sem dependência de arquivos de áudio externos).
 */
function tocarAlertaSonoroOperador() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // Lá (A5)
    osc1.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35); // Queda de tom urgente

    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);

    // Segundo beep 150ms depois
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sawtooth";
        osc2.frequency.setValueAtTime(880, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.35);
      } catch {}
    }, 200);
  } catch (e) {
    console.warn("[Alerta Sonoro] Falha ao reproduzir áudio:", e);
  }
}

const STORAGE_CIENTES_KEY = "ajl_alertas_cancelamento_cientes_v1";

export default function AlertaCancelamentoPcpBanner({ ordens = [], maquinaNome = "" }) {
  const [cientes, setCientes] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CIENTES_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const somTocadoRef = useRef(new Set());

  // Detecta alertas ativos não dispensados
  const alertasAtivos = useMemo(() => {
    const list = [];
    (ordens || []).forEach((op) => {
      if (!op || !op.alerta_cancelamento_pcp) return;
      let alerta = null;
      try {
        alerta = typeof op.alerta_cancelamento_pcp === "string"
          ? JSON.parse(op.alerta_cancelamento_pcp)
          : op.alerta_cancelamento_pcp;
      } catch {}

      if (alerta && alerta.ativo) {
        const alertaId = `${op.id}_${alerta.data || op.updated_date || "canc"}`;
        if (!cientes.has(alertaId)) {
          list.push({
            alertaId,
            ordemId: op.id,
            numeroPedido: alerta.numero_pedido || op.numero_pedido || "S/N",
            cliente: alerta.cliente || op.cliente || op.cliente_nome || "Cliente",
            produto: alerta.produto || op.produto || "Telha / Perfil",
            motivo: alerta.motivo || "Cancelado pelo PCP",
            usuario: alerta.usuario || "PCP",
            data: alerta.data || op.updated_date,
            maquina: alerta.maquina || op.maquina || maquinaNome,
          });
        }
      }
    });

    return list;
  }, [ordens, cientes, maquinaNome]);

  // Dispara o alerta sonoro quando um novo alerta surgir
  useEffect(() => {
    alertasAtivos.forEach((alerta) => {
      if (!somTocadoRef.current.has(alerta.alertaId)) {
        somTocadoRef.current.add(alerta.alertaId);
        tocarAlertaSonoroOperador();
      }
    });
  }, [alertasAtivos]);

  const handleMarcarCiente = (alertaId) => {
    setCientes((prev) => {
      const next = new Set(prev);
      next.add(alertaId);
      try {
        localStorage.setItem(STORAGE_CIENTES_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleMarcarTodosCientes = () => {
    setCientes((prev) => {
      const next = new Set(prev);
      alertasAtivos.forEach((a) => next.add(a.alertaId));
      try {
        localStorage.setItem(STORAGE_CIENTES_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  if (alertasAtivos.length === 0) return null;

  return (
    <div className="mb-4 space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
      {alertasAtivos.map((alerta) => (
        <div
          key={alerta.alertaId}
          className="bg-red-600 text-white border-2 border-red-700 rounded-2xl p-4 shadow-xl shadow-red-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden"
        >
          {/* Fundo com efeito de alerta de fábrica */}
          <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
            <ShieldAlert className="w-40 h-40" />
          </div>

          <div className="flex items-start gap-3 min-w-0 z-10">
            <div className="w-11 h-11 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 animate-bounce">
              <BellRing className="w-6 h-6 text-white" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-white text-red-700 border-none font-black text-xs px-2 py-0.5">
                  🚨 CANCELADO PELO PCP
                </Badge>
                <span className="font-mono font-black text-base tracking-wide">
                  Pedido #{alerta.numeroPedido}
                </span>
                <span className="text-red-100 text-xs font-semibold">
                  ({alerta.cliente})
                </span>
              </div>

              <p className="text-sm font-bold text-white mt-1">
                Interromper imediatamente: <span className="underline">{alerta.produto}</span>
              </p>

              <div className="mt-1.5 inline-flex items-center gap-1.5 bg-black/25 px-2.5 py-1 rounded-lg text-xs text-red-50 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>
                  <strong>Motivo:</strong> {alerta.motivo}
                </span>
                <span className="opacity-70 text-[10px] ml-1">• por {alerta.usuario}</span>
              </div>
            </div>
          </div>

          {/* Botão Ciente */}
          <div className="z-10 w-full sm:w-auto flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/20">
            <Button
              type="button"
              onClick={() => handleMarcarCiente(alerta.alertaId)}
              className="w-full sm:w-auto bg-white hover:bg-slate-100 text-red-700 font-black text-xs h-10 px-5 gap-2 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>CIENTE / ENTENDIDO</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
