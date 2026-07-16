import React from "react";
import { Play, Pause, CheckCircle2, AlertOctagon, Maximize2 } from "lucide-react";

/**
 * Barra de ações rápidas inferiores — botões gigantes touch-friendly.
 * As cores seguem o design de referência (SAP POD).
 */
export default function ActionBar({ ordem, onIniciar, onPausar, onConcluir, onSucata, onAmpliarFoto, isGestor }) {
  if (!ordem) {
    return (
      <div className="bg-slate-50 border-t border-border rounded-b-xl px-4 py-3 text-center text-sm text-muted-foreground">
        Selecione uma OP na lista à esquerda
      </div>
    );
  }

  const status = ordem.status;
  const podeIniciar = status === "pendente";
  const podePausar = status === "em_producao";
  const podeConcluir = status === "em_producao" || status === "pausado";
  const podeRetomar = status === "pausado";

  return (
    <div className="bg-white border-t-2 border-slate-200 px-3 py-3 flex items-center gap-2 flex-wrap">
      {podeIniciar && (
        <button
          onClick={onIniciar}
          className="flex-1 min-w-[120px] h-14 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm gap-2 flex items-center justify-center transition-colors shadow-sm active:scale-95"
        >
          <Play className="w-5 h-5" /> INICIAR
        </button>
      )}
      {podeRetomar && (
        <button
          onClick={onIniciar}
          className="flex-1 min-w-[120px] h-14 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm gap-2 flex items-center justify-center transition-colors shadow-sm active:scale-95"
        >
          <Play className="w-5 h-5" /> RETOMAR
        </button>
      )}
      {podePausar && (
        <button
          onClick={onPausar}
          className="flex-1 min-w-[120px] h-14 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm gap-2 flex items-center justify-center transition-colors shadow-sm active:scale-95"
        >
          <Pause className="w-5 h-5" /> PAUSAR
        </button>
      )}
      {podeConcluir && (
        <button
          onClick={onConcluir}
          className="flex-1 min-w-[120px] h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm gap-2 flex items-center justify-center transition-colors shadow-sm active:scale-95"
        >
          <CheckCircle2 className="w-5 h-5" /> CONCLUIR
        </button>
      )}
      <button
        onClick={onSucata}
        className="flex-1 min-w-[120px] h-14 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm gap-2 flex items-center justify-center transition-colors shadow-sm active:scale-95"
      >
        <AlertOctagon className="w-5 h-5" /> PARAR / SUCATA
      </button>
      <button
        onClick={onAmpliarFoto}
        className="flex-1 min-w-[120px] h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm gap-2 flex items-center justify-center transition-colors shadow-sm active:scale-95"
      >
        <Maximize2 className="w-5 h-5" /> AMPLIAR FOTO
      </button>
    </div>
  );
}