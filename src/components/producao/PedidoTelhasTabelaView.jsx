import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Printer, Star, History, Clock, CheckCircle2, Play, Pause } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CFG = {
  pendente: { label: "Pendente", color: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300" },
  em_producao: { label: "Em Produção", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300" },
  pausado: { label: "Pausado", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300" },
  aguardando_colagem: { label: "Aguard. Colagem", color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300" },
  finalizado: { label: "Finalizado", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300" },
};

function formatarDataSegura(dataStr) {
  if (!dataStr) return "—";
  try {
    const raw = String(dataStr).trim();
    if (!raw) return "—";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [_, ano, mes, dia] = isoMatch;
      return `${dia}/${mes}/${ano}`;
    }
    const d = new Date(raw.includes("T") ? raw : raw + "T12:00:00");
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
    return raw;
  } catch {
    return "—";
  }
}

export default function PedidoTelhasTabelaView({
  pedidos = [],
  maquinaCores = {},
  onEdit,
  onDelete,
  onStatusChange,
  onPrintOP,
  onTogglePrioridade,
  onOpenHistorico,
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <th className="py-2.5 px-3">Data</th>
              <th className="py-2.5 px-3">Pedido / OC</th>
              <th className="py-2.5 px-3">Cliente</th>
              <th className="py-2.5 px-3">Máquina</th>
              <th className="py-2.5 px-3">Produto / Modelo</th>
              <th className="py-2.5 px-3 text-center">Peças × Medida Individual</th>
              <th className="py-2.5 px-3 text-right">Metragem Total</th>
              <th className="py-2.5 px-3">Bobina / Cor</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pedidos.map((p) => {
              const maqCor = maquinaCores[p.maquina] || "bg-slate-100 text-slate-800 border-slate-200";
              const st = STATUS_CFG[p.status] || STATUS_CFG.pendente;
              const mm = Number(p.metragem_mm) || (Number(p.tamanho_corte) > 0 ? Number(p.tamanho_corte) : 0);
              const qtdTelhas = Number(p.quantidade_telhas) || (Number(p.quantidade) > 0 ? Number(p.quantidade) : 1);
              const metrosTotais = Number(p.metragem_planejada) || (mm > 0 ? (qtdTelhas * (mm / 1000)) : Number(p.metros) || 0);

              const individualTexto = (() => {
                if (mm > 0) {
                  const mUnit = (mm / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return `${mm.toLocaleString("pt-BR")} mm (${mUnit} m)`;
                }
                if (p.tamanho_corte || p.comprimento) {
                  return `${p.tamanho_corte || p.comprimento}`;
                }
                return "—";
              })();

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-muted/40 transition-colors ${
                    p.prioridade ? "bg-amber-500/5 dark:bg-amber-950/20" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                    {formatarDataSegura(p.data)}
                  </td>

                  <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>#{p.numero_pedido || p.id?.slice(0, 8)}</span>
                      {p.numero_oc && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({p.numero_oc})
                        </span>
                      )}
                      {p.prioridade && (
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" title="Prioritário / Urgente" />
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 font-semibold text-foreground max-w-[180px] truncate" title={p.cliente}>
                    {p.cliente || "—"}
                  </td>

                  <td className="py-2.5 px-3">
                    <Badge variant="outline" className={`text-[10px] font-bold ${maqCor}`}>
                      {p.maquina || "TP - 25"}
                    </Badge>
                  </td>

                  <td className="py-2.5 px-3 text-foreground max-w-[180px] truncate" title={p.produto || p.modelo}>
                    <span className="font-medium">{p.produto || "TELHA"}</span>
                    {p.modelo && <span className="text-muted-foreground text-[10px] block truncate">{p.modelo}</span>}
                  </td>

                  {/* Coluna 1: Peças × Medida Individual */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md border border-border/60 font-mono text-xs">
                      <strong className="text-foreground">{qtdTelhas} pç{qtdTelhas > 1 ? "s" : ""}</strong>
                      <span className="text-muted-foreground">×</span>
                      <span className="text-muted-foreground font-semibold">{individualTexto}</span>
                    </div>
                  </td>

                  {/* Coluna 2: Metragem Total */}
                  <td className="py-2.5 px-3 text-right">
                    <span className="font-black font-mono text-blue-600 dark:text-blue-400 text-sm">
                      {metrosTotais > 0 ? `${Number(metrosTotais).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m` : "—"}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-muted-foreground max-w-[160px] truncate" title={p.bobina_superior || p.rvm_superior}>
                    <div className="flex items-center gap-1">
                      <span className="truncate">{p.bobina_superior || p.rvm_superior || "Natural"}</span>
                      {p.espessura_exigida && (
                        <span className="text-[10px] opacity-70 shrink-0">({p.espessura_exigida}mm)</span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <Badge variant="outline" className={`text-[10px] font-bold ${st.color}`}>
                      {st.label}
                    </Badge>
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onPrintOP && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onPrintOP(p)}
                          title="Imprimir Ordem de Produção (OP)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {onOpenHistorico && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onOpenHistorico(p)}
                          title="Linha do Tempo / Histórico"
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onEdit(p)}
                          title="Editar Pedido"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onDelete(p)}
                          title="Excluir Pedido"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
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
