import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

const SACO_PESO_KG = 3.75;

export default function UsarColaDialog({ open, onClose, onConfirm, colas }) {
  const [form, setForm] = useState({
    cola_id: "",
    pedido_info: "",
    sacos_usados: "",
    metros_colados: "",
    data_uso: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        cola_id: "",
        pedido_info: "",
        sacos_usados: "",
        metros_colados: "",
        data_uso: format(new Date(), "yyyy-MM-dd"),
        observacoes: "",
      });
    }
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const colaSelecionada = colas.find((c) => c.id === form.cola_id);
  const sacosUsados = Number(form.sacos_usados) || 0;
  const kgUsados = sacosUsados * SACO_PESO_KG;
  const sacosRestantes = (colaSelecionada?.sacos_qtd || 0) - sacosUsados;

  const consumoPorMetro = form.metros_colados && sacosUsados > 0
    ? (kgUsados / Number(form.metros_colados)).toFixed(3)
    : null;

  const handleConfirm = () => {
    if (!form.cola_id) { alert("Selecione o tipo de cola."); return; }
    if (!form.sacos_usados || sacosUsados <= 0) { alert("Informe a quantidade de sacos."); return; }
    if (colaSelecionada && sacosUsados > (colaSelecionada.sacos_qtd || 0)) {
      alert(`Estoque insuficiente! Disponível: ${colaSelecionada.sacos_qtd} sacos.`);
      return;
    }
    onConfirm({
      cola_id: form.cola_id,
      cola_tipo: colaSelecionada?.tipo || "",
      pedido_info: form.pedido_info || "",
      sacos_usados: sacosUsados,
      kg_usados: kgUsados,
      metros_colados: form.metros_colados ? Number(form.metros_colados) : undefined,
      data_uso: form.data_uso,
      observacoes: form.observacoes,
    }, colaSelecionada);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Uso de Cola</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Tipo de Cola *</Label>
            <Select value={form.cola_id} onValueChange={(v) => set("cola_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {colas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-medium">{c.tipo}</span>
                    <span className="text-muted-foreground text-xs ml-2">· {c.sacos_qtd || 0} sacos</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {colaSelecionada && (
              <p className="text-xs text-muted-foreground">
                Estoque: <strong>{colaSelecionada.sacos_qtd || 0} sacos</strong>
                {colaSelecionada.kg_total ? ` · ${colaSelecionada.kg_total.toFixed(1)}kg` : ""}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sacos Usados *</Label>
              <Input type="number" min="1" placeholder="0" value={form.sacos_usados} onChange={(e) => set("sacos_usados", e.target.value)} />
              {sacosUsados > 0 && (
                <p className="text-xs text-primary font-medium">{kgUsados.toFixed(2)}kg</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Metros Colados</Label>
              <Input type="number" min="0" placeholder="0" value={form.metros_colados} onChange={(e) => set("metros_colados", e.target.value)} />
              {consumoPorMetro && (
                <p className="text-xs text-muted-foreground">{consumoPorMetro} kg/m</p>
              )}
            </div>
          </div>

          {sacosUsados > 0 && colaSelecionada && (
            <div className={`border rounded-xl px-3 py-2.5 flex items-center justify-between ${sacosRestantes >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Saldo após uso</p>
                <p className="text-xs text-muted-foreground">{colaSelecionada.sacos_qtd} − {sacosUsados}</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-black ${sacosRestantes >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {sacosRestantes}
                </p>
                <p className="text-xs text-muted-foreground">sacos restantes</p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Pedido / Referência <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input placeholder="Ex: OP-283427" value={form.pedido_info} onChange={(e) => set("pedido_info", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Data do Uso</Label>
            <Input type="date" value={form.data_uso} onChange={(e) => set("data_uso", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Observações opcionais..." value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} className="h-16" />
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