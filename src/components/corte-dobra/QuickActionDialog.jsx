import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Pause, Play, CheckCircle2, Save, Timer, Factory } from "lucide-react";
import { toast } from "sonner";

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function QuickActionDialog({ order, open, onClose, onUpdate }) {
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (order) setObs(order.observacoes || "");
  }, [order]);

  if (!order) return null;

  const isProducao = order.status === "em_producao";
  const isPausado = order.status === "pausado";

  const handleStatus = (status) => {
    onUpdate(order, { status });
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
            <Factory className="w-5 h-5 text-orange-500" />
            {order.maquina}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{order.tipo_peca || order.bobina_descricao || "—"}</span>
              <Badge className={isProducao ? "bg-orange-100 text-orange-700 border-orange-300" : "bg-amber-100 text-amber-700 border-amber-300"}>
                {isProducao ? "Produzindo" : "Pausado"}
              </Badge>
            </div>
            <p className="text-muted-foreground">{order.quantidade} peças{order.cliente ? ` · ${order.cliente}` : ""}</p>
            {order.tempo_producao_seg > 0 && (
              <p className="flex items-center gap-1 text-muted-foreground"><Timer className="w-3 h-3" />{formatTempo(order.tempo_producao_seg)}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Observações</label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Adicionar observação..." rows={3} />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {isProducao && (
            <Button variant="outline" className="gap-1.5 flex-1 cursor-pointer" onClick={() => handleStatus("pausado")}>
              <Pause className="w-4 h-4" /> Pausar
            </Button>
          )}
          {isPausado && (
            <Button variant="outline" className="gap-1.5 flex-1 cursor-pointer" onClick={() => handleStatus("em_producao")}>
              <Play className="w-4 h-4" /> Retomar
            </Button>
          )}
          <Button className="gap-1.5 flex-1 bg-green-600 hover:bg-green-700 cursor-pointer" onClick={() => handleStatus("finalizado")}>
            <CheckCircle2 className="w-4 h-4" /> Finalizar
          </Button>
          <Button variant="secondary" className="gap-1.5 cursor-pointer" onClick={handleSaveObs}>
            <Save className="w-4 h-4" /> Salvar Obs.
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}