import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Snowflake, Ruler, Package, AlertTriangle, CheckCircle2, Calculator, Info } from "lucide-react";

// Cada placa tem 2m de comprimento
const METROS_POR_PLACA = 2;

// Larguras padrão por tipo (mm)
const LARGURAS_POR_TIPO = {
  "EPS - TP 25":           1080,
  "EPS - TP 40":           1100,
  "EPS - TP 40 BANDEJA":   1100,
  "EPS - COLONIAL":         500,
  "EPS - COLONIAL BANDEJA": 500,
  "EPS - ONDULADO":         1100,
};

function calcularMetrics(qtd, isoporSelecionado) {
  if (!qtd || !isoporSelecionado) return null;
  const n = Number(qtd);
  if (isNaN(n) || n <= 0) return null;

  const largura_mm = isoporSelecionado.espessura_mm
    ? LARGURAS_POR_TIPO[isoporSelecionado.tipo] || 1100
    : LARGURAS_POR_TIPO[isoporSelecionado.tipo] || 1100;

  const metrosLinear = n * METROS_POR_PLACA;
  const largura_m = largura_mm / 1000;
  const areaM2 = metrosLinear * largura_m;

  return {
    placas: n,
    metrosLinear,
    largura_mm,
    areaM2,
  };
}

export default function UsarIsoporDialog({ open, onClose, onConfirm, isopores }) {
  const [form, setForm] = useState({
    isopor_id: "",
    numero_pedido: "",
    quantidade: "",
    metros_produzidos: "",
    data_uso: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        isopor_id: "",
        numero_pedido: "",
        quantidade: "",
        metros_produzidos: "",
        data_uso: format(new Date(), "yyyy-MM-dd"),
        observacoes: "",
      });
    }
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isoporSelecionado = isopores.find((i) => i.id === form.isopor_id);
  const estoqueAtual = isoporSelecionado?.quantidade || 0;
  const qtd = Number(form.quantidade) || 0;
  const estoqueRestante = estoqueAtual - qtd;
  const metrics = calcularMetrics(form.quantidade, isoporSelecionado);

  const consumoPorMetro = metrics && form.metros_produzidos && Number(form.metros_produzidos) > 0
    ? (metrics.placas / Number(form.metros_produzidos)).toFixed(3)
    : null;

  const estoqueStatus =
    estoqueRestante < 0
      ? "error"
      : estoqueRestante <= 5
      ? "warn"
      : "ok";

  const handleConfirm = () => {
    if (!form.isopor_id) { alert("Selecione o tipo de isopor."); return; }
    if (!form.quantidade || qtd <= 0) { alert("Informe a quantidade de placas."); return; }
    if (qtd > estoqueAtual) {
      alert(`Estoque insuficiente! Disponível: ${estoqueAtual} unidades.`);
      return;
    }

    onConfirm({
      isopor_id: form.isopor_id,
      isopor_tipo: isoporSelecionado?.tipo || "",
      pedido_info: form.numero_pedido || "",
      quantidade: qtd,
      metros_produzidos: Number(form.metros_produzidos) || 0,
      data_uso: form.data_uso,
      observacoes: form.observacoes,
    }, isoporSelecionado);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Snowflake className="w-5 h-5 text-blue-500" />
            Registrar Uso de Isopor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Tipo de Isopor */}
          <div className="space-y-1.5">
            <Label className="font-semibold">Tipo de Isopor *</Label>
            <Select value={form.isopor_id} onValueChange={(v) => set("isopor_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {isopores.map((iso) => (
                  <SelectItem key={iso.id} value={iso.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{iso.tipo}</span>
                      {iso.espessura_mm && (
                        <Badge variant="outline" className="text-xs">{iso.espessura_mm}mm</Badge>
                      )}
                      <span className="text-muted-foreground text-xs">· {iso.quantidade || 0} un</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isoporSelecionado && (
              <div className="flex items-center gap-3 mt-1.5 p-2.5 rounded-lg bg-muted/50 border text-sm">
                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
                  <span>Estoque: <strong className="text-foreground">{estoqueAtual} placas</strong></span>
                  <span>Metragem: <strong className="text-foreground">{(estoqueAtual * METROS_POR_PLACA).toFixed(0)}m</strong></span>
                  {isoporSelecionado.espessura_mm && (
                    <span>Espessura: <strong className="text-foreground">{isoporSelecionado.espessura_mm}mm</strong></span>
                  )}
                  <span>Largura: <strong className="text-foreground">{LARGURAS_POR_TIPO[isoporSelecionado.tipo] || "—"}mm</strong></span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Quantidade + Metros produzidos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-semibold">Placas Utilizadas *</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 24"
                value={form.quantidade}
                onChange={(e) => set("quantidade", e.target.value)}
              />
              {form.quantidade && (
                <p className="text-xs text-muted-foreground">
                  = <strong>{(qtd * METROS_POR_PLACA).toFixed(0)} m lineares</strong>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">
                Metros Produzidos
                <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="Ex: 180"
                value={form.metros_produzidos}
                onChange={(e) => set("metros_produzidos", e.target.value)}
              />
              {consumoPorMetro && (
                <p className="text-xs text-muted-foreground">
                  Consumo: <strong>{consumoPorMetro} placas/m</strong>
                </p>
              )}
            </div>
          </div>

          {/* Painel de cálculos */}
          {metrics && (
            <div className="rounded-xl border bg-blue-50/60 p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                <Calculator className="w-4 h-4" />
                Resumo de Cálculo
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 border text-center">
                  <p className="text-2xl font-bold text-foreground">{metrics.placas}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Placas</p>
                </div>
                <div className="bg-white rounded-lg p-3 border text-center">
                  <p className="text-2xl font-bold text-foreground">{metrics.metrosLinear.toFixed(0)}<span className="text-sm font-normal">m</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Metragem Linear</p>
                </div>
                <div className="bg-white rounded-lg p-3 border text-center">
                  <p className="text-2xl font-bold text-foreground">{metrics.largura_mm}<span className="text-sm font-normal">mm</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Largura Placa</p>
                </div>
                <div className="bg-white rounded-lg p-3 border text-center">
                  <p className="text-2xl font-bold text-foreground">{metrics.areaM2.toFixed(1)}<span className="text-sm font-normal">m²</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Área Total</p>
                </div>
              </div>

              {consumoPorMetro && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Eficiência: <strong>{consumoPorMetro} placas por metro produzido</strong>
                  &nbsp;·&nbsp; {(Number(form.metros_produzidos) / metrics.metrosLinear).toFixed(2)}x rendimento
                </div>
              )}
            </div>
          )}

          {/* Saldo no estoque */}
          {form.quantidade && isoporSelecionado && (
            <div className={`flex items-center gap-3 rounded-lg p-3 border text-sm font-medium
              ${estoqueStatus === "error" ? "bg-red-50 border-red-200 text-red-700" :
                estoqueStatus === "warn"  ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                                            "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              {estoqueStatus === "error" ? <AlertTriangle className="w-4 h-4 shrink-0" /> :
               estoqueStatus === "warn"  ? <AlertTriangle className="w-4 h-4 shrink-0" /> :
                                           <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>
                {estoqueStatus === "error"
                  ? `Estoque insuficiente! Faltam ${Math.abs(estoqueRestante)} placas.`
                  : `Saldo após uso: `}
                {estoqueStatus !== "error" && (
                  <strong>{estoqueRestante} placas ({(estoqueRestante * METROS_POR_PLACA).toFixed(0)}m)</strong>
                )}
              </span>
            </div>
          )}

          <Separator />

          {/* Pedido + Data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nº do Pedido <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                placeholder="Ex: 283427"
                value={form.numero_pedido}
                onChange={(e) => set("numero_pedido", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data do Uso</Label>
              <Input type="date" value={form.data_uso} onChange={(e) => set("data_uso", e.target.value)} />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              placeholder="Lote, turno, operador, qualquer anotação relevante..."
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              className="h-16 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={estoqueStatus === "error"}
            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
          >
            <Snowflake className="w-4 h-4" />
            Confirmar Uso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}