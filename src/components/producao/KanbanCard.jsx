import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, User, ArrowRight, Play, CheckCircle, Pause, AlertTriangle, Eye } from "lucide-react";

export default function KanbanCard({
  item,
  tipoSetor = "corte_dobra",
  onStatusChange,
  onOpenDetails,
  provided,
  isDragging
}) {
  const numeroPedido = item.numero_pedido ? `#${item.numero_pedido}` : item.id?.slice(-4);
  const cliente = item.cliente || "Cliente não informado";
  const produto = item.produto || item.tipo_peca || item.desenvolvimento_descricao || "Ordem de Produção";
  const maquina = item.maquina || item.maquina_inicial || "Máquina";
  const metrosOuQtd = item.metros ? `${item.metros}m` : item.quantidade ? `${item.quantidade} un` : "";

  const isEmProducao = item.status === "em_producao";
  const isPausado = item.status === "pausado";
  const isFinalizado = item.status === "finalizado";
  const isPendente = item.status === "pendente" || item.status === "aguardando_material";

  // Operadores
  const operadores = (() => {
    try {
      if (Array.isArray(item.operadores_json)) return item.operadores_json;
      if (typeof item.operadores_json === "string") return JSON.parse(item.operadores_json);
      return [];
    } catch {
      return [];
    }
  })();

  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      className={`bg-card border rounded-xl p-3 shadow-xs select-none transition-all ${
        isDragging ? "shadow-2xl border-primary ring-2 ring-primary/20 rotate-1 scale-102" : "border-border hover:border-primary/50"
      } ${isEmProducao ? "border-l-4 border-l-blue-500 bg-blue-500/5" : ""}`}
    >
      {/* Topo: Máquina + Número do Pedido */}
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 h-4 truncate max-w-[120px]">
          {maquina}
        </Badge>
        <span className="text-xs font-mono font-black text-foreground">
          {numeroPedido}
        </span>
      </div>

      {/* Cliente & Produto */}
      <p className="text-xs font-bold text-foreground line-clamp-1 mb-0.5">
        {cliente}
      </p>
      <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2">
        {produto} {metrosOuQtd && `· ${metrosOuQtd}`}
      </p>

      {/* Operadores (se houver) */}
      {operadores.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2 bg-muted/40 px-2 py-0.5 rounded-md">
          <User className="w-3 h-3 text-primary" />
          <span className="truncate">{operadores.map(o => o.nome || o).join(", ")}</span>
        </div>
      )}

      {/* Ações Rápidas do Card */}
      <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/60 text-xs">
        {onOpenDetails && (
          <button
            onClick={() => onOpenDetails(item)}
            className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
            title="Ver detalhes"
          >
            <Eye className="w-3 h-3" /> Detalhes
          </button>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {isPendente && onStatusChange && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(item, "em_producao")}
              className="h-6 px-2 text-[10px] gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950 font-bold"
            >
              <Play className="w-2.5 h-2.5 fill-current" /> Iniciar
            </Button>
          )}

          {isEmProducao && onStatusChange && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(item, "finalizado")}
              className="h-6 px-2 text-[10px] gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950 font-bold"
            >
              <CheckCircle className="w-2.5 h-2.5" /> Concluir
            </Button>
          )}

          {isFinalizado && onStatusChange && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(item, "expedido")}
              className="h-6 px-2 text-[10px] gap-1 text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-950 font-bold"
            >
              <ArrowRight className="w-2.5 h-2.5" /> Expedir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
