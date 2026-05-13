import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIPOS = [
  "EPS - TP 25",
  "EPS - TP 40",
  "EPS - TP 40 BANDEJA",
  "EPS - COLONIAL",
  "EPS - COLONIAL BANDEJA",
  "EPS - ONDULADO",
];

export default function IsoporFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState({
    tipo: "", espessura_mm: "", quantidade: "", metragem_total: "", observacoes: ""
  });

  useEffect(() => {
    if (editItem) {
      setForm({
        tipo: editItem.tipo || "",
        espessura_mm: editItem.espessura_mm || "",
        quantidade: editItem.quantidade || "",
        metragem_total: editItem.metragem_total || "",
        observacoes: editItem.observacoes || "",
      });
    } else {
      setForm({ tipo: "", espessura_mm: "", quantidade: "", metragem_total: "", observacoes: "" });
    }
  }, [editItem, open]);

  // Auto-calculate metragem when quantidade changes (each unit = 2m)
  const handleQuantidadeChange = (val) => {
    const qty = val ? Number(val) : "";
    setForm({
      ...form,
      quantidade: val,
      metragem_total: qty ? qty * 2 : "",
    });
  };

  const handleSave = () => {
    const data = {
      ...form,
      espessura_mm: form.espessura_mm ? Number(form.espessura_mm) : undefined,
      quantidade: form.quantidade ? Number(form.quantidade) : undefined,
      metragem_total: form.metragem_total ? Number(form.metragem_total) : undefined,
    };
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Isopor" : "Novo Isopor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Espessura (mm)</Label>
            <Input
              type="number"
              placeholder="Ex: 30"
              value={form.espessura_mm}
              onChange={(e) => setForm({ ...form, espessura_mm: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantidade (un)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.quantidade}
                onChange={(e) => handleQuantidadeChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Metragem total (m)</Label>
              <Input
                type="number"
                placeholder="Auto: qtd × 2m"
                value={form.metragem_total}
                onChange={(e) => setForm({ ...form, metragem_total: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Cada unidade = 2m (2000mm)</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Anotações sobre este isopor..."
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.tipo}>
            {editItem ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}