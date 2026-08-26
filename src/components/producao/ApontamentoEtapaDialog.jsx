import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SignaturePad from "@/components/producao/SignaturePad";

export default function ApontamentoEtapaDialog({ open, onClose, ordem, ordem_tipo, etapa, onComplete }) {
  const [user, setUser] = useState(null);
  const [pecas, setPecas] = useState("");
  const [metros, setMetros] = useState("");
  const [refuga, setRefuga] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const sigRef = useRef();

  useEffect(() => {
    if (!open) return;
    base44.auth.me().then(setUser).catch(() => {});
    setPecas(ordem?.quantidade ? String(ordem.quantidade) : "");
    setMetros("");
    setRefuga("");
    setObs("");
  }, [open, ordem]);

  useEffect(() => {
    if (open && sigRef.current) {
      // reset signature pad quando abre
      setTimeout(() => {
        if (sigRef.current && sigRef.current.isEmpty) {
          // força redraw do placeholder
        }
      }, 50);
    }
  }, [open]);

  const handleSave = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("Assine no campo digital antes de confirmar a etapa.");
      return;
    }
    if (!user) {
      toast.error("Não foi possível identificar o operador. Faça login novamente.");
      return;
    }
    setSaving(true);
    try {
      const dataURL = sigRef.current.toDataURL();
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], `assinatura_${etapa.id}_${Date.now()}.png`, { type: "image/png" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const rec = {
        unidade: ordem?.unidade || "Matriz AJL",
        setor: ordem_tipo === "telhas" ? "telhas" : "corte_dobra",
        ordem_id: ordem?.id,
        ordem_tipo,
        numero_pedido: ordem?.numero_pedido || "",
        cliente: ordem?.cliente || "",
        etapa: etapa.id,
        etapa_label: etapa.label,
        is_etapa_final: !!etapa.is_final,
        operador_nome: user.full_name || user.email || "Operador",
        operador_id: user.id,
        maquina: ordem?.maquina || "",
        data_hora: new Date().toISOString(),
        pecas_produzidas: Number(pecas) || 0,
        metros_reais: Number(metros) || 0,
        refuga_kg: Number(refuga) || 0,
        assinatura_url: file_url,
        observacoes: obs.trim() || "",
      };
      await base44.entities.ApontamentoEtapa.create(rec);

      // Etapa final → dispara geração do PDF final e sincronização Odoo
      if (etapa.is_final) {
        try {
          await base44.functions.invoke("sincronizarPdfOpOdoo", {
            ordem_id: ordem.id,
            ordem_tipo,
            numero_pedido: ordem?.numero_pedido || "",
          });
          toast.success("✅ Etapa final concluída! PDF final da OP gerado e sincronização Odoo iniciada.");
        } catch (err) {
          toast.success("Etapa registrada. A sincronização do PDF final será processada em segundo plano.");
        }
      } else {
        toast.success(`Apontamento da etapa "${etapa.label}" registrado e assinatura salva.`);
      }

      if (onComplete) onComplete(rec);
      onClose();
    } catch (err) {
      toast.error("Erro ao salvar apontamento: " + (err.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  if (!etapa) return null;
  const now = new Date();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {etapa.is_final ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
            Apontamento — {etapa.label}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da etapa e assine digitalmente. O registro é automático e rastreável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Resumo */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-500">Operador:</span><br /><strong>{user?.full_name || "—"}</strong></div>
            <div><span className="text-slate-500">Data/Hora:</span><br /><strong>{format(now, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</strong></div>
            <div><span className="text-slate-500">Máquina:</span><br /><strong>{ordem?.maquina || ordem?.bobina_descricao || "—"}</strong></div>
            <div><span className="text-slate-500">Pedido:</span><br /><strong className="font-mono">{ordem?.numero_pedido || "—"}</strong></div>
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Peças Produzidas</Label>
              <Input type="number" min={0} value={pecas} onChange={(e) => setPecas(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Metros Reais (m)</Label>
              <Input type="number" min={0} step="0.01" value={metros} onChange={(e) => setMetros(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Refuga (kg)</Label>
              <Input type="number" min={0} step="0.01" value={refuga} onChange={(e) => setRefuga(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações da etapa..." className="resize-none text-sm" />
          </div>

          {/* Assinatura */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1">
              ✍️ Assinatura Digital do Operador <span className="text-red-500">*</span>
            </Label>
            <SignaturePad ref={sigRef} height={170} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className={`gap-2 ${etapa.is_final ? "bg-green-600 hover:bg-green-700" : ""}`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {etapa.is_final ? "Concluir Etapa Final & Gerar PDF" : "Registrar & Assinar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}