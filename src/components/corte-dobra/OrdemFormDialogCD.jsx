import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useFilial } from "@/contexts/FilialContext";
import { Package, Warehouse, ShoppingCart, Ruler, Weight, Layers, Scale, AlertCircle, ShieldAlert, ShieldCheck, Camera, Loader2, X, DollarSign, Star, PackageX, Wrench } from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";
import { getBobinaStatus, calcMetrosDisponiveis } from "@/lib/bobinaStatusHelper";

const MAQUINAS_INICIAIS = [
  { id: "DESBOBINADEIRA", label: "Desbobinadeira", icon: Layers },
  { id: "CORTE 3M", label: "Guilhotina 3m", icon: Wrench },
  { id: "CORTE 6M", label: "Guilhotina 6m", icon: Wrench },
  { id: "DOBRA 3M", label: "Dobradeira 3m", icon: Wrench },
  { id: "DOBRA FUNDO 6M", label: "Dobradeira 6m (Fundo)", icon: Wrench },
  { id: "DOBRA INICIO 6M", label: "Dobradeira 6m (Início)", icon: Wrench },
];

function labelBobina(b) {
  const parts = [];
  if (b.codigo) parts.push(`[${b.codigo}]`);
  if (b.espessura_utilizada) parts.push(b.espessura_utilizada);
  else if (b.chapa) parts.push(b.chapa);
  if (b.cor) parts.push(b.cor);
  if (b.largura_mm) parts.push(`${b.largura_mm}mm`);
  return parts.join(" · ");
}

// Calcula metragem restante com base no peso e largura/chapa
function calcMetragem(bobina) {
  if (!bobina) return null;
  if (bobina.metragem_restante) return bobina.metragem_restante;
  if (bobina.metragem) return bobina.metragem;
  return null;
}

// Calcula quantas chapas de X mm cabem numa bobina de Y metros
function calcMaxChapas(bobina, comprimento_mm) {
  if (!bobina || !comprimento_mm || Number(comprimento_mm) <= 0) return null;
  const metros = calcMetragem(bobina);
  if (!metros) return null;
  return Math.floor((metros * 1000) / Number(comprimento_mm));
}

// Calcula KG estimado das chapas: largura × comprimento × espessura × qtd × densidade
// densidade aço galvanizado = 0.00000785 kg/mm³
function calcKgEstimado(bobina, comprimento_mm, quantidade) {
  if (!bobina || !comprimento_mm || !quantidade) return null;
  const larg = Number(bobina.largura_mm) || 0;
  const comp = Number(comprimento_mm) || 0;
  const qtd = Number(quantidade) || 0;
  // espessura pode ser "0,43" ou "0.43"
  const espStr = String(bobina.chapa || "").replace(",", ".");
  const esp = parseFloat(espStr) || 0;
  if (larg <= 0 || comp <= 0 || esp <= 0 || qtd <= 0) return null;
  return larg * comp * esp * qtd * 0.00000785;
}

