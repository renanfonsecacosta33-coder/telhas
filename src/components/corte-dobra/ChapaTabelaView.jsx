import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Edit2, Trash2, Printer, Lock, CheckCircle2, ShoppingCart, Layers, FileText
} from "lucide-react";
import CorChapaDot, { extractEspessuraFromDesc } from "@/components/corte-dobra/CorChapaDot";

export default function ChapaTabelaView({
  chapas,
  bobinasMap = {},
  isAdmin,
  onEdit,
  onDelete,
  onPrintEtiqueta,
  onViewFoto,
}) {
  if (!chapas || chapas.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
        <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-semibold">Nenhuma chapa encontrada</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border text-muted-foreground uppercase tracking-wider font-bold">
              <th className="py-3 px-3">Código</th>
              <th className="py-3 px-3">Material / Chapa</th>
              <th className="py-3 px-3">Espessura</th>
              <th className="py-3 px-3">Dimensões (mm)</th>
              <th className="py-3 px-3 text-right">Qtd Disponível</th>
              <th className="py-3 px-3 text-right">Peso Estimado</th>
              <th className="py-3 px-3">Destino / Reserva</th>
              <th className="py-3 px-3">Origem</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {chapas.map((c) => {
              const bobina = c.bobina_id ? bobinasMap[c.bobina_id] : null;
              const espessura = c.espessura_mm
                || extractEspessuraFromDesc(c.bobina_descricao)
                || extractEspessuraFromDesc(bobina?.chapa)
                || extractEspessuraFromDesc(bobina?.espessura_utilizada)
                || "—";

              const isConsumed = c.status === "consumido" || c.status === "cancelado";

              return (
                <tr
                  key={c.id}
                  className={`hover:bg-muted/40 transition-colors ${isConsumed ? "opacity-60 bg-muted/20" : ""}`}
                >
                  {/* Código */}
                  <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="text-orange-600 dark:text-orange-400 font-extrabold">{c.codigo || "S/C"}</span>
                      {c.foto_finalizacao_url && (
                        <button
                          onClick={() => onViewFoto?.(c.foto_finalizacao_url)}
                          className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded hover:underline"
                          title="Ver foto"
                        >
                          📷
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Material / Bobina */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <CorChapaDot espessura={espessura} />
                      <div className="max-w-[200px] truncate font-medium text-foreground" title={c.bobina_descricao || c.material}>
                        {c.bobina_descricao || c.material || "Chapa sem especificação"}
                      </div>
                    </div>
                  </td>

                  {/* Espessura */}
                  <td className="py-2.5 px-3 font-semibold text-foreground">
                    {espessura !== "—" ? `${espessura} mm` : "—"}
                  </td>

                  {/* Dimensões */}
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {c.largura_mm && c.comprimento_mm ? (
                      <span className="font-mono">{c.largura_mm} × {c.comprimento_mm} mm</span>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Qtd Disponível */}
                  <td className="py-2.5 px-3 text-right">
                    <span className="font-bold text-foreground text-sm">
                      {Number(c.quantidade_disponivel || 0).toLocaleString("pt-BR")}
                    </span>
                    {c.quantidade_total > c.quantidade_disponivel && (
                      <span className="text-[10px] text-muted-foreground block">
                        de {c.quantidade_total} total
                      </span>
                    )}
                  </td>

                  {/* Peso */}
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {c.peso_kg ? `${Number(c.peso_kg).toLocaleString("pt-BR")} kg` : "—"}
                  </td>

                  {/* Destino / Reserva */}
                  <td className="py-2.5 px-3">
                    {c.reservada ? (
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Res: {c.reserva_numero_pedido || "Sim"}
                      </Badge>
                    ) : c.destino === "pedido_direto" ? (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-bold gap-1">
                        <ShoppingCart className="w-2.5 h-2.5" />
                        Ped: {c.numero_pedido || "Direto"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">Estoque Geral</span>
                    )}
                  </td>

                  {/* Origem */}
                  <td className="py-2.5 px-3">
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold ${c.origem === "manual" ? "border-purple-300 text-purple-700 bg-purple-50" : "border-slate-300 text-slate-700 bg-slate-50"}`}>
                      {c.origem || "Desbobinadeira"}
                    </Badge>
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3 text-center">
                    {c.status === "consumido" ? (
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">Consumido</Badge>
                    ) : c.status === "cancelado" ? (
                      <Badge className="bg-red-100 text-red-600 border-red-200 text-[10px]">Cancelado</Badge>
                    ) : c.status === "parcial" ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Parcial</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                        Disponível
                      </Badge>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onPrintEtiqueta && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Imprimir Etiqueta"
                          onClick={() => onPrintEtiqueta(c)}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Editar Chapa"
                          onClick={() => onEdit(c)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {isAdmin && onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Excluir Chapa"
                          onClick={() => {
                            if (confirm(`Excluir chapa ${c.codigo}?`)) {
                              onDelete(c.id);
                            }
                          }}
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
