import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Factory, Scissors, Wind, Tag, Ruler, Package, CheckCircle2 } from "lucide-react";
import { formatDataBR, slaDiasPorCategoria } from "@/lib/sla";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";

export default function PedidoOdooDetalheDialog({ pedido, open, onOpenChange, onDistribuir, distribuindo }) {
  if (!pedido) return null;

  const itens = (() => {
    try { return JSON.parse(pedido.itens_json || "[]"); } catch { return []; }
  })();
  const espessuras = (() => {
    try { return JSON.parse(pedido.espessuras_tags || "[]"); } catch { return []; }
  })();
  const sla = slaDiasPorCategoria(pedido);

  const grupoIcon = {
    telha: <Factory className="w-3.5 h-3.5" />,
    cd: <Scissors className="w-3.5 h-3.5" />,
    frisada: <Wind className="w-3.5 h-3.5" />
  };
  const grupoColor = {
    telha: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
    cd: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
    frisada: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30"
  };

  const classGrupo = (catRaw) => {
    const cat = String(catRaw || "").trim().toLowerCase();
    if (["telhas", "telha"].includes(cat)) return "telha";
    if (["frisadas", "frisada"].includes(cat)) return "frisada";
    return "cd";
  };

  const jaDistribuido = pedido.status_pcp !== "pendente_distribuicao";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Pedido #{pedido.numero_pedido}</span>
            {pedido.odoo_id && (
              <span className="text-xs font-mono text-slate-400">Odoo:{pedido.odoo_id}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Detalhamento técnico e distribuição para os galpões
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Cliente</p>
            <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{pedido.cliente_nome || "—"}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Vendedor</p>
            <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{pedido.vendedor_nome || "—"}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Data Prometida</p>
            <p className="font-medium text-slate-800 dark:text-slate-100">{formatDataBR(pedido.data_entrega)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">SLA</p>
            <p className="font-medium text-orange-600 dark:text-orange-400">{sla} dias úteis</p>
          </div>
        </div>

        {/* Barra de progresso geral */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Progresso Geral da Produção</span>
            <span className={`text-sm font-bold ${(pedido.percentual_concluido || 0) >= 100 ? "text-emerald-600" : "text-orange-600"}`}>
              {pedido.percentual_concluido || 0}%
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${(pedido.percentual_concluido || 0) >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-amber-500"}`}
              style={{ width: `${pedido.percentual_concluido || 0}%` }}
            />
          </div>
          {(pedido.percentual_concluido || 0) >= 100 && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 100% concluído — pronto para enviar evento de conclusão ao Odoo ERP.
            </p>
          )}
        </div>

        {espessuras.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-semibold">Espessuras de chapa:</span>
            {espessuras.map((e, i) => (
              <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                {e.espessura}mm
              </span>
            ))}
          </div>
        )}

        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
            <Package className="w-4 h-4" /> Peças e Medidas ({itens.length})
          </h4>
          <div className="space-y-2">
            {itens.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum item detalhado.</p>
            ) : (
              itens.map((it, idx) => {
                const g = classGrupo(it.categoria);
                return (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                    <InstrucaoVendedorCard descricao={it.descricao || it.produto} quantidadeOdoo={it.quantidade} espessura={it.espessura} unidade={g === "telha" ? "MT" : "un"} />
                    <div className="flex items-center gap-3">
                    <Badge className={`shrink-0 border ${grupoColor[g]}`}>{grupoIcon[g]}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{it.produto || "—"}</p>
                      <p className="text-[11px] text-slate-400">{it.categoria}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Ruler className="w-3 h-3" />{it.medida || "—"}
                    </div>
                    {it.espessura && (
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{it.espessura}mm</span>
                    )}
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 w-12 text-right">{it.quantidade}x</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            onClick={() => onDistribuir(pedido)}
            disabled={distribuindo || jaDistribuido}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white flex-1"
          >
            <Zap className="w-4 h-4" />
            {jaDistribuido ? "Já Distribuído" : distribuindo ? "Distribuindo..." : "Distribuir Automaticamente para os Galpões"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}