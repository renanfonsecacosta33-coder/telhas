import React, { useState, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X, Sparkles, AlertTriangle, Camera } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import UploadButton from "@/components/ui/UploadButton";
import ImageLink from "@/components/ui/ImageLink";
import { lerNotaFiscalSlitter, encontrarItensPorNF } from "@/lib/nfReader";

export default function SlitterFormDialog({ open, onClose, onSave, editItem, proximoCodigo }) {
  const codigoPreview = editItem?.codigo || `ST${String(proximoCodigo).padStart(4, "0")}`;
  const dataPreview = editItem?.data || new Date().toISOString().split("T")[0];
  const [pesoKg, setPesoKg] = useState(editItem?.peso_kg || "");
  const [nf, setNf] = useState(editItem?.nf || "");
  const [larguraMm, setLarguraMm] = useState(editItem?.largura_mm || "");
  const [qualidade, setQualidade] = useState(editItem?.qualidade || "GV");
  const [origem, setOrigem] = useState(editItem?.origem || "Nacional");
  const [espessuraMm, setEspessuraMm] = useState(editItem?.espessura_mm || "");
  const [materiais, setMateriais] = useState(editItem?.materiais_producao || "");
  const [status, setStatus] = useState(editItem?.status || "Disponível");
  const [observacoes, setObservacoes] = useState(editItem?.observacoes || "");
  const [anexoUrl, setAnexoUrl] = useState(editItem?.anexo_nf_url || "");
  const [anexoNome, setAnexoNome] = useState(editItem?.anexo_nf_nome || "");
  const [uploading, setUploading] = useState(false);
  const [lendoNF, setLendoNF] = useState(false);
  const fileRef = useRef();
  const cameraRef = useRef();
  const nfInputRef = useRef();
  const nfCameraRef = useRef();

  // Busca slitters existentes para detecção de duplicidade de NF
  const { data: slittersExistentes = [] } = useQuery({
    queryKey: ["slitters-existentes"],
    queryFn: () => base44.entities.Slitter.list("-created_date", 1000),
    enabled: open,
    staleTime: 60000,
  });

  const slittersMesmaNF = useMemo(() => {
    return encontrarItensPorNF(slittersExistentes, nf, editItem?.id);
  }, [slittersExistentes, nf, editItem]);

  const temDuplicidadeNF = slittersMesmaNF.length > 0;

  const handleProcessarNF = async (file) => {
    if (!file) return;
    setLendoNF(true);
    setUploading(true);
    try {
      toast.info("Processando imagem da Nota Fiscal com IA...", { duration: 3500 });
      const { file_url, file_name, dados } = await lerNotaFiscalSlitter(file);

      if (dados.peso_kg) setPesoKg(String(dados.peso_kg));
      if (dados.numero_nf) setNf(String(dados.numero_nf));
      if (dados.largura_mm) setLarguraMm(String(dados.largura_mm));
      if (dados.espessura_mm) setEspessuraMm(String(dados.espessura_mm));
      if (dados.qualidade) setQualidade(dados.qualidade);
      if (dados.origem) setOrigem(dados.origem);
      if (dados.materiais_producao) setMateriais(dados.materiais_producao);
      setAnexoUrl(file_url);
      setAnexoNome(file_name);

      toast.success(`Nota Fiscal ${dados.numero_nf || ""} lida com sucesso! Dados preenchidos pela IA.`);

      if (dados.numero_nf) {
        const duplicadas = encontrarItensPorNF(slittersExistentes, dados.numero_nf, editItem?.id);
        if (duplicadas.length > 0) {
          toast.error(
            `⚠️ Atenção: A Nota Fiscal ${dados.numero_nf} já possui ${duplicadas.length} slitter(s) cadastrado(s) no sistema!`,
            { duration: 9000 }
          );
        }
      }
    } catch (err) {
      console.error("Erro ao processar NF de slitter com IA:", err);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setAnexoUrl(file_url);
        setAnexoNome(file.name);
      } catch {}
      toast.warning("Arquivo anexado, mas não foi possível extrair todos os dados automaticamente.");
    } finally {
      setLendoNF(false);
      setUploading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    return handleProcessarNF(file);
  };

  const handleSave = () => {
    const payload = {
      peso_kg: Number(pesoKg),
      nf: nf || null,
      largura_mm: Number(larguraMm),
      qualidade,
      origem,
      espessura_mm: Number(espessuraMm),
      materiais_producao: materiais || null,
      status,
      observacoes: observacoes || null,
      anexo_nf_url: anexoUrl || null,
      anexo_nf_nome: anexoNome || null,
    };
    // Código e data só são enviados na edição (na criação, a página gera automaticamente)
    if (editItem) {
      payload.codigo = editItem.codigo;
      payload.data = editItem.data;
    }
    onSave(payload);
  };

  const canSave = pesoKg && larguraMm && espessuraMm;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editItem ? "Editar Slitter" : "Nova Slitter"}</DialogTitle></DialogHeader>
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
                  Tire a foto ou anexe o DANFE para a IA extrair peso, largura, espessura e NF.
                </p>
              </div>
            </div>

            {lendoNF ? (
              <div className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                <span>Lendo Nota Fiscal e preenchendo slitter com IA...</span>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Código</Label>
              <Input value={codigoPreview} disabled className="bg-muted font-mono text-muted-foreground" readOnly />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input value={dataPreview} disabled className="bg-muted text-muted-foreground" readOnly />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Peso (kg) *</Label>
              <Input type="number" step="0.01" placeholder="Ex: 2500" value={pesoKg} onChange={e => setPesoKg(e.target.value)} />
            </div>

            {/* NF com Alerta em Vermelho de Duplicidade */}
            <div className={`space-y-1 rounded-xl p-2.5 transition-colors ${
              temDuplicidadeNF ? "border-2 border-red-500/70 bg-red-500/10 dark:bg-red-950/25" : ""
            }`}>
              <div className="flex items-center justify-between">
                <Label className={temDuplicidadeNF ? "text-red-600 dark:text-red-400 font-extrabold flex items-center gap-1" : ""}>
                  {temDuplicidadeNF && <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-bounce" />}
                  NF
                </Label>
                {temDuplicidadeNF && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs animate-pulse">
                    Alerta: NF Duplicada
                  </span>
                )}
              </div>
              <Input
                placeholder="Nº da nota fiscal"
                value={nf}
                onChange={e => setNf(e.target.value)}
                className={temDuplicidadeNF ? "border-red-500 border-2 bg-red-500/15 dark:bg-red-950/40 text-red-900 dark:text-red-100 font-bold focus-visible:ring-red-500" : ""}
              />

              {/* Caixa Vermelha de Alerta */}
              {temDuplicidadeNF && (
                <div className="rounded-lg border-2 border-red-500/80 bg-red-500/15 dark:bg-red-950/50 p-2 space-y-1 shadow-xs mt-1 animate-in fade-in-50 duration-200">
                  <div className="flex items-center gap-1.5 font-black text-xs text-red-700 dark:text-red-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>Opa! Estamos em duplicidade de NF!</span>
                  </div>
                  <p className="text-[11px] text-red-900 dark:text-red-200">
                    A NF <strong>{nf}</strong> já consta cadastrada em <strong>{slittersMesmaNF.length}</strong> slitter(s) existente(s):
                  </p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {slittersMesmaNF.map((s, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] font-bold">
                        <span>{s.codigo}</span>
                        {s.peso_kg && <span className="font-normal text-red-100">({s.peso_kg} kg)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
            <Label>Origem do Aço (Trava Odoo)</Label>
            <Select value={origem} onValueChange={setOrigem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nacional">Nacional</SelectItem>
                <SelectItem value="Importado">Importado</SelectItem>
              </SelectContent>
            </Select>
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
              <input ref={cameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                onChange={e => handleUpload(e.target.files[0])} />
              {anexoUrl ? (
                <div className="flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs">
                  <ImageLink url={anexoUrl} name={anexoNome}
                    className="truncate flex-1 text-emerald-800 font-medium text-left underline underline-offset-2">
                    {anexoNome}
                  </ImageLink>
                  <button onClick={() => { setAnexoUrl(""); setAnexoNome(""); }} className="text-emerald-600 hover:text-red-500"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <UploadButton label="Anexar NF" icon={Paperclip} cameraRef={cameraRef} fileRef={fileRef} uploading={uploading} size="default" />
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