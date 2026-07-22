import React, { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import UploadButton from "@/components/ui/UploadButton";
import ImageLink from "@/components/ui/ImageLink";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";
import { getBobinaStatus, calcMetrosDisponiveis } from "@/lib/bobinaStatusHelper";
import { Building2, X, Loader2, FileText, Plus, Trash2 } from "lucide-react";

const MAQUINAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];
const PRODUTOS = ["TELHA", "TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA", "BOBININHA", "CUMEEIRA", "PAINEL"];

// Peso por metro linear conforme espessura
function calcKgPorMetro(bobinaTexto) {
  if (!bobinaTexto) return 0;
  const t = bobinaTexto.toLowerCase();
  if (t.includes("0,65")) return 5.80;
  if (t.includes("0,50")) return 4.40;
  if (t.includes("rvm") || t.includes("0,43 rvm")) return 3.80;
  if (t.includes("0,43")) return 3.65;
  return 0;
}

function labelBobina(b) {
  const codigo = b.codigo ? `${b.codigo} ` : "";
  const cor = b.cor ? ` — ${b.cor}` : "";
  const chapa = b.chapa ? `${b.chapa}` : "";
  const qual = b.qualidade ? ` (${b.qualidade})` : "";
  const peso = b.peso_kg ? ` · ${b.peso_kg}kg` : "";
  return `${codigo}${chapa}${qual}${cor}${peso}`;
}

const emptyForm = {
  data: format(new Date(), "yyyy-MM-dd"),
  unidade: "Matriz AJL",
  maquina: "",
  produto: "",
  modelo: "",
  cliente: "",
  vendedor: "",
  numero_pedido: "",
  bobina_superior: "",
  bobina_inferior: "",
  rvm_superior: "",
  rvm_inferior: "",
  eps: "",
  maquinario_superior: "",
  maquinario_inferior: "",
  kg_superior: "",
  kg_inferior: "",
  kg_total: "",
  metros: "",
  metragem_mm: "",
  quantidade_telhas: "",
  metragem_planejada: "",
  isopor_utilizado: "",
  status: "pendente",
  data_pedido: "",
  data_prevista: "",
  observacoes: "",
  foto_pedido_url: "",
  variacoes_telhas: "",
  rota: false,
  prioridade: false
};

