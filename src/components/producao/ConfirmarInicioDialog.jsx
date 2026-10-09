import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Play, Pause } from "lucide-react";
import { PrioridadeBadge } from "@/lib/prioridadeHelper";

export default function ConfirmarInicioDialog({
  open,
  onClose,
  pedido,
  pedidoRodando,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Trocar OP em Produção
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-1 text-xs">
            <p className="font-semibold text-amber-800 flex items-center gap-1.5">
              <Pause className="w-3.5 h-3.5 text-amber-600" /> OP atualmente em produção (será pausada):
            </p>
            <p className="text-amber-700">
              {pedidoRodando?.produto} — {pedidoRodando?.cliente || "sem cliente"}
              {pedidoRodando?.numero_pedido ? ` (#${pedidoRodando.numero_pedido})` : ""}
            </p>
          </div>

          <div className="bg-slate-50 border border-border rounded-lg px-4 py-3 space-y-1 text-xs">
            <p className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-emerald-600" /> Nova OP a iniciar agora:
            </p>
            <p className="text-slate-600 font-medium">
              {pedido?.produto} — {pedido?.cliente || "sem cliente"}
              {pedido?.numero_pedido ? ` (#${pedido.numero_pedido})` : ""}
            </p>
            <div className="flex gap-2 mt-1">
              <PrioridadeBadge pedido={pedido} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Ao confirmar, a OP anterior será pausada automaticamente e a nova OP iniciará a contagem de tempo imediatamente.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => onConfirm()}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Pausar Anterior e Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}