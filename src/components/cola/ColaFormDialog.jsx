import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, AlertTriangle, Camera, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { lerNotaFiscalCola, encontrarItensPorNF } from "@/lib/nfReader";

const TIPOS = ["Cola Termofusível", "Cola PUR", "Cola Base Água", "Cola Poliuretano", "Outro"];
const SACO_PESO_KG = 3.75;
const TAMBOR_PESO_KG = 200;

const emptyForm = {
  tipo: "",
  fornecedor: "",
  nf: "",
  anexo_nf_url: "",
  anexo_nf_nome: "",
  tambores_qtd: "",
  tambor_peso_kg: TAMBOR_PESO_KG,
  sacos_qtd: "",
  saco_peso_kg: SACO_PESO_KG,
  custo_tambor: "",
  lote: "",
  data_validade: "",
  observacoes: "",
};

export default function ColaFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState(emptyForm);
  const [lendoNF, setLendoNF] = useState(false);
  const nfCameraRef = useRef();
  const nfInputRef = useRef();

  // Busca todas as colas existentes para verificação de duplicidade de NF
  const { data: colasExistentes = [] } = useQuery({
    queryKey: ["colas-existentes"],
    queryFn: () => base44.entities.Cola.list("-created_date", 500),
    enabled: open,
    staleTime: 60000,
  });

  const colasMesmaNF = useMemo(() => {
    return encontrarItensPorNF(colasExistentes, form.nf || form.lote, editItem?.id);
  }, [colasExistentes, form.nf, form.lote, editItem]);

  const temDuplicidadeNF = colasMesmaNF.length > 0;

  useEffect(() => {
    if (open) {
      if (editItem) {
        setForm({
          tipo: editItem.tipo || "",
          fornecedor: editItem.fornecedor || "",
          nf: editItem.nf || "",
          anexo_nf_url: editItem.anexo_nf_url || "",
          anexo_nf_nome: editItem.anexo_nf_nome || "",
          tambores_qtd: editItem.tambores_qtd ?? "",
          tambor_peso_kg: editItem.tambor_peso_kg ?? TAMBOR_PESO_KG,
          sacos_qtd: editItem.sacos_qtd ?? "",
          saco_peso_kg: editItem.saco_peso_kg ?? SACO_PESO_KG,
          custo_tambor: editItem.custo_tambor ?? "",
          lote: editItem.lote || "",
          data_validade: editItem.data_validade || "",
          observacoes: editItem.observacoes || "",
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, editItem]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleProcessarNF = async (file) => {
    if (!file) return;
    setLendoNF(true);
    try {
      toast.info("Processando imagem da Nota Fiscal com IA...", { duration: 3500 });
      const { file_url, file_name, dados } = await lerNotaFiscalCola(file);

      setForm(f => ({
        ...f,
        anexo_nf_url: file_url,
        anexo_nf_nome: file_name,
        nf: dados.numero_nf ? String(dados.numero_nf) : f.nf,
        fornecedor: dados.fornecedor || f.fornecedor,
        tipo: dados.tipo || f.tipo,
        tambores_qtd: dados.tambores_qtd ? String(dados.tambores_qtd) : f.tambores_qtd,
        tambor_peso_kg: dados.tambor_peso_kg || f.tambor_peso_kg,
        sacos_qtd: dados.sacos_qtd ? String(dados.sacos_qtd) : f.sacos_qtd,
        custo_tambor: dados.custo_tambor ? String(dados.custo_tambor) : f.custo_tambor,
        lote: dados.lote || f.lote,
        data_validade: dados.data_validade || f.data_validade,
      }));

      toast.success(`Nota Fiscal ${dados.numero_nf || ""} lida com sucesso! Dados preenchidos pela IA.`);

      if (dados.numero_nf) {
        const duplicadas = encontrarItensPorNF(colasExistentes, dados.numero_nf, editItem?.id);
        if (duplicadas.length > 0) {
          toast.error(
            `⚠️ Atenção: A Nota Fiscal ${dados.numero_nf} já possui ${duplicadas.length} registro(s) de cola cadastrado(s) no sistema!`,
            { duration: 9000 }
          );
        }
      }
    } catch (err) {
      console.error("Erro ao processar NF de cola com IA:", err);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setForm(f => ({ ...f, anexo_nf_url: file_url, anexo_nf_nome: file.name }));
      } catch {}
      toast.warning("Arquivo anexado, mas não foi possível extrair todos os dados automaticamente.");
    } finally {
      setLendoNF(false);
    }
  };

  const sacosDosTambores = (Number(form.tambores_qtd) || 0) * Math.floor(TAMBOR_PESO_KG / SACO_PESO_KG);
  const totalSacos = (Number(form.sacos_qtd) || 0);
  const totalKg = totalSacos * (Number(form.saco_peso_kg) || SACO_PESO_KG);

  const handleSave = () => {
    if (!form.tipo) { alert("Selecione o tipo de cola."); return; }
    onSave({
      ...form,
      tambores_qtd: form.tambores_qtd !== "" ? Number(form.tambores_qtd) : 0,
      tambor_peso_kg: Number(form.tambor_peso_kg) || TAMBOR_PESO_KG,
      sacos_qtd: form.sacos_qtd !== "" ? Number(form.sacos_qtd) : 0,
      saco_peso_kg: Number(form.saco_peso_kg) || SACO_PESO_KG,
      custo_tambor: form.custo_tambor !== "" ? Number(form.custo_tambor) : undefined,
      kg_total: totalKg,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Cola" : "Nova Cola"}</DialogTitle>
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
                  Tire a foto ou anexe o DANFE para a IA extrair fornecedor, NF, quantidades de tambores/sacos e lote.
                </p>
              </div>
            </div>

            {lendoNF ? (
              <div className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                <span>Lendo Nota Fiscal e preenchendo dados da cola com IA...</span>
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
              <Label>Tipo de Cola *</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input placeholder="Nome do fornecedor" value={form.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} />
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
                onChange={(e) => set("nf", e.target.value)}
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
                    A NF <strong>{form.nf || form.lote}</strong> já consta em <strong>{colasMesmaNF.length}</strong> registro(s) de cola existente(s):
                  </p>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {colasMesmaNF.map((c, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                        <span>{c.tipo}</span>
                        {c.fornecedor && <span className="font-normal text-red-100">· {c.fornecedor}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label>Lote do Fabricante</Label>
              <Input placeholder="Ex: LOT-2026-X" value={form.lote} onChange={(e) => set("lote", e.target.value)} />
            </div>
          </div>

          {/* Tambores */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">Tambores</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Qtd. Tambores</Label>
                <Input type="number" min="0" placeholder="0" value={form.tambores_qtd} onChange={(e) => set("tambores_qtd", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Peso por Tambor (kg)</Label>
                <Input type="number" min="1" value={form.tambor_peso_kg} onChange={(e) => set("tambor_peso_kg", e.target.value)} />
              </div>
            </div>
            {Number(form.tambores_qtd) > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                {form.tambores_qtd} tambor(es) × {form.tambor_peso_kg}kg = <strong>{(Number(form.tambores_qtd) * Number(form.tambor_peso_kg)).toFixed(0)}kg</strong>
                <span className="ml-2 text-amber-600">≈ {sacosDosTambores} sacos de {SACO_PESO_KG}kg</span>
              </div>
            )}
          </div>

          {/* Sacos */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">Sacos em Estoque</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Qtd. Sacos</Label>
                <Input type="number" min="0" placeholder="0" value={form.sacos_qtd} onChange={(e) => set("sacos_qtd", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Peso por Saco (kg)</Label>
                <Input type="number" min="0.1" step="0.05" value={form.saco_peso_kg} onChange={(e) => set("saco_peso_kg", e.target.value)} />
              </div>
            </div>
            {totalSacos > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
                Total em sacos: <strong>{totalSacos} sacos · {totalKg.toFixed(2)}kg</strong>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Custo por Tambor (R$)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.custo_tambor} onChange={(e) => set("custo_tambor", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data de Validade</Label>
              <Input type="date" value={form.data_validade} onChange={(e) => set("data_validade", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Observações opcionais..." value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} className="h-16" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{editItem ? "Salvar Alterações" : "Adicionar Cola"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}