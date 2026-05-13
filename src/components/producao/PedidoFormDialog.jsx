import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const MAQUINAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];
const PRODUTOS = ["TELHA", "TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA", "BOBININHA", "CUMEEIRA", "PAINEL"];

// Peso por metro linear conforme espessura
function calcKgPorMetro(bobinaTexto) {
  if (!bobinaTexto) return 0;
  const t = bobinaTexto.toLowerCase();
  if (t.includes("0,65")) return 5.80;
  if (t.includes("0,50")) return 4.40;
  if (t.includes("rvm") || t.includes("0,43 rvm")) return 3.80;
  if (t.includes("0,43")) return 3.65;
  return 0;
}

function labelBobina(b) {
  const cor = b.cor ? ` — ${b.cor}` : "";
  const chapa = b.chapa ? `${b.chapa}` : "";
  const qual = b.qualidade ? ` (${b.qualidade})` : "";
  const peso = b.peso_kg ? ` · ${b.peso_kg}kg` : "";
  return `${chapa}${qual}${cor}${peso}`;
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
  metragem_mm: "",
  quantidade_telhas: "",
  metragem_planejada: "",
  isopor_utilizado: "",
  status: "pendente",
  data_pedido: "",
  data_prevista: "",
  observacoes: "",
};

export default function PedidoFormDialog({ open, onClose, onSave, editItem, defaultDate }) {
  const [form, setForm] = useState(emptyForm);

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-ativas"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false }),
    enabled: open,
  });

  const { data: modelosCad = [] } = useQuery({
    queryKey: ["modelos-produto"],
    queryFn: () => base44.entities.ModeloProduto.list("produto"),
    enabled: open,
  });

  const { data: dadosEPS = [] } = useQuery({
    queryKey: ["dados-producao", "eps"],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo: "eps", ativo: true }),
    enabled: open,
  });

  const { data: dadosRVM = [] } = useQuery({
    queryKey: ["dados-producao", "rvm"],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo: "rvm", ativo: true }),
    enabled: open,
  });

  const { data: dadosVendedores = [] } = useQuery({
    queryKey: ["dados-producao", "vendedor"],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo: "vendedor", ativo: true }),
    enabled: open,
  });

  // Modelos filtrados pelo produto selecionado
  const modelosFiltrados = useMemo(() =>
    modelosCad.filter(m => !form.produto || m.produto === form.produto),
    [modelosCad, form.produto]
  );

  // Tipos de EPS: usa cadastro se existir, senão fallback
  const tiposEPS = dadosEPS.length > 0
    ? dadosEPS.map(d => d.valor)
    : ["EPS - TP 25", "EPS - TP 40", "EPS - TP 40 BANDEJA", "EPS - COLONIAL", "EPS - COLONIAL BANDEJA", "EPS - ONDULADO"];

  // Encontra bobina selecionada (superior e inferior)
  const bobinaSuperiorObj = useMemo(() => bobinas.find(b => b.id === form.bobina_superior), [bobinas, form.bobina_superior]);
  const bobinaInferiorObj = useMemo(() => bobinas.find(b => b.id === form.bobina_inferior), [bobinas, form.bobina_inferior]);

  useEffect(() => {
    if (open) {
      if (editItem && !editItem._presets) {
        setForm({
          data: editItem.data || format(new Date(), "yyyy-MM-dd"),
          unidade: editItem.unidade || "Matriz AJL",
          maquina: editItem.maquina || "",
          produto: editItem.produto || "",
          modelo: editItem.modelo || "",
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
          metragem_mm: editItem.metragem_mm || "",
          quantidade_telhas: editItem.quantidade_telhas || "",
          metragem_planejada: editItem.metragem_planejada || "",
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

  // Quando selecionar bobina superior, preenche RVM/Cor automaticamente
  const handleBobinaSupChange = (bobinaId) => {
    const b = bobinas.find(x => x.id === bobinaId);
    const novoForm = { ...form, bobina_superior: bobinaId };
    if (b) {
      novoForm.rvm_superior = b.cor || "";
      // Recalcula KG com metros atuais
      const pesoMetro = calcKgPorMetro(b.chapa + (b.qualidade?.includes("RVM") ? " RVM" : ""));
      const metros = Number(form.metros) || 0;
      if (metros > 0 && pesoMetro > 0) {
        novoForm.kg_superior = +(metros * pesoMetro).toFixed(1);
        novoForm.kg_total = recalcTotal(novoForm.kg_superior, form.kg_inferior);
      }
    }
    setForm(novoForm);
  };

  const handleBobinaInfChange = (bobinaId) => {
    const b = bobinas.find(x => x.id === bobinaId);
    const novoForm = { ...form, bobina_inferior: bobinaId };
    if (b) {
      novoForm.rvm_inferior = b.cor || "";
      const pesoMetro = calcKgPorMetro(b.chapa + (b.qualidade?.includes("RVM") ? " RVM" : ""));
      const metros = Number(form.metros) || 0;
      if (metros > 0 && pesoMetro > 0) {
        novoForm.kg_inferior = +(metros * pesoMetro).toFixed(1);
        novoForm.kg_total = recalcTotal(form.kg_superior, novoForm.kg_inferior);
      }
    }
    setForm(novoForm);
  };

  // Quando metros mudar, recalcula kg, quantidade de telhas e isopor automaticamente
  const handleMetrosChange = (val) => {
    const metros = Number(val) || 0;
    const newForm = { ...form, metros: val };

    // Quantidade de telhas = metros (1 telha = 1m linear)
    newForm.quantidade_telhas = metros > 0 ? metros : "";

    // Quantidade de isopor = ceil(metros / 2), cada peça = 2m
    newForm.isopor_utilizado = metros > 0 ? Math.ceil(metros / 2) : "";

    if (bobinaSuperiorObj) {
      const labelSup = bobinaSuperiorObj.chapa + (bobinaSuperiorObj.qualidade?.toLowerCase().includes("rvm") ? " RVM" : "");
      const pesoSup = calcKgPorMetro(labelSup);
      if (pesoSup > 0) newForm.kg_superior = metros > 0 ? +(metros * pesoSup).toFixed(1) : "";
    }
    if (bobinaInferiorObj) {
      const labelInf = bobinaInferiorObj.chapa + (bobinaInferiorObj.qualidade?.toLowerCase().includes("rvm") ? " RVM" : "");
      const pesoInf = calcKgPorMetro(labelInf);
      if (pesoInf > 0) newForm.kg_inferior = metros > 0 ? +(metros * pesoInf).toFixed(1) : "";
    }
    newForm.kg_total = recalcTotal(newForm.kg_superior, newForm.kg_inferior);
    setForm(newForm);
  };

  const recalcTotal = (sup, inf) => {
    const s = Number(sup) || 0;
    const i = Number(inf) || 0;
    return s + i > 0 ? +(s + i).toFixed(1) : "";
  };

  const handleSave = () => {
    // Salva ID da bobina mas também guarda texto legível para exibição
    const bobinaSupTexto = bobinaSuperiorObj ? labelBobina(bobinaSuperiorObj) : form.bobina_superior;
    const bobinaInfTexto = bobinaInferiorObj ? labelBobina(bobinaInferiorObj) : form.bobina_inferior;
    const data = {
      ...form,
      // Guarda o ID como bobina_superior_id e texto como bobina_superior para compatibilidade
      bobina_superior_id: form.bobina_superior,
      bobina_inferior_id: form.bobina_inferior,
      bobina_superior: bobinaSupTexto,
      bobina_inferior: bobinaInfTexto,
      kg_superior: form.kg_superior !== "" ? Number(form.kg_superior) : undefined,
      kg_inferior: form.kg_inferior !== "" ? Number(form.kg_inferior) : undefined,
      kg_total: form.kg_total !== "" ? Number(form.kg_total) : undefined,
      metros: form.metros ? Number(form.metros) : undefined,
      metragem_mm: form.metragem_mm ? Number(form.metragem_mm) : undefined,
      quantidade_telhas: form.quantidade_telhas ? Number(form.quantidade_telhas) : undefined,
      metragem_planejada: form.metragem_planejada ? Number(form.metragem_planejada) : undefined,
      isopor_utilizado: form.isopor_utilizado ? Number(form.isopor_utilizado) : undefined,
    };
    onSave(data);
  };

  const precisaEPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(form.produto);
  const precisaBobinaInferior = ["TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(form.produto);
  const isEditing = editItem && !editItem._presets;

  // Bobinas ativas ordenadas por chapa
  const bobinasList = [...bobinas].sort((a, b) => {
    const ca = `${a.chapa}${a.qualidade}${a.cor}`.toLowerCase();
    const cb = `${b.chapa}${b.qualidade}${b.cor}`.toLowerCase();
    return ca.localeCompare(cb);
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Linha 1: Data / Produto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Produto *</Label>
              <Select value={form.produto} onValueChange={v => { set("produto", v); set("modelo", ""); set("maquina", ""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{PRODUTOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Modelo — select do cadastro (substitui Máquina) */}
          <div className="space-y-1">
            <Label>Modelo *</Label>
            <Select
              value={form.modelo}
              onValueChange={v => {
                const modeloObj = modelosCad.find(m => m.modelo === v);
                // Preenche máquina automaticamente com base no modelo
                const maquinaAuto = modeloObj?.maquinas?.split(",")[0]?.trim() || "";
                setForm(f => ({ ...f, modelo: v, maquina: maquinaAuto }));
              }}
            >
              <SelectTrigger><SelectValue placeholder={form.produto ? "Selecione o modelo..." : "Selecione o produto primeiro"} /></SelectTrigger>
              <SelectContent>
                {modelosFiltrados.map(m => (
                  <SelectItem key={m.id} value={m.modelo}>
                    <span className="font-medium">{m.modelo}</span>
                    {m.espessuras && <span className="text-muted-foreground text-xs ml-2">· {m.espessuras}</span>}
                  </SelectItem>
                ))}
                {modelosFiltrados.length === 0 && (
                  <SelectItem value="_nenhum" disabled>Nenhum modelo cadastrado para este produto</SelectItem>
                )}
              </SelectContent>
            </Select>
            {form.maquina && (
              <p className="text-xs text-muted-foreground">Máquina: <strong>{form.maquina}</strong></p>
            )}
          </div>

          {/* Vendedor / Cliente / Pedido */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Vendedor</Label>
              <Select value={form.vendedor} onValueChange={v => set("vendedor", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>
                  {dadosVendedores.map(d => <SelectItem key={d.id} value={d.valor}>{d.valor}</SelectItem>)}
                </SelectContent>
              </Select>
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

          {/* Bobinas - do estoque real */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-foreground">Bobinas do Estoque</p>

            {/* Bobina Superior */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bobina Superior</Label>
              <Select value={form.bobina_superior} onValueChange={handleBobinaSupChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a bobina do estoque..." />
                </SelectTrigger>
                <SelectContent>
                  {bobinasList.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-medium">{b.chapa}</span>
                      {b.qualidade && <span className="text-muted-foreground"> ({b.qualidade})</span>}
                      {b.cor && <span className="text-blue-600"> — {b.cor}</span>}
                      {b.peso_kg && <span className="text-muted-foreground text-xs"> · {b.peso_kg}kg</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bobinaSuperiorObj && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex flex-wrap gap-3">
                  <span>Cód: <strong>{bobinaSuperiorObj.codigo || "—"}</strong></span>
                  <span>Cor/RVM: <strong>{bobinaSuperiorObj.cor || "—"}</strong></span>
                  <span>Qualidade: <strong>{bobinaSuperiorObj.qualidade || "—"}</strong></span>
                  <span>Estoque: <strong>{bobinaSuperiorObj.peso_kg || 0}kg</strong></span>
                  {bobinaSuperiorObj.metragem_restante && <span>Metragem: <strong>{bobinaSuperiorObj.metragem_restante}m restantes</strong></span>}
                </div>
              )}
            </div>

            {/* Bobina Inferior (condicionalmente) */}
            {precisaBobinaInferior && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bobina Inferior</Label>
                <Select value={form.bobina_inferior} onValueChange={handleBobinaInfChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a bobina inferior..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bobinasList.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="font-medium">{b.chapa}</span>
                        {b.qualidade && <span className="text-muted-foreground"> ({b.qualidade})</span>}
                        {b.cor && <span className="text-blue-600"> — {b.cor}</span>}
                        {b.peso_kg && <span className="text-muted-foreground text-xs"> · {b.peso_kg}kg</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bobinaInferiorObj && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex flex-wrap gap-3">
                    <span>Cód: <strong>{bobinaInferiorObj.codigo || "—"}</strong></span>
                    <span>Cor/RVM: <strong>{bobinaInferiorObj.cor || "—"}</strong></span>
                    <span>Qualidade: <strong>{bobinaInferiorObj.qualidade || "—"}</strong></span>
                    <span>Estoque: <strong>{bobinaInferiorObj.peso_kg || 0}kg</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EPS */}
          {precisaEPS && (
            <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-sm font-semibold">EPS / Isopor</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de EPS</Label>
                  <Select value={form.eps} onValueChange={v => set("eps", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o EPS" /></SelectTrigger>
                    <SelectContent>{tiposEPS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Maquinário</Label>
                  <Select value={form.maquinario_superior} onValueChange={v => set("maquinario_superior", v)}>
                    <SelectTrigger><SelectValue placeholder="Maquinário" /></SelectTrigger>
                    <SelectContent>{MAQUINAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {/* Quantidade de isopor calculada automaticamente */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-800">Placas de Isopor Necessárias</p>
                  <p className="text-xs text-orange-600">Cada peça = 2m · baseado nos metros pedidos</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-orange-700">{form.isopor_utilizado || "—"}</span>
                  <p className="text-xs text-orange-600">peças</p>
                </div>
              </div>
            </div>
          )}

          {/* Quantidades */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold">Quantidades</p>

            {/* Metros — campo principal */}
            <div className="space-y-1">
              <Label className="text-xs">Metros Pedidos *</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.metros}
                onChange={e => handleMetrosChange(e.target.value)}
                className="font-bold text-lg border-primary/50 focus:border-primary"
              />
            </div>

            {/* Quantidade de Telhas + Metragem em mm */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Quantidade de Telhas <span className="text-muted-foreground font-normal">— automático</span></Label>
                <Input
                  type="number"
                  placeholder="Auto"
                  value={form.quantidade_telhas}
                  onChange={e => set("quantidade_telhas", e.target.value)}
                  className="bg-muted/40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Metragem (mm)
                  {form.metragem_mm && Number(form.metragem_mm) > 0 && (
                    <span className="text-muted-foreground ml-1">({(Number(form.metragem_mm) / 1000).toFixed(3)}m)</span>
                  )}
                </Label>
                <Input
                  type="number"
                  placeholder="ex: 5000 mm"
                  value={form.metragem_mm}
                  onChange={e => set("metragem_mm", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Metragem Planejada de Bobina</Label>
              <Input
                type="number"
                placeholder="Quantos metros de bobina serão usados"
                value={form.metragem_planejada}
                onChange={e => set("metragem_planejada", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">O operador vai registrar o que realmente usou na máquina</p>
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
            <Textarea placeholder="Anotações, instruções especiais..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} className="h-16" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.data || !form.produto}>
            {isEditing ? "Salvar Alterações" : "Registrar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}