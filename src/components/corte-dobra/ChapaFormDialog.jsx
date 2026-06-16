import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Camera, Paperclip, FileCheck, ShieldCheck, X, Loader2 } from "lucide-react";
import ReservaPanel from "@/components/bobinas/ReservaPanel";

export default function ChapaFormDialog({ open, onClose, onSave, proximoCodigo }) {
  const [form, setForm] = useState({
    codigo: "",
    data_corte: new Date().toISOString().slice(0, 10),
    comprimento_mm: "",
    largura_mm: "",
    espessura_mm: "",
    material: "",
    qualidade: "",
    quantidade_total: "",
    peso_kg: "",
    destino: "estoque",
    numero_pedido: "",
    cliente: "",
    observacoes: "",
    anexo_nf_url: "",
    anexo_nf_nome: "",
    anexo_cf_url: "",
    anexo_cf_nome: "",
    reservada: false,
    reserva_tipo: "",
    reserva_kg: "",
    reserva_numero_pedido: "",
    reserva_motivo: "",
    reserva_autorizado_por: "",
    reserva_data: "",
  });
  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingCF, setUploadingCF] = useState(false);
  const nfInputRef = useRef();
  const nfCameraRef = useRef();
  const cfInputRef = useRef();
  const cfCameraRef = useRef();

  useEffect(() => {
    if (open) {
      setForm({
        codigo: proximoCodigo || "",
        data_corte: new Date().toISOString().slice(0, 10),
        comprimento_mm: "",
        largura_mm: "",
        espessura_mm: "",
        material: "",
        qualidade: "",
        quantidade_total: "",
        peso_kg: "",
        destino: "estoque",
        numero_pedido: "",
        cliente: "",
        observacoes: "",
        anexo_nf_url: "",
        anexo_nf_nome: "",
        anexo_cf_url: "",
        anexo_cf_nome: "",
        reservada: false,
        reserva_tipo: "",
        reserva_kg: "",
        reserva_numero_pedido: "",
        reserva_motivo: "",
        reserva_autorizado_por: "",
        reserva_data: "",
      });
    }
  }, [open, proximoCodigo]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleUpload = async (file, tipo) => {
    if (!file) return;
    if (tipo === "nf") setUploadingNF(true);
    else setUploadingCF(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (tipo === "nf") {
      setForm(f => ({ ...f, anexo_nf_url: file_url, anexo_nf_nome: file.name }));
      setUploadingNF(false);
    } else {
      setForm(f => ({ ...f, anexo_cf_url: file_url, anexo_cf_nome: file.name }));
      setUploadingCF(false);
    }
  };

  const canSave = form.comprimento_mm && form.quantidade_total;

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
      espessura_mm: form.espessura_mm ? Number(form.espessura_mm) : undefined,
      material: form.material || undefined,
      qualidade: form.qualidade || undefined,
      quantidade_total: Number(form.quantidade_total),
      quantidade_disponivel: Number(form.quantidade_total),
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      destino: form.destino,
      numero_pedido: form.destino === "pedido_direto" ? form.numero_pedido : undefined,
      cliente: form.destino === "pedido_direto" ? form.cliente : undefined,
      data_corte: form.data_corte,
      foto_finalizacao_url: undefined,
      anexo_nf_url: form.anexo_nf_url || undefined,
      anexo_nf_nome: form.anexo_nf_nome || undefined,
      anexo_cf_url: form.anexo_cf_url || undefined,
      anexo_cf_nome: form.anexo_cf_nome || undefined,
      bobina_descricao: bobinaDescricao,
      observacoes: form.observacoes,
      status: "disponivel",
      reservada: form.reservada || false,
      reserva_tipo: form.reservada ? form.reserva_tipo : undefined,
      reserva_kg: (form.reservada && form.reserva_tipo === "parcial" && form.reserva_kg) ? Number(form.reserva_kg) : undefined,
      reserva_numero_pedido: form.reservada ? form.reserva_numero_pedido : undefined,
      reserva_motivo: form.reservada ? form.reserva_motivo : undefined,
      reserva_autorizado_por: form.reservada ? form.reserva_autorizado_por : undefined,
      reserva_data: form.reservada ? (form.reserva_data || new Date().toISOString().split("T")[0]) : undefined,
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

          {/* Material + Qualidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Material</Label>
              <Select value={form.material || ""} onValueChange={v => set("material", v || undefined)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chapa xadrez">Chapa xadrez</SelectItem>
                  <SelectItem value="Chapa lisa">Chapa lisa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Qualidade</Label>
              <Select value={form.qualidade || ""} onValueChange={v => set("qualidade", v || undefined)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
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

          {/* Espessura */}
          <div className="space-y-1">
            <Label>Espessura (mm)</Label>
            <Input type="number" step="0.01" placeholder="Ex: 4,75" value={form.espessura_mm} onChange={e => set("espessura_mm", e.target.value)} />
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

          {/* Peso + Quantidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.01" placeholder="Ex: 150,5" value={form.peso_kg} onChange={e => set("peso_kg", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Quantidade *</Label>
              <Input type="number" placeholder="Ex: 10" value={form.quantidade_total} onChange={e => set("quantidade_total", e.target.value)} />
            </div>
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

          {/* Anexos: NF + CF */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Anexos
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {/* NF */}
              <div className="space-y-1.5">
                <input ref={nfInputRef} type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => handleUpload(e.target.files[0], "nf")} />
                <input ref={nfCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => handleUpload(e.target.files[0], "nf")} />
                {form.anexo_nf_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <FileCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <a href={form.anexo_nf_url} target="_blank" rel="noopener noreferrer"
                      className="truncate flex-1 underline underline-offset-2 font-medium" title={form.anexo_nf_nome}>
                      {form.anexo_nf_nome || "NF anexada"}
                    </a>
                    <button onClick={() => setForm(f => ({ ...f, anexo_nf_url: "", anexo_nf_nome: "" }))}
                      className="ml-auto text-emerald-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="flex-1 border-dashed border-2 h-10 text-xs gap-1.5"
                      onClick={() => nfInputRef.current.click()} disabled={uploadingNF}>
                      {uploadingNF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      {uploadingNF ? "Enviando..." : "Anexar NF"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-dashed border-2 h-10 px-3"
                      onClick={() => nfCameraRef.current.click()} disabled={uploadingNF} title="Câmera">
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* CF (Certificado do Fornecedor) */}
              <div className="space-y-1.5">
                <input ref={cfInputRef} type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => handleUpload(e.target.files[0], "cf")} />
                <input ref={cfCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => handleUpload(e.target.files[0], "cf")} />
                {form.anexo_cf_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                    <a href={form.anexo_cf_url} target="_blank" rel="noopener noreferrer"
                      className="truncate flex-1 underline underline-offset-2 font-medium" title={form.anexo_cf_nome}>
                      {form.anexo_cf_nome || "CF anexado"}
                    </a>
                    <button onClick={() => setForm(f => ({ ...f, anexo_cf_url: "", anexo_cf_nome: "" }))}
                      className="ml-auto text-blue-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="flex-1 border-dashed border-2 h-10 text-xs gap-1.5"
                      onClick={() => cfInputRef.current.click()} disabled={uploadingCF}>
                      {uploadingCF ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      {uploadingCF ? "Enviando..." : "Anexar CF"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-dashed border-2 h-10 px-3"
                      onClick={() => cfCameraRef.current.click()} disabled={uploadingCF} title="Câmera">
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reserva */}
          <ReservaPanel form={form} onChange={setForm} />

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