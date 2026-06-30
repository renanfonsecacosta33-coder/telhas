import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Loader2, BookmarkPlus } from "lucide-react";
import { toast } from "sonner";

export default function SolicitarReservaDialog({ open, onClose, bobina, vendedorNome, setor }) {
  const [form, setForm] = useState({
    reserva_tipo: "parcial",
    reserva_kg: "",
    numero_pedido: "",
    cliente: "",
    motivo: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (!bobina) return null;

  // Calcula peso disponível considerando reserva parcial já existente
  const pesoTotal = bobina.peso_kg || 0;
  const pesoReservado = bobina.reserva_tipo === "parcial" ? (bobina.reserva_kg || 0) : (bobina.reservada ? pesoTotal : 0);
  const pesoDisponivel = pesoTotal - pesoReservado;
  const jaParcial = bobina.reservada && bobina.reserva_tipo === "parcial" && pesoReservado > 0;

  // Se a bobina já tem reserva parcial, força o tipo "parcial"
  const tipoEfetivo = jaParcial ? "parcial" : form.reserva_tipo;

  const handleSubmit = async () => {
    if (tipoEfetivo === "parcial") {
      const kg = Number(form.reserva_kg);
      if (!kg || kg <= 0) { toast.error("Informe a quantidade em kg para a reserva parcial."); return; }
      if (kg > pesoDisponivel) { toast.error(`Quantidade excede o peso disponível (${pesoDisponivel.toLocaleString("pt-BR")} kg).`); return; }
    }
    setSaving(true);
    await base44.entities.SolicitacaoReserva.create({
      setor,
      bobina_id: bobina.id,
      bobina_descricao: `${bobina.cor} — ${bobina.chapa}mm — ${pesoTotal.toLocaleString("pt-BR")} kg${jaParcial ? ` (já reservado: ${pesoReservado.toLocaleString("pt-BR")} kg)` : ""}`,
      vendedor_nome: vendedorNome,
      numero_pedido: form.numero_pedido,
      cliente: form.cliente,
      reserva_tipo: tipoEfetivo,
      reserva_kg: tipoEfetivo === "parcial" && form.reserva_kg ? Number(form.reserva_kg) : undefined,
      motivo: form.motivo,
      status: "pendente",
    });
    setSaving(false);
    setDone(true);
  };

  const handleClose = () => {
    setDone(false);
    setForm({ reserva_tipo: "parcial", reserva_kg: "", numero_pedido: "", cliente: "", motivo: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5" />
            Solicitar Reserva
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-3">
            <div className="text-4xl">✅</div>
            <p className="font-semibold text-lg">Solicitação enviada!</p>
            <p className="text-sm text-muted-foreground">O administrador do barracão irá analisar e responder em breve.</p>
            <Button onClick={handleClose} className="mt-2 w-full">Fechar</Button>
          </div>
        ) : (
          <>
            {/* Info da bobina */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold">{bobina.cor} — {bobina.chapa}mm</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Peso total:</span>
                <span className="font-semibold">{pesoTotal.toLocaleString("pt-BR")} kg</span>
              </div>
              {pesoReservado > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-amber-700">Já reservado:</span>
                  <span className="font-semibold text-amber-700">{pesoReservado.toLocaleString("pt-BR")} kg</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-1">
                <span className="text-emerald-700 font-medium">Disponível:</span>
                <span className="font-bold text-emerald-700">{pesoDisponivel.toLocaleString("pt-BR")} kg</span>
              </div>
            </div>

            {jaParcial && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-800">
                Esta bobina já possui uma reserva parcial. Você pode reservar mais <strong>{pesoDisponivel.toLocaleString("pt-BR")} kg</strong>.
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Vendedor *</Label>
                <Input value={vendedorNome} disabled className="bg-muted/40" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nº Pedido</Label>
                  <Input placeholder="Ex: PED-001" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cliente</Label>
                  <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Tipo de Reserva</Label>
                <Select value={tipoEfetivo} onValueChange={v => set("reserva_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inteira" disabled={jaParcial}>Bobina inteira{jaParcial ? " (indisponível)" : ""}</SelectItem>
                    <SelectItem value="parcial">Parcial (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoEfetivo === "parcial" && (
                <div className="space-y-1">
                  <Label>Quantidade (kg) <span className="text-muted-foreground font-normal">— máx: {pesoDisponivel.toLocaleString("pt-BR")} kg</span></Label>
                  <Input type="number" max={pesoDisponivel} placeholder={`Ex: ${Math.min(500, Math.round(pesoDisponivel))}`} value={form.reserva_kg} onChange={e => set("reserva_kg", e.target.value)} />
                </div>
              )}

              <div className="space-y-1">
                <Label>Observações</Label>
                <Textarea placeholder="Justificativa, prazo, etc..." value={form.motivo} onChange={e => set("motivo", e.target.value)} rows={2} />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saving || !vendedorNome}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar Solicitação"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}