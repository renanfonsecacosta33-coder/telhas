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
import { Snowflake, Package, AlertTriangle, CheckCircle2, Calculator, ChevronRight, Layers } from "lucide-react";

const METROS_POR_PLACA = 2;

const LARGURAS_POR_TIPO = {
  "EPS - TP 25":            1080,
  "EPS - TP 40":            1100,
  "EPS - TP 40 BANDEJA":    1100,
  "EPS - COLONIAL":          500,
  "EPS - COLONIAL BANDEJA":  500,
  "EPS - ONDULADO":          1100,
};

// Dado qtd de peças e metragem de cada peça, calcula placas necessárias
function calcularPlacasNecessarias(qtdPecas, metrosPorPeca, larguraTipo_mm) {
  if (!qtdPecas || !metrosPorPeca) return null;
  const n = Number(qtdPecas);
  const m = Number(metrosPorPeca);
  if (isNaN(n) || n <= 0 || isNaN(m) || m <= 0) return null;

  const metrosTotal = n * m;
  const largura_m = (larguraTipo_mm || 1100) / 1000;
  const areaM2 = metrosTotal * largura_m;
  // cada placa cobre (METROS_POR_PLACA × largura_m) m²
  const areaPorPlaca = METROS_POR_PLACA * largura_m;
  const placasNecessarias = Math.ceil(areaM2 / areaPorPlaca);

  return {
    metrosTotal,
    areaM2,
    placasNecessarias,
    areaPorPlaca,
    largura_m,
  };
}

