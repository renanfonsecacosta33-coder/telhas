import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, LockOpen } from "lucide-react";

export default function ReservaPanel({ form, onChange }) {
  const set = (key, val) => onChange({ ...form, [key]: val });

  const reservaPct = form.reservada && form.reserva_tipo === "parcial" && form.reserva_kg && form.peso_kg
    ? Math.min(100, (Number(form.reserva_kg) / Number(form.peso_kg)) * 100).toFixed(0)
    : null;

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 transition-colors ${form.reservada ? "border-purple-400/50 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-700/60" : "border-border bg-muted/20"}`}>
      {/* Toggle reserva */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {form.reservada ? <Lock className="w-4 h-4 text-purple-700 dark:text-purple-300" /> : <LockOpen className="w-4 h-4 text-muted-foreground" />}
          <span className={`text-sm font-semibold ${form.reservada ? "text-purple-800 dark:text-purple-200" : "text-foreground"}`}>
            Reserva de Bobina
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...form, reservada: !form.reservada })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.reservada ? "bg-purple-600" : "bg-muted border border-border"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${form.reservada ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {form.reservada && (
        <>
          {/* Tipo de reserva */}
          <div className="space-y-1">
            <Label className="text-xs text-purple-800 dark:text-purple-200 font-medium">Tipo de Reserva *</Label>
            <Select value={form.reserva_tipo || ""} onValueChange={v => set("reserva_tipo", v)}>
              <SelectTrigger className="bg-background border-purple-300 dark:border-purple-700 text-foreground">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inteira">Bobina Inteira</SelectItem>
                <SelectItem value="parcial">Parcial (em kg)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantidade parcial */}
          {form.reserva_tipo === "parcial" && (
            <div className="space-y-1">
              <Label className="text-xs text-purple-800 dark:text-purple-200 font-medium">
                Quantidade Reservada (kg)
                {reservaPct && <span className="ml-2 font-normal text-purple-600 dark:text-purple-400">→ {reservaPct}% do peso atual</span>}
              </Label>
              <Input
                type="number"
                placeholder="Ex: 500"
                value={form.reserva_kg || ""}
                onChange={e => set("reserva_kg", e.target.value)}
                className="bg-background border-purple-300 dark:border-purple-700 text-foreground"
              />
            </div>
          )}

          {/* Número do pedido */}
          <div className="space-y-1">
            <Label className="text-xs text-purple-800 dark:text-purple-200 font-medium">Número do Pedido</Label>
            <Input
              placeholder="Ex: 12345 ou N/A"
              value={form.reserva_numero_pedido || ""}
              onChange={e => set("reserva_numero_pedido", e.target.value)}
              className="bg-background border-purple-300 dark:border-purple-700 text-foreground"
            />
          </div>

          {/* Motivo */}
          <div className="space-y-1">
            <Label className="text-xs text-purple-800 dark:text-purple-200 font-medium">Motivo da Reserva *</Label>
            <Textarea
              placeholder="Ex: Pedido urgente cliente X, aguardando programação..."
              value={form.reserva_motivo || ""}
              onChange={e => set("reserva_motivo", e.target.value)}
              className="bg-background border-purple-300 dark:border-purple-700 text-foreground text-xs"
              rows={2}
            />
          </div>

          {/* Autorizado por + data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-purple-800 dark:text-purple-200 font-medium">Autorizado por *</Label>
              <Input
                placeholder="Nome completo"
                value={form.reserva_autorizado_por || ""}
                onChange={e => set("reserva_autorizado_por", e.target.value)}
                className="bg-background border-purple-300 dark:border-purple-700 text-foreground text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-purple-800 dark:text-purple-200 font-medium">Data da Reserva</Label>
              <Input
                type="date"
                value={form.reserva_data || new Date().toISOString().split("T")[0]}
                onChange={e => set("reserva_data", e.target.value)}
                className="bg-background border-purple-300 dark:border-purple-700 text-foreground text-xs"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}