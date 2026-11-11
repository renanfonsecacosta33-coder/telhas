import React, { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UploadButton from "@/components/ui/UploadButton";
import { Play, Pause, Square, CheckCircle2, Timer, Coffee, Circle, AlertCircle, Clock, Camera, Loader2, Trash2, Layers, Image as ImageIcon, ScanLine, ShoppingCart, User, AlertTriangle, Ban, Truck, Zap, Sparkles, Edit } from "lucide-react";
import { format } from "date-fns";
import { formatarDataSegura } from "@/lib/formatData";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getEtapaColor } from "@/components/corte-dobra/RetrabalhoDialog";
import { HistoricoPedidoButton } from "@/components/corte-dobra/HistoricoPedidoSidebar";
import CorChapaDot from "@/components/corte-dobra/CorChapaDot";
import ValidacaoEtiquetaDialog from "@/components/corte-dobra/ValidacaoEtiquetaDialog";
import DualPhotoGallery from "@/components/corte-dobra/DualPhotoGallery";
import ChatPedidoButton from "@/components/chat/ChatPedidoButton";
import ApontamentoOpButton from "@/components/producao/ApontamentoOpButton";
import {
  PrioridadeBadge,
  BannerPrioridadeDestaque,
  isPedidoRetiraAgora,
  isPedidoRota,
  getCardPrioridadeClasses
} from "@/lib/prioridadeHelper";
import SmartImage from "@/components/ui/SmartImage";
import { comprimirImagemParaUpload } from "@/lib/compressImage";
import SenhaGestorDialog from "@/components/pcp/SenhaGestorDialog";
import { getEspessuraNumeroDesb, isAbaixoDoMinimoDesbobinadeira02, ESPESSURA_MINIMA_DESBOBINADEIRA_02 } from "@/lib/regrasFabrica";
import { useRegrasProducao } from "@/lib/regrasProducao";
import { formatarQuantidadeComUnidade } from "@/lib/pedidoOdooHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { extrairEspessuraDoTexto } from "@/lib/estoqueMaterialHelper";
import BannerInstrucaoCorteDobra, { classificarItemCorteDobra } from "@/components/corte-dobra/BannerInstrucaoCorteDobra";

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function StatusBadge({ status }) {
  const cfg = {
    pendente:    { label: "Pendente",     Icon: Circle,       color: "bg-slate-100 text-slate-600 border-slate-200" },
    em_producao: { label: "Produzindo",   Icon: Clock,        color: "bg-amber-100 text-amber-700 border-amber-200" },
    pausado:     { label: "Pausado",      Icon: Pause,        color: "bg-purple-100 text-purple-700 border-purple-200" },
    finalizado:  { label: "Finalizado",   Icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" },
    cancelado:   { label: "Cancelado",    Icon: AlertCircle,  color: "bg-red-100 text-red-700 border-red-200" },
  }[status] || { label: status, Icon: Circle, color: "bg-slate-100 text-slate-600" };
  return (
    <Badge className={`border text-xs ${cfg.color}`}>
      <cfg.Icon className="w-3 h-3 mr-1" />
      {cfg.label}
    </Badge>
  );
}

const ZOOM_CFG = {
  compacto: { card: "p-2.5", title: "text-sm", info: "text-xs", badge: "text-[10px]", cronText: "text-xs", cronLabel: "text-[10px]", cronPad: "px-2 py-1", btn: "h-7 text-xs", obs: "text-[11px] py-1", gap: "gap-1.5", mb: "mb-2" },
  normal:   { card: "p-4",   title: "text-base", info: "text-sm", badge: "text-xs", cronText: "text-sm", cronLabel: "text-xs", cronPad: "px-3 py-2", btn: "h-8 text-xs", obs: "text-xs py-1.5", gap: "gap-2", mb: "mb-3" },
  grande:   { card: "p-5",   title: "text-lg", info: "text-base", badge: "text-sm", cronText: "text-base", cronLabel: "text-sm", cronPad: "px-4 py-2.5", btn: "h-10 text-sm", obs: "text-sm py-2", gap: "gap-2.5", mb: "mb-3" },
};

export default function OrdemDesbobinadiraRow({ ordem: o, onUpdate, onDelete, isGestor, zoom = "normal", ordens = [], pedidoSeq, bobinaCustoMap = {}, user, chapaVinculada, onGerarChapa, bobinas = [], pedidosOdooMap = {} }) {
  const regras = useRegrasProducao();
  const z = ZOOM_CFG[zoom] || ZOOM_CFG.normal;
  const [pauseDialog, setPauseDialog] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState("");
  const [pauseTipo, setPauseTipo] = useState("setup");
  const [fotoDialog, setFotoDialog] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [confirmarPesoDialog, setConfirmarPesoDialog] = useState(false);
  const [pesoRealLido, setPesoRealLido] = useState("");
  const [tempFotoUrl, setTempFotoUrl] = useState("");
  const [tick, setTick] = useState(0);
  const [bloqueioDialog, setBloqueioDialog] = useState(false);
  const [ordemBloqueante, setOrdemBloqueante] = useState(null);
  const [acaoPendente, setAcaoPendente] = useState(null);
  const fotoInputRef = useRef();
  const fotoScanRef = useRef();
  const [validacaoDialog, setValidacaoDialog] = useState(false);
  const [confirmarExclusaoOpen, setConfirmarExclusaoOpen] = useState(false);
  const [confirmarCancelarOpen, setConfirmarCancelarOpen] = useState(false);
  const [senhaDesb02Open, setSenhaDesb02Open] = useState(false);

  // Estados para modal de definição rápida de bobina / espessura
  const [definirBobinaOpen, setDefinirBobinaOpen] = useState(false);
  const [novaEspessuraInput, setNovaEspessuraInput] = useState("");
  const [bobinaSelecionadaId, setBobinaSelecionadaId] = useState("");
  const [salvandoBobina, setSalvandoBobina] = useState(false);
  const [mostrarTodasBobinas, setMostrarTodasBobinas] = useState(false);

  // ── RESOLUÇÃO INTELIGENTE DE ESPECIFICAÇÃO TÉCNICA E ESPESSURA ──
  const textoPecaCompleto = [o.observacoes, o.tipo_peca, o.dimensoes_livres, o.especificacoes_tecnicas].filter(Boolean).join(" ");
  const specTec = useMemo(() => {
    return extrairEspecificacao(textoPecaCompleto, o.quantidade);
  }, [textoPecaCompleto, o.quantidade]);

  // Código da Bobina extraído de snapshot ou gravado na ordem
  const codigoBobinaExtraido = useMemo(() => {
    if (o.bobina_codigo) return o.bobina_codigo;
    const mCod = String(o.bobina_descricao || "").match(/\[([A-Z0-9_\-\/]+)\]/i);
    if (mCod) return mCod[1];
    return null;
  }, [o.bobina_codigo, o.bobina_descricao]);

  // Localiza o objeto da Bobina no estoque CD (por ID ou por Código)
  const bobinaEncontrada = useMemo(() => {
    if (!Array.isArray(bobinas) || bobinas.length === 0) return null;
    if (o.bobina_id) {
      const bById = bobinas.find(b => b.id === o.bobina_id || b.codigo === o.bobina_id);
      if (bById) return bById;
    }
    if (codigoBobinaExtraido) {
      const bByCod = bobinas.find(b => b.codigo && String(b.codigo).toUpperCase() === codigoBobinaExtraido.toUpperCase());
      if (bByCod) return bByCod;
    }
    return null;
  }, [bobinas, o.bobina_id, codigoBobinaExtraido]);

  // Pedido Odoo correspondente vinculado (se houver)
  const pedidoOdooVinculado = useMemo(() => {
    if (!pedidosOdooMap || Object.keys(pedidosOdooMap).length === 0) return null;
    const numLimpo = String(o.numero_pedido || "").replace(/^#/, "").trim().toUpperCase();
    if (numLimpo && pedidosOdooMap[numLimpo]) return pedidosOdooMap[numLimpo];
    const ocLimpa = String(o.numero_oc || "").replace(/^#/, "").trim().toUpperCase();
    if (ocLimpa && pedidosOdooMap[ocLimpa]) return pedidosOdooMap[ocLimpa];
    return null;
  }, [pedidosOdooMap, o.numero_pedido, o.numero_oc]);

  // 🛡️ 1. Espessura da CHAPA exigida pelo cliente/pedido (Prioridade Absoluta)
  const espessuraChapaExigida = useMemo(() => {
    const sanitizarEsp = (val) => {
      if (!val) return null;
      const s = String(val).replace("mm", "").replace("#", "").trim();
      const n = parseFloat(s.replace(",", "."));
      if (!isNaN(n) && n > 0 && n < 20) return s.replace(".", ",");
      return null;
    };

    // A. Campo explícito de espessura exigida / material do pedido
    const direta = sanitizarEsp(o.espessura_exigida || o.material_espessura || o.espessura_mm || o.espessura);
    if (direta) return direta;

    // B. Extração direta de texto (tipo_peca, observações, etc.)
    const textoBusca = [o.tipo_peca, o.observacoes, o.dimensoes_livres, textoPecaCompleto].filter(Boolean).join(" ");
    const ext = extrairEspessuraDoTexto(textoBusca);
    if (ext) return sanitizarEsp(ext);

    // C. Pedido Odoo Vinculado (itens_json e tags)
    if (pedidoOdooVinculado?.itens_json) {
      try {
        const itens = typeof pedidoOdooVinculado.itens_json === "string" ? JSON.parse(pedidoOdooVinculado.itens_json) : pedidoOdooVinculado.itens_json;
        if (Array.isArray(itens)) {
          for (const it of itens) {
            const espIt = sanitizarEsp(it.espessura || it.chapa) || extrairEspessuraDoTexto([it.produto, it.descricao].filter(Boolean).join(" "));
            if (espIt) return sanitizarEsp(espIt);
          }
        }
      } catch {}
    }

    return null;
  }, [o, textoPecaCompleto, pedidoOdooVinculado]);

  // 🛡️ 2. Espessura da Bobina montada/vinculada na máquina
  const espessuraBobinaMontada = useMemo(() => {
    const sanitizarEsp = (val) => {
      if (!val) return null;
      const s = String(val).replace("mm", "").replace("#", "").trim();
      const n = parseFloat(s.replace(",", "."));
      if (!isNaN(n) && n > 0 && n < 20) return s.replace(".", ",");
      return null;
    };
    if (bobinaEncontrada) {
      const e = sanitizarEsp(bobinaEncontrada.espessura_utilizada || bobinaEncontrada.chapa || bobinaEncontrada.espessura_real || bobinaEncontrada.espessura_mm);
      if (e) return e;
    }
    return sanitizarEsp(o.espessura_utilizada);
  }, [bobinaEncontrada, o.espessura_utilizada]);

  // Espessura final do material com prioridade máxima para a Chapa exigida
  const { espessuraFinal, espessuraOrigem, espessuraDetalhe } = useMemo(() => {
    const sanitizarEsp = (val) => {
      if (!val) return null;
      const s = String(val).replace("mm", "").replace("#", "").trim();
      const n = parseFloat(s.replace(",", "."));
      if (!isNaN(n) && n > 0 && n < 20) {
        return s.replace(".", ",");
      }
      return null;
    };

    if (espessuraChapaExigida) {
      return { espessuraFinal: espessuraChapaExigida, espessuraOrigem: "chapa_pedido", espessuraDetalhe: "Chapa Exigida do Pedido" };
    }

    if (espessuraBobinaMontada) {
      return { espessuraFinal: espessuraBobinaMontada, espessuraOrigem: "bobina", espessuraDetalhe: `Estoque [${bobinaEncontrada?.codigo || "CD"}]` };
    }

    // 1. Campo explícito na própria ordem
    const espDireta = sanitizarEsp(o.espessura_utilizada || o.espessura_exigida || o.material_espessura || o.espessura_mm || o.espessura);
    if (espDireta) {
      return { espessuraFinal: espDireta, espessuraOrigem: "ordem", espessuraDetalhe: "Informada na ordem" };
    }

    // 2. Busca na bobina vinculada (por id ou código extraído)
    if (bobinaEncontrada) {
      const espBob = sanitizarEsp(bobinaEncontrada.espessura_utilizada || bobinaEncontrada.chapa || bobinaEncontrada.espessura_real || bobinaEncontrada.espessura_mm || bobinaEncontrada.espessura);
      if (espBob) {
        return { espessuraFinal: espBob, espessuraOrigem: "bobina", espessuraDetalhe: `Estoque [${bobinaEncontrada.codigo || "CD"}]` };
      }
    }

    // 3. Busca na Chapa Vinculada da Chaparia (se houver)
    if (chapaVinculada) {
      const espChapa = sanitizarEsp(chapaVinculada.espessura_mm || chapaVinculada.chapa || chapaVinculada.espessura);
      if (espChapa) {
        return { espessuraFinal: espChapa, espessuraOrigem: "chapa", espessuraDetalhe: "Chapa de Estoque vinculada" };
      }
    }

    // 4. Procura número decimal na bobina_descricao (ex: "[CD0207] • 1,83 • Galvanizado")
    if (o.bobina_descricao) {
      const mDesc = String(o.bobina_descricao).match(/\b(\d+[.,]\d+)\s*(?:mm)?\b/);
      if (mDesc) {
        const espDesc = sanitizarEsp(mDesc[1]);
        if (espDesc) return { espessuraFinal: espDesc, espessuraOrigem: "bobina_texto", espessuraDetalhe: "Descrição gravada" };
      }
    }

    return { espessuraFinal: null, espessuraOrigem: null, espessuraDetalhe: null };
  }, [o, bobinaEncontrada, chapaVinculada, espessuraChapaExigida, espessuraBobinaMontada]);

  // Nome limpo e normalizado do Material / Qualidade
  const materialBobinaNome = useMemo(() => {
    if (bobinaEncontrada) {
      if (bobinaEncontrada.qualidade === "GV") return "Galvanizado";
      if (bobinaEncontrada.qualidade === "GL (IMP)") return "Galvalume Imp.";
      if (bobinaEncontrada.qualidade) return bobinaEncontrada.qualidade;
      if (bobinaEncontrada.cor) return bobinaEncontrada.cor;
    }
    const raw = String(o.bobina_descricao || o.material || "").toUpperCase();
    if (raw.includes("GL") || raw.includes("GALVALUME")) return "Galvalume";
    if (raw.includes("FF") || raw.includes("FRIO")) return "Flandres / Frio";
    if (raw.includes("FQ") || raw.includes("QUENTE")) return "Fino a Quente";
    return "Galvanizado";
  }, [bobinaEncontrada, o.bobina_descricao, o.material]);

  // Largura da bobina
  const larguraBobinaMm = useMemo(() => {
    if (bobinaEncontrada?.largura_mm) return Number(bobinaEncontrada.largura_mm);
    const mLarg = String(o.bobina_descricao || "").match(/(\d{3,4})\s*mm/i);
    if (mLarg) return Number(mLarg[1]);
    return null;
  }, [bobinaEncontrada, o.bobina_descricao]);

  // ── Bobinas do Estoque filtradas para o Desbobinador ──
  // Apenas bobinas ABERTAS e com bitola/espessura condizente/aproximada da ordem
  const bobinasFiltradasDesb = useMemo(() => {
    if (!Array.isArray(bobinas) || bobinas.length === 0) return [];

    const abertas = bobinas.filter(b =>
      !b.arquivada &&
      b.status !== "fechada" &&
      b.status !== "esgotada" &&
      (b.peso_atual == null || b.peso_atual > 0)
    );

    if (mostrarTodasBobinas) return abertas;

    const espAlvoStr = String(espessuraFinal || novaEspessuraInput || o.material_espessura || "").replace(",", ".").replace("mm", "").trim();
    const espAlvo = parseFloat(espAlvoStr);

    if (isNaN(espAlvo) || espAlvo <= 0) return abertas;

    // Tolerância de ±0.25mm para aproximação industrial (ex: pedido 1.95 aceita 1.83 a 2.00, mas nunca 0.80)
    const compativeis = abertas.filter(b => {
      const espBobStr = String(b.espessura_utilizada || b.chapa || b.espessura_real || b.espessura_mm || "").replace(",", ".").replace("mm", "").trim();
      const espBob = parseFloat(espBobStr);
      if (isNaN(espBob)) return false;
      return Math.abs(espBob - espAlvo) <= 0.25;
    });

    return compativeis.length > 0 ? compativeis : abertas;
  }, [bobinas, espessuraFinal, novaEspessuraInput, o.material_espessura, mostrarTodasBobinas]);

  // Limpeza da descrição da bobina (NUNCA exibe "GV mm" quebrado ou espaços em branco)
  const bobinaDescricaoLimpa = useMemo(() => {
    const cod = codigoBobinaExtraido ? `[${codigoBobinaExtraido}]` : "";
    let desc = String(o.bobina_descricao || "").trim();
    // Remove "mm" quebrado
    desc = desc.replace(/\bmm\b/gi, "").replace(/\s*·\s*$/, "").replace(/\s+/g, " ").trim();
    desc = desc.replace(/\bGV\b/g, "Galvanizado");
    if (desc === "Bobina" || desc === "Galvanizado" || !desc) {
      return [cod, materialBobinaNome].filter(Boolean).join(" · ") || "Bobina Aço";
    }
    return desc;
  }, [o.bobina_descricao, codigoBobinaExtraido, materialBobinaNome]);

  // Ação de salvar alteração rápida de Bobina / Espessura
  const handleSalvarEspessuraOuBobina = async () => {
    setSalvandoBobina(true);
    try {
      const updates = {};
      if (bobinaSelecionadaId) {
        const b = bobinas.find(x => x.id === bobinaSelecionadaId);
        if (b) {
          const espB = String(b.espessura_utilizada || b.chapa || b.espessura_real || b.espessura_mm || "").replace("mm", "").trim();
          updates.bobina_id = b.id;
          updates.espessura_utilizada = espB || novaEspessuraInput.trim() || undefined;
          const matB = b.qualidade === "GV" ? "Galvanizado" : (b.qualidade || b.cor || "Galvanizado");
          const largB = b.largura_mm ? ` · ${b.largura_mm}mm` : "";
          updates.bobina_descricao = `[${b.codigo || "CD"}]${espB ? ` · ${espB} mm` : ""}${matB ? ` · ${matB}` : ""}${largB}`;
        }
      } else if (novaEspessuraInput.trim()) {
        const espLimpa = novaEspessuraInput.trim().replace("mm", "").trim();
        updates.espessura_utilizada = espLimpa;
        const cod = codigoBobinaExtraido ? `[${codigoBobinaExtraido}]` : "";
        updates.bobina_descricao = [cod, `${espLimpa} mm`, materialBobinaNome].filter(Boolean).join(" · ");
      }

      await base44.entities.OrdemDesbobinadeira.update(o.id, updates);
      if (typeof onUpdate === "function") onUpdate(o.id, updates);
      toast.success("✅ Especificações da Bobina atualizadas!");
      setDefinirBobinaOpen(false);
    } catch (err) {
      console.error("Erro ao salvar espessura da bobina:", err);
      toast.error("Erro ao atualizar bobina: " + (err.message || "Erro desconhecido"));
    } finally {
      setSalvandoBobina(false);
    }
  };

  const classificacao = useMemo(() => {
    return classificarItemCorteDobra(o, specTec);
  }, [o, specTec]);

  // Medidas de Corte e Demanda do Desbobinador
  const { comprimentoCorteMm, desenvMm, abasFmt, metragemTotalM, pesoEstimadoKg } = useMemo(() => {
    let compMm = Number(o.comprimento_mm) || 0;
    if (classificacao.isChapaLisa) {
      if (specTec?.comprimento_mm && specTec.comprimento_mm > 300) {
        compMm = specTec.comprimento_mm;
      }
    } else {
      if (compMm <= 300 && specTec?.comprimento_mm && specTec.comprimento_mm > 300) {
        compMm = specTec.comprimento_mm;
      } else if (compMm <= 0 && specTec?.comprimento_mm) {
        compMm = specTec.comprimento_mm;
      }
    }
    if (compMm <= 0) compMm = 3000; // Padrão industrial

    // Se for chapa lisa, o desenvolvimento é a largura real da chapa (ex: 1277mm), NUNCA abas somadas!
    const desenv = classificacao.isChapaLisa
      ? (specTec?.largura_mm || (o.largura_mm ? Number(o.largura_mm) : null) || 1200)
      : (specTec?.desenvolvimento_mm || (o.largura_mm ? Number(o.largura_mm) : null));

    const abasStr = !classificacao.isChapaLisa && specTec?.abas && specTec.abas.length > 0 
      ? specTec.abas.join("×") + " mm" 
      : null;

    const qtd = Number(classificacao.qtdPecas) || 1;
    const totalM = +((qtd * compMm) / 1000).toFixed(1);

    // Cálculo físico do peso
    let pesoKg = classificacao.pesoKg;
    if (!pesoKg || pesoKg <= 0) {
      const largM = desenv ? desenv / 1000 : (o.tamanho_corte_guilhotina ? Number(o.tamanho_corte_guilhotina) / 1000 : 1.2);
      const espFloat = parseFloat(String(espessuraFinal || "1.95").replace(",", ".")) || 1.95;
      pesoKg = Math.round(totalM * largM * espFloat * 7.85);
    }

    return {
      comprimentoCorteMm: compMm,
      desenvMm: desenv,
      abasFmt: abasStr,
      metragemTotalM: totalM,
      pesoEstimadoKg: pesoKg || o.kg_estimado || 0
    };
  }, [o.comprimento_mm, o.largura_mm, o.tamanho_corte_guilhotina, o.kg_estimado, specTec, espessuraFinal, classificacao]);

  // Validação estrita de espessura mínima da Desbobinadeira 02 (mínimo: 0,80mm)
  const espNum = getEspessuraNumeroDesb(o) || (espessuraFinal ? parseFloat(espessuraFinal.replace(",", ".")) : null);
  const isAbaixoMinimo02 = isAbaixoDoMinimoDesbobinadeira02(o) || (o.maquina === "DESBOBINADEIRA 02" && espNum !== null && espNum < (ESPESSURA_MINIMA_DESBOBINADEIRA_02 - 0.005));

  // Ordens irmãs do mesmo lote de múltiplas medidas
  const ordensIrmasLote = useMemo(() => {
    if (!o.lote_medidas_id || !Array.isArray(ordensAtivas)) return [];
    return ordensAtivas.filter(x =>
      x.id !== o.id &&
      x.lote_medidas_id === o.lote_medidas_id &&
      x.status !== "finalizado" &&
      x.status !== "cancelado"
    );
  }, [o.lote_medidas_id, o.id, ordensAtivas]);

  const handleFinalizarLoteInteiro = async () => {
    if (!window.confirm(`Deseja finalizar esta OP e as outras ${ordensIrmasLote.length} medidas irmãs deste mesmo lote de uma vez?`)) return;
    try {
      handleFinalizarComPesoTeorico();
      for (const irma of ordensIrmasLote) {
        onUpdate(irma.id, {
          status: "finalizado",
          data_finalizacao: format(new Date(), "yyyy-MM-dd"),
          observacoes: [irma.observacoes, "Finalizado junto com o lote inteiro"].filter(Boolean).join(" | ")
        });
      }
      toast.success(`Lote de ${ordensIrmasLote.length + 1} medidas finalizado com sucesso!`);
    } catch (errLote) {
      toast.error("Erro ao finalizar lote: " + errLote.message);
    }
  };

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  let tempoProd = o.tempo_producao_seg || 0;
  let tempoPausa = o.tempo_pausa_seg || 0;
  let tempoSetup = o.tempo_setup_seg || 0;

  if (o.status === "em_producao" && o.inicio_producao_ts) {
    tempoProd += Math.floor((now - new Date(o.inicio_producao_ts).getTime()) / 1000);
  }
  if (o.status === "pausado" && o.inicio_pausa_ts) {
    const delta = Math.floor((now - new Date(o.inicio_pausa_ts).getTime()) / 1000);
    if (o.motivo_pausa === "setup") tempoSetup += delta;
    else tempoPausa += delta;
  }

  const verificarBloqueio = (acao) => {
    const ativa = (ordens || []).find(other =>
      other.id !== o.id && (other.status === "em_producao" || other.status === "pausado")
    );
    if (ativa) {
      if (isGestor) {
        setOrdemBloqueante(ativa);
        setAcaoPendente(acao);
        setBloqueioDialog(true);
      } else {
        toast.error("Já existe uma OP em andamento nesta máquina. Finalize ou pause a OP atual antes de iniciar outra.");
      }
      return true;
    }
    return false;
  };

  const doIniciar = () => {
    onUpdate(o.id, { status: "em_producao", inicio_producao_ts: new Date().toISOString() });
  };

  const handleIniciar = () => {
    if (verificarBloqueio("iniciar")) return;

    // Regra da Desbobinadeira 02: aceita no mínimo espessura 0,80mm.
    // Se for inferior a 0,80mm, bloqueia e exige senha de liberação do gestor (a menos que seja gestor)
    if (isAbaixoMinimo02 && !user?.permissions?.ignorar_bloqueio_op && !isGestor) {
      setSenhaDesb02Open(true);
      return;
    }

    if (regras.exigirEtiquetaBobina) setValidacaoDialog(true);
    else doIniciar();
  };

  const handleEtiquetaAprovada = (fotoUrl, motivo) => {
    setValidacaoDialog(false);
    onUpdate(o.id, {
      status: "em_producao",
      inicio_producao_ts: new Date().toISOString(),
      foto_etiqueta_bobina_url: fotoUrl,
      validacao_etiqueta_status: "aprovado",
      validacao_etiqueta_motivo: motivo || null,
    });
  };

  const confirmarPausa = () => {
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    const motivo = pauseTipo === "setup" ? "setup" : (pauseMotivo.trim() || "pausa");
    onUpdate(o.id, {
      status: "pausado",
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      inicio_pausa_ts: new Date().toISOString(),
      motivo_pausa: motivo,
    });
    setPauseDialog(false);
  };

  const doRetomar = () => {
    let pausaSeg = o.tempo_pausa_seg || 0;
    let setupSeg = o.tempo_setup_seg || 0;
    if (o.inicio_pausa_ts) {
      const delta = Math.floor((Date.now() - new Date(o.inicio_pausa_ts).getTime()) / 1000);
      if (o.motivo_pausa === "setup") setupSeg += delta;
      else pausaSeg += delta;
    }
    const historico = JSON.parse(o.historico_pausas || "[]");
    historico.push({ motivo: o.motivo_pausa, inicio: o.inicio_pausa_ts, fim: new Date().toISOString() });
    onUpdate(o.id, {
      status: "em_producao",
      tempo_pausa_seg: pausaSeg,
      tempo_setup_seg: setupSeg,
      inicio_pausa_ts: null,
      motivo_pausa: null,
      historico_pausas: JSON.stringify(historico),
      inicio_producao_ts: new Date().toISOString(),
    });
  };

  const handleRetomar = () => {
    if (verificarBloqueio("retomar")) return;
    doRetomar();
  };

  const confirmarBloqueio = () => {
    const acao = acaoPendente;
    setBloqueioDialog(false);
    setAcaoPendente(null);
    setOrdemBloqueante(null);
    if (acao === "iniciar") {
      if (regras.exigirEtiquetaBobina) setValidacaoDialog(true);
      else doIniciar();
    }
    else if (acao === "retomar") doRetomar();
  };

  const handleFinalizar = () => {
    setPauseMotivo("");
    if (user?.permissions?.pular_foto_balanca) {
      // Odoo-style: se tem permissão, ignora a foto e finaliza com peso teórico num clique só
      handleFinalizarComPesoTeorico();
    } else {
      setFotoDialog(true);
    }
  };

  const handleUploadFoto = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    try {
      const fileOtimizado = await comprimirImagemParaUpload(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: fileOtimizado });
      setTempFotoUrl(file_url);
      setPesoRealLido(Math.round(o.kg_estimado || 0).toString());
      setConfirmarPesoDialog(true);
      setFotoDialog(false);
    } catch (err) {
      toast.error("Erro no upload da foto: " + err.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleFinalizarComPesoTeorico = () => {
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    onUpdate(o.id, {
      status: "finalizado",
      foto_finalizacao_url: tempFotoUrl || null,
      peso_real_balanca_kg: null,
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
    });
    setConfirmarPesoDialog(false);
    setFotoDialog(false);
    toast.success("Ordem finalizada com Peso Teórico estimado!");
  };

  const handleConfirmarFinalizacao = () => {
    const pesoNum = Number(pesoRealLido);
    if (!pesoNum || pesoNum <= 0) {
      toast.error("Por favor, informe o peso real medido na balança ou escolha 'Usar Peso Teórico'.");
      return;
    }
    let prodSeg = o.tempo_producao_seg || 0;
    if (o.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(o.inicio_producao_ts).getTime()) / 1000);
    }
    onUpdate(o.id, {
      status: "finalizado",
      foto_finalizacao_url: tempFotoUrl || null,
      peso_real_balanca_kg: pesoNum,
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
    });
    setConfirmarPesoDialog(false);
    toast.success("Ordem finalizada e peso real atualizado!");
  };

  const showCronometro = o.status === "em_producao" || o.status === "pausado" || tempoProd > 0;
  const isFinalizado = o.status === "finalizado";

  if (isFinalizado) {
    const etpCorFin = o.is_retrabalho ? getEtapaColor(o.retrabalho_etapa) : null;
    return (
      <>
        <div className={`border-l-4 ${etpCorFin ? etpCorFin.border : "border-l-green-400"} ${etpCorFin ? etpCorFin.bg : "bg-green-50/60"} rounded-lg p-2.5 shadow-sm hover:shadow-md transition-all`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {o.is_retrabalho && (
                <Badge className={`${etpCorFin?.badge} text-white border-red-600 text-[10px]`}>
                  <AlertCircle className="w-3 h-3 mr-0.5" /> RETRABALHO{o.retrabalho_etapa > 1 ? ` E${o.retrabalho_etapa}` : ""}
                </Badge>
              )}
              <span className={`font-bold text-sm font-mono ${etpCorFin ? etpCorFin.text : "text-green-700"}`}>
                {codigoBobinaExtraido ? `[${codigoBobinaExtraido}] ` : ""}{bobinaDescricaoLimpa}
              </span>
              {espessuraFinal && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <CorChapaDot espessura={espessuraFinal} size="xs" />
                  <Layers className="w-2.5 h-2.5" /> {espessuraFinal} mm
                </span>
              )}
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Finalizado
              </Badge>
              {o.quantidade > 0 && <span className="text-xs font-semibold text-foreground">{formatarQuantidadeComUnidade(o)}</span>}
              {o.comprimento_mm > 0 && <span className="text-xs text-muted-foreground">{o.comprimento_mm}mm</span>}
              {o.kg_estimado > 0 && <span className="text-xs font-semibold text-emerald-700">≈ {o.kg_estimado.toFixed(1)} kg</span>}
              {o.peso_real_balanca_kg > 0 && (
                <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  ⚖️ Balança: {o.peso_real_balanca_kg.toLocaleString("pt-BR")} kg
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {o.foto_pedido_url && (
                <SmartImage
                  src={o.foto_pedido_url}
                  alt="Foto do pedido"
                  className="w-10 h-10 border-2 border-blue-400 shrink-0"
                  showBadge
                  badgeText="PED"
                  badgeColor="bg-blue-600"
                />
              )}
              {o.foto_finalizacao_url && (
                <SmartImage
                  src={o.foto_finalizacao_url}
                  alt="Finalização"
                  className="w-10 h-10 border-2 border-green-400 shrink-0"
                  showBadge
                  badgeText="FIN"
                  badgeColor="bg-green-600"
                />
              )}
              {o.foto_etiqueta_bobina_url && (
                <SmartImage
                  src={o.foto_etiqueta_bobina_url}
                  alt="Etiqueta da bobina"
                  className="w-10 h-10 border-2 border-orange-400 shrink-0"
                  showBadge
                  badgeText="ETIQ"
                  badgeColor="bg-orange-600"
                />
              )}
              {o.numero_pedido && <HistoricoPedidoButton numeroPedido={o.numero_pedido} size="sm" />}
              <ApontamentoOpButton ordem={o} ordem_tipo="desbobinadeira" label="Assinar" className="h-6 px-2 text-[10px] gap-1 text-orange-600 border-orange-300 hover:bg-orange-50" />
              <ChatPedidoButton canal_id={o.id} canal_label={`OP DESB ${o.numero_pedido || o.id.slice(-6).toUpperCase()}`} currentUser={user} />
              {isGestor && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={() => onUpdate(o.id, { status: "pendente", inicio_producao_ts: null, foto_finalizacao_url: null, data_finalizacao: null })}>
                    ↩ Reabrir
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => { if (window.confirm("Excluir esta ordem? Esta ação não pode ser desfeita.")) onDelete(o.id); }}>
                    <Trash2 className="w-2.5 h-2.5" /> Excluir
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
            {(o.numero_pedido || o.cliente) && (
              <div className="inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-md bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 my-0.5">
                {o.numero_pedido && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black font-mono bg-blue-600 text-white shadow-xs">
                    <ShoppingCart className="w-3 h-3 shrink-0" />
                    #{o.numero_pedido}
                    {pedidoSeq && <span className="ml-1 text-[10px] opacity-90">({pedidoSeq})</span>}
                  </span>
                )}
                {o.cliente && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black text-foreground uppercase tracking-tight bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700">
                    <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    CLIENTE: {o.cliente}
                  </span>
                )}
                {(o.vendedor || o.vendedor_nome) && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-tight bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                    👤 VENDEDOR: {o.vendedor || o.vendedor_nome}
                  </span>
                )}
              </div>
            )}
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
              o.destino === "pedido_direto"
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-green-50 text-green-700 border-green-200"
            }`}>
              {o.destino === "pedido_direto" ? "📦 Pedido direto" : "🏭 Estoque"}
            </span>
            {o.destino === "estoque" && (
              chapaVinculada ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-mono">
                  📦 {chapaVinculada.codigo} no Estoque
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => onGerarChapa?.(o.id)}
                  className="h-5 px-2 text-[10px] gap-1 bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-400 hover:bg-amber-500/20 font-bold"
                  title="A chapa ainda não foi registrada na Chaparia. Clique para gerar agora."
                >
                  ⚠️ Gerar Chapa no Estoque
                </Button>
              )
            )}
            {o.guilhotina && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-orange-50 text-orange-700 border-orange-200">
                🔪 {o.guilhotina}{o.tamanho_corte_guilhotina ? ` — ${o.tamanho_corte_guilhotina}mm` : ""}
              </span>
            )}
            {o.data_finalizacao && (
              <span className="text-green-600 font-semibold">✓ {formatarDataSegura(o.data_finalizacao, "dd/MM")}</span>
            )}
          </div>
        </div>

        {/* Dialog Bloqueio — OP em andamento (mantém para consistência) */}
        <Dialog open={bloqueioDialog} onOpenChange={setBloqueioDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>⚠️ OP em Andamento</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Já existe uma OP em andamento nesta máquina:</p>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <p className="font-semibold text-amber-900">{ordemBloqueante?.bobina_descricao || "OP"}</p>
                {ordemBloqueante?.numero_pedido && <p className="text-xs text-amber-700">Pedido: {ordemBloqueante.numero_pedido}</p>}
                {ordemBloqueante?.cliente && <p className="text-xs text-amber-700">Cliente: {ordemBloqueante.cliente}</p>}
                <p className="text-xs text-amber-700 mt-1">Status: {ordemBloqueante?.status === "em_producao" ? "Em produção" : "Pausado"}</p>
              </div>
              <p className="text-xs text-muted-foreground">Iniciar outra OP simultaneamente pode causar problemas de controle. Deseja continuar mesmo assim?</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setBloqueioDialog(false); setAcaoPendente(null); setOrdemBloqueante(null); }}>Cancelar</Button>
              <Button className="bg-amber-500 hover:bg-amber-600" onClick={confirmarBloqueio}>Iniciar mesmo assim</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const retrabalho = o.is_retrabalho;
  const etpCor = retrabalho ? getEtapaColor(o.retrabalho_etapa) : null;
  const cardPrioCls = getCardPrioridadeClasses(o);
  const ehRetira = isPedidoRetiraAgora(o);
  const ehRota = isPedidoRota(o);

  return (
    <>
      <div className={`border-l-4 ${cardPrioCls || (etpCor ? etpCor.border : "border-l-orange-400")} ${etpCor ? etpCor.bg : "bg-white"} rounded-xl ${z.card} shadow-sm hover:shadow-md transition-all`}>
        {/* Banner de Prioridade Destaque Máximo */}
        <BannerPrioridadeDestaque pedido={o} />

        {/* 🌟 Banner Dourado/Âmbar de Instrução e Especificação com Duas Métricas Principais (Chapas/Barras + KG) */}
        <BannerInstrucaoCorteDobra ordem={o} specTec={specTec} />

        {/* Header */}
        <div className={`flex items-start justify-between ${z.gap} ${z.mb}`}>
          <div className="flex-1 min-w-0">
            <div className={`flex items-center ${z.gap} flex-wrap mb-1`}>
              {retrabalho && (
                <Badge className={`${etpCor?.badge} text-white border-red-600 animate-pulse text-xs`}>
                  <AlertCircle className="w-3 h-3 mr-0.5" /> RETRABALHO{o.retrabalho_etapa > 1 ? ` E${o.retrabalho_etapa}` : ""}
                </Badge>
              )}
              <span className={`font-black ${z.title} font-mono ${etpCor ? etpCor.text : "text-orange-600 dark:text-orange-400"}`}>
                {codigoBobinaExtraido ? `[${codigoBobinaExtraido}]` : ""}{o.numero_pedido ? ` • Pedido #${o.numero_pedido}` : ` • OP #${o.id}`}
              </span>
              {pedidoSeq && (
                <Badge variant="outline" className="text-xs font-mono font-bold bg-muted/60">
                  {pedidoSeq}
                </Badge>
              )}
              {o.lote_medida_item && (
                <Badge className="bg-orange-500/15 text-orange-800 dark:text-orange-200 border-2 border-orange-400 dark:border-orange-600 text-xs font-mono font-black tracking-tight shadow-xs">
                  📦 {o.lote_medida_item}
                </Badge>
              )}
              {isAbaixoMinimo02 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-black bg-amber-500/15 text-amber-800 dark:text-amber-200 border-2 border-amber-400 dark:border-amber-600 animate-pulse shadow-xs" title="Desbobinadeira 02 aceita no mínimo 0,80mm. Exige senha de gestor para iniciar.">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  Mínimo 0,80mm (Requer Senha)
                </span>
              )}
              <StatusBadge status={o.status} />
              <PrioridadeBadge pedido={o} />
              {ehRota && !ehRetira && (
                <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-400 text-xs gap-1.5 font-black shadow-xs tracking-wide">
                  <Truck className="w-3.5 h-3.5" /> 🚚 CARGA DE ROTA
                </Badge>
              )}
              {o.data < format(new Date(), "yyyy-MM-dd") && o.status !== "finalizado" && o.status !== "cancelado" && (
                <Badge className="bg-red-500 text-white border-red-600 animate-pulse text-xs">⚠️ Prioridade (Dia Anterior)</Badge>
              )}
            </div>
            {/* Aviso visual explícito para o operador quando na Desbobinadeira 02 com espessura < 0,80mm */}
            {isAbaixoMinimo02 && (
              <div className="flex items-center gap-2 my-2 p-2 rounded-lg bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-bold shadow-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  <strong>Aviso Operacional Desbobinadeira 02:</strong> Esta máquina aceita no mínimo espessura <strong>0,80 mm</strong>. Esta OP possui {espNum ? <strong>{espNum} mm</strong> : "espessura abaixo de 0,80 mm"}. Para iniciar a produção, será exigida a <strong>Senha de Liberação do Gestor</strong>.
                </span>
              </div>
            )}

            {/* SUPER BLOCO DA BOBINA & ESPESSURA — DESTAQUE MÁXIMO PARA O OPERADOR */}
            <div className={`my-2.5 p-3 rounded-xl border-2 transition-all ${
              espessuraFinal
                ? "bg-slate-900 text-white border-blue-500 shadow-md"
                : "bg-red-50 dark:bg-red-950/40 border-2 border-red-500 text-red-900 dark:text-red-200 shadow-md"
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Lado Esquerdo: Tag Gigante de Espessura + Dados da Bobina */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Tag Gigante da Espessura da Chapa do Pedido */}
                  {espessuraFinal ? (
                    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-orange-600 text-white font-mono shadow-inner border border-orange-400">
                      <CorChapaDot espessura={espessuraFinal} size="md" />
                      <div className="flex flex-col leading-none">
                        <span className="text-[9px] font-black uppercase tracking-wider text-orange-100 flex items-center gap-1">
                          <Layers className="w-3 h-3" /> ESPESSURA CHAPA
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                          {espessuraFinal} mm
                        </span>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setNovaEspessuraInput("");
                        setBobinaSelecionadaId(o.bobina_id || "");
                        setDefinirBobinaOpen(true);
                      }}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 animate-pulse"
                    >
                      <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0" />
                      <div className="flex flex-col text-left leading-tight">
                        <span className="text-[10px] uppercase text-red-100 font-bold">Atenção Desbobinador</span>
                        <span>⚠️ ESPESSURA NÃO INFORMADA — CLIQUE PARA AJUSTAR</span>
                      </div>
                    </button>
                  )}

                  {/* Detalhes da Bobina */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black font-mono text-base sm:text-lg text-yellow-400 tracking-wide">
                        {codigoBobinaExtraido ? `[${codigoBobinaExtraido}]` : "[BOBINA]"} {materialBobinaNome}
                      </span>
                      {larguraBobinaMm ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/20 text-white border border-white/30 font-mono">
                          Largura: {larguraBobinaMm} mm
                        </span>
                      ) : null}
                      {espessuraBobinaMontada && espessuraFinal && espessuraBobinaMontada !== espessuraFinal && (
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-500/30 text-amber-200 border border-amber-400/60 font-mono">
                          ⚠️ Bobina montada: {espessuraBobinaMontada} mm (Chapa exige {espessuraFinal} mm)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-300 flex-wrap font-medium">
                      {espessuraDetalhe && (
                        <span className="text-blue-200">
                          Origem: {espessuraDetalhe}
                        </span>
                      )}
                      {bobinaEncontrada?.peso_atual ? (
                        <span className="text-emerald-300">
                          • Saldo Estoque: {Math.round(bobinaEncontrada.peso_atual)} kg
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Botão Rápido de Alterar / Definir Bobina */}
                <div className="flex items-center gap-2 self-start md:self-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNovaEspessuraInput(espessuraFinal || "");
                      setBobinaSelecionadaId(o.bobina_id || bobinaEncontrada?.id || "");
                      setDefinirBobinaOpen(true);
                    }}
                    className="h-8 text-xs font-bold gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-xs"
                  >
                    <Layers className="w-3.5 h-3.5 text-yellow-300" />
                    {espessuraFinal ? "Trocar / Ajustar Bobina" : "Definir Bobina"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Grade de Produção em Alta Visibilidade para o Desbobinador */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2.5 p-2.5 rounded-xl bg-orange-50/70 dark:bg-orange-950/20 border-2 border-orange-200/80 dark:border-orange-800/60 shadow-2xs">
              {/* Comprimento de Corte */}
              <div className="flex flex-col justify-center p-2 rounded-lg bg-white dark:bg-slate-900 border border-orange-300 dark:border-orange-700 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider">Corte / Avanço</span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white leading-tight">
                  {(Number(comprimentoCorteMm) || 0).toLocaleString("pt-BR")} mm
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">({((Number(comprimentoCorteMm) || 0) / 1000).toFixed(2)} metros)</span>
              </div>

              {/* Quantidade a Desbobinar */}
              <div className="flex flex-col justify-center p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  {classificacao?.isChapaLisa ? "Chapas a Cortar" : "Barras a Cortar"}
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-foreground leading-tight">
                  {classificacao?.qtdPecas || 1} {(classificacao?.labelMetrica || "peças").toLowerCase()}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">
                  {Number(classificacao?.pesoKg) > 0 ? `peso: ${Number(classificacao.pesoKg).toLocaleString("pt-BR")}kg` : "a produzir"}
                </span>
              </div>

              {/* Desenvolvimento / Largura */}
              <div className="flex flex-col justify-center p-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                  {classificacao?.isChapaLisa ? "Largura Chapa" : "Largura / Desenv"}
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-blue-700 dark:text-blue-300 leading-tight">
                  {desenvMm || 1200} mm
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold truncate" title={abasFmt || "largura"}>
                  {classificacao?.isChapaLisa ? "largura blank" : (abasFmt ? abasFmt : "corte blank")}
                </span>
              </div>

              {/* Peso Teórico Real */}
              <div className="flex flex-col justify-center p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Peso Teórico</span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-slate-100 leading-tight">
                  ≈ {(Number(pesoEstimadoKg) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold">massa de aço</span>
              </div>
            </div>

            {/* Etiqueta Técnica do Produto / Perfil se detectada */}
            {specTec?.tipo_label && (
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-mono">
                  📦 {specTec.tipo_label}
                </span>
                {specTec.resumo_formatado && (
                  <span className="text-xs text-muted-foreground font-semibold">
                    {specTec.resumo_formatado}
                  </span>
                )}
              </div>
            )}
            {/* Pedido e Cliente em Alto Destaque */}
            {(o.numero_pedido || o.cliente) && (
              <div className="flex flex-wrap items-center gap-2 my-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 shadow-xs">
                {o.numero_pedido && (
                  <div className="inline-flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs sm:text-sm font-black font-mono bg-blue-600 dark:bg-blue-600 text-white shadow-xs tracking-wider">
                      <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                      #{o.numero_pedido}
                    </span>
                    {pedidoSeq && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-black bg-blue-100 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-mono">
                        {pedidoSeq}
                      </span>
                    )}
                  </div>
                )}
                {o.numero_pedido && o.cliente && (
                  <span className="text-blue-300 dark:text-blue-700 font-bold hidden sm:inline">•</span>
                )}
                {o.cliente && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>CLIENTE: {o.cliente}</span>
                  </div>
                )}
                {(o.vendedor || o.vendedor_nome) && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs sm:text-sm font-black uppercase tracking-tight bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs">
                    <span className="text-amber-700 dark:text-amber-400">👤 VENDEDOR:</span>
                    <strong className="text-slate-900 dark:text-white font-black">{o.vendedor || o.vendedor_nome}</strong>
                  </div>
                )}
              </div>
            )}
            <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 ${z.info} text-muted-foreground mt-1`}>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
                o.destino === "pedido_direto"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-green-50 text-green-700 border-green-200"
              }`}>
                {o.destino === "pedido_direto" ? "📦 Pedido direto" : "🏭 Estoque"}
              </span>
              {o.guilhotina && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold border bg-orange-50 text-orange-700 border-orange-200">
                  🔪 {o.guilhotina}{o.tamanho_corte_guilhotina ? ` — ${o.tamanho_corte_guilhotina}mm` : ""}
                </span>
              )}
              {o.numero_pedido && <HistoricoPedidoButton numeroPedido={o.numero_pedido} />}
              <ApontamentoOpButton ordem={o} ordem_tipo="desbobinadeira" label="Assinar" className="text-orange-600 border-orange-300 hover:bg-orange-50" />
              <ChatPedidoButton canal_id={o.id} canal_label={`OP DESB ${o.numero_pedido || o.id.slice(-6).toUpperCase()}`} currentUser={user} />
              </div>
              </div>
              </div>

        {/* Fotos: Pedido + Etiqueta da Bobina + Finalização */}
        {(o.foto_pedido_url || o.foto_etiqueta_bobina_url || o.foto_finalizacao_url) && (
          <DualPhotoGallery
            fotoPedidoUrl={o.foto_pedido_url}
            fotoMaterialUrl={o.foto_etiqueta_bobina_url}
            fotoFinalizacaoUrl={o.foto_finalizacao_url}
            labelMaterial="Etiqueta da Bobina"
            z={zoom}
          />
        )}

        {/* Pausa ativa */}
        {o.status === "pausado" && o.motivo_pausa && (
          <div className={`bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 ${z.obs} text-amber-800 ${z.mb} flex items-center gap-2`}>
            <Pause className="w-3 h-3 flex-shrink-0" />
            <span>{o.motivo_pausa === "setup" ? "⚙️ Pausa para Setup de Máquina" : `⏸ Pausa: ${o.motivo_pausa}`}</span>
          </div>
        )}

        {/* Cronômetros */}
        {showCronometro && (
          <div className={`grid grid-cols-3 ${z.gap} ${z.mb}`}>
            <div className={`rounded-lg ${z.cronPad} text-center ${o.status === "em_producao" ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Timer className="w-3 h-3 text-green-600" />
                <span className={`${z.cronLabel} text-muted-foreground`}>Produção</span>
              </div>
              <p className={`${z.cronText} font-bold tabular-nums ${o.status === "em_producao" ? "text-green-700" : "text-slate-600"}`}>
                {formatTempo(tempoProd)}
              </p>
            </div>
            <div className={`rounded-lg ${z.cronPad} text-center ${o.status === "pausado" && o.motivo_pausa !== "setup" ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Coffee className="w-3 h-3 text-amber-600" />
                <span className={`${z.cronLabel} text-muted-foreground`}>Pausa</span>
              </div>
              <p className={`${z.cronText} font-bold tabular-nums ${o.status === "pausado" && o.motivo_pausa !== "setup" ? "text-amber-700" : "text-slate-600"}`}>
                {formatTempo(tempoPausa)}
              </p>
            </div>
            <div className={`rounded-lg ${z.cronPad} text-center ${o.status === "pausado" && o.motivo_pausa === "setup" ? "bg-purple-50 border border-purple-200" : "bg-slate-50 border border-border"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Square className="w-3 h-3 text-purple-600" />
                <span className={`${z.cronLabel} text-muted-foreground`}>Setup</span>
              </div>
              <p className={`${z.cronText} font-bold tabular-nums ${o.status === "pausado" && o.motivo_pausa === "setup" ? "text-purple-700" : "text-slate-600"}`}>
                {formatTempo(tempoSetup)}
              </p>
            </div>
          </div>
        )}



        {/* Ações */}
        <div className={`flex items-center justify-end ${z.gap} mt-3`}>
          {o.status === "pendente" && (
            <Button size="sm" className={`gap-1 ${z.btn} bg-amber-500 hover:bg-amber-600 text-white border-0`} onClick={handleIniciar}>
              <Play className="w-3 h-3" /> Iniciar
            </Button>
          )}
          {o.status === "em_producao" && (
            <>
              <Button size="sm" variant="outline" className={`gap-1 ${z.btn} border-amber-300 text-amber-700 hover:bg-amber-50`} onClick={() => { setPauseTipo("setup"); setPauseMotivo(""); setPauseDialog(true); }}>
                <Pause className="w-3 h-3" /> Pausar
              </Button>
              <Button size="sm" className={`gap-1 ${z.btn} bg-green-600 hover:bg-green-700 text-white border-0`} onClick={handleFinalizar}>
                <CheckCircle2 className="w-3 h-3" /> Finalizar
              </Button>
              {o.lote_medidas_id && ordensIrmasLote.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className={`gap-1 ${z.btn} bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 font-bold`}
                  onClick={handleFinalizarLoteInteiro}
                  title={`Finalizar esta e as outras ${ordensIrmasLote.length} medidas irmãs do lote juntas`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Finalizar Lote Inteiro ({ordensIrmasLote.length + 1})
                </Button>
              )}
            </>
          )}
          {o.status === "pausado" && (
            <Button size="sm" className={`gap-1 ${z.btn} bg-primary hover:bg-primary/90 text-white border-0`} onClick={handleRetomar}>
              <Play className="w-3 h-3" /> Retomar
            </Button>
          )}
          {o.status === "finalizado" && isGestor && (
            <Button size="sm" variant="outline" className={`gap-1 ${z.btn} text-amber-600 border-amber-300 hover:bg-amber-50`}
              onClick={() => onUpdate(o.id, { status: "pendente", inicio_producao_ts: null, foto_finalizacao_url: null, data_finalizacao: null })}>
              ↩ Reabrir
            </Button>
          )}
          {o.status === "finalizado" && !isGestor && (
            <span className={`${z.obs} text-muted-foreground italic`}>Finalizado — bloqueado</span>
          )}
          {/* Se a ordem NÃO estiver finalizada e NÃO estiver cancelada: botão Cancelar disponível */}
          {o.status !== "finalizado" && o.status !== "cancelado" && (
            <Button
              size="sm"
              variant="outline"
              className={`${z.btn} text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/40`}
              onClick={() => setConfirmarCancelarOpen(true)}
              title="Cancelar esta ordem da desbobinadeira"
            >
              Cancelar
            </Button>
          )}

          {/* Se a ordem ESTÁ cancelada: exibe Reativar e o botão EXCLUIR */}
          {o.status === "cancelado" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-semibold italic mr-1 flex items-center gap-1">
                <Ban className="w-3.5 h-3.5" /> Cancelada
              </span>
              <Button
                size="sm"
                variant="outline"
                className={`gap-1 ${z.btn} text-slate-700 border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
                onClick={() => {
                  onUpdate(o.id, { status: "pendente" });
                  toast.success(`OP #${o.numero_pedido || o.id} reativada para Pendente!`);
                }}
                title="Voltar status para Pendente"
              >
                ↩ Reativar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className={`gap-1 ${z.btn} bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm`}
                onClick={() => setConfirmarExclusaoOpen(true)}
                title="Excluir ordem permanentemente da fábrica"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialog Pausa */}
      <Dialog open={pauseDialog} onOpenChange={setPauseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Pausar Ordem</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Qual o motivo da pausa?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPauseTipo("setup")}
                className={`border-2 rounded-xl p-4 text-center transition-all ${pauseTipo === "setup" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Square className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <p className="font-semibold text-sm">Setup de Máquina</p>
                <p className="text-xs text-muted-foreground mt-1">Ajuste, troca de bobina, etc.</p>
              </button>
              <button onClick={() => setPauseTipo("outro")}
                className={`border-2 rounded-xl p-4 text-center transition-all ${pauseTipo === "outro" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Coffee className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                <p className="font-semibold text-sm">Outro Motivo</p>
                <p className="text-xs text-muted-foreground mt-1">Especifique abaixo</p>
              </button>
            </div>
            {pauseTipo === "outro" && (
              <Textarea placeholder="Descreva o motivo da pausa..." value={pauseMotivo} onChange={e => setPauseMotivo(e.target.value)} className="h-20" autoFocus />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseDialog(false)}>Cancelar</Button>
            <Button onClick={confirmarPausa} disabled={pauseTipo === "outro" && !pauseMotivo.trim()} className="gap-1">
              <Pause className="w-4 h-4" /> Confirmar Pausa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Finalizar — foto opcional com peso teórico */}
      <Dialog open={fotoDialog} onOpenChange={setFotoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Finalizar Ordem</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-orange-500" />
              <p className="font-semibold text-sm">Tirar foto da balança (Opcional)</p>
              <p className="text-xs text-muted-foreground">Você pode tirar a foto da balança para aferir o peso real ou continuar com o peso teórico estimado.</p>
              <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => handleUploadFoto(e.target.files[0])} />
              <input ref={fotoScanRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleUploadFoto(e.target.files[0])} />
              <UploadButton label="Tirar / Selecionar Foto da Balança" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploadingFoto} size="default" variant="default" />
            </div>

            {o.kg_estimado > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <p className="text-xs font-semibold text-slate-600">Peso Teórico Estimado</p>
                <p className="text-xl font-bold text-slate-800">≈ {o.kg_estimado.toFixed(1)} kg</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setFotoDialog(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={handleFinalizarComPesoTeorico} className="gap-1 border-slate-300">
              Usar Peso Teórico (≈ {(o.kg_estimado || 0).toFixed(1)} kg)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Bloqueio — OP em andamento */}
      <Dialog open={bloqueioDialog} onOpenChange={setBloqueioDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>⚠️ OP em Andamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Já existe uma OP em andamento nesta máquina:</p>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
              <p className="font-semibold text-amber-900">{ordemBloqueante?.bobina_descricao || "OP"}</p>
              {ordemBloqueante?.numero_pedido && <p className="text-xs text-amber-700">Pedido: {ordemBloqueante.numero_pedido}</p>}
              {ordemBloqueante?.cliente && <p className="text-xs text-amber-700">Cliente: {ordemBloqueante.cliente}</p>}
              <p className="text-xs text-amber-700 mt-1">Status: {ordemBloqueante?.status === "em_producao" ? "Em produção" : "Pausado"}</p>
            </div>
            <p className="text-xs text-muted-foreground">Iniciar outra OP simultaneamente pode causar problemas de controle. Deseja continuar mesmo assim?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBloqueioDialog(false); setAcaoPendente(null); setOrdemBloqueante(null); }}>Cancelar</Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={confirmarBloqueio}>Iniciar mesmo assim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Validação de Etiqueta da Bobina */}
      <ValidacaoEtiquetaDialog
        open={validacaoDialog}
        onClose={() => setValidacaoDialog(false)}
        ordem={o}
        onAprovado={handleEtiquetaAprovada}
      />

      {/* Dialog Confirmar Peso da Balança (Opcional) */}
      <Dialog open={confirmarPesoDialog} onOpenChange={setConfirmarPesoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-slate-800">
              ⚖️ Confirmar Peso da Balança (Opcional)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">
              Você pode informar o peso real exibido no visor digital ou continuar com o peso teórico estimado:
            </p>
            
            {/* Foto da Balança */}
            {tempFotoUrl && (
              <div className="border border-border rounded-xl overflow-hidden max-h-[220px] bg-slate-950 flex items-center justify-center shadow-inner">
                <img src={tempFotoUrl} alt="Foto da balança" className="max-h-[220px] w-auto object-contain" />
              </div>
            )}

            {/* Input de Peso */}
            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold text-xs">Peso Real Aferido na Balança (KG)</Label>
              <Input 
                type="number" 
                value={pesoRealLido} 
                onChange={e => setPesoRealLido(e.target.value)} 
                className="text-center font-mono font-bold text-xl h-11 border-blue-300 text-blue-900 focus-visible:ring-blue-500" 
                placeholder="Digite o peso..."
                autoFocus
              />
              <p className="text-[10px] text-slate-400 text-center">
                *Opcional: Se deixar em branco ou escolher peso teórico, o sistema calculará o peso automático (≈ {(o.kg_estimado || 0).toFixed(1)} kg).
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmarPesoDialog(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={handleFinalizarComPesoTeorico} className="border-slate-300">
              Usar Peso Teórico (≈ {(o.kg_estimado || 0).toFixed(1)} kg)
            </Button>
            <Button onClick={handleConfirmarFinalizacao} className="bg-green-600 hover:bg-green-700 text-white border-0 gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Confirmar Peso Real
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação para CANCELAR ordem Desbobinadeira */}
      <Dialog open={confirmarCancelarOpen} onOpenChange={setConfirmarCancelarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              Cancelar Ordem da Desbobinadeira?
            </DialogTitle>
            <DialogDescription>
              A ordem de desbobinamento será marcada como <strong>Cancelada</strong>.
              Após cancelar, o botão de <strong>Excluir Definitivamente</strong> ficará liberado.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-muted rounded-lg text-xs space-y-1.5 border border-border">
            <p><strong className="text-foreground">OP:</strong> #{o.numero_pedido || o.id}</p>
            <p><strong className="text-foreground">Cliente:</strong> {o.cliente || "—"}</p>
            <p><strong className="text-foreground">Bobina:</strong> {o.bobina_codigo || "—"}</p>
            <p><strong className="text-foreground">Quantidade / Peso:</strong> {formatarQuantidadeComUnidade(o)}</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmarCancelarOpen(false)}>
              Voltar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              onClick={() => {
                setConfirmarCancelarOpen(false);
                onUpdate(o.id, { status: "cancelado" });
                toast.warning(`OP #${o.numero_pedido || o.id} cancelada. Botão Excluir liberado.`);
              }}
            >
              Sim, Cancelar Ordem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação para EXCLUIR DEFINITIVAMENTE (Apenas ordens canceladas) */}
      <Dialog open={confirmarExclusaoOpen} onOpenChange={setConfirmarExclusaoOpen}>
        <DialogContent className="sm:max-w-md border-red-200 dark:border-red-900">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2 font-bold">
              <Trash2 className="w-5 h-5 text-red-600 shrink-0" />
              Excluir Ordem Definitivamente?
            </DialogTitle>
            <DialogDescription className="text-red-600/90 font-medium">
              Atenção: Esta ordem cancelada será apagada permanentemente do sistema da fábrica. Esta ação não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg text-xs space-y-1.5 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200">
            <p><strong>OP:</strong> #{o.numero_pedido || o.id}</p>
            <p><strong>Cliente:</strong> {o.cliente || "—"}</p>
            <p><strong>Bobina:</strong> {o.bobina_codigo || "—"}</p>
            <p><strong>Status Atual:</strong> Cancelada</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmarExclusaoOpen(false)}>
              Manter Cancelada
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1 shadow-md"
              onClick={async () => {
                setConfirmarExclusaoOpen(false);
                try {
                  if (typeof onDelete === "function") {
                    await onDelete(o.id);
                  } else {
                    await base44.entities.OrdemDesbobinadeira.delete(o.id);
                    toast.success(`OP #${o.numero_pedido || o.id} excluída com sucesso!`);
                  }
                } catch (err) {
                  console.error("Erro ao excluir OP:", err);
                  toast.error("Erro ao excluir ordem.");
                }
              }}
            >
              <Trash2 className="w-4 h-4" /> Sim, Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Rápido de Definição / Troca de Bobina e Espessura */}
      <Dialog open={definirBobinaOpen} onOpenChange={setDefinirBobinaOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Layers className="w-5 h-5 text-orange-500" />
              Definir Bobina e Espessura — {o.numero_pedido ? `Pedido #${o.numero_pedido}` : `OP #${o.id}`}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecione a bobina compatível do estoque ou digite a espessura em milímetros para a desbobinadeira.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Atalhos Rápidos de Espessura Comercial */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Atalhos de Espessura Comercial (mm):</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "1,25 (#18)", val: "1,25" },
                  { label: "1,50 mm", val: "1,50" },
                  { label: "1,55 (#16)", val: "1,55" },
                  { label: "1,83 mm", val: "1,83" },
                  { label: "1,95 (#14)", val: "1,95" },
                  { label: "2,00 mm", val: "2,00" },
                  { label: "2,65 (#12)", val: "2,65" },
                  { label: "3,00 mm", val: "3,00" },
                  { label: "4,75 mm", val: "4,75" },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setNovaEspessuraInput(item.val)}
                    className={`px-2 py-1 rounded text-xs font-bold transition-all border ${
                      novaEspessuraInput === item.val
                        ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                        : "bg-muted hover:bg-muted/80 text-foreground border-border"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Manual de Espessura */}
            <div className="space-y-1.5">
              <Label htmlFor="input-espessura" className="text-xs font-semibold">
                Espessura Desejada (mm) *
              </Label>
              <Input
                id="input-espessura"
                placeholder="Ex: 1,95"
                value={novaEspessuraInput}
                onChange={(e) => setNovaEspessuraInput(e.target.value)}
                className="font-mono text-base font-bold"
              />
            </div>

            {/* Seleção de Bobina do Estoque (apenas abertas e aproximadas) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="select-bobina" className="text-xs font-semibold">
                  Bobinas Abertas Compatíveis ({bobinasFiltradasDesb.length}):
                </Label>
                <button
                  type="button"
                  onClick={() => setMostrarTodasBobinas(prev => !prev)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {mostrarTodasBobinas ? "Mostrar apenas aproximadas" : "Mostrar todas as abertas"}
                </button>
              </div>
              <select
                id="select-bobina"
                value={bobinaSelecionadaId}
                onChange={(e) => {
                  const bId = e.target.value;
                  setBobinaSelecionadaId(bId);
                  if (bId) {
                    const b = bobinas.find(x => x.id === bId);
                    if (b) {
                      const esp = String(b.espessura_utilizada || b.chapa || b.espessura_real || b.espessura_mm || "").replace("mm", "").trim();
                      if (esp) setNovaEspessuraInput(esp);
                    }
                  }
                }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Nenhuma bobina vinculada (usar apenas espessura) --</option>
                {bobinasFiltradasDesb.map((b) => {
                  const espB = b.espessura_utilizada || b.chapa || b.espessura_real || b.espessura_mm || "-";
                  const saldo = b.peso_atual ? `${Math.round(b.peso_atual)}kg` : "";
                  return (
                    <option key={b.id} value={b.id}>
                      [{b.codigo || "CD"}] {espB}mm · {b.qualidade || b.cor || "GV"} {b.largura_mm ? `· ${b.largura_mm}mm` : ""} {saldo ? `(${saldo})` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDefinirBobinaOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1"
              disabled={salvandoBobina || (!novaEspessuraInput.trim() && !bobinaSelecionadaId)}
              onClick={handleSalvarEspessuraOuBobina}
            >
              {salvandoBobina ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Salvar Especificações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Senha de Liberação do Gestor para Desbobinadeira 02 (Espessura < 0,80mm) */}
      <SenhaGestorDialog
        open={senhaDesb02Open}
        onOpenChange={setSenhaDesb02Open}
        titulo="🔒 Liberação Desbobinadeira 02 (Espessura < 0,80 mm)"
        descricao={`A Desbobinadeira 02 aceita no mínimo espessura de 0,80 mm. Esta OP possui espessura de ${espNum ? `${espNum} mm` : "menor que 0,80 mm"}. Digite o PIN do gestor para autorizar a produção nesta máquina.`}
        aviso="Espessura abaixo de 0,80 mm na Desbobinadeira 02 exige autorização expressa da gerência."
        iconeAviso={AlertTriangle}
        erroTexto="PIN incorreto. Início na Desbobinadeira 02 bloqueado."
        onAutorizado={() => {
          toast.success(`✅ Início autorizado pelo gestor para Desbobinadeira 02 (${espNum || "< 0,80"} mm)!`);
          if (regras.exigirEtiquetaBobina) setValidacaoDialog(true);
          else doIniciar();
        }}
      />
    </>
  );
}