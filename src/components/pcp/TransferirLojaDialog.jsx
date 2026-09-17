import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRightLeft, Building2, Check, AlertTriangle, Loader2, PackageCheck, Layers, CheckSquare, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FILIAIS_PCP } from "@/lib/roteamentoPCP";
import { getItens, classGrupo } from "@/lib/pedidoOdooHelper";
import { criarNotificacao } from "@/lib/notificacoesHelper";

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
  const [itensSelecionados, setItensSelecionados] = useState(() => new Set());

  // Normaliza lista recebida
  const listaPedidos = useMemo(() => {
    return Array.isArray(pedidos) ? pedidos.filter(Boolean) : (pedidos ? [pedidos] : []);
  }, [pedidos]);

  // Se recebemos apenas 1 pedido/OF, busca no cache se existem outras OFs do mesmo número de pedido
  const todosItensDoPedido = useMemo(() => {
    if (listaPedidos.length === 0) return [];

    // Se recebemos vários pedidos já passados explicitamente (ex: em lote)
    if (listaPedidos.length > 1) {
      return listaPedidos;
    }

    const primeiro = listaPedidos[0];
    if (!primeiro.numero_pedido) return listaPedidos;

    // Tenta encontrar outras OFs do mesmo pedido no cache do react-query
    const todosCache = queryClient.getQueryData(["pedidos-odoo-pcp"]) || [];
    const irmas = todosCache.filter(p => p && p.numero_pedido === primeiro.numero_pedido);

    if (irmas.length > 1) {
      const map = new Map();
      irmas.forEach(p => map.set(p.id, p));
      return Array.from(map.values());
    }

    return listaPedidos;
  }, [listaPedidos, queryClient]);

  // Inicializa todos os itens como selecionados ao abrir
  useEffect(() => {
    if (open && todosItensDoPedido.length > 0) {
      setItensSelecionados(new Set(todosItensDoPedido.map(p => p.id)));
      const unidadeAtual = todosItensDoPedido[0]?.unidade || "Matriz AJL";
      const outra = FILIAIS_PCP.find(f => f.id !== unidadeAtual)?.id || "Pinhais";
      setNovaUnidade(outra);
    }
  }, [open, todosItensDoPedido]);

  if (todosItensDoPedido.length === 0) return null;

  const totalDisponiveis = todosItensDoPedido.length;
  const totalSelecionados = itensSelecionados.size;
  const numeroPedidoPrincipal = todosItensDoPedido[0]?.numero_pedido || "";
  const clientePrincipal = todosItensDoPedido[0]?.cliente_nome || "";
  const lojaVendaPrincipal = todosItensDoPedido[0]?.loja_venda || "";

  // Ações de seleção rápida
  const handleSelectAll = () => {
    setItensSelecionados(new Set(todosItensDoPedido.map(p => p.id)));
  };

  const handleDeselectAll = () => {
    setItensSelecionados(new Set());
  };

  const handleToggleItem = (id) => {
    setItensSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmarTransferencia = async () => {
    if (!novaUnidade) {
      toast.error("Selecione a unidade de destino.");
      return;
    }

    if (totalSelecionados === 0) {
      toast.error("Selecione ao menos 1 item para transferir.");
      return;
    }

    setTransferindo(true);
    try {
      const me = await base44.auth.me().catch(() => null);
      const usuario = me?.full_name || me?.email || "PCP";
      const nowIso = new Date().toISOString();

      const itensParaTransferir = todosItensDoPedido.filter(p => itensSelecionados.has(p.id));
      let sucessos = 0;

      for (const p of itensParaTransferir) {
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
            motivo: motivo.trim() || "Transferência de item realizada pelo PCP"
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
            acao: "transferencia_unidade_item",
            detalhes: `Item ${p.of_nome || p.numero_pedido} transferido de ${deOnde} para ${novaUnidade}. Motivo: ${motivo.trim() || "Sem observações"}`
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

      // Notificar a filial de destino em tempo real
      if (sucessos > 0) {
        criarNotificacao({
          titulo: `🔁 Transferência recebida: ${sucessos} item(ns)`,
          mensagem: `${sucessos} item(ns) transferido(s) de ${deOnde} para ${novaUnidade}. ${motivo ? "Motivo: " + motivo.trim() : ""}`,
          tipo: "transferencia",
          unidade: novaUnidade,
          link: "/pcp",
          autor_nome: usuario || "PCP"
        });
      }

      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });

      toast.success(
        sucessos === 1
          ? `1 item transferido para ${novaUnidade} com sucesso!`
          : `${sucessos} itens transferidos para ${novaUnidade} com sucesso!`
      );

      setMotivo("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error("Erro ao transferir itens: " + (err.message || String(err)));
    } finally {
      setTransferindo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <span>Transferir Central PCP / Fábrica</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {numeroPedidoPrincipal ? (
              <span>
                Pedido de Venda <strong>#{numeroPedidoPrincipal}</strong> — {clientePrincipal || "Cliente não informado"}
                {lojaVendaPrincipal && ` (Loja Venda: ${lojaVendaPrincipal})`}
              </span>
            ) : (
              "Selecione os itens e a unidade industrial de destino."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Seção de Seleção Granular de Itens */}
          <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Escolha os Itens / OFs a transferir:
                </span>
                <Badge variant="outline" className="text-[11px] font-mono font-bold bg-white dark:bg-slate-800">
                  {totalSelecionados} de {totalDisponiveis} selecionado(s)
                </Badge>
              </div>

              {totalDisponiveis > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    Marcar Todos
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:underline"
                  >
                    Desmarcar Todos
                  </button>
                </div>
              )}
            </div>

            {/* Lista dos Itens / OFs */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 pt-1">
              {todosItensDoPedido.map((item) => {
                const isSelected = itensSelecionados.has(item.id);
                const grupoSetor = classGrupo(item);
                const subItens = getItens(item);
                const unidadeItem = item.unidade || "Matriz AJL";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleItem(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isSelected
                        ? "bg-white dark:bg-slate-800/90 border-orange-500/70 dark:border-orange-500 shadow-xs ring-1 ring-orange-500/20"
                        : "bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleItem(item.id)}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                            {item.of_nome || `OF #${item.numero_pedido}`}
                          </span>

                          {grupoSetor === "telha" && (
                            <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200">
                              🏗️ Telha
                            </Badge>
                          )}
                          {grupoSetor === "frisada" && (
                            <Badge className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200">
                              〰️ Frisada
                            </Badge>
                          )}
                          {grupoSetor === "cd" && (
                            <Badge className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border-orange-200">
                              ✂️ Corte & Dobra
                            </Badge>
                          )}
                        </div>

                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Fábrica atual: <strong>{unidadeItem}</strong>
                        </Badge>
                      </div>

                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 truncate">
                        {item.produto_nome || item.produto || (subItens[0]?.produto) || "Item do Pedido"}
                      </p>

                      {subItens.length > 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {subItens.map(si => `${si.produto || si.descricao || "Item"} (${si.quantidade || 1}x)`).join(", ")}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {item.quantidade && (
                          <span>Qtd: <strong className="text-slate-600 dark:text-slate-300">{item.quantidade} peças</strong></span>
                        )}
                        {item.metragem_total && (
                          <span>Metragem: <strong className="text-slate-600 dark:text-slate-300">{item.metragem_total}m</strong></span>
                        )}
                        {item.peso_estimado_kg && (
                          <span>Peso: <strong className="text-slate-600 dark:text-slate-300">{item.peso_estimado_kg} kg</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Seleção de Nova Unidade de Destino */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-orange-500" />
              Transferir os Itens Selecionados Para:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FILIAIS_PCP.map((f) => {
                const isSelecionada = novaUnidade === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setNovaUnidade(f.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 relative ${
                      isSelecionada
                        ? "bg-orange-50 dark:bg-orange-950/40 border-orange-500 dark:border-orange-500 ring-1 ring-orange-500/40 text-orange-900 dark:text-orange-100 shadow-xs"
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
                    <span className="text-[10px] text-slate-400">
                      Sigla: {f.sigla}
                    </span>
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
              placeholder="Ex: Fabricar telhas em Pinhais e corte & dobra na Matriz, logística de entrega, sobrecarga de máquina, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="text-xs min-h-[65px] resize-none"
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
            disabled={transferindo || totalSelecionados === 0}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs gap-1.5 shadow-sm font-bold"
          >
            {transferindo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Transferir {totalSelecionados} Item(ns) para {novaUnidade}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
