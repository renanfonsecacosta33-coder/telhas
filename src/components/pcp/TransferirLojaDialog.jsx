import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft, Building2, Check, AlertTriangle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FILIAIS_PCP } from "@/lib/roteamentoPCP";

export default function TransferirLojaDialog({
  open,
  onOpenChange,
  pedidos = [],
  onSuccess
}) {
  const queryClient = useQueryClient();
  const [novaUnidade, setNovaUnidade] = useState("Matriz AJL");
  const [motivo, setMotivo] = useState("");
  const [transferindo, setTransferindo] = useState(false);

  const listaPedidos = Array.isArray(pedidos) ? pedidos.filter(Boolean) : (pedidos ? [pedidos] : []);
  const total = listaPedidos.length;

  if (total === 0) return null;

  const unidadeAtualUnica = total === 1 ? listaPedidos[0].unidade : null;

  const handleConfirmarTransferencia = async () => {
    if (!novaUnidade) {
      toast.error("Selecione a unidade de destino.");
      return;
    }

    setTransferindo(true);
    try {
      const me = await base44.auth.me().catch(() => null);
      const usuario = me?.full_name || me?.email || "PCP";
      const nowIso = new Date().toISOString();

      let sucessos = 0;

      for (const p of listaPedidos) {
        if (!p.id) continue;
        const deOnde = p.unidade || "Matriz AJL";
        if (deOnde === novaUnidade) continue;

        // Histórico de Transferências estruturado
        const histTransferenciasExistente = (() => {
          try { return JSON.parse(p.historico_transferencias || "[]"); } catch { return []; }
        })();
        const novoHistTransferencias = [
          ...histTransferenciasExistente,
          {
            data: nowIso,
            de: deOnde,
            para: novaUnidade,
            usuario,
            motivo: motivo.trim() || "Transferência manual realizada pelo PCP"
          }
        ];

        // Histórico geral de auditoria
        const histLogExistente = (() => {
          try { return JSON.parse(p.historico_log || "[]"); } catch { return []; }
        })();
        const novoHistLog = [
          ...histLogExistente,
          {
            data: nowIso,
            usuario,
            acao: "transferencia_unidade",
            detalhes: `Transferido de ${deOnde} para ${novaUnidade}. Motivo: ${motivo.trim() || "Sem observações"}`
          }
        ];

        await base44.entities.PedidoOdoo.update(p.id, {
          unidade: novaUnidade,
          unidade_transferida_de: deOnde,
          motivo_transferencia: motivo.trim() || "",
          historico_transferencias: JSON.stringify(novoHistTransferencias),
          historico_log: JSON.stringify(novoHistLog)
        });

        sucessos++;
      }

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });

      toast.success(
        total === 1
          ? `Ordem #${listaPedidos[0].numero_pedido} transferida para ${novaUnidade} com sucesso!`
          : `${sucessos} ordens transferidas para ${novaUnidade} com sucesso!`
      );

      setMotivo("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error("Erro ao transferir ordem: " + (err.message || String(err)));
    } finally {
      setTransferindo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-lg p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <span>Transferir Central PCP / Fábrica</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {total === 1
              ? `Transfira a ordem #${listaPedidos[0].numero_pedido} para a fila de outra filial fabril.`
              : `Transfira ${total} ordens de fabricação selecionadas para outra filial fabril.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumo da(s) ordem(ns) */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold">Ordens a transferir:</span>
              <Badge variant="outline" className="font-mono font-bold">
                {total} {total === 1 ? "OF" : "OFs"}
              </Badge>
            </div>
            {total === 1 ? (
              <div className="text-xs">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  #{listaPedidos[0].numero_pedido} {listaPedidos[0].of_nome ? `(OF: ${listaPedidos[0].of_nome})` : ""}
                </p>
                <p className="text-slate-500 truncate">{listaPedidos[0].cliente_nome || "Cliente não informado"}</p>
                <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400">Unidade Atual:</span>
                  <Badge className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px]">
                    {listaPedidos[0].unidade || "Matriz AJL"}
                  </Badge>
                  {listaPedidos[0].loja_venda && (
                    <span className="text-[11px] text-slate-400 ml-auto">
                      Venda: <strong>{listaPedidos[0].loja_venda}</strong>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-slate-500">
                {listaPedidos.slice(0, 5).map(p => (
                  <div key={p.id} className="flex justify-between items-center py-0.5">
                    <span className="font-mono font-bold">#{p.numero_pedido}</span>
                    <span className="truncate max-w-[160px] text-[11px]">{p.cliente_nome || "—"}</span>
                    <Badge variant="outline" className="text-[9px]">{p.unidade || "Matriz"}</Badge>
                  </div>
                ))}
                {total > 5 && (
                  <p className="text-center text-[10px] text-slate-400 italic pt-1">
                    ... e mais {total - 5} ordens selecionadas
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Seleção de Nova Unidade de Destino */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-orange-500" />
              Selecione a Unidade Fabril de Destino:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FILIAIS_PCP.map((f) => {
                const isAtual = unidadeAtualUnica === f.id;
                const isSelecionada = novaUnidade === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={isAtual}
                    onClick={() => setNovaUnidade(f.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 relative ${
                      isAtual
                        ? "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed"
                        : isSelecionada
                        ? "bg-orange-50 dark:bg-orange-950/40 border-orange-500 dark:border-orange-500 ring-1 ring-orange-500/40 text-orange-900 dark:text-orange-100"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{f.label}</span>
                      {isSelecionada && (
                        <div className="w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    {isAtual && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        (Unidade Atual)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Motivo da Transferência */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Motivo / Justificativa da Transferência (Opcional):
            </label>
            <Textarea
              placeholder="Ex: Sobrecarga na fábrica de Pinhais, logística de entrega mais próxima da obra, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="text-xs min-h-[70px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={transferindo}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmarTransferencia}
            disabled={transferindo || (unidadeAtualUnica && novaUnidade === unidadeAtualUnica)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs gap-1.5 shadow-sm"
          >
            {transferindo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Confirmar Transferência para {novaUnidade}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
