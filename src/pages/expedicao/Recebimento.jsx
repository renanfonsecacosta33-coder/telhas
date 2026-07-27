import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Camera, Upload, CheckCircle2, AlertTriangle, Scale, Package,
  ChevronRight, ChevronLeft, Loader2, FileText, MapPin, Zap
} from "lucide-react";

// ─── Tabela de Peso Teórico (kg/m) — barras 6m padrão ─────────────────────
const PESOS_POR_METRO = {
  "Barra Chata 1/8\" (3,18mm)":  0.125,
  "Barra Chata 3/16\" (4,76mm)": 0.187,
  "Barra Chata 1/4\" (6,35mm)":  0.499,
  "Barra Chata 5/16\" (7,94mm)": 0.624,
  "Barra Chata 3/8\" (9,53mm)":  0.748,
  "Barra Chata 1/2\" (12,7mm)":  0.998,
  "Barra Chata 5/8\" (15,88mm)": 1.247,
  "Barra Chata 3/4\" (19,05mm)": 1.497,
  "Barra Chata 1\" (25,4mm)":    2.000,
  "Angular 3/4\" (19mm)":        0.553,
  "Angular 1\" (25mm)":          0.753,
  "Angular 1.1/4\" (32mm)":      1.200,
  "Angular 1.1/2\" (38mm)":      1.741,
  "Angular 2\" (50mm)":          3.077,
  "Angular 2.1/2\" (63mm)":      4.784,
  "Angular 3\" (76mm)":          6.998,
  "Cantoneira 3/4\"":             0.650,
  "Cantoneira 1\"":               0.900,
  "Redondo 5/16\" (7,94mm)":     0.390,
  "Redondo 3/8\" (9,53mm)":      0.560,
  "Redondo 1/2\" (12,7mm)":      0.995,
  "Redondo 5/8\" (15,88mm)":     1.554,
  "Redondo 3/4\" (19,05mm)":     2.237,
  "Redondo 1\" (25,4mm)":        3.973,
  "Bobina / Chapa (peso direto)": null,
};

const COMPRIMENTO_PADRAO_M = 6;
const TOLERANCIA_DIVERGENCIA = 3; // 3%

const BLANK = {
  numero_nf: "", fornecedor: "", espessura: "", peso_kg_nf: "",
  peso_kg_balanca: "", quantidade_barras: "", produto: "",
  local_armazenagem: "", observacoes: "",
  foto_nf_url: "", foto_balanca_url: "", foto_material_url: "",
};

function calcPesoTeorico(produto, qtdBarras) {
  if (!produto || !qtdBarras) return null;
  const kgM = PESOS_POR_METRO[produto];
  if (!kgM) return null;
  return kgM * COMPRIMENTO_PADRAO_M * Number(qtdBarras);
}

function calcDivergencia(nf, balanca) {
  if (!nf || !balanca) return null;
  return ((balanca - nf) / nf) * 100;
}

