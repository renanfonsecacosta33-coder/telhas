import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const MAQUINAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];
const PRODUTOS = ["TELHA", "TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA", "BOBININHA", "CUMEEIRA", "PAINEL"];
const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã"];
const TIPOS_EPS = ["EPS - TP 25", "EPS - TP 40", "EPS - TP 40 BANDEJA", "EPS - COLONIAL", "EPS - COLONIAL BANDEJA", "EPS - ONDULADO"];

// Peso por metro por espessura
const KG_POR_METRO = {
  "0,43": 3.65,
  "0,43 RVM": 3.80,
  "0,50": 4.40,
  "0,65": 5.80,
};

function getPesoMetro(bobina) {
  if (!bobina) return null;
  // Extrai a espessura da bobina selecionada
  if (bobina.chapa === "0,43" && bobina.qualidade === "RVM") return 3.80;
  if (bobina.chapa === "0,43") return 3.65;
  if (bobina.chapa === "0,50") return 4.40;
  if (bobina.chapa === "0,65") return 5.80;
  return null;
}

const emptyForm = {
  data: format(new Date(), "yyyy-MM-dd"),
  unidade: "Matriz AJL",
  maquina: "",
  produto: "",
  modelo: "",
  cliente: "",
  vendedor: "",
  numero_pedido: "",
  bobina_superior_id: "",
  bobina_superior: "",
  bobina_inferior_id: "",
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
  metros_realizados: "",
  valor: "",
  status: "pendente",
  data_pedido: "",
  data_prevista: "",
  observacoes: "",
};

