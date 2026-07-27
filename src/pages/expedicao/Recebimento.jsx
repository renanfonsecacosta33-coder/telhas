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
  ChevronRight, ChevronLeft, Loader2, FileText, MapPin, Zap, Plus, Trash2, Layers, ShieldCheck, Scan, Sparkles
} from "lucide-react";
import ScannerCameraModal from "@/components/expedicao/ScannerCameraModal";

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

// ── Locais de Armazenagem Cadastrados no Sistema ───────────────────────────
const LOCAIS_ARMAZENAGEM_CADASTRADOS = [
  { id: "A1", label: "A1 — Rua A (Posição 1)" },
  { id: "A2", label: "A2 — Rua A (Posição 2)" },
  { id: "A3", label: "A3 — Rua A (Posição 3)" },
  { id: "B1", label: "B1 — Rua B (Posição 1)" },
  { id: "B2", label: "B2 — Rua B (Posição 2)" },
  { id: "B3", label: "B3 — Rua B (Posição 3)" },
  { id: "B4", label: "B4 — Rua B (Posição 4)" },
  { id: "C1", label: "C1 — Rua C (Frisada / Bobinas)" },
  { id: "C2", label: "C2 — Rua C (Posição 2)" },
  { id: "D1", label: "D1 — Rua D (Posição 1)" },
  { id: "D2", label: "D2 — Rua D (Posição 2)" },
  { id: "E1", label: "E1 — Rua E (Posição 1)" },
  { id: "E2", label: "E2 — Rua E (Posição 2)" },
  { id: "PATIO", label: "PATIO — Pátio Externo" },
  { id: "BOBINAS", label: "BOBINAS — Área de Bobinas" },
];