export default function RecebimentoExpedicao() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadingBal, setUploadingBal] = useState(false);
  const [uploadingMat, setUploadingMat] = useState(false);

  const nfPhotoRef    = useRef();
  const balancaRef    = useRef();
  const materialRef   = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── OCR da NF ──────────────────────────────────────────────
  const handleNfPhoto = async (file) => {
    if (!file) return;
    setOcrLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("foto_nf_url", file_url);

      // Tenta OCR via Gemini Vision
      try {
        const result = await base44.integrations.Core.RunGeminiAI({
          prompt: `Você é um leitor de Notas Fiscais brasileiras. Leia a imagem e retorne SOMENTE um JSON válido com os campos: numero_nf (string), fornecedor (string), peso_total_kg (number ou null), quantidade_itens (number ou null), descricao_produto (string). Retorne apenas o JSON, sem markdown.`,
          imageUrl: file_url,
        });
        const json = JSON.parse(result.replace(/```json|```/g, "").trim());
        if (json.numero_nf)     set("numero_nf", json.numero_nf);
        if (json.fornecedor)    set("fornecedor", json.fornecedor);
        if (json.peso_total_kg) set("peso_kg_nf", String(json.peso_total_kg));
        if (json.quantidade_itens) set("quantidade_barras", String(json.quantidade_itens));
        if (json.descricao_produto) {
          // Tenta mapear produto
          const match = Object.keys(PESOS_POR_METRO).find(k =>
            k.toLowerCase().includes((json.descricao_produto || "").toLowerCase().slice(0, 10))
          );
          if (match) set("produto", match);
        }
        toast.success("📄 NF lida pela IA! Confira e corrija se necessário.");
      } catch {
        toast.info("Foto da NF salva. Preencha os dados manualmente.");
      }
    } catch {
      toast.error("Erro ao fazer upload da foto da NF.");
    } finally {
      setOcrLoading(false);
    }
  };

  // ── Upload foto da balança (obrigatória) ──────────────────
  const handleBalancaPhoto = async (file) => {
    if (!file) return;
    setUploadingBal(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("foto_balanca_url", file_url);
      toast.success("📸 Foto da balança registrada!");
    } catch { toast.error("Erro ao enviar foto da balança."); }
    finally { setUploadingBal(false); }
  };

  // ── Upload foto do material descarregado ──────────────────
  const handleMaterialPhoto = async (file) => {
    if (!file) return;
    setUploadingMat(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("foto_material_url", file_url);
      toast.success("📸 Foto do material registrada!");
    } catch { toast.error("Erro ao enviar foto do material."); }
    finally { setUploadingMat(false); }
  };

  // ── Cálculos de peso ──────────────────────────────────────
  const pesoTeorico = calcPesoTeorico(form.produto, form.quantidade_barras);
  const divNfBal = calcDivergencia(Number(form.peso_kg_nf), Number(form.peso_kg_balanca));
  const divNfTeo = pesoTeorico ? calcDivergencia(Number(form.peso_kg_nf), pesoTeorico) : null;
  const temDivergencia = Math.abs(divNfBal || 0) > TOLERANCIA_DIVERGENCIA;

  // ── Navegação entre etapas ────────────────────────────────
  const canAdvance1 = form.numero_nf && form.fornecedor && form.produto && form.peso_kg_nf && form.quantidade_barras;
  const canAdvance2 = form.peso_kg_balanca && form.foto_balanca_url;
  const canAdvance3 = form.local_armazenagem && form.foto_material_url;

  // ── Salvar ────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const status = temDivergencia ? "divergente" : "conferido";
      const divergencia_percent = divNfBal;
      const agora = new Date();
      const data_validade = new Date(agora);
      data_validade.setMonth(data_validade.getMonth() + 6);

      await base44.entities.EntradaMaterialExpedicao?.create?.({
        ...form,
        peso_kg_nf:        Number(form.peso_kg_nf),
        peso_kg_balanca:   Number(form.peso_kg_balanca),
        quantidade_barras: Number(form.quantidade_barras),
        peso_teorico_kg:   pesoTeorico,
        divergencia_percent,
        data_hora:         agora.toISOString(),
        data_validade:     data_validade.toISOString(),
        quantidade_barras_saldo: Number(form.quantidade_barras), // saldo disponível
        peso_kg_saldo:           Number(form.peso_kg_balanca),   // saldo em kg
        status,
        setor:             "expedicao",
      });

      if (temDivergencia) {
        toast.warning(`⚠️ Entrada registrada com divergência de ${Math.abs(divNfBal).toFixed(1)}%! Aguardando aprovação do ADM.`);
      } else {
        toast.success("✅ Entrada registrada! Validade: " + data_validade.toLocaleDateString("pt-BR"));
      }
      navigate("/expedicao");
    } catch (err) {
      toast.error("Erro ao salvar entrada: " + (err?.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ChevronLeft className="w-4 h-4" /> Voltar ao Dashboard
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-teal-600" /> Receber Material
        </h1>
        <p className="text-sm text-muted-foreground">Registre a entrada de material na Expedição</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-1">
        {[1, 2, 3].map(s => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              step === s ? "bg-teal-600 text-white" :
              step > s   ? "bg-teal-100 text-teal-700" :
                           "bg-muted text-muted-foreground"
            }`}>
              {step > s ? <CheckCircle2 className="w-3 h-3" /> : s}
              {s === 1 && " Dados NF"}
              {s === 2 && " Pesagem"}
              {s === 3 && " Descarga"}
            </div>
            {s < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </React.Fragment>
        ))}
      </div>

      {/* ─── ETAPA 1: Dados da NF ─── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* OCR Scanner da NF */}
          <div className="border-2 border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/40 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-teal-500" />
            <p className="text-sm font-semibold text-teal-700 mb-1">📷 Foto da NF — Preenchimento Automático</p>
            <p className="text-xs text-muted-foreground mb-3">A IA lê a nota fiscal e preenche os campos automaticamente</p>
            {ocrLoading ? (
              <div className="flex items-center justify-center gap-2 text-teal-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Lendo NF com IA...</span>
              </div>
            ) : (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700"
                  onClick={() => { nfPhotoRef.current.accept = "image/*"; nfPhotoRef.current.capture = "environment"; nfPhotoRef.current.click(); }}>
                  <Camera className="w-4 h-4" /> Câmera
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700"
                  onClick={() => { nfPhotoRef.current.accept = "image/*"; nfPhotoRef.current.removeAttribute("capture"); nfPhotoRef.current.click(); }}>
                  <Upload className="w-4 h-4" /> Galeria
                </Button>
                <input ref={nfPhotoRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleNfPhoto(e.target.files?.[0])} />
              </div>
            )}
            {form.foto_nf_url && (
              <div className="mt-2 flex items-center justify-center gap-1 text-emerald-600 text-xs font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Foto da NF salva
              </div>
            )}
          </div>

          {/* Campos da NF */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nº da NF *</Label>
              <Input value={form.numero_nf} onChange={e => set("numero_nf", e.target.value)} placeholder="Ex: 12345" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Fornecedor *</Label>
              <Input value={form.fornecedor} onChange={e => set("fornecedor", e.target.value)} placeholder="Nome do fornecedor" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Produto / Material *</Label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={form.produto}
              onChange={e => set("produto", e.target.value)}
            >
              <option value="">Selecione o produto...</option>
              {Object.keys(PESOS_POR_METRO).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Peso Total NF (kg) *</Label>
              <Input type="number" value={form.peso_kg_nf} onChange={e => set("peso_kg_nf", e.target.value)} placeholder="Ex: 1240" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Quantidade de Barras *</Label>
              <Input type="number" value={form.quantidade_barras} onChange={e => set("quantidade_barras", e.target.value)} placeholder="Ex: 50" />
            </div>
          </div>

          {/* Peso teórico preview */}
          {pesoTeorico && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-blue-700">
                Peso teórico calculado: <strong>{pesoTeorico.toFixed(1)} kg</strong>
                {" "}({form.quantidade_barras} barras × {PESOS_POR_METRO[form.produto]} kg/m × {COMPRIMENTO_PADRAO_M}m)
              </span>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Espessura / Bitola</Label>
            <Input value={form.espessura} onChange={e => set("espessura", e.target.value)} placeholder="Ex: 3/8 pol ou 9,53mm" />
          </div>

          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
            disabled={!canAdvance1}
            onClick={() => setStep(2)}
          >
            Avançar para Pesagem <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ─── ETAPA 2: Pesagem & Conferência ─── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Foto da balança — OBRIGATÓRIA */}
          <div className={`border-2 rounded-xl p-4 text-center ${form.foto_balanca_url ? "border-emerald-400 bg-emerald-50/40" : "border-dashed border-amber-400 bg-amber-50/40"}`}>
            <Scale className={`w-8 h-8 mx-auto mb-2 ${form.foto_balanca_url ? "text-emerald-500" : "text-amber-500"}`} />
            <p className="text-sm font-bold mb-1">
              {form.foto_balanca_url ? "✅ Foto da Balança Registrada" : "📸 Foto da Balança — OBRIGATÓRIA"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {form.foto_balanca_url ? "Foto enviada com sucesso" : "Tire uma foto do display da balança com o peso aferido"}
            </p>
            {uploadingBal ? (
              <div className="flex items-center justify-center gap-2 text-amber-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
              </div>
            ) : (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5 border-amber-400 text-amber-700"
                  onClick={() => { balancaRef.current.capture = "environment"; balancaRef.current.click(); }}>
                  <Camera className="w-4 h-4" /> Câmera
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 border-amber-400 text-amber-700"
                  onClick={() => { balancaRef.current.removeAttribute("capture"); balancaRef.current.click(); }}>
                  <Upload className="w-4 h-4" /> Galeria
                </Button>
                <input ref={balancaRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleBalancaPhoto(e.target.files?.[0])} />
              </div>
            )}
            {form.foto_balanca_url && (
              <img src={form.foto_balanca_url} alt="Balança" className="mt-3 max-h-32 mx-auto rounded-lg object-cover border" />
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Peso na Balança (kg) *</Label>
            <Input
              type="number"
              value={form.peso_kg_balanca}
              onChange={e => set("peso_kg_balanca", e.target.value)}
              placeholder="Digite o peso aferido na balança"
              className="text-lg font-bold"
            />
          </div>

          {/* Comparativo de pesos */}
          {form.peso_kg_balanca && form.peso_kg_nf && (
            <div className={`rounded-xl border-2 p-4 space-y-2 ${temDivergencia ? "border-red-400 bg-red-50" : "border-emerald-400 bg-emerald-50"}`}>
              <p className="font-bold text-sm flex items-center gap-2">
                {temDivergencia
                  ? <><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-red-700">⚠️ Divergência de Peso Detectada!</span></>
                  : <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700">✅ Peso Dentro da Tolerância</span></>
                }
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-muted-foreground">NF</p>
                  <p className="font-bold text-base">{Number(form.peso_kg_nf).toLocaleString("pt-BR")} kg</p>
                </div>
                <div className={`rounded-lg p-2 border ${temDivergencia ? "bg-red-100 border-red-300" : "bg-emerald-100 border-emerald-300"}`}>
                  <p className="text-muted-foreground">Balança</p>
                  <p className="font-bold text-base">{Number(form.peso_kg_balanca).toLocaleString("pt-BR")} kg</p>
                  <p className={`text-[10px] font-bold ${temDivergencia ? "text-red-600" : "text-emerald-600"}`}>
                    {divNfBal >= 0 ? "+" : ""}{divNfBal?.toFixed(1)}%
                  </p>
                </div>
                {pesoTeorico && (
                  <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                    <p className="text-muted-foreground">Teórico</p>
                    <p className="font-bold text-base">{pesoTeorico.toFixed(0)} kg</p>
                    <p className="text-[10px] text-blue-600">
                      {divNfTeo >= 0 ? "+" : ""}{divNfTeo?.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
              {temDivergencia && (
                <p className="text-xs text-red-600 font-medium text-center">
                  A diferença de {Math.abs(divNfBal).toFixed(1)}% supera o limite de {TOLERANCIA_DIVERGENCIA}%.
                  O ADM será notificado para aprovação.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-700 gap-2"
              disabled={!canAdvance2}
              onClick={() => setStep(3)}
            >
              Avançar para Descarga <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── ETAPA 3: Descarga & Armazenagem ─── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Foto do material descarregado */}
          <div className={`border-2 rounded-xl p-4 text-center ${form.foto_material_url ? "border-emerald-400 bg-emerald-50/40" : "border-dashed border-teal-400 bg-teal-50/40"}`}>
            <Camera className={`w-8 h-8 mx-auto mb-2 ${form.foto_material_url ? "text-emerald-500" : "text-teal-500"}`} />
            <p className="text-sm font-bold mb-1">
              {form.foto_material_url ? "✅ Foto do Material Registrada" : "📸 Foto do Material Descarregado — OBRIGATÓRIA"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">Registre o material após descarregar e organizar por espessura/cor</p>
            {uploadingMat ? (
              <div className="flex items-center justify-center gap-2 text-teal-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
              </div>
            ) : (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700"
                  onClick={() => { materialRef.current.capture = "environment"; materialRef.current.click(); }}>
                  <Camera className="w-4 h-4" /> Câmera
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700"
                  onClick={() => { materialRef.current.removeAttribute("capture"); materialRef.current.click(); }}>
                  <Upload className="w-4 h-4" /> Galeria
                </Button>
                <input ref={materialRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleMaterialPhoto(e.target.files?.[0])} />
              </div>
            )}
            {form.foto_material_url && (
              <img src={form.foto_material_url} alt="Material" className="mt-3 max-h-32 mx-auto rounded-lg object-cover border" />
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-teal-500" /> Local de Armazenagem *
            </Label>
            <Input
              value={form.local_armazenagem}
              onChange={e => set("local_armazenagem", e.target.value)}
              placeholder="Ex: A1, B3, Pátio Externo, Prateleira 2..."
            />
            <p className="text-[10px] text-muted-foreground">Use o Mapa de Armazenagem para ver posições disponíveis</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              placeholder="Condição do material, avarias, observações..."
              rows={3}
            />
          </div>

          {/* Resumo final */}
          <div className="bg-muted/30 border rounded-xl p-4 space-y-2 text-sm">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Resumo da Entrada</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">NF:</span><span className="font-bold">{form.numero_nf}</span>
              <span className="text-muted-foreground">Fornecedor:</span><span className="font-bold truncate">{form.fornecedor}</span>
              <span className="text-muted-foreground">Produto:</span><span className="font-bold">{form.produto}</span>
              <span className="text-muted-foreground">Qtd barras:</span><span className="font-bold">{form.quantidade_barras}</span>
              <span className="text-muted-foreground">Peso NF:</span><span className="font-bold">{Number(form.peso_kg_nf).toLocaleString("pt-BR")} kg</span>
              <span className="text-muted-foreground">Peso Balança:</span><span className="font-bold">{Number(form.peso_kg_balanca).toLocaleString("pt-BR")} kg</span>
              {pesoTeorico && <><span className="text-muted-foreground">Peso Teórico:</span><span className="font-bold">{pesoTeorico.toFixed(0)} kg</span></>}
              <span className="text-muted-foreground">Divergência:</span>
              <span className={`font-bold ${temDivergencia ? "text-red-600" : "text-emerald-600"}`}>
                {divNfBal !== null ? `${divNfBal.toFixed(1)}%` : "—"}
                {temDivergencia && " ⚠️"}
              </span>
            </div>
          </div>

          {temDivergencia && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Esta entrada será salva como <strong>DIVERGENTE</strong> e o ADM será notificado para revisão.</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-700 gap-2"
              disabled={!canAdvance3 || saving}
              onClick={handleSave}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "✅ Finalizar Entrada"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
