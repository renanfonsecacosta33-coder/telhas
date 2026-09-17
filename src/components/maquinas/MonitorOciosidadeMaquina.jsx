import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Play,
  RefreshCw,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  ShieldCheck,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  isHorarioExpediente,
  getStatusExpediente,
  TOLERANCIA_OCIOSIDADE_SEG
} from "@/lib/expedienteHelper";
import { playSireneFabrica, speakAlertaMaquinaOciosa } from "@/lib/sounds";
import SetupMaquinaModal from "./SetupMaquinaModal";
import { toast } from "sonner";

function formatSegundos(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const remSec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(remSec).padStart(2, "0")}`;
}

export default function MonitorOciosidadeMaquina({
  maquinaNome = "",
  setor = "telhas",
  isProduzindo = false, // True se alguma OP está com status 'em_producao' nesta máquina
  user = null,
  onIniciarPrimeiraOp = null
}) {
  const [tick, setTick] = useState(0);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [silenciadoAte, setSilenciadoAte] = useState(null);

  // Setup ativo armazenado por máquina no localStorage para resistir a refresh
  const storageKeySetup = `ajl_setup_ativo_${maquinaNome}`;
  const storageKeyUltimaAtividade = `ajl_ultima_ativ_${maquinaNome}`;

  const [setupAtivo, setSetupAtivo] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKeySetup);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [ultimaAtividadeTs, setUltimaAtividadeTs] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKeyUltimaAtividade);
      return saved ? new Date(saved).getTime() : Date.now();
    } catch {
      return Date.now();
    }
  });

  // Salvar setup no localStorage
  const handleIniciarSetup = (dados) => {
    setSetupAtivo(dados);
    localStorage.setItem(storageKeySetup, JSON.stringify(dados));
    setSilenciadoAte(null);
  };

  const handleConcluirSetup = () => {
    const agoraTs = Date.now();
    setSetupAtivo(null);
    localStorage.removeItem(storageKeySetup);
    setUltimaAtividadeTs(agoraTs);
    localStorage.setItem(storageKeyUltimaAtividade, new Date(agoraTs).toISOString());
    toast.success(`Setup na máquina ${maquinaNome} concluído com sucesso!`);
  };

  // Se a máquina estiver produzindo uma OP, atualiza a última atividade e limpa setup
  useEffect(() => {
    if (isProduzindo) {
      const agoraTs = Date.now();
      setUltimaAtividadeTs(agoraTs);
      localStorage.setItem(storageKeyUltimaAtividade, new Date(agoraTs).toISOString());
      if (setupAtivo) {
        setSetupAtivo(null);
        localStorage.removeItem(storageKeySetup);
      }
    }
  }, [isProduzindo, maquinaNome]);

  // Tick a cada 1 segundo
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const statusExpediente = getStatusExpediente(now);
  const emExpediente = statusExpediente.emExpediente;

  // Cálculo do tempo ocioso
  const agoraMs = now.getTime();
  const tempoSemAtividadeSeg = Math.max(0, Math.floor((agoraMs - ultimaAtividadeTs) / 1000));
  const tempoExcedidoOcioso = Math.max(0, tempoSemAtividadeSeg - TOLERANCIA_OCIOSIDADE_SEG);

  // A máquina está ociosa crítica se:
  // 1. Está no expediente (08h às 12h ou 13h às 18h)
  // 2. Não está produzindo nenhuma OP
  // 3. Não tem nenhum setup ativo
  // 4. Passou de 3 minutos (180s) sem atividade
  const isOciosaCritica = emExpediente && !isProduzindo && !setupAtivo && tempoSemAtividadeSeg >= TOLERANCIA_OCIOSIDADE_SEG;

  // Controle de Sirene & Voz
  const lastSoundAlertRef = useRef(0);

  useEffect(() => {
    if (!isOciosaCritica) return;

    // Verificar se está silenciado temporariamente
    if (silenciadoAte && Date.now() < silenciadoAte) return;

    const agora = Date.now();
    // Toca a cada 45 segundos enquanto a máquina permanecer ociosa
    if (agora - lastSoundAlertRef.current > 45000) {
      lastSoundAlertRef.current = agora;
      playSireneFabrica();
      setTimeout(() => {
        const minutosOciosa = Math.max(3, Math.floor(tempoSemAtividadeSeg / 60));
        speakAlertaMaquinaOciosa(maquinaNome, minutosOciosa);
      }, 1800);
    }
  }, [isOciosaCritica, tempoSemAtividadeSeg, maquinaNome, silenciadoAte, tick]);

  const handleSilenciarTemporario = () => {
    const doisMinutos = Date.now() + 120000;
    setSilenciadoAte(doisMinutos);
    toast.info("Alarme sonoro silenciado por 2 minutos. Inicie a OP ou registre o Setup!");
  };

  // Se tem Setup ativo rodando
  if (setupAtivo) {
    const duracaoSetupSeg = Math.max(0, Math.floor((agoraMs - new Date(setupAtivo.inicioTs).getTime()) / 1000));
    return (
      <>
        <div className="bg-indigo-50/90 dark:bg-indigo-950/60 border-2 border-indigo-500/60 rounded-2xl p-4 shadow-sm transition-all mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md animate-pulse shrink-0">
                <RefreshCw className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider">
                    🔄 Setup Ativo
                  </Badge>
                  <span className="font-black text-sm text-foreground">
                    {setupAtivo.tipoTitulo}
                  </span>
                  {setupAtivo.bobinaCodigo && (
                    <Badge variant="outline" className="text-xs bg-white/80 dark:bg-slate-900 border-indigo-300">
                      Bobina: {setupAtivo.bobinaCodigo}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Operador: <strong>{setupAtivo.operador}</strong> · Meta: ~{setupAtivo.metaMinutos}m · Alarme de ociosidade suspenso.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-center font-mono">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Duração Setup</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                  {formatSegundos(duracaoSetupSeg)}
                </span>
              </div>
              <Button
                onClick={handleConcluirSetup}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm text-xs h-10 px-4"
              >
                <Check className="w-4 h-4" />
                Concluir Setup
              </Button>
            </div>
          </div>
        </div>

        <SetupMaquinaModal
          open={setupModalOpen}
          onOpenChange={setSetupModalOpen}
          maquinaNome={maquinaNome}
          operadorNome={user?.full_name || user?.email}
          onIniciarSetup={handleIniciarSetup}
        />
      </>
    );
  }

  // Se a máquina estiver OCIOSA CRÍTICA (Expediente ativo + sem OP + sem Setup + > 3 min)
  if (isOciosaCritica) {
    const silenciado = silenciadoAte && Date.now() < silenciadoAte;
    return (
      <>
        <div className="relative overflow-hidden bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-600 rounded-2xl p-4 sm:p-5 shadow-lg shadow-rose-500/15 animate-pulse mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 shrink-0 animate-bounce">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-rose-600 text-white font-black text-xs uppercase tracking-widest px-2.5 py-0.5 animate-pulse">
                    🚨 MÁQUINA PARADA NO EXPEDIENTE
                  </Badge>
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    {statusExpediente.label}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-rose-950 dark:text-rose-100 mt-1">
                  Atenção: A máquina {maquinaNome} deve produzir continuamente!
                </h2>
                <p className="text-xs text-rose-800/90 dark:text-rose-200/90 mt-0.5">
                  Parada há <strong>{formatSegundos(tempoSemAtividadeSeg)}</strong> sem justificativa (limite: 03:00 min). Inicie uma OP ou registre o Setup/Troca de Bobina.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {silenciado ? (
                <Badge variant="outline" className="text-xs text-muted-foreground border-rose-300">
                  <VolumeX className="w-3 h-3 mr-1" /> Sirene pausada
                </Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSilenciarTemporario}
                  className="gap-1 text-xs border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 h-9"
                  title="Silenciar sirene por 2 minutos"
                >
                  <VolumeX className="w-3.5 h-3.5" /> Silenciar (2m)
                </Button>
              )}

              <Button
                onClick={() => setSetupModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 text-xs h-9 px-4 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Estou em Setup / Troca de Bobina
              </Button>

              {onIniciarPrimeiraOp && (
                <Button
                  onClick={onIniciarPrimeiraOp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 text-xs h-9 px-4 shadow-sm"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Iniciar Próxima OP
                </Button>
              )}
            </div>
          </div>
        </div>

        <SetupMaquinaModal
          open={setupModalOpen}
          onOpenChange={setSetupModalOpen}
          maquinaNome={maquinaNome}
          operadorNome={user?.full_name || user?.email}
          onIniciarSetup={handleIniciarSetup}
        />
      </>
    );
  }

  // Máquina em produção normal: exibe botão discreto de setup e status OK
  if (isProduzindo) {
    return (
      <>
        <div className="flex items-center justify-between gap-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300/60 dark:border-emerald-800/60 rounded-xl px-4 py-2.5 mb-4 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Máquina em produção ativa · <strong>{maquinaNome}</strong></span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSetupModalOpen(true)}
            className="text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 gap-1.5 h-8 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Troca de Bobina / Setup
          </Button>
        </div>

        <SetupMaquinaModal
          open={setupModalOpen}
          onOpenChange={setSetupModalOpen}
          maquinaNome={maquinaNome}
          operadorNome={user?.full_name || user?.email}
          onIniciarSetup={handleIniciarSetup}
        />
      </>
    );
  }

  // Máquina ociosa dentro da tolerância ou fora do expediente
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3 mb-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${emExpediente ? "bg-amber-400 animate-pulse" : "bg-slate-400"}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                {emExpediente ? "Máquina Aguardando Produção" : statusExpediente.label}
              </span>
              {emExpediente && (
                <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Livre há {formatSegundos(tempoSemAtividadeSeg)} / Tolerância: 03:00m
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {emExpediente
                ? "Inicie a próxima OP ou clique em Setup se estiver colocando bobina ou ajustando a máquina."
                : "Horário de produção suspenso. Registre Setup ou horas extras caso necessário."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            onClick={() => setSetupModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 text-xs h-8 px-3 shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Iniciar Setup / Troca de Bobina
          </Button>
        </div>
      </div>

      <SetupMaquinaModal
        open={setupModalOpen}
        onOpenChange={setSetupModalOpen}
        maquinaNome={maquinaNome}
        operadorNome={user?.full_name || user?.email}
        onIniciarSetup={handleIniciarSetup}
      />
    </>
  );
}
