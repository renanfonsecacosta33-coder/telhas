import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, AlertTriangle } from "lucide-react";

/**
 * Red blocking modal shown when an operator tries to select a bobina
 * incompatible with the Odoo-required espessura or origem.
 */
export default function BloqueioBobinaDialog({ open, onOpenChange, titulo, motivos }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-2 border-red-500 bg-red-50 dark:bg-red-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300 text-lg">
            <ShieldAlert className="w-6 h-6" />
            ❌ OPERAÇÃO BLOQUEADA
          </DialogTitle>
          <DialogDescription className="text-red-600 dark:text-red-400 font-semibold">
            {titulo || "Espessura da bobina incompatível com o pedido Odoo!"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {(motivos || []).map((m, i) => (
            <div
              key={i}
              className="flex items-start gap-2 bg-white dark:bg-red-900/40 rounded-lg border border-red-300 dark:border-red-700 px-3 py-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-800 dark:text-red-200 font-medium">{m}</span>
            </div>
          ))}
          <p className="text-xs text-red-500 dark:text-red-400 mt-2 text-center">
            Selecione uma bobina compatível para iniciar a produção.
          </p>
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={() => onOpenChange?.(false)} className="w-full">
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}