export default function PedidoFormDialog({ open, onClose, onSave, editItem, defaultDate }) {
  const [form, setForm] = useState(emptyForm);

  // Busca bobinas do estoque (não arquivadas)
  const { data: bobinasEstoque = [] } = useQuery({
    queryKey: ["bobinas-ativas"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false }, "cor", 200),
    enabled: open,
  });

  const isEditing = editItem && !editItem._presets;

  useEffect(() => {
    if (open) {
      if (isEditing) {
        setForm({
          data: editItem.data || format(new Date(), "yyyy-MM-dd"),
          unidade: editItem.unidade || "Matriz AJL",
          maquina: editItem.maquina || "",
          produto: editItem.produto || "",
          modelo: editItem.modelo || "",
          cliente: editItem.cliente || "",
          vendedor: editItem.vendedor || "",
          numero_pedido: editItem.numero_pedido || "",
          bobina_superior_id: editItem.bobina_superior_id || "",
          bobina_superior: editItem.bobina_superior || "",
          bobina_inferior_id: editItem.bobina_inferior_id || "",
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
          metros_realizados: editItem.metros_realizados || "",
          valor: editItem.valor || "",
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

  // Seleção de bobina superior — preenche cor/espessura automaticamente e calcula KG
  const handleBobinaSupChange = (bobinaId) => {
    const bobina = bobinasEstoque.find(b => b.id === bobinaId);
    const pesoMetro = getPesoMetro(bobina);
    const metros = Number(form.metros) || 0;
    const kgSup = pesoMetro && metros ? +(pesoMetro * metros).toFixed(2) : "";
    const kgInf = Number(form.kg_inferior) || 0;
    setForm(f => ({
      ...f,
      bobina_superior_id: bobinaId,
      bobina_superior: bobina ? `${bobina.chapa} (${bobina.qualidade || "NACIONAL"})` : "",
      rvm_superior: bobina ? (bobina.cor || "") : f.rvm_superior,
      kg_superior: kgSup,
      kg_total: kgSup ? +(kgSup + kgInf).toFixed(2) : (kgInf || ""),
    }));
  };

  // Seleção de bobina inferior
  const handleBobinaInfChange = (bobinaId) => {
    const bobina = bobinasEstoque.find(b => b.id === bobinaId);
    const pesoMetro = getPesoMetro(bobina);
    const metros = Number(form.metros) || 0;
    const kgInf = pesoMetro && metros ? +(pesoMetro * metros).toFixed(2) : "";
    const kgSup = Number(form.kg_superior) || 0;
    setForm(f => ({
      ...f,
      bobina_inferior_id: bobinaId,
      bobina_inferior: bobina ? `${bobina.chapa} (${bobina.qualidade || "NACIONAL"})` : "",
      rvm_inferior: bobina ? (bobina.cor || "") : f.rvm_inferior,
      kg_inferior: kgInf,
      kg_total: kgInf ? +(kgSup + kgInf).toFixed(2) : (kgSup || ""),
    }));
  };

  // Quando metros muda, recalcula KG automaticamente
  const handleMetrosChange = (val) => {
    const metros = Number(val) || 0;
    const bobinaSup = bobinasEstoque.find(b => b.id === form.bobina_superior_id);
    const bobinaInf = bobinasEstoque.find(b => b.id === form.bobina_inferior_id);
    const pesoSup = getPesoMetro(bobinaSup);
    const pesoInf = getPesoMetro(bobinaInf);
    const kgSup = pesoSup && metros ? +(pesoSup * metros).toFixed(2) : (form.kg_superior || "");
    const kgInf = pesoInf && metros ? +(pesoInf * metros).toFixed(2) : (form.kg_inferior || "");
    setForm(f => ({
      ...f,
      metros: val,
      kg_superior: kgSup,
      kg_inferior: kgInf,
      kg_total: (Number(kgSup) + Number(kgInf)) || "",
    }));
  };

  const handleSave = () => {
    const data = {
      ...form,
      kg_superior: form.kg_superior ? Number(form.kg_superior) : undefined,
      kg_inferior: form.kg_inferior ? Number(form.kg_inferior) : undefined,
      kg_total: form.kg_total ? Number(form.kg_total) : undefined,
      metros: form.metros ? Number(form.metros) : undefined,
      metros_realizados: form.metros_realizados ? Number(form.metros_realizados) : undefined,
      valor: form.valor ? Number(form.valor) : undefined,
    };
    onSave(data);
  };

  const precisaEPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(form.produto);
  const precisaBobinaInferior = ["TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(form.produto);

  // Bobina selecionada para exibir chip com info
  const bobinaSelecionadaSup = bobinasEstoque.find(b => b.id === form.bobina_superior_id);
  const bobinaSelecionadaInf = bobinasEstoque.find(b => b.id === form.bobina_inferior_id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Data / Máquina / Produto / Modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Select value={form.unidade} onValueChange={v => set("unidade", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
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
            <div className="space-y-1">
              <Label>Modelo</Label>
              <Input placeholder="Ex: TP-40, Colonial..." value={form.modelo} onChange={e => set("modelo", e.target.value)} />
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

          {/* Bobinas do estoque */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold">Bobinas</p>

            {/* Bobina Superior */}
            <div className="space-y-2">
              <Label className="text-xs">Bobina Superior</Label>
              <Select value={form.bobina_superior_id} onValueChange={handleBobinaSupChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar do estoque..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {bobinasEstoque.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-mono font-semibold">{b.chapa}</span>
                      {" · "}
                      <span>{b.cor || "—"}</span>
                      {b.qualidade && <span className="text-muted-foreground ml-1">({b.qualidade})</span>}
                      {b.codigo && <span className="text-muted-foreground ml-2 text-xs">{b.codigo}</span>}
                      {b.metragem_restante > 0 && (
                        <span className="text-green-600 ml-2 text-xs">{b.metragem_restante}m</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bobinaSelecionadaSup && (
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-xs">Espessura: {bobinaSelecionadaSup.chapa}</Badge>
                  {bobinaSelecionadaSup.cor && <Badge variant="outline" className="text-xs">Cor: {bobinaSelecionadaSup.cor}</Badge>}
                  {bobinaSelecionadaSup.qualidade && <Badge variant="outline" className="text-xs">{bobinaSelecionadaSup.qualidade}</Badge>}
                  {bobinaSelecionadaSup.fornecedor && <Badge variant="outline" className="text-xs">{bobinaSelecionadaSup.fornecedor}</Badge>}
                  {getPesoMetro(bobinaSelecionadaSup) && (
                    <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {getPesoMetro(bobinaSelecionadaSup)} kg/m
                    </Badge>
                  )}
                </div>
              )}
              {/* RVM/Cor manual — pré-preenchida mas editável */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">RVM / Cor Superior (editável)</Label>
                <Input placeholder="Ex: NATURAL, Preta - 9005" value={form.rvm_superior} onChange={e => set("rvm_superior", e.target.value)} />
              </div>
            </div>

            {precisaBobinaInferior && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="text-xs">Bobina Inferior</Label>
                <Select value={form.bobina_inferior_id} onValueChange={handleBobinaInfChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar do estoque..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {bobinasEstoque.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="font-mono font-semibold">{b.chapa}</span>
                        {" · "}
                        <span>{b.cor || "—"}</span>
                        {b.qualidade && <span className="text-muted-foreground ml-1">({b.qualidade})</span>}
                        {b.metragem_restante > 0 && (
                          <span className="text-green-600 ml-2 text-xs">{b.metragem_restante}m</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bobinaSelecionadaInf && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs">Espessura: {bobinaSelecionadaInf.chapa}</Badge>
                    {bobinaSelecionadaInf.cor && <Badge variant="outline" className="text-xs">Cor: {bobinaSelecionadaInf.cor}</Badge>}
                    {getPesoMetro(bobinaSelecionadaInf) && (
                      <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {getPesoMetro(bobinaSelecionadaInf)} kg/m
                      </Badge>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">RVM / Cor Inferior (editável)</Label>
                  <Input placeholder="Ex: NATURAL" value={form.rvm_inferior} onChange={e => set("rvm_inferior", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* EPS se aplicável */}
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
                <Label>Maquinário</Label>
                <Input placeholder="Ex: TP - 40" value={form.maquinario_superior} onChange={e => set("maquinario_superior", e.target.value)} />
              </div>
            </div>
          )}

          {/* Quantidades */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold">Quantidades</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Metros Planejados *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.metros}
                  onChange={e => handleMetrosChange(e.target.value)}
                  className="font-bold border-primary/50"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  KG Superior
                  {bobinaSelecionadaSup && <span className="text-muted-foreground font-normal">(auto)</span>}
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.kg_superior}
                  onChange={e => {
                    const kgSup = e.target.value;
                    const kgInf = Number(form.kg_inferior) || 0;
                    setForm(f => ({ ...f, kg_superior: kgSup, kg_total: +(Number(kgSup) + kgInf).toFixed(2) || "" }));
                  }}
                  className={bobinaSelecionadaSup ? "bg-blue-50/50 border-blue-200" : ""}
                />
              </div>
              {precisaBobinaInferior ? (
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    KG Inferior
                    {bobinaSelecionadaInf && <span className="text-muted-foreground font-normal">(auto)</span>}
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.kg_inferior}
                    onChange={e => {
                      const kgInf = e.target.value;
                      const kgSup = Number(form.kg_superior) || 0;
                      setForm(f => ({ ...f, kg_inferior: kgInf, kg_total: +(kgSup + Number(kgInf)).toFixed(2) || "" }));
                    }}
                    className={bobinaSelecionadaInf ? "bg-blue-50/50 border-blue-200" : ""}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-bold">KG Total</Label>
                  <Input type="number" placeholder="0" value={form.kg_total} onChange={e => set("kg_total", e.target.value)} className="font-bold" />
                </div>
              )}
            </div>

            {precisaBobinaInferior && (
              <div className="space-y-1">
                <Label className="text-xs font-bold">KG Total</Label>
                <Input type="number" placeholder="0" value={form.kg_total} onChange={e => set("kg_total", e.target.value)} className="font-bold" readOnly />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" placeholder="0.00" value={form.valor} onChange={e => set("valor", e.target.value)} />
              </div>
              {isEditing && (
                <div className="space-y-1">
                  <Label className="text-xs">Metros Realizados (operador)</Label>
                  <Input type="number" placeholder="0" value={form.metros_realizados} onChange={e => set("metros_realizados", e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* Datas e Status */}
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