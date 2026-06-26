import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Package, Warehouse, ShoppingCart, Ruler, Weight, Layers, Scale, AlertCircle } from "lucide-react";

function labelBobina(b) {
  const parts = [];
  if (b.codigo) parts.push(`[${b.codigo}]`);
  if (b.espessura_utilizada) parts.push(b.espessura_utilizada);
  else if (b.chapa) parts.push(b.chapa);
  if (b.cor) parts.push(b.cor);
  if (b.largura_mm) parts.push(`${b.largura_mm}mm`);
  return parts.join(" · ");
}

// Calcula metragem restante com base no peso e largura/chapa
function calcMetragem(bobina) {
  if (!bobina) return null;
  if (bobina.metragem_restante) return bobina.metragem_restante;
  if (bobina.metragem) return bobina.metragem;
  return null;
}

// Calcula quantas chapas de X mm cabem numa bobina de Y metros
function calcMaxChapas(bobina, comprimento_mm) {
  if (!bobina || !comprimento_mm || Number(comprimento_mm) <= 0) return null;
  const metros = calcMetragem(bobina);
  if (!metros) return null;
  return Math.floor((metros * 1000) / Number(comprimento_mm));
}

// Calcula KG estimado das chapas: largura × comprimento × espessura × qtd × densidade
// densidade aço galvanizado = 0.00000785 kg/mm³
function calcKgEstimado(bobina, comprimento_mm, quantidade) {
  if (!bobina || !comprimento_mm || !quantidade) return null;
  const larg = Number(bobina.largura_mm) || 0;
  const comp = Number(comprimento_mm) || 0;
  const qtd = Number(quantidade) || 0;
  // espessura pode ser "0,43" ou "0.43"
  const espStr = String(bobina.chapa || "").replace(",", ".");
  const esp = parseFloat(espStr) || 0;
  if (larg <= 0 || comp <= 0 || esp <= 0 || qtd <= 0) return null;
  return larg * comp * esp * qtd * 0.00000785;
}