export default function UsarIsoporDialog({ open, onClose, onConfirm, isopores }) {
  const [modoCalc, setModoCalc] = useState("direto"); // "direto" | "pecas"
  const [form, setForm] = useState({
    isopor_id: "",
    numero_pedido: "",
    // modo direto
    quantidade: "",
    // modo peças
    qtd_pecas: "",
    metros_por_peca: "",
    // comum
    data_uso: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      setModoCalc("direto");
      setForm({
        isopor_id: "",
        numero_pedido: "",
        quantidade: "",
        qtd_pecas: "",
        metros_por_peca: "",
        data_uso: format(new Date(), "yyyy-MM-dd"),
        observacoes: "",
      });
    }
  }, [open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isoporSelecionado = isopores.find((i) => i.id === form.isopor_id);
  const estoqueAtual = isoporSelecionado?.quantidade || 0;
  const largura_mm = LARGURAS_POR_TIPO[isoporSelecionado?.tipo] || 1100;

  // Cálculo modo peças
  const calcPecas = modoCalc === "pecas"
    ? calcularPlacasNecessarias(form.qtd_pecas, form.metros_por_peca, largura_mm)
    : null;

  // Quantidade final (auto ou manual)
  const qtdFinal = modoCalc === "pecas" && calcPecas
    ? calcPecas.placasNecessarias
    : Number(form.quantidade) || 0;

  const estoqueRestante = estoqueAtual - qtdFinal;

  const estoqueStatus =
    qtdFinal === 0
      ? "idle"
      : estoqueRestante < 0
      ? "error"
      : estoqueRestante <= 5
      ? "warn"
      : "ok";

  const handleConfirm = () => {
    if (!form.isopor_id) { alert("Selecione o tipo de isopor."); return; }
    if (qtdFinal <= 0) { alert("Informe a quantidade de placas."); return; }
    if (qtdFinal > estoqueAtual) {
      alert(`Estoque insuficiente! Disponível: ${estoqueAtual} unidades.`);
      return;
    }

    const pedidoInfo = [
      form.numero_pedido,
      calcPecas ? `${form.qtd_pecas} peças × ${form.metros_por_peca}m` : "",
    ].filter(Boolean).join(" | ");

    onConfirm({
      isopor_id: form.isopor_id,
      isopor_tipo: isoporSelecionado?.tipo || "",
      pedido_info: pedidoInfo,
      quantidade: qtdFinal,
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
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground text-xs">
                  <span>Estoque: <strong className="text-foreground">{estoqueAtual} placas</strong></span>
                  <span>= <strong className="text-foreground">{estoqueAtual * METROS_POR_PLACA}m lineares</strong></span>
                  {isoporSelecionado.espessura_mm && (
                    <span>Espessura: <strong className="text-foreground">{isoporSelecionado.espessura_mm}mm</strong></span>
                  )}
                  <span>Largura: <strong className="text-foreground">{largura_mm}mm</strong></span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Toggle modo de entrada */}
          <div className="space-y-3">
            <Label className="font-semibold">Como deseja informar o consumo?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModoCalc("direto")}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  modoCalc === "direto"
                    ? "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4" />
                  <span className="text-sm font-semibold">Direto</span>
                </div>
                <p className="text-xs">Já sei quantas placas foram usadas</p>
              </button>
              <button
                type="button"
                onClick={() => setModoCalc("pecas")}
                className={`rounded-xl border-2 p-3 text-left transition-all ${
                  modoCalc === "pecas"
                    ? "border-orange-500 bg-orange-50 text-orange-800"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="w-4 h-4" />
                  <span className="text-sm font-semibold">Por Peças</span>
                </div>
                <p className="text-xs">Informar qtd de peças + metragem</p>
              </button>
            </div>
          </div>

          {/* Modo direto */}
          {modoCalc === "direto" && (
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
                  = <strong>{(Number(form.quantidade) * METROS_POR_PLACA).toFixed(0)}m lineares</strong> de isopor
                </p>
              )}
            </div>
          )}

          {/* Modo peças — calculadora embutida */}
          {modoCalc === "pecas" && (
            <div className="rounded-xl border-2 border-orange-200 bg-orange-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                <Calculator className="w-4 h-4" />
                Calculadora por Peças e Metragem
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Quantidade de Peças *</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Ex: 50"
                    value={form.qtd_pecas}
                    onChange={(e) => set("qtd_pecas", e.target.value)}
                    className="bg-white"
                  />
                  <p className="text-xs text-muted-foreground">Nº de telhas / painéis produzidos</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Metragem por Peça (m) *</Label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="Ex: 6.00"
                    value={form.metros_por_peca}
                    onChange={(e) => set("metros_por_peca", e.target.value)}
                    className="bg-white"
                  />
                  <p className="text-xs text-muted-foreground">Comprimento de cada telha em metros</p>
                </div>
              </div>

              {calcPecas && (
                <>
                  {/* Cálculo passo a passo */}
                  <div className="bg-white rounded-lg border p-3 space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Metragem total</span>
                      <span className="font-semibold text-foreground">
                        {form.qtd_pecas} peças × {form.metros_por_peca}m = <strong>{calcPecas.metrosTotal.toFixed(1)}m</strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Área a cobrir</span>
                      <span className="font-semibold text-foreground">
                        {calcPecas.metrosTotal.toFixed(1)}m × {(calcPecas.largura_m * 1000).toFixed(0)}mm = <strong>{calcPecas.areaM2.toFixed(2)}m²</strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Área por placa EPS</span>
                      <span className="font-semibold text-foreground">
                        {METROS_POR_PLACA}m × {(calcPecas.largura_m * 1000).toFixed(0)}mm = <strong>{calcPecas.areaPorPlaca.toFixed(3)}m²/placa</strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="font-semibold text-foreground">Placas necessárias</span>
                      <span className="font-bold text-foreground">
                        {calcPecas.areaM2.toFixed(2)}m² ÷ {calcPecas.areaPorPlaca.toFixed(3)} = <strong className="text-orange-700 text-sm">{calcPecas.placasNecessarias} placas</strong>
                      </span>
                    </div>
                  </div>

                  {/* Resultado final destacado */}
                  <div className="bg-orange-500 text-white rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold opacity-80">Placas EPS a baixar do estoque</p>
                      <p className="text-xs opacity-70">{calcPecas.metrosTotal.toFixed(1)}m totais · {largura_mm}mm largura</p>
                    </div>
                    <p className="text-4xl font-black">{calcPecas.placasNecessarias}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Saldo no estoque */}
          {qtdFinal > 0 && isoporSelecionado && (
            <div className={`flex items-center gap-3 rounded-lg p-3 border text-sm font-medium
              ${estoqueStatus === "error" ? "bg-red-50 border-red-200 text-red-700" :
                estoqueStatus === "warn"  ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                                            "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              {estoqueStatus === "error" || estoqueStatus === "warn"
                ? <AlertTriangle className="w-4 h-4 shrink-0" />
                : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>
                {estoqueStatus === "error"
                  ? `Estoque insuficiente! Faltam ${Math.abs(estoqueRestante)} placas.`
                  : <>Saldo após uso: <strong>{estoqueRestante} placas ({estoqueRestante * METROS_POR_PLACA}m)</strong></>}
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
            disabled={estoqueStatus === "error" || qtdFinal === 0}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Snowflake className="w-4 h-4" />
            Confirmar Uso ({qtdFinal > 0 ? `${qtdFinal} placas` : "—"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}