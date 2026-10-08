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
import {
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ExternalLink,
  Layers,
  Inbox
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getItens } from "@/lib/pedidoOdooHelper";

export default function RecuperarPedidoOdooDialog({
  open,
  onOpenChange,
  onSucesso,
  onAbrirSimuladorWebhook
}) {
  const [numeroBusca, setNumeroBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [reativando, setReativando] = useState(false);

  const handleBuscar = async (e) => {
    if (e) e.preventDefault();
    const termo = numeroBusca.trim();
    if (!termo) {
      toast.error("Digite o número do pedido ou OF para buscar.");
      return;
    }

    setBuscando(true);
    setResultado(null);

    try {
      // 1. Tenta buscar por numero_pedido exato ou com prefixo 'S'
      const numPuro = termo.replace(/^#/, "");
      const numComS = numPuro.toUpperCase().startsWith("S") ? numPuro.toUpperCase() : `S${numPuro.padStart(5, "0")}`;
      const numSemS = numPuro.replace(/^S/i, "");

      const [resExato, resComS, resSemS, resOfId, resOfNome] = await Promise.all([
        base44.entities.PedidoOdoo.filter({ numero_pedido: numPuro }).catch(() => []),
        base44.entities.PedidoOdoo.filter({ numero_pedido: numComS }).catch(() => []),
        base44.entities.PedidoOdoo.filter({ numero_pedido: numSemS }).catch(() => []),
        base44.entities.PedidoOdoo.filter({ of_odoo_id: termo }).catch(() => []),
        base44.entities.PedidoOdoo.filter({ of_nome: termo }).catch(() => [])
      ]);

      // Consolida e deduplica os resultados pelo ID
      const mapa = new Map();
      [...resExato, ...resComS, ...resSemS, ...resOfId, ...resOfNome].forEach(p => {
        if (p && p.id) mapa.set(p.id, p);
      });

      const lista = Array.from(mapa.values());
      setResultado({
        termo,
        pedidos: lista,
        encontrado: lista.length > 0
      });

      if (lista.length > 0) {
        toast.success(`Encontrada(s) ${lista.length} OF(s) para o pedido #${termo}`);
      } else {
        toast.warning(`Pedido #${termo} não encontrado no banco de dados local.`);
      }
    } catch (err) {
      console.error("[RecuperarPedidoOdoo] Erro na busca:", err);
      toast.error("Erro ao consultar pedido no banco: " + (err?.message || ""));
    } finally {
      setBuscando(false);
    }
  };

  const handleReativar = async (pedido) => {
    setReativando(true);
    try {
      await base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "pendente_distribuicao",
        percentual_concluido: 0,
        motivo_cancelamento: null,
        data_cancelamento: null
      });

      toast.success(`OF #${pedido.of_nome || pedido.numero_pedido} reativada na Central PCP!`);
      // Atualiza resultado local
      setResultado(prev => {
        if (!prev) return null;
        return {
          ...prev,
          pedidos: prev.pedidos.map(p => p.id === pedido.id ? { ...p, status_pcp: "pendente_distribuicao", percentual_concluido: 0 } : p)
        };
      });

      if (onSucesso) onSucesso(pedido);
    } catch (e) {
      toast.error("Falha ao reativar OF: " + (e?.message || ""));
    } finally {
      setReativando(false);
    }
  };

  const handleReativarTodas = async () => {
    if (!resultado?.pedidos?.length) return;
    setReativando(true);
    let ok = 0;
    try {
      for (const p of resultado.pedidos) {
        await base44.entities.PedidoOdoo.update(p.id, {
          status_pcp: "pendente_distribuicao",
          percentual_concluido: 0,
          motivo_cancelamento: null,
          data_cancelamento: null
        });
        ok++;
      }
      toast.success(`${ok} OF(s) do pedido reativadas na Central PCP com sucesso!`);
      if (onSucesso) onSucesso(resultado.pedidos[0]);
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao reativar lote: " + (e?.message || ""));
    } finally {
      setReativando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-500" />
            Localizar & Recuperar Pedido do Odoo
          </DialogTitle>
          <DialogDescription>
            Consulte qualquer pedido ou OF do Odoo no banco da Central PCP, mesmo que esteja concluído, cancelado ou oculto por filtros.
          </DialogDescription>
        </DialogHeader>

        {/* Formulário de Busca */}
        <form onSubmit={handleBuscar} className="flex gap-2 items-center pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={numeroBusca}
              onChange={(e) => setNumeroBusca(e.target.value)}
              placeholder="Digite o nº do pedido (ex: S01183, 1183) ou OF..."
              className="pl-9 h-10 text-sm font-medium"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={buscando || !numeroBusca.trim()}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-10 px-4 shrink-0"
          >
            {buscando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1.5" />}
            Consultar
          </Button>
        </form>

        {/* Resultados */}
        {resultado && (
          <div className="space-y-3 pt-2">
            {resultado.encontrado ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {resultado.pedidos.length} Ordem(ns) encontrada(s) no banco:
                  </span>
                  {resultado.pedidos.some(p => p.status_pcp === "cancelado" || p.status_pcp === "concluido") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReativarTodas}
                      disabled={reativando}
                      className="h-7 text-xs font-bold text-orange-600 dark:text-orange-400 border-orange-300 hover:bg-orange-50"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reativar Todas na Fila PCP
                    </Button>
                  )}
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {resultado.pedidos.map((p) => {
                    const itens = getItens(p);
                    const isCancelado = p.status_pcp === "cancelado";
                    const isConcluido = p.status_pcp === "concluido" || p.percentual_concluido >= 100;

                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-colors ${
                          isCancelado
                            ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40"
                            : isConcluido
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
                            : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-slate-900 dark:text-white">
                                #{p.numero_pedido}
                              </span>
                              {p.of_nome && (
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {p.of_nome}
                                </Badge>
                              )}
                              <Badge className={`text-[10px] ${
                                isCancelado
                                  ? "bg-red-600 text-white"
                                  : isConcluido
                                  ? "bg-emerald-600 text-white"
                                  : "bg-blue-600 text-white"
                              }`}>
                                {isCancelado ? "Cancelado" : isConcluido ? "Concluído" : p.status_pcp || "Pendente"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Cliente: <strong className="text-foreground">{p.cliente_nome || "—"}</strong>
                              {p.vendedor_nome && ` · Vendedor: ${p.vendedor_nome}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {(isCancelado || isConcluido) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReativar(p)}
                                disabled={reativando}
                                className="h-7 text-[11px] font-bold text-orange-600 border-orange-300 hover:bg-orange-50 gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Reativar
                              </Button>
                            )}
                          </div>
                        </div>

                        {itens.length > 0 && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            <strong>Item:</strong> {itens[0]?.produto || itens[0]?.descricao || "—"} ({itens[0]?.quantidade} {itens[0]?.unidade})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200 font-semibold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    O pedido <strong>#{resultado.termo}</strong> não foi encontrado no banco de dados da Central PCP.
                  </span>
                </div>
                <p className="text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
                  Isso geralmente ocorre quando a confirmação do pedido no Odoo não disparou o Webhook para o app (por instabilidade de rede ou pedido ainda em cotação no ERP).
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      if (onAbrirSimuladorWebhook) onAbrirSimuladorWebhook(resultado.termo);
                    }}
                    className="h-8 text-xs font-bold text-orange-700 border-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/50"
                  >
                    Importar / Colar Webhook Manualmente
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
