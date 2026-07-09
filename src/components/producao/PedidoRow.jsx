import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, Circle, AlertCircle, Layers, Play, Pause, Square, Timer, Coffee, AlertTriangle } from "lucide-react";
import RetrabalhoTelhasDialog from "@/components/producao/RetrabalhoTelhasDialog";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import ValidacaoEtiquetaTelhasDialog from "@/components/producao/ValidacaoEtiquetaTelhasDialog";
import { playFinishSound, speakOpFinalizada } from "@/lib/sounds";

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

export default function PedidoRow({ pedido: p, onStatusChange, onUpdate, userRole }) {
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
  const intervalRef = useRef(null);

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
    // Validação de etiqueta obrigatória antes de iniciar (exceto colagem)
    if (p.maquina !== "COLAGEM" && p.validacao_etiqueta_status !== "aprovado") {
      setValidacaoEtiquetaOpen(true);
      return;
    }
    const updates = {
      inicio_producao_ts: new Date().toISOString(),
    };
    onStatusChange(p, "em_producao", updates);
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
    // TELHA + EPS + TELHA: pede checklist de telhas antes
    if (p.produto === "TELHA + EPS + TELHA" && p.maquina !== "COLAGEM") {
      setTelhaSupOk(false);
      setTelhaInfOk(false);
      setTelhasSandwichDialog(true);
      return;
    }
    // Abre dialog de confirmação de metragem
    setMetragemReal(p.metragem_planejada?.toString() || "");
    setMetragemDialog(true);
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
      });
      setMetragemDialog(false);
      return;
    }

    // ── MÁQUINA (não é colagem): desconta bobinas, NÃO desconta isopor ──
    let prodSeg = p.tempo_producao_seg || 0;
    if (p.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(p.inicio_producao_ts).getTime()) / 1000);
    }

    // Calcula razão real/planejado para ajuste proporcional de KG
    const metragemTotalPedido = (Number(p.metros) || 0) * ((Number(p.metragem_mm) || 0) / 1000);
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
              <StatusBadge status={p.status} />
              {p.status === "aguardando_colagem" && (
                <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                  {p.produto === "TELHA BANDEJA" && p.maquina === "BANDEJA" ? "→ Bandeja" :
                   p.produto === "TELHA BANDEJA" && p.maquina === "COLAGEM" ? "→ Colagem" :
                   "→ Colagem"}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
              {p.cliente && <span className="font-semibold text-slate-700">{p.cliente}</span>}
              {p.vendedor && <span className="text-muted-foreground">{p.vendedor}</span>}
              {p.numero_pedido && <span className="text-muted-foreground font-mono text-xs">#{p.numero_pedido}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-black text-primary leading-none">
              {(p.metros || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              <span className="text-base font-normal text-muted-foreground">m</span>
            </p>
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

        {/* Detalhes técnicos */}
        <div className="flex flex-wrap gap-2 mb-3">
          {p.bobina_superior && (
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">Bobina: {p.bobina_superior}</span>
          )}
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
            <Button size="sm" className="gap-1 bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={handleIniciar}>
              <Play className="w-3 h-3" /> {p.maquina === "COLAGEM" ? "Iniciar Colagem" : "Iniciar"}
            </Button>
          )}

          {p.status === "em_producao" && (
            <>
              <Button size="sm" variant="outline" className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handlePausar}>
                <Pause className="w-3 h-3" /> Pausar
              </Button>
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white border-0" onClick={handleFinalizar}>
                <CheckCircle2 className="w-3 h-3" />
                {isBandejaMultiEtapa && proximaEtapaBandeja
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetragemDialog(false)}>Cancelar</Button>
            <Button
              onClick={confirmarFinalizacao}
              disabled={!metragemReal || Number(metragemReal) <= 0}
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