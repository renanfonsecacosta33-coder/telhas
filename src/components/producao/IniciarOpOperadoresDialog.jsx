import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCheck, Check, User } from "lucide-react";

export default function IniciarOpOperadoresDialog({
  open,
  onOpenChange,
  ordem,
  maquinaNome = "",
  titulo = "",
  descricao = "",
  modoTroca = false,
  onConfirm
}) {
  const [nomeOperador, setNomeOperador] = useState("");
  const inputRef = useRef(null);

  const maquinaAlvo = maquinaNome || ordem?.maquina || ordem?.maquina_inicial || "";

  useEffect(() => {
    if (open) {
      // Pega o operador atribuído especificamente a esta ordem
      const opAtual = ordem?.operador || ordem?.operador_inicio || "";
      setNomeOperador(opAtual);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
    }
  }, [open, maquinaAlvo, ordem]);

  const handleConfirmar = (e) => {
    if (e) e.preventDefault();
    const nomeLimpo = nomeOperador.trim();
    if (!nomeLimpo) return;

    const lista = [{
      id: `op_${Date.now()}`,
      nome: nomeLimpo,
      role: "operador"
    }];

    onConfirm(lista);
    onOpenChange(false);
  };

  const numeroPedidoLabel = ordem?.numero_pedido ? `#${ordem.numero_pedido}` : (ordem?.id ? `#${String(ordem.id).slice(-4)}` : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-sans p-5 sm:p-6 rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground">
            <UserCheck className="w-5 h-5 text-primary" />
            {titulo || (modoTroca ? "Trocar Operador do Pedido" : "Identificar Operador")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {descricao || (
              <>
                Informe quem é o operador responsável por produzir o pedido <strong>{numeroPedidoLabel || "atual"}</strong> na <strong>{maquinaAlvo || "Máquina"}</strong>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirmar} className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" />
              Nome do Operador:
            </label>
            <Input
              ref={inputRef}
              type="text"
              autoFocus
              placeholder="Digite o nome do operador (Ex: Raul, Lucas)..."
              value={nomeOperador}
              onChange={(e) => setNomeOperador(e.target.value)}
              className="h-12 text-base font-bold px-3.5 rounded-xl border-2 focus-visible:ring-primary shadow-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              O operador será vinculado <strong>pontualmente a este pedido</strong>. Pressione <strong>Enter</strong> para confirmar.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 pt-2 border-t border-border flex flex-row items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => onOpenChange(false)}
              className="h-11 px-4 font-semibold text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!nomeOperador.trim()}
              className="h-11 px-5 font-bold text-xs sm:text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              {modoTroca ? "Salvar Operador" : "Confirmar e Iniciar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
