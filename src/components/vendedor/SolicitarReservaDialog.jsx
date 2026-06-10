import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Loader2, BookmarkPlus } from "lucide-react";

export default function SolicitarReservaDialog({ open, onClose, bobina, vendedorNome, setor }) {
  const [form, setForm] = useState({
    reserva_tipo: "inteira",
    reserva_kg: "",
    numero_pedido: "",
    cliente: "",
    motivo: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setSaving(true);
    await base44.entities.SolicitacaoReserva.create({
      setor,
      bobina_id: bobina.id,
      bobina_descricao: `${bobina.cor} — ${bobina.chapa}mm — ${bobina.peso_kg ? bobina.peso_kg.toLocaleString("pt-BR") + " kg" : ""}`,
      vendedor_nome: vendedorNome,
      numero_pedido: form.numero_pedido,
      cliente: form.cliente,
      reserva_tipo: form.reserva_tipo,
      reserva_kg: form.reserva_tipo === "parcial" && form.reserva_kg ? Number(form.reserva_kg) : undefined,
      motivo: form.motivo,
      status: "pendente",
    });
    setSaving(false);
    setDone(true);
  };

  const handleClose = () => {
    setDone(false);
    setForm({ reserva_tipo: "inteira", reserva_kg: "", numero_pedido: "", cliente: "", motivo: "" });
    onClose();
  };

  if (!bobina) return null;

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
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-semibold">{bobina.cor} — {bobina.chapa}mm</p>
              <p className="text-muted-foreground">{bobina.peso_kg ? `${bobina.peso_kg.toLocaleString("pt-BR")} kg` : "—"} disponível</p>
            </div>

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
                <Select value={form.reserva_tipo} onValueChange={v => set("reserva_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inteira">Bobina inteira</SelectItem>
                    <SelectItem value="parcial">Parcial (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.reserva_tipo === "parcial" && (
                <div className="space-y-1">
                  <Label>Quantidade (kg)</Label>
                  <Input type="number" placeholder="Ex: 500" value={form.reserva_kg} onChange={e => set("reserva_kg", e.target.value)} />
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