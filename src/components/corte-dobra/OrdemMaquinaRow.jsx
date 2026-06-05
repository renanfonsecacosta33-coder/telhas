import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, ShoppingCart, Package } from "lucide-react";

const STATUS_CONFIG = {
  pendente:     { label: "Pendente",    className: "bg-slate-100 text-slate-600 border-slate-200" },
  em_producao:  { label: "Produzindo",  className: "bg-amber-100 text-amber-700 border-amber-200" },
  pausado:      { label: "Pausado",     className: "bg-purple-100 text-purple-700 border-purple-200" },
  finalizado:   { label: "Finalizado",  className: "bg-green-100 text-green-700 border-green-200" },
  cancelado:    { label: "Cancelado",   className: "bg-red-100 text-red-600 border-red-200" },
};

export default function OrdemMaquinaRow({ ordem, onUpdate, isGestor }) {
  const status = STATUS_CONFIG[ordem.status] || STATUS_CONFIG.pendente;

  return (
    <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{ordem.tipo_peca || "—"}</span>
            {ordem.dimensoes_livres && (
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">{ordem.dimensoes_livres}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            {ordem.chapa_origem === "chaparia" ? (
              <><Layers className="w-3 h-3 text-orange-500" /><span className="font-mono">{ordem.chapa_descricao || "Chapa do estoque"}</span></>
            ) : (
              <><Package className="w-3 h-3 text-blue-500" /><span className="font-mono">{ordem.bobina_descricao || ordem.chapa_descricao || "Bobina direta"}</span></>
            )}
          </div>
          {ordem.numero_pedido && (
            <div className="flex items-center gap-1 text-xs">
              <ShoppingCart className="w-3 h-3 text-blue-500" />
              <span className="font-bold text-blue-700">#{ordem.numero_pedido}</span>
              {ordem.cliente && <span className="text-muted-foreground">— {ordem.cliente}</span>}
            </div>
          )}
        </div>
        <Badge className={`border text-xs shrink-0 ${status.className}`}>{status.label}</Badge>
      </div>

      <div className="flex items-center gap-4 text-xs flex-wrap">
        <span className="text-muted-foreground">Qtd: <strong className="text-foreground">{ordem.quantidade || 0}</strong></span>
        {ordem.quantidade_produzida > 0 && (
          <span className="text-muted-foreground">Produzido: <strong className="text-green-600">{ordem.quantidade_produzida}</strong></span>
        )}
        {ordem.peso_kg > 0 && <span className="text-muted-foreground">Peso: <strong>{ordem.peso_kg}kg</strong></span>}
      </div>

      {ordem.observacoes && (
        <p className="text-xs text-muted-foreground italic border-l-2 border-orange-300 pl-2">{ordem.observacoes}</p>
      )}

      {isGestor && ordem.status === "pendente" && (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-xs"
            onClick={() => onUpdate(ordem.id, { status: "em_producao" })}>▶ Iniciar</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs text-red-500"
            onClick={() => onUpdate(ordem.id, { status: "cancelado" })}>Cancelar</Button>
        </div>
      )}
      {ordem.status === "em_producao" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
            onClick={() => onUpdate(ordem.id, { status: "pausado" })}>⏸ Pausar</Button>
          <Button size="sm" className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-xs"
            onClick={() => onUpdate(ordem.id, { status: "finalizado", data_finalizacao: new Date().toISOString().split("T")[0] })}>✓ Finalizar</Button>
        </div>
      )}
      {ordem.status === "pausado" && (
        <Button size="sm" className="w-full h-8 bg-amber-500 hover:bg-amber-600 text-xs"
          onClick={() => onUpdate(ordem.id, { status: "em_producao" })}>▶ Retomar</Button>
      )}
    </div>
  );
}