import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Pause, Play, CheckCircle2, Save, Timer, Factory, Ruler } from "lucide-react";
import { toast } from "sonner";
import { calcularMetrosPedido } from "@/lib/metrosHelper";

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function QuickActionDialogTelhas({ order, open, onClose, onUpdate }) {
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (order) setObs(order.observacoes || order.obs || "");
  }, [order]);

  if (!order) return null;

  const isProducao = order.status === "em_producao";
  const isPausado = order.status === "pausado";
  const metros = calcularMetrosPedido(order);

  const handleStatus = (status) => {
    const patch = { status };
    if (status === "finalizado" && !order.data_finalizacao) {
      patch.data_finalizacao = new Date().toISOString().split("T")[0];
    }
    onUpdate(order, patch);
    toast.success(status === "em_producao" ? "Ordem retomada!" : status === "pausado" ? "Ordem pausada!" : "Ordem finalizada!");
    onClose();
  };

  const handleSaveObs = () => {
    onUpdate(order, { observacoes: obs });
    toast.success("Observação salva!");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-blue-600" />
            <span>{order.maquina || "Perfiladeira de Telhas"}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white truncate">{order.produto || "Telha"}</span>
              <Badge className={isProducao ? "bg-blue-100 text-blue-700 border-blue-300" : isPausado ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-green-100 text-green-700 border-green-300"}>
                {isProducao ? "Produzindo" : isPausado ? "Pausado" : order.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{order.cliente ? `${order.cliente}` : "Sem cliente"} · #{order.numero_pedido || "S/N"}</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{metros.toFixed(1)}m ({order.quantidade || order.quantidade_telhas || 1} telhas)</span>
            </div>
            {order.tempo_producao_seg > 0 && (
              <div className="flex items-center gap-1 text-xs text-slate-500 pt-1 border-t border-border/50">
                <Timer className="w-3.5 h-3.5" />
                <span>Tempo de produção: <strong>{formatTempo(order.tempo_producao_seg)}</strong></span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Observação rápida da máquina</label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Pausado para troca de bobina, ajuste de corte..."
              className="text-xs h-20 resize-none"
            />
          </div>

          <div className="flex gap-2">
            {isProducao && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-amber-600 border-amber-300 hover:bg-amber-50 cursor-pointer"
                onClick={() => handleStatus("pausado")}
              >
                <Pause className="w-3.5 h-3.5 mr-1" /> Pausar
              </Button>
            )}
            {isPausado && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50 cursor-pointer"
                onClick={() => handleStatus("em_producao")}
              >
                <Play className="w-3.5 h-3.5 mr-1" /> Retomar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-green-600 border-green-300 hover:bg-green-50 cursor-pointer"
              onClick={() => handleStatus("finalizado")}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Finalizar
            </Button>
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="cursor-pointer">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSaveObs} className="gap-1 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="w-3.5 h-3.5" /> Salvar Obs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
