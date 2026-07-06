import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2, Camera, X, Image as ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RetrabalhoDialog({ open, onClose, ordemOrigem, onCreate }) {
  const [motivo, setMotivo] = useState("");
  const [foto1, setFoto1] = useState(null);
  const [foto2, setFoto2] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setMotivo("");
    setFoto1(null);
    setFoto2(null);
    setUploading(false);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
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

  const handleSave = async () => {
    if (!motivo.trim()) {
      toast.error("Informe o motivo do retrabalho");
      return;
    }
    if (!ordemOrigem) return;

    setSaving(true);
    try {
      const isDesb = !ordemOrigem.maquina || ordemOrigem._desb;
      const today = format(new Date(), "yyyy-MM-dd");

      const copia = {
        data: today,
        status: "pendente",
        is_retrabalho: true,
        retrabalho_motivo: motivo.trim(),
        retrabalho_foto_1_url: foto1 || null,
        retrabalho_foto_2_url: foto2 || null,
        retrabalho_origem_id: ordemOrigem.id,
        numero_pedido: ordemOrigem.numero_pedido || null,
        cliente: ordemOrigem.cliente || null,
        quantidade: ordemOrigem.quantidade || null,
        observacoes: `RETRABALHO — Motivo: ${motivo.trim()}`,
        unidade: ordemOrigem.unidade,
      };

      if (isDesb) {
        Object.assign(copia, {
          bobina_id: ordemOrigem.bobina_id,
          bobina_descricao: ordemOrigem.bobina_descricao,
          espessura_utilizada: ordemOrigem.espessura_utilizada,
          comprimento_mm: ordemOrigem.comprimento_mm,
          kg_estimado: ordemOrigem.kg_estimado,
          destino: ordemOrigem.destino || "estoque",
          guilhotina: ordemOrigem.guilhotina,
          tamanho_corte_guilhotina: ordemOrigem.tamanho_corte_guilhotina,
          foto_pedido_url: ordemOrigem.foto_pedido_url,
        });
        await base44.entities.OrdemDesbobinadeira.create(copia);
      } else {
        Object.assign(copia, {
          maquina: ordemOrigem.maquina,
          chapa_cd_id: ordemOrigem.chapa_cd_id,
          chapa_descricao: ordemOrigem.chapa_descricao,
          chapa_origem: ordemOrigem.chapa_origem || "chaparia",
          bobina_id: ordemOrigem.bobina_id,
          bobina_descricao: ordemOrigem.bobina_descricao,
          desenvolvimento_id: ordemOrigem.desenvolvimento_id,
          desenvolvimento_descricao: ordemOrigem.desenvolvimento_descricao,
          tipo_peca: ordemOrigem.tipo_peca,
          dimensoes_livres: ordemOrigem.dimensoes_livres,
          peso_kg: ordemOrigem.peso_kg,
          foto_pedido_url: ordemOrigem.foto_pedido_url,
        });
        await base44.entities.OrdemMaquinaCD.create(copia);
      }

      toast.success("Retrabalho gerado com sucesso!");
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
          </DialogTitle>
          <DialogDescription>
            Crie uma nova ordem de retrabalho a partir da OP{" "}
            <strong className="text-foreground">
              {ordemOrigem?.tipo_peca || ordemOrigem?.bobina_descricao || "—"}
            </strong>
            {ordemOrigem?.numero_pedido && ` (Pedido: ${ordemOrigem.numero_pedido})`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
              {/* Foto 1 */}
              <div>
                {foto1 ? (
                  <div className="relative group">
                    <img src={foto1} alt="Foto 1" className="w-full h-28 object-cover rounded-lg border-2 border-red-300" />
                    <button onClick={() => setFoto1(null)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-red-300 rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
                    {uploading ? <Loader2 className="w-5 h-5 text-red-500 animate-spin" /> : <Camera className="w-5 h-5 text-red-400" />}
                    <span className="text-xs text-red-500 font-medium mt-1">Foto 1</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0], 1)} />
                  </label>
                )}
              </div>
              {/* Foto 2 */}
              <div>
                {foto2 ? (
                  <div className="relative group">
                    <img src={foto2} alt="Foto 2" className="w-full h-28 object-cover rounded-lg border-2 border-red-300" />
                    <button onClick={() => setFoto2(null)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-red-300 rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
                    {uploading ? <Loader2 className="w-5 h-5 text-red-500 animate-spin" /> : <Camera className="w-5 h-5 text-red-400" />}
                    <span className="text-xs text-red-500 font-medium mt-1">Foto 2</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0], 2)} />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading || !motivo.trim()}
            className="bg-red-600 hover:bg-red-700 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            Gerar Retrabalho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}