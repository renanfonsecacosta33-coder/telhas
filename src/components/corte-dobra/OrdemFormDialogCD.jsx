import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

function labelBobina(b) {
  const codigo = b.codigo ? `[${b.codigo}] ` : "";
  const cor = b.cor ? ` — ${b.cor}` : "";
  const chapa = b.chapa || "";
  const peso = b.peso_kg ? ` · ${b.peso_kg}kg` : "";
  return `${codigo}${chapa}${cor}${peso}`;
}

export default function OrdemFormDialogCD({ open, onClose, onSave, editItem, defaultDate }) {
  const [form, setForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    bobina_id: "",
    comprimento_mm: "",
    quantidade: "",
    observacoes: "",
  });

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-cd-ativas"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setForm({
        data: editItem.data || format(new Date(), "yyyy-MM-dd"),
        bobina_id: editItem.bobina_id || "",
        comprimento_mm: editItem.comprimento_mm || "",
        quantidade: editItem.quantidade || "",
        observacoes: editItem.observacoes || "",
      });
    } else {
      setForm({
        data: defaultDate || format(new Date(), "yyyy-MM-dd"),
        bobina_id: "",
        comprimento_mm: "",
        quantidade: "",
        observacoes: "",
      });
    }
  }, [open, editItem, defaultDate]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const bobinaObj = bobinas.find(b => b.id === form.bobina_id);

  const handleSave = () => {
    if (!form.bobina_id) { alert("Selecione a bobina."); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade de peças."); return; }
    const bobinaSnap = bobinaObj ? labelBobina(bobinaObj) : "";
    onSave({
      ...form,
      bobina_descricao: bobinaSnap,
      comprimento_mm: form.comprimento_mm ? Number(form.comprimento_mm) : undefined,
      quantidade: Number(form.quantidade),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Ordem" : "Nova Ordem — Desbobinadeira"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Quantidade de Peças *</Label>
              <Input type="number" placeholder="0" value={form.quantidade} onChange={e => set("quantidade", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Bobina do Estoque *</Label>
            <Select value={form.bobina_id} onValueChange={v => set("bobina_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione a bobina..." /></SelectTrigger>
              <SelectContent>
                {bobinas.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    <span className="font-mono font-bold">{b.codigo || "—"}</span>
                    {b.chapa && <span className="text-muted-foreground ml-2">{b.chapa}</span>}
                    {b.cor && <span className="text-blue-600"> — {b.cor}</span>}
                    {b.peso_kg && <span className="text-muted-foreground text-xs"> · {b.peso_kg}kg</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bobinaObj && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex flex-wrap gap-3">
                <span>Cód: <strong>{bobinaObj.codigo || "—"}</strong></span>
                <span>Chapa: <strong>{bobinaObj.chapa || "—"}</strong></span>
                <span>Cor: <strong>{bobinaObj.cor || "—"}</strong></span>
                <span>Estoque: <strong>{bobinaObj.peso_kg || 0}kg</strong></span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Comprimento de Corte (mm)</Label>
            <Input type="number" placeholder="Ex: 1200" value={form.comprimento_mm} onChange={e => set("comprimento_mm", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Observações / Instruções</Label>
            <Textarea placeholder="Instruções para o operador..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{editItem ? "Salvar" : "Criar Ordem"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}