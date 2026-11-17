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
import { Users, Zap, UserCheck, Play, User } from "lucide-react";

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
  const [ultimoOperador, setUltimoOperador] = useState(null);
  const inputRef = useRef(null);

  const maquinaAlvo = maquinaNome || ordem?.maquina || ordem?.maquina_inicial || "";
  const storageKey = `ultimo_operador_${String(maquinaAlvo).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

  // Carregar último operador memorizado nesta máquina e preencher nome existente
  useEffect(() => {
    if (open) {
      try {
        const salvo = localStorage.getItem(storageKey);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          if (parsed && (parsed.nome || parsed.id)) {
            setUltimoOperador(parsed);
          }
        }
      } catch {}

      // Se a ordem já tem operador definido, inicializa com o nome atual
      const opExistente = ordem?.operador || ordem?.operador_inicio || "";
      setNomeOperador(opExistente);

      // Foca automaticamente no campo de texto para agilidade máxima
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [open, storageKey, ordem]);

  const salvarUltimoOperadorMemoria = (listaFinal) => {
    try {
      if (listaFinal && listaFinal.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(listaFinal[0]));
      }
    } catch {}
  };

  const confirmarLista = (listaFinal) => {
    salvarUltimoOperadorMemoria(listaFinal);
    onConfirm(listaFinal);
    onOpenChange(false);
  };

  const handleConfirmar = (e) => {
    if (e) e.preventDefault();
    const nomeLimpo = nomeOperador.trim();
    if (!nomeLimpo) return;
    const lista = [{
      id: `op_${Date.now()}`,
      nome: nomeLimpo,
      role: "operador"
    }];
    confirmarLista(lista);
  };

  const handleUsarUltimo = () => {
    if (!ultimoOperador?.nome) return;
    confirmarLista([ultimoOperador]);
  };

  const numeroPedidoLabel = ordem?.numero_pedido ? `#${ordem.numero_pedido}` : (ordem?.id ? `#${String(ordem.id).slice(-4)}` : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-sans p-5 sm:p-6 rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-foreground">
            <Users className="w-5 h-5 text-primary" />
            {titulo || (modoTroca ? "Identificar Operador Responsável" : "Quem está operando esta máquina agora?")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {descricao || (
              <>
                Identifique o operador responsável na ordem <strong>{numeroPedidoLabel}</strong> ({maquinaNome || "Máquina"}).
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirmar} className="space-y-4 py-2">
          {/* Atalho de 1 Toque: Último Operador Memorizado neste Tablet/Máquina */}
          {ultimoOperador?.nome && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 block">
                    Último Operador Desta Máquina
                  </span>
                  <span className="text-sm font-black text-emerald-950 dark:text-emerald-100 truncate block">
                    {ultimoOperador.nome}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleUsarUltimo}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3.5 shrink-0 shadow-xs cursor-pointer gap-1.5"
              >
                <UserCheck className="w-4 h-4" /> Usar (1 Toque)
              </Button>
            </div>
          )}

          {/* Campo de Digitação Direta do Nome do Operador */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" />
              Digite o nome do operador:
            </label>
            <Input
              ref={inputRef}
              type="text"
              autoFocus
              placeholder="Ex: Carlos, Raul, Lucas..."
              value={nomeOperador}
              onChange={(e) => setNomeOperador(e.target.value)}
              className="h-12 text-sm sm:text-base font-semibold px-3.5 rounded-xl border-2 focus-visible:ring-primary shadow-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Toque no campo para digitar no teclado do tablet ou pressione <strong>Enter</strong> para confirmar.
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
              className="h-11 px-5 font-bold text-xs sm:text-sm gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {modoTroca ? "Salvar Operador" : "Confirmar e Iniciar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
