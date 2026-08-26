import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Star, Unlock, X } from "lucide-react";
import { validarSenhaGestor } from "@/lib/regrasFabrica";

// Dialog de validação de Senha do Gestor (PIN 0000) para liberar alteração de prioridade.
// onAutorizado callback disparado somente se o PIN estiver correto.
export default function SenhaGestorDialog({ open, onOpenChange, onAutorizado, titulo = "Autorização de Gestor", descricao }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState(false);
  const [tentou, setTentou] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (open) {
      setPin("");
      setErro(false);
      setTentou(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const handleConfirmar = () => {
    setTentou(true);
    if (validarSenhaGestor(pin)) {
      onOpenChange(false);
      onAutorizado?.();
    } else {
      setErro(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
            {titulo}
          </DialogTitle>
          <DialogDescription>
            {descricao || "Digite o PIN de liberação do PCP/Gestor para alterar a prioridade deste pedido para Prioridade Alta / Urgente."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
            <Star className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              Marcar como Prioridade Alta exige autorização.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">PIN do Gestor (4 dígitos)</label>
            <Input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                if (erro) setErro(false);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirmar(); }}
              placeholder="••••"
              className={`text-center text-2xl tracking-[0.5em] font-bold h-14 ${erro ? "border-red-500 focus-visible:ring-red-500" : "border-amber-400 focus-visible:ring-amber-500"}`}
            />
            {tentou && erro && (
              <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                <X className="w-3 h-3" /> PIN incorreto. Alteração de prioridade bloqueada.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirmar}
            disabled={pin.length < 4}
            className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
          >
            <Unlock className="w-4 h-4" /> Autorizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}