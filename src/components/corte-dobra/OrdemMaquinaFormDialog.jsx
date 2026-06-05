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
import { Layers, Package } from "lucide-react";

const TIPOS_PECA = [
  "Perfil Serralheiro",
  "Perfil Estrutural Simples",
  "Perfil Estrutural Enrijecido",
  "Blank (Chapa cortada)",
  "Dobra simples",
  "Dobra dupla",
  "Caixa Basculante",
  "Frizada V",
  "Frizada U",
  "Tira Raiada",
  "Lambril Contínuo",
  "Outro (ver dimensões)",
];

const MAQUINAS_CD = [
  "CORTE 3M",
  "DOBRA 3M",
  "CORTE 6M",
  "DOBRA FUNDO 6M",
  "DOBRA INICIO 6M",
  "PERFILADEIRA",
];

export default function OrdemMaquinaFormDialog({ open, onClose, onSave, editItem, defaultDate, maquina: maquinaProp }) {
  const [form, setForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    maquina: maquinaProp || "",
    chapa_origem: "chaparia",
    chapa_cd_id: "",
    bobina_id: "",
    tipo_peca: "",
    dimensoes_livres: "",
    numero_pedido: "",
    cliente: "",
    quantidade: "",
    peso_kg: "",
    observacoes: "",
  });

  const { data: chapas = [] } = useQuery({
    queryKey: ["chapas-cd-disponiveis"],
    queryFn: () => base44.entities.ChapaCD.filter({ status: "disponivel" }),
    enabled: open && form.chapa_origem === "chaparia",
  });

  const { data: bobinasSliter = [] } = useQuery({
    queryKey: ["bobinas-sliter-cd"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false }),
    enabled: open && (form.chapa_origem === "direto" || form.maquina === "PERFILADEIRA"),
  });

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setForm({
        data: editItem.data || format(new Date(), "yyyy-MM-dd"),
        maquina: editItem.maquina || maquinaProp || "",
        chapa_origem: editItem.chapa_origem || "chaparia",
        chapa_cd_id: editItem.chapa_cd_id || "",
        bobina_id: editItem.bobina_id || "",
        tipo_peca: editItem.tipo_peca || "",
        dimensoes_livres: editItem.dimensoes_livres || "",
        numero_pedido: editItem.numero_pedido || "",
        cliente: editItem.cliente || "",
        quantidade: editItem.quantidade || "",
        peso_kg: editItem.peso_kg || "",
        observacoes: editItem.observacoes || "",
      });
    } else {
      setForm({
        data: defaultDate || format(new Date(), "yyyy-MM-dd"),
        maquina: maquinaProp || "",
        chapa_origem: maquinaProp === "PERFILADEIRA" ? "direto" : "chaparia",
        chapa_cd_id: "",
        bobina_id: "",
        tipo_peca: "",
        dimensoes_livres: "",
        numero_pedido: "",
        cliente: "",
        quantidade: "",
        peso_kg: "",
        observacoes: "",
      });
    }
  }, [open, editItem, defaultDate, maquinaProp]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const chapaObj = chapas.find(c => c.id === form.chapa_cd_id);
  const bobinaObj = bobinasSliter.find(b => b.id === form.bobina_id);

  const handleSave = () => {
    if (!form.maquina) { alert("Selecione a máquina."); return; }
    if (!form.tipo_peca) { alert("Informe o tipo de peça."); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade."); return; }

    const chapaSnap = chapaObj ? `${chapaObj.bobina_descricao || ""} · ${chapaObj.comprimento_mm}mm` : "";
    onSave({
      ...form,
      chapa_descricao: chapaSnap || bobinaObj?.codigo || "",
      bobina_descricao: bobinaObj ? `[${bobinaObj.codigo || "—"}] ${bobinaObj.chapa || ""} — ${bobinaObj.cor || ""}` : "",
      quantidade: Number(form.quantidade),
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
    });
  };

  const isPerfiladeira = form.maquina === "PERFILADEIRA";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Ordem" : `Nova Ordem${form.maquina ? ` — ${form.maquina}` : ""}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Máquina *</Label>
              <Select value={form.maquina} onValueChange={v => {
                set("maquina", v);
                if (v === "PERFILADEIRA") set("chapa_origem", "direto");
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {MAQUINAS_CD.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isPerfiladeira && (
            <div className="space-y-2">
              <Label>Origem da Chapa</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => set("chapa_origem", "chaparia")}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm transition-all ${form.chapa_origem === "chaparia" ? "border-orange-500 bg-orange-50" : "border-border hover:border-orange-300"}`}>
                  <Layers className={`w-4 h-4 ${form.chapa_origem === "chaparia" ? "text-orange-600" : "text-muted-foreground"}`} />
                  <span className={form.chapa_origem === "chaparia" ? "text-orange-700 font-semibold" : "text-muted-foreground"}>Do Estoque (Chaparia)</span>
                </button>
                <button type="button" onClick={() => set("chapa_origem", "direto")}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm transition-all ${form.chapa_origem === "direto" ? "border-blue-500 bg-blue-50" : "border-border hover:border-blue-300"}`}>
                  <Package className={`w-4 h-4 ${form.chapa_origem === "direto" ? "text-blue-600" : "text-muted-foreground"}`} />
                  <span className={form.chapa_origem === "direto" ? "text-blue-700 font-semibold" : "text-muted-foreground"}>Diretamente</span>
                </button>
              </div>
            </div>
          )}

          {form.chapa_origem === "chaparia" && !isPerfiladeira && (
            <div className="space-y-1">
              <Label>Chapa do Estoque (Chaparia)</Label>
              <Select value={form.chapa_cd_id} onValueChange={v => set("chapa_cd_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a chapa..." /></SelectTrigger>
                <SelectContent>
                  {chapas.length === 0 && <SelectItem value="_empty" disabled>Nenhuma chapa disponível</SelectItem>}
                  {chapas.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono text-sm">{c.bobina_descricao || "—"}</span>
                      <span className="text-muted-foreground ml-2">{c.comprimento_mm}mm</span>
                      <span className="text-green-600 ml-2">{c.quantidade_disponivel}pç</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {chapaObj && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-3 text-orange-800">
                  <span>Bobina: <strong>{chapaObj.bobina_descricao}</strong></span>
                  <span>Corte: <strong>{chapaObj.comprimento_mm}mm</strong></span>
                  <span>Disponível: <strong>{chapaObj.quantidade_disponivel} pç</strong></span>
                </div>
              )}
            </div>
          )}

          {(form.chapa_origem === "direto" || isPerfiladeira) && (
            <div className="space-y-1">
              <Label>{isPerfiladeira ? "Bobina Slitada *" : "Bobina (entrada direta)"}</Label>
              <Select value={form.bobina_id} onValueChange={v => set("bobina_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a bobina..." /></SelectTrigger>
                <SelectContent>
                  {bobinasSliter.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-mono font-bold">{b.codigo || "—"}</span>
                      {b.chapa && <span className="text-muted-foreground ml-2">{b.chapa}</span>}
                      {b.cor && <span className="text-blue-600"> — {b.cor}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Tipo de Peça *</Label>
            <Select value={form.tipo_peca} onValueChange={v => set("tipo_peca", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo de peça..." /></SelectTrigger>
              <SelectContent>
                {TIPOS_PECA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Dimensões / Especificações</Label>
            <Input placeholder="Ex: A=100 B=50 CH=1,25 · 6m" value={form.dimensoes_livres} onChange={e => set("dimensoes_livres", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Quantidade *</Label>
              <Input type="number" placeholder="0" value={form.quantidade} onChange={e => set("quantidade", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => set("peso_kg", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nº Pedido</Label>
              <Input placeholder="12345" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Cliente</Label>
            <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Instruções para o operador..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">{editItem ? "Salvar" : "Criar Ordem"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}