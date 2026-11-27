import React from "react";
import { X, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import RotaEntregaCard from "@/components/logistica/RotaEntregaCard";

/**
 * Modo Pátio — visão de tela cheia com as rotas do dia,
 * pensada para uso no galpão durante o carregamento.
 */
export default function ModoPatioRotas({ aberto, onClose, rotas = [], tituloDia = "" }) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/97 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap text-white">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight">Modo Pátio</h2>
              <p className="text-xs text-slate-400 capitalize">
                {tituloDia} · {rotas.length} {rotas.length === 1 ? "rota" : "rotas"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            className="gap-1.5 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-4 h-4" /> Sair do pátio
          </Button>
        </div>

        {rotas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 p-10 text-center space-y-1">
            <p className="text-sm font-bold text-slate-200">Nenhuma rota para este dia</p>
            <p className="text-xs text-slate-500">Escolha outro dia na faixa de navegação.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rotas.map((rota) => (
              <RotaEntregaCard key={rota.id} rota={rota} inicialAberto={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}