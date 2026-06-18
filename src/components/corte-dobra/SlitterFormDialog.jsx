import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X } from "lucide-react";

export default function SlitterFormDialog({ open, onClose, onSave, editItem, proximoCodigo }) {
  const [codigo] = useState(editItem?.codigo || `ST${String(proximoCodigo).padStart(4, "0")}`);
  const [data] = useState(editItem?.data || new Date().toISOString().split("T")[0]);
  const [pesoKg, setPesoKg] = useState(editItem?.peso_kg || "");
  const [nf, setNf] = useState(editItem?.nf || "");
  const [larguraMm, setLarguraMm] = useState(editItem?.largura_mm || "");
  const [qualidade, setQualidade] = useState(editItem?.qualidade || "GV");
  const [espessuraMm, setEspessuraMm] = useState(editItem?.espessura_mm || "");
  const [materiais, setMateriais] = useState(editItem?.materiais_producao || "");
  const [status, setStatus] = useState(editItem?.status || "Disponível");
  const [observacoes, setObservacoes] = useState(editItem?.observacoes || "");
  const [anexoUrl, setAnexoUrl] = useState(editItem?.anexo_nf_url || "");
  const [anexoNome, setAnexoNome] = useState(editItem?.anexo_nf_nome || "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAnexoUrl(file_url);
    setAnexoNome(file.name);
    setUploading(false);
  };

  const handleSave = () => {
    onSave({
      codigo,
      data,
      peso_kg: Number(pesoKg),
      nf: nf || null,
      largura_mm: Number(larguraMm),
      qualidade,
      espessura_mm: Number(espessuraMm),
      materiais_producao: materiais || null,
      status,
      observacoes: observacoes || null,
      anexo_nf_url: anexoUrl || null,
      anexo_nf_nome: anexoNome || null,
    });
  };

  const canSave = pesoKg && larguraMm && espessuraMm;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editItem ? "Editar Slitter" : "Nova Slitter"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={codigo} disabled className="bg-muted font-mono" />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input value={data} disabled className="bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Peso (kg) *</Label>
              <Input type="number" step="0.01" placeholder="Ex: 2500" value={pesoKg} onChange={e => setPesoKg(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>NF</Label>
              <Input placeholder="Nº da nota fiscal" value={nf} onChange={e => setNf(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Largura (mm) *</Label>
              <Input type="number" placeholder="Ex: 1200" value={larguraMm} onChange={e => setLarguraMm(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Espessura (mm) *</Label>
              <Input type="number" step="0.01" placeholder="Ex: 0.95" value={espessuraMm} onChange={e => setEspessuraMm(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Qualidade</Label>
              <Select value={qualidade} onValueChange={setQualidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GV">GV</SelectItem>
                  <SelectItem value="FF">FF</SelectItem>
                  <SelectItem value="PP">PP</SelectItem>
                  <SelectItem value="FQ">FQ</SelectItem>
                  <SelectItem value="GL (IMP)">GL (IMP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Materiais de Produção</Label>
            <Textarea
              placeholder='Ex: 75x40 / 68x30 / 100x40'
              className="h-20"
              value={materiais}
              onChange={e => setMateriais(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Informe os materiais separados por "/"</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Status</Label>
              <Input placeholder="Ex: Disponível, Em uso..." value={status} onChange={e => setStatus(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Anexar NF</Label>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,image/*"
                onChange={e => handleUpload(e.target.files[0])} />
              {anexoUrl ? (
                <div className="flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs">
                  <span className="truncate flex-1 text-emerald-800 font-medium">{anexoNome}</span>
                  <button onClick={() => { setAnexoUrl(""); setAnexoNome(""); }} className="text-emerald-600 hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full border-dashed border-2 h-10 text-sm gap-2"
                  onClick={() => fileRef.current.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  {uploading ? "Enviando..." : "Anexar NF"}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Input placeholder="Observações..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}