export default function OrdemFormDialogCD({ open, onClose, onSave, editItem, defaultDate, isGestor }) {
  const [form, setForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    maquina_inicial: "DESBOBINADEIRA",
    bobina_id: "",
    chapa_cd_id: "",
    tipo_peca: "",
    dimensoes_livres: "",
    comprimento_mm: "",
    quantidade: "",
    destino: "estoque",
    numero_pedido: "",
    cliente: "",
    guilhotina: "",
    tamanho_corte_guilhotina: "",
    foto_pedido_url: "",
    observacoes: "",
    prioridade: false,
    valor_pago_cliente: "",
    material_em_falta: false,
    material_espessura: "",
    material_cor: "",
  });
  const [confirmReserva, setConfirmReserva] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoInputRef = useRef();
  const fotoScanRef = useRef();

  const { filialAtiva } = useFilial();

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-cd-ativas", filialAtiva],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false, unidade: filialAtiva }),
    enabled: open && form.maquina_inicial === "DESBOBINADEIRA",
  });

  const filiaisHook = filialAtiva === "todas" ? null : [filialAtiva];
  const { preBaixaMap, statusMap } = usePreBaixaBobinas("corte_dobra", filiaisHook);

  const { data: chapasDisponiveis = [] } = useQuery({
    queryKey: ["chapas-cd-form-dinamico", filialAtiva],
    queryFn: () => base44.entities.ChapaCD.filter({ unidade: filialAtiva }),
    enabled: open && form.maquina_inicial !== "DESBOBINADEIRA",
  });

  const { data: todasOrdens = [] } = useQuery({
    queryKey: ["ordens-desbobinadeira"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 500),
    enabled: open,
  });

  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-list"],
    queryFn: () => base44.entities.User.filter({ role: "vendedor" }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setForm({
        data: editItem.data || format(new Date(), "yyyy-MM-dd"),
        maquina_inicial: editItem.maquina_inicial || "DESBOBINADEIRA",
        bobina_id: editItem.bobina_id || "",
        chapa_cd_id: editItem.chapa_cd_id || "",
        tipo_peca: editItem.tipo_peca || "",
        dimensoes_livres: editItem.dimensoes_livres || "",
        comprimento_mm: editItem.comprimento_mm || "",
        quantidade: editItem.quantidade || "",
        destino: editItem.destino || "estoque",
        numero_pedido: editItem.numero_pedido || "",
        cliente: editItem.cliente || "",
        guilhotina: editItem.guilhotina || "",
        tamanho_corte_guilhotina: editItem.tamanho_corte_guilhotina || "",
        foto_pedido_url: editItem.foto_pedido_url || "",
        tamanho_blank: editItem.tamanho_corte_guilhotina || "",
        observacoes: editItem.observacoes || "",
        prioridade: editItem.prioridade || false,
        valor_pago_cliente: editItem.valor_pago_cliente || "",
        material_em_falta: editItem.material_em_falta || false,
        material_espessura: editItem.material_espessura || "",
        material_cor: editItem.material_cor || "",
        vendedor: editItem.vendedor || "",
      });
    } else {
      setForm({
        data: defaultDate || format(new Date(), "yyyy-MM-dd"),
        maquina_inicial: "DESBOBINADEIRA",
        bobina_id: "",
        chapa_cd_id: "",
        tipo_peca: "",
        dimensoes_livres: "",
        comprimento_mm: "",
        quantidade: "",
        destino: "estoque",
        numero_pedido: "",
        cliente: "",
        guilhotina: "",
        tamanho_corte_guilhotina: "",
        foto_pedido_url: "",
        tamanho_blank: "",
        observacoes: "",
        prioridade: false,
        valor_pago_cliente: "",
        material_em_falta: false,
        material_espessura: "",
        material_cor: "",
        vendedor: "",
      });
    }
  }, [open, editItem, defaultDate]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const isDesbobinadeira = form.maquina_inicial === "DESBOBINADEIRA";
  const bobinaObj = bobinas.find(b => b.id === form.bobina_id);
  const chapaObj = chapasDisponiveis.find(c => c.id === form.chapa_cd_id);
  const chapasFiltradas = chapasDisponiveis.filter(c => c.status === "disponivel" || c.status === "parcial");
  const maxChapas = calcMaxChapas(bobinaObj, form.comprimento_mm);
  const metrosRestantes = calcMetragem(bobinaObj);
  const kgEstimado = calcKgEstimado(bobinaObj, form.comprimento_mm, form.quantidade);

  // Lógica de reserva da bobina selecionada
  const reservadaParaEste = bobinaObj?.reservada && form.destino === "pedido_direto" && form.numero_pedido && bobinaObj?.reserva_numero_pedido === form.numero_pedido;
  const reservadaParaOutro = bobinaObj?.reservada && !reservadaParaEste;

  // Pré-baixa: soma KG das ordens ativas (pendente/em_producao/pausado) da mesma bobina
  const ordensDaBobina = todasOrdens.filter(o =>
    o.bobina_id === form.bobina_id &&
    o.id !== editItem?.id &&
    ["pendente", "em_producao", "pausado"].includes(o.status)
  );
  const preReservadoKg = ordensDaBobina.reduce((s, o) => s + (o.kg_estimado || 0), 0);
  const pesoBobina = bobinaObj?.peso_kg || 0;
  const pesoDisponivel = Math.max(0, pesoBobina - preReservadoKg);
  const excedePeso = kgEstimado !== null && kgEstimado > pesoDisponivel;

  const handleUploadFoto = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("foto_pedido_url", file_url);
    } catch (e) {
      alert("Erro ao enviar foto: " + (e.message || e));
    }
    setUploadingFoto(false);
  };

  const doSave = () => {
    const bobinaSnap = bobinaObj ? labelBobina(bobinaObj) : "";
    const chapaSnap = chapaObj ? `${chapaObj.bobina_descricao || ""} · ${chapaObj.comprimento_mm}mm` : "";
    const isMaterialEmFalta = form.material_em_falta;

    const data = {
      ...form,
      bobina_descricao: isDesbobinadeira ? bobinaSnap : "",
      espessura_utilizada: bobinaObj?.espessura_utilizada || bobinaObj?.chapa || "",
      comprimento_mm: Number(form.comprimento_mm) || 0,
      quantidade: Number(form.quantidade),
      kg_estimado: kgEstimado ? Math.round(kgEstimado * 100) / 100 : null,
      guilhotina: form.guilhotina || null,
      tamanho_corte_guilhotina: form.destino === "pedido_direto" && form.tamanho_corte_guilhotina ? Number(form.tamanho_corte_guilhotina) : form.destino === "estoque" && form.tamanho_blank ? Number(form.tamanho_blank) : null,
      foto_pedido_url: form.foto_pedido_url || null,
      valor_pago_cliente: form.valor_pago_cliente ? Number(form.valor_pago_cliente) : null,
      chapa_descricao: !isDesbobinadeira ? chapaSnap : "",
      chapa_origem: !isDesbobinadeira ? "chaparia" : form.chapa_origem || undefined,
    };

    // Se material em falta, status = aguardando_material e limpa bobina/chapa vinculada
    if (isMaterialEmFalta) {
      data.status = "aguardando_material";
      data.bobina_id = "";
      data.chapa_cd_id = "";
      data.bobina_descricao = "";
      data.chapa_descricao = "";
      data.kg_estimado = null;
    }

    onSave(data);
  };

  const handleSave = () => {
    // Se material em falta, pular validação de bobina/chapa
    if (form.material_em_falta) {
      if (!form.material_espessura) { alert("Informe a espessura desejada."); return; }
      if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade."); return; }
      doSave();
      return;
    }
    if (isDesbobinadeira) {
      if (!form.bobina_id) { alert("Selecione a bobina."); return; }
    } else {
      if (!form.chapa_cd_id) { alert("Selecione a chapa do estoque."); return; }
      if (!form.tipo_peca) { alert("Informe o tipo de peça."); return; }
    }
    if (isDesbobinadeira && (!form.comprimento_mm || Number(form.comprimento_mm) <= 0)) { alert("Informe o comprimento de corte em mm."); return; }
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe a quantidade de chapas."); return; }
    if (form.destino === "pedido_direto" && !form.numero_pedido) { alert("Informe o número do pedido."); return; }
    if (excedePeso) {
      alert(`⚠️ Material insuficiente!\n\nBobina: ${bobinaObj?.codigo || '—'}\nPeso atual: ${pesoBobina.toFixed(1)} kg\nPré-baixa (OPs ativas): ${preReservadoKg.toFixed(1)} kg\nDisponível: ${pesoDisponivel.toFixed(1)} kg\nNecessário: ${kgEstimado.toFixed(1)} kg\n\nA OP será criada como "OP sem Material".`);
      onSave({
        ...form,
        material_em_falta: true,
        material_espessura: bobinaObj?.espessura_utilizada || bobinaObj?.chapa || "",
        material_cor: bobinaObj?.cor || "",
        bobina_descricao: bobinaObj ? labelBobina(bobinaObj) : "",
        espessura_utilizada: bobinaObj?.espessura_utilizada || bobinaObj?.chapa || "",
        comprimento_mm: Number(form.comprimento_mm) || 0,
        quantidade: Number(form.quantidade),
        kg_estimado: null,
        status: "aguardando_material",
        bobina_id: "",
        chapa_cd_id: "",
        chapa_descricao: "",
        foto_pedido_url: form.foto_pedido_url || null,
        valor_pago_cliente: form.valor_pago_cliente ? Number(form.valor_pago_cliente) : null,
      });
      return;
    }
    if (reservadaParaOutro) { setConfirmReserva(true); return; }
    doSave();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-lg max-h-[92vh] overflow-y-auto"
        onInteractOutside={(e) => {
          const t = e.target;
          if (t?.closest?.('[data-radix-select-content]') || t?.closest?.('[role="listbox"]') || t?.closest?.('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          const t = e.target;
          if (t?.closest?.('[data-radix-select-content]') || t?.closest?.('[role="listbox"]') || t?.closest?.('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-500" />
            {editItem ? "Editar Ordem" : "Nova Ordem"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Data */}
          <div className="space-y-1">
            <Label>Data de Produção *</Label>
            <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
          </div>

          {/* Máquina Inicial */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Wrench className="w-4 h-4 text-orange-500" /> Máquina Inicial do Processo
            </Label>
            <Select value={form.maquina_inicial} onValueChange={v => {
              set("maquina_inicial", v);
              set("bobina_id", "");
              set("chapa_cd_id", "");
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a máquina..." />
              </SelectTrigger>
              <SelectContent>
                {MAQUINAS_INICIAIS.map(m => {
                  const Icon = m.icon;
                  return (
                    <SelectItem key={m.id} value={m.id}>
                      <Icon className="w-4 h-4 mr-2 inline" /> {m.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Material em falta / A chegar */}
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
          {form.material_em_falta ? (
            <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700">Informe as especificações do material desejado. A OP será criada na aba "OP sem Material".</p>
              <div className="space-y-1">
                <Label>Espessura Desejada *</Label>
                <Input placeholder="Ex: 0,43" value={form.material_espessura} onChange={e => set("material_espessura", e.target.value)} />
              </div>
            </div>
          ) : isDesbobinadeira ? (
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Package className="w-4 h-4 text-blue-500" /> Bobina do Estoque *
            </Label>
            <Select value={form.bobina_id} onValueChange={v => set("bobina_id", v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a bobina..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {bobinas.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhuma bobina ativa</div>
                )}
                {bobinas.map(b => {
                    const pb = preBaixaMap[b.id] || 0;
                    const disp = Math.max(0, (b.peso_kg || 0) - pb);
                    const metrosDisp = calcMetrosDisponiveis(b, disp);
                    const st = getBobinaStatus(b, todasOrdens, statusMap);

                    return (
                      <SelectItem key={b.id} value={b.id} className="py-2 cursor-pointer">
                        <div className="flex items-center justify-between gap-2 w-full pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-sm text-primary">{b.codigo || "—"}</span>
                            {(b.espessura_utilizada || b.chapa) && <span className="text-muted-foreground text-xs">{b.espessura_utilizada || b.chapa}mm</span>}
                            {b.cor && <span className="text-blue-600 text-xs font-semibold">— {b.cor}</span>}
                            {b.largura_mm && <span className="text-xs text-muted-foreground">{b.largura_mm}mm larg.</span>}
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                              · {disp.toFixed(0)}kg disp. {metrosDisp ? `(~${metrosDisp.toLocaleString("pt-BR")}m)` : ""}
                            </span>
                            {pb > 0 && <span className="text-amber-600 text-xs font-semibold">(pré-baixa: {pb.toFixed(0)}kg)</span>}
                          </div>
                          {st && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${st.bgClass}`}>
                              {st.label}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>

            {/* Ficha técnica da bobina selecionada */}
            {bobinaObj && (
              <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-800">{bobinaObj.codigo || "—"}</span>
                  <div className="flex items-center gap-1">
                    {reservadaParaEste && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"><ShieldCheck className="w-3 h-3 mr-1" />Reservada p/ este pedido</Badge>}
                    {reservadaParaOutro && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><ShieldAlert className="w-3 h-3 mr-1" />Reservada p/ outro</Badge>}
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Setor CD</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Espessura Utilizada</p>
                    <p className="font-bold text-foreground">{bobinaObj.espessura_utilizada ? `${bobinaObj.espessura_utilizada}mm` : bobinaObj.chapa ? `${bobinaObj.chapa}mm` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Largura</p>
                    <p className="font-bold text-foreground">{bobinaObj.largura_mm ? `${bobinaObj.largura_mm}mm` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Cor / RVM</p>
                    <p className="font-bold text-foreground">{bobinaObj.cor || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Qualidade</p>
                    <p className="font-bold text-foreground">{bobinaObj.qualidade || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Peso Atual</p>
                    <p className="font-bold text-foreground flex items-center gap-1">
                      <Weight className="w-3 h-3 text-slate-400" />
                      {bobinaObj.peso_kg ? `${bobinaObj.peso_kg} kg` : "—"}
                    </p>
                    {(preBaixaMap[bobinaObj.id] || 0) > 0 && (
                      <p className="text-[10px] text-blue-600 font-semibold mt-0.5">Pré-baixa: {(preBaixaMap[bobinaObj.id] || 0).toFixed(1)}kg · Disp: {Math.max(0, (bobinaObj.peso_kg || 0) - (preBaixaMap[bobinaObj.id] || 0)).toFixed(1)}kg</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Metragem Restante</p>
                    <p className="font-bold text-foreground flex items-center gap-1">
                      <Ruler className="w-3 h-3 text-slate-400" />
                      {metrosRestantes ? `${metrosRestantes} m` : "—"}
                    </p>
                  </div>
                  {bobinaObj.fornecedor && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Fornecedor</p>
                      <p className="font-bold text-foreground">{bobinaObj.fornecedor}</p>
                    </div>
                  )}
                  {bobinaObj.nf && (
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">NF</p>
                      <p className="font-bold text-foreground">{bobinaObj.nf}</p>
                    </div>
                  )}
                </div>

                {/* Banner de reserva */}
                {reservadaParaEste && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 flex items-start gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-emerald-800">Bobina reservada para este pedido</p>
                      <p className="text-emerald-700">Esta bobina foi reservada especificamente para o pedido <strong>{bobinaObj.reserva_numero_pedido}</strong>. Pode prosseguir com tranquilidade.</p>
                      {bobinaObj.reserva_motivo && <p className="text-emerald-600 mt-1">Motivo: {bobinaObj.reserva_motivo}</p>}
                      {bobinaObj.reserva_autorizado_por && <p className="text-emerald-600">Autorizado por: {bobinaObj.reserva_autorizado_por}</p>}
                    </div>
                  </div>
                )}
                {reservadaParaOutro && (
                  <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 flex items-start gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-red-800">⚠️ ATENÇÃO: Bobina reservada para outro pedido!</p>
                      <p className="text-red-700">Esta bobina está reservada para o pedido <strong>{bobinaObj.reserva_numero_pedido || "?"}</strong>. Ao continuar, você precisará confirmar que deseja utilizá-la mesmo assim.</p>
                      {bobinaObj.reserva_motivo && <p className="text-red-600 mt-1">Motivo da reserva: {bobinaObj.reserva_motivo}</p>}
                      {bobinaObj.reserva_autorizado_por && <p className="text-red-600">Reservado por: {bobinaObj.reserva_autorizado_por}</p>}
                      {bobinaObj.reserva_tipo === "parcial" && <p className="text-red-600">Reserva parcial: {bobinaObj.reserva_kg} kg reservados</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          ) : (
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Layers className="w-4 h-4 text-orange-500" /> Chapa do Estoque (Chaparia) *
              </Label>
              <Select value={form.chapa_cd_id} onValueChange={v => set("chapa_cd_id", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a chapa..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {chapasFiltradas.length === 0 && (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhuma chapa disponível</div>
                  )}
                  {chapasFiltradas.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono font-bold text-sm">{c.codigo || "—"}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{c.bobina_descricao || "—"}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{c.comprimento_mm}mm</span>
                      <span className="text-green-600 ml-2 text-xs">{c.quantidade_disponivel}pç</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {chapaObj && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-3 text-orange-800">
                  <span>Bobina: <strong>{chapaObj.bobina_descricao}</strong></span>
                  <span>Corte: <strong>{chapaObj.comprimento_mm}mm</strong></span>
                  <span>Disponível: <strong>{chapaObj.quantidade_disponivel} pç</strong></span>
                </div>
              )}
              <div className="space-y-1">
                <Label>Tipo de Peça *</Label>
                <Input placeholder="Ex: Blank, Dobra simples..." value={form.tipo_peca} onChange={e => set("tipo_peca", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Dimensões / Especificações</Label>
                <Input placeholder="Ex: A=100 B=50 · 6m" value={form.dimensoes_livres} onChange={e => set("dimensoes_livres", e.target.value)} />
              </div>
            </div>
          )}

          {/* Corte */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Comprimento de Corte (mm) *</Label>
              <Input
                type="number"
                placeholder="Ex: 1200"
                value={form.comprimento_mm}
                onChange={e => set("comprimento_mm", e.target.value)}
              />
              {bobinaObj && form.comprimento_mm > 0 && metrosRestantes && (
                <p className="text-xs text-muted-foreground">
                  = <strong>{(Number(form.comprimento_mm) / 1000).toFixed(3)}m</strong> por chapa
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Quantidade de Chapas *</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.quantidade}
                onChange={e => set("quantidade", e.target.value)}
              />
              {maxChapas !== null && (
                <p className={`text-xs ${Number(form.quantidade) > maxChapas ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                  Máx. possível: <strong>{maxChapas} chapas</strong>
                </p>
              )}
            </div>
          </div>

          {/* KG Estimado + Pré-baixa */}
          {kgEstimado !== null && (
            <div className={`rounded-xl px-4 py-3 space-y-2 ${excedePeso ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"}`}>
              <div className="flex items-center gap-3">
                <Scale className={`w-5 h-5 flex-shrink-0 ${excedePeso ? "text-red-600" : "text-emerald-600"}`} />
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${excedePeso ? "text-red-600" : "text-emerald-600"}`}>KG Estimado das Chapas</p>
                  <p className={`text-2xl font-black ${excedePeso ? "text-red-700" : "text-emerald-700"}`}>{kgEstimado.toFixed(1)} <span className="text-sm font-normal">kg</span></p>
                </div>
              </div>
              <div className="text-xs space-y-0.5 pl-8">
                <p className="text-muted-foreground">Peso atual da bobina: <strong>{pesoBobina.toFixed(1)} kg</strong></p>
                {preReservadoKg > 0 && (
                  <p className="text-amber-600">Pré-reservado por outras ordens: <strong>{preReservadoKg.toFixed(1)} kg</strong></p>
                )}
                <p className={excedePeso ? "text-red-600 font-bold" : "text-emerald-600 font-semibold"}>
                  Disponível para esta ordem: <strong>{pesoDisponivel.toFixed(1)} kg</strong>
                </p>
                {excedePeso && (
                  <p className="text-red-600 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" /> KG estimado excede o peso disponível!
                  </p>
                )}
                {isGestor && bobinaObj?.custo && kgEstimado && (
                  <div className="flex items-center gap-2 bg-green-600/10 border border-green-600/30 rounded-lg px-3 py-2 mt-1">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-semibold text-green-700">Custo de Material desta OP:</span>
                    <span className="text-sm font-black text-green-700">
                      {(kgEstimado * bobinaObj.custo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{bobinaObj.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/kg</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Destino */}
          <div className="space-y-2">
            <Label>Destino das Chapas *</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { set("destino", "estoque"); set("numero_pedido", ""); set("cliente", ""); }}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${form.destino === "estoque" ? "border-orange-500 bg-orange-50" : "border-border hover:border-orange-300 bg-card"}`}
              >
                <Warehouse className={`w-6 h-6 ${form.destino === "estoque" ? "text-orange-600" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <p className={`text-sm font-bold ${form.destino === "estoque" ? "text-orange-700" : "text-foreground"}`}>Estoque</p>
                  <p className="text-xs text-muted-foreground">Vai para a Chaparia</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => set("destino", "pedido_direto")}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${form.destino === "pedido_direto" ? "border-blue-500 bg-blue-50" : "border-border hover:border-blue-300 bg-card"}`}
              >
                <ShoppingCart className={`w-6 h-6 ${form.destino === "pedido_direto" ? "text-blue-600" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <p className={`text-sm font-bold ${form.destino === "pedido_direto" ? "text-blue-700" : "text-foreground"}`}>Pedido Direto</p>
                  <p className="text-xs text-muted-foreground">Vai para um cliente</p>
                </div>
              </button>
            </div>
          </div>

          {/* Campos de estoque */}
          {form.destino === "estoque" && (
            <div className="space-y-3 bg-orange-50 border border-orange-200 rounded-xl p-3">
              <div className="space-y-1">
                <Label className="flex items-center gap-1">
                  <Ruler className="w-4 h-4 text-orange-500" /> Tamanho do Blank (mm)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 1200"
                  value={form.tamanho_blank}
                  onChange={e => set("tamanho_blank", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Tamanho do blank que será cortado da chapa</p>
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-1">
                  <Wrench className="w-4 h-4 text-orange-500" /> Guilhotina de Destino
                </Label>
                <Select value={form.guilhotina || ""} onValueChange={v => set("guilhotina", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a guilhotina..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORTE 3M">Guilhotina 3m</SelectItem>
                    <SelectItem value="CORTE 6M">Guilhotina 6m</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Foto do blank / pedido */}
              <div className="space-y-1">
                <Label className="flex items-center gap-1">
                  <Camera className="w-4 h-4 text-orange-500" /> Foto Anexa
                </Label>
                <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => handleUploadFoto(e.target.files[0])} />
                <input ref={fotoScanRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleUploadFoto(e.target.files[0])} />
                {form.foto_pedido_url ? (
                  <div className="relative rounded-lg overflow-hidden border-2 border-orange-300">
                    <img src={form.foto_pedido_url} alt="Foto anexa" className="w-full max-h-48 object-cover" />
                    <button type="button" onClick={() => set("foto_pedido_url", "")}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    <a href={form.foto_pedido_url} target="_blank" rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded hover:bg-black/80 transition-colors">
                      Abrir
                    </a>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadButton label="Anexar foto" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploadingFoto} size="default" />
                    <p className="text-xs text-muted-foreground">A foto acompanha a OP</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Campos de pedido direto */}
          {form.destino === "pedido_direto" && (
            <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nº do Pedido *</Label>
                  <Input placeholder="Ex: 12345" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cliente</Label>
                  <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-blue-500" /> Vendedor
                </Label>
                <Select value={form.vendedor} onValueChange={v => set("vendedor", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o vendedor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.length === 0 && (
                      <SelectItem value="_empty" disabled>Nenhum vendedor cadastrado</SelectItem>
                    )}
                    {vendedores.map(v => (
                      <SelectItem key={v.id} value={v.full_name || ""}>{v.full_name || "—"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Guilhotina</Label>
                  <Select value={form.guilhotina} onValueChange={v => set("guilhotina", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione a guilhotina..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CORTE 3M">CORTE 3M</SelectItem>
                      <SelectItem value="CORTE 6M">CORTE 6M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tamanho de Corte na Guilhotina (mm)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 1000"
                    value={form.tamanho_corte_guilhotina}
                    onChange={e => set("tamanho_corte_guilhotina", e.target.value)}
                  />
                </div>
              </div>

              {/* Foto do pedido */}
              <div className="space-y-1">
                <Label className="flex items-center gap-1">
                  <Camera className="w-4 h-4 text-blue-500" /> Foto do Pedido
                </Label>
                <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => handleUploadFoto(e.target.files[0])} />
                <input ref={fotoScanRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleUploadFoto(e.target.files[0])} />
                {form.foto_pedido_url ? (
                  <div className="relative rounded-lg overflow-hidden border-2 border-blue-300">
                    <img src={form.foto_pedido_url} alt="Foto do pedido" className="w-full max-h-48 object-cover" />
                    <button type="button" onClick={() => set("foto_pedido_url", "")}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    <a href={form.foto_pedido_url} target="_blank" rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded hover:bg-black/80 transition-colors">
                      Abrir
                    </a>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadButton label="Anexar foto do pedido" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploadingFoto} size="default" />
                    <p className="text-xs text-muted-foreground">A foto acompanha a OP até a guilhotina</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Valor Pago pelo Cliente */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-green-600" /> Valor Pago pelo Cliente
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={form.valor_pago_cliente}
              onChange={e => set("valor_pago_cliente", e.target.value)}
            />
          </div>

          {/* Prioridade */}
          {isGestor && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => set("prioridade", !form.prioridade)}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all ${form.prioridade ? "border-amber-500 bg-amber-50" : "border-border bg-card hover:border-amber-300"}`}
              >
                <Star className={`w-4 h-4 ${form.prioridade ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
                <span className={`text-sm font-semibold ${form.prioridade ? "text-amber-700" : "text-muted-foreground"}`}>
                  {form.prioridade ? "OP Prioritária" : "Marcar como prioridade"}
                </span>
              </button>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1">
            <Label>Observações / Instruções para o Operador</Label>
            <Textarea
              placeholder="Ex: Atenção ao alinhamento, usar régua de 1250mm..."
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">
            {editItem ? "Salvar Alterações" : "Criar Ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmação para bobina reservada para outro pedido */}
      <AlertDialog open={confirmReserva} onOpenChange={setConfirmReserva}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="w-5 h-5" /> Confirmar uso de bobina reservada
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="text-red-600 font-semibold">
                  A bobina <strong>{bobinaObj?.codigo}</strong> está reservada para o pedido <strong>{bobinaObj?.reserva_numero_pedido || "?"}</strong>.
                </p>
                {bobinaObj?.reserva_motivo && <p>Motivo da reserva: {bobinaObj.reserva_motivo}</p>}
                {bobinaObj?.reserva_autorizado_por && <p>Reservado por: {bobinaObj.reserva_autorizado_por}</p>}
                <p className="text-foreground">
                  Tem certeza que deseja utilizar esta bobina mesmo assim? Esta ação pode comprometer o pedido para o qual ela foi reservada.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { setConfirmReserva(false); doSave(); }}
            >
              Sim, usar esta bobina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}