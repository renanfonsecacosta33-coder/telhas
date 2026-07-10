import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Truck, Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export default function CargaFormDialog({ open, onClose, editItem, filialAtiva }) {
  const [form, setForm] = useState({
    motorista_nome: "",
    placa: "",
    transportadora: "",
    observacoes: "",
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm({
        motorista_nome: editItem?.motorista_nome || "",
        placa: editItem?.placa || "",
        transportadora: editItem?.transportadora || "",
        observacoes: editItem?.observacoes || "",
      });
    }
  }, [open, editItem]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.motorista_nome?.trim()) {
      toast.error("Informe o nome do motorista.");
      return;
    }
    const unidade = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"].includes(filialAtiva) ? filialAtiva : "Matriz AJL";
    setSaving(true);
    try {
      const payload = {
        motorista_nome: form.motorista_nome.trim(),
        placa: form.placa || "",
        transportadora: form.transportadora || "",
        observacoes: form.observacoes || "",
        unidade,
        status: "carregando",
        pedidos_json: "[]",
        data_criacao: format(new Date(), "yyyy-MM-dd"),
        historico: JSON.stringify([{ data: new Date().toISOString(), usuario: "—", acao: "Carga criada", detalhes: "" }]),
      };
      await base44.entities.Carga.create(payload);
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
      toast.success("Carga criada com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao criar carga: " + (error?.message || "Tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {editItem ? "Editar Carga" : "Nova Carga / Caminhão"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome do Motorista *</Label>
            <Input placeholder="Ex: João Silva" value={form.motorista_nome} onChange={e => set("motorista_nome", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Placa do Caminhão</Label>
              <Input placeholder="Ex: ABC-1234" value={form.placa} onChange={e => set("placa", e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1">
              <Label>Transportadora</Label>
              <Input placeholder="Ex: Expresso AJL" value={form.transportadora} onChange={e => set("transportadora", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Ex: Rota centro da cidade..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar Carga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}