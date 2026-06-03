import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Package } from "lucide-react";

export default function HistoricoIsoporDialog({ open, onClose }) {
  const { data: usos = [], isLoading } = useQuery({
    queryKey: ["uso-isopor"],
    queryFn: () => base44.entities.UsoIsopor.list("-data_uso", 200),
    enabled: open,
  });

  const totalUsado = usos.reduce((s, u) => s + (u.quantidade || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Uso — Isopor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-4">
            <Package className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{totalUsado}</p>
              <p className="text-sm text-muted-foreground">placas utilizadas no total ({usos.length} registros)</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : usos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum uso registrado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {usos.map((uso) => (
                <div key={uso.id} className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        {uso.isopor_tipo || "—"}
                      </Badge>
                      <span className="font-bold text-orange-600">−{uso.quantidade} placas</span>
                    </div>
                    {uso.pedido_info && (
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        📦 {uso.pedido_info}
                      </p>
                    )}
                    {uso.observacoes && (
                      <p className="text-xs text-muted-foreground italic">{uso.observacoes}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">
                      {uso.data_uso
                        ? format(new Date(uso.data_uso + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {uso.created_date
                        ? format(new Date(uso.created_date), "HH:mm", { locale: ptBR })
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}