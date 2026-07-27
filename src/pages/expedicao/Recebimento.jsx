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
  ChevronRight, ChevronLeft, Loader2, FileText, MapPin, Zap, Plus, Trash2, Layers
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

function calcPesoTeoricoItem(produto, qtdBarras) {
  if (!produto || !qtdBarras) return null;
  let kgM = PESOS_POR_METRO[produto];
  if (!kgM) {
    const matchKey = Object.keys(PESOS_POR_METRO).find(k =>
      k !== "Bobina / Chapa (peso direto)" && (
        produto.toLowerCase().includes(k.toLowerCase().slice(0, 8)) ||
        k.toLowerCase().includes(produto.toLowerCase().slice(0, 8))
      )
    );
    if (matchKey) kgM = PESOS_POR_METRO[matchKey];
  }
  if (!kgM) return null;
  return kgM * COMPRIMENTO_PADRAO_M * Number(qtdBarras);
}

function calcDivergencia(nf, balanca) {
  if (!nf || !balanca) return null;
  return ((balanca - nf) / nf) * 100;
}

function createNewItem(id = 1) {
  return {
    tempId: Date.now() + Math.random(),
    produto: "",
    quantidade_barras: "",
    peso_kg_nf: "",
    espessura: "",
    local_armazenagem: "",
  };
}

