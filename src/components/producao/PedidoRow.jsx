import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, Circle, AlertCircle, Layers, Play, Pause, Square, Timer, Coffee, AlertTriangle, FileText, Route, Camera, Scissors, Snowflake } from "lucide-react";
import ImageLink from "@/components/ui/ImageLink";
import RetrabalhoTelhasDialog from "@/components/producao/RetrabalhoTelhasDialog";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import ValidacaoEtiquetaTelhasDialog from "@/components/producao/ValidacaoEtiquetaTelhasDialog";
import ConfirmarInicioDialog from "@/components/producao/ConfirmarInicioDialog";
import { playFinishSound, speakOpFinalizada, playAlertSound } from "@/lib/sounds";
import { useFilial } from "@/contexts/FilialContext";
import { useQuery } from "@tanstack/react-query";
import ChatPedidoButton from "@/components/chat/ChatPedidoButton";

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

const ETAPAS = {
  "TELHA": [
    "Verificar bobina metálica (espessura e cor)",
    "Configurar perfiladeira conforme modelo",
    "Passar pela perfiladeira",
    "Cortar no tamanho especificado",
    "Conferir comprimento e quantidade",
    "Empilhar e etiquetar",
  ],
  "TELHA + EPS": [
    "Verificar bobina superior (espessura e cor)",
    "Separar bloco de EPS do tipo correto",
    "Passar bobina pela perfiladeira",
    "Aplicar cola nas duas faces",
    "Encaixar EPS na telha",
    "Passar pela colagem (pressão + cura)",
    "Conferir acabamento e medidas",
  ],
  "TELHA + EPS + TELHA": [
    "Verificar bobina superior",
    "Verificar bobina inferior",
    "Separar EPS do tipo correto",
    "Perfilar chapa superior (TP-40/Colonial)",
    "Perfilar chapa inferior (Bandeja/TP-40)",
    "Aplicar cola x2 na chapa superior",
    "Aplicar cola x2 na chapa inferior",
    "Encaixar EPS entre as chapas",
    "Passar pela colagem (pressão + cura)",
    "Conferir sandwich e acabamento",
  ],
  "TELHA + EPS + MANTA": [
    "Verificar bobina superior",
    "Separar EPS do tipo correto",
    "Preparar manta térmica (cortar no comprimento)",
    "Perfilar chapa",
    "Colar EPS na chapa",
    "Aplicar manta sobre o EPS",
    "Passar pela colagem",
    "Conferir acabamento",
  ],
  "TELHA BANDEJA": [
    "Verificar bobina superior (para TP-40 ou Colonial)",
    "Perfilar chapa superior na TP-40 ou COLONIAL",
    "Verificar bobina para chapa inferior (Bandeja)",
    "Perfilar chapa inferior na BANDEJA",
    "Separar EPS específico para Bandeja",
    "Aplicar cola x2 nas duas faces",
    "Encaixar EPS entre as chapas",
    "Passar pela COLAGEM (pressão + cura)",
    "Conferir dimensões e acabamento",
  ],
  "BOBININHA": [
    "Verificar bobina de origem",
    "Configurar desbobinador",
    "Cortar na largura especificada",
    "Rebobinar",
    "Pesar e etiquetar",
  ],
  "CUMEEIRA": [
    "Verificar bobina e cor",
    "Configurar máquina de cumeeira",
    "Passar pela cumeeira",
    "Cortar no comprimento",
    "Empacotar e etiquetar",
  ],
  "PAINEL": [
    "Verificar bobinas (superior e inferior)",
    "Preparar núcleo do painel",
    "Perfilar chapas",
    "Montar conjunto",
    "Passar pela colagem",
    "Cortar no comprimento",
    "Conferir acabamento",
  ],
};

const PRODUTOS_COM_EPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"];

