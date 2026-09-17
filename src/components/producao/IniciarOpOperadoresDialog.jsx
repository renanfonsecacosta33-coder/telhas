import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, AlertTriangle, ShieldCheck, Play, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export function getMinimoOperadoresPorMaquina(maquinaNome = "") {
  const m = String(maquinaNome).toUpperCase();
  // Máquinas que exigem no mínimo 2 operadores:
  // Guilhotinas (Corte 3m, Corte 6m), Dobradeiras (Dobra 3m, Dobra 6m Fundo/Início) e Colagem
  if (
    m.includes("CORTE") ||
    m.includes("GUILHOTINA") ||
    m.includes("DOBRA") ||
    m.includes("COLAGEM")
  ) {
    return 2;
  }
  return 1;
}

export default function IniciarOpOperadoresDialog({
  open,
  onOpenChange,
  ordem,
  maquinaNome = "",
  onConfirm
}) {
  const [selecionados, setSelecionados] = useState([]);

  const minimoExigido = useMemo(() => {
    return getMinimoOperadoresPorMaquina(maquinaNome || ordem?.maquina || ordem?.maquina_inicial);
  }, [maquinaNome, ordem]);

  // Buscar equipe de operadores cadastrados
  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["equipe-operadores-dialog"],
    queryFn: async () => {
      try {
        const list = await base44.entities.User.list("-full_name", 100);
        return list;
      } catch {
        return [];
      }
    },
    enabled: open
  });

  // Resetar seleção ao abrir
  useEffect(() => {
    if (open) {
      // Se a ordem já tem operadores salvos previamente, inicia com eles
      try {
        if (Array.isArray(ordem?.operadores_json) && ordem.operadores_json.length > 0) {
          setSelecionados(ordem.operadores_json.map(o => o.id || o));
          return;
        }
      } catch {}
      setSelecionados([]);
    }
  }, [open, ordem]);

  const toggleUsuario = (u) => {
    setSelecionados(prev => {
      const exists = prev.some(id => id === u.id);
      if (exists) {
        return prev.filter(id => id !== u.id);
      } else {
        return [...prev, u.id];
      }
    });
  };

  const atendido = selecionados.length >= minimoExigido;

  const handleConfirmar = () => {
    if (!atendido) return;
    const listaFinal = usuarios
      .filter(u => selecionados.includes(u.id))
      .map(u => ({
        id: u.id,
        nome: u.full_name || u.email,
        role: u.role || "operador"
      }));

    onConfirm(listaFinal);
    onOpenChange(false);
  };

  const numeroPedidoLabel = ordem?.numero_pedido ? `#${ordem.numero_pedido}` : ordem?.id?.slice(-4);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Users className="w-5 h-5 text-primary" />
            Vincular Operadores da Máquina
          </DialogTitle>
          <DialogDescription className="text-xs">
            Selecione quem irá operar a máquina na ordem <strong>{numeroPedidoLabel}</strong> ({maquinaNome || "Máquina"}).
          </DialogDescription>
        </DialogHeader>

        {/* Aviso de Regra da Máquina */}
        <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
          minimoExigido >= 2
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200"
        }`}>
          {minimoExigido >= 2 ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div>
            <span className="font-bold block">
              {minimoExigido >= 2 ? "Exigência de 2 Operadores" : "Operador Individual ou Dupla"}
            </span>
            <p className="text-[11px] opacity-90 mt-0.5">
              {minimoExigido >= 2
                ? "Por norma de segurança e manuseio de peças pesadas/longas nesta máquina (Guilhotina / Dobradeira / Colagem), é obrigatório selecionar no mínimo 2 operadores."
                : "Nesta máquina (Desbobinadeira / Perfiladeira de Telha), a operação pode ser realizada por 1 operador ou mais."}
            </p>
          </div>
        </div>

        {/* Lista de Membros da Equipe */}
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold px-1">
            <span>Selecione os operadores ({selecionados.length}/{minimoExigido} mín):</span>
            {atendido ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Requisito atendido
              </span>
            ) : (
              <span className="text-rose-600 font-bold">
                Faltam {minimoExigido - selecionados.length} operador(es)
              </span>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
            {isLoading ? (
              <p className="text-xs text-center py-6 text-muted-foreground">Carregando equipe...</p>
            ) : usuarios.length === 0 ? (
              <p className="text-xs text-center py-6 text-muted-foreground">Nenhum operador cadastrado.</p>
            ) : (
              usuarios.map((u) => {
                const isChecked = selecionados.includes(u.id);
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUsuario(u)}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? "bg-primary/10 border-primary shadow-xs"
                        : "bg-card hover:bg-muted/40 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold text-xs text-foreground uppercase">
                        {(u.full_name || u.email || "OP").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {u.full_name || u.email}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {u.setor ? u.setor.replace("_", " ") : "Fábrica"} · {u.role || "operador"}
                        </p>
                      </div>
                    </div>

                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleUsuario(u)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmar}
            disabled={!atendido}
            className="gap-1.5 font-bold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Iniciar com {selecionados.length} Operador(es)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
