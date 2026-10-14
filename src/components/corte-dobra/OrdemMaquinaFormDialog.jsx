import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Layers, Camera, PackageX, Lock, Flame, Route, User as UserIcon, Zap, ChevronDown, ChevronUp, CheckCircle2, Search, Sparkles } from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";
import ChapaEstoqueCombobox from "@/components/corte-dobra/ChapaEstoqueCombobox";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";
import { getBobinaStatus } from "@/lib/bobinaStatusHelper";

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

const MAQUINAS_DESB    = ["DESBOBINADEIRA 01", "DESBOBINADEIRA 02"];
const MAQUINAS_CORTE   = ["CORTE 3M", "CORTE 6M"];
const MAQUINAS_DOBRA   = ["DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M"];
const MAQUINAS_TODAS   = ["DESBOBINADEIRA 01", "DESBOBINADEIRA 02", "CORTE 3M", "CORTE 6M", "DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA"];
const MAQUINAS_PERF    = ["PERFILADEIRA"];

function getMaquinasPorEtapa(etapa) {
  if (etapa === "corte") return [...MAQUINAS_DESB, ...MAQUINAS_CORTE];
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

export default function OrdemMaquinaFormDialog({ open, onClose, onSave, editItem, defaultDate, maquina: maquinaProp, produtoFixo, unidadeEstoque }) {
  const [form, setForm] = useState({
    data: format(new Date(), "yyyy-MM-dd"),
    maquina: maquinaProp || "",
    chapa_origem: "chaparia",
    chapa_cd_id: "",
    bobina_id: "",
    tipo_peca: "",
    dimensoes_livres: "",
    comprimento_mm: "",
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
    prioridade: false,
    prioridade_nivel: null,
    rota: false,
  });
  const fotoPedidoRef = useRef();
  const fotoPedidoScanRef = useRef();
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [modoDigitarVendedor, setModoDigitarVendedor] = useState(false);

  const { filialAtiva } = useFilial();
  // Unidade usada para buscar o estoque: prioriza a unidade do pedido da Fila PCP
  // (a OP pertence à filial do pedido, não à filial ativa no seletor do usuário)
  const unidadeConsulta = unidadeEstoque || filialAtiva;

  // flags de máquina
  const isDesbobinadeira = ["DESBOBINADEIRA 01", "DESBOBINADEIRA 02", "DESBOBINADEIRA"].includes(form.maquina);
  const isCorte = ["CORTE 3M", "CORTE 6M"].includes(form.maquina);
  const isDobra = ["DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M"].includes(form.maquina);
  const isMaquinaPadrao = isCorte || isDobra;
  const maxComprimento = form.maquina?.includes("3M") ? 3000 : form.maquina?.includes("6M") ? 6000 : 99999;

  // Bobinas ativas do estoque de C&D (somente setor corte_dobra, busca tolerante)
  const { data: todasBobinasRaw = [], isLoading: carregandoBobinas } = useQuery({
    queryKey: ["bobinas-cd-estoque", unidadeConsulta],
    queryFn: async () => {
      let bobs = [];
      try {
        const res = await base44.entities.Bobina.filter({ setor: "corte_dobra" }, "-created_date", 2000);
        if (Array.isArray(res) && res.length > 0) bobs = res;
      } catch (e1) {
        console.warn("[OrdemMaquinaFormDialog] Falha ao filtrar Bobinas C&D:", e1);
      }
      if (bobs.length === 0) {
        try {
          const res = await base44.entities.Bobina.list("-created_date", 2000);
          if (Array.isArray(res) && res.length > 0) bobs = res.filter(b => !b.setor || b.setor === "corte_dobra");
        } catch (e2) {}
      }

      // Filtra apenas bobinas ativas (não arquivadas nem descartadas nem encerradas)
      const ativas = bobs.filter(b => {
        if (!b) return false;
        if (b.arquivada) return false;
        const st = String(b.status || "").toLowerCase().trim();
        if (["arquivada", "arquivado", "descartada", "descartado", "encerrada", "encerrado", "zerada"].includes(st)) return false;
        return true;
      });

      if (!unidadeConsulta || unidadeConsulta === "todas") return ativas;
      const fn = String(unidadeConsulta).trim().toLowerCase();
      const filtradas = ativas.filter(b => {
        if (!b.unidade) return true; // Bobina sem unidade atribuída fica disponível na matriz/geral
        const u = String(b.unidade).trim().toLowerCase();
        return u === fn || (fn.includes("matriz") && u.includes("matriz"));
      });
      return filtradas.length > 0 ? filtradas : ativas;
    },
    enabled: open && form.maquina !== "PERFILADEIRA",
  });

  // Espessura numérica desejada para o pedido
  const espessuraDesejada = useMemo(() => {
    let esp = parseFloat(String(form.material_espessura || "").replace(",", "."));
    if (isNaN(esp) && produtoFixo) {
      const m = String(produtoFixo).match(/([0-9]+[.,][0-9]{1,2})/);
      if (m) esp = parseFloat(m[1].replace(",", "."));
    }
    return isNaN(esp) ? null : esp;
  }, [form.material_espessura, produtoFixo]);

  // Lista ordenada de bobinas:
  // 1. Bobinas com a mesma espessura e material do pedido (Recomendadas)
  // 2. Bobinas com a mesma espessura do pedido
  // 3. Demais bobinas ativas ordenadas por espessura e código
  const bobinasCD = useMemo(() => {
    if (!todasBobinasRaw || todasBobinasRaw.length === 0) return [];

    const pProd = (produtoFixo || "").toUpperCase();

    const parseEspBobina = (b) => {
      const raw = b.chapa || b.espessura_real || b.espessura_mm || b.espessura_utilizada || "";
      const n = parseFloat(String(raw).replace(",", "."));
      return isNaN(n) ? null : n;
    };

    return [...todasBobinasRaw].sort((a, b) => {
      const espA = parseEspBobina(a);
      const espB = parseEspBobina(b);

      if (espessuraDesejada != null) {
        const diffA = espA != null ? Math.abs(espA - espessuraDesejada) : 999;
        const diffB = espB != null ? Math.abs(espB - espessuraDesejada) : 999;

        const isCompativelA = diffA <= 0.05;
        const isCompativelB = diffB <= 0.05;

        // Se uma for compatível e a outra não
        if (isCompativelA && !isCompativelB) return -1;
        if (!isCompativelA && isCompativelB) return 1;

        // Se ambas forem compatíveis em espessura, prioriza material (GI/GV, FQ, FF)
        if (isCompativelA && isCompativelB) {
          const qualA = (a.qualidade || a.cor || "").toUpperCase();
          const qualB = (b.qualidade || b.cor || "").toUpperCase();
          const matchMatA = (pProd.includes("GI") || pProd.includes("GALV")) ? (qualA.includes("GI") || qualA.includes("GV") || qualA.includes("GL")) : true;
          const matchMatB = (pProd.includes("GI") || pProd.includes("GALV")) ? (qualB.includes("GI") || qualB.includes("GV") || qualB.includes("GL")) : true;
          if (matchMatA && !matchMatB) return -1;
          if (!matchMatA && matchMatB) return 1;
        }

        // Se nenhuma for compatível exata, ordena pela proximidade da espessura
        if (diffA !== diffB) return diffA - diffB;
      }

      // Ordenação padrão por código
      return String(a.codigo || "").localeCompare(String(b.codigo || ""), undefined, { numeric: true });
    });
  }, [todasBobinasRaw, espessuraDesejada, produtoFixo]);

  const filiaisHook = filialAtiva === "todas" ? null : [filialAtiva];
  const { preBaixaMap } = usePreBaixaBobinas("corte_dobra", filiaisHook);

  const { data: slitters = [] } = useQuery({
    queryKey: ["slitters-perfiladeira", unidadeConsulta],
    queryFn: () => base44.entities.Slitter.filter({ unidade: unidadeConsulta }),
    enabled: open && form.maquina === "PERFILADEIRA",
  });

  const { data: todasOrdens = [] } = useQuery({
    queryKey: ["ordens-maquina-cd-ativas", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ status: { $nin: ["finalizado", "cancelado"] } }),
    enabled: open && form.maquina === "PERFILADEIRA",
  });

  // chapas disponíveis = disponivel OU parcial, busca tolerante de filial
  const { data: todasChapas = [] } = useQuery({
    queryKey: ["chapas-cd-todas", unidadeConsulta],
    queryFn: async () => {
      let chapas = [];
      try {
        const res = await base44.entities.ChapaCD.filter({}, "-created_date", 2000);
        if (Array.isArray(res)) chapas = res;
      } catch (e) {
        console.warn("[OrdemMaquinaFormDialog] Falha ao buscar Chapas:", e);
      }
      if (!unidadeConsulta || unidadeConsulta === "todas") return chapas;
      const fn = String(unidadeConsulta).trim().toLowerCase();
      const filtradas = chapas.filter(c => {
        if (!c.unidade) return true;
        const u = String(c.unidade).trim().toLowerCase();
        return u === fn || (fn.includes("matriz") && u.includes("matriz"));
      });
      return filtradas.length > 0 ? filtradas : chapas;
    },
    enabled: open && form.maquina !== "PERFILADEIRA",
  });

  // Vendedores cadastrados na gestão de Dados de Produção (fonte principal)
  const { data: dadosVendedores = [] } = useQuery({
    queryKey: ["dados-producao", "vendedor"],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo: "vendedor", ativo: true }),
    enabled: open,
  });

  // Usuários com role vendedor (caso existam)
  const { data: usersVendedores = [] } = useQuery({
    queryKey: ["users-vendedores-list"],
    queryFn: () => base44.entities.User.filter({ role: "vendedor" }).catch(() => []),
    enabled: open,
  });

  // Vínculo automático com PedidoOdoo pelo numero_pedido
  const { data: pedidoOdooVinculado = [] } = useQuery({
    queryKey: ["pedido-odoo-vinculo-cd-maquina", form.numero_pedido],
    queryFn: async () => {
      const num = String(form.numero_pedido || "").replace(/^#/, "").trim();
      if (!num) return [];
      const res = await base44.entities.PedidoOdoo.filter({ numero_pedido: num }, "-created_date", 5).catch(() => []);
      if (res.length > 0) return res;
      return base44.entities.PedidoOdoo.filter({ numero_pedido: `#${num}` }, "-created_date", 5).catch(() => []);
    },
    enabled: open && !!form.numero_pedido && String(form.numero_pedido).trim().length > 0,
  });

  // Auto-preenchimento ao vincular pedido Odoo
  useEffect(() => {
    const p = pedidoOdooVinculado?.[0];
    if (p) {
      if (p.foto_pedido_url && !form.foto_pedido_url) {
        set("foto_pedido_url", p.foto_pedido_url);
      }
      if (p.vendedor_nome && !form.vendedor) {
        set("vendedor", p.vendedor_nome);
      }
      if (p.cliente_nome && !form.cliente) {
        set("cliente", p.cliente_nome);
      }
    }
  }, [pedidoOdooVinculado]);

  // Lista consolidada de vendedores para o dropdown (sem duplicatas e com fallback seguro)
  const listaVendedores = useMemo(() => {
    const nomes = new Set();

    dadosVendedores.forEach(d => {
      const v = (d.valor || d.nome || "").trim();
      if (v) nomes.add(v);
    });

    usersVendedores.forEach(u => {
      const v = (u.full_name || u.name || u.email || "").trim();
      if (v) nomes.add(v);
    });

    if (form.vendedor && form.vendedor.trim()) {
      nomes.add(form.vendedor.trim());
    }

    // Se nenhuma fonte tiver retornado vendedores cadastrados, usa a lista padrão da fábrica
    if (nomes.size === 0) {
      ["VERA (PG)", "HUDSON", "BALCÃO", "DIRETO", "INTERNO", "VENDEDOR EXTERNO"].forEach(v => nomes.add(v));
    }

    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dadosVendedores, usersVendedores, form.vendedor]);

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
        dimensoes_livres: editItem.dimensoes_livres || (editItem.comprimento_mm ? `${editItem.comprimento_mm}mm` : ""),
        comprimento_mm: editItem.comprimento_mm || "",
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
        vendedor: editItem.vendedor || "",
        prioridade: editItem.prioridade || false,
        prioridade_nivel: editItem.prioridade_nivel ?? null,
        rota: editItem.rota || false,
      });
    } else {
      setForm({
        data: defaultDate || format(new Date(), "yyyy-MM-dd"),
        maquina: maquinaProp || "",
        chapa_origem: (maquinaProp === "PERFILADEIRA" || maquinaProp?.startsWith("DESBOBINADEIRA")) ? "direto" : "chaparia",
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
        vendedor: "",
        prioridade: false,
        prioridade_nivel: null,
        rota: false,
      });
      setModoDigitarVendedor(false);
    }
  }, [open, editItem, defaultDate, maquinaProp]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const chapas = todasChapas.filter(c => c.status === "disponivel" || c.status === "parcial");
  const chapaObj = chapas.find(c => c.id === form.chapa_cd_id);
  const bobinaObj = form.maquina === "PERFILADEIRA"
    ? slitters.find(s => s.id === form.bobina_id)
    : bobinasCD.find(b => b.id === form.bobina_id);

  // Desenvolvimentos disponíveis
  const { data: desenvolvimentos = [] } = useQuery({
    queryKey: ["desenvolvimentos-cd-ativos"],
    queryFn: () => base44.entities.DesenvolvimentoCD.filter({ status: "aprovado" }, "-created_date", 200),
    enabled: open && isMaquinaPadrao,
  });

  const devObj = desenvolvimentos.find(d => d.id === form.desenvolvimento_id);

  const tipoPecaObj = TIPOS_PECA.find(t => t.label === form.tipo_peca);
  const etapa = tipoPecaObj?.etapa || "ambas";
  const maquinasDisponiveis = maquinaProp === "PERFILADEIRA"
    ? MAQUINAS_PERF
    : MAQUINAS_TODAS;
  const isPerfiladeira = maquinaProp === "PERFILADEIRA" || etapa === "perfiladeira" || form.maquina === "PERFILADEIRA";

  // ── AUTO-SELEÇÃO INTELIGENTE DE MATÉRIA-PRIMA & TIPO DE PEÇA ──────────────
  useEffect(() => {
    if (!open) return;

    // 1. Se for produto de chapa e tipo_peca estiver vazio, pré-seleciona "Blank (Chapa cortada)"
    if (produtoFixo && !form.tipo_peca) {
      const pLower = produtoFixo.toLowerCase();
      if (pLower.includes("chapa") || pLower.includes("blank")) {
        set("tipo_peca", "Blank (Chapa cortada)");
      }
    }

    // 2. Extrai espessura de produtoFixo se form.material_espessura estiver vazia
    let esp = parseFloat(String(form.material_espessura || "").replace(",", "."));
    if (isNaN(esp) && produtoFixo) {
      const m = String(produtoFixo).match(/([0-9]+[.,][0-9]{1,2})/);
      if (m) {
        esp = parseFloat(m[1].replace(",", "."));
        if (!isNaN(esp)) {
          set("material_espessura", String(esp).replace(".", ","));
        }
      }
    }

    // 3. Se não tiver bobina selecionada, busca bobina compatível no estoque (ordem recomendada)
    if (!form.bobina_id && bobinasCD.length > 0) {
      const pProd = (produtoFixo || "").toUpperCase();
      const compativel = bobinasCD.find(b => {
        const bEsp = parseFloat(String(b.chapa || b.espessura_real || b.espessura_mm || b.espessura_utilizada || "").replace(",", "."));
        if (espessuraDesejada != null && (isNaN(bEsp) || Math.abs(bEsp - espessuraDesejada) > 0.05)) return false;
        const bQual = (b.qualidade || b.cor || "").toUpperCase();
        if ((pProd.includes("GI") || pProd.includes("GALV")) && !bQual.includes("GI") && !bQual.includes("GV") && !bQual.includes("GL")) return false;
        if (pProd.includes("FQ") && !bQual.includes("FQ")) return false;
        if (pProd.includes("FF") && !bQual.includes("FF")) return false;
        return true;
      }) || bobinasCD.find(b => {
        const bEsp = parseFloat(String(b.chapa || b.espessura_real || b.espessura_mm || b.espessura_utilizada || "").replace(",", "."));
        return espessuraDesejada != null && !isNaN(bEsp) && Math.abs(bEsp - espessuraDesejada) <= 0.05;
      }) || bobinasCD[0];

      if (compativel) {
        set("bobina_id", compativel.id);
        const bEspStr = compativel.chapa || compativel.espessura_real || compativel.espessura_mm || compativel.espessura_utilizada || "";
        if (bEspStr && !form.material_espessura) {
          set("material_espessura", bEspStr);
        }
      }
    }

    // 4. Se não tiver chapa selecionada, busca chapa compatível no estoque da Chaparia
    if (!isPerfiladeira && !form.chapa_cd_id && chapas.length > 0 && !isNaN(esp)) {
      const pProd = (produtoFixo || "").toUpperCase();
      const compativel = chapas.find(c => {
        const cEsp = parseFloat(String(c.espessura_mm || "").replace(",", "."));
        if (isNaN(cEsp) || Math.abs(cEsp - esp) > 0.15) return false;
        const cMat = (c.material || c.bobina_descricao || "").toUpperCase();
        if ((pProd.includes("GI") || pProd.includes("GALV")) && !cMat.includes("GI") && !cMat.includes("GALV")) return false;
        if (pProd.includes("FQ") && !cMat.includes("FQ")) return false;
        if (pProd.includes("FF") && !cMat.includes("FF")) return false;
        return true;
      }) || chapas.find(c => {
        const cEsp = parseFloat(String(c.espessura_mm || "").replace(",", "."));
        return !isNaN(cEsp) && Math.abs(cEsp - esp) <= 0.15;
      });

      if (compativel) {
        set("chapa_cd_id", compativel.id);
      }
    }
  }, [open, produtoFixo, form.maquina, bobinasCD, chapas, form.bobina_id, form.chapa_cd_id]);

  // ── PRÉ-APROVEITAMENTO & CONSUMO ESTIMADO DE CHAPAS ──────────────────────
  const preAproveitamento = useMemo(() => {
    const qtd = Number(form.quantidade);
    if (!qtd || qtd <= 0) return null;

    // Dimensões da peça
    let compPeca = 0;
    let largPeca = 0;

    if (devObj) {
      compPeca = Number(devObj.comprimento_final_mm || devObj.comprimento_desenvolvido_mm) || 0;
      largPeca = Number(devObj.largura_final_mm || devObj.largura_mm) || 0;
    }

    if (!compPeca || !largPeca) {
      const textoDim = `${form.dimensoes_livres || ""} ${produtoFixo || ""}`;
      const match2D = textoDim.match(/(\d{2,5})\s*(?:x|×|\*)\s*(\d{2,5})/i);
      if (match2D) {
        const d1 = Number(match2D[1]);
        const d2 = Number(match2D[2]);
        largPeca = Math.min(d1, d2);
        compPeca = Math.max(d1, d2);
      } else {
        const matchComp = textoDim.match(/(\d{3,5})\s*mm/i) || textoDim.match(/(\d{1,2})\s*m\b/i);
        if (matchComp) {
          compPeca = matchComp[1].length <= 2 ? Number(matchComp[1]) * 1000 : Number(matchComp[1]);
          largPeca = 1200;
        }
      }
    }

    if (!compPeca) compPeca = 3000;
    if (!largPeca) largPeca = 1200;

    // Dimensões da chapa matriz (do estoque ou padrão 1200x3000)
    const chapaLarg = chapaObj?.largura_mm || 1200;
    const chapaComp = chapaObj?.comprimento_mm || (form.maquina?.includes("6M") ? 6000 : 3000);

    // Rendimento por chapa (direto vs rotacionado)
    const cabemDireto = Math.max(1, Math.floor(chapaComp / compPeca) * Math.floor(chapaLarg / largPeca));
    const cabemRotacionado = Math.max(1, Math.floor(chapaComp / largPeca) * Math.floor(chapaLarg / compPeca));
    const pecasPorChapa = Math.max(1, Math.max(cabemDireto, cabemRotacionado));

    const chapasNecessarias = Math.ceil(qtd / pecasPorChapa);

    // Área e aproveitamento útil
    const areaPecaM2 = (compPeca / 1000) * (largPeca / 1000);
    const areaTotalPecasM2 = areaPecaM2 * qtd;
    const areaChapaM2 = (chapaComp / 1000) * (chapaLarg / 1000);
    const areaChapasConsumidasM2 = areaChapaM2 * chapasNecessarias;
    const aproveitamentoPct = Math.min(100, Math.round((areaTotalPecasM2 / areaChapasConsumidasM2) * 100 * 10) / 10);

    // Peso teórico
    const espNum = parseFloat(String(form.material_espessura || chapaObj?.espessura_mm || bobinaObj?.espessura_mm || "3.00").replace(",", ".")) || 3.0;
    const pesoTeoricoTotalKg = Math.round(areaTotalPecasM2 * espNum * 7.85 * 10) / 10;
    const pesoChapaUnitKg = Math.round(areaChapaM2 * espNum * 7.85 * 10) / 10;

    return {
      compPeca,
      largPeca,
      chapaComp,
      chapaLarg,
      pecasPorChapa,
      chapasNecessarias,
      aproveitamentoPct,
      areaTotalPecasM2: Math.round(areaTotalPecasM2 * 100) / 100,
      pesoTeoricoTotalKg,
      pesoChapaUnitKg,
      espNum
    };
  }, [form.quantidade, form.dimensoes_livres, form.material_espessura, form.maquina, chapaObj, bobinaObj, devObj, produtoFixo]);

  // Se o peso estiver vazio ou zero e tiver peso teórico calculado, preenche automaticamente
  useEffect(() => {
    if (preAproveitamento && (!form.peso_kg || form.peso_kg === "0") && !pesoEditadoManual.current) {
      if (preAproveitamento.pesoTeoricoTotalKg > 0) {
        set("peso_kg", String(preAproveitamento.pesoTeoricoTotalKg));
      }
    }
  }, [preAproveitamento?.pesoTeoricoTotalKg]);

  // ── RECOMENDAÇÃO INTELIGENTE ──────────────────────────────────────────────
  // Filtra desenvolvimentos pela espessura da chapa selecionada (tolerância ±0.2mm)
  const devsCompativeis = useMemo(() => {
    if (!chapaObj || !desenvolvimentos.length) return [];
    const esp = parseFloat(chapaObj.espessura_mm);
    if (isNaN(esp)) return [];
    return desenvolvimentos
      .filter(d => {
        const dEsp = parseFloat(d.espessura_mm);
        return !isNaN(dEsp) && Math.abs(dEsp - esp) <= 0.2;
      })
      .sort((a, b) => {
        // Prioridade: mesma espessura exata primeiro, depois por nome
        const aExact = Math.abs(parseFloat(a.espessura_mm) - esp) < 0.01;
        const bExact = Math.abs(parseFloat(b.espessura_mm) - esp) < 0.01;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return (a.nome_peca || "").localeCompare(b.nome_peca || "", "pt-BR");
      });
  }, [chapaObj?.id, desenvolvimentos]);

  // Desenvolvimentos que NÃO são compatíveis com a espessura (para lista secundária)
  const devsOutros = useMemo(() => {
    if (!chapaObj) return desenvolvimentos;
    const compatIds = new Set(devsCompativeis.map(d => d.id));
    return desenvolvimentos.filter(d => !compatIds.has(d.id));
  }, [devsCompativeis, desenvolvimentos, chapaObj]);

  const [mostrarTodosDevs, setMostrarTodosDevs] = useState(false);
  const [buscaDev, setBuscaDev] = useState("");
  // ─────────────────────────────────────────────────────────────────────────


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
    } else {
      set("chapa_origem", "chaparia");
      if (!maqsOk.includes(form.maquina)) {
        set("maquina", "");
      }
    }
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
    const isAguardando = Boolean(form.material_em_falta);

    // Validações básicas
    if (!form.maquina && !maquinaProp) {
      alert("Selecione a máquina.");
      return;
    }
    if (!form.tipo_peca?.trim()) {
      alert("Informe o tipo de peça.");
      return;
    }
    const qtdNum = Number(form.quantidade);
    if (!qtdNum || qtdNum <= 0) {
      alert("Informe uma quantidade válida.");
      return;
    }

    if (isAguardando) {
      if (!form.material_espessura || !form.material_espessura.trim()) {
        alert("Informe a espessura desejada.");
        return;
      }
    } else {
      if (isPerfiladeira && !form.bobina_id) {
        alert("Selecione a bobina slitter.");
        return;
      }
      if (!isPerfiladeira) {
        if (form.chapa_origem === "direto" && !form.bobina_id) {
          alert("Selecione a bobina de C&D do estoque.");
          return;
        }
        if (form.chapa_origem === "chaparia" && !form.chapa_cd_id) {
          alert("Selecione a chapa do estoque da Chaparia.");
          return;
        }
      }
      if (form.maquina === "CORTE 6M" && devObj?.maquina_dobra && devObj.maquina_dobra !== "PERFILADEIRA" && !form.ordem_dobra_maquina) {
        alert("Selecione a máquina de dobra.");
        return;
      }
    }

    const chapaSnap = chapaObj ? `${chapaObj.bobina_descricao || ""} · ${chapaObj.comprimento_mm}mm` : "";
    const bobinaSnap = bobinaObj ? `[${bobinaObj.codigo || "—"}] ${bobinaObj.qualidade || ""} ${bobinaObj.espessura_mm || ""}mm` : "";
    const slitterSnap = bobinaObj ? `[${bobinaObj.codigo || "—"}] ${bobinaObj.qualidade || ""} ${bobinaObj.espessura_mm || ""}mm — ${bobinaObj.materiais_producao || ""}` : "";

    // Monta o payload 100% sanitizado para o backend Base44
    const ordemData = {
      data: form.data || format(new Date(), "yyyy-MM-dd"),
      maquina: form.maquina || maquinaProp,
      unidade: filialAtiva && filialAtiva !== "todas" ? filialAtiva : "Matriz AJL",
      tipo_peca: form.tipo_peca.trim(),
      dimensoes_livres: (form.dimensoes_livres || "").trim(),
      numero_pedido: (form.numero_pedido || "").trim(),
      ...(isDesbobinadeira && form.comprimento_mm ? { comprimento_mm: Number(form.comprimento_mm) } : {}),
      cliente: (form.cliente || "").trim(),
      vendedor: (form.vendedor || "").trim(),
      quantidade: qtdNum,
      material_em_falta: isAguardando,
      status: isAguardando ? "aguardando_material" : (editItem?.status || "pendente"),
      prioridade: Boolean(form.prioridade),
      rota: Boolean(form.rota),
      observacoes: (form.observacoes || "").trim(),
      chapa_origem: isPerfiladeira ? "direto" : (form.chapa_origem || "chaparia"),
    };

    if (isAguardando) {
      ordemData.material_espessura = form.material_espessura.trim();
      if (form.material_cor?.trim()) {
        ordemData.material_cor = form.material_cor.trim();
      }
      ordemData.chapa_cd_id = "";
      ordemData.bobina_id = "";
      ordemData.chapa_descricao = "";
      ordemData.bobina_descricao = "";
    } else {
      if (isPerfiladeira && form.bobina_id) {
        ordemData.bobina_id = form.bobina_id;
        ordemData.bobina_descricao = slitterSnap;
        ordemData.chapa_cd_id = "";
        ordemData.chapa_descricao = "";
      } else if (form.chapa_origem === "direto" && form.bobina_id) {
        ordemData.bobina_id = form.bobina_id;
        ordemData.bobina_descricao = bobinaSnap;
        ordemData.chapa_cd_id = "";
        ordemData.chapa_descricao = "";
      } else if (form.chapa_origem === "chaparia" && form.chapa_cd_id) {
        ordemData.chapa_cd_id = form.chapa_cd_id;
        ordemData.chapa_descricao = chapaSnap;
        ordemData.bobina_id = "";
        ordemData.bobina_descricao = "";
      }
    }

    // Peso kg: apenas número válido > 0
    if (form.peso_kg !== "" && form.peso_kg !== null && form.peso_kg !== undefined) {
      const p = typeof form.peso_kg === "string" ? parseFloat(form.peso_kg.replace(",", ".")) : Number(form.peso_kg);
      if (!isNaN(p) && p > 0) {
        ordemData.peso_kg = p;
      }
    }

    // Valor pago cliente: apenas número > 0
    if (form.valor_pago_cliente !== "" && form.valor_pago_cliente !== null && form.valor_pago_cliente !== undefined) {
      const v = typeof form.valor_pago_cliente === "string" ? parseFloat(form.valor_pago_cliente.replace(",", ".")) : Number(form.valor_pago_cliente);
      if (!isNaN(v) && v > 0) {
        ordemData.valor_pago_cliente = v;
      }
    }

    // Prioridade nível: 1 a 5 apenas (nunca envia null nem 0)
    if (form.prioridade_nivel) {
      const pn = Number(form.prioridade_nivel);
      if (!isNaN(pn) && pn >= 1 && pn <= 5) {
        ordemData.prioridade_nivel = pn;
      }
    }

    // Desenvolvimento
    if (form.desenvolvimento_id) {
      ordemData.desenvolvimento_id = form.desenvolvimento_id;
      ordemData.desenvolvimento_descricao = devObj ? `${devObj.nome_peca} — ${devObj.material || ""} ${devObj.espessura_mm || ""}mm` : (form.desenvolvimento_descricao || "");
    }

    // Ordem dobra máquina: apenas se for enum válido
    if (["DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M"].includes(form.ordem_dobra_maquina)) {
      ordemData.ordem_dobra_maquina = form.ordem_dobra_maquina;
    } else if (ordemData.maquina === "CORTE 3M" && devObj?.maquina_dobra && devObj.maquina_dobra !== "PERFILADEIRA") {
      ordemData.ordem_dobra_maquina = "DOBRA 3M";
    }

    // Ordem corte id
    if (form.ordem_corte_id) {
      ordemData.ordem_corte_id = form.ordem_corte_id;
    }

    // URLs de fotos
    if (form.foto_pedido_url?.trim()) {
      ordemData.foto_pedido_url = form.foto_pedido_url.trim();
    }
    if (form.foto_material_url?.trim()) {
      ordemData.foto_material_url = form.foto_material_url.trim();
    }

    onSave(ordemData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem?.id ? `Revisar Ordem${form.maquina ? ` — ${form.maquina}` : ""}` : `Nova Ordem${form.maquina ? ` — ${form.maquina}` : ""}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">

          {produtoFixo && (
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <Lock className="w-3 h-3" /> Produto (bloqueado — origem Fila PCP)
              </Label>
              <Input
                value={produtoFixo}
                readOnly
                className="bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 font-bold text-amber-900 dark:text-amber-200"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Máquina *</Label>
              <Select value={form.maquina} disabled={maquinaProp === "PERFILADEIRA"} onValueChange={v => {
                set("maquina", v);
                if (v === "PERFILADEIRA" || v?.startsWith("DESBOBINADEIRA")) set("chapa_origem", "direto");
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Desbobinadeiras
                  </div>
                  <SelectItem value="DESBOBINADEIRA 01">
                    <span className="flex items-center gap-1.5 font-semibold text-orange-600 dark:text-orange-400">
                      🌀 DESBOBINADEIRA 01 (até 3,00mm)
                    </span>
                  </SelectItem>
                  <SelectItem value="DESBOBINADEIRA 02">
                    <span className="flex items-center gap-1.5 font-semibold text-orange-600 dark:text-orange-400">
                      🌀 DESBOBINADEIRA 02 (0,80 a 4,75mm)
                    </span>
                  </SelectItem>

                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-border mt-1 pt-1">
                    Guilhotinas & Dobradeiras
                  </div>
                  <SelectItem value="CORTE 3M">✂️ CORTE 3M</SelectItem>
                  <SelectItem value="CORTE 6M">✂️ CORTE 6M</SelectItem>
                  <SelectItem value="DOBRA 3M">📐 DOBRA 3M</SelectItem>
                  <SelectItem value="DOBRA FUNDO 6M">📐 DOBRA FUNDO 6M</SelectItem>
                  <SelectItem value="DOBRA INICIO 6M">📐 DOBRA INICIO 6M</SelectItem>

                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-border mt-1 pt-1">
                    Perfiladeira
                  </div>
                  <SelectItem value="PERFILADEIRA">⚙️ PERFILADEIRA</SelectItem>
                </SelectContent>
              </Select>

            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              DESENVOLVIMENTO — Painel de Recomendação Inteligente
          ═══════════════════════════════════════════════════════════════ */}
          {isMaquinaPadrao && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-orange-500" />
                  Desenvolvimento de Peça
                  {devsCompativeis.length > 0 && (
                    <Badge className="bg-emerald-500 text-white text-[10px] ml-1">
                      {devsCompativeis.length} compatíveis
                    </Badge>
                  )}
                </Label>
                {form.desenvolvimento_id && (
                  <button
                    type="button"
                    onClick={() => {
                      set("desenvolvimento_id", "");
                      set("tipo_peca", "");
                      set("dimensoes_livres", "");
                      set("ordem_dobra_maquina", "");
                    }}
                    className="text-[10px] text-red-500 hover:text-red-700 underline"
                  >
                    ✕ Limpar seleção
                  </button>
                )}
              </div>

              {/* ── CASO 1: Chapa selecionada → mostrar recomendações por espessura ── */}
              {chapaObj ? (
                <div className="space-y-2">
                  {/* Cabeçalho de contexto */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span>
                      Chapa <strong>e{chapaObj.espessura_mm}mm</strong> selecionada
                      {chapaObj.material ? ` · ${chapaObj.material}` : ""}
                      {devsCompativeis.length > 0
                        ? ` — mostrando os ${devsCompativeis.length} desenvolvimentos compatíveis:`
                        : " — nenhum desenvolvimento cadastrado para esta espessura ainda."}
                    </span>
                  </div>

                  {/* Cards dos desenvolvimentos compatíveis */}
                  {devsCompativeis.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                      {devsCompativeis.map(d => {
                        const selected = form.desenvolvimento_id === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              set("desenvolvimento_id", d.id);
                              set("desenvolvimento_descricao", `${d.nome_peca} — ${d.material || ""} ${d.espessura_mm || ""}mm`);
                            }}
                            className={`text-left rounded-xl border-2 px-3 py-2.5 transition-all ${
                              selected
                                ? "border-emerald-500 bg-emerald-50 shadow-md"
                                : "border-border bg-card hover:border-orange-300 hover:bg-orange-50/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {selected && (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  )}
                                  <span className={`font-bold text-sm ${selected ? "text-emerald-800" : "text-foreground"}`}>
                                    {d.nome_peca}
                                  </span>
                                  <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-[10px] font-bold">
                                    e{d.espessura_mm}mm
                                  </Badge>
                                  {d.material && (
                                    <span className="text-xs text-muted-foreground">{d.material}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  {d.comprimento_desenvolvido_mm && (
                                    <span className="text-xs font-mono font-bold text-emerald-700">
                                      ✂️ Blank: {d.comprimento_desenvolvido_mm} mm
                                    </span>
                                  )}
                                  {d.comprimento_final_mm && (
                                    <span className="text-xs font-mono text-muted-foreground">
                                      ↔️ {d.comprimento_final_mm} mm
                                    </span>
                                  )}
                                  {d.maquina_dobra && d.maquina_dobra !== "PERFILADEIRA" && (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">
                                      📐 {d.maquina_dobra}
                                    </span>
                                  )}
                                  {d.maquina_corte && (
                                    <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">
                                      ✂️ {d.maquina_corte}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {selected && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Outros desenvolvimentos (espessura diferente) — colapsável */}
                  {devsOutros.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setMostrarTodosDevs(v => !v)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        {mostrarTodosDevs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {mostrarTodosDevs ? "Ocultar" : `Ver todos (${devsOutros.length} outros — espessuras diferentes)`}
                      </button>
                      {mostrarTodosDevs && (
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                          {devsOutros.map(d => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                set("desenvolvimento_id", d.id);
                                set("desenvolvimento_descricao", `${d.nome_peca} — ${d.material || ""} ${d.espessura_mm || ""}mm`);
                              }}
                              className="w-full text-left rounded-lg border border-border px-3 py-2 text-xs hover:border-orange-300 hover:bg-orange-50/30 transition-all flex items-center justify-between gap-2 bg-card"
                            >
                              <span className="font-semibold">{d.nome_peca}</span>
                              <span className="text-muted-foreground shrink-0">e{d.espessura_mm}mm · {d.material || "—"}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── CASO 2: Sem chapa → Select padrão com busca ── */
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground italic">
                    Selecione uma chapa acima para ver as recomendações automáticas por espessura.
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar desenvolvimento por nome..."
                      value={buscaDev}
                      onChange={e => setBuscaDev(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <Select value={form.desenvolvimento_id} onValueChange={v => {
                    set("desenvolvimento_id", v);
                    if (!v) { set("tipo_peca", ""); set("dimensoes_livres", ""); set("ordem_dobra_maquina", ""); return; }
                    const d = desenvolvimentos.find(x => x.id === v);
                    set("desenvolvimento_descricao", d ? `${d.nome_peca} — ${d.material || ""} ${d.espessura_mm || ""}mm` : "");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o desenvolvimento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {desenvolvimentos.length === 0 && <SelectItem value="_empty" disabled>Nenhum desenvolvimento aprovado</SelectItem>}
                      {desenvolvimentos
                        .filter(d => !buscaDev || d.nome_peca?.toLowerCase().includes(buscaDev.toLowerCase()))
                        .map(d => (
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
                </div>
              )}

              {/* Card de resumo quando um desenvolvimento está selecionado */}
              {devObj && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl px-3 py-2.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-black text-emerald-900 text-sm">{devObj.nome_peca}</span>
                    <Badge className="bg-orange-500 text-white font-bold">e{devObj.espessura_mm}mm</Badge>
                    {devObj.material && <Badge variant="outline" className="text-slate-700">{devObj.material}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-emerald-800">
                    {devObj.comprimento_desenvolvido_mm && (
                      <span className="font-mono font-bold">✂️ Blank: <strong>{devObj.comprimento_desenvolvido_mm} mm</strong></span>
                    )}
                    {devObj.comprimento_final_mm && (
                      <span className="font-mono">↔️ Comp: <strong>{devObj.comprimento_final_mm} mm</strong></span>
                    )}
                    {devObj.largura_mm && <span>Largura: <strong>{devObj.largura_mm}mm</strong></span>}
                    {devObj.maquina_dobra && devObj.maquina_dobra !== "PERFILADEIRA" && (
                      <span className="text-blue-700 font-bold">📐 Dobra: {devObj.maquina_dobra}</span>
                    )}
                  </div>
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

          {/* ══════════════ SELEÇÃO FLEXÍVEL DE MATÉRIA-PRIMA (BOBINA OU CHAPA) ══════════════ */}
          {!form.material_em_falta && !isPerfiladeira && (
            <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="flex items-center gap-1.5 font-bold text-xs">
                  <Layers className="w-4 h-4 text-orange-500" /> Matéria-Prima do Estoque *
                </Label>
                <div className="flex items-center bg-muted/80 p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      set("chapa_origem", "direto");
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                      form.chapa_origem === "direto"
                        ? "bg-orange-500 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🌀 Bobina de C&D {bobinasCD.length > 0 ? `(${bobinasCD.length})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      set("chapa_origem", "chaparia");
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                      form.chapa_origem === "chaparia"
                        ? "bg-orange-500 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📄 Chapa da Chaparia {chapas.length > 0 ? `(${chapas.length})` : ""}
                  </button>
                </div>
              </div>

              {/* OPÇÃO 1: BOBINA DO ESTOQUE DE C&D */}
              {form.chapa_origem === "direto" ? (
                <div className="space-y-1.5 pt-1">
                  <Select
                    value={form.bobina_id}
                    onValueChange={v => {
                      set("bobina_id", v);
                      const b = bobinasCD.find(x => x.id === v);
                      if (b) {
                        const bEspStr = b.chapa || b.espessura_real || b.espessura_mm || b.espessura_utilizada || "";
                        if (bEspStr) set("material_espessura", bEspStr);
                      }
                    }}
                  >
                    <SelectTrigger className="font-medium bg-background">
                      <SelectValue placeholder="Selecione a bobina..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {bobinasCD.map(b => {
                        const bEspStr = b.chapa || b.espessura_real || b.espessura_mm || b.espessura_utilizada || "";
                        const bEspNum = parseFloat(String(bEspStr).replace(",", "."));
                        const isRecomendada = espessuraDesejada != null && bEspNum != null && Math.abs(bEspNum - espessuraDesejada) <= 0.05;
                        const pesoDisp = Number(b.peso_kg || b.peso_atual || b.peso_liquido || 0);

                        return (
                          <SelectItem key={b.id} value={b.id} className="py-2 cursor-pointer">
                            <div className="flex items-center justify-between gap-2 w-full pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-primary">[{b.codigo || "—"}]</span>
                                <span className="font-semibold">{b.qualidade || b.cor || "Bobina"}</span>
                                {bEspStr && (
                                  <span className="text-muted-foreground text-xs">{bEspStr}mm</span>
                                )}
                                {pesoDisp > 0 && (
                                  <span className="text-green-600 font-bold text-xs">· {pesoDisp.toLocaleString("pt-BR")}kg</span>
                                )}
                                {b.unidade && <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{b.unidade}</span>}
                                {isRecomendada && (
                                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold px-1.5 py-0.5 rounded-full">
                                    ★ Compatível {bEspStr}mm
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                      {bobinasCD.length === 0 && carregandoBobinas && (
                        <SelectItem value="_carregando" disabled>Carregando bobinas do estoque...</SelectItem>
                      )}
                      {bobinasCD.length === 0 && !carregandoBobinas && (
                        <SelectItem value="_vazio" disabled>Nenhuma bobina disponível no estoque</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {bobinaObj && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-3 text-orange-800 dark:text-orange-300">
                      <span>Bobina: <strong>[{bobinaObj.codigo || "—"}] {bobinaObj.qualidade || bobinaObj.cor || ""}</strong></span>
                      <span>Espessura: <strong>{bobinaObj.chapa || bobinaObj.espessura_real || bobinaObj.espessura_mm || bobinaObj.espessura_utilizada || "—"}mm</strong></span>
                      <span>Peso Disponível: <strong>{Number(bobinaObj.peso_kg || bobinaObj.peso_atual || bobinaObj.peso_liquido || 0).toLocaleString("pt-BR")}kg</strong></span>
                      {bobinaObj.unidade && <span>Unidade: <strong>{bobinaObj.unidade}</strong></span>}
                    </div>
                  )}
                </div>
              ) : (
                /* OPÇÃO 2: CHAPA DO ESTOQUE (CHAPARIA) */
                <div className="space-y-1.5 pt-1">
                  <ChapaEstoqueCombobox
                    chapas={chapas}
                    value={form.chapa_cd_id}
                    onChange={v => set("chapa_cd_id", v)}
                    maxComprimento={maxComprimento}
                    numeroPedido={form.numero_pedido}
                    placeholder="Pesquisar e selecionar chapa do estoque..."
                  />
                  {chapaObj && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-3 text-orange-800 dark:text-orange-300">
                      <span>Bobina de Origem: <strong>{chapaObj.bobina_descricao}</strong></span>
                      <span>Corte: <strong>{chapaObj.comprimento_mm}mm</strong></span>
                      <span>Disponível: <strong>{chapaObj.quantidade_disponivel} pç</strong></span>
                      {chapaObj.unidade && <span>Unidade: <strong>{chapaObj.unidade}</strong></span>}
                    </div>
                  )}
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
                  {slitters.filter(s => !["consumido", "arquivado"].includes(s.status?.toLowerCase())).map(s => {
                    const st = getBobinaStatus(s, todasOrdens);
                    return (
                      <SelectItem key={s.id} value={s.id} className="py-2 cursor-pointer">
                        <div className="flex items-center justify-between gap-2 w-full pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-primary">{s.codigo || "—"}</span>
                            {s.qualidade && <span className="text-muted-foreground">{s.qualidade}</span>}
                            <span className="text-muted-foreground">{s.espessura_mm}mm</span>
                            {s.materiais_producao && <span className="text-blue-600 font-semibold">{s.materiais_producao}</span>}
                            <span className="text-green-600 font-bold">· {s.peso_kg?.toLocaleString("pt-BR")}kg</span>
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

          {!produtoFixo && (
          <div className="space-y-1">
            <Label>Tipo de Peça *</Label>
            {isPerfiladeira && materiaisSlitter.length > 0 ? (
              <div className="space-y-1.5">
                <Input
                  placeholder="Digite o tipo de peça / material..."
                  value={form.tipo_peca}
                  onChange={e => {
                    set("tipo_peca", e.target.value);
                    set("dimensoes_livres", e.target.value);
                    pesoEditadoManual.current = false;
                  }}
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-semibold">Sugestões da Slitter:</span>
                  {materiaisSlitter.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleTipoPeca(m)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                        form.tipo_peca === m
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Input
                placeholder="Digite o tipo de peça (ex: Blank, Chapa cortada, Rufo, Calha, Dobra...)"
                value={form.tipo_peca}
                onChange={e => set("tipo_peca", e.target.value)}
              />
            )}
          </div>
          )}

          {isDesbobinadeira && (
            <div className="space-y-1">
              <Label>Comprimento de corte (mm) *</Label>
              <Input
                type="number"
                placeholder="Ex: 3000"
                value={form.comprimento_mm}
                onChange={e => set("comprimento_mm", e.target.value)}
                className="font-mono font-bold"
              />
              <p className="text-[10px] text-muted-foreground">
                Comprimento em que a desbobinadeira corta as chapas (ex: 1200 x <strong>3000</strong> mm)
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label>Dimensões / Especificações</Label>
            <Input
              placeholder={devObj ? "Preenchido pelo desenvolvimento" : "Ex: A=100 B=50 CH=1,25 · 6m"}
              value={form.dimensoes_livres}
              onChange={e => set("dimensoes_livres", e.target.value)}
              readOnly={Boolean(devObj)}
              className={devObj ? "bg-muted font-medium" : ""}
            />
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
              {produtoFixo ? (
                <div className="flex items-center justify-between border border-border rounded-md px-3 py-2 bg-muted/60 min-h-[38px] text-xs font-mono font-bold text-foreground">
                  <span>#{form.numero_pedido}</span>
                  <Badge variant="secondary" className="text-[9px] ml-1 shrink-0">Fixo</Badge>
                </div>
              ) : (
                <Input placeholder="12345" value={form.numero_pedido} onChange={e => set("numero_pedido", e.target.value)} />
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              PRÉ-APROVEITAMENTO & CONSUMO ESTIMADO DE CHAPAS
          ═══════════════════════════════════════════════════════════════ */}
          {preAproveitamento && !isPerfiladeira && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/10 p-3 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Pré-Aproveitamento & Consumo de Chapas
                </span>
                <Badge variant="outline" className="text-[10px] bg-white/80 dark:bg-card border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300 font-mono">
                  Peça: {preAproveitamento.largPeca}×{preAproveitamento.compPeca}mm
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/90 dark:bg-card/70 rounded-lg p-2 border border-blue-100 dark:border-blue-900/40 shadow-xs">
                  <span className="text-[10px] text-muted-foreground block font-medium">Rendimento</span>
                  <span className="text-sm font-black text-blue-700 dark:text-blue-400">
                    {preAproveitamento.pecasPorChapa} {preAproveitamento.pecasPorChapa === 1 ? "pç / chapa" : "pçs / chapa"}
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-card/70 rounded-lg p-2 border border-blue-100 dark:border-blue-900/40 shadow-xs">
                  <span className="text-[10px] text-muted-foreground block font-medium">Chapas Necessárias</span>
                  <span className="text-base font-black text-orange-600 dark:text-orange-400">
                    {preAproveitamento.chapasNecessarias} {preAproveitamento.chapasNecessarias === 1 ? "chapa" : "chapas"}
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-card/70 rounded-lg p-2 border border-blue-100 dark:border-blue-900/40 shadow-xs">
                  <span className="text-[10px] text-muted-foreground block font-medium">Aproveitamento</span>
                  <span className={`text-sm font-black ${preAproveitamento.aproveitamentoPct >= 80 ? "text-emerald-600 dark:text-emerald-400" : preAproveitamento.aproveitamentoPct >= 60 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {preAproveitamento.aproveitamentoPct}%
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-blue-100/80 dark:border-blue-900/40">
                <span>Área Total: <strong className="text-foreground">{preAproveitamento.areaTotalPecasM2} m²</strong></span>
                <span>Peso Teórico Total: <strong className="text-blue-700 dark:text-blue-400 font-bold">{preAproveitamento.pesoTeoricoTotalKg} kg</strong> <span className="opacity-75">(~{preAproveitamento.pesoChapaUnitKg} kg/chapa)</span></span>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Cliente</Label>
            {produtoFixo ? (
              <div className="flex items-center justify-between border border-border rounded-md px-3 py-2 bg-muted/60 min-h-[38px] text-xs font-semibold text-foreground">
                <span className="truncate">{form.cliente || "Não informado"}</span>
                <Badge variant="secondary" className="text-[9px] ml-1 shrink-0">Fixo</Badge>
              </div>
            ) : (
              <Input placeholder="Nome do cliente" value={form.cliente} onChange={e => set("cliente", e.target.value)} />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-blue-500" /> Vendedor <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
              </Label>
              {!produtoFixo && (
                <button
                  type="button"
                  onClick={() => setModoDigitarVendedor(!modoDigitarVendedor)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {modoDigitarVendedor ? "← Selecionar da lista" : "✏️ Digitar vendedor"}
                </button>
              )}
            </div>
            {produtoFixo ? (
              <div className="flex items-center justify-between border border-border rounded-md px-3 py-2 bg-muted/60 min-h-[38px] text-xs font-semibold text-foreground">
                <span className="truncate">{form.vendedor || "Não informado"}</span>
                <Badge variant="secondary" className="text-[9px] ml-1 shrink-0">Fixo</Badge>
              </div>
            ) : modoDigitarVendedor ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Digite o nome do vendedor..."
                  value={form.vendedor}
                  onChange={e => set("vendedor", e.target.value)}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModoDigitarVendedor(false)}
                  title="Voltar para a lista"
                  className="shrink-0"
                >
                  Lista
                </Button>
              </div>
            ) : (
              <Select
                value={form.vendedor}
                onValueChange={v => {
                  if (v === "__digitar__") {
                    setModoDigitarVendedor(true);
                  } else {
                    set("vendedor", v);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o vendedor..." /></SelectTrigger>
                <SelectContent>
                  {listaVendedores.map(nome => (
                    <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                  ))}
                  <SelectItem value="__digitar__" className="text-primary font-medium border-t border-border mt-1 pt-1">
                    ✏️ Digitar outro vendedor...
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
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

          {/* Nível de Prioridade (1 a 5) & Rota */}
          <div className="rounded-xl border border-border p-3.5 bg-card/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-500" />
                Nível de Prioridade (1 a 5)
              </Label>
              <span className="text-[11px] text-muted-foreground">
                1 é a mais urgente a fazer
              </span>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {[
                { nivel: 1, label: "P1", sub: "Urgente", cls: "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40", activeCls: "bg-red-600 text-white border-red-700 shadow-sm animate-pulse font-black" },
                { nivel: 2, label: "P2", sub: "Alta", cls: "border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40", activeCls: "bg-orange-500 text-white border-orange-600 font-bold" },
                { nivel: 3, label: "P3", sub: "Média", cls: "border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40", activeCls: "bg-amber-500 text-white border-amber-600 font-bold" },
                { nivel: 4, label: "P4", sub: "Normal", cls: "border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40", activeCls: "bg-blue-600 text-white border-blue-700 font-bold" },
                { nivel: 5, label: "P5", sub: "Baixa", cls: "border-slate-400 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900", activeCls: "bg-slate-600 text-white border-slate-700 font-bold" },
                { nivel: null, label: "Sem P", sub: "Padrão", cls: "border-border text-muted-foreground hover:bg-accent", activeCls: "bg-muted text-foreground border-border font-bold" },
              ].map(item => {
                const isSelected = form.prioridade_nivel === item.nivel || (!form.prioridade_nivel && item.nivel === null);
                return (
                  <button
                    key={String(item.nivel)}
                    type="button"
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        prioridade_nivel: item.nivel,
                        prioridade: Boolean(item.nivel)
                      }));
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                      isSelected ? item.activeCls : `${item.cls} bg-background`
                    }`}
                  >
                    <span className="text-xs font-black">{item.label}</span>
                    <span className="text-[9px] opacity-80 whitespace-nowrap">{item.sub}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1.5 flex items-center justify-between border-t border-border/60">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.rota)}
                  onChange={(e) => set("rota", e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <span className="flex items-center gap-1 text-red-600 font-bold">
                  <Route className="w-3.5 h-3.5" />
                  Pedido de Rota (Carga Agendada)
                </span>
              </label>
              {form.prioridade_nivel && (
                <span className="text-[11px] font-bold text-amber-600">
                  Prioridade Selecionada: P{form.prioridade_nivel}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Instruções para o operador..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600 font-bold">
            {editItem?.id ? "Atualizar Ordem" : "Criar Ordem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}