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

const CATEGORIAS = ["Bobininha", "Cumeeira", "Cola", "Consumivel"];

export default function ProdutoFormDialog({ open, onClose, onSave, editItem, defaultCategoria }) {
  const [form, setForm] = useState({
    categoria: "", nome: "", cor: "", quantidade: "", unidade: "", peso_kg: "", observacoes: ""
  });

  useEffect(() => {
    if (editItem) {
      setForm({
        categoria: editItem.categoria || "",
        nome: editItem.nome || "",
        cor: editItem.cor || "",
        quantidade: editItem.quantidade || "",
        unidade: editItem.unidade || "",
        peso_kg: editItem.peso_kg || "",
        observacoes: editItem.observacoes || "",
      });
    } else {
      setForm({
        categoria: defaultCategoria || "",
        nome: "", cor: "", quantidade: "", unidade: "", peso_kg: "", observacoes: ""
      });
    }
  }, [editItem, open, defaultCategoria]);

  const handleSave = () => {
    const data = {
      ...form,
      quantidade: form.quantidade ? Number(form.quantidade) : undefined,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
    };
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Produto" : "Novo Produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nome / Descrição *</Label>
            <Input
              placeholder="Ex: Cola PU, Parafuso 4.8x19..."
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Cor (opcional)</Label>
            <Input
              placeholder="Ex: Branca, Natural..."
              value={form.cor}
              onChange={(e) => setForm({ ...form, cor: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input
                placeholder="un, kg, m..."
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.peso_kg}
                onChange={(e) => setForm({ ...form, peso_kg: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Anotações..."
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.categoria || !form.nome}>
            {editItem ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}