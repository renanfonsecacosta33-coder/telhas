import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Paperclip, FileCheck, X, Loader2, ShieldCheck, Camera } from "lucide-react";
import { toast } from "sonner";
import ReservaPanel from "@/components/bobinas/ReservaPanel";

const QUALIDADE_OPTIONS = ["GV", "PP", "FF", "FQ", "GL (IMP)"];

const BLANK_FORM = (codigoCD) => ({
  cor: "", chapa: "", qualidade: "", sub_cod: "", espessura_real: "", espessura_utilizada: "",
  largura_mm: "", peso_kg: "", peso_inicial: "",
  codigo: codigoCD, nf: "", custo: "", fornecedor: "",
  data_recebimento: new Date().toISOString().slice(0, 10),
  observacoes: "",
  estoque_minimo_kg: "", consumo_diario_kg: "",
  anexo_nf_url: "", anexo_nf_nome: "", anexo_cert_url: "", anexo_cert_nome: "",
  foto_adicional_url: "", foto_adicional_nome: "",
  reservada: false, reserva_tipo: "", reserva_kg: "", reserva_numero_pedido: "",
  reserva_motivo: "", reserva_autorizado_por: "", reserva_data: "",
});

export default function BobinaFormDialogCD({ open, onClose, onSave, editItem, proximoNumero, saving }) {
  const [form, setForm] = useState(BLANK_FORM("CD0001"));
  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [semCertAssinatura, setSemCertAssinatura] = useState("");
  const [confirmarSemCert, setConfirmarSemCert] = useState(false);
  const [erros, setErros] = useState({});
  const nfInputRef = useRef();
  const nfCameraRef = useRef();
  const certInputRef = useRef();
  const certCameraRef = useRef();
  const fotoInputRef = useRef();
  const fotoCameraRef = useRef();

  useEffect(() => {
    if (!open) return;
    setErros({});
    if (editItem) {
      setForm({
        cor: editItem.cor || "",
        chapa: editItem.chapa || "",
        qualidade: editItem.qualidade || "",
        espessura_real: editItem.espessura_real || "",
        espessura_utilizada: editItem.espessura_utilizada || "",
        sub_cod: editItem.sub_cod || "",
        largura_mm: editItem.largura_mm || "",
        peso_kg: editItem.peso_kg || "",
        peso_inicial: editItem.peso_inicial || "",
        codigo: editItem.codigo || "",
        nf: editItem.nf || "",
        custo: editItem.custo || "",
        fornecedor: editItem.fornecedor || "",
        data_recebimento: editItem.data_recebimento || "",
        observacoes: editItem.observacoes || "",
        estoque_minimo_kg: editItem.estoque_minimo_kg || "",
        consumo_diario_kg: editItem.consumo_diario_kg || "",
        anexo_nf_url: editItem.anexo_nf_url || "",
        anexo_nf_nome: editItem.anexo_nf_nome || "",
        anexo_cert_url: editItem.anexo_cert_url || "",
        anexo_cert_nome: editItem.anexo_cert_nome || "",
        foto_adicional_url: editItem.foto_adicional_url || "",
        foto_adicional_nome: editItem.foto_adicional_nome || "",
        reservada: editItem.reservada || false,
        reserva_tipo: editItem.reserva_tipo || "",
        reserva_kg: editItem.reserva_kg || "",
        reserva_numero_pedido: editItem.reserva_numero_pedido || "",
        reserva_motivo: editItem.reserva_motivo || "",
        reserva_autorizado_por: editItem.reserva_autorizado_por || "",
        reserva_data: editItem.reserva_data || "",
      });
      setSemCertAssinatura("");
      setConfirmarSemCert(false);
    } else {
      const num = String(proximoNumero || 1).padStart(4, "0");
      setForm(BLANK_FORM(`CD${num}`));
      setSemCertAssinatura("");
      setConfirmarSemCert(false);
    }
  }, [editItem, open, proximoNumero]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleUpload = async (file, tipo) => {
    if (!file) return;
    if (tipo === "nf") setUploadingNF(true);
    else if (tipo === "cert") setUploadingCert(true);
    else setUploadingFoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (tipo === "nf") {
      setForm(f => ({ ...f, anexo_nf_url: file_url, anexo_nf_nome: file.name }));
      setUploadingNF(false);
    } else if (tipo === "cert") {
      setForm(f => ({ ...f, anexo_cert_url: file_url, anexo_cert_nome: file.name }));
      setUploadingCert(false);
    } else {
      setForm(f => ({ ...f, foto_adicional_url: file_url, foto_adicional_nome: file.name }));
      setUploadingFoto(false);
    }
  };

  const handleSave = () => {
    const novosErros = {};
    if (!form.cor) novosErros.cor = "Informe a cor";
    if (!form.chapa) novosErros.chapa = "Informe a chapa";
    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) {
      toast.error("Preencha os campos obrigatórios destacados em vermelho");
      return;
    }

    if (typeof onSave !== "function") {
      toast.error("Erro interno: função de salvamento não disponível");
      return;
    }

    onSave({
      ...form,
      setor: "corte_dobra",
      largura_mm: form.largura_mm ? Number(form.largura_mm) : undefined,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      peso_inicial: form.peso_inicial ? Number(form.peso_inicial) : undefined,
      custo: form.custo ? Number(form.custo) : undefined,
      estoque_minimo_kg: form.estoque_minimo_kg ? Number(form.estoque_minimo_kg) : undefined,
      consumo_diario_kg: form.consumo_diario_kg ? Number(form.consumo_diario_kg) : undefined,
      anexo_cert_ausencia: (!form.anexo_cert_url && confirmarSemCert) ? semCertAssinatura.trim() : undefined,
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
              <Label className={erros.chapa ? "text-destructive" : ""}>Chapa *</Label>
              <Input placeholder="1200" value={form.chapa} onChange={e => { set("chapa", e.target.value); setErros(e2 => ({...e2, chapa: undefined})); }} className={erros.chapa ? "border-destructive ring-destructive" : ""} />
              {erros.chapa && <p className="text-xs text-destructive">{erros.chapa}</p>}
            </div>
          </div>

          {/* Espessura Real + Utilizada */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Qualidade da Bobina</Label>
              <Input placeholder="1200" value={form.espessura_real} onChange={e => set("espessura_real", e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Espessura literal da nota fiscal</p>
            </div>
            <div className="space-y-1">
              <Label>Espessura Utilizada</Label>
              <Input placeholder="Ex: 0,43 / 0,50" value={form.espessura_utilizada} onChange={e => set("espessura_utilizada", e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Espessura(s) que o vendedor vê</p>
            </div>
          </div>

          {/* SUB. COD */}
          <div className="space-y-1">
            <Label>SUB. COD (Código Substituto)</Label>
            <Input placeholder="Opcional" value={form.sub_cod} onChange={e => set("sub_cod", e.target.value)} />
          </div>

          {/* Cor */}
          <div className="space-y-1">
            <Label className={erros.cor ? "text-destructive" : ""}>Cor *</Label>
            <Input placeholder="Ex: Galvanizado, Zincado, Pintado Branco..." value={form.cor} onChange={e => { set("cor", e.target.value); setErros(e2 => ({...e2, cor: undefined})); }} className={erros.cor ? "border-destructive ring-destructive" : ""} />
            {erros.cor && <p className="text-xs text-destructive">{erros.cor}</p>}
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

          {/* Peso atual + Peso inicial */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Peso Atual (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => set("peso_kg", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso Inicial (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_inicial} onChange={e => set("peso_inicial", e.target.value)} />
            </div>
          </div>

          {/* Estoque mínimo + Consumo diário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Estoque Mínimo (kg)</Label>
              <Input type="number" placeholder="Ex: 500" value={form.estoque_minimo_kg} onChange={e => set("estoque_minimo_kg", e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Alerta quando abaixo deste valor</p>
            </div>
            <div className="space-y-1">
              <Label>Consumo Diário Estimado (kg)</Label>
              <Input type="number" placeholder="Ex: 80" value={form.consumo_diario_kg} onChange={e => set("consumo_diario_kg", e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Para calcular previsão de acabar</p>
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

              {/* Certificado */}
              <div className="space-y-1.5">
                <input ref={certInputRef} type="file" className="hidden" accept="image/*,.pdf,.p7b,.cer,.crt"
                  onChange={e => { handleUpload(e.target.files[0], "cert"); setConfirmarSemCert(false); setSemCertAssinatura(""); }} />
                <input ref={certCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => { handleUpload(e.target.files[0], "cert"); setConfirmarSemCert(false); setSemCertAssinatura(""); }} />
                {form.anexo_cert_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                    <a href={form.anexo_cert_url} target="_blank" rel="noopener noreferrer"
                      className="truncate flex-1 underline underline-offset-2 font-medium" title={form.anexo_cert_nome}>
                      {form.anexo_cert_nome || "Certificado"}
                    </a>
                    <button onClick={() => setForm(f => ({ ...f, anexo_cert_url: "", anexo_cert_nome: "" }))}
                      className="ml-auto text-blue-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="flex-1 border-dashed border-2 h-10 text-xs gap-1.5"
                      onClick={() => certInputRef.current.click()} disabled={uploadingCert}>
                      {uploadingCert ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      {uploadingCert ? "Enviando..." : "Certificado"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-dashed border-2 h-10 px-3"
                      onClick={() => certCameraRef.current.click()} disabled={uploadingCert} title="Câmera">
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
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
                    <p className="text-xs text-orange-800 font-medium">⚠ Declare seu nome completo confirmando que o certificado não foi fornecido:</p>
                    <Input placeholder="Nome completo do responsável" value={semCertAssinatura}
                      onChange={e => setSemCertAssinatura(e.target.value)} className="h-8 text-xs bg-white" />
                    <button type="button" onClick={() => { setConfirmarSemCert(false); setSemCertAssinatura(""); }}
                      className="text-xs text-orange-600 underline underline-offset-2">Cancelar — vou anexar o certificado</button>
                  </div>
                )}
              </div>
            )}


            {/* Foto adicional */}
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-1.5">Foto adicional (opcional)</p>
              <input ref={fotoInputRef} type="file" className="hidden" accept="image/*,.pdf"
                onChange={e => handleUpload(e.target.files[0], "foto")} />
              <input ref={fotoCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                onChange={e => handleUpload(e.target.files[0], "foto")} />
              {form.foto_adicional_url ? (
                <div className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs text-purple-800">
                  <Camera className="w-4 h-4 shrink-0 text-purple-600" />
                  <a href={form.foto_adicional_url} target="_blank" rel="noopener noreferrer"
                    className="truncate flex-1 underline underline-offset-2 font-medium" title={form.foto_adicional_nome}>
                    {form.foto_adicional_nome || "Foto adicional"}
                  </a>
                  <button onClick={() => setForm(f => ({ ...f, foto_adicional_url: "", foto_adicional_nome: "" }))}
                    className="ml-auto text-purple-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="flex-1 border-dashed border-2 h-10 text-xs gap-1.5"
                    onClick={() => fotoInputRef.current.click()} disabled={uploadingFoto}>
                    {uploadingFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    {uploadingFoto ? "Enviando..." : "Foto adicional"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="border-dashed border-2 h-10 px-3"
                    onClick={() => fotoCameraRef.current.click()} disabled={uploadingFoto} title="Câmera">
                    <Camera className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Reserva */}
          <ReservaPanel form={form} onChange={setForm} />

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Salvando...</> : (editItem ? "Salvar" : "Adicionar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}