import React from "react";
import { Zap, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription,
  AlertDialogAction, AlertDialogCancel
} from "@/components/ui/alert-dialog";

// Finalização rápida de um item do pedido Odoo diretamente na Fila PCP.
// Marcado como concluído sem passar pelo fluxo das máquinas — somente administradores.
export default function FinalizarItemRapidoButton({ onFinalizar, carregando = false, className = "" }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={carregando}
          className={`h-8 px-3 gap-1.5 text-xs font-bold border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 ${className}`}
          title="Finalizar item rapidamente (somente administradores)"
        >
          {carregando ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          Finalizar Item
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar este item?</AlertDialogTitle>
          <AlertDialogDescription>
            O item será marcado como <strong>concluído</strong> imediatamente, sem passar pelo fluxo das máquinas.
            Use apenas quando a peça já foi produzida ou entregue fora do sistema.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onFinalizar}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Finalizar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}