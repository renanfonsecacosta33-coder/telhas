import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, LockOpen } from "lucide-react";

export default function ReservaPanelChapa({ form, onChange, chapa }) {
  const set = (key, val) => onChange({ ...form, [key]: val });

  const qtdTotal = chapa?.quantidade_total || chapa?.quantidade_disponivel || 0;
  const pesoTotal = form.peso_kg || chapa?.peso_kg || 0;
  const pesoPorChapa = qtdTotal > 0 ? pesoTotal / qtdTotal : 0;

  const reservaPct = form.reservada && form.reserva_tipo === "parcial" && form.reserva_qtd_chapas && qtdTotal
    ? Math.min(100, (Number(form.reserva_qtd_chapas) / qtdTotal) * 100).toFixed(0)
    : null;

  const handleQtdChapas = (val) => {
    const qtd = Number(val);
    set("reserva_qtd_chapas", val);
    if (qtd > 0 && pesoPorChapa > 0) {
      const pesoCalc = (qtd * pesoPorChapa).toFixed(2);
      set("reserva_kg", pesoCalc);
    }
  };

  const handlePeso = (val) => {
    set("reserva_kg", val);
    const peso = Number(val);
    if (peso > 0 && pesoPorChapa > 0) {
      const qtdCalc = Math.round(peso / pesoPorChapa);
      set("reserva_qtd_chapas", qtdCalc);
    }
  };

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 transition-colors ${form.reservada ? "border-purple-300 bg-purple-50" : "border-border bg-muted/20"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {form.reservada ? <Lock className="w-4 h-4 text-purple-700" /> : <LockOpen className="w-4 h-4 text-muted-foreground" />}
          <span className={`text-sm font-semibold ${form.reservada ? "text-purple-800" : "text-foreground"}`}>
            Reserva de Chapa
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...form, reservada: !form.reservada })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.reservada ? "bg-purple-600" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.reservada ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {form.reservada && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-purple-800">Tipo de Reserva *</Label>
              <Select value={form.reserva_tipo || ""} onValueChange={v => set("reserva_tipo", v)}>
                <SelectTrigger className="bg-white border-purple-300">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inteira">Chapa Inteira</SelectItem>
                  <SelectItem value="parcial">Parcial (por chapas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-purple-800">
                Peso Teórico por Chapa
              </Label>
              <div className="h-9 flex items-center px-3 rounded-md border border-purple-200 bg-purple-100 text-xs text-purple-700 font-medium">
                {pesoPorChapa > 0 ? `${pesoPorChapa.toFixed(2)} kg/chapa` : "—"}
              </div>
            </div>
          </div>

          {form.reserva_tipo === "parcial" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-purple-800">
                  Quantidade de Chapas
                  {reservaPct && <span className="ml-2 font-normal text-purple-600">→ {reservaPct}% do total</span>}
                </Label>
                <Input
                  type="number"
                  placeholder={`Ex: ${qtdTotal}`}
                  value={form.reserva_qtd_chapas || ""}
                  onChange={e => handleQtdChapas(e.target.value)}
                  className="bg-white border-purple-300"
                  max={qtdTotal}
                />
                <p className="text-[10px] text-purple-500">de {qtdTotal} chapas disponíveis</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-purple-800">Peso Reservado (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 150,5"
                  value={form.reserva_kg || ""}
                  onChange={e => handlePeso(e.target.value)}
                  className="bg-white border-purple-300"
                />
                <p className="text-[10px] text-purple-500">de {pesoTotal.toFixed(2)} kg total</p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-purple-800">Número do Pedido</Label>
            <Input
              placeholder="Ex: 12345 ou N/A"
              value={form.reserva_numero_pedido || ""}
              onChange={e => set("reserva_numero_pedido", e.target.value)}
              className="bg-white border-purple-300"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-purple-800">Motivo da Reserva *</Label>
            <Textarea
              placeholder="Ex: Pedido urgente cliente X, aguardando programação..."
              value={form.reserva_motivo || ""}
              onChange={e => set("reserva_motivo", e.target.value)}
              className="bg-white border-purple-300 text-xs"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-purple-800">Autorizado por *</Label>
              <Input
                placeholder="Nome completo"
                value={form.reserva_autorizado_por || ""}
                onChange={e => set("reserva_autorizado_por", e.target.value)}
                className="bg-white border-purple-300 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-purple-800">Data da Reserva</Label>
              <Input
                type="date"
                value={form.reserva_data || new Date().toISOString().split("T")[0]}
                onChange={e => set("reserva_data", e.target.value)}
                className="bg-white border-purple-300 text-xs"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}