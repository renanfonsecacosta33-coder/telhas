import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Paperclip, FileCheck, ShieldCheck, X, Loader2, Sparkles, AlertTriangle, Camera } from "lucide-react";
import { toast } from "sonner";
import ReservaPanel from "@/components/bobinas/ReservaPanel";
import UploadButton from "@/components/ui/UploadButton";
import ImageLink from "@/components/ui/ImageLink";
import { lerNotaFiscalChapa, encontrarItensPorNF } from "@/lib/nfReader";

export default function ChapaFormDialog({ open, onClose, onSave, proximoCodigo, isSaving = false, chapasExistentes = [] }) {
  const [salvandoLocal, setSalvandoLocal] = useState(false);
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
    nf: "",
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
        nf: "",
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

  const [lendoNF, setLendoNF] = useState(false);

  // 🔒 Detecta se a NF já existe em outras chapas cadastradas
  const chapasMesmaNF = useMemo(() => {
    return encontrarItensPorNF(chapasExistentes, form.nf);
  }, [chapasExistentes, form.nf]);

  const temDuplicidadeNF = chapasMesmaNF.length > 0;

  const handleProcessarNF = async (file) => {
    if (!file) return;
    setLendoNF(true);
    setUploadingNF(true);
    try {
      toast.info("Processando imagem da Nota Fiscal com IA...", { duration: 3500 });
      const { file_url, file_name, dados } = await lerNotaFiscalChapa(file);

      setForm(f => ({
        ...f,
        anexo_nf_url: file_url,
        anexo_nf_nome: file_name,
        nf: dados.numero_nf ? String(dados.numero_nf) : f.nf,
        comprimento_mm: dados.comprimento_mm ? String(dados.comprimento_mm) : f.comprimento_mm,
        largura_mm: dados.largura_mm ? String(dados.largura_mm) : f.largura_mm,
        espessura_mm: dados.espessura_mm ? String(dados.espessura_mm) : f.espessura_mm,
        material: dados.material || f.material,
        qualidade: dados.qualidade || f.qualidade,
        quantidade_total: dados.quantidade_total ? String(dados.quantidade_total) : f.quantidade_total,
        peso_kg: dados.peso_kg ? String(dados.peso_kg) : f.peso_kg,
        cliente: dados.cliente || f.cliente,
        numero_pedido: dados.numero_pedido || f.numero_pedido,
        data_corte: dados.data_emissao || f.data_corte,
      }));

      toast.success(`Nota Fiscal ${dados.numero_nf || ""} lida com sucesso! Dados preenchidos pela IA.`);

      // Alerta de duplicidade se a NF já constar em chapas existentes
      if (dados.numero_nf) {
        const duplicadas = encontrarItensPorNF(chapasExistentes, dados.numero_nf);
        if (duplicadas.length > 0) {
          toast.error(
            `⚠️ Atenção: A Nota Fiscal ${dados.numero_nf} já possui ${duplicadas.length} chapa(s) cadastrada(s) no sistema!`,
            { duration: 9000 }
          );
        }
      }
    } catch (err) {
      console.error("Erro ao processar NF de chapa com IA:", err);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setForm(f => ({ ...f, anexo_nf_url: file_url, anexo_nf_nome: file.name }));
      } catch {}
      toast.warning("Arquivo anexado, mas não foi possível extrair todos os dados automaticamente.");
    } finally {
      setLendoNF(false);
      setUploadingNF(false);
    }
  };

  const handleUpload = async (file, tipo) => {
    if (!file) return;
    if (tipo === "nf") return handleProcessarNF(file);
    setUploadingCF(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, anexo_cf_url: file_url, anexo_cf_nome: file.name }));
    } catch {
      toast.error("Erro ao enviar certificado.");
    } finally {
      setUploadingCF(false);
    }
  };

  const canSave = form.comprimento_mm && form.quantidade_total;

  const handleSave = async () => {
    if (isSaving || salvandoLocal) return;

    const codLimpo = (form.codigo || "").trim().toUpperCase();
    if (!codLimpo) {
      alert("Por favor, informe o código da chapa.");
      return;
    }

    const jaExiste = chapasExistentes.some(c => (c.codigo || "").trim().toUpperCase() === codLimpo);
    if (jaExiste) {
      alert(`Atenção: A chapa com código ${codLimpo} já existe no sistema! Use outro código para não gerar duplicidade de estoque.`);
      return;
    }

    setSalvandoLocal(true);
    try {
      const bobinaDescricao = [
        form.material && `Mat: ${form.material}`,
        form.espessura_mm && `${form.espessura_mm}mm`,
      ].filter(Boolean).join(" — ") || "Entrada manual";

      await onSave({
        codigo: codLimpo,
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
        nf: form.nf || undefined,
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
    } finally {
      setSalvandoLocal(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Chapa Manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {/* Card de Leitura de Nota Fiscal por IA */}
          <div className="rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 p-3.5 space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Preencher Automático por Foto da NF (IA)
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Tire a foto ou anexe o DANFE para a IA extrair espessura, medidas, quantidade, peso e NF.
                </p>
              </div>
            </div>

            {lendoNF ? (
              <div className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                <span>Lendo Nota Fiscal e preenchendo medidas da chapa com IA...</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-0.5">
                <input ref={nfCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleProcessarNF(e.target.files[0])} />
                <input ref={nfInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => handleProcessarNF(e.target.files[0])} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => nfCameraRef.current?.click()}
                  className="w-full sm:w-1/2 bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs h-9 gap-1.5 font-medium cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  Tirar Foto da NF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => nfInputRef.current?.click()}
                  className="w-full sm:w-1/2 bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs h-9 gap-1.5 font-medium cursor-pointer"
                >
                  <Paperclip className="w-4 h-4 text-emerald-600" />
                  Anexar Arquivo/PDF
                </Button>
              </div>
            )}
          </div>

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
            <Input type="number" step="0.01" placeholder="Ex: 0.95" value={form.espessura_mm} onChange={e => set("espessura_mm", e.target.value)} />
          </div>

          {/* Comprimento + Largura */}
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

          {/* NF com Alerta em Vermelho de Duplicidade */}
          <div className={`space-y-1 rounded-xl p-2.5 transition-colors ${
            temDuplicidadeNF ? "border-2 border-red-500/70 bg-red-500/10 dark:bg-red-950/25" : ""
          }`}>
            <div className="flex items-center justify-between">
              <Label className={temDuplicidadeNF ? "text-red-600 dark:text-red-400 font-extrabold flex items-center gap-1" : ""}>
                {temDuplicidadeNF && <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-bounce" />}
                NF (Nota Fiscal)
              </Label>
              {temDuplicidadeNF && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs animate-pulse">
                  Alerta: NF Duplicada
                </span>
              )}
            </div>
            <Input
              placeholder="Ex: 123456"
              value={form.nf}
              onChange={e => set("nf", e.target.value)}
              className={temDuplicidadeNF ? "border-red-500 border-2 bg-red-500/15 dark:bg-red-950/40 text-red-900 dark:text-red-100 font-bold focus-visible:ring-red-500" : ""}
            />

            {/* Caixa Vermelha de Alerta */}
            {temDuplicidadeNF && (
              <div className="rounded-lg border-2 border-red-500/80 bg-red-500/15 dark:bg-red-950/50 p-2.5 space-y-1.5 shadow-xs mt-1 animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-1.5 font-black text-xs text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                  <span>Opa! Estamos em duplicidade de NF!</span>
                </div>
                <p className="text-[11px] text-red-900 dark:text-red-200">
                  A NF <strong>{form.nf}</strong> já consta cadastrada em <strong>{chapasMesmaNF.length}</strong> chapa(s) existente(s):
                </p>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {chapasMesmaNF.map((c, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] font-bold">
                      <span>{c.codigo}</span>
                      {c.quantidade_total && <span className="font-normal text-red-100">({c.quantidade_total} un)</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
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
                    <ImageLink url={form.anexo_nf_url} name={form.anexo_nf_nome}
                      className="truncate flex-1 underline underline-offset-2 font-medium text-left text-emerald-800" title={form.anexo_nf_nome}>
                      {form.anexo_nf_nome || "NF anexada"}
                    </ImageLink>
                    <button onClick={() => setForm(f => ({ ...f, anexo_nf_url: "", anexo_nf_nome: "" }))}
                      className="ml-auto text-emerald-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <UploadButton label="Anexar NF" icon={Paperclip} cameraRef={nfCameraRef} fileRef={nfInputRef} uploading={uploadingNF} />
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
                    <ImageLink url={form.anexo_cf_url} name={form.anexo_cf_nome}
                      className="truncate flex-1 underline underline-offset-2 font-medium text-left text-blue-800" title={form.anexo_cf_nome}>
                      {form.anexo_cf_nome || "CF anexado"}
                    </ImageLink>
                    <button onClick={() => setForm(f => ({ ...f, anexo_cf_url: "", anexo_cf_nome: "" }))}
                      className="ml-auto text-blue-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <UploadButton label="Anexar CF" icon={ShieldCheck} cameraRef={cfCameraRef} fileRef={cfInputRef} uploading={uploadingCF} />
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
          <Button variant="outline" onClick={onClose} disabled={isSaving || salvandoLocal}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving || salvandoLocal}>
            {(isSaving || salvandoLocal) ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adicionando Chapa...
              </>
            ) : (
              "Adicionar Chapa"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}