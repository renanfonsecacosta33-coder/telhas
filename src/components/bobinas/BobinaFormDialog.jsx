import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Paperclip, FileCheck, X, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import ReservaPanel from "@/components/bobinas/ReservaPanel";
import UploadButton from "@/components/ui/UploadButton";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_OPTIONS = [
  "Aberta", "Fechada", "Finalizada", "Na TP40", "Na BOBININHA",
  "Matriz AJL", "Pinhais", "Ivaiporã", "Matriz - Frisada", "RESERVADA"
];

const QUALIDADE_OPTIONS = ["GV", "PP", "FF", "FQ", "GL (IMP)"];

export default function BobinaFormDialog({ open, onClose, editItem }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    cor: "", chapa: "", qualidade: "", sub_cod: "", largura_mm: "", peso_kg: "", peso_inicial: "",
    metragem: "", codigo: "", nf: "", custo: "", status: "", fornecedor: "",
    data_recebimento: "", observacoes: "", tipo: "Telha",
    anexo_nf_url: "", anexo_nf_nome: "", anexo_cert_url: "", anexo_cert_nome: "",
    foto_cor_url: "", foto_cor_nome: "",
    estoque_minimo_kg: "", consumo_diario_kg: "",
  });

  const [saving, setSaving] = useState(false);
  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingFotoCor, setUploadingFotoCor] = useState(false);
  const [semCertAssinatura, setSemCertAssinatura] = useState("");
  const [confirmarSemCert, setConfirmarSemCert] = useState(false);
  const [erros, setErros] = useState({});
  const formTopRef = useRef();
  const nfInputRef = useRef();
  const nfCameraRef = useRef();
  const certInputRef = useRef();
  const certCameraRef = useRef();
  const fotoCorInputRef = useRef();
  const fotoCorCameraRef = useRef();

  useEffect(() => {
    setErros({});
    if (editItem) {
      setForm({
        cor: editItem.cor || "",
        chapa: editItem.chapa || "",
        qualidade: editItem.qualidade || "",
        sub_cod: editItem.sub_cod || "",
        largura_mm: editItem.largura_mm || "",
        peso_kg: editItem.peso_kg || "",
        peso_inicial: editItem.peso_inicial || "",
        metragem: editItem.metragem || "",
        codigo: editItem.codigo || "",
        nf: editItem.nf || "",
        custo: editItem.custo || "",
        status: editItem.status || "",
        fornecedor: editItem.fornecedor || "",
        data_recebimento: editItem.data_recebimento || "",
        observacoes: editItem.observacoes || "",
        tipo: "Telha",
        anexo_nf_url: editItem.anexo_nf_url || "",
        anexo_nf_nome: editItem.anexo_nf_nome || "",
        anexo_cert_url: editItem.anexo_cert_url || "",
        anexo_cert_nome: editItem.anexo_cert_nome || "",
        foto_cor_url: editItem.foto_cor_url || "",
        foto_cor_nome: editItem.foto_cor_nome || "",
        estoque_minimo_kg: editItem.estoque_minimo_kg || "",
        consumo_diario_kg: editItem.consumo_diario_kg || "",
        reservada: editItem.reservada || false,
        reserva_tipo: editItem.reserva_tipo || "",
        reserva_kg: editItem.reserva_kg || "",
        reserva_numero_pedido: editItem.reserva_numero_pedido || "",
        reserva_motivo: editItem.reserva_motivo || "",
        reserva_autorizado_por: editItem.reserva_autorizado_por || "",
        reserva_data: editItem.reserva_data || "",
      });
    } else {
      setForm({
        cor: "", chapa: "", qualidade: "", sub_cod: "", largura_mm: "", peso_kg: "", peso_inicial: "",
        metragem: "", codigo: "Gerando...", nf: "", custo: "", status: "", fornecedor: "",
        data_recebimento: new Date().toISOString().slice(0, 10), observacoes: "", tipo: "Telha",
        anexo_nf_url: "", anexo_nf_nome: "", anexo_cert_url: "", anexo_cert_nome: "",
        foto_cor_url: "", foto_cor_nome: "",
        estoque_minimo_kg: "500", consumo_diario_kg: "",
        reservada: false, reserva_tipo: "", reserva_kg: "", reserva_numero_pedido: "",
        reserva_motivo: "", reserva_autorizado_por: "", reserva_data: "",
      });
      setSemCertAssinatura("");
      setConfirmarSemCert(false);
      gerarProximoCodigo().then(codigo => set("codigo", codigo)).catch(() => {});
    }
  }, [editItem, open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const calcMetragem = (peso, largura, chapa) => {
    const p = Number(peso);
    const l = Number(largura) / 1000;
    const esp = parseFloat(String(chapa).replace(",", ".")) / 1000;
    if (p > 0 && l > 0 && esp > 0) return Math.round(p / (l * esp * 7850));
    return "";
  };

  const handlePesoChange = (val) => {
    const metragem = calcMetragem(val, form.largura_mm, form.chapa);
    setForm(f => ({ ...f, peso_kg: val, metragem }));
  };

  const handleLarguraChange = (val) => {
    const metragem = calcMetragem(form.peso_kg, val, form.chapa);
    setForm(f => ({ ...f, largura_mm: val, metragem }));
  };

  const handleChapaChange = (val) => {
    const metragem = calcMetragem(form.peso_kg, form.largura_mm, val);
    setForm(f => ({ ...f, chapa: val, metragem }));
  };

  const gerarProximoCodigo = async () => {
    const bobinas = await base44.entities.Bobina.list("-created_date", 200);
    const numeros = bobinas
      .map(b => b.codigo)
      .filter(c => c && /^TE\d{4}$/.test(c))
      .map(c => parseInt(c.slice(2)));
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    return `TE${String(proximo).padStart(4, "0")}`;
  };

  const handleUpload = async (file, tipo) => {
    if (!file) return;
    if (tipo === "nf") setUploadingNF(true);
    else if (tipo === "cert") setUploadingCert(true);
    else if (tipo === "foto_cor") setUploadingFotoCor(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (tipo === "nf") {
        setForm(f => ({ ...f, anexo_nf_url: file_url, anexo_nf_nome: file.name }));
      } else if (tipo === "cert") {
        setForm(f => ({ ...f, anexo_cert_url: file_url, anexo_cert_nome: file.name }));
      } else if (tipo === "foto_cor") {
        setForm(f => ({ ...f, foto_cor_url: file_url, foto_cor_nome: file.name }));
      }
    } catch (e) {
      toast.error("Erro ao enviar arquivo");
    } finally {
      if (tipo === "nf") setUploadingNF(false);
      else if (tipo === "cert") setUploadingCert(false);
      else if (tipo === "foto_cor") setUploadingFotoCor(false);
    }
  };

  const buildPayload = () => {
    const p = {
      ...form,
      setor: "telhas",
      reservada: form.reservada || false,
    };

    // Números — só inclui se preenchido
    if (form.largura_mm) p.largura_mm = Number(form.largura_mm);
    if (form.peso_kg) p.peso_kg = Number(form.peso_kg);
    if (form.peso_inicial) p.peso_inicial = Number(form.peso_inicial);
    if (form.metragem) p.metragem = Number(form.metragem);
    if (form.custo) p.custo = Number(form.custo);
    if (form.estoque_minimo_kg) p.estoque_minimo_kg = Number(form.estoque_minimo_kg);
    if (form.consumo_diario_kg) p.consumo_diario_kg = Number(form.consumo_diario_kg);

    // Anexos e certificado
    if (!form.anexo_cert_url && confirmarSemCert && semCertAssinatura.trim()) {
      p.anexo_cert_ausencia = semCertAssinatura.trim();
    }
    // Reservas — só inclui se reservada=true
    if (form.reservada) {
      p.reserva_tipo = form.reserva_tipo || undefined;
      p.reserva_numero_pedido = form.reserva_numero_pedido || undefined;
      p.reserva_motivo = form.reserva_motivo || undefined;
      p.reserva_autorizado_por = form.reserva_autorizado_por || undefined;
      p.reserva_data = form.reserva_data || new Date().toISOString().split("T")[0];
      if (form.reserva_tipo === "parcial" && form.reserva_kg) {
        p.reserva_kg = Number(form.reserva_kg);
      }
    }

    // Remove campos undefined/null/vazios que não deveriam ir
    Object.keys(p).forEach(k => {
      if (p[k] === "" || p[k] === undefined || p[k] === null) delete p[k];
    });

    // Remove campos de reserva se não está reservada
    if (!p.reservada) {
      delete p.reserva_tipo;
      delete p.reserva_kg;
      delete p.reserva_numero_pedido;
      delete p.reserva_motivo;
      delete p.reserva_autorizado_por;
      delete p.reserva_data;
    }

    return p;
  };

  const handleSave = async () => {
    const novosErros = {};
    if (!form.chapa) novosErros.chapa = "Informe a chapa (ex: 0,43)";
    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) {
      toast.error("Preencha os campos obrigatórios.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();

      // Timeout de 20 segundos para evitar travamento infinito
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tempo limite excedido ao salvar. Verifique sua conexão.")), 20000)
      );

      if (editItem) {
        await Promise.race([base44.entities.Bobina.update(editItem.id, payload), timeoutPromise]);
        toast.success("Bobina atualizada!");
      } else {
        const result = await Promise.race([base44.entities.Bobina.create(payload), timeoutPromise]);
        if (!result || !result.id) {
          throw new Error("Resposta inválida do servidor — a bobina pode não ter sido criada.");
        }
        toast.success("Bobina adicionada!");
      }
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      onClose();
    } catch (err) {
      console.error("BobinaFormDialog save error:", err);
      let msg = "Erro ao salvar bobina";
      if (err && typeof err === "object") {
        msg = err.response?.data?.detail || err.response?.data?.message
          || err.detail || err.message || String(err);
      } else {
        msg = String(err || "Erro desconhecido");
      }
      toast.error(String(msg).substring(0, 300));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Bobina" : "Nova Bobina"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2" ref={formTopRef}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cor / RVM</Label>
              <Input placeholder="Ex: Galvanizado, Branco, Natural..." value={form.cor} onChange={e => set("cor", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className={erros.chapa ? "text-destructive" : ""}>Chapa *</Label>
              <Input placeholder="Ex: 0,43" value={form.chapa} onChange={e => { handleChapaChange(e.target.value); setErros(e => ({...e, chapa: undefined})); }} className={erros.chapa ? "border-destructive ring-destructive" : ""} />
              {erros.chapa && <p className="text-xs text-destructive">{erros.chapa}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Qualidade</Label>
              <Select value={form.qualidade} onValueChange={(v) => set("qualidade", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{QUALIDADE_OPTIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>SUB. COD (Código Substituto)</Label>
            <Input placeholder="Opcional" value={form.sub_cod} onChange={e => set("sub_cod", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Peso Líquido (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => handlePesoChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso Inicial (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_inicial} onChange={e => set("peso_inicial", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Largura (mm)</Label>
              <Input type="number" placeholder="1200" value={form.largura_mm} onChange={e => handleLarguraChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Metragem (m) <span className="text-xs text-muted-foreground font-normal">— calculada automaticamente</span></Label>
              <Input type="number" placeholder="Auto" value={form.metragem} onChange={e => set("metragem", e.target.value)} className="bg-muted/40" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código (auto)</Label>
              <Input placeholder="Preenchido automático pela NF" value={form.codigo} onChange={e => set("codigo", e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label>NF</Label>
              <Input placeholder="Número da NF" value={form.nf} onChange={e => set("nf", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input placeholder="Ex: Arcelormittal" value={form.fornecedor} onChange={e => set("fornecedor", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Custo (R$/kg)</Label>
              <Input type="number" placeholder="0.00" value={form.custo} onChange={e => set("custo", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Data de Recebimento</Label>
            <Input type="date" value={form.data_recebimento} onChange={e => set("data_recebimento", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Anotações..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
          </div>

          {/* Estoque mínimo e consumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Estoque Mínimo (kg)</Label>
              <Input type="number" placeholder="500" value={form.estoque_minimo_kg} onChange={e => set("estoque_minimo_kg", e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Alerta quando abaixo deste valor</p>
            </div>
            <div className="space-y-1">
              <Label>Consumo Diário Estimado (kg)</Label>
              <Input type="number" placeholder="Ex: 120" value={form.consumo_diario_kg} onChange={e => set("consumo_diario_kg", e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Para calcular previsão de acabar</p>
            </div>
          </div>

          {/* Foto da cor — apenas quando qualidade = PP */}
          {form.qualidade === "PP" && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">Foto da Cor da Bobina <span className="text-xs text-muted-foreground font-normal">(PP)</span></Label>
              <input ref={fotoCorInputRef} type="file" className="hidden" accept="image/*"
                onChange={e => handleUpload(e.target.files[0], "foto_cor")} />
              <input ref={fotoCorCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                onChange={e => handleUpload(e.target.files[0], "foto_cor")} />
              {form.foto_cor_url ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <FileCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <a href={form.foto_cor_url} target="_blank" rel="noopener noreferrer"
                      className="truncate flex-1 underline underline-offset-2 font-medium" title={form.foto_cor_nome}>
                      {form.foto_cor_nome || "Foto da cor"}
                    </a>
                    <button onClick={() => setForm(f => ({ ...f, foto_cor_url: "", foto_cor_nome: "" }))}
                      className="ml-auto text-emerald-600 hover:text-red-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <img src={form.foto_cor_url} alt="Foto da cor" className="w-full max-h-32 object-cover rounded-lg border border-border" />
                </div>
              ) : (
                <UploadButton label="Anexar Foto" icon={Paperclip} cameraRef={fotoCorCameraRef} fileRef={fotoCorInputRef} uploading={uploadingFotoCor} />
              )}
            </div>
          )}

          {/* Anexos */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">Anexos</Label>
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
                      className="ml-auto text-emerald-600 hover:text-red-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <UploadButton label="Anexar NF" icon={Paperclip} cameraRef={nfCameraRef} fileRef={nfInputRef} uploading={uploadingNF} />
                )}
              </div>

              {/* Certificado Digital */}
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
                      className="ml-auto text-blue-600 hover:text-red-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <UploadButton label="Certificado" icon={ShieldCheck} cameraRef={certCameraRef} fileRef={certInputRef} uploading={uploadingCert} />
                )}
              </div>
            </div>

            {!form.anexo_cert_url && (
              <div className="mt-2">
                {!confirmarSemCert ? (
                  <button
                    type="button"
                    onClick={() => setConfirmarSemCert(true)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    Não tenho o certificado digital
                  </button>
                ) : (
                  <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 space-y-2">
                    <p className="text-xs text-orange-800 font-medium">
                      ⚠ Declare seu nome completo confirmando que o certificado não foi fornecido:
                    </p>
                    <Input
                      placeholder="Nome completo do responsável"
                      value={semCertAssinatura}
                      onChange={e => setSemCertAssinatura(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => { setConfirmarSemCert(false); setSemCertAssinatura(""); }}
                      className="text-xs text-orange-600 underline underline-offset-2">
                      Cancelar — vou anexar o certificado
                    </button>
                  </div>
                )}
              </div>
            )}
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