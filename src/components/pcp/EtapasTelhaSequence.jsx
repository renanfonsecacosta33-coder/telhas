import React, { useState } from "react";
import { Scissors, Link2, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import {
  getEtapasTelhaState, persistirEtapasTelha, notificarStatus
} from "@/lib/biNotificador";

/**
 * Sequência de etapas das Telhas no card do Galpão:
 *  Perfiladeira → Corte → Colagem → Embalagem
 * Botões especiais: "✂️ Registrar Corte — Agora" e "🔗 Registrar Colagem — Agora"
 * gravam a hora exata (now) e disparam evento BI etapa_corte / etapa_colagem.
 */
export default function EtapasTelhaSequence({ pedido, operadorNome = "", onAtualizado }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const etapas = getEtapasTelhaState(pedido);

  const nomeOperador = async () => {
    if (operadorNome) return operadorNome;
    try { const me = await base44.auth.me(); return me?.email || ""; } catch { return ""; }
  };

  const registrarEtapa = async (nomeEtapa, eventoBi, icon) => {
    setBusy(true);
    try {
      const op = await nomeOperador();
      const now = new Date().toISOString();
      const novoArr = etapas.map((e) =>
        e.nome === nomeEtapa ? { ...e, status: "concluido", hora_ts: now } : e
      );
      const upd = await persistirEtapasTelha(pedido, novoArr);
      onAtualizado?.(upd);
      await notificarStatus(upd, eventoBi, {
        operador: op,
        hora_corte: nomeEtapa === "Corte" ? now : "",
        hora_colagem: nomeEtapa === "Colagem" ? now : ""
      });
      // Se todas concluídas → concluido
      if (novoArr.every((e) => e.status === "concluido")) {
        const finalizado = await base44.entities.PedidoOdoo.update(pedido.id, {
          status_pcp: "concluido", percentual_concluido: 100
        });
        onAtualizado?.(finalizado);
        await notificarStatus(finalizado, "concluido", { status_novo: "concluido" });
      }
      toast({
        title: `${icon} ${nomeEtapa} registrada`,
        description: `#${pedido.numero_pedido} — ${new Date().toLocaleTimeString("pt-BR")}.`,
        className: "border-orange-500/40"
      });
    } catch (e) {
      toast({ title: `Erro ao registrar ${nomeEtapa}`, description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const iconFor = (e) => {
    if (e.status === "concluido") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (e.status === "em_andamento") return <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin" />;
    return <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />;
  };

  const corte = etapas.find((e) => e.nome === "Corte");
  const colagem = etapas.find((e) => e.nome === "Colagem");

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 p-2.5 space-y-2">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-orange-700 dark:text-orange-300">
        🏭 Rastreamento Telhas por Etapa
      </p>

      {/* Sequência em linha */}
      <div className="flex items-center gap-0.5 flex-wrap">
        {etapas.map((e, idx) => (
          <React.Fragment key={e.nome}>
            <div className="flex items-center gap-1">
              {iconFor(e)}
              <span className={`text-[10px] font-bold ${
                e.status === "concluido" ? "text-emerald-600 dark:text-emerald-400 line-through" :
                "text-slate-400 dark:text-slate-500"
              }`}>
                {e.nome}
              </span>
              {e.status === "concluido" && e.hora_ts && (
                <span className="text-[8px] font-mono text-slate-400">
                  {new Date(e.hora_ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            {idx < etapas.length - 1 && (
              <span className="text-slate-300 dark:text-slate-600 text-[10px] mx-0.5">→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Botões especiais de Corte e Colagem */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          disabled={busy || corte?.status === "concluido"}
          onClick={() => registrarEtapa("Corte", "etapa_corte", "✂️")}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          <Scissors className="w-3.5 h-3.5" />
          {corte?.status === "concluido" ? "Corte OK" : "Registrar Corte"}
        </button>
        <button
          type="button"
          disabled={busy || colagem?.status === "concluido"}
          onClick={() => registrarEtapa("Colagem", "etapa_colagem", "🔗")}
          className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 transition-colors"
        >
          <Link2 className="w-3.5 h-3.5" />
          {colagem?.status === "concluido" ? "Colagem OK" : "Registrar Colagem"}
        </button>
      </div>
    </div>
  );
}