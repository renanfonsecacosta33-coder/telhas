import React, { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Users, Search, RotateCcw, Loader2, CheckCircle2, UserCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/auditHelper";

export default function GerenciarOperadoresOcultosModal({
  open,
  onOpenChange,
  usuariosOcultos = []
}) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [reativandoId, setReativandoId] = useState(null);

  const filtrados = usuariosOcultos.filter((u) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  });

  const handleReativar = async (u) => {
    setReativandoId(u.id);
    try {
      await base44.entities.User.update(u.id, {
        nao_operador: false,
        role: "operador"
      });

      registrarAuditoria({
        acao: "edicao",
        entidade: "User",
        registroId: u.id,
        registroIdentificador: u.full_name || u.email,
        detalhes: `Reativou "${u.full_name || u.email}" na lista de operadores de fábrica`
      });

      toast.success(`"${u.full_name || u.email}" foi restaurado como operador de fábrica!`);

      queryClient.invalidateQueries({ queryKey: ["perf-equipe"] });
      queryClient.invalidateQueries({ queryKey: ["equipe-operadores-dialog"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      console.error("Erro ao reativar operador:", err);
      toast.error("Erro ao restaurar: " + (err?.message || "Tente novamente"));
    } finally {
      setReativandoId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Usuários Ocultos da Produção
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Usuários que foram retirados da lista de operadores. Você pode reativá-los a qualquer momento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou papel..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-border/60">
            {filtrados.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Nenhum usuário oculto ou fora da lista de operadores encontrado.
              </div>
            ) : (
              filtrados.map((u) => {
                const isReativando = reativandoId === u.id;
                return (
                  <div
                    key={u.id}
                    className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">
                        {u.full_name || u.email}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {u.role || "Não-operador"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {u.setor || "Geral"}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isReativando}
                      onClick={() => handleReativar(u)}
                      className="h-7 text-xs gap-1.5 shrink-0 hover:border-primary hover:text-primary"
                    >
                      {isReativando ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <UserCheck className="w-3 h-3" />
                      )}
                      Restaurar Operador
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
