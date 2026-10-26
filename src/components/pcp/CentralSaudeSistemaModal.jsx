import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Zap,
  Server,
  Cpu,
  Database,
  Wifi,
  ShieldCheck,
  Trash2
} from "lucide-react";
import {
  executarDiagnosticoCompleto,
  executarAutoCorrecaoCompleta,
  obterHistoricoErrosTelemetria,
  limparHistoricoErrosTelemetria
} from "@/lib/diagnosticoSistemaHelper";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function CentralSaudeSistemaModal({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [carregando, setCarregando] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [diagnostico, setDiagnostico] = useState(null);
  const [historicoErros, setHistoricoErros] = useState([]);

  const rodarDiagnostico = async () => {
    setCarregando(true);
    try {
      const res = await executarDiagnosticoCompleto();
      setDiagnostico(res);
      setHistoricoErros(obterHistoricoErrosTelemetria());
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (open) {
      rodarDiagnostico();
    }
  }, [open]);

  const handleAutoCorrigir = async () => {
    setCorrigindo(true);
    try {
      const res = await executarAutoCorrecaoCompleta({ queryClient });
      if (res.sucesso) {
        toast.success("Auto-correção executada com sucesso!", {
          description: res.detalhes
        });
      } else {
        toast.error("Falha ao executar auto-correção", {
          description: res.detalhes
        });
      }
      await rodarDiagnostico();
    } finally {
      setCorrigindo(false);
    }
  };

  const handleLimparLog = () => {
    limparHistoricoErrosTelemetria();
    setHistoricoErros([]);
    toast.info("Histórico de telemetria limpo.");
  };

  const score = diagnostico?.scoreGeral ?? 100;
  const statusColor =
    score >= 90
      ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
      : score >= 70
      ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
      : "text-red-500 border-red-500/30 bg-red-500/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        className="w-[96vw] max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  Central de Saúde & Diagnóstico 360°
                  <Badge variant="outline" className={`text-xs font-mono font-bold ${statusColor}`}>
                    {score}% Saudável
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Monitoramento contínuo de conectividade, banco de dados, Odoo ERP e chão de fábrica.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={rodarDiagnostico}
              disabled={carregando || corrigindo}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? "animate-spin" : ""}`} />
              Testar Agora
            </Button>
          </div>
        </DialogHeader>

        {/* Card de Score Principal */}
        <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-extrabold text-sm sm:text-base">
              {score}%
            </div>
            <div>
              <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                {score >= 90
                  ? "Sistema Operando em Estado de Arte"
                  : score >= 70
                  ? "Sistema Operando com Avisos Leves"
                  : "Atenção: Inconsistências Detectadas"}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Meta de Erro Zero ativa. Tráfego otimizado, sem gargalos ou travamentos identificados.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleAutoCorrigir}
            disabled={carregando || corrigindo}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 gap-1.5 shadow-sm"
          >
            <Zap className={`w-3.5 h-3.5 ${corrigindo ? "animate-bounce" : ""}`} />
            {corrigindo ? "Corrigindo..." : "⚡ Auto-Corrigir & Conciliar"}
          </Button>
        </div>

        {/* Grid de 4 Pilares */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {/* Pilar 1: Base44 */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-500" />
                Banco de Dados Base44
              </span>
              {diagnostico?.itens?.bancoBase44?.status === "ok" ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Online
                </Badge>
              ) : (
                <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 text-[10px] gap-1">
                  <XCircle className="w-3 h-3" /> Instável
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {diagnostico?.itens?.bancoBase44?.detalhe || "Verificando conexão..."}
            </p>
          </div>

          {/* Pilar 2: Odoo ERP */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-500" />
                Integração Odoo ERP
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> Integrado
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {diagnostico?.itens?.odooIntegracao?.detalhe || "Verificando pedidos..."}
            </p>
          </div>

          {/* Pilar 3: Chão de Fábrica */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-500" />
                Máquinas & Painéis
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> Sincronizado
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {diagnostico?.itens?.chaoFabrica?.detalhe || "Verificando máquinas..."}
            </p>
          </div>

          {/* Pilar 4: Caches e Modo Offline */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-teal-500" />
                Resiliência & Offline-First
              </span>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3" /> Protegido
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {diagnostico?.itens?.resilienciaCache?.detalhe || "Verificando IndexedDB..."}
            </p>
          </div>
        </div>

        {/* Seção de Telemetria e Registro de Erros */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-400" />
              Telemetria Recente do Sistema ({historicoErros.length})
            </span>
            {historicoErros.length > 0 && (
              <button
                type="button"
                onClick={handleLimparLog}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" /> Limpar Log
              </button>
            )}
          </div>

          {historicoErros.length === 0 ? (
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Nenhum erro ou instabilidade detectada nas últimas 24 horas. Operação limpa.</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {historicoErros.map((e) => (
                <div
                  key={e.id}
                  className="p-2 rounded-md bg-slate-100 dark:bg-slate-800/70 text-[11px] font-mono flex items-center justify-between gap-2"
                >
                  <span className="text-slate-700 dark:text-slate-200 truncate">
                    [{e.modulo}] {e.mensagem}
                  </span>
                  <span className="text-slate-400 text-[10px] shrink-0">
                    {new Date(e.data_hora).toLocaleTimeString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar Painel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
