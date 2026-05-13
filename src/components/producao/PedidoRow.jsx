import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, Circle, AlertCircle, Layers, Play, Pause, Square, Timer, Coffee } from "lucide-react";
import { format } from "date-fns";

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
  "TELHA": ["Verificar bobina metálica (espessura e cor)", "Passar pela perfiladeira", "Cortar no tamanho"],
  "TELHA + EPS": ["Verificar bobina superior (metal)", "Separar bloco de EPS", "Colar EPS na chapa (cola + fita)", "Passar pela colagem"],
  "TELHA + EPS + TELHA": ["Verificar bobina superior", "Verificar bobina inferior", "Separar EPS do tipo correto", "Colar EPS na chapa superior", "Colar chapa inferior (cola x2 + fita)", "Passar pela colagem"],
  "TELHA + EPS + MANTA": ["Verificar bobina superior", "Separar EPS", "Preparar manta térmica", "Colar EPS + manta na chapa (cola + fita)"],
  "TELHA BANDEJA": ["Verificar bobina superior", "Verificar bobina inferior (Bandeja)", "Separar EPS específico Bandeja", "Colar com cola x2 nas duas faces"],
  "BOBININHA": ["Preparar desbobinador", "Cortar e rebobinar"],
  "CUMEEIRA": ["Verificar bobina e cor", "Passar pela cumeeira", "Cortar e empacotar"],
};

const PRODUTOS_COM_EPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"];

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export default function PedidoRow({ pedido: p, onStatusChange, onUpdate }) {
  const [pauseDialog, setPauseDialog] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState("");
  const [pauseTipo, setPauseTipo] = useState("setup"); // "setup" | "outro"
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);

  // Tick a cada segundo para atualizar cronômetro ao vivo
  useEffect(() => {
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const borderColor = PRODUTO_BG[p.produto] || "border-l-slate-300";
  const precisaColagem = PRODUTOS_COM_EPS.includes(p.produto);

  // Calcula tempo ao vivo
  const now = Date.now();
  let tempoProducaoVivo = p.tempo_producao_seg || 0;
  let tempoPausaVivo = p.tempo_pausa_seg || 0;
  let tempoSetupVivo = p.tempo_setup_seg || 0;

  if (p.status === "em_producao" && p.inicio_producao_ts) {
    tempoProducaoVivo += Math.floor((now - new Date(p.inicio_producao_ts).getTime()) / 1000);
  }
  if (p.status === "pausado" && p.inicio_pausa_ts) {
    const pausaSeg = Math.floor((now - new Date(p.inicio_pausa_ts).getTime()) / 1000);
    if (p.motivo_pausa === "setup") tempoSetupVivo += pausaSeg;
    else tempoPausaVivo += pausaSeg;
  }

  const handleIniciar = () => {
    onStatusChange(p, "em_producao", {
      inicio_producao_ts: new Date().toISOString(),
    });
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
    // Acumula tempo produção final
    let prodSeg = p.tempo_producao_seg || 0;
    if (p.inicio_producao_ts) {
      prodSeg += Math.floor((Date.now() - new Date(p.inicio_producao_ts).getTime()) / 1000);
    }
    const novoStatus = precisaColagem ? "aguardando_colagem" : "finalizado";
    onStatusChange(p, novoStatus, {
      tempo_producao_seg: prodSeg,
      inicio_producao_ts: null,
      data_finalizacao: format(new Date(), "yyyy-MM-dd"),
      // Se vai pra colagem, muda a máquina
      ...(precisaColagem ? { maquina: "COLAGEM" } : {}),
    });
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
                <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">→ Colagem</Badge>
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

        {/* Cronômetros — só aparecem quando há tempo */}
        {(p.status === "em_producao" || p.status === "pausado" || tempoProducaoVivo > 0) && (
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
        )}

        {/* Etapas */}
        {steps && (
          <div className="bg-slate-50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Layers className="w-3 h-3 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Etapas de Produção</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">{i + 1}</span>
                  <span>{step}</span>
                  {i < steps.length - 1 && <span className="text-slate-300 ml-1">›</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 mt-3">
          {p.status === "pendente" && (
            <Button size="sm" className="gap-1 bg-amber-500 hover:bg-amber-600 text-white border-0" onClick={handleIniciar}>
              <Play className="w-3 h-3" /> Iniciar
            </Button>
          )}

          {p.status === "em_producao" && (
            <>
              <Button size="sm" variant="outline" className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handlePausar}>
                <Pause className="w-3 h-3" /> Pausar
              </Button>
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white border-0" onClick={handleFinalizar}>
                <CheckCircle2 className="w-3 h-3" />
                {precisaColagem ? "Finalizar → Colagem" : "✓ Finalizar"}
              </Button>
            </>
          )}

          {p.status === "pausado" && (
            <Button size="sm" className="gap-1 bg-primary hover:bg-primary/90 text-white border-0" onClick={handleRetomar}>
              <Play className="w-3 h-3" /> Retomar
            </Button>
          )}

          {(p.status === "finalizado" || p.status === "aguardando_colagem") && (
            <Button size="sm" variant="outline" className="gap-1 text-slate-500" onClick={() => onStatusChange(p, "pendente", { inicio_producao_ts: null })}>
              ↩ Reabrir
            </Button>
          )}
        </div>
      </div>

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