export default function PedidoFormDialog({ open, onClose, onSave, editItem, defaultDate }) {
  const [form, setForm] = useState(emptyForm);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const cameraRef = useRef(null);
  const fileRef = useRef(null);

  const isPdf = (url) => {
    if (!url) return false;
    return url.toLowerCase().endsWith(".pdf");
  };

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, foto_pedido_url: file_url }));
    } catch {
      alert("Erro ao enviar foto da OP. Tente novamente.");
    } finally {
      setUploadingFoto(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-ativas"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false, setor: "telhas" }),
    enabled: open
  });

  const { data: ordensAtivas = [] } = useQuery({
    queryKey: ["ordens-ativas-telhas"],
    queryFn: () => base44.entities.OrdemProducao.filter({ arquivada: false }),
    enabled: open
  });

  const { preBaixaMap, statusMap } = usePreBaixaBobinas("telhas");

  const { data: modelosCad = [] } = useQuery({
    queryKey: ["modelos-produto"],
    queryFn: () => base44.entities.ModeloProduto.list("produto"),
    enabled: open
  });

  const { data: dadosEPS = [] } = useQuery({
    queryKey: ["dados-producao", "eps"],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo: "eps", ativo: true }),
    enabled: open
  });

  const { data: dadosRVM = [] } = useQuery({
    queryKey: ["dados-producao", "rvm"],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo: "rvm", ativo: true }),
    enabled: open
  });

  const { data: dadosVendedores = [] } = useQuery({
    queryKey: ["dados-producao", "vendedor"],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo: "vendedor", ativo: true }),
    enabled: open
  });

  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores"],
    queryFn: () => base44.entities.Isopor.list(),
    enabled: open
  });

  // Modelos filtrados pelo produto selecionado
  const modelosFiltrados = useMemo(() =>
  modelosCad.filter((m) => !form.produto || m.produto === form.produto),
  [modelosCad, form.produto]
  );

  // Tipos de EPS: usa cadastro se existir, senão fallback
  const tiposEPS = dadosEPS.length > 0 ?
  dadosEPS.map((d) => d.valor) :
  ["EPS - TP 25", "EPS - TP 40", "EPS - TP 40 BANDEJA", "EPS - COLONIAL", "EPS - COLONIAL BANDEJA", "EPS - ONDULADO"];

  // Encontra bobina selecionada (superior e inferior)
  const bobinaSuperiorObj = useMemo(() => bobinas.find((b) => b.id === form.bobina_superior), [bobinas, form.bobina_superior]);
  const bobinaInferiorObj = useMemo(() => bobinas.find((b) => b.id === form.bobina_inferior), [bobinas, form.bobina_inferior]);

  useEffect(() => {
    if (open) {
      if (editItem && !editItem._presets) {
        setForm({
          data: editItem.data || format(new Date(), "yyyy-MM-dd"),
          unidade: editItem.unidade || "Matriz AJL",
          maquina: editItem.maquina || "",
          produto: editItem.produto || "",
          modelo: editItem.modelo || "",
          cliente: editItem.cliente || "",
          vendedor: editItem.vendedor || "",
          numero_pedido: editItem.numero_pedido || "",
          bobina_superior: editItem.bobina_superior || "",
          bobina_inferior: editItem.bobina_inferior || "",
          rvm_superior: editItem.rvm_superior || "",
          rvm_inferior: editItem.rvm_inferior || "",
          eps: editItem.eps || "",
          maquinario_superior: editItem.maquinario_superior || "",
          maquinario_inferior: editItem.maquinario_inferior || "",
          kg_superior: editItem.kg_superior || "",
          kg_inferior: editItem.kg_inferior || "",
          kg_total: editItem.kg_total || "",
          metros: editItem.metros || "",
          metragem_mm: editItem.metragem_mm || "",
          quantidade_telhas: editItem.quantidade_telhas || "",
          metragem_planejada: editItem.metragem_planejada || "",
          status: editItem.status || "pendente",
          data_pedido: editItem.data_pedido || "",
          data_prevista: editItem.data_prevista || "",
          observacoes: editItem.observacoes || "",
          foto_pedido_url: editItem.foto_pedido_url || "",
          variacoes_telhas: editItem.variacoes_telhas || "",
          rota: editItem.rota || false,
          prioridade: editItem.prioridade || false
        });
      } else {
        const presets = editItem?._presets || {};
        setForm({
          ...emptyForm,
          data: presets.data || defaultDate || format(new Date(), "yyyy-MM-dd"),
          maquina: presets.maquina || ""
        });
      }
    }
  }, [open, editItem, defaultDate]);

  // Modelo sincronizado com a máquina — deriva automaticamente do cadastro
  const modeloAutoObj = useMemo(() => {
    if (!form.maquina || modelosCad.length === 0) return null;
    const maquinaNorm = form.maquina.toUpperCase().replace(/\s/g, "");
    return modelosCad.find(m => {
      const mNorm = (m.maquinas || "").toUpperCase().replace(/\s/g, "");
      const modNorm = (m.modelo || "").toUpperCase().replace(/\s/g, "");
      return mNorm.includes(maquinaNorm) || modNorm.includes(maquinaNorm);
    }) || null;
  }, [form.maquina, modelosCad]);

  // Fallback: deriva nome do modelo a partir da máquina quando não há cadastro
  const modeloFromMaquina = (maquina) => {
    if (!maquina) return "";
    const map = {
      "TP - 25": "TP-25",
      "TP - 40": "TP-40",
      "ONDULADA": "Ondulada",
      "COLONIAL": "Colonial",
      "BANDEJA": "Bandeja",
      "DESBOBINADOR": "Desbobinador",
      "CUMEEIRA": "Cumeeira",
      "COLAGEM": "Colagem",
    };
    return map[maquina] || maquina;
  };

  useEffect(() => {
    if (!open || !form.maquina) return;
    // Se encontrou no cadastro, usa o modelo cadastrado
    if (modeloAutoObj && modeloAutoObj.modelo !== form.modelo) {
      let epsAuto = "";
      const vUp = (modeloAutoObj.modelo || "").toUpperCase();
      if (vUp.includes("TP-25") || vUp.includes("TP25")) epsAuto = "EPS - TP 25";
      else if (vUp.includes("BANDEJA")) epsAuto = "EPS - TP 40 BANDEJA";
      else if (vUp.includes("TP-40") || vUp.includes("TP40")) epsAuto = "EPS - TP 40";
      else if (vUp.includes("COLONIAL BANDEJA")) epsAuto = "EPS - COLONIAL BANDEJA";
      else if (vUp.includes("COLONIAL")) epsAuto = "EPS - COLONIAL";
      else if (vUp.includes("ONDULAD")) epsAuto = "EPS - ONDULADO";
      setForm(f => ({ ...f, modelo: modeloAutoObj.modelo, eps: epsAuto || f.eps }));
    } else if (!modeloAutoObj && !form.modelo) {
      // Sem cadastro: deriva do nome da máquina
      const modFallback = modeloFromMaquina(form.maquina);
      let epsAuto = "";
      const vUp = modFallback.toUpperCase();
      if (vUp.includes("TP-25") || vUp.includes("TP25")) epsAuto = "EPS - TP 25";
      else if (vUp.includes("BANDEJA")) epsAuto = "EPS - TP 40 BANDEJA";
      else if (vUp.includes("TP-40") || vUp.includes("TP40")) epsAuto = "EPS - TP 40";
      else if (vUp.includes("COLONIAL")) epsAuto = "EPS - COLONIAL";
      else if (vUp.includes("ONDULAD")) epsAuto = "EPS - ONDULADO";
      setForm(f => ({ ...f, modelo: modFallback, eps: epsAuto || f.eps }));
    }
  }, [open, modeloAutoObj, form.maquina, form.modelo]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // ─── Variações de telhas (múltiplas medidas no mesmo pedido) ───
  const variacoes = useMemo(() => {
    try {
      const parsed = JSON.parse(form.variacoes_telhas || "[]");
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch { return null; }
  }, [form.variacoes_telhas]);

  const initVariacoesIfNeeded = () => {
    if (!variacoes) {
      // Migra dados existentes (metros + metragem_mm) para a primeira variação
      // e já traz a bobina global selecionada como padrão
      const primeira = {
        qty: form.metros ? String(form.metros) : "",
        mm: form.metragem_mm ? String(form.metragem_mm) : "",
        obs: "",
        bobina_id: form.bobina_superior || "",
        bobina_inf_id: form.bobina_inferior || "",
        bobina_desc: bobinaSuperiorObj ? labelBobina(bobinaSuperiorObj) : "",
        bobina_inf_desc: bobinaInferiorObj ? labelBobina(bobinaInferiorObj) : ""
      };
      setForm(f => ({ ...f, variacoes_telhas: JSON.stringify([primeira]) }));
    }
  };

  const addVariacao = () => {
    const atual = variacoes || [];
    // Nova variação herda a bobina da última variação como padrão
    const ultima = atual[atual.length - 1] || {};
    setForm(f => ({ ...f, variacoes_telhas: JSON.stringify([...atual, {
      qty: "", mm: "", obs: "",
      bobina_id: ultima.bobina_id || "",
      bobina_inf_id: ultima.bobina_inf_id || "",
      bobina_desc: ultima.bobina_desc || "",
      bobina_inf_desc: ultima.bobina_inf_desc || ""
    }]) }));
  };

  const removeVariacao = (idx) => {
    const atual = variacoes || [];
    if (atual.length <= 1) return;
    const novo = atual.filter((_, i) => i !== idx);
    setForm(f => ({ ...f, variacoes_telhas: JSON.stringify(novo) }));
  };

  const updateVariacao = (idx, field, val) => {
    const atual = variacoes || [{ qty: "", mm: "", obs: "", bobina_id: "", bobina_inf_id: "" }];
    const novo = atual.map((v, i) => {
      if (i !== idx) return v;
      const updated = { ...v, [field]: val };
      // Ao trocar a bobina, atualiza o snapshot de descrição
      if (field === "bobina_id") {
        const b = bobinas.find(x => x.id === val);
        updated.bobina_desc = b ? labelBobina(b) : "";
      }
      if (field === "bobina_inf_id") {
        const b = bobinas.find(x => x.id === val);
        updated.bobina_inf_desc = b ? labelBobina(b) : "";
      }
      return updated;
    });
    setForm(f => ({ ...f, variacoes_telhas: JSON.stringify(novo) }));
    // Recalcula KG e totais
    recalcFromVariacoes(novo);
  };

  // Calcula totais a partir das variações
  const calcTotaisVariacoes = (vars) => {
    let totalTelhas = 0;
    let totalMm = 0; // soma de qty × mm
    vars.forEach(v => {
      const q = Number(v.qty) || 0;
      const mm = Number(v.mm) || 0;
      totalTelhas += q;
      totalMm += q * mm;
    });
    const totalMetros = totalMm / 1000;
    return { totalTelhas, totalMm, totalMetros };
  };

  const recalcFromVariacoes = (vars) => {
    const { totalTelhas, totalMetros } = calcTotaisVariacoes(vars);
    const newForm = { ...form, variacoes_telhas: JSON.stringify(vars) };

    // Mantém metros (qtd telhas) e metragem_mm (primeira variação) sincronizados para compat
    newForm.metros = totalTelhas || "";
    const primeiraMm = vars[0]?.mm;
    newForm.metragem_mm = primeiraMm ? Number(primeiraMm) : "";
    newForm.quantidade_telhas = totalTelhas > 0 ? +totalTelhas.toFixed(2) : "";

    // KG calculado por variação — cada item usa sua própria bobina
    let totalKgSup = 0;
    let totalKgInf = 0;
    vars.forEach(v => {
      const q = Number(v.qty) || 0;
      const mm = Number(v.mm) || 0;
      const metrosVar = (q * mm) / 1000;
      if (metrosVar > 0 && v.bobina_id) {
        const b = bobinas.find(x => x.id === v.bobina_id);
        const chapa = Number(b?.chapa) || 0;
        if (chapa > 0) totalKgSup += chapa * metrosVar;
      }
      if (metrosVar > 0 && v.bobina_inf_id) {
        const b = bobinas.find(x => x.id === v.bobina_inf_id);
        const chapa = Number(b?.chapa) || 0;
        if (chapa > 0) totalKgInf += chapa * metrosVar;
      }
    });
    newForm.kg_superior = totalKgSup > 0 ? +totalKgSup.toFixed(1) : "";
    newForm.kg_inferior = totalKgInf > 0 ? +totalKgInf.toFixed(1) : "";
    newForm.kg_total = recalcTotal(newForm.kg_superior, newForm.kg_inferior);
    setForm(newForm);
  };

  // Calcula metragem total (em metros) — suporta variações ou modo legado
  const calcMetragemTotalM = (formData) => {
    const vars = (() => {
      try {
        const parsed = JSON.parse(formData.variacoes_telhas || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    })();
    if (vars.length > 0) {
      return vars.reduce((sum, v) => sum + (Number(v.qty) || 0) * (Number(v.mm) || 0), 0) / 1000;
    }
    return (Number(formData.metros) || 0) * ((Number(formData.metragem_mm) || 0) / 1000);
  };

  // Quando selecionar bobina superior, preenche RVM/Cor automaticamente
  const handleBobinaSupChange = (bobinaId) => {
    const b = bobinas.find((x) => x.id === bobinaId);
    const novoForm = { ...form, bobina_superior: bobinaId };
    if (b) {
      novoForm.rvm_superior = b.cor || "";
      const metragemTotal = calcMetragemTotalM(form);
      const chapa = Number(b.chapa) || 0;
      if (metragemTotal > 0 && chapa > 0) {
        novoForm.kg_superior = +(chapa * metragemTotal).toFixed(1);
        novoForm.kg_total = recalcTotal(novoForm.kg_superior, form.kg_inferior);
      }
    }
    setForm(novoForm);
  };

  const handleBobinaInfChange = (bobinaId) => {
    const b = bobinas.find((x) => x.id === bobinaId);
    const novoForm = { ...form, bobina_inferior: bobinaId };
    if (b) {
      novoForm.rvm_inferior = b.cor || "";
      const metragemTotal = calcMetragemTotalM(form);
      const chapa = Number(b.chapa) || 0;
      if (metragemTotal > 0 && chapa > 0) {
        novoForm.kg_inferior = +(chapa * metragemTotal).toFixed(1);
        novoForm.kg_total = recalcTotal(form.kg_superior, novoForm.kg_inferior);
      }
    }
    setForm(novoForm);
  };

  // Recalcula quantidade de telhas: quantidade × comprimento_telha_em_m
  const calcQtdTelhas = (metros, metragem_mm) => {
    const m = Number(metros) || 0;
    const comp = Number(metragem_mm) || 0;
    if (m <= 0 || comp <= 0) return "";
    return +(m * (comp / 1000)).toFixed(2);
  };

  // Quando metros mudar, recalcula kg, quantidade de telhas e isopor automaticamente
  const handleMetrosChange = (val) => {
    const metros = Number(val) || 0;
    const newForm = { ...form, metros: val };

    // Quantidade de telhas = metros / (metragem_mm / 1000)
    newForm.quantidade_telhas = calcQtdTelhas(val, form.metragem_mm);

    // Metragem total do pedido
    const metragemTotalM = metros * ((Number(form.metragem_mm) || 0) / 1000);
    
    // Isopor: cada telha consome ceil(comprimento_telha / 2) placas individualmente
    const comprTelhaM = (Number(form.metragem_mm) || 0) / 1000;
    if (metros > 0 && comprTelhaM > 0) {
      const placasPorTelha = Math.ceil(comprTelhaM / 2);
      const placasInteirasPorTelha = Math.floor(comprTelhaM / 2);
      const sobraPorTelha = +(comprTelhaM - placasInteirasPorTelha * 2).toFixed(4);
      const totalPlacas = placasPorTelha * metros;
      const totalInteiras = placasInteirasPorTelha * metros;
      const totalPedacos = sobraPorTelha > 0 ? metros : 0;
      newForm.isopor_utilizado = { total: totalPlacas, pecasInteiras: totalInteiras, pedacos: totalPedacos, sobraMm: Math.round(sobraPorTelha * 1000) };
    } else {
      newForm.isopor_utilizado = "";
    }

    // KG = chapa × metragem total
    if (bobinaSuperiorObj && metragemTotalM > 0) {
      const chapa = Number(bobinaSuperiorObj.chapa) || 0;
      if (chapa > 0) newForm.kg_superior = +(chapa * metragemTotalM).toFixed(1);
    }
    if (bobinaInferiorObj && metragemTotalM > 0) {
      const chapa = Number(bobinaInferiorObj.chapa) || 0;
      if (chapa > 0) newForm.kg_inferior = +(chapa * metragemTotalM).toFixed(1);
    }
    newForm.kg_total = recalcTotal(newForm.kg_superior, newForm.kg_inferior);
    setForm(newForm);
  };

  const handleMetragemMmChange = (val) => {
    const newForm = { ...form, metragem_mm: val };
    const metros = Number(form.metros) || 0;
    const metragemTotalM = metros * ((Number(val) || 0) / 1000);
    
    newForm.quantidade_telhas = calcQtdTelhas(form.metros, val);
    
    // Isopor: cada telha consome ceil(comprimento_telha / 2) placas individualmente
    const comprTelhaMVal = (Number(val) || 0) / 1000;
    const metrosAtual = Number(form.metros) || 0;
    if (metrosAtual > 0 && comprTelhaMVal > 0) {
      const placasPorTelha = Math.ceil(comprTelhaMVal / 2);
      const placasInteirasPorTelha = Math.floor(comprTelhaMVal / 2);
      const sobraPorTelha = +(comprTelhaMVal - placasInteirasPorTelha * 2).toFixed(4);
      const totalPlacas = placasPorTelha * metrosAtual;
      const totalInteiras = placasInteirasPorTelha * metrosAtual;
      const totalPedacos = sobraPorTelha > 0 ? metrosAtual : 0;
      newForm.isopor_utilizado = { total: totalPlacas, pecasInteiras: totalInteiras, pedacos: totalPedacos, sobraMm: Math.round(sobraPorTelha * 1000) };
    } else {
      newForm.isopor_utilizado = "";
    }

    // KG = chapa × metragem total
    if (bobinaSuperiorObj && metragemTotalM > 0) {
      const chapa = Number(bobinaSuperiorObj.chapa) || 0;
      if (chapa > 0) newForm.kg_superior = +(chapa * metragemTotalM).toFixed(1);
    }
    if (bobinaInferiorObj && metragemTotalM > 0) {
      const chapa = Number(bobinaInferiorObj.chapa) || 0;
      if (chapa > 0) newForm.kg_inferior = +(chapa * metragemTotalM).toFixed(1);
    }
    newForm.kg_total = recalcTotal(newForm.kg_superior, newForm.kg_inferior);
    setForm(newForm);
  };

  const recalcTotal = (sup, inf) => {
    const s = Number(sup) || 0;
    const i = Number(inf) || 0;
    return s + i > 0 ? +(s + i).toFixed(1) : "";
  };

  const handleSave = async () => {
    // Validação de dados obrigatórios
    if (!form.data) { alert("Informe a data do pedido."); return; }
    if (!form.produto) { alert("Selecione o tipo de produto."); return; }

    // Monta dados do pedido — em modo variações, deriva bobinas da 1ª variação
    let bobinaSupId = form.bobina_superior;
    let bobinaInfId = form.bobina_inferior;
    let bobinaSupTexto = bobinaSuperiorObj ? labelBobina(bobinaSuperiorObj) : form.bobina_superior;
    let bobinaInfTexto = bobinaInferiorObj ? labelBobina(bobinaInferiorObj) : form.bobina_inferior;
    if (variacoes && variacoes.length > 0) {
      const fv = variacoes[0];
      if (fv.bobina_id) {
        bobinaSupId = fv.bobina_id;
        const b = bobinas.find(x => x.id === fv.bobina_id);
        if (b) bobinaSupTexto = labelBobina(b);
      }
      if (fv.bobina_inf_id) {
        bobinaInfId = fv.bobina_inf_id;
        const b = bobinas.find(x => x.id === fv.bobina_inf_id);
        if (b) bobinaInfTexto = labelBobina(b);
      }
    }
    const data = {
      ...form,
      bobina_superior_id: bobinaSupId,
      bobina_inferior_id: bobinaInfId,
      bobina_superior: bobinaSupTexto,
      bobina_inferior: bobinaInfTexto,
      kg_superior: form.kg_superior !== "" ? Number(form.kg_superior) : undefined,
      kg_inferior: form.kg_inferior !== "" ? Number(form.kg_inferior) : undefined,
      kg_total: form.kg_total !== "" ? Number(form.kg_total) : undefined,
      metros: form.metros ? Number(form.metros) : undefined,
      metragem_mm: form.metragem_mm ? Number(form.metragem_mm) : undefined,
      quantidade_telhas: form.quantidade_telhas ? Number(form.quantidade_telhas) : undefined,
      metragem_planejada: form.metragem_planejada ? Number(form.metragem_planejada) : undefined,
      isopor_utilizado: form.isopor_utilizado ? form.isopor_utilizado.total : undefined
    };

    // Validação de pré-baixa: verifica se cada bobina tem peso suficiente
    const bobinasChecar = [];
    if (variacoes && variacoes.length > 0) {
      const kgPorBobina = {};
      variacoes.forEach(v => {
        const q = Number(v.qty) || 0;
        const mm = Number(v.mm) || 0;
        const metros = q * mm / 1000;
        if (metros > 0 && v.bobina_id) {
          const b = bobinas.find(x => x.id === v.bobina_id);
          const chapa = Number(b?.chapa) || 0;
          if (chapa > 0) kgPorBobina[v.bobina_id] = (kgPorBobina[v.bobina_id] || 0) + chapa * metros;
        }
        if (metros > 0 && v.bobina_inf_id) {
          const b = bobinas.find(x => x.id === v.bobina_inf_id);
          const chapa = Number(b?.chapa) || 0;
          if (chapa > 0) kgPorBobina[v.bobina_inf_id] = (kgPorBobina[v.bobina_inf_id] || 0) + chapa * metros;
        }
      });
      Object.entries(kgPorBobina).forEach(([bid, kg]) => bobinasChecar.push({ id: bid, kg }));
    } else {
      if (bobinaSupId && Number(form.kg_superior) > 0) bobinasChecar.push({ id: bobinaSupId, kg: Number(form.kg_superior) });
      if (bobinaInfId && Number(form.kg_inferior) > 0) bobinasChecar.push({ id: bobinaInfId, kg: Number(form.kg_inferior) });
    }

    const insuficientes = bobinasChecar.filter(bc => {
      const b = bobinas.find(x => x.id === bc.id);
      if (!b) return false;
      const preBaixa = preBaixaMap[bc.id] || 0;
      const disp = (b.peso_kg || 0) - preBaixa;
      return disp < bc.kg;
    });

    if (insuficientes.length > 0) {
      const msgs = insuficientes.map(bc => {
        const b = bobinas.find(x => x.id === bc.id);
        const pb = preBaixaMap[bc.id] || 0;
        const disp = (b?.peso_kg || 0) - pb;
        return `${b?.codigo || '—'}: ${disp.toFixed(1)}kg disp. / ${bc.kg.toFixed(1)}kg necessário`;
      });
      alert(`⚠️ Material insuficiente!\n\n${msgs.join('\n')}\n\nO pedido será criado como "OP sem Material".`);
      const primeira = bobinas.find(x => x.id === insuficientes[0].id);
      onSave({
        ...data,
        material_em_falta: true,
        material_espessura: primeira?.chapa || "",
        material_cor: primeira?.cor || "",
        status: "aguardando_material",
        bobina_superior_id: "",
        bobina_inferior_id: "",
      });
      return;
    }

    onSave(data);
  };

  const precisaEPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(form.produto);
  const precisaBobinaInferior = ["TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(form.produto);
  const isEditing = editItem && !editItem._presets;

  // Bobinas ativas ordenadas por chapa
  const bobinasList = [...bobinas].sort((a, b) => {
    const ca = `${a.chapa}${a.qualidade}${a.cor}`.toLowerCase();
    const cb = `${b.chapa}${b.qualidade}${b.cor}`.toLowerCase();
    return ca.localeCompare(cb);
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Pedido" : "Novo Pedido"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Linha 1: Data / Produto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Produto *</Label>
              <Select value={form.produto} onValueChange={(v) => {set("produto", v);set("modelo", "");set("maquina", "");}}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{PRODUTOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Modelo — sincronizado automaticamente com a máquina */}
          <div className="space-y-1">
            <Label>Modelo</Label>
            <div className="flex items-center gap-3 border border-border rounded-md px-3 py-2 bg-muted/30">
              <span className="font-semibold text-sm">{form.modelo || <span className="text-muted-foreground">Sincronizado com a máquina</span>}</span>
              {modeloAutoObj?.espessuras && (
                <span className="text-xs text-muted-foreground">· {modeloAutoObj.espessuras}</span>
              )}
              {form.maquina && (
                <span className="ml-auto text-xs text-muted-foreground">Máquina: <strong className="text-foreground">{form.maquina}</strong></span>
              )}
            </div>
          </div>

          {/* Vendedor / Cliente / Pedido */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Vendedor</Label>
              <Select value={form.vendedor} onValueChange={(v) => set("vendedor", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                <SelectContent>
                  {dadosVendedores.map((d) => <SelectItem key={d.id} value={d.valor}>{d.valor}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Input placeholder="Nome do cliente" value={form.cliente} onChange={(e) => set("cliente", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nº Pedido</Label>
              <Input placeholder="283427" value={form.numero_pedido} onChange={(e) => set("numero_pedido", e.target.value)} />
            </div>
          </div>

          {/* Bobinas - do estoque real (apenas modo legado, sem variações) */}
          {!variacoes && (
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-sm font-semibold text-foreground">Bobinas do Estoque</p>

            {/* Bobina Superior */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bobina Superior</Label>
              <Select value={form.bobina_superior} onValueChange={handleBobinaSupChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a bobina do estoque..." />
                </SelectTrigger>
                <SelectContent>
                  {bobinasList.map((b) => {
                    const pb = preBaixaMap[b.id] || 0;
                    const pesoBruto = b.peso_kg || 0;
                    const dispLivre = Math.max(0, pesoBruto - pb);
                    const metrosLivres = calcMetrosDisponiveis(b, dispLivre);
                    const metrosBrutos = calcMetrosDisponiveis(b, pesoBruto);
                    const st = getBobinaStatus(b, ordensAtivas, statusMap);
                    return (
                      <SelectItem key={b.id} value={b.id} className="py-2.5 cursor-pointer">
                        <div className="flex items-center justify-between gap-2 w-full pr-2">
                          <div className="space-y-0.5">
                            {/* Linha 1: Identificação */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {b.codigo && <span className="font-mono font-bold text-primary text-xs">{b.codigo}</span>}
                              <span className="font-medium text-xs">{b.chapa}</span>
                              {b.qualidade && <span className="text-muted-foreground text-[11px]">({b.qualidade})</span>}
                              {b.cor && <span className="text-blue-600 font-semibold text-[11px]">— {b.cor}</span>}
                            </div>
                            {/* Linha 2: Peso e metros */}
                            {pb > 0 ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-muted-foreground text-[10px]">
                                  Total: {pesoBruto.toLocaleString("pt-BR")}kg{metrosBrutos ? ` (~${metrosBrutos.toLocaleString("pt-BR")}m)` : ""}
                                </span>
                                <span className="text-amber-600 text-[10px] font-bold">
                                  − {pb.toFixed(0)}kg reservado
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                  = {dispLivre.toFixed(0)}kg livre{metrosLivres ? ` (~${metrosLivres.toLocaleString("pt-BR")}m)` : ""}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                  {dispLivre.toFixed(0)}kg disp.{metrosLivres ? ` (~${metrosLivres.toLocaleString("pt-BR")}m)` : ""}
                                </span>
                              </div>
                            )}
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
                  {bobinaSuperiorObj && (() => {
                    const pb = preBaixaMap[bobinaSuperiorObj.id] || 0;
                    const disp = (bobinaSuperiorObj.peso_kg || 0) - pb;
                    return (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex flex-wrap gap-3 items-center">
                  <span>Cód: <strong>{bobinaSuperiorObj.codigo || "—"}</strong></span>
                  <span>Cor/RVM: <strong>{bobinaSuperiorObj.cor || "—"}</strong></span>
                  <span>Qualidade: <strong>{bobinaSuperiorObj.qualidade || "—"}</strong></span>
                  <span>Peso: <strong>{bobinaSuperiorObj.peso_kg || 0}kg</strong></span>
                  {pb > 0 && <span className="text-blue-600 font-semibold">Pré-baixa: <strong>{pb.toFixed(1)}kg</strong></span>}
                  <span className="text-emerald-700 font-semibold">Disponível: <strong>{disp.toFixed(1)}kg</strong></span>
                  {bobinaSuperiorObj.metragem_restante && <span>Metragem: <strong>{bobinaSuperiorObj.metragem_restante}m restantes</strong></span>}
                  {form.kg_superior &&
                <span className="ml-auto bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold text-xs">
                      ↓ {form.kg_superior} kg serão usados
                    </span>
                }
                </div>
                    );
                  })()
              }
            </div>

            {/* Bobina Inferior (condicionalmente) */}
            {precisaBobinaInferior &&
            <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bobina Inferior</Label>
                <Select value={form.bobina_inferior} onValueChange={handleBobinaInfChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a bobina inferior..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bobinasList.map((b) => {
                      const pb = preBaixaMap[b.id] || 0;
                      const pesoBruto = b.peso_kg || 0;
                      const dispLivre = Math.max(0, pesoBruto - pb);
                      const metrosLivres = calcMetrosDisponiveis(b, dispLivre);
                      const metrosBrutos = calcMetrosDisponiveis(b, pesoBruto);
                      const st = getBobinaStatus(b, ordensAtivas, statusMap);
                      return (
                        <SelectItem key={b.id} value={b.id} className="py-2.5 cursor-pointer">
                          <div className="flex items-center justify-between gap-2 w-full pr-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {b.codigo && <span className="font-mono font-bold text-primary text-xs">{b.codigo}</span>}
                                <span className="font-medium text-xs">{b.chapa}</span>
                                {b.qualidade && <span className="text-muted-foreground text-[11px]">({b.qualidade})</span>}
                                {b.cor && <span className="text-blue-600 font-semibold text-[11px]">— {b.cor}</span>}
                              </div>
                              {pb > 0 ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-muted-foreground text-[10px]">
                                    Total: {pesoBruto.toLocaleString("pt-BR")}kg{metrosBrutos ? ` (~${metrosBrutos.toLocaleString("pt-BR")}m)` : ""}
                                  </span>
                                  <span className="text-amber-600 text-[10px] font-bold">
                                    − {pb.toFixed(0)}kg reservado
                                  </span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                    = {dispLivre.toFixed(0)}kg livre{metrosLivres ? ` (~${metrosLivres.toLocaleString("pt-BR")}m)` : ""}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                    {dispLivre.toFixed(0)}kg disp.{metrosLivres ? ` (~${metrosLivres.toLocaleString("pt-BR")}m)` : ""}
                                  </span>
                                </div>
                              )}
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
                    {bobinaInferiorObj && (() => {
                    const pb = preBaixaMap[bobinaInferiorObj.id] || 0;
                    const disp = (bobinaInferiorObj.peso_kg || 0) - pb;
                    return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex flex-wrap gap-3 items-center">
                     <span>Cód: <strong>{bobinaInferiorObj.codigo || "—"}</strong></span>
                     <span>Cor/RVM: <strong>{bobinaInferiorObj.cor || "—"}</strong></span>
                     <span>Qualidade: <strong>{bobinaInferiorObj.qualidade || "—"}</strong></span>
                     <span>Peso: <strong>{bobinaInferiorObj.peso_kg || 0}kg</strong></span>
                     {pb > 0 && <span className="text-blue-600 font-semibold">Pré-baixa: <strong>{pb.toFixed(1)}kg</strong></span>}
                     <span className="text-emerald-700 font-semibold">Disponível: <strong>{disp.toFixed(1)}kg</strong></span>
                     {form.kg_inferior &&
                    <span className="ml-auto bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold text-xs">
                         ↓ {form.kg_inferior} kg serão usados
                       </span>
                    }
                    </div>
                    );
                    })()
                    }
              </div>
            }
          </div>
          )}

          {/* EPS */}
          {precisaEPS &&
          <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-sm font-semibold">EPS / Isopor <span className="text-xs font-normal text-muted-foreground">— processo: COLAGEM</span></p>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de EPS</Label>
                <Select value={form.eps || ""} onValueChange={(v) => set("eps", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o modelo para definir o EPS" /></SelectTrigger>
                  <SelectContent>
                    {tiposEPS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Quantidade de isopor calculada automaticamente */}
              {form.isopor_utilizado ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-orange-800">Placas de Isopor Necessárias</p>
                    <span className="text-xl font-black text-orange-700">{form.isopor_utilizado.total} placas</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {form.isopor_utilizado.pecasInteiras > 0 && (
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                        {form.isopor_utilizado.pecasInteiras} inteiras (2m)
                      </span>
                    )}
                    {form.isopor_utilizado.pedacos > 0 && (
                      <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                        {form.isopor_utilizado.pedacos} pedaços ({form.isopor_utilizado.sobraMm}mm)
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  Preencha as quantidades para calcular isopor
                </div>
              )}
            </div>
          }

          {/* Quantidades — Múltiplas Variações */}
          <div className="border border-border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Quantidades</p>
              {variacoes && variacoes.length > 1 && (
                <Badge variant="secondary" className="text-xs">{variacoes.length} medidas</Badge>
              )}
            </div>

            {!variacoes ? (
              /* Modo legado — botão para iniciar variações */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade de Chapas</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.metros}
                      onChange={(e) => handleMetrosChange(e.target.value)}
                      className="font-bold text-lg border-primary/50 focus:border-primary" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Metragem Individual (mm)
                      {form.metragem_mm && Number(form.metragem_mm) > 0 &&
                        <span className="text-muted-foreground ml-1">({(Number(form.metragem_mm) / 1000).toFixed(3)}m)</span>
                      }
                    </Label>
                    <Input
                      type="number"
                      placeholder="ex: 5000"
                      value={form.metragem_mm}
                      onChange={(e) => handleMetragemMmChange(e.target.value)} />
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="w-full gap-1" onClick={initVariacoesIfNeeded}>
                  <Plus className="w-3 h-3" /> Adicionar múltiplas medidas
                </Button>
              </div>
            ) : (
              /* Modo variações — múltiplas linhas */
              <div className="space-y-2">
                {variacoes.map((v, idx) => {
                  const q = Number(v.qty) || 0;
                  const mm = Number(v.mm) || 0;
                  const subtotalMm = q * mm;
                  const subtotalM = subtotalMm / 1000;
                  return (
                    <div key={idx} className="border border-border rounded-lg p-2.5 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground">Medida {idx + 1}</span>
                        {variacoes.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => removeVariacao(idx)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Qtd. Telhas</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={v.qty}
                            onChange={(e) => updateVariacao(idx, "qty", e.target.value)}
                            className="font-bold text-base border-primary/50 focus:border-primary h-9" />
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">
                            Metragem (mm)
                            {mm > 0 && <span className="text-muted-foreground ml-1">({(mm / 1000).toFixed(3)}m)</span>}
                          </Label>
                          <Input
                            type="number"
                            placeholder="ex: 5000"
                            value={v.mm}
                            onChange={(e) => updateVariacao(idx, "mm", e.target.value)}
                            className="h-9" />
                        </div>
                      </div>
                      {/* Bobina desta variação */}
                      <div className="space-y-0.5">
                        <Label className="text-xs text-muted-foreground">
                          Bobina {precisaBobinaInferior ? "Superior" : "do Item"}
                        </Label>
                        <Select value={v.bobina_id || ""} onValueChange={(val) => updateVariacao(idx, "bobina_id", val)}>
                         <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecionar bobina para esta medida..." /></SelectTrigger>
                         <SelectContent>
                           {bobinasList.map((b) => {
                             const pb = preBaixaMap[b.id] || 0;
                             const disp = (b.peso_kg || 0) - pb;
                             return (
                             <SelectItem key={b.id} value={b.id}>
                               {b.codigo && <span className="font-mono font-bold text-primary">{b.codigo}</span>}
                               <span className="font-medium ml-1">{b.chapa}</span>
                               {b.qualidade && <span className="text-muted-foreground"> ({b.qualidade})</span>}
                               {b.cor && <span className="text-blue-600"> — {b.cor}</span>}
                               {b.peso_kg && <span className="text-muted-foreground text-xs"> · {disp.toFixed(0)}kg disp.</span>}
                               {pb > 0 && <span className="text-blue-500 text-xs">(pré-baixa: {pb.toFixed(0)}kg)</span>}
                             </SelectItem>
                             );
                           })}
                          </SelectContent>
                        </Select>
                      </div>
                      {precisaBobinaInferior && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Bobina Inferior do Item</Label>
                          <Select value={v.bobina_inf_id || ""} onValueChange={(val) => updateVariacao(idx, "bobina_inf_id", val)}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecionar bobina inferior..." /></SelectTrigger>
                            <SelectContent>
                              {bobinasList.map((b) => {
                                const pb = preBaixaMap[b.id] || 0;
                                const disp = (b.peso_kg || 0) - pb;
                                return (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.codigo && <span className="font-mono font-bold text-primary">{b.codigo}</span>}
                                  <span className="font-medium ml-1">{b.chapa}</span>
                                  {b.qualidade && <span className="text-muted-foreground"> ({b.qualidade})</span>}
                                  {b.cor && <span className="text-blue-600"> — {b.cor}</span>}
                                  {b.peso_kg && <span className="text-muted-foreground text-xs"> · {disp.toFixed(0)}kg disp.</span>}
                                  {pb > 0 && <span className="text-blue-500 text-xs">(pré-baixa: {pb.toFixed(0)}kg)</span>}
                                </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <Label className="text-xs text-muted-foreground">OBS desta medida</Label>
                        <Input
                          placeholder="Observação específica (opcional)"
                          value={v.obs}
                          onChange={(e) => updateVariacao(idx, "obs", e.target.value)}
                          className="h-9 text-sm" />
                      </div>
                      {q > 0 && mm > 0 && (
                        <p className="text-xs text-primary font-medium">
                          Subtotal: {subtotalMm.toLocaleString("pt-BR")}mm ({subtotalM.toFixed(2)}m)
                        </p>
                      )}
                    </div>
                  );
                })}

                <Button type="button" variant="outline" size="sm" className="w-full gap-1 border-dashed" onClick={addVariacao}>
                  <Plus className="w-3 h-3" /> Adicionar outra medida
                </Button>

                {/* Totais */}
                {(() => {
                  const { totalTelhas, totalMm, totalMetros } = calcTotaisVariacoes(variacoes);
                  if (totalTelhas <= 0 || totalMm <= 0) return null;
                  return (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Soma Total de Todas as Medidas</p>
                          <p className="text-xs text-muted-foreground">{totalTelhas} telhas no total</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-primary">
                            {totalMm.toLocaleString("pt-BR")}mm
                          </span>
                          <p className="text-sm font-semibold text-primary/80">
                            ({totalMetros.toFixed(2)}m)
                          </p>
                        </div>
                      </div>
                      {form.kg_total && (
                        <div className="flex items-center justify-between border-t border-primary/20 pt-2">
                          <p className="text-xs font-medium text-muted-foreground">Peso Total (KG)</p>
                          <div className="flex gap-2">
                            {form.kg_superior && (
                              <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold text-xs">
                                Sup: {form.kg_superior} kg
                              </span>
                            )}
                            {form.kg_inferior && (
                              <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold text-xs">
                                Inf: {form.kg_inferior} kg
                              </span>
                            )}
                            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold text-xs">
                              Total: {form.kg_total} kg
                            </span>
                          </div>
                        </div>
                      )}
                      {form.kg_superior && (
                        <p className="text-xs text-blue-600 font-medium">
                          {variacoes && variacoes.some(v => v.bobina_id)
                            ? `↓ ${new Set(variacoes.filter(v => v.bobina_id).map(v => v.bobina_id)).size} bobina(s) serão descontadas ao finalizar`
                            : `↓ Será descontado da bobina ${bobinaSuperiorObj?.codigo || ""} ao finalizar`
                          }
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Metragem Planejada de Bobina</Label>
              <Input
                type="number"
                placeholder="Quantos metros de bobina serão usados"
                value={form.metragem_planejada}
                onChange={(e) => set("metragem_planejada", e.target.value)} />
              <p className="text-xs text-muted-foreground">O operador vai registrar o que realmente usou na máquina</p>
            </div>
          </div>

          {/* Datas e Status */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data do Pedido</Label>
              <Input type="date" value={form.data_pedido} onChange={(e) => set("data_pedido", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Prevista</Label>
              <Input type="date" value={form.data_prevista} onChange={(e) => set("data_prevista", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_producao">Em Produção</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Anotações, instruções especiais..." value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} className="h-16" />
          </div>

          {/* Foto da OP física */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              Foto da OP Física
            </Label>
            <input type="file" accept="image/*" capture="environment" ref={cameraRef} className="hidden" onChange={handleUploadFoto} />
            <input type="file" accept="image/*,application/pdf" ref={fileRef} className="hidden" onChange={handleUploadFoto} />
            {form.foto_pedido_url ? (
              <div className="flex items-center gap-3">
                {isPdf(form.foto_pedido_url) ? (
                  <ImageLink url={form.foto_pedido_url} name="OP Física" className="block">
                    <div className="flex items-center gap-2 border-2 border-primary/30 rounded-lg px-3 py-2 cursor-pointer hover:bg-accent transition-colors">
                      <FileText className="w-8 h-8 text-primary" />
                      <div className="text-xs">
                        <p className="font-medium text-foreground">OP Física (PDF)</p>
                        <p className="text-muted-foreground">Toque para abrir</p>
                      </div>
                    </div>
                  </ImageLink>
                ) : (
                  <ImageLink url={form.foto_pedido_url} name="OP Física" className="block">
                    <img src={form.foto_pedido_url} alt="OP Física" className="w-24 h-24 object-cover rounded-lg border-2 border-primary/30 cursor-pointer" />
                  </ImageLink>
                )}
                <Button type="button" variant="outline" size="sm" className="gap-1 text-red-600 border-red-300" onClick={() => set("foto_pedido_url", "")}>
                  <X className="w-3 h-3" /> Remover
                </Button>
              </div>
            ) : (
              <UploadButton
                label="Anexar Foto da OP"
                cameraRef={cameraRef}
                fileRef={fileRef}
                uploading={uploadingFoto}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>
            {isEditing ? "Salvar Alterações" : "Registrar Pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}