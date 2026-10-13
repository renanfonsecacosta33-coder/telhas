import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Printer, Star, History, Scissors, Layers, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CFG = {
  pendente: { label: "Pendente", color: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300" },
  aguardando_corte: { label: "Aguard. Corte", color: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300" },
  em_producao: { label: "Em Produção", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300" },
  pausado: { label: "Pausado", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300" },
  finalizado: { label: "Finalizado", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300" },
  aguardando_material: { label: "Sem Material", color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300" },
};

export default function PedidoCDTabelaView({
  ordens = [],
  onEditDesb,
  onEditMaq,
  onOpenHistorico,
  onStatusChange,
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <th className="py-2.5 px-3">Data</th>
              <th className="py-2.5 px-3">Pedido / OC</th>
              <th className="py-2.5 px-3">Máquina</th>
              <th className="py-2.5 px-3">Tipo da Peça</th>
              <th className="py-2.5 px-3">Material / Chapa</th>
              <th className="py-2.5 px-3 text-center">Quantidade</th>
              <th className="py-2.5 px-3 text-right">Comprimento</th>
              <th className="py-2.5 px-3 text-right">Peso (KG)</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ordens.map((o) => {
              const isDesb = !o.maquina || o.maquina === "DESBOBINADEIRA" || o.maquina?.startsWith?.("DESBOBINADEIRA");
              const st = STATUS_CFG[o.status] || STATUS_CFG.pendente;
              const pesoKg = Number(o.peso_kg || o.kg_estimado || 0);

              return (
                <tr
                  key={o.id}
                  className={`hover:bg-muted/40 transition-colors ${
                    o.status === "em_producao" ? "bg-blue-500/5 dark:bg-blue-950/20" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                    {o.data ? format(new Date(o.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </td>

                  <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>#{o.numero_pedido || o.id?.slice(0, 8)}</span>
                      {o.numero_oc && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({o.numero_oc})
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        isDesb
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300"
                      }`}
                    >
                      {o.maquina || "DESBOBINADEIRA"}
                    </Badge>
                  </td>

                  <td className="py-2.5 px-3 text-foreground font-medium max-w-[180px] truncate" title={o.tipo_peca || o.observacoes}>
                    {o.tipo_peca || "Chapa / Perfil"}
                  </td>

                  <td className="py-2.5 px-3 text-muted-foreground max-w-[200px] truncate" title={o.chapa_descricao || o.bobina_descricao}>
                    <span>{o.chapa_descricao || o.bobina_descricao || "Material C&D"}</span>
                    {o.espessura && <span className="text-[10px] ml-1 opacity-70">({o.espessura}mm)</span>}
                  </td>

                  <td className="py-2.5 px-3 text-center font-black font-mono text-foreground">
                    {o.quantidade || 1} pçs
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {o.comprimento_mm ? `${Number(o.comprimento_mm).toLocaleString("pt-BR")} mm` : o.tamanho_corte_mm ? `${Number(o.tamanho_corte_mm).toLocaleString("pt-BR")} mm` : "—"}
                  </td>

                  <td className="py-2.5 px-3 text-right font-black font-mono text-foreground">
                    {pesoKg > 0 ? `${pesoKg.toLocaleString("pt-BR")} kg` : "—"}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <Badge variant="outline" className={`text-[10px] font-bold ${st.color}`}>
                      {st.label}
                    </Badge>
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onOpenHistorico && o.numero_pedido && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onOpenHistorico(o.numero_pedido)}
                          title="Linha do Tempo / Histórico"
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (isDesb) onEditDesb?.(o);
                          else onEditMaq?.(o);
                        }}
                        title="Editar Ordem"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
