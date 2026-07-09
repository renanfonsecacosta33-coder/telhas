import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2, Camera, X, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import ImageLink from "@/components/ui/ImageLink";

const ETAPA_CORES = [
  { border: "border-l-red-500", bg: "bg-red-50/40", badge: "bg-red-500", text: "text-red-700", label: "Etapa 1" },
  { border: "border-l-orange-500", bg: "bg-orange-50/40", badge: "bg-orange-500", text: "text-orange-700", label: "Etapa 2" },
  { border: "border-l-amber-500", bg: "bg-amber-50/40", badge: "bg-amber-500", text: "text-amber-700", label: "Etapa 3" },
  { border: "border-l-yellow-500", bg: "bg-yellow-50/40", badge: "bg-yellow-500", text: "text-yellow-700", label: "Etapa 4" },
  { border: "border-l-pink-500", bg: "bg-pink-50/40", badge: "bg-pink-500", text: "text-pink-700", label: "Etapa 5+" },
];

function getEtapaColor(etapa) {
  const idx = Math.min((etapa || 1) - 1, ETAPA_CORES.length - 1);
  return ETAPA_CORES[idx];
}

export default function RetrabalhoTelhasDialog({ open, onClose, pedidoOrigem, onCreate }) {
  const [motivo, setMotivo] = useState("");
  const [quantidadeRetrabalho, setQuantidadeRetrabalho] = useState(0);
  const [foto1, setFoto1] = useState(null);
  const [foto2, setFoto2] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const quantMax = pedidoOrigem?.metros || 0;
  const etapaAtual = (pedidoOrigem?.retrabalho_etapa || 0) + 1;
  const etapaCor = getEtapaColor(etapaAtual);

  useEffect(() => {
    if (open && pedidoOrigem) {
      setQuantidadeRetrabalho(pedidoOrigem.metros || 0);
      setMotivo("");
      setFoto1(null);
      setFoto2(null);
    }
  }, [open, pedidoOrigem]);

  const handleClose = () => {
    setMotivo("");
    setQuantidadeRetrabalho(0);
    setFoto1(null);
    setFoto2(null);
    setUploading(false);
    setSaving(false);
    onClose();
  };

  const handleFile = async (file, slot) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (slot === 1) setFoto1(file_url);
      else setFoto2(file_url);
    } catch (err) {
      toast.error("Erro ao enviar imagem: " + (err.message || "tente novamente"));
    } finally {
      setUploading(false);
    }
  };

  const handleQuantidadeChange = (val) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) {
      setQuantidadeRetrabalho(0);
      return;
    }
    if (n > quantMax) {
      toast.error(`Quantidade não pode exceder ${quantMax} telhas (quantidade original)`);
      setQuantidadeRetrabalho(quantMax);
      return;
    }
    setQuantidadeRetrabalho(n);
  };

  const handleSave = async () => {
    if (!motivo.trim()) {
      toast.error("Informe o motivo do retrabalho");
      return;
    }
    if (quantidadeRetrabalho <= 0) {
      toast.error("Informe a quantidade de telhas a reproduzir");
      return;
    }
    if (!pedidoOrigem) return;

    setSaving(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const razao = quantMax > 0 ? quantidadeRetrabalho / quantMax : 1;

      const novoPedido = {
        data: today,
        unidade: pedidoOrigem.unidade || "Matriz AJL",
        vendedor: pedidoOrigem.vendedor || "",
        cliente: pedidoOrigem.cliente || "",
        numero_pedido: pedidoOrigem.numero_pedido || "",
        produto: pedidoOrigem.produto,
        modelo: pedidoOrigem.modelo || "",
        maquina: pedidoOrigem.maquina,
        bobina_superior_id: pedidoOrigem.bobina_superior_id || "",
        bobina_inferior_id: pedidoOrigem.bobina_inferior_id || "",
        bobina_superior: pedidoOrigem.bobina_superior || "",
        bobina_inferior: pedidoOrigem.bobina_inferior || "",
        rvm_superior: pedidoOrigem.rvm_superior || "",
        rvm_inferior: pedidoOrigem.rvm_inferior || "",
        eps: pedidoOrigem.eps || "",
        maquinario_superior: pedidoOrigem.maquinario_superior || "",
        maquinario_inferior: pedidoOrigem.maquinario_inferior || "",
        kg_superior: pedidoOrigem.kg_superior ? +(pedidoOrigem.kg_superior * razao).toFixed(1) : undefined,
        kg_inferior: pedidoOrigem.kg_inferior ? +(pedidoOrigem.kg_inferior * razao).toFixed(1) : undefined,
        kg_total: (pedidoOrigem.kg_superior || pedidoOrigem.kg_inferior)
          ? +(((pedidoOrigem.kg_superior || 0) + (pedidoOrigem.kg_inferior || 0)) * razao).toFixed(1)
          : undefined,
        metros: quantidadeRetrabalho,
        metragem_mm: pedidoOrigem.metragem_mm || undefined,
        quantidade_telhas: pedidoOrigem.metragem_mm ? +(quantidadeRetrabalho * (pedidoOrigem.metragem_mm / 1000)).toFixed(2) : undefined,
        metragem_planejada: pedidoOrigem.metragem_planejada ? +(pedidoOrigem.metragem_planejada * razao).toFixed(1) : undefined,
        isopor_utilizado: pedidoOrigem.isopor_utilizado ? Math.ceil(pedidoOrigem.isopor_utilizado * razao) : undefined,
        status: "pendente",
        data_pedido: today,
        data_prevista: pedidoOrigem.data_prevista || "",
        observacoes: `RETRABALHO (Etapa ${etapaAtual}) — Motivo: ${motivo.trim()}`,
        is_retrabalho: true,
        retrabalho_motivo: motivo.trim(),
        retrabalho_foto_1_url: foto1 || null,
        retrabalho_foto_2_url: foto2 || null,
        retrabalho_origem_id: pedidoOrigem.id,
        retrabalho_quantidade: quantidadeRetrabalho,
        retrabalho_etapa: etapaAtual,
        historico_alteracoes: JSON.stringify([{
          data: new Date().toISOString(),
          usuario: "Sistema",
          acao: "criado",
          acao_label: "Retrabalho Gerado",
          detalhes: `Retrabalho etapa ${etapaAtual} · ${quantidadeRetrabalho} telhas · Motivo: ${motivo.trim()}`,
        }]),
      };

      await base44.entities.Pedido.create(novoPedido);
      toast.success(`Retrabalho gerado! ${quantidadeRetrabalho} telhas voltaram para a fila de produção.`);
      if (onCreate) onCreate();
      handleClose();
    } catch (err) {
      toast.error("Erro ao gerar retrabalho: " + (err.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Gerar Retrabalho
            <span className={`ml-1 px-2 py-0.5 rounded text-xs font-bold text-white ${etapaCor.badge}`}>
              {etapaCor.label}
            </span>
          </DialogTitle>
          <DialogDescription>
            Crie um novo pedido de retrabalho a partir do pedido{" "}
            <strong className="text-foreground">
              {pedidoOrigem?.produto || "—"}
            </strong>
            {pedidoOrigem?.numero_pedido && ` (Pedido: ${pedidoOrigem.numero_pedido})`}
            {pedidoOrigem?.cliente && ` — ${pedidoOrigem.cliente}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumo do pedido original */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Produto:</span>
              <strong>{pedidoOrigem?.produto}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modelo:</span>
              <strong>{pedidoOrigem?.modelo || "—"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Máquina:</span>
              <strong>{pedidoOrigem?.maquina}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Telhas originais:</span>
              <strong className="text-red-600">{quantMax} peças</strong>
            </div>
            {pedidoOrigem?.metragem_mm && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Comprimento:</span>
                <strong>{pedidoOrigem.metragem_mm}mm/peça</strong>
              </div>
            )}
          </div>

          {/* Quantidade a reproduzir */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-red-500" />
              Quantidade de telhas a reproduzir <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min={1}
              max={quantMax}
              value={quantidadeRetrabalho}
              onChange={(e) => handleQuantidadeChange(e.target.value)}
              className="border-red-200 focus-visible:ring-red-400"
            />
            <p className="text-xs text-muted-foreground">
              Quantidade original: <strong>{quantMax}</strong> telhas · Máximo permitido: <strong>{quantMax}</strong>
            </p>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              Motivo do retrabalho <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo pelo qual este retrabalho precisa ser feito..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Fotos */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              Fotos do retrabalho (até 2)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: foto1, set: setFoto1, slot: 1 },
                { val: foto2, set: setFoto2, slot: 2 },
              ].map(({ val, set, slot }) => (
                <div key={slot}>
                  {val ? (
                    <div className="relative group">
                      <ImageLink url={val} name={`Foto ${slot}`} className="block">
                        <img src={val} alt={`Foto ${slot}`} className="w-full h-28 object-cover rounded-lg border-2 border-red-300" />
                      </ImageLink>
                      <button onClick={() => set(null)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-red-300 rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
                      {uploading ? <Loader2 className="w-5 h-5 text-red-500 animate-spin" /> : <Camera className="w-5 h-5 text-red-400" />}
                      <span className="text-xs text-red-500 font-medium mt-1">Foto {slot}</span>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0], slot)} />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading || !motivo.trim() || quantidadeRetrabalho <= 0}
            className="bg-red-600 hover:bg-red-700 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            Gerar Retrabalho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}