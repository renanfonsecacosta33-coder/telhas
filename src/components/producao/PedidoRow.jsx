import React, { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, Circle, AlertCircle, Layers, Play, Pause, Square, Timer, Coffee, AlertTriangle, FileText, Camera, Scissors, Snowflake, Lock, RotateCcw, ShoppingCart, User, Users, PackageCheck, Truck } from "lucide-react";
import RetrabalhoTelhasDialog from "@/components/producao/RetrabalhoTelhasDialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import ValidacaoEtiquetaTelhasDialog from "@/components/producao/ValidacaoEtiquetaTelhasDialog";
import ConfirmarInicioDialog from "@/components/producao/ConfirmarInicioDialog";
import ConferirBobinaItemDialog from "@/components/producao/ConferirBobinaItemDialog";
import FinalizarItemVariacaoDialog from "@/components/producao/FinalizarItemVariacaoDialog";
import IniciarOpOperadoresDialog from "@/components/producao/IniciarOpOperadoresDialog";
import ItensVariacoesTelhas from "@/components/producao/ItensVariacoesTelhas";
import PainelBobinaInferior from "@/components/producao/PainelBobinaInferior";
import SeletorBobinaProducao from "@/components/producao/SeletorBobinaProducao";
import { isBobinaAberta } from "@/lib/bobinaStatusHelper";
import CumeeiraEstoqueDialog from "@/components/producao/CumeeiraEstoqueDialog";
import { playFinishSound, speakOpFinalizada, playAlertSound } from "@/lib/sounds";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ChatPedidoButton from "@/components/chat/ChatPedidoButton";
import { PrioridadeBadge, BannerPrioridadeDestaque, isPedidoRetiraAgora, isPedidoRota, getCardPrioridadeClasses } from "@/lib/prioridadeHelper";
import ProcessoStepperPedido from "@/components/producao/ProcessoStepperPedido";
import PedidoRowEntrega from "@/components/producao/PedidoRowEntrega";
import AlertaMultiplasOpsMesmoPedido from "@/components/producao/AlertaMultiplasOpsMesmoPedido"; import BandejaColagemInfoPanel from "@/components/producao/BandejaColagemInfoPanel";
import SmartImage from "@/components/ui/SmartImage";
import { comprimirImagemParaUpload, criarPreviewLocalInstantaneo } from "@/lib/compressImage";
import { isTelhaBandeja, verificarStatusComponentesBandeja } from "@/lib/bandejaHelper"; import { descricaoItemOriginal } from "@/lib/descricaoItemOriginal";
import { useRegrasProducao } from "@/lib/regrasProducao";
import { detectarTipoProdutoTelha, detectarEPSTelha, detectarMaquinaTelha } from "@/lib/pedidoOdooHelper";


const PRODUTO_BG = {
  "TELHA":               "border-l-blue-400",
  "TELHA + EPS":         "border-l-emerald-400",
  "TELHA + EPS + MANTA": "border-l-teal-400",
  "TELHA + EPS + TELHA": "border-l-indigo-400",
  "TELHA BANDEJA":       "border-l-pink-400",
  "BOBININHA":           "border-l-yellow-400",
  "CUMEEIRA":            "border-l-orange-400",
  "PAINEL":              "border-l-purple-400",
};

const PRODUTOS_COM_EPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"];

