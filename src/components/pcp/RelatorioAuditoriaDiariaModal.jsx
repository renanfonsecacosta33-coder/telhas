import React, { useState } from "react";
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
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wrench,
  Activity,
  Check,
  Clock,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RelatorioAuditoriaDiariaModal({
  open,
  onOpenChange,
  relatorio,
  onExecutarNovamente,
  executando
}) {
  if (!relatorio) return null;

  const dataFmt = relatorio.dataExecucao
    ? format(new Date(relatorio.dataExecucao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : "Hoje";

  const isErroZero = relatorio.alertasPendentesCount === 0 && relatorio.errosCorrigidosCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black flex items-center gap-2">
                  <span>Robô de Auditoria Diária — Rumo ao Erro 0</span>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-300">
                    {relatorio.statusGeral}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Última checagem realizada em: {dataFmt}</span>
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Saúde Geral</div>
                <div className="text-xl font-black text-emerald-600">{relatorio.scoreSaude}%</div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo em Cards das 3 Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
          {/* Acertos */}
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Pontos de Acerto
              </span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                {relatorio.acertosCount}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
              Rotinas 100% validadas e em conformidade.
            </p>
          </div>

          {/* Erros Corrigidos */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-blue-600" />
                Erros Corrigidos
              </span>
              <span className="text-lg font-black text-blue-700 dark:text-blue-400">
                {relatorio.errosCorrigidosCount}
              </span>
            </div>
            <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-1">
              Inconsistências baixadas ou desativadas na hora.
            </p>
          </div>

          {/* Alertas / Ação Humana */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Pendências Humanas
              </span>
              <span className="text-lg font-black text-amber-700 dark:text-amber-400">
                {relatorio.alertasPendentesCount}
              </span>
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-1">
              Demandam decisão do encarregado do PCP.
            </p>
          </div>
        </div>

        {/* Banner de Erro Zero se tudo estiver perfeito */}
        {isErroZero && (
          <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-4 text-center">
            <Sparkles className="w-8 h-8 text-emerald-500 mx-auto mb-1 animate-bounce" />
            <h4 className="font-black text-emerald-900 dark:text-emerald-200 text-sm">
              SISTEMA EM ESTADO PERFEITO: ERRO ZERO ALCANÇADO!
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
              Nenhuma ordem órfã, nenhuma duplicata fantasma e todas as máquinas alinhadas com o Odoo.
            </p>
          </div>
        )}

        {/* 1. Detalhamento de Erros Sanados */}
        {relatorio.errosCorrigidos?.length > 0 && (
          <div className="space-y-2 mt-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-blue-600" />
              Erros Sanados pelo Robô Hoje ({relatorio.errosCorrigidos.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {relatorio.errosCorrigidos.map((err, idx) => (
                <div
                  key={idx}
                  className="bg-muted/40 border border-border rounded-lg p-2 text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-primary mr-1.5">{err.pedido}</span>
                    <Badge variant="outline" className="text-[10px] mr-1.5">
                      {err.setor} · {err.maquina}
                    </Badge>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{err.tipo}:</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{err.resolucao}</p>
                  </div>
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Detalhamento de Alertas Pendentes (Ação Humana) */}
        {relatorio.alertasPendentes?.length > 0 && (
          <div className="space-y-2 mt-3">
            <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Pontos de Atenção para Decisão no PCP ({relatorio.alertasPendentes.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {relatorio.alertasPendentes.map((alerta, idx) => (
                <div
                  key={idx}
                  className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-200 mr-1.5">{alerta.pedido}</span>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/20 border-amber-400 text-amber-900 dark:text-amber-200 mr-1.5">
                      {alerta.tipo}
                    </Badge>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">{alerta.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Acertos e Conformidades */}
        <div className="space-y-2 mt-3">
          <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Itens Validados com Sucesso
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {relatorio.acertos.map((acerto, idx) => (
              <div key={idx} className="bg-muted/30 border border-border rounded-lg p-2 text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">{acerto.categoria}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">{acerto.descricao}</p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">
            Total de registros inspecionados: <strong>{relatorio.totalVerificados}</strong>
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExecutarNovamente}
              disabled={executando}
              className="gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${executando ? "animate-spin" : ""}`} />
              <span>{executando ? "Auditando..." : "Rodar Auditoria Completa Agora"}</span>
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Fechar Relatório
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
