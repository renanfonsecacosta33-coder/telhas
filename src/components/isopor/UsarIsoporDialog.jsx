import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function UsarIsoporDialog({ open, onClose, onConfirm, isopores }) {
  const [form, setForm] = useState({
    isopor_id: "",
    numero_pedido: "",
    quantidade: "",
    data_uso: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        isopor_id: "",
        numero_pedido: "",
        quantidade: "",
        data_uso: format(new Date(), "yyyy-MM-dd"),
        observacoes: "",
      });
    }
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isoporSelecionado = isopores.find((i) => i.id === form.isopor_id);

  const handleConfirm = () => {
    if (!form.isopor_id) { alert("Selecione o tipo de isopor."); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade."); return; }
    if (isoporSelecionado && Number(form.quantidade) > (isoporSelecionado.quantidade || 0)) {
      alert(`Estoque insuficiente! Disponível: ${isoporSelecionado.quantidade} unidades.`);
      return;
    }

    onConfirm({
      isopor_id: form.isopor_id,
      isopor_tipo: isoporSelecionado?.tipo || "",
      pedido_info: form.numero_pedido || "",
      quantidade: Number(form.quantidade),
      data_uso: form.data_uso,
      observacoes: form.observacoes,
    }, isoporSelecionado);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Usar Isopor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de Isopor */}
          <div className="space-y-1">
            <Label>Tipo de Isopor *</Label>
            <Select value={form.isopor_id} onValueChange={(v) => set("isopor_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {isopores.map((iso) => (
                  <SelectItem key={iso.id} value={iso.id}>
                    <span className="font-medium">{iso.tipo}</span>
                    {iso.espessura_mm && <span className="text-muted-foreground text-xs ml-2">· {iso.espessura_mm}mm</span>}
                    <span className="text-muted-foreground text-xs ml-2">· {iso.quantidade || 0} un</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isoporSelecionado && (
              <p className="text-xs text-muted-foreground">
                Estoque atual: <strong>{isoporSelecionado.quantidade || 0} unidades</strong>
                {isoporSelecionado.metragem_total ? ` · ${isoporSelecionado.metragem_total}m` : ""}
              </p>
            )}
          </div>

          {/* Quantidade */}
          <div className="space-y-1">
            <Label>Quantidade de Placas *</Label>
            <Input
              type="number"
              min="1"
              placeholder="Ex: 10"
              value={form.quantidade}
              onChange={(e) => set("quantidade", e.target.value)}
            />
            {form.quantidade && isoporSelecionado && (
              <p className="text-xs text-primary font-medium">
                Restará: {(isoporSelecionado.quantidade || 0) - Number(form.quantidade)} unidades no estoque
              </p>
            )}
          </div>

          {/* Número do Pedido (texto livre) */}
          <div className="space-y-1">
            <Label>Número do Pedido <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              placeholder="Ex: 283427"
              value={form.numero_pedido}
              onChange={(e) => set("numero_pedido", e.target.value)}
            />
          </div>

          {/* Data */}
          <div className="space-y-1">
            <Label>Data do Uso</Label>
            <Input type="date" value={form.data_uso} onChange={(e) => set("data_uso", e.target.value)} />
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações opcionais..."
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              className="h-16"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} className="bg-orange-600 hover:bg-orange-700">
            Confirmar Uso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}