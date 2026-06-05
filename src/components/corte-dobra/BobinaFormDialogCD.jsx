import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Paperclip, FileCheck, X, Loader2, ShieldCheck } from "lucide-react";

const QUALIDADE_OPTIONS = ["GV", "PP", "FF", "FQ"];

export default function BobinaFormDialogCD({ open, onClose, onSave, editItem, proximoNumero }) {
  const [form, setForm] = useState({
    cor: "", chapa: "", qualidade: "", largura_mm: "", peso_kg: "", peso_inicial: "",
    codigo: "", nf: "", custo: "", fornecedor: "",
    data_recebimento: "", observacoes: "",
    anexo_nf_url: "", anexo_nf_nome: "", anexo_cert_url: "", anexo_cert_nome: "",
  });

  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [semCertAssinatura, setSemCertAssinatura] = useState("");
  const [confirmarSemCert, setConfirmarSemCert] = useState(false);
  const nfInputRef = useRef();
  const certInputRef = useRef();

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setForm({
        cor: editItem.cor || "",
        chapa: editItem.chapa || "",
        qualidade: editItem.qualidade || "",
        largura_mm: editItem.largura_mm || "",
        peso_kg: editItem.peso_kg || "",
        peso_inicial: editItem.peso_inicial || "",
        codigo: editItem.codigo || "",
        nf: editItem.nf || "",
        custo: editItem.custo || "",
        fornecedor: editItem.fornecedor || "",
        data_recebimento: editItem.data_recebimento || "",
        observacoes: editItem.observacoes || "",
        anexo_nf_url: editItem.anexo_nf_url || "",
        anexo_nf_nome: editItem.anexo_nf_nome || "",
        anexo_cert_url: editItem.anexo_cert_url || "",
        anexo_cert_nome: editItem.anexo_cert_nome || "",
      });
      setSemCertAssinatura("");
      setConfirmarSemCert(false);
    } else {
      const num = String(proximoNumero || 1).padStart(4, "0");
      setForm({
        cor: "", chapa: "", qualidade: "", largura_mm: "", peso_kg: "", peso_inicial: "",
        codigo: `CD${num}`,
        nf: "", custo: "", fornecedor: "",
        data_recebimento: new Date().toISOString().slice(0, 10),
        observacoes: "",
        anexo_nf_url: "", anexo_nf_nome: "", anexo_cert_url: "", anexo_cert_nome: "",
      });
      setSemCertAssinatura("");
      setConfirmarSemCert(false);
    }
  }, [editItem, open, proximoNumero]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleUpload = async (file, tipo) => {
    if (!file) return;
    if (tipo === "nf") setUploadingNF(true);
    else setUploadingCert(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (tipo === "nf") {
      setForm(f => ({ ...f, anexo_nf_url: file_url, anexo_nf_nome: file.name }));
      setUploadingNF(false);
    } else {
      setForm(f => ({ ...f, anexo_cert_url: file_url, anexo_cert_nome: file.name }));
      setUploadingCert(false);
    }
  };

  const handleSave = () => {
    if (!form.anexo_nf_url) {
      alert("Anexe a Nota Fiscal (NF) antes de salvar a bobina.");
      return;
    }
    onSave({
      ...form,
      setor: "corte_dobra",
      largura_mm: form.largura_mm ? Number(form.largura_mm) : undefined,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      peso_inicial: form.peso_inicial ? Number(form.peso_inicial) : undefined,
      custo: form.custo ? Number(form.custo) : undefined,
      anexo_cert_ausencia: (!form.anexo_cert_url && confirmarSemCert) ? semCertAssinatura.trim() : undefined,
    });
  };

  const certOk = form.anexo_cert_url || (confirmarSemCert && semCertAssinatura.trim().length >= 5);
  const canSave = form.chapa && form.anexo_nf_url && certOk;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Bobina" : "Nova Bobina — Corte e Dobra"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Código + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código (auto)</Label>
              <Input value={form.codigo} onChange={e => set("codigo", e.target.value)} className="font-mono bg-muted/40" />
            </div>
            <div className="space-y-1">
              <Label>Data de Recebimento</Label>
              <Input type="date" value={form.data_recebimento} onChange={e => set("data_recebimento", e.target.value)} />
            </div>
          </div>

          {/* NF + Fornecedor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>NF</Label>
              <Input placeholder="Número da NF" value={form.nf} onChange={e => set("nf", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input placeholder="Ex: Arcelormittal" value={form.fornecedor} onChange={e => set("fornecedor", e.target.value)} />
            </div>
          </div>

          {/* Qualidade + Chapa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Qualidade</Label>
              <Select value={form.qualidade} onValueChange={v => set("qualidade", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{QUALIDADE_OPTIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Chapa Real *</Label>
              <Input placeholder="Ex: 0,43" value={form.chapa} onChange={e => set("chapa", e.target.value)} />
            </div>
          </div>

          {/* Cor (texto livre para CD) */}
          <div className="space-y-1">
            <Label>Cor / Material</Label>
            <Input placeholder="Ex: Galvanizado, Zincado, Pintado Branco..." value={form.cor} onChange={e => set("cor", e.target.value)} />
          </div>

          {/* Largura + Custo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Largura (mm)</Label>
              <Input type="number" placeholder="Ex: 1200" value={form.largura_mm} onChange={e => set("largura_mm", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Custo (R$/kg)</Label>
              <Input type="number" placeholder="0.00" value={form.custo} onChange={e => set("custo", e.target.value)} />
            </div>
          </div>

          {/* Peso Bruto + Peso Inicial */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Peso Bruto (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => set("peso_kg", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso Inicial (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_inicial} onChange={e => set("peso_inicial", e.target.value)} />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Anotações adicionais..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Anexos
              <span className="text-xs text-destructive font-normal ml-1">— NF obrigatória</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {/* NF */}
              <div>
                <input ref={nfInputRef} type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => handleUpload(e.target.files[0], "nf")} />
                {form.anexo_nf_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <FileCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <a href={form.anexo_nf_url} target="_blank" rel="noopener noreferrer"
                      className="truncate flex-1 underline underline-offset-2 font-medium" title={form.anexo_nf_nome}>
                      {form.anexo_nf_nome || "NF anexada"}
                    </a>
                    <button onClick={() => setForm(f => ({ ...f, anexo_nf_url: "", anexo_nf_nome: "" }))}
                      className="ml-auto text-emerald-600 hover:text-red-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm"
                    className="w-full border-dashed border-2 h-10 text-xs gap-2"
                    onClick={() => nfInputRef.current.click()} disabled={uploadingNF}>
                    {uploadingNF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    {uploadingNF ? "Enviando..." : "Anexar NF *"}
                  </Button>
                )}
              </div>

              {/* Certificado Digital */}
              <div>
                <input ref={certInputRef} type="file" className="hidden" accept="image/*,.pdf,.p7b,.cer,.crt"
                  onChange={e => { handleUpload(e.target.files[0], "cert"); setConfirmarSemCert(false); setSemCertAssinatura(""); }} />
                {form.anexo_cert_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                    <a href={form.anexo_cert_url} target="_blank" rel="noopener noreferrer"
                      className="truncate flex-1 underline underline-offset-2 font-medium" title={form.anexo_cert_nome}>
                      {form.anexo_cert_nome || "Certificado"}
                    </a>
                    <button onClick={() => setForm(f => ({ ...f, anexo_cert_url: "", anexo_cert_nome: "" }))}
                      className="ml-auto text-blue-600 hover:text-red-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm"
                    className="w-full border-dashed border-2 h-10 text-xs gap-2"
                    onClick={() => certInputRef.current.click()} disabled={uploadingCert}>
                    {uploadingCert ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    {uploadingCert ? "Enviando..." : "Certificado Digital"}
                  </Button>
                )}
              </div>
            </div>

            {/* Sem certificado */}
            {!form.anexo_cert_url && (
              <div className="mt-2">
                {!confirmarSemCert ? (
                  <button type="button" onClick={() => setConfirmarSemCert(true)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    Não tenho o certificado digital
                  </button>
                ) : (
                  <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 space-y-2">
                    <p className="text-xs text-orange-800 font-medium">
                      ⚠ Declare seu nome completo confirmando que o certificado não foi fornecido:
                    </p>
                    <Input placeholder="Nome completo do responsável" value={semCertAssinatura}
                      onChange={e => setSemCertAssinatura(e.target.value)} className="h-8 text-xs bg-white" />
                    <button type="button" onClick={() => { setConfirmarSemCert(false); setSemCertAssinatura(""); }}
                      className="text-xs text-orange-600 underline underline-offset-2">
                      Cancelar — vou anexar o certificado
                    </button>
                  </div>
                )}
              </div>
            )}

            {!form.anexo_nf_url && (
              <p className="text-xs text-destructive">⚠ Anexe a NF para poder salvar a bobina.</p>
            )}
            {!form.anexo_cert_url && !certOk && (
              <p className="text-xs text-destructive">⚠ Anexe o Certificado Digital ou declare seu nome para confirmar a ausência.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {editItem ? "Salvar" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}