import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useFilial } from "@/contexts/FilialContext";
import { Layers, Package, Camera, DollarSign, PackageX } from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";

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
    foto_pedido_url: "",
    valor_pago_cliente: "",
    material_em_falta: false,
    material_espessura: "",
    material_cor: "",
  });
  const fotoPedidoRef = useRef();
  const fotoPedidoScanRef = useRef();
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const { filialAtiva } = useFilial();

  const { data: bobinasSliter = [] } = useQuery({
    queryKey: ["bobinas-sliter-cd", filialAtiva],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false, unidade: filialAtiva }),
    enabled: open && form.chapa_origem === "direto" && !(form.maquina === "PERFILADEIRA"),
  });

  const filiaisHook = filialAtiva === "todas" ? null : [filialAtiva];
  const { preBaixaMap } = usePreBaixaBobinas("corte_dobra", filiaisHook);

  const { data: slitters = [] } = useQuery({
    queryKey: ["slitters-perfiladeira", filialAtiva],
    queryFn: () => base44.entities.Slitter.filter({ unidade: filialAtiva }),
    enabled: open && form.maquina === "PERFILADEIRA",
  });

  // flags de máquina
  const isCorte = ["CORTE 3M", "CORTE 6M"].includes(form.maquina);
  const isDobra = ["DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M"].includes(form.maquina);
  const isMaquinaPadrao = isCorte || isDobra;
  const maxComprimento = form.maquina?.includes("3M") ? 3000 : form.maquina?.includes("6M") ? 6000 : 99999;

  // chapas disponíveis = disponivel OU parcial, filtrar reservadas ao renderizar
  const { data: todasChapas = [] } = useQuery({
    queryKey: ["chapas-cd-todas", filialAtiva],
    queryFn: () => base44.entities.ChapaCD.filter({ unidade: filialAtiva }),
    enabled: open && (form.chapa_origem === "chaparia" || isDobra),
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
        foto_pedido_url: editItem.foto_pedido_url || "",
        foto_material_url: editItem.foto_material_url || "",
        desenvolvimento_id: editItem.desenvolvimento_id || "",
        desenvolvimento_descricao: editItem.desenvolvimento_descricao || "",
        ordem_dobra_maquina: editItem.ordem_dobra_maquina || "",
        ordem_corte_id: editItem.ordem_corte_id || "",
        valor_pago_cliente: editItem.valor_pago_cliente || "",
        material_em_falta: editItem.material_em_falta || false,
        material_espessura: editItem.material_espessura || "",
        material_cor: editItem.material_cor || "",
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
        foto_pedido_url: "",
        foto_material_url: "",
        desenvolvimento_id: "",
        desenvolvimento_descricao: "",
        ordem_dobra_maquina: "",
        ordem_corte_id: "",
        valor_pago_cliente: "",
        material_em_falta: false,
        material_espessura: "",
        material_cor: "",
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
    : MAQUINAS_TODAS;
  const isPerfiladeira = maquinaProp === "PERFILADEIRA" || etapa === "perfiladeira" || form.maquina === "PERFILADEIRA";

  // Desenvolvimentos disponíveis
  const { data: desenvolvimentos = [] } = useQuery({
    queryKey: ["desenvolvimentos-cd-ativos"],
    queryFn: () => base44.entities.DesenvolvimentoCD.filter({ status: "aprovado" }, "-created_date", 200),
    enabled: open && isMaquinaPadrao,
  });

  const devObj = desenvolvimentos.find(d => d.id === form.desenvolvimento_id);

  // Quando o tipo de peça muda
  const handleTipoPeca = (label) => {
    if (isPerfiladeira) {
      // Perfiladeira: tipo_peca é o material da slitter
      set("tipo_peca", label);
      set("dimensoes_livres", label);
      set("maquina", "PERFILADEIRA");
      set("chapa_origem", "direto");
      // Resetar flag de edição manual ao trocar de material
      pesoEditadoManual.current = false;
      return;
    }
    const obj = TIPOS_PECA.find(t => t.label === label);
    const maqsOk = getMaquinasPorEtapa(obj?.etapa || "ambas");
    set("tipo_peca", label);
    if (obj?.etapa === "perfiladeira") {
      set("maquina", "PERFILADEIRA");
      set("chapa_origem", "direto");
    } else if (!maqsOk.includes(form.maquina)) {
      set("maquina", "");
    }
    if (obj?.etapa === "perfiladeira") set("chapa_origem", "direto");
  };

  // Materiais disponíveis na slitter selecionada (para Perfiladeira)
  const materiaisSlitter = isPerfiladeira && bobinaObj?.materiais_producao
    ? bobinaObj.materiais_producao.split("/").map(m => m.trim()).filter(Boolean)
    : [];

  // Controle de edição manual do peso (para não sobrescrever)
  const pesoEditadoManual = useRef(false);

  // Herdar foto do pedido e foto do material da chapa selecionada
  useEffect(() => {
    if (!chapaObj) return;
    if (chapaObj.foto_pedido_url && !form.foto_pedido_url) {
      set("foto_pedido_url", chapaObj.foto_pedido_url);
    }
    if (chapaObj.foto_finalizacao_url && !form.foto_material_url) {
      set("foto_material_url", chapaObj.foto_finalizacao_url);
    }
  }, [chapaObj?.id]);

  // Preencher dados do desenvolvimento selecionado
  useEffect(() => {
    if (!devObj || !isMaquinaPadrao) return;
    set("tipo_peca", devObj.nome_peca || "");
    set("dimensoes_livres", devObj.comprimento_desenvolvido_mm
      ? `${devObj.comprimento_desenvolvido_mm}×${devObj.largura_final_mm || devObj.largura_mm || "—"}mm`
      : (devObj.comprimento_final_mm ? `${devObj.comprimento_final_mm}×${devObj.largura_final_mm || "—"}mm` : ""));
    // Se for corte 3M e precisa de dobra, já define máquina de dobra automaticamente
    if (form.maquina === "CORTE 3M" && devObj.maquina_dobra && devObj.maquina_dobra !== "PERFILADEIRA") {
      set("ordem_dobra_maquina", "DOBRA 3M");
    }
  }, [devObj?.id]);

  // Recalcular peso automaticamente conforme quantidade (Perfiladeira)
  useEffect(() => {
    if (!isPerfiladeira || !bobinaObj || !form.tipo_peca) return;
    if (pesoEditadoManual.current) return;

    const qtd = Number(form.quantidade);
    if (!qtd || qtd <= 0) return;

    const larguraM = (bobinaObj.largura_mm || 1200) / 1000;
    const espessuraM = (bobinaObj.espessura_mm || 2) / 1000;
    const pesoPorMetro = larguraM * espessuraM * 7850; // kg/m
    const pesoPorPeca6m = pesoPorMetro * 6;
    const pesoTotal = pesoPorPeca6m * qtd;

    set("peso_kg", String(Math.round(pesoTotal * 10) / 10));
  }, [form.quantidade, form.tipo_peca, bobinaObj?.id]);

  const handleUploadFotoPedido = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("foto_pedido_url", file_url);
    } catch (e) {
      alert("Erro ao enviar foto: " + e.message);
    }
    setUploadingFoto(false);
  };

  const handleSave = async () => {
    // Se material em falta, pular validação de chapa/bobina
    if (form.material_em_falta) {
      if (!form.material_espessura) { alert("Informe a espessura desejada."); return; }
      if (!form.tipo_peca) { alert("Informe o tipo de peça."); return; }
      if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade."); return; }

      const ordemData = {
        ...form,
        status: "aguardando_material",
        chapa_cd_id: "",
        bobina_id: "",
        chapa_descricao: "",
        bobina_descricao: "",
        quantidade: Number(form.quantidade),
        valor_pago_cliente: form.valor_pago_cliente ? Number(form.valor_pago_cliente) : null,
      };
      onSave(ordemData);
      return;
    }
    if (!form.maquina) { alert("Selecione a máquina."); return; }
    if (isPerfiladeira && !form.bobina_id) { alert("Selecione a bobina slitter."); return; }
    if (isDobra && !form.chapa_cd_id) { alert("Selecione a chapa do estoque."); return; }
    if (!form.tipo_peca) { alert("Informe o tipo de peça."); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade."); return; }
    if (form.maquina === "CORTE 6M" && devObj?.maquina_dobra && devObj.maquina_dobra !== "PERFILADEIRA" && !form.ordem_dobra_maquina) {
      alert("Selecione a máquina de dobra."); return;
    }

    // Validação de pré-baixa para bobina direta (não perfiladeira/slitter)
    if (form.chapa_origem === "direto" && !isPerfiladeira && !isDobra && form.bobina_id && form.peso_kg) {
      const pesoNecessario = Number(form.peso_kg);
      const bobinaDireta = bobinasSliter.find(b => b.id === form.bobina_id);
      if (bobinaDireta) {
        const preBaixa = preBaixaMap[bobinaDireta.id] || 0;
        const pesoDisp = (bobinaDireta.peso_kg || 0) - preBaixa;
        if (pesoNecessario > pesoDisp) {
          alert(`⚠️ Material insuficiente!\n\nBobina: ${bobinaDireta.codigo || '—'}\nPeso atual: ${(bobinaDireta.peso_kg || 0).toFixed(1)} kg\nPré-baixa: ${preBaixa.toFixed(1)} kg\nDisponível: ${pesoDisp.toFixed(1)} kg\nNecessário: ${pesoNecessario.toFixed(1)} kg\n\nA OP será criada como "OP sem Material".`);
          onSave({
            ...form,
            material_em_falta: true,
            material_espessura: bobinaDireta.chapa || "",
            material_cor: bobinaDireta.cor || "",
            bobina_descricao: `[${bobinaDireta.codigo || "—"}] ${bobinaDireta.chapa || ""} — ${bobinaDireta.cor || ""}`,
            quantidade: Number(form.quantidade),
            peso_kg: undefined,
            status: "aguardando_material",
            bobina_id: "",
            chapa_cd_id: "",
            chapa_descricao: "",
            valor_pago_cliente: form.valor_pago_cliente ? Number(form.valor_pago_cliente) : null,
          });
          return;
        }
      }
    }

    const chapaSnap = chapaObj ? `${chapaObj.bobina_descricao || ""} · ${chapaObj.comprimento_mm}mm` : "";
    const slitterSnap = bobinaObj ? `[${bobinaObj.codigo || "—"}] ${bobinaObj.qualidade || ""} ${bobinaObj.espessura_mm || ""}mm — ${bobinaObj.materiais_producao || ""}` : "";

    const ordemData = {
      ...form,
      chapa_origem: isDobra ? "chaparia" : form.chapa_origem,
      chapa_descricao: chapaSnap || slitterSnap || "",
      bobina_descricao: form.maquina !== "PERFILADEIRA"
        ? (bobinaObj ? `[${bobinaObj.codigo || "—"}] ${bobinaObj.chapa || ""} — ${bobinaObj.cor || ""}` : "")
        : slitterSnap,
      quantidade: Number(form.quantidade),
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      valor_pago_cliente: form.valor_pago_cliente ? Number(form.valor_pago_cliente) : null,
      desenvolvimento_descricao: devObj ? `${devObj.nome_peca} — ${devObj.material || ""} ${devObj.espessura_mm || ""}mm` : form.desenvolvimento_descricao || "",
    };

    // CORTE 3M: se precisa de dobra, vai criar ordem de dobra vinculada
    if (form.maquina === "CORTE 3M" && devObj?.maquina_dobra && devObj.maquina_dobra !== "PERFILADEIRA") {
      ordemData.ordem_dobra_maquina = "DOBRA 3M";
    }

    onSave(ordemData);
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

            </div>
          </div>

          {/* Desenvolvimento (opcional para corte/dobra) */}
          {isMaquinaPadrao && (
            <div className="space-y-1">
              <Label>Desenvolvimento (opcional)</Label>
              <Select value={form.desenvolvimento_id} onValueChange={v => {
                set("desenvolvimento_id", v);
                if (!v) { set("tipo_peca", ""); set("dimensoes_livres", ""); set("ordem_dobra_maquina", ""); return; }
                const d = desenvolvimentos.find(x => x.id === v);
                set("desenvolvimento_descricao", d ? `${d.nome_peca} — ${d.material || ""} ${d.espessura_mm || ""}mm` : "");
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione o desenvolvimento..." /></SelectTrigger>
                <SelectContent>
                  {desenvolvimentos.length === 0 && <SelectItem value="_empty" disabled>Nenhum desenvolvimento aprovado</SelectItem>}
                  {desenvolvimentos.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="font-semibold">{d.nome_peca}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{d.material} {d.espessura_mm}mm</span>
                      {d.maquina_dobra && d.maquina_dobra !== "PERFILADEIRA" && (
                        <span className="text-amber-600 ml-2 text-xs">📐 +{d.maquina_dobra}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {devObj && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-3 text-emerald-800">
                  <span>Material: <strong>{devObj.material}</strong></span>
                  <span>Espessura: <strong>{devObj.espessura_mm}mm</strong></span>
                  {devObj.largura_mm && <span>Largura: <strong>{devObj.largura_mm}mm</strong></span>}
                  {devObj.maquina_dobra && devObj.maquina_dobra !== "PERFILADEIRA" && (
                    <span className="text-amber-700">📐 Precisa de dobra</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Seletor de máquina de dobra (CORTE 6M quando precisa de dobra) */}
          {form.maquina === "CORTE 6M" && devObj?.maquina_dobra && devObj.maquina_dobra !== "PERFILADEIRA" && (
            <div className="space-y-1">
              <Label>Máquina de Dobra *</Label>
              <Select value={form.ordem_dobra_maquina} onValueChange={v => set("ordem_dobra_maquina", v)}>
                <SelectTrigger><SelectValue placeholder="Escolha a dobradeira..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOBRA FUNDO 6M">01 Dobradeira 6m (Fundo)</SelectItem>
                  <SelectItem value="DOBRA INICIO 6M">02 Dobradeira 6m (Início)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Material em falta */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => set("material_em_falta", !form.material_em_falta)}
              className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all ${form.material_em_falta ? "border-amber-500 bg-amber-50" : "border-border bg-card hover:border-amber-300"}`}
            >
              <PackageX className={`w-4 h-4 ${form.material_em_falta ? "text-amber-600" : "text-muted-foreground"}`} />
              <span className={`text-sm font-semibold ${form.material_em_falta ? "text-amber-700" : "text-muted-foreground"}`}>
                {form.material_em_falta ? "Material em falta / A chegar" : "Marcar material em falta"}
              </span>
            </button>
          </div>

          {/* Campos manuais quando material em falta */}
          {form.material_em_falta && (
            <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700">A OP será criada na aba "OP sem Material" aguardando chegada do material.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Espessura Desejada *</Label>
                  <Input placeholder="Ex: 0,43" value={form.material_espessura} onChange={e => set("material_espessura", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cor Desejada</Label>
                  <Input placeholder="Ex: RVM Branco" value={form.material_cor} onChange={e => set("material_cor", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {!form.material_em_falta && !isPerfiladeira && !isDobra && (
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

          {!form.material_em_falta && (form.chapa_origem === "chaparia" || isDobra) && !isPerfiladeira && (
            <div className="space-y-1">
              <Label>{isDobra ? "Chapa do Estoque *" : "Chapa do Estoque (Chaparia)"}</Label>
              <Select value={form.chapa_cd_id} onValueChange={v => set("chapa_cd_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a chapa..." /></SelectTrigger>
                <SelectContent>
                  {chapas.filter(c => c.comprimento_mm <= maxComprimento).length === 0 && <SelectItem value="_empty" disabled>Nenhuma chapa disponível (max {maxComprimento}mm)</SelectItem>}
                  {chapas.filter(c => c.comprimento_mm <= maxComprimento).map(c => {
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

          {!form.material_em_falta && isPerfiladeira && (
            <div className="space-y-1">
              <Label>Bobina Slitter *</Label>
              <Select value={form.bobina_id} onValueChange={v => { set("bobina_id", v); set("tipo_peca", ""); set("dimensoes_livres", ""); set("peso_kg", ""); pesoEditadoManual.current = false; }}>
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
          {!form.material_em_falta && (form.chapa_origem === "direto" && !isPerfiladeira && !isDobra) && (
            <div className="space-y-1">
              <Label>Bobina (entrada direta)</Label>
              <Select value={form.bobina_id} onValueChange={v => set("bobina_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a bobina..." /></SelectTrigger>
                <SelectContent>
                  {bobinasSliter.map(b => {
                    const reservadaParaOutro = b.reservada && b.reserva_numero_pedido && b.reserva_numero_pedido !== form.numero_pedido;
                    const pb = preBaixaMap[b.id] || 0;
                    const disp = (b.peso_kg || 0) - pb;
                    return (
                      <SelectItem key={b.id} value={b.id} disabled={reservadaParaOutro}>
                        <span className="font-mono font-bold">{b.codigo || "—"}</span>
                        {b.chapa && <span className="text-muted-foreground ml-2">{b.chapa}</span>}
                        {b.cor && <span className="text-blue-600"> — {b.cor}</span>}
                        {b.peso_kg && <span className="text-muted-foreground ml-2 text-xs">{disp.toFixed(0)}kg disp.</span>}
                        {pb > 0 && <span className="text-blue-500 ml-1 text-xs">(pré-baixa: {pb.toFixed(0)}kg)</span>}
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
            {isPerfiladeira ? (
              materiaisSlitter.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">Selecione uma bobina slitter primeiro</div>
              ) : (
                <Select value={form.tipo_peca} onValueChange={handleTipoPeca}>
                  <SelectTrigger><SelectValue placeholder="Escolha o material..." /></SelectTrigger>
                  <SelectContent>
                    {materiaisSlitter.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )
            ) : (
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
            )}
            {!isPerfiladeira && form.tipo_peca && tipoPecaObj && (
              <div className="bg-muted/50 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
                <span className="text-muted-foreground">Etapa:</span>
                <span className="font-semibold">{ETAPA_LABELS[etapa]}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Dimensões / Especificações</Label>
            <Input placeholder={isPerfiladeira || isMaquinaPadrao ? "Preenchido automaticamente" : "Ex: A=100 B=50 CH=1,25 · 6m"} value={form.dimensoes_livres} onChange={e => set("dimensoes_livres", e.target.value)} readOnly={isPerfiladeira || isMaquinaPadrao} className={isPerfiladeira || isMaquinaPadrao ? "bg-muted" : ""} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Quantidade *</Label>
              <Input type="number" placeholder="0" value={form.quantidade} onChange={e => set("quantidade", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{isPerfiladeira ? "Peso (kg) — auto" : "Peso (kg)"}</Label>
              <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => { set("peso_kg", e.target.value); pesoEditadoManual.current = true; }}
                className={isPerfiladeira && !pesoEditadoManual.current && form.peso_kg ? "bg-blue-50" : ""} />
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
            <Label>Foto do Pedido (Encarregado)</Label>
            <input ref={fotoPedidoRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleUploadFotoPedido(e.target.files[0])} />
            <input ref={fotoPedidoScanRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleUploadFotoPedido(e.target.files[0])} />
            {form.foto_pedido_url ? (
              <div className="relative rounded-lg overflow-hidden border-2 border-blue-300">
                <img src={form.foto_pedido_url} alt="Foto do pedido" className="w-full max-h-40 object-cover" />
                <button type="button" onClick={() => set("foto_pedido_url", "")}
                  className="absolute top-1.5 right-1.5 bg-red-500 text-white text-xs px-2 py-1 rounded-lg hover:bg-red-600">
                  Remover
                </button>
                <div className="absolute top-1.5 left-1.5 text-[10px] font-bold rounded-full flex items-center gap-0.5 bg-blue-600 text-white px-2 py-0.5">
                  <Camera className="w-3 h-3" /> Foto do Pedido
                </div>
              </div>
            ) : (
              <UploadButton label="Anexar Foto do Pedido" icon={Camera} cameraRef={fotoPedidoRef} fileRef={fotoPedidoScanRef} uploading={uploadingFoto} size="default" variant="outline" />
            )}
          </div>

          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-green-600" /> Valor Pago pelo Cliente
            </Label>
            <Input type="number" step="0.01" placeholder="0,00" value={form.valor_pago_cliente} onChange={e => set("valor_pago_cliente", e.target.value)} />
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