export default function RecebimentoExpedicao() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Cabeçalho da NF
  const [header, setHeader] = useState({
    numero_nf: "",
    fornecedor: "",
    peso_kg_nf_total: "",
    peso_kg_balanca: "",
    foto_nf_url: "",
    foto_balanca_url: "",
    foto_material_url: "",
    observacoes: "",
  });

  // Lista de itens da NF (múltiplos produtos por nota!)
  const [itens, setItens] = useState([createNewItem()]);

  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadingBal, setUploadingBal] = useState(false);
  const [uploadingMat, setUploadingMat] = useState(false);

  const nfCamRef    = useRef();
  const nfFileRef   = useRef();
  const balCamRef   = useRef();
  const balFileRef  = useRef();
  const matCamRef   = useRef();
  const matFileRef  = useRef();

  const setHead = (k, v) => setHeader(h => ({ ...h, [k]: v }));

  // Atualizar item específico
  const updateItem = (tempId, key, val) => {
    setItens(list => list.map(item => item.tempId === tempId ? { ...item, [key]: val } : item));
  };

  const addItem = () => {
    setItens(list => [...list, createNewItem(list.length + 1)]);
  };

  const removeItem = (tempId) => {
    if (itens.length <= 1) return;
    setItens(list => list.filter(item => item.tempId !== tempId));
  };

  // ── OCR da NF com Inteligência para Múltiplos Itens ────────────────────
  const handleNfPhoto = async (file) => {
    if (!file) return;
    setOcrLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setHead("foto_nf_url", file_url);

      try {
        const json = await base44.integrations.Core.InvokeLLM({
          prompt: `Você é um leitor especialista em Notas Fiscais brasileiras (NF-e) de empresas de aço e metais. 
Analise a imagem da Nota Fiscal e retorne um JSON com o cabeçalho e a LISTA DE PRODUTOS/ITENS presentes na nota.
Se houver múltiplos produtos na nota fiscal, inclua TODOS na lista "itens".`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              numero_nf: { type: "string", description: "número da nota" },
              fornecedor: { type: "string", description: "razão social ou nome do fornecedor" },
              peso_total_nf_kg: { type: "number", description: "peso bruto ou peso líquido total em kg" },
              itens: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    descricao_produto: { type: "string" },
                    quantidade_itens: { type: "number" },
                    peso_kg_item: { type: "number" },
                    espessura: { type: "string" }
                  }
                }
              }
            }
          },
        });

        if (json.numero_nf) setHead("numero_nf", String(json.numero_nf));
        if (json.fornecedor) setHead("fornecedor", String(json.fornecedor));
        if (json.peso_total_nf_kg) setHead("peso_kg_nf_total", String(json.peso_total_nf_kg));

        if (Array.isArray(json.itens) && json.itens.length > 0) {
          const parsedItens = json.itens.map((it, idx) => {
            const rawDesc = String(it.descricao_produto || "").trim();
            const match = Object.keys(PESOS_POR_METRO).find(k =>
              k !== "Bobina / Chapa (peso direto)" && (
                rawDesc.toLowerCase().includes(k.toLowerCase().slice(0, 8)) ||
                k.toLowerCase().includes(rawDesc.toLowerCase().slice(0, 8))
              )
            );
            return {
              tempId: Date.now() + idx + Math.random(),
              produto: match || rawDesc,
              quantidade_barras: it.quantidade_itens ? String(it.quantidade_itens) : "",
              peso_kg_nf: it.peso_kg_item ? String(it.peso_kg_item) : "",
              espessura: it.espessura ? String(it.espessura) : "",
              local_armazenagem: "",
            };
          });
          setItens(parsedItens);
          toast.success(`📄 NF lida pela IA! ${parsedItens.length} produto(s) identificado(s) na Nota.`);
        } else {
          toast.success("📄 NF lida pela IA! Dados do cabeçalho preenchidos.");
        }
      } catch (err) {
        console.error(err);
        toast.info("Foto da NF salva. Preencha ou ajuste os dados dos produtos.");
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
      setHead("foto_balanca_url", file_url);
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
      setHead("foto_material_url", file_url);
      toast.success("📸 Foto do material registrada!");
    } catch { toast.error("Erro ao enviar foto do material."); }
    finally { setUploadingMat(false); }
  };

  // ── Totais e Cálculos ──────────────────────────────────────
  const somaQtdBarrasTotal = itens.reduce((s, i) => s + (Number(i.quantidade_barras) || 0), 0);
  const somaPesoNfItens   = itens.reduce((s, i) => s + (Number(i.peso_kg_nf) || 0), 0);
  const pesoNfComparar    = Number(header.peso_kg_nf_total) || somaPesoNfItens;
  const pesoTeoricoTotal  = itens.reduce((s, i) => s + (calcPesoTeoricoItem(i.produto, i.quantidade_barras) || 0), 0);

  const divNfBal = calcDivergencia(pesoNfComparar, Number(header.peso_kg_balanca));
  const temDivergencia = Math.abs(divNfBal || 0) > TOLERANCIA_DIVERGENCIA;

  // ── Validações de Avanço ──────────────────────────────────
  const itensValidos = itens.every(i => i.produto && i.quantidade_barras);
  const canAdvance1 = header.numero_nf && header.fornecedor && itens.length > 0 && itensValidos;
  const canAdvance2 = header.peso_kg_balanca && header.foto_balanca_url;
  const canAdvance3 = header.foto_material_url && itens.every(i => i.local_armazenagem);

  // ── Salvar Todos os Itens no Banco ────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const status = temDivergencia ? "divergente" : "conferido";
      const divergencia_percent = divNfBal;
      const agora = new Date();
      const data_validade = new Date(agora);
      data_validade.setMonth(data_validade.getMonth() + 6);

      const pesoBalancaTotal = Number(header.peso_kg_balanca);

      // Salva uma entrada no banco de dados para CADA item da Nota Fiscal!
      for (const item of itens) {
        const itemPesoNf = Number(item.peso_kg_nf) || (somaPesoNfItens > 0 ? (Number(item.quantidade_barras) / somaQtdBarrasTotal) * pesoNfComparar : 0);
        // Rateio proporcional do peso aferido na balança
        const proporcao = somaPesoNfItens > 0 ? itemPesoNf / somaPesoNfItens : (Number(item.quantidade_barras) / somaQtdBarrasTotal);
        const itemPesoBalanca = pesoBalancaTotal ? Number((proporcao * pesoBalancaTotal).toFixed(1)) : itemPesoNf;
        const itemPesoTeorico = calcPesoTeoricoItem(item.produto, item.quantidade_barras);

        await base44.entities.EntradaMaterialExpedicao?.create?.({
          numero_nf:                 header.numero_nf,
          fornecedor:                header.fornecedor,
          produto:                   item.produto,
          espessura:                 item.espessura,
          quantidade_barras:         Number(item.quantidade_barras),
          quantidade_barras_saldo:   Number(item.quantidade_barras),
          peso_kg_nf:                itemPesoNf,
          peso_kg_balanca:           itemPesoBalanca,
          peso_kg_saldo:             itemPesoBalanca,
          peso_teorico_kg:           itemPesoTeorico,
          local_armazenagem:         item.local_armazenagem,
          foto_nf_url:               header.foto_nf_url,
          foto_balanca_url:          header.foto_balanca_url,
          foto_material_url:         header.foto_material_url,
          observacoes:               header.observacoes,
          divergencia_percent,
          data_hora:                 agora.toISOString(),
          data_validade:             data_validade.toISOString(),
          status,
          setor:                     "expedicao",
        });
      }

      if (temDivergencia) {
        toast.warning(`⚠️ ${itens.length} produto(s) da NF ${header.numero_nf} registrados com divergência de ${Math.abs(divNfBal).toFixed(1)}%! Aguardando aprovação do ADM.`);
      } else {
        toast.success(`✅ Entrada de ${itens.length} produto(s) da NF ${header.numero_nf} registrada com sucesso! Validade: ${data_validade.toLocaleDateString("pt-BR")}`);
      }
      navigate("/expedicao");
    } catch (err) {
      toast.error("Erro ao salvar entrada: " + (err?.message || "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ChevronLeft className="w-4 h-4" /> Voltar ao Dashboard
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-teal-600" /> Receber Material (Nota Fiscal Multi-Item)
        </h1>
        <p className="text-sm text-muted-foreground">Registre entradas de notas fiscais com um ou múltiplos produtos</p>
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
              {s === 1 && " Dados NF & Produtos"}
              {s === 2 && " Pesagem Balança"}
              {s === 3 && " Descarga & Armazenagem"}
            </div>
            {s < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </React.Fragment>
        ))}
      </div>

      {/* ─── ETAPA 1: Cabeçalho NF + Múltiplos Produtos ─── */}
      {step === 1 && (
        <div className="space-y-5">
          {/* OCR Scanner da NF */}
          <div className="border-2 border-dashed border-teal-300 rounded-xl p-4 bg-teal-50/40 text-center">
            <FileText className="w-8 h-8 mx-auto mb-2 text-teal-500" />
            <p className="text-sm font-semibold text-teal-700 mb-1">📷 Foto da NF — Leitura Inteligente por IA</p>
            <p className="text-xs text-muted-foreground mb-3">A IA lê a nota e extrai a NF, fornecedor, pesos e TODOS os produtos presentes!</p>
            {ocrLoading ? (
              <div className="flex items-center justify-center gap-2 text-teal-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Lendo NF e múltiplos produtos com IA...</span>
              </div>
            ) : (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700 hover:bg-teal-50"
                  onClick={() => nfCamRef.current?.click()}>
                  <Camera className="w-4 h-4" /> Câmera
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700 hover:bg-teal-50"
                  onClick={() => nfFileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Galeria / PDF
                </Button>
                
                <input ref={nfCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => handleNfPhoto(e.target.files?.[0])} />
                <input ref={nfFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                  onChange={e => handleNfPhoto(e.target.files?.[0])} />
              </div>
            )}
            {header.foto_nf_url && (
              <div className="mt-2 flex items-center justify-center gap-1 text-emerald-600 text-xs font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Foto da NF enviada
              </div>
            )}
          </div>

          {/* Dados Gerais da NF */}
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" /> Cabeçalho da Nota Fiscal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nº da NF *</Label>
                <Input value={header.numero_nf} onChange={e => setHead("numero_nf", e.target.value)} placeholder="Ex: 12345" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Fornecedor *</Label>
                <Input value={header.fornecedor} onChange={e => setHead("fornecedor", e.target.value)} placeholder="Razão social do fornecedor" />
              </div>
            </div>
            <div className="space-y-1 max-w-xs">
              <Label className="text-xs font-semibold">Peso Bruto Total NF (kg)</Label>
              <Input type="number" value={header.peso_kg_nf_total} onChange={e => setHead("peso_kg_nf_total", e.target.value)} placeholder="Ex: 2500" />
            </div>
          </div>

          {/* Seção de Itens / Produtos da NF */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-base">Produtos da Nota Fiscal ({itens.length})</h3>
              </div>
              <Button type="button" onClick={addItem} size="sm" variant="outline" className="gap-1.5 border-teal-400 text-teal-700 hover:bg-teal-50">
                <Plus className="w-4 h-4" /> Adicionar Produto
              </Button>
            </div>

            <datalist id="produtos-list-options">
              {Object.keys(PESOS_POR_METRO).map(p => (
                <option key={p} value={p} />
              ))}
            </datalist>

            {itens.map((item, idx) => {
              const pTeorico = calcPesoTeoricoItem(item.produto, item.quantidade_barras);
              return (
                <div key={item.tempId} className="bg-card border-2 border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 relative hover:border-teal-300 transition-colors">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-xs text-teal-700 uppercase bg-teal-50 px-2 py-0.5 rounded">
                      Item #{idx + 1}
                    </span>
                    {itens.length > 1 && (
                      <button type="button" onClick={() => removeItem(item.tempId)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Produto / Material *</Label>
                    <Input
                      list="produtos-list-options"
                      value={item.produto}
                      onChange={e => updateItem(item.tempId, "produto", e.target.value)}
                      placeholder="Digite ou escolha da lista (ex: Barra Chata 3/8)..."
                      className="bg-background"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Qtd Barras *</Label>
                      <Input
                        type="number"
                        value={item.quantidade_barras}
                        onChange={e => updateItem(item.tempId, "quantidade_barras", e.target.value)}
                        placeholder="Ex: 50"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Peso NF (kg)</Label>
                      <Input
                        type="number"
                        value={item.peso_kg_nf}
                        onChange={e => updateItem(item.tempId, "peso_kg_nf", e.target.value)}
                        placeholder="Ex: 600"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Espessura</Label>
                      <Input
                        value={item.espessura}
                        onChange={e => updateItem(item.tempId, "espessura", e.target.value)}
                        placeholder="Ex: 3/8"
                      />
                    </div>
                  </div>

                  {pTeorico && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-blue-700 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-blue-500" />
                      <span>Peso Teórico: <strong>{pTeorico.toFixed(1)} kg</strong> ({item.quantidade_barras} barras × {COMPRIMENTO_PADRAO_M}m)</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Resumo da Etapa 1 */}
          <div className="bg-slate-100 dark:bg-slate-900 border rounded-xl p-3 text-xs flex justify-between items-center flex-wrap gap-2">
            <div>
              <span className="text-muted-foreground">Total de Peças: </span>
              <strong className="text-foreground font-bold">{somaQtdBarrasTotal} barras</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Soma Pesos NF: </span>
              <strong className="text-foreground font-bold">{somaPesoNfItens.toLocaleString("pt-BR")} kg</strong>
            </div>
            {pesoTeoricoTotal > 0 && (
              <div>
                <span className="text-muted-foreground">Teórico Somado: </span>
                <strong className="text-blue-600 font-bold">{pesoTeoricoTotal.toFixed(0)} kg</strong>
              </div>
            )}
          </div>

          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
            disabled={!canAdvance1}
            onClick={() => setStep(2)}
          >
            Avançar para Pesagem Balança <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ─── ETAPA 2: Pesagem & Conferência ─── */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Foto da balança — OBRIGATÓRIA */}
          <div className={`border-2 rounded-xl p-4 text-center ${header.foto_balanca_url ? "border-emerald-400 bg-emerald-50/40" : "border-dashed border-amber-400 bg-amber-50/40"}`}>
            <Scale className={`w-8 h-8 mx-auto mb-2 ${header.foto_balanca_url ? "text-emerald-500" : "text-amber-500"}`} />
            <p className="text-sm font-bold mb-1">
              {header.foto_balanca_url ? "✅ Foto da Balança Registrada" : "📸 Foto da Balança Geral — OBRIGATÓRIA"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {header.foto_balanca_url ? "Foto da pesagem física enviada" : "Tire uma foto do display da balança com a pesagem total do caminhão/material"}
            </p>
            {uploadingBal ? (
              <div className="flex items-center justify-center gap-2 text-amber-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
              </div>
            ) : (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50"
                  onClick={() => balCamRef.current?.click()}>
                  <Camera className="w-4 h-4" /> Câmera
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50"
                  onClick={() => balFileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Galeria / PDF
                </Button>
                <input ref={balCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => handleBalancaPhoto(e.target.files?.[0])} />
                <input ref={balFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                  onChange={e => handleBalancaPhoto(e.target.files?.[0])} />
              </div>
            )}
            {header.foto_balanca_url && (
              <img src={header.foto_balanca_url} alt="Balança" className="mt-3 max-h-32 mx-auto rounded-lg object-cover border" />
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Peso Total Aferido na Balança (kg) *</Label>
            <Input
              type="number"
              value={header.peso_kg_balanca}
              onChange={e => setHead("peso_kg_balanca", e.target.value)}
              placeholder="Digite o peso total aferido na balança física"
              className="text-lg font-bold"
            />
          </div>

          {/* Comparativo de pesos */}
          {header.peso_kg_balanca && pesoNfComparar > 0 && (
            <div className={`rounded-xl border-2 p-4 space-y-2 ${temDivergencia ? "border-red-400 bg-red-50" : "border-emerald-400 bg-emerald-50"}`}>
              <p className="font-bold text-sm flex items-center gap-2">
                {temDivergencia
                  ? <><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-red-700">⚠️ Divergência de Peso Detectada!</span></>
                  : <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700">✅ Pesagem Dentro da Tolerância</span></>
                }
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white rounded-lg p-2 border">
                  <p className="text-muted-foreground">NF Total</p>
                  <p className="font-bold text-base">{pesoNfComparar.toLocaleString("pt-BR")} kg</p>
                </div>
                <div className={`rounded-lg p-2 border ${temDivergencia ? "bg-red-100 border-red-300" : "bg-emerald-100 border-emerald-300"}`}>
                  <p className="text-muted-foreground">Balança Física</p>
                  <p className="font-bold text-base">{Number(header.peso_kg_balanca).toLocaleString("pt-BR")} kg</p>
                  <p className={`text-[10px] font-bold ${temDivergencia ? "text-red-600" : "text-emerald-600"}`}>
                    {divNfBal >= 0 ? "+" : ""}{divNfBal?.toFixed(1)}%
                  </p>
                </div>
                {pesoTeoricoTotal > 0 && (
                  <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                    <p className="text-muted-foreground">Teórico Somado</p>
                    <p className="font-bold text-base">{pesoTeoricoTotal.toFixed(0)} kg</p>
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
              Avançar para Descarga & Armazenagem <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── ETAPA 3: Descarga & Locais de Armazenagem ─── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Foto do material descarregado */}
          <div className={`border-2 rounded-xl p-4 text-center ${header.foto_material_url ? "border-emerald-400 bg-emerald-50/40" : "border-dashed border-teal-400 bg-teal-50/40"}`}>
            <Camera className={`w-8 h-8 mx-auto mb-2 ${header.foto_material_url ? "text-emerald-500" : "text-teal-500"}`} />
            <p className="text-sm font-bold mb-1">
              {header.foto_material_url ? "✅ Foto do Material Registrada" : "📸 Foto do Material Descarregado — OBRIGATÓRIA"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">Registre foto dos materiais organizados no barracão</p>
            {uploadingMat ? (
              <div className="flex items-center justify-center gap-2 text-teal-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
              </div>
            ) : (
              <div className="flex gap-2 justify-center flex-wrap">
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700 hover:bg-teal-50"
                  onClick={() => matCamRef.current?.click()}>
                  <Camera className="w-4 h-4" /> Câmera
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700 hover:bg-teal-50"
                  onClick={() => matFileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Galeria / PDF
                </Button>
                <input ref={matCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => handleMaterialPhoto(e.target.files?.[0])} />
                <input ref={matFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                  onChange={e => handleMaterialPhoto(e.target.files?.[0])} />
              </div>
            )}
            {header.foto_material_url && (
              <img src={header.foto_material_url} alt="Material" className="mt-3 max-h-32 mx-auto rounded-lg object-cover border" />
            )}
          </div>

          {/* Definir Local de Armazenagem para CADA item */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" /> Locais de Armazenagem por Produto
            </h3>
            {itens.map((item, idx) => (
              <div key={item.tempId} className="bg-card border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-xs text-teal-700">Item #{idx + 1}: {item.produto || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">{item.quantidade_barras} barras {item.espessura ? `(${item.espessura})` : ""}</p>
                </div>
                <div className="w-full sm:w-48">
                  <Input
                    value={item.local_armazenagem}
                    onChange={e => updateItem(item.tempId, "local_armazenagem", e.target.value.toUpperCase())}
                    placeholder="Ex: A1, B3, PATIO..."
                    className="font-bold text-xs uppercase"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Observações Finais</Label>
            <Textarea
              value={header.observacoes}
              onChange={e => setHead("observacoes", e.target.value)}
              placeholder="Condição dos materiais, avarias, etc..."
              rows={2}
            />
          </div>

          {/* Resumo Final */}
          <div className="bg-muted/30 border rounded-xl p-4 space-y-2 text-sm">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Resumo Geral da Entrada</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">NF:</span><span className="font-bold">{header.numero_nf}</span>
              <span className="text-muted-foreground">Fornecedor:</span><span className="font-bold truncate">{header.fornecedor}</span>
              <span className="text-muted-foreground">Nº de Produtos:</span><span className="font-bold text-teal-700">{itens.length} produto(s)</span>
              <span className="text-muted-foreground">Total Peças:</span><span className="font-bold">{somaQtdBarrasTotal} barras</span>
              <span className="text-muted-foreground">Peso Balança:</span><span className="font-bold">{Number(header.peso_kg_balanca).toLocaleString("pt-BR")} kg</span>
              <span className="text-muted-foreground">Divergência:</span>
              <span className={`font-bold ${temDivergencia ? "text-red-600" : "text-emerald-600"}`}>
                {divNfBal !== null ? `${divNfBal.toFixed(1)}%` : "—"} {temDivergencia && " ⚠️"}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-700 gap-2"
              disabled={!canAdvance3 || saving}
              onClick={handleSave}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando {itens.length} item(is)...</> : `✅ Finalizar Entrada (${itens.length} produtos)`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}