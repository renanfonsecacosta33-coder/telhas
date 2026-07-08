import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, CheckCircle2, Clock, Circle, Printer, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", icon: Circle, badge: "bg-gray-100 text-gray-700 border-gray-200" },
  em_producao: { label: "Em Produção", icon: Clock, badge: "bg-amber-100 text-amber-700 border-amber-200" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, badge: "bg-green-100 text-green-700 border-green-200" },
  cancelado: { label: "Cancelado", icon: Circle, badge: "bg-red-100 text-red-700 border-red-200" },
};

export default function PedidoCard({ pedido: p, maquinaCores, onEdit, onDelete, onStatusChange, onPrintOP, onTogglePrioridade }) {
  const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendente;
  const Icon = st.icon;

  return (
    <div className={`px-4 py-3 hover:bg-muted/10 transition-colors ${p.prioridade ? "bg-amber-50/50 border-l-4 border-l-amber-400" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Linha 1: produto + status + metros */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {p.prioridade && <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />}
            <span className="font-semibold text-sm">{p.produto}</span>
            <Badge className={`border text-xs ${st.badge}`}>
              <Icon className="w-3 h-3 mr-1" />
              {st.label}
            </Badge>
            {p.metros > 0 && (
              <span className="text-sm font-bold text-primary">{Number(p.metros).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m</span>
            )}
          </div>
          {/* Linha 2: cliente + vendedor + pedido */}
          <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            {p.cliente && <span>👤 <span className="text-foreground font-medium">{p.cliente}</span></span>}
            {p.vendedor && <span>🏷 {p.vendedor}</span>}
            {p.numero_pedido && <span>#{p.numero_pedido}</span>}
            {p.valor > 0 && <span>R$ {Number(p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
          </div>
          {/* Linha 3: detalhes técnicos */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
            {p.rvm_superior && <span>RVM: {p.rvm_superior}{p.rvm_inferior ? ` / ${p.rvm_inferior}` : ""}</span>}
            {p.eps && <span>EPS: {p.eps}</span>}
            {p.bobina_superior && <span>Boba: {p.bobina_superior}</span>}
            {p.kg_total > 0 && <span>{p.kg_total}kg</span>}
            {p.data_prevista && <span>Prev: {format(new Date(p.data_prevista + "T12:00:00"), "dd/MM", { locale: ptBR })}</span>}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onTogglePrioridade && p.status !== "finalizado" && p.status !== "cancelado" && (
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${p.prioridade ? "text-amber-500" : "text-muted-foreground"}`} title={p.prioridade ? "Remover prioridade" : "Marcar como prioritário"} onClick={() => onTogglePrioridade(p)}>
              <Star className={`w-4 h-4 ${p.prioridade ? "fill-amber-500" : ""}`} />
            </Button>
          )}
          {p.status !== "finalizado" && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700" title="Finalizar" onClick={() => onStatusChange(p, "finalizado")}>
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          )}
          {onPrintOP && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700" title="Imprimir OP" onClick={() => onPrintOP(p)}>
              <Printer className="w-3 h-3" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(p.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}