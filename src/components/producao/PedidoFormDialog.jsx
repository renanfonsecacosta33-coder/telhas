import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const MAQUINAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];
const PRODUTOS = ["TELHA", "TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA", "BOBININHA", "CUMEEIRA", "PAINEL"];
const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã"];
const TIPOS_EPS = ["EPS - TP 25", "EPS - TP 40", "EPS - TP 40 BANDEJA", "EPS - COLONIAL", "EPS - COLONIAL BANDEJA", "EPS - ONDULADO"];
const MAQUINARIOS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];
const BOBINAS_TIPOS = ["0,43 ( NACIONAL )", "0,43 RVM", "0,50 ( NACIONAL )", "0,65 ( NACIONAL )", "0,43 ( IMPORTADA )"];

const emptyForm = {
  data: format(new Date(), "yyyy-MM-dd"),
  unidade: "Matriz AJL",
  maquina: "",
  produto: "",
  cliente: "",
  vendedor: "",
  numero_pedido: "",
  bobina_superior: "",
  bobina_inferior: "",
  rvm_superior: "",
  rvm_inferior: "",
  eps: "",
  maquinario_superior: "",
  maquinario_inferior: "",
  kg_superior: "",
  kg_inferior: "",
  kg_total: "",
  metros: "",
  valor: "",
  metragem_utilizada: "",
  status: "pendente",
  data_pedido: "",
  data_prevista: "",
  observacoes: "",
};

export default function PedidoFormDialog({ open, onClose, onSave, editItem, defaultDate }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      if (editItem && !editItem._presets) {
        setForm({
          data: editItem.data || format(new Date(), "yyyy-MM-dd"),
          unidade: editItem.unidade || "Matriz AJL",
          maquina: editItem.maquina || "",
          produto: editItem.produto || "",
          cliente: editItem.cliente || "",
          vendedor: editItem.vendedor || "",
          numero_pedido: editItem.numero_pedido || "",
          bobina_superior: editItem.bobina_superior || "",
          bobina_inferior: editItem.bobina_inferior || "",
          rvm_superior: editItem.rvm_superior || "",
          rvm_inferior: editItem.rvm_inferior || "",
          eps: editItem.eps || "",
          maquinario_superior: editItem.maquinario_superior || "",
          maquinario_inferior: editItem.maquinario_inferior || "",
          kg_superior: editItem.kg_superior || "",
          kg_inferior: editItem.kg_inferior || "",
          kg_total: editItem.kg_total || "",
          metros: editItem.metros || "",
          valor: editItem.valor || "",
          metragem_utilizada: editItem.metragem_utilizada || "",
          status: editItem.status || "pendente",
          data_pedido: editItem.data_pedido || "",
          data_prevista: editItem.data_prevista || "",
          observacoes: editItem.observacoes || "",
        });
      } else {
        const presets = editItem?._presets || {};
        setForm({
          ...emptyForm,
          data: presets.data || defaultDate || format(new Date(), "yyyy-MM-dd"),
          maquina: presets.maquina || "",
        });
      }
    }
  }, [open, editItem, defaultDate]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleKgChange = (key, val) => {
    const newForm = { ...form, [key]: val };
    const sup = Number(newForm.kg_superior) || 0;
    const inf = Number(newForm.kg_inferior) || 0;
    newForm.kg_total = sup + inf || "";
    setForm(newForm);
  };

  const handleSave = () => {
    const data = {
      ...form,
      kg_superior: form.kg_superior ? Number(form.kg_superior) : undefined,
      kg_inferior: form.kg_inferior ? Number(form.kg_inferior) : undefined,
      kg_total: form.kg_total ? Number(form.kg_total) : undefined,
      metros: form.metros ? Number(form.metros) : undefined,
      valor: form.valor ? Number(form.valor) : undefined,
      metragem_utilizada: form.metragem_utilizada ? Number(form.metragem_utilizada) : undefined,
    };
    onSave(data);
  };

  const precisaEPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(form.produto);
  const precisaBobinaInferior = ["TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(form.produto);
  const isEditing = editItem && !editItem._presets;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Data, Unidade, Máquina */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Máquina *</Label>
              <Select value={form.maquina} onValueChange={v => set("maquina", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{MAQUINAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Produto *</Label>
              <Select value={form.produto} onValueChange={v => set("produto", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{PRODUTOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Vendedor / Cliente / Pedido */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Vendedor</Label>
              <Input placeholder="Ex: VERA (PG)" value={form.vendedor} onChange={e => set("vendedor", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nº Pedido</Label>
              <Input placeholder="283427" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
            </div>
          </div>

          {/* Bobinas */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold">Bobinas</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bobina Superior</Label>
                <Select value={form.bobina_superior} onValueChange={v => set("bobina_superior", v)}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>{BOBINAS_TIPOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RVM / Cor Superior</Label>
                <Input placeholder="Ex: NATURAL, Preta - 9005" value={form.rvm_superior} onChange={e => set("rvm_superior", e.target.value)} />
              </div>
            </div>
            {precisaBobinaInferior && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bobina Inferior</Label>
                  <Select value={form.bobina_inferior} onValueChange={v => set("bobina_inferior", v)}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>{BOBINAS_TIPOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">RVM / Cor Inferior</Label>
                  <Input placeholder="Ex: NATURAL" value={form.rvm_inferior} onChange={e => set("rvm_inferior", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* EPS (se aplicável) */}
          {precisaEPS && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo de EPS</Label>
                <Select value={form.eps} onValueChange={v => set("eps", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o EPS" /></SelectTrigger>
                  <SelectContent>{TIPOS_EPS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Maquinário Superior</Label>
                <Select value={form.maquinario_superior} onValueChange={v => set("maquinario_superior", v)}>
                  <SelectTrigger><SelectValue placeholder="Maquinário" /></SelectTrigger>
                  <SelectContent>{MAQUINARIOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* KG e Metros */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold">Quantidades</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">KG Superior</Label>
                <Input type="number" placeholder="0" value={form.kg_superior} onChange={e => handleKgChange("kg_superior", e.target.value)} />
              </div>
              {precisaBobinaInferior && (
                <div className="space-y-1">
                  <Label className="text-xs">KG Inferior</Label>
                  <Input type="number" placeholder="0" value={form.kg_inferior} onChange={e => handleKgChange("kg_inferior", e.target.value)} />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">KG Total</Label>
                <Input type="number" placeholder="0" value={form.kg_total} onChange={e => set("kg_total", e.target.value)} className="font-bold" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Metros *</Label>
                <Input type="number" placeholder="0" value={form.metros} onChange={e => set("metros", e.target.value)} className="font-bold border-primary/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" placeholder="0.00" value={form.valor} onChange={e => set("valor", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Metragem Utilizada Bobina</Label>
                <Input type="number" placeholder="0" value={form.metragem_utilizada} onChange={e => set("metragem_utilizada", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data do Pedido</Label>
              <Input type="date" value={form.data_pedido} onChange={e => set("data_pedido", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Prevista</Label>
              <Input type="date" value={form.data_prevista} onChange={e => set("data_prevista", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_producao">Em Produção</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Anotações..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} className="h-16" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.data || !form.maquina || !form.produto}>
            {isEditing ? "Salvar" : "Registrar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}