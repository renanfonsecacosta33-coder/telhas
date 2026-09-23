import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Calculator, Plus, Trash2, AlertTriangle, CheckCircle2, Info,
  Wrench, Layers, Sparkles, Compass, Package, X, ToggleLeft, ToggleRight
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import EspessuraSelect from "./EspessuraSelect";
import CroquiPeca2D, { PRESETS_PERFIL } from "./CroquiPeca2D";
import CalculadoraForcaDobra from "./CalculadoraForcaDobra";
import ChapaEstoqueCombobox from "./ChapaEstoqueCombobox";
import PainelAproveitamentoInteligente from "./PainelAproveitamentoInteligente";
import {
  calcDeducaoDobraAJL,
  calcBlankDesenvolvidoAJL,
  getBlankPadraoAJL,
  interpretarGeometriaNomePeca
} from "@/lib/tabelaBlanksAJL";

// Mapear qualidade da chapa para material legível
const QUALIDADE_MATERIAL = {
  "GV":       "Aço galvanizado",
  "FF":       "Aço galvanizado pré-pintado",
  "PP":       "Aço galvanizado pré-pintado",
  "FQ":       "Aço galvanizado FQ",
  "GL (IMP)": "Aço galvanizado importado",
};

const MATERIAIS = [
  "Aço galvanizado",
  "Aço galvanizado pré-pintado",
  "Aço inox 304",
  "Aço inox 316",
  "Aço carbono",
  "Alumínio 1050",
  "Alumínio 3003",
  "Alumínio 5052",
  "Cobre",
  "Outro",
];

const DEFAULT_DOBRA = { angulo: 90, raio: "", descricao: "", direcao: "cima" };

