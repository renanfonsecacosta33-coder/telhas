import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Route, Star } from "lucide-react";

export default function ConfirmarInicioDialog({
  open,
  onClose,
  pedido,
  pedidoRodando,
  isRotaOuPrioridade,
  onConfirm,
}) {
  const [motivo, setMotivo] = useState("");

  const handleClose = () => {
    setMotivo("");
    onClose();
  };

  const handleConfirm = () => {
    if (!isRotaOuPrioridade && !motivo.trim()) return;
    onConfirm(motivo.trim());
    setMotivo("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Já existe OP em produção
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-amber-800">OP rodando agora:</p>
            <p className="text-xs text-amber-700">
              {pedidoRodando?.produto} — {pedidoRodando?.cliente || "sem cliente"}
              {pedidoRodando?.numero_pedido ? ` (#${pedidoRodando.numero_pedido})` : ""}
            </p>
          </div>

          <div className="bg-slate-50 border border-border rounded-lg px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-slate-700">OP que deseja iniciar:</p>
            <p className="text-xs text-slate-600">
              {pedido?.produto} — {pedido?.cliente || "sem cliente"}
              {pedido?.numero_pedido ? ` (#${pedido.numero_pedido})` : ""}
            </p>
            <div className="flex gap-2 mt-1">
              {pedido?.rota && (
                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  <Route className="w-3 h-3" /> Rota
                </span>
              )}
              {pedido?.prioridade && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  <Star className="w-3 h-3" /> Prioridade
                </span>
              )}
              {!pedido?.rota && !pedido?.prioridade && (
                <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
                  Sem prioridade / rota
                </span>
              )}
            </div>
          </div>

          {isRotaOuPrioridade ? (
            <p className="text-sm text-muted-foreground">
              Este pedido é de <strong>{pedido?.rota ? "rota" : "prioridade"}</strong>. Você pode iniciar,
              mas o encarregado será notificado.
            </p>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-red-700">
                Motivo (obrigatório) — por que precisa iniciar este pedido fora da rota/prioridade?
              </Label>
              <Textarea
                placeholder="Ex: cliente ligou cobrando, material precisa ser liberado, etc..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="h-24"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                O encarregado precisa aprovar esta solicitação antes de você poder iniciar.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={!isRotaOuPrioridade && !motivo.trim()}
            className="gap-1 bg-amber-500 hover:bg-amber-600 text-white"
          >
            {isRotaOuPrioridade ? "Sim, iniciar e notificar" : "Enviar para aprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}