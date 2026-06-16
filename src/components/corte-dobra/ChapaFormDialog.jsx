import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Camera, Paperclip, X, Loader2 } from "lucide-react";

export default function ChapaFormDialog({ open, onClose, onSave, proximoCodigo }) {
  const [form, setForm] = useState({
    codigo: "",
    data_corte: new Date().toISOString().slice(0, 10),
    comprimento_mm: "",
    largura_mm: "",
    espessura_mm: "",
    material: "",
    quantidade_total: "",
    destino: "estoque",
    numero_pedido: "",
    cliente: "",
    observacoes: "",
    foto_url: "",
    foto_nome: ""
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef();
  const cameraRef = useRef();

  useEffect(() => {
    if (open) {
      setForm({
        codigo: proximoCodigo || "",
        data_corte: new Date().toISOString().slice(0, 10),
        comprimento_mm: "",
        largura_mm: "",
        espessura_mm: "",
        material: "",
        quantidade_total: "",
        destino: "estoque",
        numero_pedido: "",
        cliente: "",
        observacoes: "",
        foto_url: "",
        foto_nome: ""
      });
    }
  }, [open, proximoCodigo]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, foto_url: file_url, foto_nome: file.name }));
    setUploading(false);
  };

  const canSave = form.foto_url && form.comprimento_mm && form.quantidade_total;

  const handleSave = () => {
    const bobinaDescricao = [
      form.material && `Mat: ${form.material}`,
      form.espessura_mm && `${form.espessura_mm}mm`,
    ].filter(Boolean).join(" — ") || "Entrada manual";

    onSave({
      codigo: form.codigo,
      origem: "manual",
      comprimento_mm: Number(form.comprimento_mm),
      largura_mm: form.largura_mm ? Number(form.largura_mm) : undefined,
      quantidade_total: Number(form.quantidade_total),
      quantidade_disponivel: Number(form.quantidade_total),
      destino: form.destino,
      numero_pedido: form.destino === "pedido_direto" ? form.numero_pedido : undefined,
      cliente: form.destino === "pedido_direto" ? form.cliente : undefined,
      data_corte: form.data_corte,
      foto_finalizacao_url: form.foto_url,
      bobina_descricao: bobinaDescricao,
      observacoes: form.observacoes,
      status: "disponivel",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Chapa Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Código + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código (auto)</Label>
              <Input value={form.codigo} disabled className="font-mono bg-muted/40" />
            </div>
            <div className="space-y-1">
              <Label>Data de Entrada</Label>
              <Input type="date" value={form.data_corte} onChange={e => set("data_corte", e.target.value)} />
            </div>
          </div>

          {/* Material + Espessura */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Material</Label>
              <Input placeholder="Ex: Aço galvanizado" value={form.material} onChange={e => set("material", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Espessura (mm)</Label>
              <Input type="number" step="0.01" placeholder="Ex: 4,75" value={form.espessura_mm} onChange={e => set("espessura_mm", e.target.value)} />
            </div>
          </div>

          {/* Dimensões */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Comprimento (mm) *</Label>
              <Input type="number" placeholder="Ex: 3000" value={form.comprimento_mm} onChange={e => set("comprimento_mm", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Largura (mm)</Label>
              <Input type="number" placeholder="Ex: 1500" value={form.largura_mm} onChange={e => set("largura_mm", e.target.value)} />
            </div>
          </div>

          {/* Quantidade */}
          <div className="space-y-1">
            <Label>Quantidade *</Label>
            <Input type="number" placeholder="Ex: 10" value={form.quantidade_total} onChange={e => set("quantidade_total", e.target.value)} />
          </div>

          {/* Destino */}
          <div className="space-y-1">
            <Label>Destino</Label>
            <Select value={form.destino} onValueChange={v => set("destino", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="estoque">Estoque (Chaparia)</SelectItem>
                <SelectItem value="pedido_direto">Pedido Direto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.destino === "pedido_direto" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nº Pedido</Label>
                <Input placeholder="Ex: PED-123" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
              </div>
            </div>
          )}

          {/* Foto (obrigatória) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Foto da Chapa *
              <span className="text-xs text-destructive font-normal">— obrigatória</span>
            </Label>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf"
              onChange={e => handleUpload(e.target.files[0])} />
            <input ref={cameraRef} type="file" className="hidden" accept="image/*" capture="environment"
              onChange={e => handleUpload(e.target.files[0])} />
            {form.foto_url ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs">
                <img src={form.foto_url} alt="Preview" className="w-12 h-12 object-cover rounded border" />
                <span className="truncate flex-1 text-emerald-800 font-medium">{form.foto_nome || "Foto anexada"}</span>
                <button onClick={() => setForm(f => ({ ...f, foto_url: "", foto_nome: "" }))}
                  className="text-emerald-600 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 border-dashed border-2 h-12 text-sm gap-2"
                  onClick={() => fileInputRef.current.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  {uploading ? "Enviando..." : "Anexar foto"}
                </Button>
                <Button type="button" variant="outline" className="border-dashed border-2 h-12 px-4"
                  onClick={() => cameraRef.current.click()} disabled={uploading} title="Câmera">
                  <Camera className="w-5 h-5" />
                </Button>
              </div>
            )}
            {!form.foto_url && <p className="text-xs text-destructive">⚠ Anexe uma foto para cadastrar a chapa.</p>}
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Anotações..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>Adicionar Chapa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}