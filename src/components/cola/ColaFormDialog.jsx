import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TIPOS = ["Cola Termofusível", "Cola PUR", "Cola Base Água", "Cola Poliuretano", "Outro"];
const SACO_PESO_KG = 3.75;
const TAMBOR_PESO_KG = 200;

const emptyForm = {
  tipo: "",
  fornecedor: "",
  tambores_qtd: "",
  tambor_peso_kg: TAMBOR_PESO_KG,
  sacos_qtd: "",
  saco_peso_kg: SACO_PESO_KG,
  custo_tambor: "",
  lote: "",
  data_validade: "",
  observacoes: "",
};

export default function ColaFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      if (editItem) {
        setForm({
          tipo: editItem.tipo || "",
          fornecedor: editItem.fornecedor || "",
          tambores_qtd: editItem.tambores_qtd ?? "",
          tambor_peso_kg: editItem.tambor_peso_kg ?? TAMBOR_PESO_KG,
          sacos_qtd: editItem.sacos_qtd ?? "",
          saco_peso_kg: editItem.saco_peso_kg ?? SACO_PESO_KG,
          custo_tambor: editItem.custo_tambor ?? "",
          lote: editItem.lote || "",
          data_validade: editItem.data_validade || "",
          observacoes: editItem.observacoes || "",
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, editItem]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const sacosDosTambores = (Number(form.tambores_qtd) || 0) * Math.floor(TAMBOR_PESO_KG / SACO_PESO_KG);
  const totalSacos = (Number(form.sacos_qtd) || 0);
  const totalKg = totalSacos * (Number(form.saco_peso_kg) || SACO_PESO_KG);

  const handleSave = () => {
    if (!form.tipo) { alert("Selecione o tipo de cola."); return; }
    onSave({
      ...form,
      tambores_qtd: form.tambores_qtd !== "" ? Number(form.tambores_qtd) : 0,
      tambor_peso_kg: Number(form.tambor_peso_kg) || TAMBOR_PESO_KG,
      sacos_qtd: form.sacos_qtd !== "" ? Number(form.sacos_qtd) : 0,
      saco_peso_kg: Number(form.saco_peso_kg) || SACO_PESO_KG,
      custo_tambor: form.custo_tambor !== "" ? Number(form.custo_tambor) : undefined,
      kg_total: totalKg,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Cola" : "Nova Cola"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Tipo de Cola *</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input placeholder="Nome do fornecedor" value={form.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Lote / NF</Label>
              <Input placeholder="Ex: NF-12345" value={form.lote} onChange={(e) => set("lote", e.target.value)} />
            </div>
          </div>

          {/* Tambores */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">Tambores</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Qtd. Tambores</Label>
                <Input type="number" min="0" placeholder="0" value={form.tambores_qtd} onChange={(e) => set("tambores_qtd", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Peso por Tambor (kg)</Label>
                <Input type="number" min="1" value={form.tambor_peso_kg} onChange={(e) => set("tambor_peso_kg", e.target.value)} />
              </div>
            </div>
            {Number(form.tambores_qtd) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                {form.tambores_qtd} tambor(es) × {form.tambor_peso_kg}kg = <strong>{(Number(form.tambores_qtd) * Number(form.tambor_peso_kg)).toFixed(0)}kg</strong>
                <span className="ml-2 text-amber-600">≈ {sacosDosTambores} sacos de {SACO_PESO_KG}kg</span>
              </div>
            )}
          </div>

          {/* Sacos */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">Sacos em Estoque</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Qtd. Sacos</Label>
                <Input type="number" min="0" placeholder="0" value={form.sacos_qtd} onChange={(e) => set("sacos_qtd", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Peso por Saco (kg)</Label>
                <Input type="number" min="0.1" step="0.05" value={form.saco_peso_kg} onChange={(e) => set("saco_peso_kg", e.target.value)} />
              </div>
            </div>
            {totalSacos > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                Total em sacos: <strong>{totalSacos} sacos · {totalKg.toFixed(2)}kg</strong>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Custo por Tambor (R$)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.custo_tambor} onChange={(e) => set("custo_tambor", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data de Validade</Label>
              <Input type="date" value={form.data_validade} onChange={(e) => set("data_validade", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Observações opcionais..." value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} className="h-16" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{editItem ? "Salvar Alterações" : "Adicionar Cola"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}