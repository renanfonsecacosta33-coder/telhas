import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CORES = [
  "Natural", "Amadeirada 3D", "Amadeirada Lisa", "Azul - 5010", "Bege - 1015",
  "Branca - 9003", "Ceramica - 8023", "Chocolate - 8024", "Cinza - 7035",
  "Cinza - 7040", "Grafite - 7024", "Marrom - 8024", "Pinhão 8012",
  "Preta - 9005", "Verde - 6002", "Verde - 6005", "Vermelho - 3000"
];

const STATUS_OPTIONS = [
  "Aberta", "Fechada", "Finalizada", "Na TP40", "Na BOBININHA",
  "Matriz AJL", "Pinhais", "Ivaiporã", "Matriz - Frisada", "RESERVADA"
];

const QUALIDADE_OPTIONS = ["GV", "PP", "FF", "FQ"];

export default function BobinaFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState({
    cor: "", chapa: "", qualidade: "", largura_mm: "", peso_kg: "", peso_inicial: "",
    metragem: "", codigo: "", nf: "", custo: "", status: "", fornecedor: "",
    data_recebimento: "", observacoes: "", tipo: "Telha"
  });

  useEffect(() => {
    if (editItem) {
      setForm({
        cor: editItem.cor || "",
        chapa: editItem.chapa || "",
        qualidade: editItem.qualidade || "",
        largura_mm: editItem.largura_mm || "",
        peso_kg: editItem.peso_kg || "",
        peso_inicial: editItem.peso_inicial || "",
        metragem: editItem.metragem || "",
        codigo: editItem.codigo || "",
        nf: editItem.nf || "",
        custo: editItem.custo || "",
        status: editItem.status || "",
        fornecedor: editItem.fornecedor || "",
        data_recebimento: editItem.data_recebimento || "",
        observacoes: editItem.observacoes || "",
        tipo: "Telha",
      });
    } else {
      setForm({ cor: "", chapa: "", qualidade: "", largura_mm: "", peso_kg: "", peso_inicial: "", metragem: "", codigo: "", nf: "", custo: "", status: "", fornecedor: "", data_recebimento: "", observacoes: "", tipo: "Telha" });
    }
  }, [editItem, open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Auto-gera código: AAММ + 4 últimos dígitos da NF
  const gerarCodigo = (nf) => {
    if (!nf) return "";
    const now = new Date();
    const ano = String(now.getFullYear()).slice(2);
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const nfStr = String(nf).replace(/\D/g, "");
    const ultimos4 = nfStr.slice(-4).padStart(4, "0");
    return `${ano}${mes}${ultimos4}`;
  };

  const handleNFChange = (val) => {
    set("nf", val);
    if (val && !editItem) {
      set("codigo", gerarCodigo(val));
    }
  };

  const handleSave = () => {
    onSave({
      ...form,
      largura_mm: form.largura_mm ? Number(form.largura_mm) : undefined,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      peso_inicial: form.peso_inicial ? Number(form.peso_inicial) : undefined,
      metragem: form.metragem ? Number(form.metragem) : undefined,
      custo: form.custo ? Number(form.custo) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Bobina" : "Nova Bobina"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cor / RVM *</Label>
              <Select value={form.cor} onValueChange={(v) => set("cor", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CORES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Chapa *</Label>
              <Input placeholder="Ex: 0,43" value={form.chapa} onChange={e => set("chapa", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Qualidade</Label>
              <Select value={form.qualidade} onValueChange={(v) => set("qualidade", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{QUALIDADE_OPTIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Peso Líquido (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => set("peso_kg", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso Inicial (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_inicial} onChange={e => set("peso_inicial", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Largura (mm)</Label>
              <Input type="number" placeholder="1200" value={form.largura_mm} onChange={e => set("largura_mm", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Metragem (m)</Label>
              <Input type="number" placeholder="0" value={form.metragem} onChange={e => set("metragem", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código (auto)</Label>
              <Input placeholder="Preenchido automático pela NF" value={form.codigo} onChange={e => set("codigo", e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label>NF</Label>
              <Input placeholder="Número da NF" value={form.nf} onChange={e => handleNFChange(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input placeholder="Ex: Arcelormittal" value={form.fornecedor} onChange={e => set("fornecedor", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Custo (R$/kg)</Label>
              <Input type="number" placeholder="0.00" value={form.custo} onChange={e => set("custo", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Data de Recebimento</Label>
            <Input type="date" value={form.data_recebimento} onChange={e => set("data_recebimento", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Anotações..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.cor || !form.chapa}>{editItem ? "Salvar" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}