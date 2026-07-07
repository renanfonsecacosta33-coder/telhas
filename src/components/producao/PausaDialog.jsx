import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pause, Settings, Wrench, PackageX, Boxes, Coffee, MoreHorizontal } from "lucide-react";

const MOTIVOS = [
  { value: "Setup de Máquina", icon: Settings, color: "text-blue-600 bg-blue-50 border-blue-300" },
  { value: "Manutenção", icon: Wrench, color: "text-orange-600 bg-orange-50 border-orange-300" },
  { value: "Falta de Aço/Bobina", icon: PackageX, color: "text-red-600 bg-red-50 border-red-300" },
  { value: "Falta de EPS/Isopor", icon: Boxes, color: "text-amber-600 bg-amber-50 border-amber-300" },
  { value: "Intervalo/Almoço", icon: Coffee, color: "text-purple-600 bg-purple-50 border-purple-300" },
  { value: "Outros", icon: MoreHorizontal, color: "text-gray-600 bg-gray-50 border-gray-300" },
];

export default function PausaDialog({ open, pedido, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState("");
  const [outroMotivo, setOutroMotivo] = useState("");

  const handleClose = () => {
    setMotivo("");
    setOutroMotivo("");
    onCancel();
  };

  const handleConfirm = () => {
    const motivoFinal = motivo === "Outros" ? (outroMotivo.trim() || "Outros") : motivo;
    onConfirm(motivoFinal);
    setMotivo("");
    setOutroMotivo("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="w-5 h-5 text-orange-600" />
            Pausar Produção
          </DialogTitle>
          <DialogDescription>
            {pedido?.produto} — {pedido?.cliente || "Sem cliente"}
            {pedido?.numero_pedido && ` · Pedido #${pedido.numero_pedido}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {MOTIVOS.map((m) => {
            const Icon = m.icon;
            const selected = motivo === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setMotivo(m.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                  selected
                    ? `${m.color} ring-2 ring-offset-1 ring-current`
                    : "border-border hover:bg-muted/50 text-foreground"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="leading-tight">{m.value}</span>
              </button>
            );
          })}
        </div>

        {motivo === "Outros" && (
          <input
            type="text"
            value={outroMotivo}
            onChange={(e) => setOutroMotivo(e.target.value)}
            placeholder="Descreva o motivo da pausa..."
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={!motivo}
            onClick={handleConfirm}
            className="gap-1"
          >
            <Pause className="w-4 h-4" />
            Confirmar Pausa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}