export default function OrdemFormDialogCD({ open, onClose, onSave, editItem, defaultDate }) {
  const [form, setForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    bobina_id: "",
    comprimento_mm: "",
    quantidade: "",
    destino: "estoque",
    numero_pedido: "",
    cliente: "",
    observacoes: "",
  });

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-cd-ativas"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false }),
    enabled: open,
  });

  const { data: todasOrdens = [] } = useQuery({
    queryKey: ["ordens-desbobinadeira"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 500),
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
        destino: editItem.destino || "estoque",
        numero_pedido: editItem.numero_pedido || "",
        cliente: editItem.cliente || "",
        observacoes: editItem.observacoes || "",
      });
    } else {
      setForm({
        data: defaultDate || format(new Date(), "yyyy-MM-dd"),
        bobina_id: "",
        comprimento_mm: "",
        quantidade: "",
        destino: "estoque",
        numero_pedido: "",
        cliente: "",
        observacoes: "",
      });
    }
  }, [open, editItem, defaultDate]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const bobinaObj = bobinas.find(b => b.id === form.bobina_id);
  const maxChapas = calcMaxChapas(bobinaObj, form.comprimento_mm);
  const metrosRestantes = calcMetragem(bobinaObj);
  const kgEstimado = calcKgEstimado(bobinaObj, form.comprimento_mm, form.quantidade);

  // Pré-baixa: soma KG das ordens ativas (pendente/em_producao/pausado) da mesma bobina
  const ordensDaBobina = todasOrdens.filter(o =>
    o.bobina_id === form.bobina_id &&
    o.id !== editItem?.id &&
    ["pendente", "em_producao", "pausado"].includes(o.status)
  );
  const preReservadoKg = ordensDaBobina.reduce((s, o) => s + (o.kg_estimado || 0), 0);
  const pesoBobina = bobinaObj?.peso_kg || 0;
  const pesoDisponivel = Math.max(0, pesoBobina - preReservadoKg);
  const excedePeso = kgEstimado !== null && kgEstimado > pesoDisponivel;

  const handleSave = () => {
    if (!form.bobina_id) { alert("Selecione a bobina."); return; }
    if (!form.comprimento_mm || Number(form.comprimento_mm) <= 0) { alert("Informe o comprimento de corte em mm."); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade de chapas."); return; }
    if (form.destino === "pedido_direto" && !form.numero_pedido) { alert("Informe o número do pedido."); return; }
    if (excedePeso) { alert(`KG estimado (${kgEstimado.toFixed(1)} kg) excede o peso disponível na bobina (${pesoDisponivel.toFixed(1)} kg).\n\nPeso da bobina: ${pesoBobina.toFixed(1)} kg\nPré-reservado por outras ordens: ${preReservadoKg.toFixed(1)} kg\n\nReduza a quantidade ou escolha outra bobina.`); return; }

    const bobinaSnap = bobinaObj ? labelBobina(bobinaObj) : "";
    onSave({
      ...form,
      bobina_descricao: bobinaSnap,
      espessura_utilizada: bobinaObj?.espessura_utilizada || bobinaObj?.chapa || "",
      comprimento_mm: Number(form.comprimento_mm),
      quantidade: Number(form.quantidade),
      kg_estimado: kgEstimado ? Math.round(kgEstimado * 100) / 100 : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" />
            {editItem ? "Editar Ordem" : "Nova Ordem — Desbobinadeira"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Data */}
          <div className="space-y-1">
            <Label>Data de Produção *</Label>
            <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
          </div>

          {/* Seleção de Bobina */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Package className="w-4 h-4 text-blue-500" /> Bobina do Estoque *
            </Label>
            <Select value={form.bobina_id} onValueChange={v => set("bobina_id", v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a bobina..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {bobinas.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhuma bobina ativa</div>
                )}
                {bobinas.map(b => {
                  const isReservadaParaOutro = b.reservada && b.reserva_numero_pedido && b.reserva_numero_pedido !== form.numero_pedido;
                  return (
                    <SelectItem key={b.id} value={b.id} disabled={isReservadaParaOutro}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">{b.codigo || "—"}</span>
                        {(b.espessura_utilizada || b.chapa) && <span className="text-muted-foreground text-xs">{b.espessura_utilizada || b.chapa}mm</span>}
                        {b.cor && <span className="text-blue-600 text-xs font-medium">{b.cor}</span>}
                        {b.largura_mm && <span className="text-xs text-muted-foreground">{b.largura_mm}mm larg.</span>}
                        {b.peso_kg && <span className="text-xs text-muted-foreground">{b.peso_kg}kg</span>}
                        {b.reservada && !isReservadaParaOutro && (
                          <span className="text-amber-600 text-xs font-bold">🔒 Reservada p/ pedido {b.reserva_numero_pedido}</span>
                        )}
                        {isReservadaParaOutro && (
                          <span className="text-red-500 text-xs font-bold">🚫 Reservada — Pedido {b.reserva_numero_pedido}{b.reserva_motivo ? ` (${b.reserva_motivo})` : ""}</span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Ficha técnica da bobina selecionada */}
            {bobinaObj && (
              <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-800">{bobinaObj.codigo || "—"}</span>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Setor CD</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Espessura Utilizada</p>
                    <p className="font-bold text-foreground">{bobinaObj.espessura_utilizada ? `${bobinaObj.espessura_utilizada}mm` : bobinaObj.chapa ? `${bobinaObj.chapa}mm` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Largura</p>
                    <p className="font-bold text-foreground">{bobinaObj.largura_mm ? `${bobinaObj.largura_mm}mm` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Cor / RVM</p>
                    <p className="font-bold text-foreground">{bobinaObj.cor || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Qualidade</p>
                    <p className="font-bold text-foreground">{bobinaObj.qualidade || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Peso Atual</p>
                    <p className="font-bold text-foreground flex items-center gap-1">
                      <Weight className="w-3 h-3 text-slate-400" />
                      {bobinaObj.peso_kg ? `${bobinaObj.peso_kg} kg` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Metragem Restante</p>
                    <p className="font-bold text-foreground flex items-center gap-1">
                      <Ruler className="w-3 h-3 text-slate-400" />
                      {metrosRestantes ? `${metrosRestantes} m` : "—"}
                    </p>
                  </div>
                  {bobinaObj.fornecedor && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Fornecedor</p>
                      <p className="font-bold text-foreground">{bobinaObj.fornecedor}</p>
                    </div>
                  )}
                  {bobinaObj.nf && (
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">NF</p>
                      <p className="font-bold text-foreground">{bobinaObj.nf}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Corte */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Comprimento de Corte (mm) *</Label>
              <Input
                type="number"
                placeholder="Ex: 1200"
                value={form.comprimento_mm}
                onChange={e => set("comprimento_mm", e.target.value)}
              />
              {bobinaObj && form.comprimento_mm > 0 && metrosRestantes && (
                <p className="text-xs text-muted-foreground">
                  = <strong>{(Number(form.comprimento_mm) / 1000).toFixed(3)}m</strong> por chapa
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Quantidade de Chapas *</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.quantidade}
                onChange={e => set("quantidade", e.target.value)}
              />
              {maxChapas !== null && (
                <p className={`text-xs ${Number(form.quantidade) > maxChapas ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                  Máx. possível: <strong>{maxChapas} chapas</strong>
                </p>
              )}
            </div>
          </div>

          {/* KG Estimado + Pré-baixa */}
          {kgEstimado !== null && (
            <div className={`rounded-xl px-4 py-3 space-y-2 ${excedePeso ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <div className="flex items-center gap-3">
                <Scale className={`w-5 h-5 flex-shrink-0 ${excedePeso ? "text-red-600" : "text-emerald-600"}`} />
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${excedePeso ? "text-red-600" : "text-emerald-600"}`}>KG Estimado das Chapas</p>
                  <p className={`text-2xl font-black ${excedePeso ? "text-red-700" : "text-emerald-700"}`}>{kgEstimado.toFixed(1)} <span className="text-sm font-normal">kg</span></p>
                </div>
              </div>
              <div className="text-xs space-y-0.5 pl-8">
                <p className="text-muted-foreground">Peso atual da bobina: <strong>{pesoBobina.toFixed(1)} kg</strong></p>
                {preReservadoKg > 0 && (
                  <p className="text-amber-600">Pré-reservado por outras ordens: <strong>{preReservadoKg.toFixed(1)} kg</strong></p>
                )}
                <p className={excedePeso ? "text-red-600 font-bold" : "text-emerald-600 font-semibold"}>
                  Disponível para esta ordem: <strong>{pesoDisponivel.toFixed(1)} kg</strong>
                </p>
                {excedePeso && (
                  <p className="text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" /> KG estimado excede o peso disponível!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Destino */}
          <div className="space-y-2">
            <Label>Destino das Chapas *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { set("destino", "estoque"); set("numero_pedido", ""); set("cliente", ""); }}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${form.destino === "estoque" ? "border-orange-500 bg-orange-50" : "border-border hover:border-orange-300 bg-card"}`}
              >
                <Warehouse className={`w-6 h-6 ${form.destino === "estoque" ? "text-orange-600" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <p className={`text-sm font-bold ${form.destino === "estoque" ? "text-orange-700" : "text-foreground"}`}>Estoque</p>
                  <p className="text-xs text-muted-foreground">Vai para a Chaparia</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => set("destino", "pedido_direto")}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${form.destino === "pedido_direto" ? "border-blue-500 bg-blue-50" : "border-border hover:border-blue-300 bg-card"}`}
              >
                <ShoppingCart className={`w-6 h-6 ${form.destino === "pedido_direto" ? "text-blue-600" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <p className={`text-sm font-bold ${form.destino === "pedido_direto" ? "text-blue-700" : "text-foreground"}`}>Pedido Direto</p>
                  <p className="text-xs text-muted-foreground">Vai para um cliente</p>
                </div>
              </button>
            </div>
          </div>

          {/* Campos de pedido direto */}
          {form.destino === "pedido_direto" && (
            <div className="grid grid-cols-2 gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="space-y-1">
                <Label>Nº do Pedido *</Label>
                <Input placeholder="Ex: 12345" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1">
            <Label>Observações / Instruções para o Operador</Label>
            <Textarea
              placeholder="Ex: Atenção ao alinhamento, usar régua de 1250mm..."
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">
            {editItem ? "Salvar Alterações" : "Criar Ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}