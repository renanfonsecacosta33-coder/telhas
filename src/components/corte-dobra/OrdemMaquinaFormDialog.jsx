import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Layers, Package } from "lucide-react";

// etapa: "corte" | "dobra" | "ambas" | "perfiladeira"
const TIPOS_PECA = [
  { label: "Blank (Chapa cortada)",         etapa: "corte" },
  { label: "Tira Raiada",                   etapa: "corte" },
  { label: "Perfil Serralheiro",            etapa: "perfiladeira" },
  { label: "Perfil Estrutural Simples",     etapa: "perfiladeira" },
  { label: "Perfil Estrutural Enrijecido",  etapa: "perfiladeira" },
  { label: "Lambril Contínuo",              etapa: "perfiladeira" },
  { label: "Dobra simples",                 etapa: "dobra" },
  { label: "Dobra dupla",                   etapa: "dobra" },
  { label: "Frizada V",                     etapa: "dobra" },
  { label: "Frizada U",                     etapa: "dobra" },
  { label: "Caixa Basculante",              etapa: "ambas" },
  { label: "Outro (ver dimensões)",         etapa: "ambas" },
];

const MAQUINAS_CORTE   = ["CORTE 3M", "CORTE 6M"];
const MAQUINAS_DOBRA   = ["DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M"];
const MAQUINAS_TODAS   = ["CORTE 3M", "CORTE 6M", "DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M"];
const MAQUINAS_PERF    = ["PERFILADEIRA"];

function getMaquinasPorEtapa(etapa) {
  if (etapa === "corte") return MAQUINAS_CORTE;
  if (etapa === "dobra") return MAQUINAS_DOBRA;
  if (etapa === "perfiladeira") return MAQUINAS_PERF;
  return MAQUINAS_TODAS;
}

const ETAPA_LABELS = {
  corte: "✂️ Somente Corte",
  dobra: "📐 Somente Dobra",
  ambas: "✂️📐 Corte + Dobra",
  perfiladeira: "⚙️ Perfiladeira",
};

