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
  } else if (temOpEmExecucao || maquinasLista.length > 0 || statusPcp === "em_producao" || pct > 0) {
    const nomeMaq = maquinasLista.length > 0 ? maquinasLista.join(" + ") : "Chão de Fábrica";
    localizacao = {
      titulo: `Máquina: ${nomeMaq}`,
      subtitulo: temOpPausada ? "Produção Pausada pelo Operador" : `Produzindo no Chão de Fábrica (${pct}% concluído)`,
      posto: nomeMaq,
      icon: Cpu,
      corTexto: "text-blue-700 dark:text-blue-300",
      corBg: "bg-blue-500/15 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700",
      dotCor: "bg-blue-500 animate-ping",
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
  } else if (temOpEmExecucao || statusPcp === "em_producao" || pct > 0) {
    statusBadge = {
      label: `Em Produção na Máquina (${pct}%)`,
      cls: "bg-blue-600 text-white border-blue-700 shadow-blue-500/20 shadow-sm animate-subtle",
      icon: Play
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

  // ── MODO HERO EM DESTAQUE TOTAL ──
  return (
    <div className={`p-3 sm:p-3.5 rounded-2xl border-2 transition-all ${localizacao.corBg} shadow-2xs space-y-2.5`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* PILAR 1: ONDE ESTÁ AGORA */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
            <MapPin className="w-4 h-4 text-rose-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-300/50">
                📍 Onde Este Pedido Está
              </span>
              {pedido?.unidade && (
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  • {pedido.unidade}
                </span>
              )}
            </div>
            <h4 className={`text-sm sm:text-base font-black truncate mt-0.5 ${localizacao.corTexto}`}>
              {localizacao.titulo}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {localizacao.subtitulo}
            </p>
          </div>
        </div>

        {/* PILAR 2: STATUS EM MÁXIMA EVIDÊNCIA */}
        <div className="shrink-0 flex flex-col sm:items-end justify-center">
          <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1 hidden sm:block">
            Status Operacional
          </span>
          <Badge className={`text-xs font-black uppercase tracking-wider px-3 py-1.5 border-2 rounded-xl flex items-center gap-1.5 ${statusBadge.cls}`}>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConcluido ? "bg-white" : "bg-blue-200"}`} />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <StatusIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{statusBadge.label}</span>
          </Badge>
        </div>
      </div>

      {/* ── PILAR 3: ESTEIRA DE PROGRESSO VISUAL (PIPELINE DE 4 ETAPAS) ── */}
      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
        <div className="grid grid-cols-4 gap-1 sm:gap-2">
          {[
            { step: 1, label: "1. Entrada PCP", desc: "Emitido" },
            { step: 2, label: "2. Distribuído", desc: "Na Fila" },
            { step: 3, label: "3. Na Máquina", desc: maquinasLista[0] || "Produção" },
            { step: 4, label: "4. Concluído", desc: "Expedição" },
          ].map((etapa) => {
            const atingida = localizacao.stepIndex >= etapa.step;
            const atual = localizacao.stepIndex === etapa.step;

            return (
              <div
                key={etapa.step}
                className={`flex flex-col items-center text-center p-1.5 rounded-lg transition-all ${
                  atual
                    ? "bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-2xs font-black"
                    : atingida
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                    : "opacity-40"
                }`}
              >
                <div className="flex items-center gap-1">
                  {atingida && !atual ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : atual ? (
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                  )}
                  <span className="text-[10px] sm:text-[11px] font-bold truncate">
                    {etapa.label}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
                  {etapa.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
