import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

export default function UsarIsoporDialog({ open, onClose, onConfirm, isopores }) {
  const [form, setForm] = useState({
    isopor_id: "",
    pedido_id: "",
    quantidade: "",
    data_uso: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-uso-isopor"],
    queryFn: () => base44.entities.Pedido.list("-data", 200),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm({
        isopor_id: "",
        pedido_id: "",
        quantidade: "",
        data_uso: format(new Date(), "yyyy-MM-dd"),
        observacoes: "",
      });
    }
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isoporSelecionado = isopores.find((i) => i.id === form.isopor_id);
  const pedidoSelecionado = pedidos.find((p) => p.id === form.pedido_id);

  const handleConfirm = () => {
    if (!form.isopor_id) { alert("Selecione o tipo de isopor."); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade."); return; }
    if (isoporSelecionado && Number(form.quantidade) > (isoporSelecionado.quantidade || 0)) {
      alert(`Estoque insuficiente! Disponível: ${isoporSelecionado.quantidade} unidades.`);
      return;
    }

    const pedidoInfo = pedidoSelecionado
      ? `${pedidoSelecionado.cliente || "Sem cliente"} — ${pedidoSelecionado.produto || ""} — ${pedidoSelecionado.data || ""}`
      : "";

    onConfirm({
      isopor_id: form.isopor_id,
      isopor_tipo: isoporSelecionado?.tipo || "",
      pedido_id: form.pedido_id || undefined,
      pedido_info: pedidoInfo,
      quantidade: Number(form.quantidade),
      data_uso: form.data_uso,
      observacoes: form.observacoes,
    }, isoporSelecionado);
  };

  // Pedidos recentes (últimos 60 dias) não finalizados/cancelados
  const pedidosAtivos = pedidos.filter(
    (p) => p.status !== "cancelado" && p.status !== "finalizado"
  ).slice(0, 100);

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
                    <span className="text-muted-foreground text-xs ml-2">· {iso.quantidade || 0} un em estoque</span>
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

          {/* Pedido vinculado (opcional) */}
          <div className="space-y-1">
            <Label>Pedido Vinculado <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Select value={form.pedido_id} onValueChange={(v) => set("pedido_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um pedido..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_sem_pedido">Sem pedido vinculado</SelectItem>
                {pedidosAtivos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.cliente || "Sem cliente"}</span>
                    {p.produto && <span className="text-muted-foreground text-xs ml-2">· {p.produto}</span>}
                    {p.data && <span className="text-muted-foreground text-xs ml-2">· {p.data}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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