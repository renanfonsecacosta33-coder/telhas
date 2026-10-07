import React from "react";
import {
  MapPin, Factory, Cpu, CheckCircle2, Inbox, Clock, Play,
  AlertTriangle, Pause, ArrowRight, Check, Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Componente que coloca EM MÁXIMA EVIDÊNCIA:
 * 1. Onde este pedido está fisicamente / operacionalmente (Máquina, Galpão, Expedição, PCP).
 * 2. O Status exato do pedido (Concluído, Em Produção, Aguardando Máquina, Pendente).
 * 3. A Esteira visual de progresso (PCP → Distribuído → Na Máquina → Concluído).
 */
export default function LocalizacaoStatusHero({
  pedido,
  ops = [],
  percentual = 0,
  setor = "telhas",
  compacto = false
}) {
  const statusPcp = pedido?.status_pcp || "aguardando_distribuicao";
  const pct = Math.min(100, Math.max(0, Math.round(percentual || pedido?.percentual_concluido || 0)));
  const isConcluido = statusPcp === "concluido" || pct >= 100;

  // 1. Identificar Máquinas ativas ou alocadas
  const maquinasLista = (() => {
    const setM = new Set();
    // Nas OPs reais
    if (Array.isArray(ops)) {
      ops.forEach(op => {
        if (op.maquina) setM.add(op.maquina);
        if (op.maquina_nome) setM.add(op.maquina_nome);
      });
    }
    // Nos itens_json do pedido
    try {
      const itens = typeof pedido?.itens_json === "string" ? JSON.parse(pedido?.itens_json || "[]") : (pedido?.itens || []);
      if (Array.isArray(itens)) {
        itens.forEach(it => {
          if (it.maquina) setM.add(it.maquina);
        });
      }
    } catch {
      // ignore
    }
    return Array.from(setM).filter(Boolean);
  })();

  // Verificar se há OP ativa em execução agora
  const temOpEmExecucao = Array.isArray(ops) && ops.some(o => ["em_producao", "executando"].includes(o.status));
  const temOpPausada = Array.isArray(ops) && ops.some(o => o.status === "pausado");

  // 2. Determinar ONDE ESTÁ O PEDIDO
  let localizacao = {
    titulo: "Fila PCP — Aguardando Programação",
    subtitulo: "Central de Planejamento e Controle de Produção",
    posto: "Mesa PCP",
    icon: Inbox,
    corTexto: "text-amber-700 dark:text-amber-300",
    corBg: "bg-amber-500/10 dark:bg-amber-950/30 border-amber-300/60 dark:border-amber-800/60",
    dotCor: "bg-amber-500",
    stepIndex: 1
  };

  if (isConcluido) {
    localizacao = {
      titulo: "Box de Expedição / Pátio de Carregamento",
      subtitulo: "100% Produzido — Pronto para Faturamento / Envio",
      posto: "Expedição Final",
      icon: CheckCircle2,
      corTexto: "text-emerald-700 dark:text-emerald-300",
      corBg: "bg-emerald-500/15 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700",
      dotCor: "bg-emerald-500",
      stepIndex: 4
    };
  } else if (temOpEmExecucao) {
    const nomeMaq = maquinasLista.length > 0 ? maquinasLista.join(" + ") : "Chão de Fábrica";
    localizacao = {
      titulo: `Máquina: ${nomeMaq}`,
      subtitulo: `⚡ Em produção agora pelo operador (${pct}% concluído)`,
      posto: `⚡ Produzindo: ${nomeMaq}`,
      icon: Play,
      corTexto: "text-blue-700 dark:text-blue-300",
      corBg: "bg-blue-500/15 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700",
      dotCor: "bg-blue-500 animate-ping",
      stepIndex: 3
    };
  } else if (temOpPausada) {
    const nomeMaq = maquinasLista.length > 0 ? maquinasLista.join(" + ") : "Chão de Fábrica";
    localizacao = {
      titulo: `Máquina: ${nomeMaq}`,
      subtitulo: "⏸️ Produção Pausada pelo Operador",
      posto: `Pausado: ${nomeMaq}`,
      icon: Pause,
      corTexto: "text-amber-700 dark:text-amber-300",
      corBg: "bg-amber-500/15 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700",
      dotCor: "bg-amber-500",
      stepIndex: 3
    };
  } else if (maquinasLista.length > 0 || statusPcp === "em_producao") {
    const nomeMaq = maquinasLista.length > 0 ? maquinasLista.join(" + ") : "Perfiladeira / Máquina";
    localizacao = {
      titulo: `Máquina: ${nomeMaq}`,
      subtitulo: "⏳ Na fila da máquina — Aguardando início pelo operador",
      posto: `Fila da Máquina: ${nomeMaq}`,
      icon: Clock,
      corTexto: "text-amber-700 dark:text-amber-300",
      corBg: "bg-amber-500/10 dark:bg-amber-950/30 border-amber-300/60 dark:border-amber-800/60",
      dotCor: "bg-amber-500",
      stepIndex: 3
    };
  } else if (statusPcp === "distribuido") {
    localizacao = {
      titulo: setor === "cd" ? "Fila do Galpão — Corte & Dobra" : "Fila do Galpão — Setor de Telhas",
      subtitulo: "Distribuído pelo PCP — Aguardando Operador Puxar Ordem",
      posto: "Fila de Produção",
      icon: Factory,
      corTexto: "text-indigo-700 dark:text-indigo-300",
      corBg: "bg-indigo-500/15 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800",
      dotCor: "bg-indigo-500",
      stepIndex: 2
    };
  }

  // 3. Determinar STATUS PRINCIPAL
  let statusBadge = {
    label: "Aguardando Distribuição",
    cls: "bg-amber-500 text-white border-amber-600 shadow-xs",
    icon: Clock
  };

  if (isConcluido) {
    statusBadge = {
      label: "Pacote 100% Concluído",
      cls: "bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20 shadow-sm",
      icon: CheckCircle2
    };
  } else if (temOpPausada) {
    statusBadge = {
      label: "Produção Pausada",
      cls: "bg-orange-600 text-white border-orange-700 shadow-xs",
      icon: Pause
    };
  } else if (temOpEmExecucao) {
    statusBadge = {
      label: `⚡ Produzindo Agora (${pct}%)`,
      cls: "bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-blue-500/20 shadow-sm animate-pulse",
      icon: Play
    };
  } else if (maquinasLista.length > 0 || statusPcp === "em_producao") {
    statusBadge = {
      label: "⏳ Aguardando Início (Máquina)",
      cls: "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-400 font-bold",
      icon: Clock
    };
  } else if (statusPcp === "distribuido") {
    statusBadge = {
      label: "Distribuído para Fábrica",
      cls: "bg-indigo-600 text-white border-indigo-700 shadow-xs",
      icon: Factory
    };
  }

  const LocIcon = localizacao.icon;
  const StatusIcon = statusBadge.icon;

  // ── MODO COMPACTO ──
  if (compacto) {
    return (
      <div className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-xs ${localizacao.corBg}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="text-[10px] uppercase font-black text-slate-500">Onde está:</span>
          <strong className={`truncate text-xs ${localizacao.corTexto}`}>{localizacao.posto}</strong>
        </div>
        <Badge className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 shrink-0 ${statusBadge.cls}`}>
          <StatusIcon className="w-3 h-3 mr-1 shrink-0" />
          {statusBadge.label}
        </Badge>
      </div>
    );
  }

  // ── MODO COMPACTO / INTEGRADO REFINADO ──
  return (
    <div className="bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2 sm:p-2.5 transition-all space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 min-w-0">
        {/* ONDE ESTÁ AGORA */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Onde está:
            </span>
            <strong className={`text-xs font-black truncate ${localizacao.corTexto}`}>
              {localizacao.titulo}
            </strong>
            {pedido?.unidade && (
              <span className="text-[10px] text-slate-400 font-medium">
                • {pedido.unidade}
              </span>
            )}
          </div>
        </div>

        {/* STATUS OPERACIONAL */}
        <div className="shrink-0 flex items-center gap-1.5">
          <Badge className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border rounded-lg flex items-center gap-1 shadow-2xs ${statusBadge.cls}`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConcluido ? "bg-white" : "bg-blue-200"}`} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            <StatusIcon className="w-3 h-3 shrink-0" />
            <span>{statusBadge.label}</span>
          </Badge>
        </div>
      </div>

      {/* ── ESTEIRA DE PROGRESSO VISUAL (PIPELINE SLIM) ── */}
      <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50">
        <div className="grid grid-cols-4 gap-1">
          {[
            { step: 1, label: "1. Entrada", desc: "PCP" },
            { step: 2, label: "2. Na Fila", desc: "Galpão" },
            { step: 3, label: "3. Na Máquina", desc: maquinasLista[0] || "Produção" },
            { step: 4, label: "4. Concluído", desc: "Expedição" },
          ].map((etapa) => {
            const atingida = localizacao.stepIndex >= etapa.step;
            const atual = localizacao.stepIndex === etapa.step;

            return (
              <div
                key={etapa.step}
                className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-center transition-all ${
                  atual
                    ? "bg-blue-600 text-white shadow-xs font-black"
                    : atingida
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/30"
                    : "bg-slate-100 dark:bg-slate-800/50 text-slate-400 opacity-60 font-medium"
                }`}
              >
                {atingida && !atual ? (
                  <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : atual ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                )}
                <span className="text-[10px] truncate leading-tight">
                  {etapa.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