// Fluxos de máquinas para produtos multi-etapa
function proximaMaquinaFluxo(produto, maquinaAtual) {
  if (isTelhaBandeja({ produto })) {
    const norm = String(maquinaAtual || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (norm === "BANDEJA") return "COLAGEM";
    if (norm === "COLONIAL") return "BANDEJA";
    if (norm === "TP25") return "BANDEJA";
    if (norm === "COLAGEM") return null;
    return "BANDEJA";
  }
  return null;
}

function labelProximaEtapa(produto, maquinaAtual) {
  const prox = proximaMaquinaFluxo(produto, maquinaAtual);
  if (!prox) return null;
  return `→ ${prox === "TP - 40" ? "TP-40" : prox.charAt(0) + prox.slice(1).toLowerCase()}`;
}

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export default function PedidoRow({ pedido: pOriginal, onStatusChange, onUpdate, userRole, opRodando, maquina, user, filialAtiva, appendHistoricoFn, todosPedidos = [] }) {
  const isOperador = userRole === "operador";
  const podeGerenciar = !isOperador;

  // Detecção inteligente e dinâmica do produto real (corrige OPs que foram salvas como TELHA + EPS mas têm TELHA + EPS + TELHA, ou OPs salvas como TELHA + EPS que na verdade são TELHAS SIMPLES)
  const produtoDetectado = useMemo(() => {
    if (!pOriginal) return "TELHA";
    const rawProd = pOriginal.produto || pOriginal._presets?.produto || "";
    // NUNCA incluir pOriginal.eps no textoContexto para não criar loop de falso positivo
    const textoContexto = [
      pOriginal.item_produto,
      pOriginal.produto_rotulo_pcp,
      pOriginal.modelo,
      pOriginal.observacoes_odoo,
      pOriginal.observacoes,
      pOriginal._presets?.item_produto,
      pOriginal._presets?.produto_rotulo_pcp,
      pOriginal._presets?.observacoes_odoo,
      rawProd
    ].filter(Boolean).join(" ");

    // Checa se o texto do item / cadastro Odoo tem indício real de termoacústica / EPS / sanduíche / bandeja
    const temIndicioEpsReal = /\b(eps|isopor|sanduiche|sanduíche|termoacustica|termoacústica|manta|bandeja|pir|pur)\b/i.test(textoContexto) ||
      /(eps\s*\d+|isopor\s*\d+)/i.test(textoContexto);

    // Se o pedido original foi gravado como TELHA + EPS mas o item Odoo é TELHA SIMPLES (sem EPS nenhum):
    if (!temIndicioEpsReal && (rawProd === "TELHA + EPS" || rawProd === "TELHA + EPS + MANTA" || rawProd === "TELHA + EPS + TELHA")) {
      return "TELHA";
    }

    const tipoDetectado = detectarTipoProdutoTelha(rawProd, textoContexto);
    // Se no texto há clara indicação de TELHA + EPS + TELHA
    if (tipoDetectado === "TELHA + EPS + TELHA") {
      return "TELHA + EPS + TELHA";
    }
    if (tipoDetectado && tipoDetectado !== "TELHA" && (rawProd === "TELHA" || rawProd === "TELHA + EPS")) {
      return temIndicioEpsReal ? tipoDetectado : "TELHA";
    }
    return (!temIndicioEpsReal && rawProd?.includes("EPS")) ? "TELHA" : (rawProd || tipoDetectado || "TELHA");
  }, [pOriginal]);

  const epsDetectado = useMemo(() => {
    if (!pOriginal) return "";
    // Se o pedido já é explicitamente TELHA simples, nunca tem EPS
    if (pOriginal.produto === "TELHA" && !pOriginal.eps) return "";

    const textoContexto = [
      pOriginal.item_produto,
      pOriginal.produto_rotulo_pcp,
      pOriginal.modelo,
      pOriginal.observacoes_odoo,
      pOriginal.observacoes
    ].filter(Boolean).join(" ");

    const temIndicioEpsReal = /\b(eps|isopor|sanduiche|sanduíche|termoacustica|termoacústica|manta|bandeja|pir|pur)\b/i.test(textoContexto) ||
      /(eps\s*\d+|isopor\s*\d+)/i.test(textoContexto);

    // Se o produto NÃO tem indício de EPS no texto, SEMPRE retorna vazio (telha simples nunca tem EPS)
    if (!temIndicioEpsReal) return "";

    if (pOriginal.eps && PRODUTOS_COM_EPS.includes(pOriginal.produto)) return pOriginal.eps;
    if (pOriginal._presets?.eps) return pOriginal._presets.eps;
    return detectarEPSTelha(textoContexto, pOriginal.maquina || maquina);
  }, [pOriginal, maquina]);

  // Normalização ultra-robusta com fallback completo para _presets (recupera OPs sem cabeçalho)
  const p = useMemo(() => {
    if (!pOriginal) return {};
    const presets = pOriginal._presets || {};
    // Identifica se é CUMEEIRA
    const ehCumeeira = (pOriginal.produto === "CUMEEIRA" || produtoDetectado === "CUMEEIRA" || /\bCUMEEIRA\b/i.test(`${pOriginal.item_produto || ""} ${pOriginal.modelo || ""} ${pOriginal.observacoes || ""}`));

    // Se o usuário selecionou TELHA manualmente ou foi detectada TELHA sem indício de EPS
    let prodFinal = (produtoDetectado === "TELHA" || pOriginal.produto === "TELHA")
      ? "TELHA"
      : (produtoDetectado || pOriginal.produto || presets.produto || "TELHA");

    if (ehCumeeira) {
      prodFinal = "CUMEEIRA";
    }

    const ehComEps = !ehCumeeira && (PRODUTOS_COM_EPS.includes(prodFinal) && Boolean(epsDetectado));
    const maqPerfil = pOriginal.maquina_origem || detectarMaquinaTelha(pOriginal) || (pOriginal.modelo?.toLowerCase().includes("colonial") ? "COLONIAL" : pOriginal.modelo?.includes("25") ? "TP - 25" : "TP - 40");

    // Se é cumeeira, a máquina SEMPRE é CUMEEIRA
    // Se é telha simples, NUNCA permite ficar em colagem ou com status de colagem
    // Se ela já foi perfilada ou estava em aguardando_colagem, para telha simples ela está FINALIZADA!
    const jaPerfilada = Boolean(pOriginal.perfilacao_concluida || pOriginal.data_perfilacao || pOriginal.status === "aguardando_colagem");
    const statusAjustado = (!ehComEps && (pOriginal.status === "aguardando_colagem" || pOriginal.maquina === "COLAGEM"))
      ? (jaPerfilada ? "finalizado" : "pendente")
      : (pOriginal.status || presets.status || "pendente");

    const maquinaAjustada = ehCumeeira
      ? "CUMEEIRA"
      : (!ehComEps && pOriginal.maquina === "COLAGEM")
      ? maqPerfil
      : (pOriginal.maquina || presets.maquina || maquina || "");

    return {
      ...presets,
      ...pOriginal,
      produto: prodFinal,
      eps: ehComEps ? (pOriginal.eps || presets.eps || epsDetectado || "") : "",
      status: statusAjustado,
      maquina: maquinaAjustada,
      numero_pedido: pOriginal.numero_pedido || presets.numero_pedido || "",
      numero_oc: pOriginal.numero_oc || presets.numero_oc || "",
      cliente: pOriginal.cliente || presets.cliente || "",
      vendedor: pOriginal.vendedor || presets.vendedor || "",
      metros: (pOriginal.metros !== undefined && pOriginal.metros !== null && pOriginal.metros !== "") ? pOriginal.metros : (presets.metros ?? 0),
      metragem_mm: (pOriginal.metragem_mm !== undefined && pOriginal.metragem_mm !== null && pOriginal.metragem_mm !== "") ? pOriginal.metragem_mm : (presets.metragem_mm ?? 0),
      quantidade_telhas: (pOriginal.quantidade_telhas !== undefined && pOriginal.quantidade_telhas !== null && pOriginal.quantidade_telhas !== "") ? pOriginal.quantidade_telhas : (presets.quantidade_telhas ?? 0),
      variacoes_telhas: pOriginal.variacoes_telhas || presets.variacoes_telhas || "",
      espessura_exigida: pOriginal.espessura_exigida || presets.espessura_exigida || "",
      origem_exigida: pOriginal.origem_exigida || presets.origem_exigida || "",
      observacoes_odoo: pOriginal.observacoes_odoo || presets.observacoes_odoo || "",
      foto_pedido_url: pOriginal.foto_pedido_url || presets.foto_pedido_url || "",
      bobina_superior: pOriginal.bobina_superior || presets.bobina_superior || "",
      bobina_superior_id: pOriginal.bobina_superior_id || presets.bobina_superior_id || "",
      bobina_inferior: pOriginal.bobina_inferior || presets.bobina_inferior || "",
      bobina_inferior_id: pOriginal.bobina_inferior_id || presets.bobina_inferior_id || "",
      rvm_inferior: pOriginal.rvm_inferior || presets.rvm_inferior || "",
    };
  }, [pOriginal, maquina, produtoDetectado, epsDetectado]);

  // Detecta se a OP é de Bobininha (desbobinador)
  const isBobininha = useMemo(() => {
    const texto = `${p.produto || ""} ${p.modelo || ""} ${p.item_produto || ""} ${p.produto_rotulo_pcp || ""} ${p.maquina || ""}`.toLowerCase();
    return p.produto === "BOBININHA" || p.maquina === "DESBOBINADOR" || p.maquina === "BOBININHA" || /(bobininha|bobinina|slitter|desbobinamento)/i.test(texto);
  }, [p]);

  const regras = useRegrasProducao();

  const [pauseDialog, setPauseDialog] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState("");
  const [pauseTipo, setPauseTipo] = useState("setup"); // "setup" | "outro"
  const [metragemDialog, setMetragemDialog] = useState(false);
  const [metragemReal, setMetragemReal] = useState("");
  const [telhasSandwichDialog, setTelhasSandwichDialog] = useState(false);
  const [telhaSupOk, setTelhaSupOk] = useState(false);
  const [telhaInfOk, setTelhaInfOk] = useState(false);
  const [tick, setTick] = useState(0);
  const [validacaoEtiquetaOpen, setValidacaoEtiquetaOpen] = useState(false);
  const [retrabalhoOpen, setRetrabalhoOpen] = useState(false);
  const [confirmarInicioOpen, setConfirmarInicioOpen] = useState(false);
  const [fotoFinalizacaoUrl, setFotoFinalizacaoUrl] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [validarEpsColagemOpen, setValidarEpsColagemOpen] = useState(false);
  const [fotoColagemEpsUrl, setFotoColagemEpsUrl] = useState("");
  const [uploadingFotoColagemEps, setUploadingFotoColagemEps] = useState(false);
  const [conferirBobinaModal, setConferirBobinaModal] = useState({ open: false, item: null, index: 0 });
  const [finalizarItemModal, setFinalizarItemModal] = useState({ open: false, item: null, index: 0 });
  const [operadoresDialogOpen, setOperadoresDialogOpen] = useState(false);
  const [pendingColagemUpdates, setPendingColagemUpdates] = useState(null);
  const [cumeeiraEstoqueOpen, setCumeeiraEstoqueOpen] = useState(false);
  const intervalRef = useRef(null);

  const queryClient = useQueryClient();

  // Estados dos Campos Escritos de Bobinas (Permite ao operador e gestor ajustar livremente o texto)
  const [editandoBobinaSup, setEditandoBobinaSup] = useState(false);
  const [overrideBobinaSup, setOverrideBobinaSup] = useState(null);
  const [salvandoBobinaSup, setSalvandoBobinaSup] = useState(false);

  const [editandoBobinaInf, setEditandoBobinaInf] = useState(false);
  const [overrideBobinaInf, setOverrideBobinaInf] = useState(null);
  const [salvandoBobinaInf, setSalvandoBobinaInf] = useState(false);

  // Rótulo visual simplificado instantâneo (limpa strings longas de estoque antigo como "CD0247 0,43 (GV)...")
  // FIDELIDADE PCP: exibe exatamente o texto enviado pela Central PCP, sem reescrita/derivação
  const bobinaSuperiorVisual = useMemo(() => {
    if (overrideBobinaSup !== null) return overrideBobinaSup;
    return p.bobina_superior || "—";
  }, [overrideBobinaSup, p.bobina_superior]);

  const bobinaInferiorVisual = useMemo(() => {
    if (overrideBobinaInf !== null) return overrideBobinaInf;
    return p.bobina_inferior || "—";
  }, [overrideBobinaInf, p.bobina_inferior]);

  const [textoBobinaSup, setTextoBobinaSup] = useState(bobinaSuperiorVisual);
  const [textoBobinaInf, setTextoBobinaInf] = useState(bobinaInferiorVisual);
  // Seleção das bobinas abertas usadas nesta OP (superior e, no sanduíche, a inferior)
  const [bobSelSupId, setBobSelSupId] = useState("");
  const [bobSelInfId, setBobSelInfId] = useState("");
  const [mesmaBobina, setMesmaBobina] = useState(false);

  useEffect(() => {
    if (overrideBobinaSup === null) {
      setTextoBobinaSup(bobinaSuperiorVisual);
    }
  }, [bobinaSuperiorVisual, overrideBobinaSup]);

  useEffect(() => {
    if (overrideBobinaInf === null) {
      setTextoBobinaInf(bobinaInferiorVisual);
    }
  }, [bobinaInferiorVisual, overrideBobinaInf]);

  const handleSalvarBobinaSup = async () => {
    if (!p?.id) return;
    const novoTexto = textoBobinaSup.trim();
    if (!novoTexto) {
      toast.warning("Digite o código ou descrição da bobina");
      return;
    }

    // 1. ATUALIZAÇÃO INSTANTÂNEA NA MEMÓRIA E TELA (0ms) - Card atualiza no milissegundo do clique
    setOverrideBobinaSup(novoTexto);
    setEditandoBobinaSup(false);
    setSalvandoBobinaSup(true);

    // 2. Busca vínculo no estoque se houver código correspondente
    let bobinaIdMatch = null;
    let corMatch = null;
    let espMatch = null;
    if (Array.isArray(todasBobinas) && todasBobinas.length > 0) {
      const normTxt = novoTexto.toUpperCase().trim();
      const match = todasBobinas.find(b => {
        const cod = (b.codigo_bobina || b.codigo || "").toUpperCase();
        return cod && cod.length >= 3 && normTxt.includes(cod);
      });
      if (match) {
        bobinaIdMatch = match.id;
        corMatch = match.cor;
        espMatch = match.espessura;
      }
    }

    const payloadUpdates = {
      bobina_superior: novoTexto,
      bobina_superior_manual: true,
      ...(bobinaIdMatch ? { bobina_superior_id: bobinaIdMatch } : {}),
      ...(corMatch ? { rvm_superior: corMatch } : {}),
      ...(espMatch ? { espessura_exigida: espMatch } : {})
    };

    // 3. Atualização Instantânea no Cache do React Query para não piscar nem reverter
    queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
      if (!antigos || !Array.isArray(antigos)) return antigos;
      return antigos.map(item => item.id === p.id ? { ...item, ...payloadUpdates } : item);
    });

    try {
      // 4. Persiste no banco de dados
      await base44.entities.Pedido.update(p.id, payloadUpdates);
      toast.success(`Bobina de produção ajustada para: "${novoTexto}"`);

      // 5. Registra no histórico e sincroniza com Pedido Odoo / PCP se aplicável
      if (appendHistoricoFn) {
        appendHistoricoFn(p, "bobina_ajustada", "Ajustou Bobina de Produção", `Bobina superior alterada para "${novoTexto}"`);
      }

      if (p.numero_pedido) {
        const numLimpo = String(p.numero_pedido).trim().replace(/^#/, "");
        base44.entities.PedidoOdoo.filter({ numero_pedido: numLimpo }, "-created_date", 1).then(odooList => {
          if (odooList && odooList[0]) {
            const pedOdoo = odooList[0];
            const logExistente = (() => { try { return JSON.parse(pedOdoo.historico_log || "[]"); } catch { return []; } })();
            const novoLog = [...logExistente, {
              data: new Date().toISOString(),
              usuario: user?.full_name || user?.email || "Operador",
              acao: "ajuste_bobina_superior",
              detalhes: `Bobina superior ajustada para "${novoTexto}"`
            }];
            base44.entities.PedidoOdoo.update(pedOdoo.id, {
              historico_log: JSON.stringify(novoLog)
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      if (onUpdate) onUpdate(p, p.status, payloadUpdates);
    } catch (err) {
      console.error("[PedidoRow] Erro ao salvar bobina superior:", err);
      toast.error("Erro ao salvar bobina: " + (err?.message || ""));
      setOverrideBobinaSup(null);
    } finally {
      setSalvandoBobinaSup(false);
    }
  };

  const handleSalvarBobinaInf = async () => {
    if (!p?.id) return;
    const novoTexto = textoBobinaInf.trim();
    if (!novoTexto) {
      toast.warning("Digite o código ou descrição da bobina inferior");
      return;
    }

    // 1. ATUALIZAÇÃO INSTANTÂNEA NA MEMÓRIA E TELA (0ms) - Card atualiza no milissegundo do clique
    setOverrideBobinaInf(novoTexto);
    setEditandoBobinaInf(false);
    setSalvandoBobinaInf(true);

    // 2. Busca vínculo no estoque se houver código correspondente
    let bobinaIdMatch = null;
    let corMatch = null;
    let espMatch = null;
    if (Array.isArray(todasBobinas) && todasBobinas.length > 0) {
      const normTxt = novoTexto.toUpperCase().trim();
      const match = todasBobinas.find(b => {
        const cod = (b.codigo_bobina || b.codigo || "").toUpperCase();
        return cod && cod.length >= 3 && normTxt.includes(cod);
      });
      if (match) {
        bobinaIdMatch = match.id;
        corMatch = match.cor;
        espMatch = match.espessura;
      }
    }

    const payloadUpdates = {
      bobina_inferior: novoTexto,
      bobina_inferior_manual: true,
      ...(bobinaIdMatch ? { bobina_inferior_id: bobinaIdMatch } : {}),
      ...(corMatch ? { rvm_inferior: corMatch } : {})
    };

    // 3. Atualização Instantânea no Cache do React Query para não piscar nem reverter
    queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
      if (!antigos || !Array.isArray(antigos)) return antigos;
      return antigos.map(item => item.id === p.id ? { ...item, ...payloadUpdates } : item);
    });

    try {
      // 4. Persiste no banco de dados
      await base44.entities.Pedido.update(p.id, payloadUpdates);
      toast.success(`Bobina da chapa inferior ajustada para: "${novoTexto}"`);

      // 5. Registra no histórico e sincroniza com Pedido Odoo / PCP se aplicável
      if (appendHistoricoFn) {
        appendHistoricoFn(p, "bobina_ajustada", "Ajustou Bobina Inferior", `Bobina inferior alterada para "${novoTexto}"`);
      }

      if (p.numero_pedido) {
        const numLimpo = String(p.numero_pedido).trim().replace(/^#/, "");
        base44.entities.PedidoOdoo.filter({ numero_pedido: numLimpo }, "-created_date", 1).then(odooList => {
          if (odooList && odooList[0]) {
            const pedOdoo = odooList[0];
            const logExistente = (() => { try { return JSON.parse(pedOdoo.historico_log || "[]"); } catch { return []; } })();
            const novoLog = [...logExistente, {
              data: new Date().toISOString(),
              usuario: user?.full_name || user?.email || "Operador",
              acao: "ajuste_bobina_inferior",
              detalhes: `Bobina da chapa inferior ajustada para "${novoTexto}"`
            }];
            base44.entities.PedidoOdoo.update(pedOdoo.id, {
              historico_log: JSON.stringify(novoLog)
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      if (onUpdate) onUpdate(p, p.status, payloadUpdates);
    } catch (err) {
      console.error("[PedidoRow] Erro ao salvar bobina inferior:", err);
      toast.error("Erro ao salvar bobina inferior: " + (err?.message || ""));
      setOverrideBobinaInf(null);
    } finally {
      setSalvandoBobinaInf(false);
    }
  };

  // ==========================================
  // ESTADOS E HANDLERS: COR / RVM E ESPESSURA
  // ==========================================
  const CORES_RAPIDAS = ["Natural", "Preto", "Branco", "Cinza", "Cerâmica", "Azul", "Bege", "Marrom"];
  const ESPESSURAS_RAPIDAS = ["0,35", "0,40", "0,43", "0,50", "0,65", "0,80", "0,90", "1,00", "1,20"];

  // Estados Cor e Espessura Superior
  const [editandoCorSup, setEditandoCorSup] = useState(false);
  const [overrideCorSup, setOverrideCorSup] = useState(null);
  const [textoCorSup, setTextoCorSup] = useState(p?.rvm_superior || p?.cor_superior || "Natural");
  const [salvandoCorSup, setSalvandoCorSup] = useState(false);

  const [editandoEspSup, setEditandoEspSup] = useState(false);
  const [overrideEspSup, setOverrideEspSup] = useState(null);
  const [textoEspSup, setTextoEspSup] = useState(p?.espessura_exigida || p?.espessura || "0,43");
  const [salvandoEspSup, setSalvandoEspSup] = useState(false);

  // Estados Cor e Espessura Inferior
  const [editandoCorInf, setEditandoCorInf] = useState(false);
  const [overrideCorInf, setOverrideCorInf] = useState(null);
  const [textoCorInf, setTextoCorInf] = useState(p?.rvm_inferior || p?.cor_inferior || p?.rvm_superior || "Natural");
  const [salvandoCorInf, setSalvandoCorInf] = useState(false);

  const [editandoEspInf, setEditandoEspInf] = useState(false);
  const [overrideEspInf, setOverrideEspInf] = useState(null);
  const [textoEspInf, setTextoEspInf] = useState(p?.espessura_inferior || p?.espessura_exigida || p?.espessura || "0,43");
  const [salvandoEspInf, setSalvandoEspInf] = useState(false);

  useEffect(() => {
    if (p?.rvm_superior && overrideCorSup === null) setTextoCorSup(p.rvm_superior);
  }, [p?.rvm_superior, overrideCorSup]);

  useEffect(() => {
    if ((p?.espessura_exigida || p?.espessura) && overrideEspSup === null) setTextoEspSup(p.espessura_exigida || p.espessura);
  }, [p?.espessura_exigida, p?.espessura, overrideEspSup]);

  useEffect(() => {
    if (p?.rvm_inferior && overrideCorInf === null) setTextoCorInf(p.rvm_inferior);
  }, [p?.rvm_inferior, overrideCorInf]);

  useEffect(() => {
    if ((p?.espessura_inferior || p?.espessura_exigida) && overrideEspInf === null) setTextoEspInf(p.espessura_inferior || p.espessura_exigida);
  }, [p?.espessura_inferior, p?.espessura_exigida, overrideEspInf]);

  const handleSalvarCorSup = async (corEscolhida) => {
    if (!p?.id) return;
    const valor = String(corEscolhida !== undefined ? corEscolhida : textoCorSup).trim();
    if (!valor) { toast.warning("Digite ou selecione uma cor"); return; }
    setOverrideCorSup(valor);
    setTextoCorSup(valor);
    setEditandoCorSup(false);
    setSalvandoCorSup(true);

    const payload = { rvm_superior: valor, cor_superior: valor };
    queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
      if (!antigos || !Array.isArray(antigos)) return antigos;
      return antigos.map(item => item.id === p.id ? { ...item, ...payload } : item);
    });

    try {
      await base44.entities.Pedido.update(p.id, payload);
      toast.success(`Cor/RVM Superior ajustada para "${valor}"`);
      if (appendHistoricoFn) {
        appendHistoricoFn(p, "cor_ajustada", "Ajustou Cor/RVM Superior", `Cor superior alterada para "${valor}"`);
      }
      if (onUpdate) onUpdate(p, p.status, payload);
    } catch (e) {
      console.error("Erro ao salvar cor superior:", e);
      toast.error("Erro ao salvar cor");
      setOverrideCorSup(null);
    } finally {
      setSalvandoCorSup(false);
    }
  };

  const handleSalvarEspSup = async (espEscolhida) => {
    if (!p?.id) return;
    const valor = String(espEscolhida !== undefined ? espEscolhida : textoEspSup).trim();
    if (!valor) { toast.warning("Digite ou selecione uma espessura"); return; }
    setOverrideEspSup(valor);
    setTextoEspSup(valor);
    setEditandoEspSup(false);
    setSalvandoEspSup(true);

    const payload = { espessura_exigida: valor, espessura: valor };
    queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
      if (!antigos || !Array.isArray(antigos)) return antigos;
      return antigos.map(item => item.id === p.id ? { ...item, ...payload } : item);
    });

    try {
      await base44.entities.Pedido.update(p.id, payload);
      toast.success(`Espessura Superior ajustada para "${valor} mm"`);
      if (appendHistoricoFn) {
        appendHistoricoFn(p, "espessura_ajustada", "Ajustou Espessura Superior", `Espessura alterada para "${valor} mm"`);
      }
      if (onUpdate) onUpdate(p, p.status, payload);
    } catch (e) {
      console.error("Erro ao salvar espessura:", e);
      toast.error("Erro ao salvar espessura");
      setOverrideEspSup(null);
    } finally {
      setSalvandoEspSup(false);
    }
  };

  const handleSalvarCorInf = async (corEscolhida) => {
    if (!p?.id) return;
    const valor = String(corEscolhida !== undefined ? corEscolhida : textoCorInf).trim();
    if (!valor) { toast.warning("Digite ou selecione uma cor"); return; }
    setOverrideCorInf(valor);
    setTextoCorInf(valor);
    setEditandoCorInf(false);
    setSalvandoCorInf(true);

    const payload = { rvm_inferior: valor, cor_inferior: valor };
    queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
      if (!antigos || !Array.isArray(antigos)) return antigos;
      return antigos.map(item => item.id === p.id ? { ...item, ...payload } : item);
    });

    try {
      await base44.entities.Pedido.update(p.id, payload);
      toast.success(`Cor/RVM Inferior ajustada para "${valor}"`);
      if (appendHistoricoFn) {
        appendHistoricoFn(p, "cor_ajustada", "Ajustou Cor/RVM Inferior", `Cor inferior alterada para "${valor}"`);
      }
      if (onUpdate) onUpdate(p, p.status, payload);
    } catch (e) {
      console.error("Erro ao salvar cor inferior:", e);
      toast.error("Erro ao salvar cor");
      setOverrideCorInf(null);
    } finally {
      setSalvandoCorInf(false);
    }
  };

  const handleSalvarEspInf = async (espEscolhida) => {
    if (!p?.id) return;
    const valor = String(espEscolhida !== undefined ? espEscolhida : textoEspInf).trim();
    if (!valor) { toast.warning("Digite ou selecione uma espessura"); return; }
    setOverrideEspInf(valor);
    setTextoEspInf(valor);
    setEditandoEspInf(false);
    setSalvandoEspInf(true);

    const payload = { espessura_inferior: valor };
    queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
      if (!antigos || !Array.isArray(antigos)) return antigos;
      return antigos.map(item => item.id === p.id ? { ...item, ...payload } : item);
    });

    try {
      await base44.entities.Pedido.update(p.id, payload);
      toast.success(`Espessura Inferior ajustada para "${valor} mm"`);
      if (appendHistoricoFn) {
        appendHistoricoFn(p, "espessura_ajustada", "Ajustou Espessura Inferior", `Espessura inferior alterada para "${valor} mm"`);
      }
      if (onUpdate) onUpdate(p, p.status, payload);
    } catch (e) {
      console.error("Erro ao salvar espessura inferior:", e);
      toast.error("Erro ao salvar espessura");
      setOverrideEspInf(null);
    } finally {
      setSalvandoEspInf(false);
    }
  };

  // Identifica se este pedido é de Cumeeira
  const isCumeeira = useMemo(() => {
    return (
      String(maquina || "").toUpperCase() === "CUMEEIRA" ||
      String(p?.maquina || "").toUpperCase() === "CUMEEIRA" ||
      p?.produto === "CUMEEIRA" ||
      produtoDetectado === "CUMEEIRA" ||
      /\bCUMEEIRA\b/i.test(`${p?.item_produto || ""} ${p?.modelo || ""} ${p?.produto || ""} ${p?.observacoes || ""} ${p?.observacoes_odoo || ""}`)
    );
  }, [maquina, p?.maquina, p?.produto, p?.item_produto, p?.modelo, p?.observacoes, p?.observacoes_odoo, produtoDetectado]);

  // Análise de fluxo paralelo de Telha Bandeja (Telha Normal + Bandeja Inferior + Colagem)
  const diagBandeja = useMemo(() => verificarStatusComponentesBandeja(p, todosPedidos), [p, todosPedidos]);
  const isComponenteParaleloBandeja = Boolean(p.tipo_componente_bandeja === "telha_superior" || p.tipo_componente_bandeja === "bandeja_inferior");

  // Lista de bobinas para conferência nos itens de múltiplas medidas
  const { data: todasBobinas = [] } = useQuery({
    queryKey: ["todas-bobinas-row"],
    queryFn: () => base44.entities.Bobina.list(),
    staleTime: 60000,
  });

  // Somente bobinas ABERTAS da loja do próprio pedido (ex.: pedido da Matriz → bobinas da Matriz), setor Telhas
  const unidadePedido = p.unidade || filialAtiva;
  const bobinasAbertas = useMemo(() => (todasBobinas || []).filter(b =>
    Boolean(b?.id) && isBobinaAberta(b) && (Number(b.peso_kg) || 0) > 0 &&
    (!b.setor || b.setor === "telhas") &&
    (!unidadePedido || unidadePedido === "todas" || !b.unidade || b.unidade === unidadePedido)
  ).sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || ""), undefined, { numeric: true })), [todasBobinas, unidadePedido]);

  const exigeDuasBobinas = p.produto === "TELHA + EPS + TELHA";
  const precisaEscolherBobina = p.status === "pendente" && p.maquina !== "COLAGEM";
  const bobinaEscolhida = !precisaEscolherBobina || (Boolean(bobSelSupId) && (!exigeDuasBobinas || Boolean(mesmaBobina ? bobSelSupId : bobSelInfId)));

  const textoBobinaPorId = (id) => {
    const b = (todasBobinas || []).find(x => x.id === id);
    return b ? `${b.codigo || ""} ${b.cor || ""} ${b.chapa || b.espessura_real || ""}mm`.replace(/\s+/g, " ").trim() : "";
  };

  const montarUpdatesBobina = () => {
    if (!precisaEscolherBobina || !bobSelSupId) return null;
    const infId = exigeDuasBobinas ? (mesmaBobina ? bobSelSupId : (bobSelInfId || null)) : null;
    return {
      bobina_superior_id: bobSelSupId,
      bobina_superior: textoBobinaPorId(bobSelSupId) || p.bobina_superior || "",
      ...(exigeDuasBobinas ? {
        bobina_inferior_id: infId,
        bobina_inferior: textoBobinaPorId(infId) || p.bobina_inferior || ""
      } : {})
    };
  };

  // Bobina principal da OP para extração de detalhes técnicos e origem
  const bobinaPrincipalObj = useMemo(() => {
    if (!todasBobinas || !todasBobinas.length) return null;
    const targetId = p.bobina_superior_id || p.bobina_superior;
    if (!targetId) return null;
    return todasBobinas.find(b =>
      b.id === targetId ||
      b.codigo === targetId ||
      (b.codigo && String(targetId).toUpperCase().includes(String(b.codigo).toUpperCase()))
    ) || null;
  }, [todasBobinas, p.bobina_superior_id, p.bobina_superior]);

  // Parse variações de telhas para verificar se todos os itens estão finalizados
  let _variacoesTelhas = [];
  try { _variacoesTelhas = JSON.parse(p.variacoes_telhas || "[]"); } catch { _variacoesTelhas = []; }
  if (!Array.isArray(_variacoesTelhas)) _variacoesTelhas = [];
  const temVariacoes = _variacoesTelhas.length > 0;
  const todosItensFinalizados = temVariacoes ? _variacoesTelhas.every(v => v.finalizado) : true;

  // Auto-limpa quaisquer solicitações pendentes residuais para desobstruir pedidos
  const { data: solicitacoesPendentes = [] } = useQuery({
    queryKey: ["solicitacao-producao-pedido", p.id],
    queryFn: () => base44.entities.SolicitacaoProducao.filter({
      pedido_id: p.id, status: "pendente"
    }, "-created_date", 5),
    enabled: !!p.id,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (solicitacoesPendentes.length > 0) {
      solicitacoesPendentes.forEach((s) => {
        base44.entities.SolicitacaoProducao.update(s.id, {
          status: "aprovada",
          resposta_admin: "Auto-liberado pelo sistema",
          data_avaliacao: new Date().toISOString(),
        }).catch(() => {});
      });
    }
  }, [solicitacoesPendentes]);

  const uploadFotoEpsPromiseRef = useRef(null);

  const handleUploadFotoColagemEps = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local instantâneo (0ms)
    const previewUrl = criarPreviewLocalInstantaneo(file);
    setFotoColagemEpsUrl(previewUrl);
    setUploadingFotoColagemEps(true);

    uploadFotoEpsPromiseRef.current = (async () => {
      try {
        const fileOtimizado = await comprimirImagemParaUpload(file);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: fileOtimizado });
        setFotoColagemEpsUrl(file_url);
        return file_url;
      } catch (err) {
        console.warn("Aviso upload EPS em background:", err);
        return previewUrl;
      } finally {
        setUploadingFotoColagemEps(false);
      }
    })();
  };

  const handleConfirmarColagemEps = async (pularFoto = false) => {
    if (!fotoColagemEpsUrl && !pularFoto) {
      alert("Por favor, tire uma foto do bloco de EPS para validar antes de iniciar!");
      return;
    }
    setValidarEpsColagemOpen(false);

    let urlFinal = fotoColagemEpsUrl;
    if (uploadFotoEpsPromiseRef.current) {
      try {
        urlFinal = await uploadFotoEpsPromiseRef.current;
      } catch {}
    }

    const updates = {
      ...(urlFinal ? { foto_colagem_eps_url: urlFinal } : {}),
    };
    if (appendHistoricoFn) {
      Object.assign(updates, appendHistoricoFn(p, "inicio_colagem_validado", pularFoto ? "Iniciou colagem (modo direto)" : "Validou EPS e iniciou colagem"));
    }
    setPendingColagemUpdates(updates);
    if (regras.exigirOperadorInicio) {
      setOperadoresDialogOpen(true);
    } else {
      handleConfirmarOperadores(null, updates);
    }
  };

  // Tick a cada segundo APENAS se o pedido estiver em produção nesta máquina (poupa 95% de renderizações)
  useEffect(() => {
    if (p.status !== "em_producao") return;
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [p.status]);

  const borderColor = PRODUTO_BG[p.produto] || "border-l-slate-300";
  const temEpsReal = Boolean(
    PRODUTOS_COM_EPS.includes(p.produto) ||
    (p.eps && String(p.eps).trim().length > 0) ||
    /(eps|manta|sanduiche|sanduíche|isopor|termoacustica|termoacústica|pir|pur|bandeja)/i.test(
      `${p.produto || ""} ${p.modelo || ""} ${p.item_produto || ""} ${p.observacoes || ""} ${p.observacoes_odoo || ""}`
    )
  );
  const precisaColagem = temEpsReal;
  const maquinaNorm = (m) => String(m || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const mAtualNorm = maquinaNorm(p.maquina);
  const mPainelNorm = maquinaNorm(maquina);
  const mOrigemNorm = maquinaNorm(p.maquina_origem);
  // TELHA BANDEJA: fluxo multi-etapa sequencial estrito (TP-40/Colonial → BANDEJA → COLAGEM)
  const isBandejaMultiEtapa = isTelhaBandeja(p);
  const proximaEtapaBandeja = isBandejaMultiEtapa ? proximaMaquinaFluxo("TELHA BANDEJA", p.maquina) : null;

  // Indica se este pedido foi tirado/perfilado nesta máquina e seguiu para a colagem/próxima etapa
  const isPerfiladoNestaMaquina = Boolean(
    mPainelNorm &&
    mPainelNorm !== "COLAGEM" &&
    (
      mAtualNorm === "COLAGEM" ||
      p.status === "aguardando_colagem" ||
      p.perfilacao_concluida ||
      (isBandejaMultiEtapa && mAtualNorm === "BANDEJA" && mPainelNorm !== "BANDEJA") ||
      (isBandejaMultiEtapa && mPainelNorm === "BANDEJA" && mAtualNorm === "COLAGEM")
    )
  );

  // Calcula tempo ao vivo
  const now = Date.now();
  let tempoProducaoVivo = p.tempo_producao_seg || 0;
  let tempoPausaVivo = p.tempo_pausa_seg || 0;
  let tempoSetupVivo = p.tempo_setup_seg || 0;

  // Tempos específicos de colagem
  let tempoColagemVivo = p.tempo_colagem_seg || 0;
  let tempoPausaColagemVivo = p.tempo_pausa_colagem_seg || 0;

  if (p.status === "em_producao" && p.inicio_producao_ts) {
    tempoProducaoVivo += Math.floor((now - new Date(p.inicio_producao_ts).getTime()) / 1000);
  }
  if (p.status === "pausado" && p.inicio_pausa_ts) {
    const pausaSeg = Math.floor((now - new Date(p.inicio_pausa_ts).getTime()) / 1000);
    if (p.motivo_pausa === "setup") tempoSetupVivo += pausaSeg;
    else tempoPausaVivo += pausaSeg;
  }

  // Se está em colagem
  if (p.maquina === "COLAGEM" && p.status === "em_producao" && p.inicio_producao_ts) {
    tempoColagemVivo = p.tempo_colagem_seg || 0;
    tempoColagemVivo += Math.floor((now - new Date(p.inicio_producao_ts).getTime()) / 1000);
  }
  if (p.maquina === "COLAGEM" && p.status === "pausado" && p.inicio_pausa_ts) {
    tempoPausaColagemVivo = p.tempo_pausa_colagem_seg || 0;
    tempoPausaColagemVivo += Math.floor((now - new Date(p.inicio_pausa_ts).getTime()) / 1000);
  }

  const handleIniciar = () => {
    // Trava de Telha Bandeja na Colagem: só libera após término de ambas as metades (Telha Superior e Bandeja Inferior)
    if (p.maquina === "COLAGEM" && diagBandeja.isBandeja && !diagBandeja.liberadoColagem) {
      playAlertSound();
      alert(
        "⚠️ COLAGEM BLOQUEADA!\n\n" +
        diagBandeja.mensagemBloqueio + "\n\n" +
        "A colagem da Telha Bandeja só pode ser iniciada após a conclusão da perfilação de ambas as metades no galpão (Telha Superior e Bandeja Inferior)."
      );
      return;
    }

    // Validação de etiqueta antes de iniciar (exigência configurável em Configurações)
    if (regras.exigirEtiquetaBobina && !temVariacoes && p.maquina !== "COLAGEM" && p.validacao_etiqueta_status !== "aprovado") {
      setValidacaoEtiquetaOpen(true);
      return;
    }
    // COLAGEM: trava temporariamente desativada a pedido do usuário (até pedir para voltar)
    // Anteriormente impedia o início se o corte do EPS não estivesse com status "pronto"
    /*
    if (p.maquina === "COLAGEM" && PRODUTOS_COM_EPS.includes(p.produto) && p.eps_status !== "pronto") {
      playAlertSound();
      alert(
        "⚠️ O corte do EPS ainda não foi finalizado!\n\n" +
        "A colagem só pode ser iniciada após o operador de Corte de EPS finalizar o processo (status: EPS Pronto).\n\n" +
        "Status atual: " + (p.eps_status === "em_corte" ? "EPS em Corte" : "EPS Pendente Corte")
      );
      return;
    }
    */
    // Obrigatório escolher a(s) bobina(s) aberta(s) antes de iniciar
    if (!bobinaEscolhida) {
      playAlertSound();
      alert("⚠️ Escolha a bobina que será utilizada nesta OP antes de iniciar.");
      return;
    }
    // Se já existe OP rodando nesta máquina, mostra confirmação
    if (opRodando && opRodando.id !== p.id && opRodando.status === "em_producao") {
      setConfirmarInicioOpen(true);
      return;
    }
    // COLAGEM: abre validação do EPS (foto de conferência) antes de iniciar de fato
    if (p.maquina === "COLAGEM") {
      setFotoColagemEpsUrl("");
      setValidarEpsColagemOpen(true);
      return;
    }
    const updatesBobina = montarUpdatesBobina();
    setPendingColagemUpdates(updatesBobina);
    if (regras.exigirOperadorInicio) {
      setOperadoresDialogOpen(true);
    } else {
      handleConfirmarOperadores(null, updatesBobina);
    }
  };

  const handleConfirmarOperadores = (operadores, extraUpdates) => {
    const updates = {
      inicio_producao_ts: new Date().toISOString(),
      ...(extraUpdates !== undefined ? extraUpdates : (pendingColagemUpdates || {})),
    };
    if (operadores && Array.isArray(operadores)) {
      updates.operadores_json = JSON.stringify(operadores);
      updates.operador = operadores.map(op => op.nome || op).join(", ");
    }
    onStatusChange(p, "em_producao", updates);
    setPendingColagemUpdates(null);
    const idxItem = temVariacoes && p.maquina !== "COLAGEM" ? _variacoesTelhas.findIndex(v => !v.iniciado && !v.finalizado) : -1;
    if (idxItem >= 0 && _variacoesTelhas[idxItem]) { setConferirBobinaModal({ open: true, item: _variacoesTelhas[idxItem], index: idxItem }); toast.success(`OP #${p.numero_pedido || p.id} iniciada! Confirme a bobina do Item ${idxItem + 1}.`); }
    else if (temVariacoes) toast.success("Pedido pré-iniciado! Itens liberados para início e conferência individual.");
  };

  // Reverte um pedido indevidamente atribuído com EPS ou Colagem para Telha Simples na perfiladeira
  const handleConverterParaTelhaSimples = async () => {
    if (!pOriginal?.id) return;
    if (!window.confirm(`Deseja realmente retirar a colagem e transformar o Pedido #${pOriginal.numero_pedido || pOriginal.id} em Telha Simples (sem EPS)?\n\nIsso removerá a etapa de Colagem e devolverá a OP para a perfiladeira correspondente.`)) {
      return;
    }
    const maqDestino = pOriginal.maquina_origem || detectarMaquinaTelha(pOriginal) || (pOriginal.modelo?.toLowerCase().includes("colonial") ? "COLONIAL" : pOriginal.modelo?.includes("25") ? "TP - 25" : "TP - 40");
    try {
      await base44.entities.Pedido.update(pOriginal.id, {
        produto: "TELHA",
        eps: "",
        eps_status: null,
        isopor_utilizado: null,
        maquina: maqDestino,
        status: pOriginal.status === "aguardando_colagem" ? "pendente" : pOriginal.status
      });
      toast.success(`OP #${pOriginal.numero_pedido || ""} convertida para Telha Simples na máquina ${maqDestino}!`);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("[PedidoRow] Erro ao converter para telha simples:", err);
      toast.error("Erro ao converter pedido para telha simples.");
    }
  };

  // Handlers para múltiplos itens (iniciação individual, conferência de bobina e finalização com foto/metragem)
  const handleIniciarItem = (index) => {
    setConferirBobinaModal({
      open: true,
      item: _variacoesTelhas[index],
      index
    });
  };

  const handleConfirmarInicioItem = (index) => {
    let vars = [];
    try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch { vars = []; }
    if (!vars[index]) return;

    const novos = [...vars];
    novos[index] = {
      ...novos[index],
      iniciado: true,
      iniciado_em: new Date().toISOString(),
      status: "em_producao",
      bobina_conferida: true
    };
    onStatusChange(p, "em_producao", {
      variacoes_telhas: JSON.stringify(novos),
      inicio_producao_ts: p.inicio_producao_ts || new Date().toISOString()
    });
    toast.success(`Item ${index + 1} iniciado! Bobina conferida na máquina.`);
  };

  const handleAbrirFinalizarItem = (index) => {
    setFinalizarItemModal({
      open: true,
      item: _variacoesTelhas[index],
      index
    });
  };

  const handleConfirmarFinalizacaoItem = async ({ itemIndex, metragemReal, fotoUrl, observacao }) => {
    let vars = [];
    try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch { vars = []; }
    if (!vars[itemIndex]) return;

    const novos = [...vars];
    const targetItem = { ...novos[itemIndex] };

    targetItem.finalizado = true;
    targetItem.status = "finalizado";
    targetItem.metragem_real = metragemReal;
    targetItem.foto_item_url = fotoUrl;
    targetItem.observacao = observacao;
    targetItem.finalizado_em = new Date().toISOString();

    // Desconta bobina deste item no estoque imediatamente
    const bobId = targetItem.bobina_id || p.bobina_superior_id || p.bobina_superior;
    if (bobId && !targetItem.estoque_baixado) {
      try {
        const bobList = await base44.entities.Bobina.filter({ id: bobId }).catch(() => []);
        const b = bobList[0];
        if (b) {
          const chapa = Number(b.chapa || b.espessura_mm) || 0.43;
          const kgConsumido = +(metragemReal * chapa).toFixed(1);
          await base44.entities.Bobina.update(bobId, {
            peso_kg: Math.max(0, (b.peso_kg || 0) - kgConsumido),
            ...(b.metragem_restante != null ? { metragem_restante: Math.max(0, b.metragem_restante - metragemReal) } : {})
          });
          targetItem.estoque_baixado = true;
          targetItem.kg_baixado = kgConsumido;
        }
      } catch (err) {
        console.error("Erro ao baixar estoque da bobina do item:", err);
      }
    }

    // Se houver bobina inferior para este item (telha termoacústica)
    const bobInfId = targetItem.bobina_inf_id || p.bobina_inferior_id || p.bobina_inferior;
    if (bobInfId && !targetItem.estoque_inf_baixado) {
      try {
        const bobInfList = await base44.entities.Bobina.filter({ id: bobInfId }).catch(() => []);
        const bInf = bobInfList[0];
        if (bInf) {
          const chapaInf = Number(bInf.chapa || bInf.espessura_mm) || 0.43;
          const kgInfConsumido = +(metragemReal * chapaInf).toFixed(1);
          await base44.entities.Bobina.update(bobInfId, {
            peso_kg: Math.max(0, (bInf.peso_kg || 0) - kgInfConsumido)
          });
          targetItem.estoque_inf_baixado = true;
          targetItem.kg_inf_baixado = kgInfConsumido;
        }
      } catch (err) {
        console.error("Erro ao baixar estoque da bobina inferior do item:", err);
      }
    }

    novos[itemIndex] = targetItem;
    const todosFinalizados = novos.length > 0 && novos.every(it => it.finalizado);
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    const agoraIso = new Date().toISOString();
    const maqOrigem = p.maquina_origem || (p.maquina !== "COLAGEM" ? p.maquina : maquina) || "TP - 25";
    // TELHA BANDEJA por ITEM: Superior → BANDEJA → COLAGEM (foto arquivada por etapa)
    if (todosFinalizados && isBandejaMultiEtapa && proximaEtapaBandeja) {
      const pBandeja = proximaEtapaBandeja === "BANDEJA";
      const varsResetadas = JSON.stringify(novos.map(v => ({ ...v, iniciado: false, finalizado: false, metragem_real: null, [pBandeja ? "foto_etapa1_url" : "foto_etapa2_url"]: v.foto_item_url || null, foto_item_url: null })));
      playFinishSound();
      onStatusChange(p, pBandeja ? "pendente" : "aguardando_colagem", { variacoes_telhas: varsResetadas, inicio_producao_ts: null,
        maquina: pBandeja ? "BANDEJA" : "COLAGEM", maquina_origem: p.maquina_origem || (pBandeja ? p.maquina : "TP - 40"),
        etapa_anterior_concluida: pBandeja ? p.maquina : "BANDEJA", data_perfilacao: hojeStr,
        ...(pBandeja ? { telha_superior_concluida: true, perfilacao_concluida: false, ...(p.bobina_inferior ? { bobina_superior: p.bobina_inferior, bobina_superior_id: p.bobina_inferior_id || null, rvm_superior: p.rvm_inferior || "Natural" } : {}) } : { bandeja_concluida: true, perfilacao_concluida: true, foto_finalizacao_url: fotoUrl }) });
      toast.success(pBandeja ? "Telha Superior concluída! OP na fila da BANDEJA." : "Bandeja Inferior concluída! OP na COLAGEM.");
      return;
    }
    const novoStatusOp = todosFinalizados ? (precisaColagem ? "aguardando_colagem" : "finalizado") : "em_producao";
    onStatusChange(p, novoStatusOp, { variacoes_telhas: JSON.stringify(novos),
      ...(todosFinalizados ? { data_finalizacao: novoStatusOp === "finalizado" ? hojeStr : undefined, fim_producao_ts: agoraIso, foto_finalizacao_url: fotoUrl || p.foto_finalizacao_url || "",
        ...(precisaColagem ? { maquina: "COLAGEM", maquina_origem: maqOrigem, data_perfilacao: p.data_perfilacao || hojeStr, hora_perfilacao: p.hora_perfilacao || agoraIso, perfilacao_concluida: true } : {})
      } : { maquina_origem: maqOrigem, data_perfilacao: p.data_perfilacao || hojeStr }) });
    // Encadeamento automático: o próximo item já abre para conferência da bobina
    const proximo = novos.findIndex((it, i) => i > itemIndex && !it.iniciado && !it.finalizado);
    if (proximo >= 0) setConferirBobinaModal({ open: true, item: novos[proximo], index: proximo });
    playFinishSound();
    toast.success(`Item ${itemIndex + 1} finalizado com foto e ${metragemReal}m real!`);
  };

  const handleReabrirItem = (index) => {
    const ok = confirm(`Deseja reabrir o Item ${index + 1} para refazer a medição/foto?`);
    if (!ok) return;
    let vars = [];
    try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch { vars = []; }
    if (!vars[index]) return;
    const novos = [...vars];
    novos[index] = {
      ...novos[index],
      finalizado: false,
      status: "em_producao"
    };
    onStatusChange(p, p.status, { variacoes_telhas: JSON.stringify(novos) });
    toast.info(`Item ${index + 1} reaberto para produção.`);
  };

  const handleConfirmarInicio = async () => {
    setConfirmarInicioOpen(false);

    // 1. Se já existe OP rodando nesta máquina, pausa a anterior para manter tempos corretos
    if (opRodando && opRodando.id !== p.id && opRodando.status === "em_producao") {
      try {
        let prodSeg = opRodando.tempo_producao_seg || 0;
        if (opRodando.inicio_producao_ts) {
          prodSeg += Math.floor((Date.now() - new Date(opRodando.inicio_producao_ts).getTime()) / 1000);
        }
        await base44.entities.Pedido.update(opRodando.id, {
          status: "pausado",
          tempo_producao_seg: prodSeg,
          inicio_producao_ts: null,
          inicio_pausa_ts: new Date().toISOString(),
          motivo_pausa: "troca_de_op",
        });
      } catch (err) {
        console.warn("Aviso ao pausar OP anterior:", err);
      }
    }

    // 2. Limpa quaisquer solicitações pendentes deste pedido
    if (solicitacoesPendentes.length > 0) {
      for (const s of solicitacoesPendentes) {
        try {
          await base44.entities.SolicitacaoProducao.update(s.id, {
            status: "aprovada",
            resposta_admin: "Iniciado pelo operador",
            data_avaliacao: new Date().toISOString(),
          });
        } catch {}
      }
    }

    // 3. COLAGEM: abre validação do EPS se for colagem, ou segue para operadores/início
    if (p.maquina === "COLAGEM") {
      setFotoColagemEpsUrl("");
      setValidarEpsColagemOpen(true);
      return;
    }

    setPendingColagemUpdates(null);
    if (regras.exigirOperadorInicio) {
      setOperadoresDialogOpen(true);
    } else {
      const updates = { inicio_producao_ts: new Date().toISOString() };
      if (appendHistoricoFn) Object.assign(updates, appendHistoricoFn(p, "inicio_producao", "Iniciou OP", opRodando ? `Pausou OP anterior: ${opRodando.numero_pedido || opRodando.produto}` : ""));
      onStatusChange(p, "em_producao", updates);
      toast.success(`OP #${p.numero_pedido || p.id} iniciada com sucesso!`);
      if (temVariacoes && p.maquina !== "COLAGEM") { const i = _variacoesTelhas.findIndex(v => !v.iniciado && !v.finalizado); if (i >= 0 && _variacoesTelhas[i]) setConferirBobinaModal({ open: true, item: _variacoesTelhas[i], index: i }); }
    }
  };

  const handleEtiquetaAprovada = (fotoUrl, motivo) => {
    setValidacaoEtiquetaOpen(false);
    const payload = {
      foto_etiqueta_bobina_url: fotoUrl,
      validacao_etiqueta_status: "aprovado",
      validacao_etiqueta_motivo: motivo,
    };
    setPendingColagemUpdates(payload);
    if (regras.exigirOperadorInicio) {
      setOperadoresDialogOpen(true);
    } else {
      handleConfirmarOperadores(null, payload);
    }
  };

  const handlePausar = () => {
    setPauseMotivo("");
    setPauseTipo("setup");
    setPauseDialog(true);
  };

  const confirmarPausa = () => {
    // Acumula tempo de produção atual antes de pausar
    let prodSeg = p.tempo_producao_seg || 0;
    if (p.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(p.inicio_producao_ts).getTime()) / 1000);
    }
    const motivo = pauseTipo === "setup" ? "setup" : (pauseMotivo.trim() || "pausa");
    onStatusChange(p, "pausado", {
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      inicio_pausa_ts: new Date().toISOString(),
      motivo_pausa: motivo,
    });
    setPauseDialog(false);
  };

  const handleRetomar = () => {
    // Acumula tempo de pausa atual
    let pausaSeg = p.tempo_pausa_seg || 0;
    let setupSeg = p.tempo_setup_seg || 0;
    if (p.inicio_pausa_ts) {
      const delta = Math.floor((Date.now() - new Date(p.inicio_pausa_ts).getTime()) / 1000);
      if (p.motivo_pausa === "setup") setupSeg += delta;
      else pausaSeg += delta;
    }
    // Registra no histórico
    const historico = JSON.parse(p.historico_pausas || "[]");
    historico.push({
      motivo: p.motivo_pausa,
      inicio: p.inicio_pausa_ts,
      fim: new Date().toISOString(),
      segundos: p.motivo_pausa === "setup"
        ? (setupSeg - (p.tempo_setup_seg || 0))
        : (pausaSeg - (p.tempo_pausa_seg || 0)),
    });
    onStatusChange(p, "em_producao", {
      tempo_pausa_seg: pausaSeg,
      tempo_setup_seg: setupSeg,
      inicio_pausa_ts: null,
      motivo_pausa: null,
      historico_pausas: JSON.stringify(historico),
      inicio_producao_ts: new Date().toISOString(),
    });
  };

  const handleConfirmarBaixaEstoqueCumeeira = async ({ quantidade, produtoEstoque, observacao }) => {
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    const qtdNum = Number(quantidade) || Number(p.metros) || 1;

    // Toca som de finalização e anúncio
    playFinishSound();
    speakOpFinalizada(p.maquina || maquina || "CUMEEIRA", p.numero_pedido);

    const detalheEstoque = produtoEstoque
      ? `Separado do estoque físico [${produtoEstoque.nome}] (${qtdNum} peças). Saldo restante: ${Math.max(0, (produtoEstoque.quantidade || 0) - qtdNum)} un.`
      : `Separado diretamente do estoque físico de cumeeiras (${qtdNum} peças).`;

    const extraData = {
      atendido_estoque: true,
      origem_atendimento: "estoque",
      quantidade_atendida_estoque: qtdNum,
      produto_estoque_id: produtoEstoque?.id || null,
      produto_estoque_nome: produtoEstoque?.nome || null,
      data_finalizacao: hojeStr,
      metragem_utilizada: 0, // NÃO consome bobina da máquina
      inicio_producao_ts: null,
      observacoes: (p.observacoes ? `${p.observacoes}\n` : "") + `[📦 Atendido do Estoque Físico: ${qtdNum} peças${observacao ? ` - ${observacao}` : ""}]`,
    };

    if (appendHistoricoFn) {
      Object.assign(extraData, appendHistoricoFn(p, "finalizado", "Atendido pelo Estoque", detalheEstoque));
    }

    onStatusChange(p, "finalizado", extraData);
    setCumeeiraEstoqueOpen(false);
    toast.success(`Pedido #${p.numero_pedido || p.id} atendido pelo estoque físico com sucesso!`);
  };

  const handleFinalizar = () => {
    // Se houver variações pendentes, auto-finaliza todas para não bloquear o operador
    if (temVariacoes && !todosItensFinalizados) {
      try {
        const varsAuto = _variacoesTelhas.map(v => ({ ...v, iniciado: true, finalizado: true }));
        onUpdate?.({ ...p, variacoes_telhas: JSON.stringify(varsAuto) });
      } catch {}
    }
    // TELHA + EPS + TELHA: pede checklist de telhas antes
    if (p.produto === "TELHA + EPS + TELHA" && p.maquina !== "COLAGEM") {
      setTelhaSupOk(false);
      setTelhaInfOk(false);
      setTelhasSandwichDialog(true);
      return;
    }
    // Abre dialog de confirmação de metragem
    setMetragemReal(p.metragem_planejada?.toString() || "");
    setFotoFinalizacaoUrl("");
    setMetragemDialog(true);
  };

  const uploadFotoFinalizacaoPromiseRef = useRef(null);

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local instantâneo (0ms)
    const previewUrl = criarPreviewLocalInstantaneo(file);
    setFotoFinalizacaoUrl(previewUrl);
    setUploadingFoto(true);

    uploadFotoFinalizacaoPromiseRef.current = (async () => {
      try {
        const fileOtimizado = await comprimirImagemParaUpload(file);
        const { file_url } = await base44.integrations.Core.UploadFile({ file: fileOtimizado });
        setFotoFinalizacaoUrl(file_url);
        return file_url;
      } catch (err) {
        console.warn("Aviso upload de foto de finalizacao:", err);
        return previewUrl;
      } finally {
        setUploadingFoto(false);
      }
    })();
  };

  const confirmarTelhasSandwich = () => {
    setTelhasSandwichDialog(false);
    setMetragemReal(p.metragem_planejada?.toString() || "");
    setMetragemDialog(true);
  };

  const confirmarFinalizacao = async () => {
    const metragemRealNum = Number(metragemReal) || 0;
    if (metragemRealNum <= 0) {
      alert("Informe a metragem real (maior que 0)");
      return;
    }

    let urlFinalFoto = fotoFinalizacaoUrl;
    if (uploadFotoFinalizacaoPromiseRef.current) {
      try {
        urlFinalFoto = await uploadFotoFinalizacaoPromiseRef.current;
      } catch {}
    }

    // ── COLAGEM: desconta isopor e finaliza (NÃO desconta bobinas aqui) ──
    if (p.maquina === "COLAGEM") {
      let colagSeg = p.tempo_colagem_seg || 0;
      if (p.inicio_producao_ts) {
        colagSeg += Math.floor((Date.now() - new Date(p.inicio_producao_ts).getTime()) / 1000);
      }
      // Desconta isopor somente na finalização da colagem
      if (p.eps && p.isopor_utilizado > 0) {
        const isopores = await base44.entities.Isopor.list().catch(() => []);
        const isoporItem = isopores.find(i => i.tipo === p.eps);
        if (isoporItem) {
          const novaQtd = Math.max(0, (isoporItem.quantidade || 0) - p.isopor_utilizado);
          await base44.entities.Isopor.update(isoporItem.id, { quantidade: novaQtd });
        }
      }
      // Desconta Manta (somente TELHA + EPS + MANTA)
      if (p.produto === "TELHA + EPS + MANTA" && Number(p.metros) > 0) {
        const mantas = await base44.entities.Produto.filter({ categoria: "Consumivel", nome: "Manta" }).catch(() => []);
        if (mantas && mantas.length > 0) {
          const manta = mantas[0];
          const novaQtd = Math.max(0, (manta.quantidade || 0) - Number(p.metros));
          await base44.entities.Produto.update(manta.id, { quantidade: +novaQtd.toFixed(1) });
        }
      }
      // Desconta Cola (~0,05 kg por metro de telha EPS)
      if (Number(p.metros) > 0) {
        const colas = await base44.entities.Produto.filter({ categoria: "Cola" }).catch(() => []);
        if (colas && colas.length > 0) {
          const cola = colas[0];
          const kgCola = +(Number(p.metros) * 0.05).toFixed(2);
          const novaQtd = Math.max(0, (cola.quantidade || 0) - kgCola);
          await base44.entities.Produto.update(cola.id, { quantidade: +novaQtd.toFixed(2) });
        }
      }
      playFinishSound();
      speakOpFinalizada(p.maquina, p.numero_pedido);
      onStatusChange(p, "finalizado", {
        tempo_colagem_seg: colagSeg,
        metragem_utilizada: metragemRealNum,
        inicio_producao_ts: null,
        data_finalizacao: format(new Date(), "yyyy-MM-dd"),
        foto_finalizacao_url: urlFinalFoto,
      });
      setMetragemDialog(false);
      return;
    }

    // ── MÁQUINA (não é colagem): desconta bobinas, NÃO desconta isopor ──
    let prodSeg = p.tempo_producao_seg || 0;
    if (p.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(p.inicio_producao_ts).getTime()) / 1000);
    }

    // Calcula metragem total do pedido — suporta variações ou modo legado
    let variacoesTelhas = [];
    try { variacoesTelhas = JSON.parse(p.variacoes_telhas || "[]"); } catch { variacoesTelhas = []; }
    const metragemTotalPedido = variacoesTelhas.length > 0
      ? variacoesTelhas.reduce((sum, v) => sum + (Number(v.qty) || 0) * (Number(v.mm) || 0), 0) / 1000
      : (Number(p.metros) || 0) * ((Number(p.metragem_mm) || 0) / 1000);
    const razao = metragemTotalPedido > 0 ? metragemRealNum / metragemTotalPedido : 1;
    const kgSuperiorReal = (Number(p.kg_superior) || 0) * razao;
    const kgInferiorReal = (Number(p.kg_inferior) || 0) * razao;
    const kgSecundariaReal = (Number(p.kg_secundaria) || 0) * razao;

    // Desconta bobinas proporcionalmente à metragem real (se NÃO foram baixadas pelos itens)
    const jaBaixouPorItens = variacoesTelhas.length > 0 && variacoesTelhas.some(v => v.estoque_baixado);
    if (!jaBaixouPorItens) {
      if (p.bobina_superior_id && kgSuperiorReal > 0) {
        const bobSupList = await base44.entities.Bobina.filter({ id: p.bobina_superior_id }).catch(() => []);
        const bobSup = bobSupList[0] || null;
        if (bobSup) {
          await base44.entities.Bobina.update(p.bobina_superior_id, {
            peso_kg: Math.max(0, (bobSup.peso_kg || 0) - kgSuperiorReal),
            ...(bobSup.metragem_restante != null ? { metragem_restante: Math.max(0, bobSup.metragem_restante - metragemRealNum) } : {})
          });
        }
      }
      if (p.bobina_secundaria_id && kgSecundariaReal > 0) {
        const bobSecList = await base44.entities.Bobina.filter({ id: p.bobina_secundaria_id }).catch(() => []);
        const bobSec = bobSecList[0] || null;
        if (bobSec) {
          await base44.entities.Bobina.update(p.bobina_secundaria_id, {
            peso_kg: Math.max(0, (bobSec.peso_kg || 0) - kgSecundariaReal)
          });
        }
      }
      if (p.bobina_inferior_id && kgInferiorReal > 0) {
        const bobInfList = await base44.entities.Bobina.filter({ id: p.bobina_inferior_id }).catch(() => []);
        const bobInf = bobInfList[0] || null;
        if (bobInf) {
          await base44.entities.Bobina.update(p.bobina_inferior_id, {
            peso_kg: Math.max(0, (bobInf.peso_kg || 0) - kgInferiorReal),
            ...(bobInf.metragem_restante != null ? { metragem_restante: Math.max(0, bobInf.metragem_restante - metragemRealNum) } : {})
          });
        }
      }
    }

    const hojeStr = format(new Date(), "yyyy-MM-dd");
    const agoraIso = new Date().toISOString();

    // TELHA BANDEJA: componente paralelo (Telha Superior ou Bandeja Inferior) finaliza na própria máquina
    if (isComponenteParaleloBandeja) {
      playFinishSound();
      speakOpFinalizada(p.maquina, p.numero_pedido);
      onStatusChange(p, "finalizado", {
        tempo_producao_seg: prodSeg,
        metragem_utilizada: metragemRealNum,
        metragem_planejada: metragemRealNum,
        inicio_producao_ts: null,
        data_finalizacao: hojeStr,
        foto_finalizacao_url: urlFinalFoto,
      });
      setMetragemDialog(false);
      return;
    }

    // TELHA BANDEJA multi-etapa sequencial estrito: TP-40/Colonial → BANDEJA → COLAGEM
    if (isBandejaMultiEtapa && proximaEtapaBandeja) {
      let varsResetadas = [];
      try {
        const rawVars = JSON.parse(p.variacoes_telhas || "[]");
        varsResetadas = rawVars.map(v => ({ ...v, iniciado: false, finalizado: false, metragem_real: null, [proximaEtapaBandeja === "BANDEJA" ? "foto_etapa1_url" : "foto_etapa2_url"]: v.foto_item_url || null, foto_item_url: null }));
      } catch {
        varsResetadas = [];
      }

      if (proximaEtapaBandeja === "BANDEJA") {
        // Transição: TP-40/Colonial finalizou Telha Superior → PINGA NA MÁQUINA BANDEJA
        // A OP entra como pendente na fila da BANDEJA e carrega a bobina da bandeja inferior
        playFinishSound();
        speakOpFinalizada(p.maquina, p.numero_pedido);

        onStatusChange(p, "pendente", {
          tempo_producao_seg: prodSeg,
          metragem_utilizada: metragemRealNum,
          metragem_planejada: metragemRealNum,
          inicio_producao_ts: null,
          maquina: "BANDEJA",
          maquina_origem: p.maquina_origem || p.maquina,
          etapa_anterior_concluida: p.maquina,
          telha_superior_concluida: true,
          data_perfilacao_telha: hojeStr,
          data_perfilacao: hojeStr,
          perfilacao_concluida: false,
          // Alterna a bobina de produção para a bobina da bandeja inferior se configurada
          ...(p.bobina_inferior ? {
            bobina_superior: p.bobina_inferior,
            bobina_superior_id: p.bobina_inferior_id || null,
            rvm_superior: p.rvm_inferior || "Natural",
            bobina_superior_utilizada: p.bobina_superior || null
          } : {}),
          variacoes_telhas: varsResetadas.length > 0 ? JSON.stringify(varsResetadas) : p.variacoes_telhas,
          tipo_componente_bandeja: null,
          grupo_bandeja_id: null,
          bloqueado_colagem: false
        });
        setMetragemDialog(false);
        return;
      }

      if (proximaEtapaBandeja === "COLAGEM") {
        // Transição: BANDEJA finalizou Bandeja Inferior → PINGA NA MÁQUINA COLAGEM
        // Agora ambas as partes foram perfiladas e chegam na Colagem
        playFinishSound();
        speakOpFinalizada(p.maquina, p.numero_pedido);

        onStatusChange(p, "aguardando_colagem", {
          tempo_producao_seg: prodSeg,
          metragem_utilizada: metragemRealNum,
          metragem_planejada: metragemRealNum,
          inicio_producao_ts: null,
          maquina: "COLAGEM",
          maquina_origem: p.maquina_origem || "TP - 40",
          etapa_anterior_concluida: "BANDEJA",
          bandeja_concluida: true,
          perfilacao_concluida: true,
          data_perfilacao_bandeja: hojeStr,
          data_perfilacao: hojeStr,
          variacoes_telhas: varsResetadas.length > 0 ? JSON.stringify(varsResetadas) : p.variacoes_telhas,
          tipo_componente_bandeja: null,
          grupo_bandeja_id: null,
          bloqueado_colagem: false
        });
        setMetragemDialog(false);
        return;
      }
    }

    // Produto sem colagem → finaliza direto; com colagem → vai pra COLAGEM
    const novoStatus = precisaColagem ? "aguardando_colagem" : "finalizado";
    const maqOrigem = p.maquina_origem || (p.maquina !== "COLAGEM" ? p.maquina : null) || maquina || "TP - 25";

    if (novoStatus === "finalizado") {
      playFinishSound();
      speakOpFinalizada(p.maquina, p.numero_pedido);
    }
    onStatusChange(p, novoStatus, {
      tempo_producao_seg: prodSeg,
      metragem_utilizada: metragemRealNum,
      metragem_planejada: metragemRealNum,
      inicio_producao_ts: null,
      data_finalizacao: novoStatus === "finalizado" ? hojeStr : undefined,
      foto_finalizacao_url: urlFinalFoto,
      ...(precisaColagem ? {
        maquina: "COLAGEM",
        maquina_origem: maqOrigem,
        data_perfilacao: p.data_perfilacao || hojeStr,
        hora_perfilacao: p.hora_perfilacao || agoraIso,
        perfilacao_concluida: true,
      } : {}),
    });
    setMetragemDialog(false);
  };

  // Metragem Total e Quantidade Total de Telhas sincronizados com a Central PCP
  const totaisProducaoPCP = useMemo(() => {
    if (!p) return { metros: 0, pecas: 0 };

    // 1. Tentar pegar diretamente de variacoes_telhas
    let vars = [];
    try {
      vars = JSON.parse(p.variacoes_telhas || "[]");
    } catch {
      vars = [];
    }

    let metrosVars = 0;
    let pecasVars = 0;
    if (Array.isArray(vars) && vars.length > 0) {
      vars.forEach(v => {
        const q = Number(v.qty) || 0;
        const mm = Number(v.mm) || 0;
        const m = Number(v.m) || (mm > 0 ? mm / 1000 : 0);
        const totalM = Number(v.total_m) || (q * m);
        pecasVars += q;
        metrosVars += totalM;
      });
    }

    // 2. Extrair do texto da observação/descrição se houver padrão de cortes (ex: "13x3140 13x1300")
    let metrosTexto = 0;
    let pecasTexto = 0;
    const textoCortes = [
      p.observacoes,
      p.descricao,
      p.itens_resumo,
      p.observacoes_odoo,
      p.item_produto
    ].filter(Boolean).join(" ");

    const regexCortes = /\b(\d{1,4})\s*(?:x|\*)\s*(\d{2,5})\b/gi;
    let match;
    let cortesEncontrados = 0;
    while ((match = regexCortes.exec(textoCortes)) !== null) {
      const qtd = Number(match[1]);
      const mm = Number(match[2]);
      if (qtd > 0 && mm >= 100) {
        cortesEncontrados++;
        pecasTexto += qtd;
        metrosTexto += (qtd * mm) / 1000;
      }
    }

    // 3. Metragem planejada gravada pelo PCP
    const metragemPlanejada = Number(p.metragem_planejada || p.metros_planejados || 0);

    // Metragem final:
    let metrosFinal = 0;
    if (metragemPlanejada > 0) {
      metrosFinal = metragemPlanejada;
    } else if (metrosVars > 0) {
      metrosFinal = metrosVars;
    } else if (cortesEncontrados > 0 && metrosTexto > 0) {
      metrosFinal = metrosTexto;
    } else if (p.metragem_mm > 0 && p.metros > 0) {
      metrosFinal = (Number(p.metros) * Number(p.metragem_mm)) / 1000;
    } else {
      metrosFinal = Number(p.metros) || 0;
    }

    // Peças final:
    let pecasFinal = 0;
    if (pecasVars > 0) {
      pecasFinal = pecasVars;
    } else if (cortesEncontrados > 0 && pecasTexto > 0) {
      pecasFinal = pecasTexto;
    } else if (Number(p.quantidade_telhas) > 0 && Number(p.quantidade_telhas) !== metrosFinal) {
      pecasFinal = Number(p.quantidade_telhas);
    } else if (Number(p.metros) > 0 && Number(p.metros) !== metrosFinal && Number(p.metros) < 500) {
      pecasFinal = Number(p.metros);
    }

    return {
      metros: Math.round(metrosFinal * 100) / 100,
      pecas: pecasFinal
    };
  }, [p.variacoes_telhas, p.metragem_planejada, p.metros_planejados, p.metragem_mm, p.metros, p.quantidade_telhas, p.observacoes, p.descricao, p.itens_resumo, p.observacoes_odoo, p.item_produto]);



  // 🛡️ Auto-reparo persistente no banco para bobininhas com metragem multiplicada incorretamente
  useEffect(() => {
    if (!p.id || !isBobininha) return;
    let vars = [];
    try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch { vars = []; }
    if (vars.length === 1) {
      const v0 = vars[0];
      const textoObs = String(p.observacoes || p.observacoes_odoo || p.item_produto || "");
      const temMultiplosRolos = /\b(\d{1,2})\s*(?:x|\*|de|bobininhas?|rolos?)\s*(\d+)/i.test(textoObs);
      const metros = Number(p.metros || 0);
      const mm = Number(v0.mm || p.metragem_mm || 0);
      const qtdPlan = Number(p.metragem_planejada || p.quantidade_telhas || 0);

      if (!temMultiplosRolos && (Number(v0.qty) > 1 || metros > 1) && mm >= 10000 && (qtdPlan > 50 || Number(v0.total_m) > 50)) {
        const metrosReal = Math.round(mm / 1000);
        const espNum = parseFloat(String(p.espessura_exigida || "0.43").replace(",", ".")) || 0.43;
        const pesoCorretoKg = Math.round(metrosReal * (espNum * 7.85 * 1.2));
        const novasVars = [{
          qty: 1,
          mm: mm,
          m: metrosReal,
          total_m: metrosReal,
          largura_mm: 1200,
          corte: "1200",
          tipo: "bobininha"
        }];

        base44.entities.Pedido.update(p.id, {
          metros: 1,
          quantidade_telhas: 1,
          metragem_mm: mm,
          metragem_planejada: metrosReal,
          kg_total: pesoCorretoKg,
          variacoes_telhas: JSON.stringify(novasVars)
        }).then(() => {
          console.log(`[PedidoRow] Auto-reparo concluído para OP #${p.numero_pedido}: 1 bobininha de ${metrosReal}m (Corte 1200)`);
        }).catch(() => {});
      }
    }
  }, [p.id, isBobininha, p.variacoes_telhas, p.metros, p.metragem_mm, p.metragem_planejada]);

  const cardPrioCls = getCardPrioridadeClasses(p);
  const ehRetira = isPedidoRetiraAgora(p);
  const ehRota = isPedidoRota(p);

  return (
    <>
      <div className={`border-l-4 ${cardPrioCls || borderColor} bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all`}>
        {/* Banner Ultra-Chamativo para Cliente Retira Agora ou Pedido de Rota */}
        <BannerPrioridadeDestaque pedido={p} />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-base">{descricaoItemOriginal(p) || "TELHA / PERFIL METÁLICO"}</span>
              {p.produto === "TELHA + EPS + TELHA" && (
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs gap-1 font-bold shadow-xs">
                  <Layers className="w-3 h-3" /> DUPLA TELHA (SANDUÍCHE)
                </Badge>
              )}
              {p.eps && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs gap-1 font-bold shadow-xs">
                  <Snowflake className="w-3 h-3" /> {p.eps}
                </Badge>
              )}
              {p.tipo_componente_bandeja === "telha_superior" && (
                <Badge className="bg-blue-50 text-blue-700 border-blue-300 text-xs gap-1 font-bold shadow-xs">
                  <Layers className="w-3 h-3" /> TELHA SUPERIOR ({p.maquina})
                </Badge>
              )}
              {(p.tipo_componente_bandeja === "bandeja_inferior" || (p.maquina === "BANDEJA" && isTelhaBandeja(p))) && (
                <Badge className="bg-pink-50 text-pink-700 border-pink-300 text-xs gap-1 font-bold shadow-xs">
                  <Layers className="w-3 h-3" /> BANDEJA INFERIOR
                </Badge>
              )}
              {p.maquina === "COLAGEM" && diagBandeja.isBandeja && (
                <>
                  <Badge className="bg-purple-50 text-purple-700 border-purple-300 text-xs gap-1 font-bold shadow-xs">
                    <Layers className="w-3 h-3" /> COLAGEM BANDEJA
                  </Badge>
                  {!diagBandeja.liberadoColagem ? (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-400 text-xs gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Aguardando: {diagBandeja.mensagemBloqueio}
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-400 text-xs gap-1.5 font-bold shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Componentes Prontos no Galpão
                    </Badge>
                  )}
                </>
              )}
              <PrioridadeBadge pedido={p} />
              {ehRota && !ehRetira && (
                <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-400 text-xs gap-1.5 font-black shadow-xs tracking-wide">
                  <Truck className="w-3.5 h-3.5" /> 🚚 CARGA DE ROTA
                </Badge>
              )}
              {isPerfiladoNestaMaquina ? (
                <>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs gap-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Peças Tiradas na Máquina
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-xs">
                    {p.status === "finalizado"
                      ? "✓ Colagem Concluída"
                      : (isBandejaMultiEtapa && mAtualNorm === "BANDEJA")
                      ? "✓ Telha Superior Tirada → Na Bandeja"
                      : (isBandejaMultiEtapa && mPainelNorm === "BANDEJA" && mAtualNorm === "COLAGEM")
                      ? "✓ Bandeja Tirada → Na Colagem"
                      : (isBandejaMultiEtapa && mAtualNorm === "COLAGEM")
                      ? "✓ Perfilações Concluídas → Na Colagem"
                      : "→ Na Bancada de Colagem"}
                  </Badge>
                </>
              ) : (
                <>
                  <StatusBadge status={p.status} />
                  {p.atendido_estoque && (
                    <Badge className="bg-teal-50 text-teal-700 border-teal-300 text-xs gap-1 font-bold shadow-xs">
                      <PackageCheck className="w-3 h-3" /> Já em Estoque
                    </Badge>
                  )}
                  {p.status === "aguardando_colagem" && (
                    <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                      {p.produto === "TELHA BANDEJA" && p.maquina === "BANDEJA" ? "→ Bandeja" :
                       p.produto === "TELHA BANDEJA" && p.maquina === "COLAGEM" ? "→ Colagem" :
                       "→ Colagem"}
                    </Badge>
                  )}
                </>
              )}
              {p.operador && (
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-300 flex items-center gap-1 font-medium">
                  <Users className="w-3 h-3 text-indigo-500" /> {p.operador}
                </Badge>
              )}
              {temEpsReal && (
                <Badge className={`text-xs gap-1 border font-semibold ${
                  p.eps_status === "pronto" 
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : p.eps_status === "em_corte" 
                    ? "bg-blue-100 text-blue-800 border-blue-300" 
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}>
                  {p.eps_status === "pronto" ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> :
                   p.eps_status === "em_corte" ? <Scissors className="w-3 h-3 text-blue-600" /> :
                   <Snowflake className="w-3 h-3 text-amber-600" />}
                  {p.eps_status === "pronto" ? "EPS Pronto / Separado" :
                   p.eps_status === "em_corte" ? "EPS em Corte" :
                   "EPS Pendente Corte"}
                </Badge>
              )}
            </div>
            {(p.numero_pedido || p.cliente || p.id) && (
              <div className="flex flex-wrap items-center gap-2 my-1.5 p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-muted/40 border shadow-xs">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs sm:text-sm font-black font-mono bg-blue-600 text-white shadow-xs tracking-wide">
                  <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                  {p.numero_pedido ? `#${p.numero_pedido}` : `OP #${String(p.id || "").slice(-6).toUpperCase()}`}
                </span>
                {p.numero_oc && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs sm:text-sm font-black font-mono bg-background/80 text-foreground border shadow-xs">
                    ({/^OC[\s:-]?/i.test(p.numero_oc) ? p.numero_oc : `OC: ${p.numero_oc}`})
                  </span>
                )}
                {p.cliente && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs sm:text-sm font-black text-foreground uppercase tracking-tight bg-background/80 border shadow-2xs">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>CLIENTE: {p.cliente}</span>
                  </div>
                )}
                {(p.vendedor || p.vendedor_nome) && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs sm:text-sm font-black uppercase tracking-tight bg-background/80 text-foreground border shadow-2xs">
                    <span className="text-muted-foreground">👤 VENDEDOR:</span>
                    <strong className="text-foreground font-black">{p.vendedor || p.vendedor_nome}</strong>
                  </div>
                )}
                <PedidoRowEntrega pedido={p} />
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0 flex items-center gap-3">
            {totaisProducaoPCP.metros > 0 && (
              <div className="flex flex-col items-end justify-center">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tight leading-none">
                    {totaisProducaoPCP.metros.toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(totaisProducaoPCP.metros) ? 0 : 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-base sm:text-lg font-bold text-slate-500 dark:text-slate-400">m</span>
                </div>
                {totaisProducaoPCP.pecas > 0 && (
                  <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/50 shadow-2xs">
                    {totaisProducaoPCP.pecas} {totaisProducaoPCP.pecas === 1 ? "Telha" : "Telhas"}
                  </span>
                )}
              </div>
            )}
            <ChatPedidoButton canal_id={p.id} canal_label={`PED ${p.numero_pedido || p.id.slice(-6).toUpperCase()}`} currentUser={user} />
          </div>
        </div>

        {/* DESCRIÇÃO / MEDIDAS REAIS DA PRODUÇÃO EM MÁXIMO DESTAQUE NO TOPO (Substitui as medidas antigas) */}
        {(p.observacoes || p.descricao || p.itens_resumo) && (
          <div className="w-full bg-slate-900 border-2 border-indigo-500 rounded-2xl p-4 my-3 flex items-start gap-3.5 shadow-md text-white">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] uppercase font-black text-indigo-300 tracking-wider bg-indigo-950/80 px-2.5 py-0.5 rounded border border-indigo-500/50">
                  📋 DESCRIÇÃO / MEDIDAS DA PRODUÇÃO
                </span>
              </div>
              <p className="font-black text-2xl sm:text-3xl text-white leading-tight tracking-wide break-words select-all">
                {p.observacoes || p.descricao || p.itens_resumo}
              </p>
            </div>
          </div>
        )}

        {/* Roteiro Completo da Telha na Fábrica — oculto para operador */}
        {!isOperador && (
          <div className="mb-2.5">
            <ProcessoStepperPedido pedido={p} setor="telhas" compacto={true} />
          </div>
        )}

        <AlertaMultiplasOpsMesmoPedido pedido={p} todosPedidos={todosPedidos} />

        {/* Painel da Telha Bandeja na Colagem */}
        {p.maquina === "COLAGEM" && isTelhaBandeja(p) && <BandejaColagemInfoPanel maquinaOrigem={p.maquina_origem} pedido={p} />}

        {/* Escolha das bobinas abertas antes de iniciar */}
        {precisaEscolherBobina && (
          <SeletorBobinaProducao
            bobinas={bobinasAbertas}
            superiorId={bobSelSupId}
            inferiorId={bobSelInfId}
            onSuperior={(id) => { setBobSelSupId(id); if (mesmaBobina) setBobSelInfId(id); }}
            onInferior={setBobSelInfId}
            exigeInferior={exigeDuasBobinas}
            mesma={mesmaBobina}
            onToggleMesma={() => { setMesmaBobina(v => !v); setBobSelInfId(mesmaBobina ? "" : bobSelSupId); }}
          />
        )}

        {/* Bobina inferior (2ª telha / sanduíche) — oculto para operador */}
        {p.produto === "TELHA + EPS + TELHA" && !isOperador && (
          <PainelBobinaInferior
            pedido={p}
            podeGerenciar={podeGerenciar}
            bobinaInferiorVisual={bobinaInferiorVisual}
            editandoBobinaInf={editandoBobinaInf}
            textoBobinaInf={textoBobinaInf}
            setTextoBobinaInf={setTextoBobinaInf}
            setEditandoBobinaInf={setEditandoBobinaInf}
            handleSalvarBobinaInf={handleSalvarBobinaInf}
            salvandoBobinaInf={salvandoBobinaInf}
            editandoCorInf={editandoCorInf}
            setEditandoCorInf={setEditandoCorInf}
            textoCorInf={textoCorInf}
            setTextoCorInf={setTextoCorInf}
            handleSalvarCorInf={handleSalvarCorInf}
            salvandoCorInf={salvandoCorInf}
            editandoEspInf={editandoEspInf}
            setEditandoEspInf={setEditandoEspInf}
            textoEspInf={textoEspInf}
            setTextoEspInf={setTextoEspInf}
            handleSalvarEspInf={handleSalvarEspInf}
            salvandoEspInf={salvandoEspInf}
            overrideCorInf={overrideCorInf}
            overrideEspInf={overrideEspInf}
            CORES_RAPIDAS={CORES_RAPIDAS}
            ESPESSURAS_RAPIDAS={ESPESSURAS_RAPIDAS}
          />
        )}

        {/* Detalhes técnicos complementares — ocultos para operador */}
        <div className={`flex flex-wrap items-center gap-2 mb-3 ${(isOperador && !(p.maquina === "COLAGEM" && p.isopor_utilizado > 0)) ? "hidden" : ""}`}>
          {p.bobina_secundaria && (
            <span className={`bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold border border-blue-200 ${isOperador ? "hidden" : ""}`}>
              2ª Bobina: {p.bobina_secundaria} ({p.kg_secundaria || 0}kg)
            </span>
          )}
          {/* Cálculo de placas de isopor — visível principalmente na colagem */}
          {p.maquina === "COLAGEM" && p.isopor_utilizado > 0 && (() => {
            const comprTelhaM = (Number(p.metragem_mm) || 0) / 1000;
            const placasPorTelha = Math.ceil(comprTelhaM / 2);
            const inteirasPorTelha = Math.floor(comprTelhaM / 2);
            const sobraPorTelha = +(comprTelhaM - inteirasPorTelha * 2).toFixed(4);
            const total = p.isopor_utilizado;
            const inteiras = inteirasPorTelha * (Number(p.metros) || 0);
            const pedacos = sobraPorTelha > 0 ? (Number(p.metros) || 0) : 0;
            return (
              <div className="w-full bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 mt-1">
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wide mb-1">EPS / Isopor para Colagem</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {p.eps && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{p.eps}</span>}
                    {inteiras > 0 && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{inteiras} inteiras (2m)</span>}
                    {pedacos > 0 && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{pedacos} pedaços ({Math.round(sobraPorTelha * 1000)}mm)</span>}
                  </div>
                  <span className="text-lg font-black text-orange-700">{total} placas</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Foto da OP física */}
        {p.foto_pedido_url && (
          <div className="mb-3">
            <SmartImage
              src={p.foto_pedido_url}
              alt="OP Física"
              className="w-32 h-32 rounded-lg border-2 border-primary/30"
              clickable={true}
            />
          </div>
        )}

        {/* Motivo de pausa ativo */}
        {p.status === "pausado" && p.motivo_pausa && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800 mb-3 flex items-center gap-2">
            <Pause className="w-3 h-3 flex-shrink-0" />
            <span>
              {p.motivo_pausa === "setup" ? "⚙️ Pausa para Setup de Máquina" : `⏸ Pausa: ${p.motivo_pausa}`}
            </span>
          </div>
        )}

        {/* Cronômetros — separa tempos de máquina vs colagem */}
        {p.maquina === "COLAGEM" ? (
          // Para colagem: só mostra tempo de colagem
          (p.status === "em_producao" || p.status === "pausado" || tempoColagemVivo > 0) && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className={`rounded-lg px-3 py-2 text-center ${p.status === "em_producao" ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-border"}`}>
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Timer className="w-3 h-3 text-red-600" />
                  <span className="text-xs text-muted-foreground">Colagem</span>
                </div>
                <p className={`text-sm font-bold tabular-nums ${p.status === "em_producao" ? "text-red-700" : "text-slate-600"}`}>
                  {formatTempo(tempoColagemVivo)}
                </p>
              </div>
              {p.tempo_producao_seg > 0 && (
                <div className="rounded-lg px-3 py-2 text-center bg-slate-50 border border-border">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Timer className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-muted-foreground">Máquina</span>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-slate-600">
                    {formatTempo(p.tempo_producao_seg)}
                  </p>
                </div>
              )}
            </div>
          )
        ) : (
          // Para máquinas: Produção + Pausa + Setup — sempre visível quando em produção, pausado, ou com tempo acumulado
          (p.status === "em_producao" || p.status === "pausado" || tempoProducaoVivo > 0 || tempoSetupVivo > 0 || tempoPausaVivo > 0) && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className={`rounded-lg px-3 py-2 text-center ${p.status === "em_producao" ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-border"}`}>
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Timer className="w-3 h-3 text-green-600" />
                  <span className="text-xs text-muted-foreground">Produção</span>
                </div>
                <p className={`text-sm font-bold tabular-nums ${p.status === "em_producao" ? "text-green-700" : "text-slate-600"}`}>
                  {formatTempo(tempoProducaoVivo)}
                </p>
              </div>
              <div className={`rounded-lg px-3 py-2 text-center ${p.status === "pausado" && p.motivo_pausa !== "setup" ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-border"}`}>
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Coffee className="w-3 h-3 text-amber-600" />
                  <span className="text-xs text-muted-foreground">Pausa</span>
                </div>
                <p className={`text-sm font-bold tabular-nums ${p.status === "pausado" && p.motivo_pausa !== "setup" ? "text-amber-700" : "text-slate-600"}`}>
                  {formatTempo(tempoPausaVivo)}
                </p>
              </div>
              <div className={`rounded-lg px-3 py-2 text-center ${p.status === "pausado" && p.motivo_pausa === "setup" ? "bg-purple-50 border border-purple-200" : "bg-slate-50 border border-border"}`}>
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Square className="w-3 h-3 text-purple-600" />
                  <span className="text-xs text-muted-foreground">Setup</span>
                </div>
                <p className={`text-sm font-bold tabular-nums ${p.status === "pausado" && p.motivo_pausa === "setup" ? "text-purple-700" : "text-slate-600"}`}>
                  {formatTempo(tempoSetupVivo)}
                </p>
              </div>
            </div>
          )
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 mt-3">
          {isPerfiladoNestaMaquina ? (
            <div className="flex items-center justify-between w-full flex-wrap gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Perfilação concluída nesta máquina{p.data_perfilacao ? ` em ${format(new Date(p.data_perfilacao + "T12:00:00"), "dd/MM")}` : ""} · Peças tiradas e encaminhadas para a Colagem
                </span>
              </div>
              <div className="flex items-center gap-2">
                {podeGerenciar && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-slate-600 hover:text-amber-700 border-slate-300 gap-1"
                    onClick={() => {
                      if (confirm(`Deseja reabrir o pedido #${p.numero_pedido || ""} para refazer perfilação nesta máquina?`)) {
                        onStatusChange(p, "em_producao", { maquina });
                      }
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reabrir na Máquina
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {p.status === "pendente" && (
                p.maquina === "COLAGEM" && diagBandeja.isBandeja && !diagBandeja.liberadoColagem ? (
                  <Button
                    size="sm"
                    disabled
                    className="gap-1.5 bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-80"
                    title={diagBandeja.mensagemBloqueio}
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600" /> Aguardando Componentes
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      size="sm"
                      className={`gap-1 border-0 ${
                        ehRetira
                          ? "bg-red-600 hover:bg-red-700 text-white font-black animate-pulse shadow-md ring-2 ring-red-400"
                          : ehRota
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                          : "bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-xs"
                      }`}
                      onClick={handleIniciar}
                      disabled={!bobinaEscolhida}
                      title={!bobinaEscolhida ? "Escolha a bobina antes de iniciar" : undefined}
                    >
                      <Play className="w-3 h-3 fill-current" /> {p.maquina === "COLAGEM" ? "Iniciar Colagem" : (p.etapa_anterior_concluida || (p.maquina === "BANDEJA" && isTelhaBandeja(p))) ? "Continuar na Bandeja" : "Iniciar"}
                    </Button>

                    {isCumeeira && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-teal-500 bg-teal-50/70 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-200 border font-bold shadow-xs transition-all"
                        onClick={() => setCumeeiraEstoqueOpen(true)}
                        title="Atender este pedido com cumeeiras já prontas no estoque físico (não consome bobina)"
                      >
                        <PackageCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        Já em Estoque
                      </Button>
                    )}
                  </div>
                )
              )}

              {p.status === "em_producao" && (
                <>
                  <Button size="sm" variant="outline" className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handlePausar}>
                    <Pause className="w-3 h-3" /> Pausar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1 border-0 bg-green-600 hover:bg-green-700 text-white font-bold shadow-xs cursor-pointer"
                    onClick={handleFinalizar}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {isBandejaMultiEtapa && proximaEtapaBandeja === "BANDEJA"
                      ? "✓ Finalizar Telha Superior → Enviar para Bandeja"
                      : isBandejaMultiEtapa && proximaEtapaBandeja === "COLAGEM"
                      ? "✓ Finalizar Bandeja Inferior → Enviar para Colagem"
                      : isBandejaMultiEtapa && p.maquina === "COLAGEM"
                      ? "✓ Finalizar Colagem Bandeja"
                      : precisaColagem ? "Finalizar → Colagem" : "✓ Finalizar"}
                  </Button>
                  {isCumeeira && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-teal-500 text-teal-800 dark:text-teal-200 bg-teal-50/50 hover:bg-teal-100 dark:bg-teal-950/40 font-semibold shadow-xs"
                      onClick={() => setCumeeiraEstoqueOpen(true)}
                      title="Atender diretamente com peças do estoque físico (sem consumir bobina)"
                    >
                      <PackageCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      Já em Estoque
                    </Button>
                  )}
                </>
              )}

              {p.status === "pausado" && (
                <>
                  <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90 text-white border-0" onClick={handleRetomar}>
                    <Play className="w-3 h-3" /> Retomar
                  </Button>
                  {isCumeeira && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-teal-500 text-teal-800 dark:text-teal-200 bg-teal-50/50 hover:bg-teal-100 dark:bg-teal-950/40 font-semibold shadow-xs"
                      onClick={() => setCumeeiraEstoqueOpen(true)}
                      title="Atender diretamente com peças do estoque físico"
                    >
                      <PackageCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      Já em Estoque
                    </Button>
                  )}
                </>
              )}

              {p.status === "aguardando_colagem" && p.maquina === "COLAGEM" && (
                <Button size="sm" className="gap-1 bg-amber-500 hover:bg-amber-600 text-white border-0 font-bold" onClick={handleIniciar}>
                  <Play className="w-3 h-3" /> Iniciar Colagem
                </Button>
              )}

              {p.status === "aguardando_colagem" && p.maquina !== "COLAGEM" && (
                <>
                  <Button
                    size="sm"
                    className="gap-1.5 border-0 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-xs"
                    onClick={handleIniciar}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Continuar Produção ({p.maquina === "BANDEJA" ? "Bandeja" : p.maquina})
                  </Button>
                  {podeGerenciar && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-slate-500 border-slate-300 hover:bg-slate-50 text-xs"
                      onClick={() => onStatusChange(p, "pendente", { inicio_producao_ts: null })}
                      title="Voltar status para pendente nesta máquina"
                    >
                      Voltar para Pendente
                    </Button>
                  )}
                </>
              )}

              {p.status === "finalizado" && p.maquina !== "COLAGEM" && (
                <>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs"
                    onClick={() => {
                      onStatusChange(p, "aguardando_colagem", {
                        maquina: "COLAGEM",
                        maquina_origem: p.maquina_origem || p.maquina || maquina,
                        perfilacao_concluida: true,
                        data_perfilacao: p.data_perfilacao || format(new Date(), "yyyy-MM-dd"),
                        hora_perfilacao: p.hora_perfilacao || new Date().toISOString()
                      });
                      toast.success(`Pedido #${p.numero_pedido} enviado para a Máquina de Colagem!`);
                    }}
                    title="Encaminhar este pedido perfilado para a Máquina de Colagem"
                  >
                    ➡️ Enviar para Colagem
                  </Button>
                  {p.atendido_estoque && (
                    <div className="flex items-center gap-1.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 px-3 py-1.5 rounded-lg text-xs font-semibold">
                      <PackageCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span>Atendido via Estoque Físico ({p.quantidade_atendida_estoque || p.metros || 0} un)</span>
                    </div>
                  )}
                  {podeGerenciar && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1 text-slate-500" onClick={() => onStatusChange(p, "pendente", { inicio_producao_ts: null })}>
                        ↩ Reabrir
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setRetrabalhoOpen(true)}>
                        <AlertTriangle className="w-3 h-3" /> Retrabalho
                      </Button>
                    </>
                  )}
                </>
              )}

              {podeGerenciar && !isTelhaBandeja(p) && (maquina === "COLAGEM" || p.maquina === "COLAGEM" || p.status === "aguardando_colagem") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-blue-400 text-blue-700 bg-blue-50/80 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950/40 text-xs font-bold shadow-xs"
                  onClick={handleConverterParaTelhaSimples}
                  title="Remover EPS/Colagem e devolver para a perfiladeira correspondente como Telha Simples"
                >
                  ↩️ Tirar da Colagem (Telha Simples)
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog de validação de etiqueta */}
      {validacaoEtiquetaOpen && (
        <ValidacaoEtiquetaTelhasDialog
          open={validacaoEtiquetaOpen}
          onClose={() => setValidacaoEtiquetaOpen(false)}
          pedido={p}
          onAprovado={handleEtiquetaAprovada}
        />
      )}

      {/* Dialog de retrabalho */}
      {retrabalhoOpen && (
        <RetrabalhoTelhasDialog
          open={retrabalhoOpen}
          onClose={() => setRetrabalhoOpen(false)}
          pedidoOrigem={p}
          onCreate={() => setRetrabalhoOpen(false)}
        />
      )}

      {/* Dialog de confirmação de troca de OP caso outra já esteja rodando */}
      {confirmarInicioOpen && (
        <ConfirmarInicioDialog
          open={confirmarInicioOpen}
          onClose={() => setConfirmarInicioOpen(false)}
          pedido={p}
          pedidoRodando={opRodando}
          onConfirm={handleConfirmarInicio}
        />
      )}

      {/* Dialog de conferência de bobina por item (múltiplas medidas) */}
      {conferirBobinaModal.open && (
        <ConferirBobinaItemDialog
          open={conferirBobinaModal.open}
          onClose={() => setConferirBobinaModal({ open: false, item: null, index: 0 })}
          item={conferirBobinaModal.item}
          itemIndex={conferirBobinaModal.index}
          pedido={p}
          bobinas={todasBobinas}
          onConfirmarInicio={handleConfirmarInicioItem}
        />
      )}

      {/* Dialog de finalização de item com foto e metragem real */}
      {finalizarItemModal.open && (
        <FinalizarItemVariacaoDialog
          open={finalizarItemModal.open}
          onClose={() => setFinalizarItemModal({ open: false, item: null, index: 0 })}
          item={finalizarItemModal.item}
          itemIndex={finalizarItemModal.index}
          pedido={p}
          onConfirmarFinalizacao={handleConfirmarFinalizacaoItem}
        />
      )}

      {/* Dialog de pausa */}
      {pauseDialog && (
        <Dialog open={pauseDialog} onOpenChange={setPauseDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pausar Pedido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Qual o motivo da pausa?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPauseTipo("setup")}
                  className={`border-2 rounded-xl p-4 text-center transition-all ${pauseTipo === "setup" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <Square className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                  <p className="font-semibold text-sm">Setup de Máquina</p>
                  <p className="text-xs text-muted-foreground mt-1">Ajuste, troca de bobina, etc.</p>
                </button>
                <button
                  onClick={() => setPauseTipo("outro")}
                  className={`border-2 rounded-xl p-4 text-center transition-all ${pauseTipo === "outro" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                >
                  <Coffee className="w-6 h-6 mx-auto mb-2 text-amber-600" />
                  <p className="font-semibold text-sm">Outro Motivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Especifique abaixo</p>
                </button>
              </div>
              {pauseTipo === "outro" && (
                <Textarea
                  placeholder="Descreva o motivo da pausa... (ex: almoço, falta de material, problema técnico)"
                  value={pauseMotivo}
                  onChange={(e) => setPauseMotivo(e.target.value)}
                  className="h-20"
                  autoFocus
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPauseDialog(false)}>Cancelar</Button>
              <Button
                onClick={confirmarPausa}
                disabled={pauseTipo === "outro" && !pauseMotivo.trim()}
                className="gap-1"
              >
                <Pause className="w-4 h-4" /> Confirmar Pausa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog checklist TELHA + EPS + TELHA */}
      {telhasSandwichDialog && (
        <Dialog open={telhasSandwichDialog} onOpenChange={setTelhasSandwichDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Checklist — TELHA + EPS + TELHA</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Confirme antes de ir para a Colagem:</p>
              <div className="space-y-3">
                <button
                  onClick={() => setTelhaSupOk(!telhaSupOk)}
                  className={`w-full flex items-center gap-3 border-2 rounded-xl p-4 text-left transition-all ${telhaSupOk ? "border-green-500 bg-green-50" : "border-border hover:border-primary/50"}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${telhaSupOk ? "border-green-500 bg-green-500" : "border-slate-300"}`}>
                    {telhaSupOk && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Telha Superior retirada ✓</p>
                    <p className="text-xs text-muted-foreground">A chapa superior foi perfilada e está pronta</p>
                  </div>
                </button>
                <button
                  onClick={() => setTelhaInfOk(!telhaInfOk)}
                  className={`w-full flex items-center gap-3 border-2 rounded-xl p-4 text-left transition-all ${telhaInfOk ? "border-green-500 bg-green-50" : "border-border hover:border-primary/50"}`}
                >
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${telhaInfOk ? "border-green-500 bg-green-500" : "border-slate-300"}`}>
                    {telhaInfOk && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Telha Inferior retirada ✓</p>
                    <p className="text-xs text-muted-foreground">A chapa inferior foi perfilada e está pronta</p>
                  </div>
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTelhasSandwichDialog(false)}>Cancelar</Button>
              <Button
                onClick={confirmarTelhasSandwich}
                disabled={!telhaSupOk || !telhaInfOk}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar → Colagem
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de confirmação de metragem */}
      {metragemDialog && (
        <Dialog open={metragemDialog} onOpenChange={setMetragemDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Metragem {p.maquina === "COLAGEM" ? "de Colagem" : "Produzida"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-2">
                <p className="text-xs font-semibold text-blue-900 uppercase">Metragem Total do Pedido</p>
                <p className="text-2xl font-bold text-blue-700">
                  {((Number(p.metros) || 0) * ((Number(p.metragem_mm) || 0) / 1000)).toFixed(2)}m
                </p>
                <p className="text-xs text-blue-600">({p.metros} telhas × {Number(p.metragem_mm) || 0}mm)</p>
              </div>

              {p.kg_superior > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600 uppercase">KG da Bobina Superior</p>
                  <p className="text-lg font-bold text-slate-700">{p.kg_superior}kg</p>
                </div>
              )}
              {p.kg_inferior > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600 uppercase">KG da Bobina Inferior</p>
                  <p className="text-lg font-bold text-slate-700">{p.kg_inferior}kg</p>
                </div>
              )}

              <div className="space-y-1 border-t pt-4">
                <Label className="text-sm font-semibold">Metragem Real {p.maquina === "COLAGEM" ? "de Colagem" : "Produzida"}</Label>
                <input
                  type="number"
                  value={metragemReal}
                  onChange={(e) => setMetragemReal(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-border rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Se for diferente do planejado, o KG será ajustado proporcionalmente</p>
              </div>

              {/* Foto obrigatória do material finalizado */}
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm font-semibold flex items-center gap-1">
                  <Camera className="w-4 h-4 text-green-600" /> Foto do Material Finalizado *
                </Label>
                {fotoFinalizacaoUrl ? (
                  <div className="relative">
                    <img src={fotoFinalizacaoUrl} alt="Material finalizado" className="w-full h-36 object-cover rounded-lg border-2 border-green-400" />
                    <button
                      onClick={() => setFotoFinalizacaoUrl("")}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-lg hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-green-300 rounded-lg p-6 cursor-pointer hover:border-green-500 hover:bg-green-50/30 transition-colors">
                    {uploadingFoto ? (
                      <>
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-green-500 rounded-full animate-spin" />
                        <span className="text-xs text-muted-foreground">Enviando foto...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-10 h-10 text-green-400" />
                        <span className="text-sm font-medium text-green-600">Tirar foto do material finalizado</span>
                        <span className="text-xs text-muted-foreground">Obrigatório para finalizar</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUploadFoto} disabled={uploadingFoto} />
                  </label>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMetragemDialog(false)}>Cancelar</Button>
              <Button
                onClick={confirmarFinalizacao}
                disabled={!metragemReal || Number(metragemReal) <= 0 || !fotoFinalizacaoUrl}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar e Finalizar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog Validação de EPS pela Colagem */}
      {validarEpsColagemOpen && (
        <Dialog open={validarEpsColagemOpen} onOpenChange={setValidarEpsColagemOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-cyan-900">
                <Scissors className="w-5 h-5 text-cyan-600" />
                Validar EPS antes de Iniciar a Colagem
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-xs">
              <p className="text-slate-600">
                Confira a foto do EPS cortado pelo operador de corte para garantir que pegou os blocos corretos:
              </p>

              {/* Referência da foto do cortador */}
              {p.foto_eps_url && (
                <div className="border border-emerald-300 bg-emerald-50/50 rounded-xl p-3 space-y-2">
                  <p className="font-bold text-emerald-950 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Referência: Foto enviada pelo Operador de Corte
                  </p>
                  <div className="border border-emerald-400 rounded-lg overflow-hidden max-h-[160px] bg-slate-900 flex items-center justify-center">
                    <img src={p.foto_eps_url} alt="Foto do EPS cortado" className="max-h-[160px] w-auto object-contain" />
                  </div>
                  {p.eps_observacoes && (
                    <p className="text-[11px] text-emerald-800 bg-white p-2 rounded border border-emerald-200">
                      <strong>Local/Obs:</strong> {p.eps_observacoes}
                    </p>
                  )}
                </div>
              )}

              {/* Tirar foto de confirmação pelo operador da colagem */}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Camera className="w-4 h-4 text-cyan-600" /> Tire uma foto do EPS que você pegou *
                </Label>
                {fotoColagemEpsUrl ? (
                  <div className="relative border-2 border-cyan-500 rounded-xl overflow-hidden max-h-[150px] bg-slate-900 flex items-center justify-center">
                    <img src={fotoColagemEpsUrl} alt="Foto colagem EPS" className="max-h-[150px] w-auto object-contain" />
                    <button
                      onClick={() => setFotoColagemEpsUrl("")}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-cyan-300 rounded-xl p-5 cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/30 transition-colors">
                    {uploadingFotoColagemEps ? (
                      <>
                        <div className="w-6 h-6 border-3 border-slate-200 border-t-cyan-600 rounded-full animate-spin" />
                        <span className="text-xs text-slate-500">Enviando foto...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-cyan-500" />
                        <span className="text-xs font-bold text-cyan-700">Tirar foto do bloco de EPS em mãos</span>
                        <span className="text-[10px] text-slate-400">Obrigatório para iniciar a colagem</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUploadFotoColagemEps} disabled={uploadingFotoColagemEps} />
                  </label>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between flex-wrap">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleConfirmarColagemEps(true)}
                className="text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-semibold"
              >
                Iniciar Sem Foto (Modo Rápido)
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setValidarEpsColagemOpen(false)}>Cancelar</Button>
                <Button
                  onClick={() => handleConfirmarColagemEps(false)}
                  disabled={!fotoColagemEpsUrl}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Confirmar EPS e Iniciar Colagem
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog Seleção Multi-Operador para Início da OP */}
      {operadoresDialogOpen && (
        <IniciarOpOperadoresDialog
          open={operadoresDialogOpen}
          onOpenChange={setOperadoresDialogOpen}
          ordem={p}
          maquinaNome={p.maquina || maquina}
          onConfirm={handleConfirmarOperadores}
        />
      )}

      {/* Dialog Baixa de Cumeeira direto do Estoque Físico */}
      {cumeeiraEstoqueOpen && (
        <CumeeiraEstoqueDialog
          open={cumeeiraEstoqueOpen}
          onOpenChange={setCumeeiraEstoqueOpen}
          pedido={p}
          onConfirmar={handleConfirmarBaixaEstoqueCumeeira}
        />
      )}
    </>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    pendente:            { label: "Pendente",          Icon: Circle,       color: "bg-slate-100 text-slate-600 border-slate-200" },
    em_producao:         { label: "Em Produção",       Icon: Clock,        color: "bg-amber-100 text-amber-700 border-amber-200" },
    pausado:             { label: "Pausado",            Icon: Pause,        color: "bg-purple-100 text-purple-700 border-purple-200" },
    aguardando_colagem:  { label: "Aguard. Colagem",   Icon: CheckCircle2, color: "bg-orange-100 text-orange-700 border-orange-200" },
    finalizado:          { label: "Finalizado",         Icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" },
    cancelado:           { label: "Cancelado",          Icon: AlertCircle,  color: "bg-red-100 text-red-700 border-red-200" },
  }[status] || { label: status, Icon: Circle, color: "bg-slate-100 text-slate-600" };
  return (
    <Badge className={`border text-xs ${cfg.color}`}>
      <cfg.Icon className="w-3 h-3 mr-1" />
      {cfg.label}
    </Badge>
  );
}