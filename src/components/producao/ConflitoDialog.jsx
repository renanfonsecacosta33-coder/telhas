import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Pause } from "lucide-react";

export default function ConflitoDialog({ open, conflitante, onConfirm, onCancel }) {
  if (!conflitante) return null;
  const isPausado = conflitante.status === "pausado";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
            ⚠️ Pedido em Andamento
          </DialogTitle>
          <DialogDescription>
            Já existe um pedido {isPausado ? "pausado" : "em produção"} nesta máquina.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            {isPausado ? (
              <Pause className="w-4 h-4 text-orange-600" />
            ) : (
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            )}
            <span className="text-sm font-bold text-orange-800">
              {isPausado ? "Pausado" : "Em Produção"}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Produto:</span> <span className="font-semibold">{conflitante.produto}</span></p>
            <p><span className="text-muted-foreground">Cliente:</span> <span className="font-semibold">{conflitante.cliente || "—"}</span></p>
            {conflitante.numero_pedido && (
              <p><span className="text-muted-foreground">Pedido:</span> #{conflitante.numero_pedido}</p>
            )}
            {conflitante.metros > 0 && (
              <p><span className="text-muted-foreground">Metros:</span> {conflitante.metros}m</p>
            )}
            {isPausado && conflitante.motivo_pausa && (
              <p><span className="text-muted-foreground">Motivo da pausa:</span> {conflitante.motivo_pausa}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant="default" onClick={onConfirm} className="gap-1">
            <Clock className="w-4 h-4" />
            Iniciar mesmo assim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}