export default function OrdemMaquinaFormDialog({ open, onClose, onSave, editItem, defaultDate, maquina: maquinaProp }) {
  const [form, setForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    maquina: maquinaProp || "",
    chapa_origem: "chaparia",
    chapa_cd_id: "",
    bobina_id: "",
    tipo_peca: "",
    dimensoes_livres: "",
    numero_pedido: "",
    cliente: "",
    quantidade: "",
    peso_kg: "",
    observacoes: "",
  });

  // chapas usadas abaixo via todasChapas

  const { data: bobinasSliter = [] } = useQuery({
    queryKey: ["bobinas-sliter-cd"],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false }),
    enabled: open && form.chapa_origem === "direto" && !(form.maquina === "PERFILADEIRA"),
  });

  const { data: slitters = [] } = useQuery({
    queryKey: ["slitters-perfiladeira"],
    queryFn: () => base44.entities.Slitter.list("-created_date", 100),
    enabled: open && form.maquina === "PERFILADEIRA",
  });

  // chapas disponíveis = disponivel OU parcial, filtrar reservadas ao renderizar
  const { data: todasChapas = [] } = useQuery({
    queryKey: ["chapas-cd-todas"],
    queryFn: () => base44.entities.ChapaCD.list("-created_date", 200),
    enabled: open && form.chapa_origem === "chaparia",
  });

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setForm({
        data: editItem.data || format(new Date(), "yyyy-MM-dd"),
        maquina: editItem.maquina || maquinaProp || "",
        chapa_origem: editItem.chapa_origem || "chaparia",
        chapa_cd_id: editItem.chapa_cd_id || "",
        bobina_id: editItem.bobina_id || "",
        tipo_peca: editItem.tipo_peca || "",
        dimensoes_livres: editItem.dimensoes_livres || "",
        numero_pedido: editItem.numero_pedido || "",
        cliente: editItem.cliente || "",
        quantidade: editItem.quantidade || "",
        peso_kg: editItem.peso_kg || "",
        observacoes: editItem.observacoes || "",
      });
    } else {
      setForm({
        data: defaultDate || format(new Date(), "yyyy-MM-dd"),
        maquina: maquinaProp || "",
        chapa_origem: maquinaProp === "PERFILADEIRA" ? "direto" : "chaparia",
        chapa_cd_id: "",
        bobina_id: "",
        tipo_peca: "",
        dimensoes_livres: "",
        numero_pedido: "",
        cliente: "",
        quantidade: "",
        peso_kg: "",
        observacoes: "",
      });
    }
  }, [open, editItem, defaultDate, maquinaProp]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const chapas = todasChapas.filter(c => c.status === "disponivel" || c.status === "parcial");
  const chapaObj = chapas.find(c => c.id === form.chapa_cd_id);
  const bobinaObj = form.maquina === "PERFILADEIRA"
    ? slitters.find(s => s.id === form.bobina_id)
    : bobinasSliter.find(b => b.id === form.bobina_id);

  const tipoPecaObj = TIPOS_PECA.find(t => t.label === form.tipo_peca);
  const etapa = tipoPecaObj?.etapa || "ambas";
  const maquinasDisponiveis = maquinaProp === "PERFILADEIRA"
    ? MAQUINAS_PERF
    : getMaquinasPorEtapa(etapa);
  const isPerfiladeira = maquinaProp === "PERFILADEIRA" || etapa === "perfiladeira" || form.maquina === "PERFILADEIRA";

  // Quando o tipo de peça muda, limpa a máquina se não for compatível
  const handleTipoPeca = (label) => {
    const obj = TIPOS_PECA.find(t => t.label === label);
    const maqsOk = getMaquinasPorEtapa(obj?.etapa || "ambas");
    set("tipo_peca", label);
    if (maquinaProp === "PERFILADEIRA") {
      // Sempre mantém PERFILADEIRA, nunca limpa
      set("maquina", "PERFILADEIRA");
      set("chapa_origem", "direto");
    } else if (obj?.etapa === "perfiladeira") {
      set("maquina", "PERFILADEIRA");
      set("chapa_origem", "direto");
    } else if (!maqsOk.includes(form.maquina)) {
      set("maquina", "");
    }
    if (obj?.etapa === "perfiladeira" || maquinaProp === "PERFILADEIRA") set("chapa_origem", "direto");
  };

  // Auto-preencher dimensões quando a slitter é selecionada
  const slitterMaterial = bobinaObj?.materiais_producao;
  useEffect(() => {
    if (form.maquina === "PERFILADEIRA" && slitterMaterial) {
      set("dimensoes_livres", slitterMaterial);
    }
  }, [slitterMaterial, form.maquina]);

  const handleSave = () => {
    if (!form.maquina) { alert("Selecione a máquina."); return; }
    if (!form.tipo_peca) { alert("Informe o tipo de peça."); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade."); return; }

    const chapaSnap = chapaObj ? `${chapaObj.bobina_descricao || ""} · ${chapaObj.comprimento_mm}mm` : "";
    const slitterSnap = bobinaObj ? `[${bobinaObj.codigo || "—"}] ${bobinaObj.qualidade || ""} ${bobinaObj.espessura_mm || ""}mm — ${bobinaObj.materiais_producao || ""}` : "";
    onSave({
      ...form,
      chapa_descricao: chapaSnap || slitterSnap || "",
      bobina_descricao: form.maquina !== "PERFILADEIRA"
        ? (bobinaObj ? `[${bobinaObj.codigo || "—"}] ${bobinaObj.chapa || ""} — ${bobinaObj.cor || ""}` : "")
        : slitterSnap,
      quantidade: Number(form.quantidade),
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Ordem" : `Nova Ordem${form.maquina ? ` — ${form.maquina}` : ""}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Máquina *</Label>
              <Select value={form.maquina} disabled={maquinaProp === "PERFILADEIRA"} onValueChange={v => {
                set("maquina", v);
                if (v === "PERFILADEIRA") set("chapa_origem", "direto");
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {maquinasDisponiveis.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  {maquinasDisponiveis.length === 0 && (
                    <SelectItem value={null} disabled>Selecione o tipo de peça primeiro</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {form.tipo_peca && maquinasDisponiveis.length > 0 && maquinasDisponiveis.length < 6 && (
                <p className="text-xs text-muted-foreground">Máquinas compatíveis com o tipo de peça selecionado</p>
              )}
            </div>
          </div>

          {!isPerfiladeira && (
            <div className="space-y-2">
              <Label>Origem da Chapa</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => set("chapa_origem", "chaparia")}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm transition-all ${form.chapa_origem === "chaparia" ? "border-orange-500 bg-orange-50" : "border-border hover:border-orange-300"}`}>
                  <Layers className={`w-4 h-4 ${form.chapa_origem === "chaparia" ? "text-orange-600" : "text-muted-foreground"}`} />
                  <span className={form.chapa_origem === "chaparia" ? "text-orange-700 font-semibold" : "text-muted-foreground"}>Do Estoque (Chaparia)</span>
                </button>
                <button type="button" onClick={() => set("chapa_origem", "direto")}
                  className={`flex items-center gap-2 rounded-lg border-2 p-3 text-sm transition-all ${form.chapa_origem === "direto" ? "border-blue-500 bg-blue-50" : "border-border hover:border-blue-300"}`}>
                  <Package className={`w-4 h-4 ${form.chapa_origem === "direto" ? "text-blue-600" : "text-muted-foreground"}`} />
                  <span className={form.chapa_origem === "direto" ? "text-blue-700 font-semibold" : "text-muted-foreground"}>Diretamente</span>
                </button>
              </div>
            </div>
          )}

          {form.chapa_origem === "chaparia" && !isPerfiladeira && (
            <div className="space-y-1">
              <Label>Chapa do Estoque (Chaparia)</Label>
              <Select value={form.chapa_cd_id} onValueChange={v => set("chapa_cd_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a chapa..." /></SelectTrigger>
                <SelectContent>
                  {chapas.length === 0 && <SelectItem value="_empty" disabled>Nenhuma chapa disponível</SelectItem>}
                  {chapas.map(c => {
                    const reservada = c.destino === "pedido_direto";
                    const reservadaParaOutro = reservada && c.numero_pedido && c.numero_pedido !== form.numero_pedido;
                    return (
                      <SelectItem key={c.id} value={c.id} disabled={reservadaParaOutro}>
                        <span className="font-mono font-bold text-sm">{c.codigo || "—"}</span>
                        <span className="text-muted-foreground ml-2">{c.bobina_descricao || "—"}</span>
                        <span className="text-muted-foreground ml-2">{c.comprimento_mm}mm</span>
                        <span className="text-green-600 ml-2">{c.quantidade_disponivel}pç</span>
                        {reservada && !reservadaParaOutro && (
                          <span className="text-amber-600 ml-2 text-xs font-bold">🔒 Ped. {c.numero_pedido}</span>
                        )}
                        {reservadaParaOutro && (
                          <span className="text-red-500 ml-2 text-xs font-bold">🚫 Reservada — Ped. {c.numero_pedido}</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {chapaObj && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-3 text-orange-800">
                  <span>Bobina: <strong>{chapaObj.bobina_descricao}</strong></span>
                  <span>Corte: <strong>{chapaObj.comprimento_mm}mm</strong></span>
                  <span>Disponível: <strong>{chapaObj.quantidade_disponivel} pç</strong></span>
                </div>
              )}
            </div>
          )}

          {isPerfiladeira && (
            <div className="space-y-1">
              <Label>Bobina Slitter *</Label>
              <Select value={form.bobina_id} onValueChange={v => set("bobina_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a slitter..." /></SelectTrigger>
                <SelectContent>
                  {slitters.filter(s => !["consumido", "arquivado"].includes(s.status?.toLowerCase())).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono font-bold">{s.codigo || "—"}</span>
                      {s.qualidade && <span className="text-muted-foreground ml-2">{s.qualidade}</span>}
                      <span className="text-muted-foreground ml-2">{s.espessura_mm}mm</span>
                      {s.materiais_producao && <span className="text-blue-600 ml-2">{s.materiais_producao}</span>}
                      <span className="text-green-600 ml-2 font-bold">{s.peso_kg?.toLocaleString("pt-BR")}kg</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bobinaObj && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-3 text-blue-800">
                  <span>Qualidade: <strong>{bobinaObj.qualidade}</strong></span>
                  <span>Espessura: <strong>{bobinaObj.espessura_mm}mm</strong></span>
                  <span>Largura: <strong>{bobinaObj.largura_mm}mm</strong></span>
                  <span>Peso: <strong>{bobinaObj.peso_kg?.toLocaleString("pt-BR")}kg</strong></span>
                </div>
              )}
            </div>
          )}
          {(form.chapa_origem === "direto" && !isPerfiladeira) && (
            <div className="space-y-1">
              <Label>Bobina (entrada direta)</Label>
              <Select value={form.bobina_id} onValueChange={v => set("bobina_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a bobina..." /></SelectTrigger>
                <SelectContent>
                  {bobinasSliter.map(b => {
                    const reservadaParaOutro = b.reservada && b.reserva_numero_pedido && b.reserva_numero_pedido !== form.numero_pedido;
                    return (
                      <SelectItem key={b.id} value={b.id} disabled={reservadaParaOutro}>
                        <span className="font-mono font-bold">{b.codigo || "—"}</span>
                        {b.chapa && <span className="text-muted-foreground ml-2">{b.chapa}</span>}
                        {b.cor && <span className="text-blue-600"> — {b.cor}</span>}
                        {b.reservada && !reservadaParaOutro && (
                          <span className="text-amber-600 ml-2 text-xs font-bold">🔒 Ped. {b.reserva_numero_pedido}</span>
                        )}
                        {reservadaParaOutro && (
                          <span className="text-red-500 ml-2 text-xs font-bold">🚫 Reservada — Ped. {b.reserva_numero_pedido}</span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Tipo de Peça *</Label>
            <Select value={form.tipo_peca} onValueChange={handleTipoPeca}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo de peça..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_corte" disabled className="text-xs font-bold text-muted-foreground uppercase">✂️ Corte</SelectItem>
                {TIPOS_PECA.filter(t => t.etapa === "corte").map(t => <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>)}
                <SelectItem value="_dobra" disabled className="text-xs font-bold text-muted-foreground uppercase">📐 Dobra</SelectItem>
                {TIPOS_PECA.filter(t => t.etapa === "dobra").map(t => <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>)}
                <SelectItem value="_perf" disabled className="text-xs font-bold text-muted-foreground uppercase">⚙️ Perfiladeira</SelectItem>
                {TIPOS_PECA.filter(t => t.etapa === "perfiladeira").map(t => <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>)}
                <SelectItem value="_ambas" disabled className="text-xs font-bold text-muted-foreground uppercase">✂️📐 Corte + Dobra</SelectItem>
                {TIPOS_PECA.filter(t => t.etapa === "ambas").map(t => <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.tipo_peca && tipoPecaObj && (
              <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
                <span className="text-muted-foreground">Etapa:</span>
                <span className="font-semibold">{ETAPA_LABELS[etapa]}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Dimensões / Especificações</Label>
            <Input placeholder="Ex: A=100 B=50 CH=1,25 · 6m" value={form.dimensoes_livres} onChange={e => set("dimensoes_livres", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Quantidade *</Label>
              <Input type="number" placeholder="0" value={form.quantidade} onChange={e => set("quantidade", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso (kg)</Label>
              <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => set("peso_kg", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nº Pedido</Label>
              <Input placeholder="12345" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Cliente</Label>
            <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Instruções para o operador..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">{editItem ? "Salvar" : "Criar Ordem"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}