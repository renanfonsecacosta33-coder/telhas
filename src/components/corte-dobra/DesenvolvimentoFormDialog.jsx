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
  Wrench, Layers, Sparkles, Compass
} from "lucide-react";
import { toast } from "sonner";
import EspessuraSelect from "./EspessuraSelect";
import CroquiPeca2D, { PRESETS_PERFIL } from "./CroquiPeca2D";
import CalculadoraForcaDobra from "./CalculadoraForcaDobra";

// ─── Fórmulas de planificação ───────────────────────────────────────────────
// BA (Bend Allowance) = (π/180) × ângulo × (raio + fatorK × espessura)
function calcBA(angulo, raio, espessura, fatorK) {
  return (Math.PI / 180) * angulo * (raio + fatorK * espessura);
}

// BD (Bend Deduction) = 2 × (raio + espessura) × tan(ang/2) − BA
function calcBD(angulo, raio, espessura, fatorK) {
  const ba = calcBA(angulo, raio, espessura, fatorK);
  const outside = 2 * (raio + espessura) * Math.tan((angulo / 2) * (Math.PI / 180));
  return outside - ba;
}

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
    fator_k: "0.33",
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
  });

  const [abas, setAbas] = useState([25, 50, 25]);
  const [dobras, setDobras] = useState([
    { angulo: 90, raio: "1.5", descricao: "Aba 1", direcao: "cima" },
    { angulo: 90, raio: "1.5", descricao: "Aba 2", direcao: "cima" },
  ]);
  const [comprimentoManual, setComprimentoManual] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
        fator_k: editItem.fator_k ? String(editItem.fator_k) : "0.33",
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
      });

      const parsedDobras = editItem.dobras_json ? JSON.parse(editItem.dobras_json) : [];
      setDobras(parsedDobras.length ? parsedDobras : [
        { angulo: 90, raio: "1.5", descricao: "Aba 1", direcao: "cima" },
        { angulo: 90, raio: "1.5", descricao: "Aba 2", direcao: "cima" },
      ]);

      const parsedAbas = editItem.abas_json ? JSON.parse(editItem.abas_json) : [];
      setAbas(parsedAbas.length ? parsedAbas : [25, 50, 25]);

      setComprimentoManual(editItem.comprimento_desenvolvido_mm ? String(editItem.comprimento_desenvolvido_mm) : "");
    } else {
      setForm({
        nome_peca: "", numero_pedido: "", cliente: "", responsavel: "",
        data_desenvolvimento: format(new Date(), "yyyy-MM-dd"),
        material: "Aço galvanizado", espessura_mm: "1.50", espessura_label: "1,50 mm", largura_mm: "", fator_k: "0.33",
        comprimento_final_mm: "3000", largura_final_mm: "", altura_final_mm: "",
        raio_dobra_mm: "1.5", maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
        ferramental: "", quantidade_peca: "1", sequencia_dobras: "", observacoes_tecnicas: "",
      });
      setAbas([25, 50, 25]);
      setDobras([
        { angulo: 90, raio: "1.5", descricao: "Aba 1", direcao: "cima" },
        { angulo: 90, raio: "1.5", descricao: "Aba 2", direcao: "cima" },
      ]);
      setComprimentoManual("");
    }
  }, [open, editItem]);

  // ── Aplica preset de perfil ──
  const aplicarPreset = (preset) => {
    setAbas([...preset.abasPadrao]);
    setDobras(preset.dobrasPadrao.map(d => ({
      ...d,
      raio: form.raio_dobra_mm || "1.5",
    })));
    set("nome_peca", preset.nome);
    toast.info(`Predefinição "${preset.nome}" aplicada com ${preset.abasPadrao.length} abas e ${preset.dobrasPadrao.length} dobra(s)!`);
  };

  // ── Gerenciamento de Abas e Dobras ──
  const handleUpdateAba = (index, valor) => {
    setAbas(prev => {
      const next = [...prev];
      next[index] = Math.max(0, Number(valor) || 0);
      return next;
    });
  };

  const handleAddAbaEDobra = () => {
    setAbas(prev => [...prev, 25]);
    setDobras(prev => [...prev, {
      ...DEFAULT_DOBRA,
      raio: form.raio_dobra_mm || "1.5",
      descricao: `Dobra ${prev.length + 1}`,
    }]);
  };

  const handleRemoveAbaEDobra = (index) => {
    if (abas.length <= 1) return;
    setAbas(prev => prev.filter((_, i) => i !== index));
    setDobras(prev => prev.filter((_, i) => i !== Math.min(index, prev.length - 1)));
  };

  const updateDobra = (i, key, val) => {
    setDobras(d => d.map((dobra, idx) => idx === i ? { ...dobra, [key]: val } : dobra));
  };

  // ── Cálculo do comprimento desenvolvido (Blank) ──
  const calcComprimentoDesenvolvido = useCallback(() => {
    const esp = parseFloat(form.espessura_mm);
    const fk = parseFloat(form.fator_k);
    if (!esp || !fk || abas.length === 0) return null;

    const somaAbas = abas.reduce((acc, a) => acc + (Number(a) || 0), 0);
    let totalBD = 0;

    for (const d of dobras) {
      const ang = parseFloat(d.angulo) || 90;
      const r = parseFloat(d.raio || form.raio_dobra_mm) || esp;
      totalBD += calcBD(ang, r, esp, fk);
    }

    const desenvolvido = Math.round(somaAbas - totalBD);
    return desenvolvido > 0 ? desenvolvido : somaAbas;
  }, [form.espessura_mm, form.fator_k, form.raio_dobra_mm, abas, dobras]);

  const comprimentoCalculado = calcComprimentoDesenvolvido();
  const comprimentoFinal = comprimentoCalculado || (comprimentoManual ? parseFloat(comprimentoManual) : null);

  const handleSave = (status = "rascunho") => {
    if (!form.nome_peca) { alert("Informe o nome da peça."); return; }
    if (!form.espessura_mm) { alert("Informe a espessura."); return; }
    const comp = comprimentoFinal || parseFloat(comprimentoManual);

    onSave({
      ...form,
      espessura_mm: parseFloat(form.espessura_mm),
      largura_mm: form.largura_mm ? parseFloat(form.largura_mm) : undefined,
      fator_k: parseFloat(form.fator_k),
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
            Planificação técnica, Fator K, croqui 2D interativo e parâmetros de dobra antes da emissão da OP.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── IDENTIFICAÇÃO BÁSICA ── */}
          <Section title="1. Identificação & Pedido">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Nome da Peça *</Label>
                <Input
                  placeholder="Ex: Perfil U 50x25x25, Rufo Pingadeira 3m..."
                  value={form.nome_peca}
                  onChange={e => set("nome_peca", e.target.value)}
                />
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
                <Label className="text-xs">Fator K</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="0.5"
                  placeholder="0.33"
                  value={form.fator_k}
                  onChange={e => set("fator_k", e.target.value)}
                />
              </div>
            </div>
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

                      {/* Bend Deduction para esta dobra */}
                      {form.espessura_mm && (
                        <div className="text-[10px] text-muted-foreground flex justify-between pt-1">
                          <span>Dedução de Dobra (BD):</span>
                          <strong className="text-blue-600">
                            -{calcBD(Number(d.angulo) || 90, Number(d.raio || form.raio_dobra_mm) || 1.5, Number(form.espessura_mm), Number(form.fator_k)).toFixed(2)} mm
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
                  Fator K = {form.fator_k} aplicado
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