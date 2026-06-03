import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Droplets } from "lucide-react";

export default function HistoricoColaDialog({ open, onClose }) {
  const { data: usos = [], isLoading } = useQuery({
    queryKey: ["usos-cola"],
    queryFn: () => base44.entities.UsosCola.list("-data_uso", 100),
    enabled: open,
  });

  const totalSacos = usos.reduce((s, u) => s + (u.sacos_usados || 0), 0);
  const totalKg = usos.reduce((s, u) => s + (u.kg_usados || 0), 0);
  const totalMetros = usos.reduce((s, u) => s + (u.metros_colados || 0), 0);
  const consumoMedio = totalMetros > 0 ? (totalKg / totalMetros).toFixed(3) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Uso de Cola</DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3 mb-2">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-orange-700">{totalSacos}</p>
            <p className="text-xs text-orange-600">sacos usados</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-amber-700">{totalKg.toFixed(1)}kg</p>
            <p className="text-xs text-amber-600">total consumido</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-blue-700">{consumoMedio ? `${consumoMedio}` : "—"}</p>
            <p className="text-xs text-blue-600">kg/m médio</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : usos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum uso registrado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {usos.map((uso) => (
              <div key={uso.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Droplets className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{uso.cola_tipo || "Cola"}</p>
                      {uso.pedido_info && (
                        <p className="text-xs text-muted-foreground">Pedido: {uso.pedido_info}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-orange-700">{uso.sacos_usados} sacos</p>
                    <p className="text-xs text-muted-foreground">{uso.kg_usados?.toFixed(2)}kg</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex gap-3">
                    {uso.metros_colados && <span>📏 {uso.metros_colados}m colados</span>}
                    {uso.metros_colados && uso.kg_usados && (
                      <span>≈ {(uso.kg_usados / uso.metros_colados).toFixed(3)} kg/m</span>
                    )}
                  </div>
                  <span>
                    {uso.data_uso
                      ? format(new Date(uso.data_uso), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </span>
                </div>
                {uso.observacoes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{uso.observacoes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}