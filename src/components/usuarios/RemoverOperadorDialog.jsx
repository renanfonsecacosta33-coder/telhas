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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserX, AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/auditHelper";

export default function RemoverOperadorDialog({
  open,
  onOpenChange,
  operador,
  onSuccess
}) {
  const queryClient = useQueryClient();
  const [novoCargo, setNovoCargo] = useState("vendedor");
  const [removendo, setRemovendo] = useState(false);

  if (!operador) return null;

  const handleConfirmar = async () => {
    setRemovendo(true);
    try {
      let targetUserId = operador.id;

      // Se id não for um ID padrão de entidade, tenta localizar por nome ou email
      try {
        await base44.entities.User.update(targetUserId, {
          nao_operador: true,
          role: novoCargo
        });
      } catch (errFirst) {
        // Fallback: buscar por full_name ou email
        const encontrados = await base44.entities.User.filter({
          $or: [
            { full_name: operador.nome },
            { email: operador.nome }
          ]
        });
        if (encontrados && encontrados.length > 0) {
          targetUserId = encontrados[0].id;
          await base44.entities.User.update(targetUserId, {
            nao_operador: true,
            role: novoCargo
          });
        }
      }

      // Salvar também em localStorage para efeito instantâneo no navegador
      try {
        const ocultosLocais = JSON.parse(localStorage.getItem("ajl_operadores_ocultos") || "[]");
        if (!ocultosLocais.includes(operador.nome)) {
          ocultosLocais.push(operador.nome);
          localStorage.setItem("ajl_operadores_ocultos", JSON.stringify(ocultosLocais));
        }
      } catch {}

      // 2. Registrar na Auditoria
      registrarAuditoria({
        acao: "edicao",
        entidade: "User",
        registroId: targetUserId,
        registroIdentificador: operador.nome,
        detalhes: `Removeu "${operador.nome}" da lista de operadores de fábrica (Redefinido para cargo: ${novoCargo})`
      });

      toast.success(`"${operador.nome}" foi removido da lista de operadores.`);

      // 3. Invalidar queries para atualizar todas as listas
      queryClient.invalidateQueries({ queryKey: ["perf-equipe"] });
      queryClient.invalidateQueries({ queryKey: ["equipe-operadores-dialog"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao remover operador:", err);
      toast.error("Erro ao remover operador: " + (err?.message || "Tente novamente"));
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Tirar da Lista de Operadores
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Oculte este usuário do ranking e do seletor das máquinas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Nome:</span>
              <span className="font-bold text-foreground">{operador.nome}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Setor Atual:</span>
              <span className="text-foreground">{operador.setor || "Geral"}</span>
            </div>
            {operador.maquinasCadastradas && operador.maquinasCadastradas.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">Máquinas:</span>
                <span className="text-foreground">{operador.maquinasCadastradas.join(", ")}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Qual é o papel/função real deste usuário?
            </Label>
            <Select value={novoCargo} onValueChange={setNovoCargo}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vendedor">💼 Vendedor / Comercial</SelectItem>
                <SelectItem value="admin">🏢 Administrativo / Gestão</SelectItem>
                <SelectItem value="encarregado">👷 Encarregado / Líder de Produção</SelectItem>
                <SelectItem value="super_admin">🛡️ Administrador do Sistema</SelectItem>
                <SelectItem value="outro">📦 Expedição / Outro (Não Opera Máquinas)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              O usuário continuará com acesso normal ao ERP nas funções autorizadas, mas deixará de poluir o ranking e as listas de máquina.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={removendo}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirmar}
            disabled={removendo}
            className="text-xs gap-1.5 font-semibold"
          >
            {removendo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Removendo...
              </>
            ) : (
              <>
                <UserX className="w-3.5 h-3.5" /> Tirar da Lista de Operadores
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
