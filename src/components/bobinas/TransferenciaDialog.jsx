import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Loader2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

const FILIAIS = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];

export default function TransferenciaDialog({ open, onClose, item, itemTipo = "bobina", itemLabel, setor, unidadeOrigem }) {
  const [form, setForm] = useState({
    unidade_destino: "",
    transferencia_tipo: "inteira",
    peso_kg: "",
    numero_pedido: "",
    cliente: "",
    motivo: "",
  });
  const [solicitante, setSolicitante] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setSolicitante(u?.full_name || "")).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (!item) return null;

  const pesoTotal = item.peso_kg || 0;
  const tipoLabel = itemTipo === "chapa" ? "Chapa" : itemTipo === "slitter" ? "Slitter" : "Bobina";
  const itemDesc = itemLabel || "Item";
  const destinosDisponiveis = FILIAIS.filter(f => f !== unidadeOrigem);

  const handleSubmit = async () => {
    if (!form.unidade_destino) { toast.error("Selecione a filial de destino."); return; }
    if (form.transferencia_tipo === "parcial") {
      const kg = Number(form.peso_kg);
      if (!kg || kg <= 0) { toast.error("Informe a quantidade em kg para a transferência parcial."); return; }
      if (kg > pesoTotal) { toast.error(`Quantidade excede o peso total (${pesoTotal.toLocaleString("pt-BR")} kg).`); return; }
    }
    if (!solicitante) { toast.error("Não foi possível identificar o usuário logado."); return; }

    setSaving(true);
    try {
      await base44.entities.Transferencia.create({
        unidade_origem: unidadeOrigem,
        unidade_destino: form.unidade_destino,
        setor,
        item_tipo: itemTipo,
        item_id: item.id,
        item_descricao: `${itemDesc} — ${pesoTotal.toLocaleString("pt-BR")} kg`,
        solicitante_nome: solicitante,
        transferencia_tipo: form.transferencia_tipo,
        peso_kg: form.transferencia_tipo === "parcial" && form.peso_kg ? Number(form.peso_kg) : undefined,
        numero_pedido: form.numero_pedido,
        cliente: form.cliente,
        motivo: form.motivo,
        status: "pendente",
      });
      setDone(true);
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.message || error?.message || "Erro ao enviar solicitação de transferência";
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    setForm({ unidade_destino: "", transferencia_tipo: "inteira", peso_kg: "", numero_pedido: "", cliente: "", motivo: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Transferir entre Filiais
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-3">
            <div className="text-4xl">📦</div>
            <p className="font-semibold text-lg">Solicitação de transferência enviada!</p>
            <p className="text-sm text-muted-foreground">
              A filial de destino (<strong>{form.unidade_destino}</strong>) foi notificada e irá avaliar a solicitação.
            </p>
            <Button onClick={handleClose} className="mt-2 w-full">Fechar</Button>
          </div>
        ) : (
          <>
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p className="font-semibold">{itemDesc}</p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Origem:</span>
                <span className="font-semibold">{unidadeOrigem}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Peso total:</span>
                <span className="font-semibold">{pesoTotal.toLocaleString("pt-BR")} kg</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Destino *</Label>
                <Select value={form.unidade_destino} onValueChange={v => set("unidade_destino", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar filial..." /></SelectTrigger>
                  <SelectContent>
                    {destinosDisponiveis.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Tipo de Transferência</Label>
                <Select value={form.transferencia_tipo} onValueChange={v => set("transferencia_tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inteira">{tipoLabel} inteira ({pesoTotal.toLocaleString("pt-BR")} kg)</SelectItem>
                    <SelectItem value="parcial">Parcial (kg)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.transferencia_tipo === "parcial" && (
                <div className="space-y-1">
                  <Label>Quantidade (kg) <span className="text-muted-foreground font-normal">— máx: {pesoTotal.toLocaleString("pt-BR")} kg</span></Label>
                  <Input type="number" max={pesoTotal} placeholder={`Ex: ${Math.min(500, Math.round(pesoTotal))}`} value={form.peso_kg} onChange={e => set("peso_kg", e.target.value)} />
                </div>
              )}

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
                <Label>Observações</Label>
                <Textarea placeholder="Justificativa, prazo, etc..." value={form.motivo} onChange={e => set("motivo", e.target.value)} rows={2} />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={saving || !solicitante} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}