// Fluxos de máquinas para produtos multi-etapa
function proximaMaquinaFluxo(produto, maquinaAtual) {
  // TELHA BANDEJA: TP-40 ou COLONIAL → BANDEJA → COLAGEM
  if (produto === "TELHA BANDEJA") {
    const fluxo = maquinaAtual === "COLONIAL" ? ["COLONIAL", "BANDEJA", "COLAGEM"]
                : ["TP - 40", "BANDEJA", "COLAGEM"];
    const idx = fluxo.indexOf(maquinaAtual);
    if (idx === -1 || idx === fluxo.length - 1) return null;
    return fluxo[idx + 1];
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

export default function PedidoRow({ pedido: p, onStatusChange, onUpdate, userRole, opRodando, maquina, user, filialAtiva, appendHistoricoFn }) {
  const isOperador = userRole === "operador";
  const podeGerenciar = !isOperador;
  const [etapasOk, setEtapasOk] = useState({});
  const [mostrarEtapas, setMostrarEtapas] = useState(false);
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
  const intervalRef = useRef(null);

  // Parse variações de telhas para verificar se todos os itens estão finalizados
  let _variacoesTelhas = [];
  try { _variacoesTelhas = JSON.parse(p.variacoes_telhas || "[]"); } catch { _variacoesTelhas = []; }
  if (!Array.isArray(_variacoesTelhas)) _variacoesTelhas = [];
  const temVariacoes = _variacoesTelhas.length > 0;
  const todosItensFinalizados = temVariacoes ? _variacoesTelhas.every(v => v.finalizado) : true;

  // Verifica se há solicitação pendente para este pedido
  const { data: solicitacoesPendentes = [] } = useQuery({
    queryKey: ["solicitacao-producao-pedido", p.id],
    queryFn: () => base44.entities.SolicitacaoProducao.filter({
      pedido_id: p.id, status: "pendente"
    }, "-created_date", 5),
    enabled: !!p.id,
    refetchInterval: 5000,
  });
  const aguardandoAprovacao = solicitacoesPendentes.length > 0;

  // Tick a cada segundo para atualizar cronômetro ao vivo
  useEffect(() => {
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const borderColor = PRODUTO_BG[p.produto] || "border-l-slate-300";
  const precisaColagem = PRODUTOS_COM_EPS.includes(p.produto);
  // TELHA BANDEJA TP-40 tem fluxo especial de 3 etapas
  const isBandejaMultiEtapa = p.produto === "TELHA BANDEJA" && ["TP - 40", "COLONIAL", "BANDEJA", "COLAGEM"].includes(p.maquina);
  const proximaEtapaBandeja = isBandejaMultiEtapa ? proximaMaquinaFluxo(p.produto, p.maquina) : null;

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
    // Se há solicitação pendente, não permite iniciar
    if (aguardandoAprovacao) {
      playAlertSound();
      alert("Aguardando aprovação do encarregado para iniciar esta OP.");
      return;
    }
    // Validação de etiqueta obrigatória antes de iniciar (exceto colagem)
    if (p.maquina !== "COLAGEM" && p.validacao_etiqueta_status !== "aprovado") {
      setValidacaoEtiquetaOpen(true);
      return;
    }
    // Se já existe OP rodando nesta máquina, mostra confirmação
    if (opRodando && opRodando.id !== p.id && opRodando.status === "em_producao") {
      setConfirmarInicioOpen(true);
      return;
    }
    const updates = {
      inicio_producao_ts: new Date().toISOString(),
    };
    onStatusChange(p, "em_producao", updates);
  };

  const handleConfirmarInicio = async (motivo) => {
    setConfirmarInicioOpen(false);
    const isRotaOuPrioridade = p.rota || p.prioridade;

    // Se é rota/prioridade: notifica o encarregado e inicia
    if (isRotaOuPrioridade) {
      // Cria solicitação de notificação
      try {
        await base44.entities.SolicitacaoProducao.create({
          unidade: filialAtiva,
          maquina: maquina || p.maquina,
          pedido_id: p.id,
          pedido_info: `${p.produto} — ${p.cliente || "sem cliente"}${p.numero_pedido ? ` #${p.numero_pedido}` : ""}`,
          operador_nome: user?.full_name || user?.email || "—",
          operador_id: user?.id || "",
          pedido_rodando_id: opRodando?.id || "",
          pedido_rodando_info: opRodando ? `${opRodando.produto} — ${opRodando.cliente || ""}${opRodando.numero_pedido ? ` #${opRodando.numero_pedido}` : ""}` : "",
          tipo: "inicio_concomitante",
          motivo: motivo || "",
          status: "pendente",
        });
      } catch {}

      // Inicia a produção
      const updates = { inicio_producao_ts: new Date().toISOString() };
      if (appendHistoricoFn) {
        Object.assign(updates, appendHistoricoFn(p, "inicio_concomitante", "Iniciou OP (outra já rodando)", `Outra OP rodando: ${opRodando?.produto || ""}`));
      }
      onStatusChange(p, "em_producao", updates);
    } else {
      // Não é rota/prioridade: cria solicitação e aguarda aprovação
      try {
        await base44.entities.SolicitacaoProducao.create({
          unidade: filialAtiva,
          maquina: maquina || p.maquina,
          pedido_id: p.id,
          pedido_info: `${p.produto} — ${p.cliente || "sem cliente"}${p.numero_pedido ? ` #${p.numero_pedido}` : ""}`,
          operador_nome: user?.full_name || user?.email || "—",
          operador_id: user?.id || "",
          pedido_rodando_id: opRodando?.id || "",
          pedido_rodando_info: opRodando ? `${opRodando.produto} — ${opRodando.cliente || ""}${opRodando.numero_pedido ? ` #${opRodando.numero_pedido}` : ""}` : "",
          tipo: "fora_prioridade",
          motivo: motivo,
          status: "pendente",
        });
        playAlertSound();
        alert("Solicitação enviada para o encarregado. Aguarde a aprovação para iniciar.");
      } catch (err) {
        alert("Erro ao enviar solicitação: " + (err.message || ""));
      }
    }
  };

  const handleEtiquetaAprovada = (fotoUrl, motivo) => {
    setValidacaoEtiquetaOpen(false);
    const updates = {
      inicio_producao_ts: new Date().toISOString(),
      foto_etiqueta_bobina_url: fotoUrl,
      validacao_etiqueta_status: "aprovado",
      validacao_etiqueta_motivo: motivo,
    };
    onStatusChange(p, "em_producao", updates);
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

  const handleFinalizar = () => {
    // Bloqueia se há variações e nem todos os itens estão finalizados
    if (temVariacoes && !todosItensFinalizados) {
      alert("Finalize todos os itens das 'Medidas do Pedido' antes de finalizar a OP!");
      return;
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

  const handleUploadFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoFinalizacaoUrl(file_url);
    } catch (err) {
      alert("Erro ao enviar foto: " + (err.message || ""));
    }
    setUploadingFoto(false);
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
      playFinishSound();
      speakOpFinalizada(p.maquina, p.numero_pedido);
      onStatusChange(p, "finalizado", {
        tempo_colagem_seg: colagSeg,
        metragem_utilizada: metragemRealNum,
        inicio_producao_ts: null,
        data_finalizacao: format(new Date(), "yyyy-MM-dd"),
        foto_finalizacao_url: fotoFinalizacaoUrl,
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

    // Desconta bobinas proporcionalmente à metragem real
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

    // TELHA BANDEJA multi-etapa: avança pelo fluxo (COLAGEM ainda virá depois)
    if (isBandejaMultiEtapa && proximaEtapaBandeja) {
      onStatusChange(p, "aguardando_colagem", {
        tempo_producao_seg: prodSeg,
        metragem_utilizada: metragemRealNum,
        metragem_planejada: metragemRealNum,
        inicio_producao_ts: null,
        maquina: proximaEtapaBandeja,
      });
      setMetragemDialog(false);
      return;
    }

    // Produto sem colagem → finaliza direto; com colagem → vai pra COLAGEM
    const novoStatus = precisaColagem ? "aguardando_colagem" : "finalizado";
    if (novoStatus === "finalizado") {
      playFinishSound();
      speakOpFinalizada(p.maquina, p.numero_pedido);
    }
    onStatusChange(p, novoStatus, {
      tempo_producao_seg: prodSeg,
      metragem_utilizada: metragemRealNum,
      metragem_planejada: metragemRealNum,
      inicio_producao_ts: null,
      data_finalizacao: novoStatus === "finalizado" ? format(new Date(), "yyyy-MM-dd") : undefined,
      foto_finalizacao_url: fotoFinalizacaoUrl,
      ...(precisaColagem ? { maquina: "COLAGEM" } : {}),
    });
    setMetragemDialog(false);
  };

  const steps = ETAPAS[p.produto];

  return (
    <>
      <div className={`border-l-4 ${borderColor} bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-bold text-base">{p.produto}</span>
              {p.rota && (
                <Badge className="bg-red-600 text-white border-red-700 text-xs gap-1 animate-pulse">
                  <Route className="w-3 h-3" /> ROTA
                </Badge>
              )}
              <StatusBadge status={p.status} />
              {aguardandoAprovacao && (
                <Badge className="bg-orange-500 text-white border-orange-600 text-xs gap-1">
                  <AlertTriangle className="w-3 h-3" /> Aguard. Aprovação
                </Badge>
              )}
              {p.status === "aguardando_colagem" && (
                <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                  {p.produto === "TELHA BANDEJA" && p.maquina === "BANDEJA" ? "→ Bandeja" :
                   p.produto === "TELHA BANDEJA" && p.maquina === "COLAGEM" ? "→ Colagem" :
                   "→ Colagem"}
                </Badge>
              )}
              {(p.eps || PRODUTOS_COM_EPS.includes(p.produto)) && (
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
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
              {p.cliente && <span className="font-semibold text-slate-700">{p.cliente}</span>}
              {p.vendedor && <span className="text-muted-foreground">{p.vendedor}</span>}
              {p.numero_pedido && <span className="text-muted-foreground font-mono text-xs">#{p.numero_pedido}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
            <p className="text-3xl font-black text-primary leading-none">
              {(p.metros || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              <span className="text-base font-normal text-muted-foreground">m</span>
            </p>
            <ChatPedidoButton canal_id={p.id} canal_label={`PED ${p.numero_pedido || p.id.slice(-6).toUpperCase()}`} currentUser={user} />
          </div>
        </div>

        {/* Destaque: Quantidade de Telhas + Metragem individual */}
        {(p.metros > 0 || p.metragem_mm > 0) && (
          <div className="flex items-stretch gap-2 mb-3">
            {p.metros > 0 && (
              <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-center">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Qtd. Telhas</p>
                <p className="text-2xl font-black text-indigo-700 leading-none">{Number(p.metros).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-indigo-400 font-medium">peças</p>
              </div>
            )}
            {p.metragem_mm > 0 && (
              <div className="flex-1 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-center">
                <p className="text-xs font-semibold text-teal-500 uppercase tracking-wide">Comprimento</p>
                <p className="text-2xl font-black text-teal-700 leading-none">{Number(p.metragem_mm).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-teal-400 font-medium">mm por peça</p>
              </div>
            )}
            {p.metros > 0 && p.metragem_mm > 0 && (
              <div className="flex-1 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-center">
                <p className="text-xs font-semibold text-primary/60 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-black text-primary leading-none">
                  {(Number(p.metros) * (Number(p.metragem_mm) / 1000)).toFixed(1)}
                </p>
                <p className="text-xs text-primary/50 font-medium">metros</p>
              </div>
            )}
          </div>
        )}

        {/* Variações de telhas (múltiplas medidas) */}
        {(() => {
          let vars = [];
          try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch { vars = []; }
          if (!Array.isArray(vars) || vars.length === 0) return null;

          const toggleFinalizado = (idx) => {
            const novos = [...vars];
            novos[idx] = { ...novos[idx], finalizado: !novos[idx].finalizado };
            onStatusChange(p, p.status, { variacoes_telhas: JSON.stringify(novos) });
          };
          const salvarObs = (idx, obs) => {
            const novos = [...vars];
            novos[idx] = { ...novos[idx], observacao: obs };
            onStatusChange(p, p.status, { variacoes_telhas: JSON.stringify(novos) });
          };
          const todosFinalizados = vars.every(v => v.finalizado);

          return (
            <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-2.5 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Medidas do Pedido ({vars.length})</p>
                {todosFinalizados && (
                  <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Todos finalizados
                  </span>
                )}
              </div>
              {vars.map((v, i) => {
                const q = Number(v.qty) || 0;
                const mm = Number(v.mm) || 0;
                const fin = !!v.finalizado;
                return (
                  <div key={i} className={`rounded-lg border p-2 transition-all ${fin ? "bg-green-50 border-green-300" : "bg-white border-slate-200"}`}>
                    <div className="flex items-start gap-2 text-xs">
                      <span className={`font-mono font-bold flex-shrink-0 ${fin ? "text-green-600" : "text-indigo-500"}`}>{i + 1}.</span>
                      <div className="flex-1">
                        <span className={`font-semibold ${fin ? "text-green-700 line-through" : "text-slate-700"}`}>{q} pçs</span>
                        <span className="text-muted-foreground mx-1">×</span>
                        <span className={`font-semibold ${fin ? "text-green-700 line-through" : "text-slate-700"}`}>{mm.toLocaleString("pt-BR")}mm</span>
                        {q > 0 && mm > 0 && (
                          <span className={`${fin ? "text-green-500" : "text-indigo-500"} ml-1`}>= {(q * mm / 1000).toFixed(2)}m</span>
                        )}
                        {v.bobina_desc && (
                          <p className="text-blue-600 font-medium mt-0.5">Bobina: {v.bobina_desc}</p>
                        )}
                        {v.bobina_inf_desc && (
                          <p className="text-indigo-600 font-medium mt-0.5">Bobina Inf.: {v.bobina_inf_desc}</p>
                        )}
                        {v.obs && (
                          <p className="text-muted-foreground italic mt-0.5">OBS: {v.obs}</p>
                        )}
                      </div>
                    </div>
                    {/* Checkbox finalizar + campo observação por item */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200">
                      <button
                        onClick={() => toggleFinalizado(i)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all border ${
                          fin
                            ? "bg-green-500 text-white border-green-500"
                            : "bg-white text-slate-600 border-slate-300 hover:border-green-400 hover:text-green-600"
                        }`}
                      >
                        <CheckCircle2 className={`w-3 h-3 ${fin ? "fill-white text-green-500" : ""}`} />
                        {fin ? "Finalizado" : "Finalizar Item"}
                      </button>
                      <input
                        type="text"
                        value={v.observacao || ""}
                        onChange={(e) => salvarObs(i, e.target.value)}
                        placeholder="Observação deste item..."
                        className="flex-1 h-7 px-2 text-xs border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:bg-white"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Detalhes técnicos */}
        <div className="flex flex-wrap gap-2 mb-3">
          {p.bobina_superior && (
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">Bobina: {p.bobina_superior}</span>
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
          {p.rvm_superior && (
            <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              {p.rvm_superior}{p.rvm_inferior ? ` / ${p.rvm_inferior}` : ""}
            </span>
          )}
          {p.eps && (
            <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full">EPS: {p.eps}</span>
          )}
          {p.kg_total > 0 && (
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">{p.kg_total} kg</span>
          )}
          {p.data_prevista && (
            <span className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full">
              Previsto: {format(new Date(p.data_prevista + "T12:00:00"), "dd/MM")}
            </span>
          )}
        </div>

        {p.observacoes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 text-xs text-yellow-800 mb-3">
            {p.observacoes}
          </div>
        )}

        {/* Foto da OP física */}
        {p.foto_pedido_url && (
          <div className="mb-3">
            {p.foto_pedido_url.toLowerCase().endsWith(".pdf") ? (
              <ImageLink url={p.foto_pedido_url} name="OP Física" className="block">
                <div className="flex items-center gap-2 border-2 border-primary/30 rounded-lg px-3 py-2 cursor-pointer hover:bg-accent transition-colors w-fit">
                  <FileText className="w-8 h-8 text-primary" />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">OP Física (PDF)</p>
                    <p className="text-muted-foreground">Toque para abrir</p>
                  </div>
                </div>
              </ImageLink>
            ) : (
              <ImageLink url={p.foto_pedido_url} name="OP Física" className="block">
                <img src={p.foto_pedido_url} alt="OP Física" className="w-28 h-28 object-cover rounded-lg border-2 border-primary/30 cursor-pointer" />
              </ImageLink>
            )}
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

        {/* Etapas */}
        {steps && (
          <div className="bg-slate-50 rounded-lg p-3 mb-3 border border-slate-200">
            <button
              onClick={() => setMostrarEtapas(v => !v)}
              className="w-full flex items-center justify-between gap-1.5 mb-0"
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Etapas de Produção</span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({Object.values(etapasOk).filter(Boolean).length}/{steps.length} ✓)
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{mostrarEtapas ? "▲" : "▼"}</span>
            </button>
            {mostrarEtapas && (
              <div className="mt-2 space-y-1.5">
                {steps.map((step, i) => {
                  const ok = !!etapasOk[i];
                  return (
                    <button
                      key={i}
                      onClick={() => setEtapasOk(prev => ({ ...prev, [i]: !ok }))}
                      className={`w-full flex items-center gap-2.5 text-left rounded-lg px-2.5 py-1.5 transition-all border ${ok ? "bg-green-50 border-green-200" : "bg-white border-slate-200 hover:border-primary/40"}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${ok ? "border-green-500 bg-green-500" : "border-slate-300"}`}>
                        {ok && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${ok ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>{i + 1}</span>
                      <span className={`text-xs flex-1 ${ok ? "line-through text-muted-foreground" : "text-slate-700"}`}>{step}</span>
                    </button>
                  );
                })}
                {/* Barra de progresso */}
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progresso</span>
                    <span>{Math.round((Object.values(etapasOk).filter(Boolean).length / steps.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${(Object.values(etapasOk).filter(Boolean).length / steps.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 mt-3">
          {p.status === "pendente" && (
            <Button
              size="sm"
              className={`gap-1 border-0 ${aguardandoAprovacao ? "bg-slate-300 text-slate-500 cursor-not-allowed" : p.rota ? "bg-red-500 hover:bg-red-600 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
              onClick={handleIniciar}
              disabled={aguardandoAprovacao}
            >
              <Play className="w-3 h-3" /> {aguardandoAprovacao ? "Aguardando..." : p.maquina === "COLAGEM" ? "Iniciar Colagem" : "Iniciar"}
            </Button>
          )}

          {p.status === "em_producao" && (
            <>
              <Button size="sm" variant="outline" className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handlePausar}>
                <Pause className="w-3 h-3" /> Pausar
              </Button>
              <Button
                size="sm"
                className={`gap-1 border-0 ${temVariacoes && !todosItensFinalizados ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}
                onClick={handleFinalizar}
                disabled={temVariacoes && !todosItensFinalizados}
                title={temVariacoes && !todosItensFinalizados ? "Finalize todos os itens primeiro" : ""}
              >
                <CheckCircle2 className="w-3 h-3" />
                {temVariacoes && !todosItensFinalizados
                  ? `Finalize os itens (${_variacoesTelhas.filter(v => v.finalizado).length}/${_variacoesTelhas.length})`
                  : isBandejaMultiEtapa && proximaEtapaBandeja
                  ? `Finalizar ${labelProximaEtapa(p.produto, p.maquina)}`
                  : precisaColagem ? "Finalizar → Colagem" : "✓ Finalizar"}
              </Button>
            </>
          )}

          {p.status === "pausado" && (
            <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90 text-white border-0" onClick={handleRetomar}>
              <Play className="w-3 h-3" /> Retomar
            </Button>
          )}

          {p.status === "aguardando_colagem" && p.maquina === "COLAGEM" && (
            <Button size="sm" className="gap-1 bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={handleIniciar}>
              <Play className="w-3 h-3" /> Iniciar Colagem
            </Button>
          )}

          {p.status === "aguardando_colagem" && (
            <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => onStatusChange(p, "pendente", { inicio_producao_ts: null })}>
              ↩ Retornar
            </Button>
          )}

          {p.status === "finalizado" && p.maquina !== "COLAGEM" && podeGerenciar && (
            <>
              <Button size="sm" variant="outline" className="gap-1 text-slate-500" onClick={() => onStatusChange(p, "pendente", { inicio_producao_ts: null })}>
                ↩ Reabrir
              </Button>
              <Button size="sm" variant="outline" className="gap-1 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setRetrabalhoOpen(true)}>
                <AlertTriangle className="w-3 h-3" /> Retrabalho
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dialog de validação de etiqueta */}
      <ValidacaoEtiquetaTelhasDialog
        open={validacaoEtiquetaOpen}
        onClose={() => setValidacaoEtiquetaOpen(false)}
        pedido={p}
        onAprovado={handleEtiquetaAprovada}
      />

      {/* Dialog de retrabalho */}
      <RetrabalhoTelhasDialog
        open={retrabalhoOpen}
        onClose={() => setRetrabalhoOpen(false)}
        pedidoOrigem={p}
        onCreate={() => setRetrabalhoOpen(false)}
      />

      {/* Dialog de confirmação de início (2ª OP) */}
      <ConfirmarInicioDialog
        open={confirmarInicioOpen}
        onClose={() => setConfirmarInicioOpen(false)}
        pedido={p}
        pedidoRodando={opRodando}
        isRotaOuPrioridade={p.rota || p.prioridade}
        onConfirm={handleConfirmarInicio}
      />

      {/* Dialog de pausa */}
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

      {/* Dialog checklist TELHA + EPS + TELHA */}
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

      {/* Dialog de confirmação de metragem */}
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