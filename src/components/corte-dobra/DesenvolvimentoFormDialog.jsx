import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calculator, Plus, Trash2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import EspessuraSelect from "./EspessuraSelect";

// ─── Fórmulas de planificação ───────────────────────────────────────────────
// Comprimento do arco neutro de uma dobra
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

const DEFAULT_DOBRA = { angulo: 90, raio: "", descricao: "" };

export default function DesenvolvimentoFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState({
    nome_peca: "",
    numero_pedido: "",
    cliente: "",
    responsavel: "",
    data_desenvolvimento: format(new Date(), "yyyy-MM-dd"),
    material: "",
    espessura_mm: "",
    espessura_label: "",
    largura_mm: "",
    fator_k: "0.33",
    comprimento_final_mm: "",
    largura_final_mm: "",
    altura_final_mm: "",
    raio_dobra_mm: "",
    maquina_corte: "",
    maquina_dobra: "",
    ferramental: "",
    quantidade_peca: "",
    sequencia_dobras: "",
    observacoes_tecnicas: "",
  });
  const [dobras, setDobras] = useState([]);
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
        material: editItem.material || "",
        espessura_mm: editItem.espessura_mm || "",
        espessura_label: editItem.espessura_mm ? String(editItem.espessura_mm) : "",
        largura_mm: editItem.largura_mm || "",
        fator_k: editItem.fator_k || "0.33",
        comprimento_final_mm: editItem.comprimento_final_mm || "",
        largura_final_mm: editItem.largura_final_mm || "",
        altura_final_mm: editItem.altura_final_mm || "",
        raio_dobra_mm: editItem.raio_dobra_mm || "",
        maquina_corte: editItem.maquina_corte || "",
        maquina_dobra: editItem.maquina_dobra || "",
        ferramental: editItem.ferramental || "",
        quantidade_peca: editItem.quantidade_peca || "",
        sequencia_dobras: editItem.sequencia_dobras || "",
        observacoes_tecnicas: editItem.observacoes_tecnicas || "",
      });
      const parsed = editItem.dobras_json ? JSON.parse(editItem.dobras_json) : [];
      setDobras(parsed);
      setComprimentoManual(editItem.comprimento_desenvolvido_mm || "");
    } else {
      setForm({
        nome_peca: "", numero_pedido: "", cliente: "", responsavel: "",
        data_desenvolvimento: format(new Date(), "yyyy-MM-dd"),
        material: "", espessura_mm: "", espessura_label: "", largura_mm: "", fator_k: "0.33",
        comprimento_final_mm: "", largura_final_mm: "", altura_final_mm: "",
        raio_dobra_mm: "", maquina_corte: "", maquina_dobra: "",
        ferramental: "", quantidade_peca: "", sequencia_dobras: "", observacoes_tecnicas: "",
      });
      setDobras([]);
      setComprimentoManual("");
    }
  }, [open, editItem]);

  // ── Cálculo automático do comprimento desenvolvido ──
  const calcComprimentoDesenvolvido = useCallback(() => {
    const esp = parseFloat(form.espessura_mm);
    const fk = parseFloat(form.fator_k);
    const compFinal = parseFloat(form.comprimento_final_mm);
    if (!esp || !fk || !compFinal || dobras.length === 0) return null;

    let totalBD = 0;
    for (const d of dobras) {
      const ang = parseFloat(d.angulo);
      const r = parseFloat(d.raio || form.raio_dobra_mm);
      if (!ang || !r) return null;
      totalBD += calcBD(ang, r, esp, fk);
    }
    return Math.round(compFinal + totalBD);
  }, [form.espessura_mm, form.fator_k, form.comprimento_final_mm, form.raio_dobra_mm, dobras]);

  const comprimentoCalculado = calcComprimentoDesenvolvido();
  const comprimentoFinal = comprimentoCalculado || (comprimentoManual ? parseFloat(comprimentoManual) : null);

  const addDobra = () => setDobras(d => [...d, { ...DEFAULT_DOBRA, raio: form.raio_dobra_mm || "" }]);
  const removeDobra = (i) => setDobras(d => d.filter((_, idx) => idx !== i));
  const updateDobra = (i, key, val) => setDobras(d => d.map((dobra, idx) => idx === i ? { ...dobra, [key]: val } : dobra));

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
      quantidade_peca: form.quantidade_peca ? parseFloat(form.quantidade_peca) : undefined,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calculator className="w-5 h-5 text-orange-500" />
            {editItem ? "Editar Desenvolvimento" : "Novo Desenvolvimento de Peça"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Defina a planificação, dobras e parâmetros técnicos antes de emitir as OPs de corte e dobra.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── IDENTIFICAÇÃO ── */}
          <Section title="Identificação">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Nome da Peça *</Label>
                <Input placeholder="Ex: Perfil Peitoral 3m, Caixa Elétrica, Suporte L..." value={form.nome_peca} onChange={e => set("nome_peca", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Nº do Pedido</Label>
                <Input placeholder="Ex: 12345" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Responsável Técnico</Label>
                <Input placeholder="Nome do responsável" value={form.responsavel} onChange={e => set("responsavel", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={form.data_desenvolvimento} onChange={e => set("data_desenvolvimento", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Quantidade de Peças</Label>
                <Input type="number" placeholder="0" value={form.quantidade_peca} onChange={e => set("quantidade_peca", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* ── MATERIAL ── */}
          <Section title="Material">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Material *</Label>
                <Select value={form.material} onValueChange={v => set("material", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {MATERIAIS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Espessura / Material *</Label>
                <EspessuraSelect
                  value={form.espessura_label || (form.espessura_mm ? String(form.espessura_mm) : "")}
                  onChange={(label, valor) => {
                    setForm(f => ({ ...f, espessura_mm: valor, espessura_label: label }));
                  }}
                />
                {form.espessura_mm && (
                  <p className="text-[10px] text-muted-foreground">Valor: {form.espessura_mm} mm</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Largura da Bobina (mm)</Label>
                <Input type="number" placeholder="Ex: 1000" value={form.largura_mm} onChange={e => set("largura_mm", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* ── DIMENSÕES FINAIS ── */}
          <Section title="Dimensões Finais da Peça (após dobrar)">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Comprimento (mm)</Label>
                <Input type="number" placeholder="C" value={form.comprimento_final_mm} onChange={e => set("comprimento_final_mm", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Largura (mm)</Label>
                <Input type="number" placeholder="L" value={form.largura_final_mm} onChange={e => set("largura_final_mm", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Altura (mm)</Label>
                <Input type="number" placeholder="H" value={form.altura_final_mm} onChange={e => set("altura_final_mm", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* ── PLANIFICAÇÃO / FATOR K ── */}
          <Section title="Planificação — Cálculo do Comprimento Desenvolvido">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>Fator K</strong> representa a posição da linha neutra na espessura da chapa.
                Valores típicos: <strong>0.33</strong> (dobras apertadas), <strong>0.40</strong> (padrão), <strong>0.50</strong> (raio grande).
                O comprimento desenvolvido é calculado somando os segmentos retos com o <em>Bend Allowance (BA)</em> de cada dobra.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="space-y-1">
                <Label>Fator K</Label>
                <Input type="number" step="0.01" min="0.1" max="0.5" placeholder="0.33" value={form.fator_k} onChange={e => set("fator_k", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Raio Interno Padrão (mm)</Label>
                <Input type="number" step="0.1" placeholder="Ex: 1.5" value={form.raio_dobra_mm} onChange={e => set("raio_dobra_mm", e.target.value)} />
              </div>
            </div>

            {/* Dobras */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between">
                <Label>Dobras</Label>
                <Button type="button" size="sm" variant="outline" onClick={addDobra} className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> Adicionar Dobra
                </Button>
              </div>
              {dobras.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-3 border border-dashed rounded-lg">
                  Nenhuma dobra adicionada. Clique em "Adicionar Dobra" ou informe o comprimento desenvolvido manualmente.
                </p>
              )}
              {dobras.map((d, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-muted/30 rounded-lg p-2">
                  <span className="col-span-1 text-xs font-bold text-muted-foreground text-center">D{i + 1}</span>
                  <div className="col-span-3 space-y-0.5">
                    <Label className="text-[10px]">Ângulo (°)</Label>
                    <Input type="number" placeholder="90" value={d.angulo} onChange={e => updateDobra(i, "angulo", e.target.value)} className="h-7 text-sm" />
                  </div>
                  <div className="col-span-3 space-y-0.5">
                    <Label className="text-[10px]">Raio (mm)</Label>
                    <Input type="number" placeholder={form.raio_dobra_mm || "—"} value={d.raio} onChange={e => updateDobra(i, "raio", e.target.value)} className="h-7 text-sm" />
                  </div>
                  <div className="col-span-4 space-y-0.5">
                    <Label className="text-[10px]">Descrição</Label>
                    <Input placeholder="Ex: Aba sup." value={d.descricao} onChange={e => updateDobra(i, "descricao", e.target.value)} className="h-7 text-sm" />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button type="button" onClick={() => removeDobra(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* BA calculado para essa dobra */}
                  {form.espessura_mm && form.fator_k && d.angulo && (d.raio || form.raio_dobra_mm) && (
                    <div className="col-span-12 text-xs text-muted-foreground pl-6 -mt-1">
                      BA = <strong className="text-orange-600">{calcBA(parseFloat(d.angulo), parseFloat(d.raio || form.raio_dobra_mm), parseFloat(form.espessura_mm), parseFloat(form.fator_k)).toFixed(2)} mm</strong>
                      {" "}· BD = <strong className="text-blue-600">{calcBD(parseFloat(d.angulo), parseFloat(d.raio || form.raio_dobra_mm), parseFloat(form.espessura_mm), parseFloat(form.fator_k)).toFixed(2)} mm</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Resultado */}
            {comprimentoCalculado ? (
              <div className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-center gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs text-green-700 font-medium">Comprimento Desenvolvido (Planificação)</p>
                  <p className="text-2xl font-black text-green-700">{comprimentoCalculado} mm</p>
                  <p className="text-xs text-green-600">= {(comprimentoCalculado / 1000).toFixed(3)} m · Calculado via Fator K = {form.fator_k}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Comprimento Desenvolvido Manual (mm)</Label>
                <Input type="number" placeholder="Informe manualmente se não usar a calculadora"
                  value={comprimentoManual} onChange={e => setComprimentoManual(e.target.value)} />
                {!form.comprimento_final_mm && !comprimentoManual && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    Informe o comprimento final ou o valor manual para calcular a planificação.
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ── MÁQUINAS ── */}
          <Section title="Máquinas e Ferramental">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Máquina de Corte</Label>
                <Select value={form.maquina_corte} onValueChange={v => set("maquina_corte", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORTE 3M">Guilhotina 3m</SelectItem>
                    <SelectItem value="CORTE 6M">Guilhotina 6m</SelectItem>
                    <SelectItem value="Laser">Laser</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Máquina de Dobra</Label>
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
              <div className="space-y-1 col-span-2">
                <Label>Ferramental / Estampos Necessários</Label>
                <Input placeholder="Ex: Punção 90°, Matriz em V, Estampo especial..." value={form.ferramental} onChange={e => set("ferramental", e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Sequência de Dobras Recomendada</Label>
                <Input placeholder="Ex: D1 → D3 → D2 → D4 (evitar colisão na 2ª dobra)" value={form.sequencia_dobras} onChange={e => set("sequencia_dobras", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* ── OBSERVAÇÕES ── */}
          <Section title="Observações Técnicas">
            <Textarea placeholder="Tolerâncias, acabamento superficial, pontos críticos, instruções especiais..."
              value={form.observacoes_tecnicas} onChange={e => set("observacoes_tecnicas", e.target.value)} rows={3} />
          </Section>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="outline" onClick={() => handleSave("rascunho")} className="border-slate-300">
            Salvar Rascunho
          </Button>
          <Button onClick={() => handleSave("aprovado")} className="bg-orange-500 hover:bg-orange-600">
            ✓ Aprovar Desenvolvimento
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