// ── Utilitário de preservação de nitidez em alta resolução ─────────────────────
async function compressImage(file, maxDimension = 2048, quality = 0.90) {
  if (!file || !file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) resolve(file);
          else resolve(new File([blob], file.name || "nf_optimized.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

function calcPesoTeoricoItem(produto, qtdBarras, espessuraStr = "") {
  if (!produto || !qtdBarras) return null;
  const qtd = Number(qtdBarras);
  if (isNaN(qtd) || qtd <= 0) return null;

  // 1. Busca na tabela pré-definida
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

  // 2. Cálculo dinâmico para Tubos / Perfis (Redondo, Retangular, Quadrado)
  if (!kgM) {
    const prodUpper = produto.toUpperCase();
    let espessura = parseFloat(espessuraStr?.replace(",", "."));
    if (isNaN(espessura)) {
      const matchEsp = prodUpper.match(/CH\s*([\d,\.]+)|(\d+[\,\.]\d+)\s*MM/);
      if (matchEsp) espessura = parseFloat((matchEsp[1] || matchEsp[2]).replace(",", "."));
    }
    if (isNaN(espessura)) espessura = 1.25; // Espessura padrão se não especificada

    if (prodUpper.includes("RED") || prodUpper.includes("TUBO RED")) {
      let od = 31.75;
      if (prodUpper.includes("1.1/2") || prodUpper.includes("1 1/2")) od = 38.1;
      else if (prodUpper.includes("2\"") || prodUpper.includes("2 ")) od = 50.8;
      else if (prodUpper.includes("1\"") || prodUpper.includes("1 ")) od = 25.4;
      else if (prodUpper.includes("3/4")) od = 19.05;
      else if (prodUpper.includes("5/8")) od = 15.88;
      else if (prodUpper.includes("1/2")) od = 12.7;

      kgM = (od - espessura) * espessura * 0.02466;
    } else if (prodUpper.includes("RET") || prodUpper.includes("QUAD") || prodUpper.includes("TUBO") || prodUpper.includes("PERFIL")) {
      const matchDim = prodUpper.match(/(\d+)\s*X\s*(\d+)/);
      let a = 20, b = 30;
      if (matchDim) {
        a = parseFloat(matchDim[1]);
        b = parseFloat(matchDim[2]);
      }
      const perimetro = 2 * (a + b);
      const diamEquiv = perimetro / Math.PI;
      kgM = (diamEquiv - espessura) * espessura * 0.02466;
    }
  }

  if (!kgM || isNaN(kgM)) return null;
  return kgM * COMPRIMENTO_PADRAO_M * qtd;
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
    peso_kg_balanca: "",
    foto_balanca_url: "",
    foto_material_url: "",
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
    peso_kg_balanca_total: "",
    foto_nf_url: "",
    foto_balanca_url: "",
    foto_material_url: "",
    observacoes: "",
  });

  // Lista de itens da NF (múltiplos produtos por nota!)
  const [itens, setItens] = useState([createNewItem()]);

  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [uploadingItemKey, setUploadingItemKey] = useState(null);

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

  // ── Upload de arquivo por item ──────────────────────────────────────────
  const handleItemFileUpload = async (tempId, field, file) => {
    if (!file) return;
    const key = `${tempId}_${field}`;
    setUploadingItemKey(key);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      updateItem(tempId, field, file_url);
      toast.success(`📸 Arquivo enviado para o item!`);
    } catch {
      toast.error("Erro ao fazer upload do arquivo.");
    } finally {
      setUploadingItemKey(null);
    }
  };

  // ── OCR da NF com Alta Velocidade ────────────────────
  const handleNfPhoto = async (rawFile) => {
    if (!rawFile) return;
    setOcrLoading(true);
    try {
      // ⚡ Otimiza a imagem mantendo altíssima nitidez (2048px @ 0.90) para leitura nítida de textos de NF
      const file = await compressImage(rawFile, 2048, 0.90);

      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setHead("foto_nf_url", file_url);

      try {
        const json = await base44.integrations.Core.InvokeLLM({
          prompt: `Você é um leitor especialista em Notas Fiscais (NF-e) de aço e tubos. 
Extraia da imagem da NF-e:
- numero_nf (string)
- fornecedor (string)
- peso_total_nf_kg (number): Peso Bruto total declarado na NF em kg.
- itens: Lista de produtos presentes na nota. Para cada item:
  * descricao_produto (string)
  * quantidade_itens (number): Quantidade de BARRAS / PEÇAS (ex: 324)
  * peso_kg_item (number ou null): Peso total DESSAS PEÇAS em KG. ATENÇÃO: NÃO COPIE A QUANTIDADE DE PEÇAS PARA O PESO! Se o peso em kg deste item específico não constar na linha, deixe peso_kg_item como NULL.
  * espessura (string): espessura em mm ou chapa (ex: 1,25)
`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              numero_nf: { type: "string" },
              fornecedor: { type: "string" },
              peso_total_nf_kg: { type: "number" },
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
            const qtdBarras = it.quantidade_itens ? Number(it.quantidade_itens) : 0;
            let pesoItemNum = it.peso_kg_item ? Number(it.peso_kg_item) : null;

            // Se o LLM equivocadamente igualou o peso em kg ao número de barras (ex: 324kg para 324 barras)
            if (pesoItemNum !== null && pesoItemNum === qtdBarras && qtdBarras > 0) {
              pesoItemNum = null;
            }

            // Calcula o peso teórico real se o peso unitário da linha não estava discriminado em KG na NF
            const pTeorico = calcPesoTeoricoItem(match || rawDesc, qtdBarras, it.espessura);
            const finalPesoItem = pesoItemNum !== null 
              ? String(pesoItemNum) 
              : (pTeorico ? String(Math.round(pTeorico)) : "");

            return {
              tempId: Date.now() + idx + Math.random(),
              produto: match || rawDesc,
              quantidade_barras: qtdBarras ? String(qtdBarras) : "",
              peso_kg_nf: finalPesoItem,
              espessura: it.espessura ? String(it.espessura) : "",
              peso_kg_balanca: finalPesoItem, // pré-preenche pesagem inicial
              foto_balanca_url: "",
              foto_material_url: "",
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

  // ── Upload foto da balança geral ──────────────────
  const handleBalancaPhotoGeral = async (file) => {
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setHead("foto_balanca_url", file_url);
      toast.success("📸 Foto da balança geral registrada!");
    } catch { toast.error("Erro ao enviar foto da balança."); }
  };

  // ── Upload foto do material geral ──────────────────
  const handleMaterialPhotoGeral = async (file) => {
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setHead("foto_material_url", file_url);
      toast.success("📸 Foto do material geral registrada!");
    } catch { toast.error("Erro ao enviar foto do material."); }
  };

  // ── Totais e Cálculos de Validação ──────────────────────────────────────
  const somaQtdBarrasTotal = itens.reduce((s, i) => s + (Number(i.quantidade_barras) || 0), 0);
  const somaPesoNfItens   = itens.reduce((s, i) => s + (Number(i.peso_kg_nf) || 0), 0);
  const pesoNfDeclarado   = Number(header.peso_kg_nf_total) || 0;
  const pesoTeoricoTotal  = itens.reduce((s, i) => s + (calcPesoTeoricoItem(i.produto, i.quantidade_barras) || 0), 0);

  // Soma dos pesos na balança aferidos por item (ou geral)
  const somaPesoBalancaItens = itens.reduce((s, i) => s + (Number(i.peso_kg_balanca) || 0), 0);
  const pesoBalancaComparar  = Number(header.peso_kg_balanca_total) || somaPesoBalancaItens;
  const pesoNfComparar       = pesoNfDeclarado || somaPesoNfItens;

  // Divergências
  const diffPesoNfItensVsBruto = pesoNfDeclarado > 0 ? Math.abs(somaPesoNfItens - pesoNfDeclarado) : 0;
  const bateramPesosItens      = pesoNfDeclarado === 0 || diffPesoNfItensVsBruto === 0;

  const divNfBal = calcDivergencia(pesoNfComparar, pesoBalancaComparar);
  const temDivergencia = Math.abs(divNfBal || 0) > TOLERANCIA_DIVERGENCIA;

  // ── Validações de Avanço por Etapa ──────────────────────────────────
  const itensValidosEtapa1 = itens.length > 0 && itens.every(i => i.produto && Number(i.quantidade_barras) > 0 && Number(i.peso_kg_nf) > 0);
  const canAdvance1 = header.numero_nf && header.fornecedor && itensValidosEtapa1;

  // Para Etapa 2: Exige que cada item tenha seu peso balança informado OU peso total geral + pelo menos uma foto de balança enviada
  const fotosBalancaCompletas = header.foto_balanca_url || itens.every(i => i.foto_balanca_url);
  const canAdvance2 = (header.peso_kg_balanca_total || somaPesoBalancaItens > 0) && fotosBalancaCompletas;

  // Para Etapa 3: Exige que CADA item tenha sua foto de descarga enviada E local de armazenagem definido
  const fotosMaterialCompletas = header.foto_material_url || itens.every(i => i.foto_material_url);
  const locaisCompletos = itens.every(i => i.local_armazenagem && i.local_armazenagem.trim() !== "");
  const canAdvance3 = fotosMaterialCompletas && locaisCompletos;

  // ── Salvar Todos os Itens no Banco ────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const status = temDivergencia ? "divergente" : "conferido";
      const divergencia_percent = divNfBal;
      const agora = new Date();
      const data_validade = new Date(agora);
      data_validade.setMonth(data_validade.getMonth() + 6);

      // Salva uma entrada no banco de dados para CADA item da Nota Fiscal!
      for (const item of itens) {
        const itemPesoNf = Number(item.peso_kg_nf) || (somaPesoNfItens > 0 ? (Number(item.quantidade_barras) / somaQtdBarrasTotal) * pesoNfComparar : 0);
        const itemPesoBalanca = Number(item.peso_kg_balanca) || itemPesoNf;
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
          local_armazenagem:         item.local_armazenagem.toUpperCase(),
          foto_nf_url:               header.foto_nf_url,
          foto_balanca_url:          item.foto_balanca_url || header.foto_balanca_url,
          foto_material_url:         item.foto_material_url || header.foto_material_url,
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
        <p className="text-sm text-muted-foreground">Registre entradas de notas fiscais conferindo barras, pesagem e foto por produto</p>
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
              {s === 1 && " Dados NF & Validação"}
              {s === 2 && " Pesagem Balança"}
              {s === 3 && " Descarga & Armazenagem"}
            </div>
            {s < 3 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </React.Fragment>
        ))}
      </div>

      {/* ─── ETAPA 1: Cabeçalho NF + Múltiplos Produtos + Validação ─── */}
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
                <Button type="button" className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md"
                  onClick={() => setScannerModalOpen(true)}>
                  <Scan className="w-4 h-4" /> Scanner IA (Câmera ao Vivo) <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                </Button>
                <Button type="button" variant="outline" className="gap-1.5 border-teal-500 text-teal-700 hover:bg-teal-50 font-bold"
                  onClick={() => nfCamRef.current?.click()}>
                  <Camera className="w-4 h-4 text-teal-600" /> Câmera HD Nativa (4K)
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-teal-400 text-teal-700 hover:bg-teal-50"
                  onClick={() => nfFileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Arquivo / PDF
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
                <Input value={header.numero_nf} onChange={e => setHead("numero_nf", e.target.value)} placeholder="Ex: 0180517" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold">Fornecedor *</Label>
                <Input value={header.fornecedor} onChange={e => setHead("fornecedor", e.target.value)} placeholder="Razão social do fornecedor" />
              </div>
            </div>
            <div className="space-y-1 max-w-xs">
              <Label className="text-xs font-semibold">Peso Bruto Total NF (kg) *</Label>
              <Input type="number" value={header.peso_kg_nf_total} onChange={e => setHead("peso_kg_nf_total", e.target.value)} placeholder="Ex: 1269" />
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
                      placeholder="Digite ou escolha da lista (ex: TUBO RED 1 1/4)..."
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
                        placeholder="Ex: 324"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Peso NF (kg) *</Label>
                      <Input
                        type="number"
                        value={item.peso_kg_nf}
                        onChange={e => {
                          const v = e.target.value;
                          updateItem(item.tempId, "peso_kg_nf", v);
                          // Atualiza também pesagem inicial por padrão
                          if (!item.peso_kg_balanca) updateItem(item.tempId, "peso_kg_balanca", v);
                        }}
                        placeholder="Ex: 324"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Espessura</Label>
                      <Input
                        value={item.espessura}
                        onChange={e => updateItem(item.tempId, "espessura", e.target.value)}
                        placeholder="Ex: 1,25"
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

          {/* 🔍 PAINEL DE VALIDAÇÃO GERAL DE PESOS E BARRAS (FOTO 1 REQUIREMENT) */}
          <div className={`border-2 rounded-xl p-4 space-y-3 ${
            bateramPesosItens ? "border-emerald-400 bg-emerald-50/50" : "border-amber-400 bg-amber-50/50"
          }`}>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <ShieldCheck className={`w-5 h-5 ${bateramPesosItens ? "text-emerald-600" : "text-amber-600"}`} />
                Validação de Conferência (Soma dos Itens vs Nota Fiscal)
              </h4>
              <Badge className={`text-[10px] ${bateramPesosItens ? "bg-emerald-600" : "bg-amber-600"} text-white border-transparent`}>
                {bateramPesosItens ? "Pesos Conferem" : "Atenção a Pesos"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground">Total de Peças</p>
                <p className="font-bold text-sm text-foreground">{somaQtdBarrasTotal} barras</p>
                <p className="text-[10px] text-muted-foreground">({itens.length} produto(s))</p>
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground">Soma Pesos Itens</p>
                <p className="font-bold text-sm text-foreground">{somaPesoNfItens.toLocaleString("pt-BR")} kg</p>
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground">Peso Bruto NF</p>
                <p className="font-bold text-sm text-foreground">{pesoNfDeclarado ? `${pesoNfDeclarado.toLocaleString("pt-BR")} kg` : "Não informado"}</p>
              </div>
              <div className={`rounded-lg p-2 border ${bateramPesosItens ? "bg-emerald-100 border-emerald-300" : "bg-amber-100 border-amber-300"}`}>
                <p className="text-muted-foreground">Diferença Soma vs NF</p>
                <p className={`font-bold text-sm ${bateramPesosItens ? "text-emerald-700" : "text-amber-700"}`}>
                  {diffPesoNfItensVsBruto === 0 ? "0 kg (Bateu!)" : `${diffPesoNfItensVsBruto.toLocaleString("pt-BR")} kg`}
                </p>
              </div>
            </div>

            {!bateramPesosItens && pesoNfDeclarado > 0 && (
              <p className="text-xs text-amber-700 bg-white/80 p-2 rounded border border-amber-200">
                ⚠️ <strong>Atenção:</strong> A soma dos pesos dos produtos ({somaPesoNfItens} kg) difere do Peso Bruto Total declarado na NF ({pesoNfDeclarado} kg) por {diffPesoNfItensVsBruto} kg. Verifique os valores dos itens.
              </p>
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

      {/* ─── ETAPA 2: Pesagem Balança POR ITEM + Foto da Balança por Item (FOTO 2 REQUIREMENT) ─── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
            <p className="font-bold text-sm flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-600" />
              Pesagem da Balança por Produto ({itens.length} itens)
            </p>
            <p>Envie a foto da pesagem da balança física para cada um dos produtos da NF (ou envie a foto da balança geral).</p>
          </div>

          {/* Foto da Balança Geral (Opcional se enviar por item) */}
          <div className="bg-card border rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Opção: Foto da Pesagem Geral da Balança (Caminhão/Lote)</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                onClick={() => balCamRef.current?.click()}>
                <Camera className="w-3.5 h-3.5" /> Câmera Geral
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                onClick={() => balFileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Galeria / PDF
              </Button>
              <input ref={balCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => handleBalancaPhotoGeral(e.target.files?.[0])} />
              <input ref={balFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                onChange={e => handleBalancaPhotoGeral(e.target.files?.[0])} />
            </div>
            {header.foto_balanca_url && (
              <div className="mt-2 text-xs text-emerald-600 font-bold flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Foto Geral da Balança Registrada
              </div>
            )}
          </div>

          {/* Pesagem e Fotos de Balança INDIVIDUAIS POR ITEM */}
          <div className="space-y-4">
            {itens.map((item, idx) => (
              <ItemPesagemCard
                key={item.tempId}
                item={item}
                idx={idx}
                header={header}
                uploadingItemKey={uploadingItemKey}
                updateItem={updateItem}
                handleItemFileUpload={handleItemFileUpload}
              />
            ))}
          </div>

          {/* Comparativo de Pesos Balança vs NF */}
          <div className={`rounded-xl border-2 p-4 space-y-2 ${temDivergencia ? "border-red-400 bg-red-50" : "border-emerald-400 bg-emerald-50"}`}>
            <p className="font-bold text-sm flex items-center gap-2">
              {temDivergencia
                ? <><AlertTriangle className="w-4 h-4 text-red-600" /><span className="text-red-700">⚠️ Divergência Detectada entre Balança e Nota Fiscal!</span></>
                : <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700">✅ Pesagem na Balança Conferida com a NF</span></>
              }
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground">Soma NF</p>
                <p className="font-bold text-base">{pesoNfComparar.toLocaleString("pt-BR")} kg</p>
              </div>
              <div className={`rounded-lg p-2 border ${temDivergencia ? "bg-red-100 border-red-300" : "bg-emerald-100 border-emerald-300"}`}>
                <p className="text-muted-foreground">Soma Balança</p>
                <p className="font-bold text-base">{pesoBalancaComparar.toLocaleString("pt-BR")} kg</p>
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
          </div>

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

      {/* ─── ETAPA 3: Descarga & Armazenagem POR ITEM + Foto por Produto (FOTO 2 REQUIREMENT) ─── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs text-teal-800 space-y-1">
            <p className="font-bold text-sm flex items-center gap-1.5">
              <Package className="w-4 h-4 text-teal-600" />
              Fotos da Descarga e Locais de Armazenagem ({itens.length} itens)
            </p>
            <p>Tire a foto de cada material descarregado no barracão e defina sua posição de armazenagem no mapa.</p>
          </div>

          {/* Fotos e Posições de Armazenagem INDIVIDUAIS POR ITEM */}
          <div className="space-y-4">
            {itens.map((item, idx) => (
              <ItemDescargaCard
                key={item.tempId}
                item={item}
                idx={idx}
                uploadingItemKey={uploadingItemKey}
                updateItem={updateItem}
                handleItemFileUpload={handleItemFileUpload}
              />
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
          <div className="bg-card border rounded-xl p-4 space-y-2 text-sm">
            <p className="font-bold text-xs uppercase text-muted-foreground mb-2">Resumo Geral da Entrada</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">NF:</span><span className="font-bold">{header.numero_nf}</span>
              <span className="text-muted-foreground">Fornecedor:</span><span className="font-bold truncate">{header.fornecedor}</span>
              <span className="text-muted-foreground">Produtos:</span><span className="font-bold text-teal-700">{itens.length} item(is)</span>
              <span className="text-muted-foreground">Total Peças:</span><span className="font-bold">{somaQtdBarrasTotal} barras</span>
              <span className="text-muted-foreground">Soma Pesos NF:</span><span className="font-bold">{somaPesoNfItens.toLocaleString("pt-BR")} kg</span>
              <span className="text-muted-foreground">Soma Pesos Balança:</span><span className="font-bold">{somaPesoBalancaItens.toLocaleString("pt-BR")} kg</span>
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
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando {itens.length} produto(s)...</> : `✅ Finalizar Entrada (${itens.length} produtos)`}
            </Button>
          </div>
        </div>
      )}

      {/* Modal do Scanner da Câmera ao Vivo com IA */}
      <ScannerCameraModal
        open={scannerModalOpen}
        onOpenChange={setScannerModalOpen}
        onScanSuccess={handleNfPhoto}
      />
    </div>
  );
}

// ── Componentes auxiliares de Item para evitar erro de Hooks em loops ──────
function ItemPesagemCard({ item, idx, header, uploadingItemKey, updateItem, handleItemFileUpload }) {
  const itemCamRef = useRef(null);
  const itemFileRef = useRef(null);
  const isUploading = uploadingItemKey === `${item.tempId}_foto_balanca_url`;

  return (
    <div className={`border-2 rounded-xl p-4 bg-card space-y-3 ${
      item.foto_balanca_url || header.foto_balanca_url ? "border-emerald-300 bg-emerald-50/20" : "border-amber-300"
    }`}>
      <div className="flex items-center justify-between border-b pb-2">
        <div>
          <span className="font-bold text-sm text-foreground">
            Item #{idx + 1}: {item.produto || "Produto"}
          </span>
          <p className="text-xs text-muted-foreground">
            Qtd: <strong>{item.quantidade_barras} barras</strong> · Peso NF: <strong>{item.peso_kg_nf} kg</strong>
          </p>
        </div>
        {item.foto_balanca_url ? (
          <Badge className="bg-emerald-600 text-white border-transparent">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Foto Ok
          </Badge>
        ) : (
          <Badge className="bg-amber-500 text-white border-transparent">
            Aguardando Foto
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Peso deste Item na Balança (kg) *</Label>
          <Input
            type="number"
            value={item.peso_kg_balanca}
            onChange={e => updateItem(item.tempId, "peso_kg_balanca", e.target.value)}
            placeholder="Ex: 324"
            className="font-bold"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold">Foto da Balança para este Item *</Label>
          {isUploading ? (
            <div className="flex items-center gap-2 text-xs text-teal-600 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando foto...
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-amber-400 text-amber-700 flex-1"
                onClick={() => itemCamRef.current?.click()}>
                <Camera className="w-3.5 h-3.5" /> Câmera
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-amber-400 text-amber-700 flex-1"
                onClick={() => itemFileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Galeria / PDF
              </Button>

              <input ref={itemCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => handleItemFileUpload(item.tempId, "foto_balanca_url", e.target.files?.[0])} />
              <input ref={itemFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                onChange={e => handleItemFileUpload(item.tempId, "foto_balanca_url", e.target.files?.[0])} />
            </div>
          )}
          {item.foto_balanca_url && (
            <img src={item.foto_balanca_url} alt="Balança Item" className="mt-2 max-h-20 rounded border object-cover" />
          )}
        </div>
      </div>
    </div>
  );
}

function ItemDescargaCard({ item, idx, uploadingItemKey, updateItem, handleItemFileUpload }) {
  const matCamRef = useRef(null);
  const matFileRef = useRef(null);
  const isUploading = uploadingItemKey === `${item.tempId}_foto_material_url`;

  return (
    <div className={`border-2 rounded-xl p-4 bg-card space-y-3 ${
      item.foto_material_url && item.local_armazenagem ? "border-emerald-400 bg-emerald-50/20" : "border-slate-300"
    }`}>
      <div className="flex items-center justify-between border-b pb-2">
        <div>
          <span className="font-bold text-sm text-teal-700">
            Item #{idx + 1}: {item.produto || "Produto"}
          </span>
          <p className="text-xs text-muted-foreground">
            {item.quantidade_barras} barras {item.espessura ? `(${item.espessura})` : ""} · {item.peso_kg_balanca} kg
          </p>
        </div>
        {item.foto_material_url && item.local_armazenagem ? (
          <Badge className="bg-emerald-600 text-white border-transparent">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Foto Pintado Ok
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300">
            Aguardando Foto Pintado
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        {/* Local de Armazenagem Selecionável */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-teal-600" /> Local de Armazenagem Cadastrado *
          </Label>
          <div className="space-y-1.5">
            <Select 
              value={LOCAIS_ARMAZENAGEM_CADASTRADOS.some(l => l.id === item.local_armazenagem) ? item.local_armazenagem : (item.local_armazenagem ? "outro" : "")} 
              onValueChange={v => {
                if (v !== "outro") updateItem(item.tempId, "local_armazenagem", v);
              }}
            >
              <SelectTrigger className="h-9 text-xs font-bold uppercase">
                <SelectValue placeholder="Selecione o Local Cadastrado..." />
              </SelectTrigger>
              <SelectContent>
                {LOCAIS_ARMAZENAGEM_CADASTRADOS.map(loc => (
                  <SelectItem key={loc.id} value={loc.id} className="text-xs font-semibold">
                    📍 {loc.label}
                  </SelectItem>
                ))}
                <SelectItem value="outro" className="text-xs italic text-muted-foreground">
                  ✍️ Outra posição (digitar manualmente)
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Input para digitação manual se preferir */}
            <Input
              value={item.local_armazenagem}
              onChange={e => updateItem(item.tempId, "local_armazenagem", e.target.value.toUpperCase())}
              placeholder="Digite o código da posição (ex: A1, B3, PATIO)..."
              className="font-bold text-xs uppercase h-8"
            />
          </div>
        </div>

        {/* Foto do Material Pintado / Identificado */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Foto do Material Pintado / Identificado *
          </Label>
          <p className="text-[11px] text-muted-foreground mb-1">
            🎨 Tire a foto da ponta pintada / cor de identificação do material
          </p>
          {isUploading ? (
            <div className="flex items-center gap-2 text-xs text-teal-600 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando foto do material pintado...
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-teal-500 text-teal-700 flex-1 font-semibold hover:bg-teal-50"
                onClick={() => matCamRef.current?.click()}>
                <Camera className="w-3.5 h-3.5 text-teal-600" /> Câmera Pintado
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-teal-400 text-teal-700 flex-1"
                onClick={() => matFileRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" /> Galeria / PDF
              </Button>

              <input ref={matCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => handleItemFileUpload(item.tempId, "foto_material_url", e.target.files?.[0])} />
              <input ref={matFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                onChange={e => handleItemFileUpload(item.tempId, "foto_material_url", e.target.files?.[0])} />
            </div>
          )}
          {item.foto_material_url && (
            <div className="mt-2 flex items-center gap-2">
              <img src={item.foto_material_url} alt="Material Pintado" className="max-h-20 rounded border-2 border-emerald-400 object-cover shadow-sm" />
              <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Foto da ponta pintada enviada
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}