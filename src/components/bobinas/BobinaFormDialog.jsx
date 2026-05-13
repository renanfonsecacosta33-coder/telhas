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

const CORES = [
  "Natural", "Amadeirada 3D", "Amadeirada Lisa", "Azul - 5010", "Bege - 1015",
  "Branca - 9003", "Ceramica - 8023", "Chocolate - 8024", "Cinza - 7035",
  "Cinza - 7040", "Grafite - 7024", "Marrom - 8024", "Pinhão - 8012",
  "Preta - 9005", "Verde - 6002", "Verde - 6005", "Vermelho - 3000"
];

const ESPESSURAS = [
  "0,43 (NACIONAL)", "0,43 RVM", "0,50 (NACIONAL)", "0,65 (NACIONAL)",
  "0,43 (IMPORTADA)", "0,50 (IMPORTADA)", "0,65 (IMPORTADA)"
];

export default function BobinaFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState({
    cor: "", espessura: "", peso_kg: "", quantidade: "", observacoes: ""
  });

  useEffect(() => {
    if (editItem) {
      setForm({
        cor: editItem.cor || "",
        espessura: editItem.espessura || "",
        peso_kg: editItem.peso_kg || "",
        quantidade: editItem.quantidade || "",
        observacoes: editItem.observacoes || "",
      });
    } else {
      setForm({ cor: "", espessura: "", peso_kg: "", quantidade: "", observacoes: "" });
    }
  }, [editItem, open]);

  const handleSave = () => {
    const data = {
      ...form,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      quantidade: form.quantidade ? Number(form.quantidade) : undefined,
    };
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Bobina" : "Nova Bobina"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Cor *</Label>
            <Select value={form.cor} onValueChange={(v) => setForm({ ...form, cor: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a cor" />
              </SelectTrigger>
              <SelectContent>
                {CORES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Espessura *</Label>
            <Select value={form.espessura} onValueChange={(v) => setForm({ ...form, espessura: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a espessura" />
              </SelectTrigger>
              <SelectContent>
                {ESPESSURAS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.peso_kg}
                onChange={(e) => setForm({ ...form, peso_kg: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Anotações sobre esta bobina..."
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.cor || !form.espessura}>
            {editItem ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}