export default function DesenvolvimentoFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState({
    nome_peca: "",
    numero_pedido: "",
    cliente: "",
    responsavel: "",
    data_desenvolvimento: format(new Date(), "yyyy-MM-dd"),
    material: "Aço galvanizado",
    espessura_mm: "1.50",
    espessura_label: "1,50 mm",
    largura_mm: "",
    comprimento_final_mm: "3000",
    largura_final_mm: "",
    altura_final_mm: "",
    raio_dobra_mm: "1.5",
    maquina_corte: "CORTE 6M",
    maquina_dobra: "DOBRA FUNDO 6M",
    ferramental: "",
    quantidade_peca: "1",
    sequencia_dobras: "",
    observacoes_tecnicas: "",
    chapa_id: "",
    chapa_codigo: "",
  });

  // Modo de seleção de material: "estoque" ou "manual"
  const [modoMaterial, setModoMaterial] = useState("estoque");

  const [abas, setAbas] = useState([25, 50, 25]);
  const [dobras, setDobras] = useState([
    { angulo: 90, raio: "1.5", descricao: "Aba 1", direcao: "cima" },
    { angulo: 90, raio: "1.5", descricao: "Aba 2", direcao: "cima" },
  ]);
  const [comprimentoManual, setComprimentoManual] = useState("");
  const [geometriaAuto, setGeometriaAuto] = useState(null);
  const [origemAbas, setOrigemAbas] = useState("padrao"); // "auto" | "manual" | "preset" | "ranking"

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Auto-leitura e desenho automático a partir do Nome da Peça ──
  const aplicarGeometriaNome = useCallback((nome, { force = false, notify = false } = {}) => {
    if (!nome || typeof nome !== "string") {
      setGeometriaAuto(null);
      return;
    }
    const geo = interpretarGeometriaNomePeca(nome);
    if (geo && geo.abas && geo.abas.length >= 2) {
      setGeometriaAuto(geo);
      setAbas([...geo.abas]);
      setDobras(geo.dobras.map(d => ({
        ...d,
        raio: form.raio_dobra_mm || "1.5",
      })));
      setForm(f => ({
        ...f,
        largura_final_mm: geo.largura_final_mm || f.largura_final_mm,
        altura_final_mm: geo.altura_final_mm || f.altura_final_mm,
      }));
      setOrigemAbas("auto");
      if (notify) {
        toast.success(`📐 ${geo.tipo} identificado! Abas ${geo.abas.join(" × ")} mm desenhadas no croqui.`);
      }
    } else {
      setGeometriaAuto(null);
    }
  }, [form.raio_dobra_mm]);

  // Handler ao digitar no campo Nome da Peça
  const handleNomePecaChange = (novoNome) => {
    set("nome_peca", novoNome);
    const geo = interpretarGeometriaNomePeca(novoNome);
    if (geo && geo.abas && geo.abas.length >= 2) {
      setGeometriaAuto(geo);
      setAbas([...geo.abas]);
      setDobras(geo.dobras.map(d => ({
        ...d,
        raio: form.raio_dobra_mm || "1.5",
      })));
      setForm(f => ({
        ...f,
        nome_peca: novoNome,
        largura_final_mm: geo.largura_final_mm || f.largura_final_mm,
        altura_final_mm: geo.altura_final_mm || f.altura_final_mm,
      }));
      setOrigemAbas("auto");
    } else {
      setGeometriaAuto(null);
    }
  };

  // ── Query de chapas disponíveis ──
  const { data: todasChapas = [] } = useQuery({
    queryKey: ["chapas-cd-todas-dev"],
    queryFn: () => base44.entities.ChapaCD.filter({}),
    enabled: open,
    staleTime: 30000,
  });
  const chapasDisponiveis = todasChapas.filter(
    c => c.status === "disponivel" || c.status === "parcial"
  );
  const chapaVinculada = chapasDisponiveis.find(c => c.id === form.chapa_id) || null;

  // ── Query de retalhos disponíveis ──
  const { data: retalhos = [] } = useQuery({
    queryKey: ["retalhos-cd-dev"],
    queryFn: () => base44.entities.RetalhoCD.filter({ status: "disponivel" }),
    enabled: open,
    staleTime: 30000,
  });

  // Combina chapas + retalhos em um único array normalizado para o combobox
  const todasOpcoes = [
    ...chapasDisponiveis.map(c => ({
      ...c,
      _tipo: "chapa",
      bobina_descricao: c.bobina_descricao || c.material || "Chapa",
      codigo: c.codigo || "—",
    })),
    ...retalhos.map(r => ({
      ...r,
      _tipo: "retalho",
      codigo: `RT-${r.id?.slice(-4)?.toUpperCase() || "????"}`,
      bobina_descricao: r.material || "Retalho",
      quantidade_disponivel: 1,
      destino: "estoque",
    })),
  ];

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setForm({
        nome_peca: editItem.nome_peca || "",
        numero_pedido: editItem.numero_pedido || "",
        cliente: editItem.cliente || "",
        responsavel: editItem.responsavel || "",
        data_desenvolvimento: editItem.data_desenvolvimento || format(new Date(), "yyyy-MM-dd"),
        material: editItem.material || "Aço galvanizado",
        espessura_mm: editItem.espessura_mm ? String(editItem.espessura_mm) : "1.50",
        espessura_label: editItem.espessura_mm ? `${editItem.espessura_mm} mm` : "1,50 mm",
        largura_mm: editItem.largura_mm || "",
        comprimento_final_mm: editItem.comprimento_final_mm ? String(editItem.comprimento_final_mm) : "3000",
        largura_final_mm: editItem.largura_final_mm || "",
        altura_final_mm: editItem.altura_final_mm || "",
        raio_dobra_mm: editItem.raio_dobra_mm ? String(editItem.raio_dobra_mm) : "1.5",
        maquina_corte: editItem.maquina_corte || "CORTE 6M",
        maquina_dobra: editItem.maquina_dobra || "DOBRA FUNDO 6M",
        ferramental: editItem.ferramental || "",
        quantidade_peca: editItem.quantidade_peca ? String(editItem.quantidade_peca) : "1",
        sequencia_dobras: editItem.sequencia_dobras || "",
        observacoes_tecnicas: editItem.observacoes_tecnicas || "",
        chapa_id: editItem.chapa_id || "",
        chapa_codigo: editItem.chapa_codigo || "",
      });

      setModoMaterial(editItem.chapa_id ? "estoque" : "manual");

      const parsedDobras = editItem.dobras_json ? JSON.parse(editItem.dobras_json) : [];
      setDobras(parsedDobras.length ? parsedDobras : [
        { angulo: 90, raio: "1.5", descricao: "Aba 1", direcao: "cima" },
        { angulo: 90, raio: "1.5", descricao: "Aba 2", direcao: "cima" },
      ]);

      const parsedAbas = editItem.abas_json ? JSON.parse(editItem.abas_json) : [];
      setAbas(parsedAbas.length ? parsedAbas : [25, 50, 25]);

      setComprimentoManual(editItem.comprimento_desenvolvido_mm ? String(editItem.comprimento_desenvolvido_mm) : "");

      // Interpreta geometria se houver nome da peça
      if (editItem.nome_peca) {
        const geo = interpretarGeometriaNomePeca(editItem.nome_peca);
        if (geo) setGeometriaAuto(geo);
      }
    } else {
      setForm({
        nome_peca: "", numero_pedido: "", cliente: "", responsavel: "",
        data_desenvolvimento: format(new Date(), "yyyy-MM-dd"),
        material: "Aço galvanizado", espessura_mm: "1.50", espessura_label: "1,50 mm", largura_mm: "",
        comprimento_final_mm: "3000", largura_final_mm: "", altura_final_mm: "",
        raio_dobra_mm: "1.5", maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
        ferramental: "", quantidade_peca: "1", sequencia_dobras: "", observacoes_tecnicas: "",
        chapa_id: "", chapa_codigo: "",
      });
      setModoMaterial("estoque");
      setAbas([25, 50, 25]);
      setDobras([
        { angulo: 90, raio: "1.5", descricao: "Aba 1", direcao: "cima" },
        { angulo: 90, raio: "1.5", descricao: "Aba 2", direcao: "cima" },
      ]);
      setComprimentoManual("");
      setGeometriaAuto(null);
      setOrigemAbas("padrao");
    }
  }, [open, editItem]);

  // ── Ao selecionar uma chapa do estoque, auto-preenche os campos ──
  const handleSelecionarChapa = (chapaId) => {
    const chapa = todasOpcoes.find(c => c.id === chapaId);
    if (!chapa) {
      // Limpou a seleção
      setForm(f => ({ ...f, chapa_id: "", chapa_codigo: "" }));
      return;
    }
    const materialChapa =
      QUALIDADE_MATERIAL[chapa.qualidade] ||
      chapa.material ||
      "Aço galvanizado";

    const espessura = chapa.espessura_mm ? String(chapa.espessura_mm) : "";
    const espessuraLabel = chapa.espessura_mm
      ? `${String(chapa.espessura_mm).replace(".", ",")} mm`
      : "";

    setForm(f => ({
      ...f,
      chapa_id: chapa.id,
      chapa_codigo: chapa.codigo || "",
      material: materialChapa,
      espessura_mm: espessura,
      espessura_label: espessuraLabel,
      largura_mm: chapa.largura_mm ? String(chapa.largura_mm) : f.largura_mm,
      // Se comprimento não preenchido ainda, sugere comprimento da chapa
      comprimento_final_mm: f.comprimento_final_mm && f.comprimento_final_mm !== "3000"
        ? f.comprimento_final_mm
        : (chapa.comprimento_mm ? String(chapa.comprimento_mm) : "3000"),
    }));

    toast.success(`📦 Chapa ${chapa.codigo} vinculada! Material e espessura preenchidos automaticamente.`);
  };

  // ── Limpar vinculação de chapa ──
  const handleLimparChapa = () => {
    setForm(f => ({ ...f, chapa_id: "", chapa_codigo: "" }));
    toast.info("Vínculo com chapa removido.");
  };

  // ── Aplica preset de perfil ──
  const aplicarPreset = (preset) => {
    setAbas([...preset.abasPadrao]);
    setDobras(preset.dobrasPadrao.map(d => ({
      ...d,
      raio: form.raio_dobra_mm || "1.5",
    })));
    set("nome_peca", preset.nome);
    setOrigemAbas("preset");
    const geo = interpretarGeometriaNomePeca(preset.nome);
    if (geo) {
      setGeometriaAuto(geo);
    } else {
      setGeometriaAuto({
        tipo: preset.nome,
        abas: preset.abasPadrao,
        dobras: preset.dobrasPadrao,
        textoResumo: `${preset.nome}: ${preset.abasPadrao.join(" × ")} mm`
      });
    }
    toast.info(`Predefinição "${preset.nome}" aplicada com ${preset.abasPadrao.length} abas e ${preset.dobrasPadrao.length} dobra(s)!`);
  };

  // ── Gerenciamento de Abas e Dobras ──
  const handleUpdateAba = (index, valor) => {
    setAbas(prev => {
      const next = [...prev];
      next[index] = Math.max(0, Number(valor) || 0);
      return next;
    });
    setOrigemAbas("manual");
  };

  const handleAddAbaEDobra = () => {
    setAbas(prev => [...prev, 25]);
    setDobras(prev => [...prev, {
      ...DEFAULT_DOBRA,
      raio: form.raio_dobra_mm || "1.5",
      descricao: `Dobra ${prev.length + 1}`,
    }]);
    setOrigemAbas("manual");
  };

  const handleRemoveAbaEDobra = (index) => {
    if (abas.length <= 1) return;
    setAbas(prev => prev.filter((_, i) => i !== index));
    setDobras(prev => prev.filter((_, i) => i !== Math.min(index, prev.length - 1)));
    setOrigemAbas("manual");
  };

  const updateDobra = (i, key, val) => {
    setDobras(d => d.map((dobra, idx) => idx === i ? { ...dobra, [key]: val } : dobra));
    setOrigemAbas("manual");
  };

  // ── Cálculo do comprimento desenvolvido (Blank) conforme regra prática da AJL ──
  const calcComprimentoDesenvolvido = useCallback(() => {
    const esp = parseFloat(form.espessura_mm);
    if (!esp || abas.length === 0) return null;
    return calcBlankDesenvolvidoAJL(abas, dobras, esp, form.nome_peca);
  }, [form.espessura_mm, form.nome_peca, abas, dobras]);

  const comprimentoCalculado = calcComprimentoDesenvolvido();
  const comprimentoFinal = comprimentoCalculado || (comprimentoManual ? parseFloat(comprimentoManual) : null);

  // ── Handler para adotar perfil recomendado do ranking ──
  const handleAplicarPerfilDoRanking = (perfilObj) => {
    if (!perfilObj) return;
    setAbas([...perfilObj.abasPadrao]);
    setDobras(perfilObj.dobrasPadrao.map(d => ({
      ...d,
      raio: form.raio_dobra_mm || "1.5",
    })));
    set("nome_peca", perfilObj.nome);
    setOrigemAbas("ranking");
    const geo = interpretarGeometriaNomePeca(perfilObj.nome);
    if (geo) {
      setGeometriaAuto(geo);
    } else {
      setGeometriaAuto({
        tipo: perfilObj.nome,
        abas: perfilObj.abasPadrao,
        dobras: perfilObj.dobrasPadrao,
        textoResumo: `${perfilObj.nome}: ${perfilObj.abasPadrao.join(" × ")} mm`
      });
    }
    toast.success(`⚡ Perfil "${perfilObj.nome}" adotado! ${perfilObj.qtdBlanks} peças por chapa (${perfilObj.aproveitamentoPerc}% de rendimento).`);
  };

  // ── Análise de compatibilidade com a chapa selecionada ──
  const alertasChapa = [];
  if (chapaVinculada) {
    const compPeca = parseFloat(form.comprimento_final_mm) || 0;
    const compChapa = chapaVinculada.comprimento_mm || 0;
    if (compPeca > compChapa) {
      alertasChapa.push({
        tipo: "erro",
        msg: `⚠️ Comprimento da peça (${compPeca} mm) excede o comprimento da chapa (${compChapa} mm)!`,
      });
    }
  }

  const handleSave = (status = "rascunho") => {
    if (!form.nome_peca) { alert("Informe o nome da peça."); return; }
    if (!form.espessura_mm) { alert("Informe a espessura."); return; }
    const comp = comprimentoFinal || parseFloat(comprimentoManual);

    onSave({
      ...form,
      espessura_mm: parseFloat(form.espessura_mm),
      largura_mm: form.largura_mm ? parseFloat(form.largura_mm) : undefined,
      comprimento_desenvolvido_mm: comp || undefined,
      comprimento_final_mm: form.comprimento_final_mm ? parseFloat(form.comprimento_final_mm) : undefined,
      largura_final_mm: form.largura_final_mm ? parseFloat(form.largura_final_mm) : undefined,
      altura_final_mm: form.altura_final_mm ? parseFloat(form.altura_final_mm) : undefined,
      raio_dobra_mm: form.raio_dobra_mm ? parseFloat(form.raio_dobra_mm) : undefined,
      numero_dobras: dobras.length || undefined,
      angulo_dobras: dobras.map(d => `${d.angulo}°`).join(", ") || undefined,
      dobras_json: dobras.length ? JSON.stringify(dobras) : undefined,
      abas_json: abas.length ? JSON.stringify(abas) : undefined,
      quantidade_peca: form.quantidade_peca ? parseFloat(form.quantidade_peca) : undefined,
      chapa_id: form.chapa_id || undefined,
      chapa_codigo: form.chapa_codigo || undefined,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calculator className="w-6 h-6 text-orange-500" />
            {editItem ? "Editar Desenvolvimento de Peça" : "Novo Desenvolvimento de Peça"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Planificação técnica prática (Regra AJL), croqui 2D interativo e parâmetros de dobra antes da emissão da OP.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── IDENTIFICAÇÃO BÁSICA ── */}
          <Section title="1. Identificação & Pedido">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Nome da Peça *</Label>
                  {geometriaAuto && (
                    <button
                      type="button"
                      onClick={() => aplicarGeometriaNome(form.nome_peca, { force: true, notify: true })}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline cursor-pointer"
                      title="Forçar reaplicação das medidas do nome no croqui"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      Redesenhar do nome
                    </button>
                  )}
                </div>
                <Input
                  placeholder="Ex: Perfil U 40x75x40, Perfil C 150x50x17, Cantoneira 50x50..."
                  value={form.nome_peca}
                  onChange={e => handleNomePecaChange(e.target.value)}
                  className={geometriaAuto ? "border-emerald-500/70 focus-visible:ring-emerald-500 font-medium bg-emerald-50/20" : ""}
                />
                {geometriaAuto && (
                  <div className="mt-1 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="p-0.5 bg-emerald-500 text-white rounded">
                        <Sparkles className="w-3 h-3" />
                      </span>
                      <span className="font-bold">{geometriaAuto.tipo}:</span>
                      <span className="font-mono font-bold bg-white/90 dark:bg-black/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200">
                        {geometriaAuto.abas.join(" × ")} mm
                      </span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        ({geometriaAuto.dobras.length} dobra{geometriaAuto.dobras.length > 1 ? "s" : ""} 90°)
                      </span>
                    </div>
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-0 h-5">
                      Desenho Automático ✨
                    </Badge>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº do Pedido</Label>
                <Input placeholder="Ex: 12345" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Responsável Técnico</Label>
                <Input placeholder="Nome do responsável" value={form.responsavel} onChange={e => set("responsavel", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={form.data_desenvolvimento} onChange={e => set("data_desenvolvimento", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qtd. de Peças</Label>
                <Input type="number" placeholder="1" value={form.quantidade_peca} onChange={e => set("quantidade_peca", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Comprimento da Peça (mm) *</Label>
                <Input type="number" placeholder="3000" value={form.comprimento_final_mm} onChange={e => set("comprimento_final_mm", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* ── MATERIAL & ESPESSURA ── */}
          <Section title="2. Material & Matéria-Prima">

            {/* Toggle: Estoque vs Manual */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setModoMaterial("estoque")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  modoMaterial === "estoque"
                    ? "bg-orange-500 text-white border-orange-500 shadow"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                }`}
              >
                <Package className="w-4 h-4" />
                📦 Chapa do Estoque (Chão)
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoMaterial("manual");
                  handleLimparChapa();
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  modoMaterial === "manual"
                    ? "bg-slate-600 text-white border-slate-600 shadow"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/40"
                }`}
              >
                <Compass className="w-4 h-4" />
                ✏️ Manual / Simulação
              </button>
              {modoMaterial === "estoque" && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {chapasDisponiveis.length} chapa(s) + {retalhos.length} retalho(s) disponíveis
                </span>
              )}
            </div>

            {/* Modo: Estoque → Seletor de Chapa do Chão */}
            {modoMaterial === "estoque" && (
              <div className="space-y-3">
                {/* Combobox de chapas */}
                {!chapaVinculada ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-orange-500" />
                      Selecionar Chapa / Retalho do Estoque
                    </Label>
                    <ChapaEstoqueCombobox
                      chapas={todasOpcoes}
                      value={form.chapa_id}
                      onChange={handleSelecionarChapa}
                      numeroPedido={form.numero_pedido}
                      placeholder="🔍 Pesquisar por código, espessura, material, qualidade..."
                    />
                    {todasOpcoes.length === 0 && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ Nenhuma chapa disponível no estoque da Chaparia. Cadastre chapas primeiro ou use o modo Manual.
                      </p>
                    )}
                  </div>
                ) : (
                  /* Card da chapa vinculada */
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500 text-white rounded-lg">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                            Chapa vinculada ao desenvolvimento
                          </p>
                          <p className="text-lg font-black text-emerald-800 font-mono">
                            {chapaVinculada.codigo || "—"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleLimparChapa}
                        className="text-emerald-500 hover:text-red-500 transition-colors p-1 rounded"
                        title="Remover vínculo com chapa"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {chapaVinculada.espessura_mm && (
                        <Badge className="bg-emerald-600 text-white">
                          {chapaVinculada.espessura_mm} mm
                        </Badge>
                      )}
                      {chapaVinculada.qualidade && (
                        <Badge variant="outline" className="border-emerald-400 text-emerald-700">
                          {chapaVinculada.qualidade}
                        </Badge>
                      )}
                      {chapaVinculada.comprimento_mm && chapaVinculada.largura_mm && (
                        <Badge variant="outline" className="border-emerald-400 text-emerald-700 font-mono">
                          {chapaVinculada.comprimento_mm} × {chapaVinculada.largura_mm} mm
                        </Badge>
                      )}
                      {chapaVinculada.quantidade_disponivel != null && (
                        <Badge variant="outline" className="border-emerald-400 text-emerald-700">
                          📦 {chapaVinculada.quantidade_disponivel} pç disponível
                        </Badge>
                      )}
                      {chapaVinculada.material && (
                        <Badge variant="outline" className="border-slate-300 text-slate-600">
                          {chapaVinculada.material}
                        </Badge>
                      )}
                    </div>

                    {/* Alertas de compatibilidade */}
                    {alertasChapa.map((alerta, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-3 py-2 text-xs font-medium ${
                          alerta.tipo === "erro"
                            ? "bg-red-100 text-red-700 border border-red-300"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {alerta.msg}
                      </div>
                    ))}

                    {/* ── OTIMIZADOR DE CORTE & RANKING INDUSTRIAL AJL ── */}
                    <div className="pt-2">
                      <PainelAproveitamentoInteligente
                        chapa={chapaVinculada}
                        blankAtual={comprimentoCalculado || comprimentoFinal}
                        nomePecaAtual={form.nome_peca}
                        onAplicarPerfil={handleAplicarPerfilDoRanking}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleLimparChapa}
                      className="text-xs text-emerald-600 hover:text-red-500 underline underline-offset-2 pt-1"
                    >
                      Trocar / Remover chapa
                    </button>
                  </div>
                )}

                {/* Campos auto-preenchidos (somente leitura quando vinculado) — editáveis quando não vinculado */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Material *
                      {chapaVinculada && <span className="ml-1 text-emerald-600 text-[10px]">↑ da chapa</span>}
                    </Label>
                    <Select
                      value={form.material}
                      onValueChange={v => set("material", v)}
                      disabled={!!chapaVinculada}
                    >
                      <SelectTrigger className={chapaVinculada ? "bg-emerald-50 border-emerald-300" : ""}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAIS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Espessura da Chapa *
                      {chapaVinculada && <span className="ml-1 text-emerald-600 text-[10px]">↑ da chapa</span>}
                    </Label>
                    {chapaVinculada ? (
                      <div className="h-9 rounded-md border border-emerald-300 bg-emerald-50 px-3 flex items-center text-sm font-bold text-emerald-800">
                        {chapaVinculada.espessura_mm} mm
                      </div>
                    ) : (
                      <EspessuraSelect
                        value={form.espessura_label || (form.espessura_mm ? String(form.espessura_mm) : "")}
                        onChange={(label, valor) => {
                          setForm(f => ({ ...f, espessura_mm: valor, espessura_label: label }));
                        }}
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Largura do Blank (Corte)</Label>
                    <div className="h-9 rounded-md border border-emerald-300 bg-emerald-50 px-3 flex items-center justify-between text-sm font-black text-emerald-800 font-mono">
                      <span>{comprimentoCalculado ? `${comprimentoCalculado} mm` : "—"}</span>
                      <Badge className="bg-emerald-600 text-white text-[10px] font-bold py-0 h-5">Padrão AJL</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modo: Manual → campos diretos sem vinculação */}
            {modoMaterial === "manual" && (
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Modo simulação: material e espessura serão digitados manualmente sem vínculo com o estoque físico.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Material *</Label>
                    <Select value={form.material} onValueChange={v => set("material", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {MATERIAIS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Espessura da Chapa *</Label>
                    <EspessuraSelect
                      value={form.espessura_label || (form.espessura_mm ? String(form.espessura_mm) : "")}
                      onChange={(label, valor) => {
                        setForm(f => ({ ...f, espessura_mm: valor, espessura_label: label }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Largura do Blank (Corte)</Label>
                    <div className="h-9 rounded-md border border-slate-300 bg-slate-50 px-3 flex items-center justify-between text-sm font-black text-slate-800 font-mono">
                      <span>{comprimentoCalculado ? `${comprimentoCalculado} mm` : "—"}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Cálculo Prático</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* ── PRESETS RÁPIDOS & CROQUI 2D ── */}
          <Section title="3. Geometria, Abas & Perfil (Croqui 2D)">
            {/* Botões de Predefinições Rápidas */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>Predefinições de perfis industriais comuns:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS_PERFIL.map(p => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => aplicarPreset(p)}
                    className="text-xs h-7 gap-1 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-300"
                  >
                    <Layers className="w-3 h-3 text-orange-500" />
                    {p.nome}
                  </Button>
                ))}
              </div>
            </div>

            {/* Banner de Sincronismo da Geometria do Nome com o Croqui */}
            {geometriaAuto && (
              <div className="flex items-center justify-between text-xs bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 mb-3 shadow-sm flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Croqui Sincronizado:
                  </span>
                  <span className="font-bold text-white">{geometriaAuto.tipo}</span>
                  <span className="font-mono bg-slate-800 border border-slate-600 px-2 py-0.5 rounded text-emerald-300 font-bold">
                    {abas.join(" × ")} mm
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    ({dobras.length} dobra{dobras.length > 1 ? "s" : ""} 90°)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {origemAbas === "manual" ? (
                    <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-300 text-[10px] font-semibold">
                      ✏️ Ajuste manual pelo operador
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      100% Automático do Nome
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => aplicarGeometriaNome(form.nome_peca, { force: true, notify: true })}
                    className="text-[11px] text-slate-400 hover:text-emerald-300 underline ml-1 cursor-pointer"
                    title="Redefinir abas para o padrão do nome da peça"
                  >
                    Redefinir
                  </button>
                </div>
              </div>
            )}

            {/* Visualizador Croqui 2D Interativo com Especialista em Dobra */}
            <CroquiPeca2D
              abas={abas}
              dobras={dobras}
              espessura_mm={parseFloat(form.espessura_mm) || 1.5}
              nomePeca={form.nome_peca}
              larguraPlanificada={comprimentoFinal || 100}
              comprimento_mm={parseFloat(form.comprimento_final_mm) || 3000}
              material={form.material}
              maquinaNome={form.maquina_dobra}
              onUpdateAba={handleUpdateAba}
              className="mb-4"
            />

            {/* Editor de Abas e Dobras */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Coluna 1: Medidas das Abas */}
              <div className="border border-border rounded-xl p-3.5 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-foreground">Medidas das Abas (mm)</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddAbaEDobra}
                    className="h-7 text-xs gap-1 border-orange-200 text-orange-700"
                  >
                    <Plus className="w-3 h-3" /> + Aba / Dobra
                  </Button>
                </div>

                <div className="space-y-2">
                  {abas.map((aba, i) => (
                    <div key={i} className="flex items-center gap-2 bg-background p-2 rounded-lg border border-border">
                      <span className="text-xs font-bold text-orange-600 w-14">Aba {i + 1}:</span>
                      <Input
                        type="number"
                        value={aba}
                        onChange={e => handleUpdateAba(i, e.target.value)}
                        className="h-8 text-sm font-bold font-mono"
                        placeholder="Ex: 50"
                      />
                      <span className="text-xs text-muted-foreground">mm</span>
                      {abas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAbaEDobra(i)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Remover aba"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground flex justify-between border-t border-border/60 pt-2">
                  <span>Soma bruta das abas:</span>
                  <strong className="text-foreground">
                    {abas.reduce((a, b) => a + (Number(b) || 0), 0)} mm
                  </strong>
                </div>
              </div>

              {/* Coluna 2: Ângulos e Parâmetros das Dobras */}
              <div className="border border-border rounded-xl p-3.5 bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-foreground">Parâmetros das Dobras</span>
                  <Badge variant="outline" className="text-[10px]">
                    {dobras.length} dobra(s)
                  </Badge>
                </div>

                <div className="space-y-2">
                  {dobras.map((d, i) => (
                    <div key={i} className="bg-background p-2 rounded-lg border border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-orange-600">Dobra {i + 1}</span>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-muted-foreground">Sentido:</label>
                          <select
                            value={d.direcao || "cima"}
                            onChange={e => updateDobra(i, "direcao", e.target.value)}
                            className="text-xs bg-muted rounded border border-border px-1.5 py-0.5"
                          >
                            <option value="cima">Para Cima</option>
                            <option value="baixo">Para Baixo</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Ângulo (°)</Label>
                          <Input
                            type="number"
                            value={d.angulo}
                            onChange={e => updateDobra(i, "angulo", e.target.value)}
                            className="h-7 text-xs font-bold"
                            placeholder="90"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Descrição</Label>
                          <Input
                            value={d.descricao || ""}
                            onChange={e => updateDobra(i, "descricao", e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Ex: Aba lateral"
                          />
                        </div>
                      </div>

                      {/* Bend Deduction para esta dobra pela regra prática da AJL */}
                      {form.espessura_mm && (
                        <div className="text-[10px] text-muted-foreground flex justify-between pt-1">
                          <span>Dedução de Dobra (BD):</span>
                          <strong className="text-blue-600">
                            -{calcDeducaoDobraAJL(Number(d.angulo) || 90, Number(form.espessura_mm)).toFixed(2)} mm
                          </strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultado da Planificação */}
            {comprimentoCalculado && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500 text-white rounded-lg">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">
                      Largura Desenvolvida do Blank (Corte da Guilhotina)
                    </p>
                    <p className="text-2xl font-black text-emerald-700 font-mono">
                      {comprimentoCalculado} mm
                    </p>
                    <p className="text-xs text-emerald-600">
                      Dimensões da chapa a cortar: <strong>{comprimentoCalculado} mm × {form.comprimento_final_mm || 3000} mm</strong>
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-600 text-white text-xs">
                  Regra Fabril AJL (Sem Fator K)
                </Badge>
              </div>
            )}
          </Section>

          {/* ── MÁQUINAS, MATRIZ V & TONELAGEM ── */}
          <Section title="4. Máquinas, Matriz V & Tonelagem">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="space-y-1">
                <Label className="text-xs">Máquina de Corte</Label>
                <Select value={form.maquina_corte} onValueChange={v => set("maquina_corte", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORTE 3M">Guilhotina 3m</SelectItem>
                    <SelectItem value="CORTE 6M">Guilhotina 6m</SelectItem>
                    <SelectItem value="Laser">Corte a Laser</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Máquina de Dobra</Label>
                <Select value={form.maquina_dobra} onValueChange={v => set("maquina_dobra", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOBRA 3M">Dobradeira 3m</SelectItem>
                    <SelectItem value="DOBRA FUNDO 6M">Dobradeira Fundo 6m</SelectItem>
                    <SelectItem value="DOBRA INICIO 6M">Dobradeira Início 6m</SelectItem>
                    <SelectItem value="PERFILADEIRA">Perfiladeira</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Calculadora de Tonelagem e Matriz V */}
            <CalculadoraForcaDobra
              espessura_mm={parseFloat(form.espessura_mm) || 1.5}
              comprimento_mm={parseFloat(form.comprimento_final_mm) || 3000}
              material={form.material}
              maquinaSelecionada={form.maquina_dobra}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">Ferramental Necessário</Label>
                <Input
                  placeholder="Ex: Matriz V16, Punção agudo 30°..."
                  value={form.ferramental}
                  onChange={e => set("ferramental", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sequência de Dobras Sugerida</Label>
                <Input
                  placeholder="Ex: D1 → D2 → D3 (virar chapa)"
                  value={form.sequencia_dobras}
                  onChange={e => set("sequencia_dobras", e.target.value)}
                />
              </div>
            </div>
          </Section>

          {/* ── OBSERVAÇÕES ── */}
          <Section title="5. Observações Técnicas">
            <Textarea
              placeholder="Instruções para o operador da dobradeira, tolerâncias, cuidados de acabamento..."
              value={form.observacoes_tecnicas}
              onChange={e => set("observacoes_tecnicas", e.target.value)}
              rows={2}
            />
          </Section>
        </div>

        <DialogFooter className="gap-2 flex-wrap border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" onClick={() => handleSave("rascunho")} className="border-slate-300">
            Salvar como Rascunho
          </Button>
          <Button onClick={() => handleSave("aprovado")} className="bg-orange-500 hover:bg-orange-600 font-bold">
            ✓ Salvar & Aprovar Desenvolvimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  );
}