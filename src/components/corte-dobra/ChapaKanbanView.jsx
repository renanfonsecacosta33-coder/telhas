import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers, Lock, ShoppingCart, CheckCircle2, Clock,
  Edit2, Trash2, Printer, Image as ImageIcon
} from "lucide-react";
import CorChapaDot, { extractEspessuraFromDesc } from "@/components/corte-dobra/CorChapaDot";

const COLUNAS_KANBAN = [
  {
    id: "disponivel",
    titulo: "🟢 Disponível no Estoque",
    subtitulo: "Prontas para corte e dobra",
    headerBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    filtro: (c) => (c.status === "disponivel" || !c.status) && !c.reservada && c.destino !== "pedido_direto",
  },
  {
    id: "reservada",
    titulo: "🔒 Reservada / Pedido Direto",
    subtitulo: "Destinadas a clientes / pedidos",
    headerBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    filtro: (c) => c.reservada || c.destino === "pedido_direto",
  },
  {
    id: "parcial",
    titulo: "⚙️ Parcial / Em Processo",
    subtitulo: "Chapas com consumo parcial",
    headerBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    filtro: (c) => c.status === "parcial",
  },
  {
    id: "consumida",
    titulo: "⚪ Consumida / Baixada",
    subtitulo: "Finalizadas ou canceladas",
    headerBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
    filtro: (c) => c.status === "consumido" || c.status === "cancelado",
  },
];

export default function ChapaKanbanView({
  chapas,
  bobinasMap = {},
  isAdmin,
  onEdit,
  onDelete,
  onPrintEtiqueta,
  onViewFoto,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {COLUNAS_KANBAN.map((col) => {
        const itensColuna = chapas.filter(col.filtro);
        const totalQtd = itensColuna.reduce((sum, c) => sum + (Number(c.quantidade_disponivel) || 0), 0);
        const totalKg = itensColuna.reduce((sum, c) => sum + (Number(c.peso_kg) || 0), 0);

        return (
          <div
            key={col.id}
            className="bg-card border border-border rounded-xl flex flex-col max-h-[80vh] overflow-hidden shadow-xs"
          >
            {/* Header Coluna */}
            <div className={`p-3 border-b border-border ${col.headerBg}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm tracking-tight">{col.titulo}</h3>
                <Badge variant="secondary" className="font-extrabold text-xs">
                  {itensColuna.length}
                </Badge>
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">{col.subtitulo}</p>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold">
                <span>{totalQtd.toLocaleString("pt-BR")} chapas</span>
                {totalKg > 0 && <span>{totalKg.toLocaleString("pt-BR")} kg</span>}
              </div>
            </div>

            {/* Lista Cards */}
            <div className="p-2 space-y-2.5 overflow-y-auto flex-1 divide-y divide-transparent">
              {itensColuna.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                  Nenhuma chapa nesta coluna
                </div>
              ) : (
                itensColuna.map((c) => {
                  const bobina = c.bobina_id ? bobinasMap[c.bobina_id] : null;
                  const espessura = c.espessura_mm
                    || extractEspessuraFromDesc(c.bobina_descricao)
                    || extractEspessuraFromDesc(bobina?.chapa)
                    || extractEspessuraFromDesc(bobina?.espessura_utilizada)
                    || null;

                  return (
                    <div
                      key={c.id}
                      className="bg-background border border-border hover:border-orange-500/50 rounded-lg p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col gap-2"
                    >
                      {/* Topo do card: Código + Qtd */}
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-foreground">
                              {c.codigo || "S/C"}
                            </span>
                            {c.foto_finalizacao_url && (
                              <button
                                onClick={() => onViewFoto?.(c.foto_finalizacao_url)}
                                className="text-[10px] bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded hover:underline"
                                title="Ver foto"
                              >
                                📷
                              </button>
                            )}
                          </div>
                          {c.reservada && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold mt-1">
                              <Lock className="w-2.5 h-2.5 mr-0.5" />
                              Ped {c.reserva_numero_pedido || "Reserva"}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="font-extrabold text-xs bg-muted/60 text-foreground">
                          {Number(c.quantidade_disponivel || 0).toLocaleString("pt-BR")} un
                        </Badge>
                      </div>

                      {/* Descrição / Material */}
                      <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                        <CorChapaDot espessura={espessura} />
                        <span className="truncate" title={c.bobina_descricao || c.material}>
                          {c.bobina_descricao || c.material || "Chapa"}
                        </span>
                      </div>

                      {/* Dimensões e Espessura */}
                      <div className="grid grid-cols-2 gap-1 text-[11px] bg-muted/30 p-1.5 rounded border border-border/50 text-muted-foreground">
                        <div>
                          <span className="opacity-70">Esp:</span>{" "}
                          <strong className="text-foreground">{espessura ? `${espessura}mm` : "—"}</strong>
                        </div>
                        <div>
                          <span className="opacity-70">Dim:</span>{" "}
                          <strong className="text-foreground">
                            {c.largura_mm && c.comprimento_mm ? `${c.largura_mm}×${c.comprimento_mm}` : "—"}
                          </strong>
                        </div>
                        {c.peso_kg && (
                          <div className="col-span-2">
                            <span className="opacity-70">Peso:</span>{" "}
                            <strong className="text-foreground">{Number(c.peso_kg).toLocaleString("pt-BR")} kg</strong>
                          </div>
                        )}
                      </div>

                      {/* Rodapé com botões de ação */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/60 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {c.origem || "desb"}
                        </span>
                        <div className="flex items-center gap-1">
                          {onPrintEtiqueta && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title="Imprimir Etiqueta"
                              onClick={() => onPrintEtiqueta(c)}
                            >
                              <Printer className="w-3 h-3" />
                            </Button>
                          )}
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              title="Editar Chapa"
                              onClick={() => onEdit(c)}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                          {isAdmin && onDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:bg-destructive/10"
                              title="Excluir Chapa"
                              onClick={() => {
                                if (confirm(`Excluir chapa ${c.codigo}?`)) {
                                  onDelete(c.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
