import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, AlertTriangle, Camera, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { lerNotaFiscalIsopor, encontrarItensPorNF } from "@/lib/nfReader";

const TIPOS = [
  "EPS - TP 25",
  "EPS - TP 40",
  "EPS - TP 40 BANDEJA",
  "EPS - COLONIAL",
  "EPS - COLONIAL BANDEJA",
  "EPS - ONDULADO",
];

const emptyForm = {
  tipo: "",
  fornecedor: "",
  nf: "",
  espessura_mm: "",
  quantidade: "",
  metragem_total: "",
  observacoes: "",
  anexo_nf_url: "",
  anexo_nf_nome: "",
};

export default function IsoporFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState(emptyForm);
  const [lendoNF, setLendoNF] = useState(false);
  const nfCameraRef = useRef();
  const nfInputRef = useRef();

  // Busca todos os isopores para checagem de duplicidade de NF
  const { data: isoporesExistentes = [] } = useQuery({
    queryKey: ["isopores-existentes"],
    queryFn: () => base44.entities.Isopor.list("-created_date", 500),
    enabled: open,
    staleTime: 60000,
  });

  const isoporesMesmaNF = useMemo(() => {
    return encontrarItensPorNF(isoporesExistentes, form.nf, editItem?.id);
  }, [isoporesExistentes, form.nf, editItem]);

  const temDuplicidadeNF = isoporesMesmaNF.length > 0;

  useEffect(() => {
    if (open) {
      if (editItem) {
        setForm({
          tipo: editItem.tipo || "",
          fornecedor: editItem.fornecedor || "",
          nf: editItem.nf || "",
          espessura_mm: editItem.espessura_mm || "",
          quantidade: editItem.quantidade || "",
          metragem_total: editItem.metragem_total || "",
          observacoes: editItem.observacoes || "",
          anexo_nf_url: editItem.anexo_nf_url || "",
          anexo_nf_nome: editItem.anexo_nf_nome || "",
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [editItem, open]);

  // Auto-calculate metragem when quantidade changes (each unit = 2m)
  const handleQuantidadeChange = (val) => {
    const qty = val ? Number(val) : "";
    setForm((f) => ({
      ...f,
      quantidade: val,
      metragem_total: qty ? qty * 2 : "",
    }));
  };

  const handleProcessarNF = async (file) => {
    if (!file) return;
    setLendoNF(true);
    try {
      toast.info("Processando imagem da Nota Fiscal com IA...", { duration: 3500 });
      const { file_url, file_name, dados } = await lerNotaFiscalIsopor(file);

      const novaQtd = dados.quantidade ? String(dados.quantidade) : form.quantidade;
      const novaMetragem = dados.metragem_total
        ? String(dados.metragem_total)
        : (dados.quantidade ? String(Number(dados.quantidade) * 2) : form.metragem_total);

      setForm((f) => ({
        ...f,
        anexo_nf_url: file_url,
        anexo_nf_nome: file_name,
        nf: dados.numero_nf ? String(dados.numero_nf) : f.nf,
        fornecedor: dados.fornecedor || f.fornecedor,
        tipo: dados.tipo || f.tipo,
        espessura_mm: dados.espessura_mm ? String(dados.espessura_mm) : f.espessura_mm,
        quantidade: novaQtd,
        metragem_total: novaMetragem,
      }));

      toast.success(`Nota Fiscal ${dados.numero_nf || ""} lida com sucesso! Dados preenchidos pela IA.`);

      if (dados.numero_nf) {
        const duplicadas = encontrarItensPorNF(isoporesExistentes, dados.numero_nf, editItem?.id);
        if (duplicadas.length > 0) {
          toast.error(
            `⚠️ Atenção: A Nota Fiscal ${dados.numero_nf} já possui ${duplicadas.length} lote(s) de isopor cadastrado(s) no sistema!`,
            { duration: 9000 }
          );
        }
      }
    } catch (err) {
      console.error("Erro ao processar NF de isopor com IA:", err);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setForm((f) => ({ ...f, anexo_nf_url: file_url, anexo_nf_nome: file.name }));
      } catch {}
      toast.warning("Arquivo anexado, mas não foi possível extrair todos os dados automaticamente.");
    } finally {
      setLendoNF(false);
    }
  };

  const handleSave = () => {
    const data = {
      ...form,
      espessura_mm: form.espessura_mm ? Number(form.espessura_mm) : undefined,
      quantidade: form.quantidade ? Number(form.quantidade) : undefined,
      metragem_total: form.metragem_total ? Number(form.metragem_total) : undefined,
      nf: form.nf || undefined,
      fornecedor: form.fornecedor || undefined,
      anexo_nf_url: form.anexo_nf_url || undefined,
      anexo_nf_nome: form.anexo_nf_nome || undefined,
    };
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Isopor" : "Novo Isopor / EPS"}</DialogTitle>
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
                  Tire a foto ou anexe o DANFE para a IA extrair fornecedor, NF, perfil de EPS, espessura e quantidade.
                </p>
              </div>
            </div>

            {lendoNF ? (
              <div className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                <span>Lendo Nota Fiscal e preenchendo dados de EPS com IA...</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label>Tipo de Perfil *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input
                placeholder="Nome do fornecedor de EPS"
                value={form.fornecedor}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
              />
            </div>

            {/* NF com Alerta em Vermelho de Duplicidade */}
            <div className={`space-y-1 rounded-xl p-2.5 transition-colors ${
              temDuplicidadeNF ? "border-2 border-red-500/70 bg-red-500/10 dark:bg-red-950/25" : ""
            }`}>
              <div className="flex items-center justify-between">
                <Label className={temDuplicidadeNF ? "text-red-600 dark:text-red-400 font-extrabold flex items-center gap-1" : ""}>
                  {temDuplicidadeNF && <AlertTriangle className="w-3.5 h-3.5 text-red-600 animate-bounce" />}
                  Número da NF
                </Label>
                {temDuplicidadeNF && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs animate-pulse">
                    Alerta: NF Duplicada
                  </span>
                )}
              </div>
              <Input
                placeholder="Ex: 5041"
                value={form.nf}
                onChange={(e) => setForm({ ...form, nf: e.target.value })}
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
                    A NF <strong>{form.nf}</strong> já consta em <strong>{isoporesMesmaNF.length}</strong> registro(s) de isopor existente(s):
                  </p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {isoporesMesmaNF.map((iso, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                        <span>{iso.tipo}</span>
                        {iso.quantidade && <span className="font-normal text-red-100">({iso.quantidade} un)</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label>Espessura (mm)</Label>
              <Input
                type="number"
                placeholder="Ex: 30, 40, 50"
                value={form.espessura_mm}
                onChange={(e) => setForm({ ...form, espessura_mm: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Quantidade (un / barras de 2m)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.quantidade}
                onChange={(e) => handleQuantidadeChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Metragem total (m)</Label>
              <Input
                type="number"
                placeholder="Auto: qtd × 2m"
                value={form.metragem_total}
                onChange={(e) => setForm({ ...form, metragem_total: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">Cada unidade = 2m (2000mm)</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea
              placeholder="Anotações sobre este isopor..."
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              className="h-16"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.tipo}>
            {editItem ? "Salvar" : "Adicionar Isopor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}