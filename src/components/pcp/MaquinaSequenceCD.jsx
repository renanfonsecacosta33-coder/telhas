import React, { useState } from "react";
import { CheckCircle2, Loader2, Circle, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import {
  getMaquinasState, maquinaAtual, persistirMaquinas, notificarStatus
} from "@/lib/biNotificador";

/**
 * Sequência de máquinas C&D no card do Galpão:
 *  ✅ Guilhotina → 🔄 Dobradeira → ⬜ Puncionadeira → ⬜ Acabamento
 * Botões: "▶️ Iniciar em [Máquina]" (pendente) e "✅ Concluir [Atual]" (em andamento).
 */
export default function MaquinaSequenceCD({ pedido, operadorNome = "", onAtualizado }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const maquinas = getMaquinasState(pedido);
  const atual = maquinaAtual(maquinas);
  const todasConcluidas = maquinas.every((m) => m.status === "concluido");

  const nomeOperador = async () => {
    if (operadorNome) return operadorNome;
    try { const me = await base44.auth.me(); return me?.email || ""; } catch { return ""; }
  };

  const handleIniciar = async (nomeMaquina) => {
    setBusy(true);
    try {
      const op = await nomeOperador();
      const now = new Date().toISOString();
      const novoArr = maquinas.map((m) => {
        if (m.nome === nomeMaquina) return { ...m, status: "em_andamento", operador: op, inicio_ts: now, fim_ts: "" };
        return m;
      });
      const haviaAtual = !!atual;
      const maquinaAnterior = atual?.nome || "";
      // se havia máquina em andamento, conclui ela automaticamente
      if (haviaAtual) {
        const idx = novoArr.findIndex((m) => m.nome === maquinaAnterior);
        if (idx >= 0) novoArr[idx] = { ...novoArr[idx], status: "concluido", fim_ts: now };
      }
      const upd = await persistirMaquinas(pedido, novoArr);
      onAtualizado?.(upd);
      await notificarStatus(upd, haviaAtual ? "maquina_troca" : "maquina_inicio", {
        operador: op, maquina_atual: nomeMaquina, maquina_anterior: maquinaAnterior
      });
      toast({
        title: `▶️ ${nomeMaquina} iniciada`,
        description: `#${pedido.numero_pedido} — máquina em andamento.`,
        className: "border-indigo-500/40"
      });
    } catch (e) {
      toast({ title: "Erro ao iniciar máquina", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const handleConcluir = async () => {
    if (!atual) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const novoArr = maquinas.map((m) =>
        m.nome === atual.nome ? { ...m, status: "concluido", fim_ts: now } : m
      );
      const upd = await persistirMaquinas(pedido, novoArr);
      onAtualizado?.(upd);
      await notificarStatus(upd, "maquina_fim", { operador: atual.operador, maquina_atual: atual.nome });

      // Se todas concluídas → evento concluido + status_pcp
      if (novoArr.every((m) => m.status === "concluido")) {
        const finalizado = await base44.entities.PedidoOdoo.update(pedido.id, {
          status_pcp: "concluido", percentual_concluido: 100
        });
        onAtualizado?.(finalizado);
        await notificarStatus(finalizado, "concluido", { status_novo: "concluido" });
        toast({
          title: "✅ Pedido concluído!",
          description: `#${pedido.numero_pedido} — todas as máquinas finalizadas.`,
          className: "border-emerald-500/40"
        });
      } else {
        toast({
          title: `✅ ${atual.nome} concluída`,
          description: `#${pedido.numero_pedido} — próxima máquina liberada.`,
          className: "border-emerald-500/40"
        });
      }
    } catch (e) {
      toast({ title: "Erro ao concluir máquina", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const iconFor = (m) => {
    if (m.status === "concluido") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (m.status === "em_andamento") return <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />;
    return <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />;
  };

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 space-y-2">
      <p className="text-[9px] font-extrabold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
        🔧 Rastreamento C&D por Máquina
      </p>

      {/* Sequência em linha */}
      <div className="flex items-center gap-0.5 flex-wrap">
        {maquinas.map((m, idx) => (
          <React.Fragment key={m.nome}>
            <div className="flex items-center gap-1">
              {iconFor(m)}
              <span className={`text-[10px] font-bold ${
                m.status === "concluido" ? "text-emerald-600 dark:text-emerald-400 line-through" :
                m.status === "em_andamento" ? "text-indigo-600 dark:text-indigo-300" :
                "text-slate-400 dark:text-slate-500"
              }`}>
                {m.nome}
              </span>
            </div>
            {idx < maquinas.length - 1 && (
              <span className="text-slate-300 dark:text-slate-600 text-[10px] mx-0.5">→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Botões de ação */}
      {!todasConcluidas && (
        <div className="flex flex-col gap-1.5">
          {atual ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleConcluir}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Concluir {atual.nome}
            </button>
          ) : (
            maquinas.filter((m) => m.status === "pendente").map((m) => (
              <button
                key={m.nome}
                type="button"
                disabled={busy}
                onClick={() => handleIniciar(m.nome)}
                className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Iniciar em {m.nome}
              </button>
            ))
          )}
        </div>
      )}

      {todasConcluidas && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> Todas as máquinas concluídas
        </div>
      )}
    </div>
  );
}