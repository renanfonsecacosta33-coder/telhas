import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Flame, Zap, Star, Shield, ArrowDown, Ban, ChevronDown } from "lucide-react";

export const NIVEIS_PRIORIDADE = [
  {
    nivel: 1,
    label: "P1 - Mais Urgente",
    tag: "P1 - URGENTE",
    desc: "1 é a mais urgente a fazer (Prioridade Máxima)",
    Icon: Flame,
    badgeCls: "bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-sm animate-pulse font-black text-xs",
    menuCls: "text-red-600 font-bold focus:bg-red-50 dark:focus:bg-red-950/40",
    cor: "text-red-600",
    peso: 0
  },
  {
    nivel: 2,
    label: "P2 - Alta",
    tag: "P2 - ALTA",
    desc: "Alta prioridade de produção",
    Icon: Zap,
    badgeCls: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600 font-bold text-xs",
    menuCls: "text-orange-600 font-bold focus:bg-orange-50 dark:focus:bg-orange-950/40",
    cor: "text-orange-500",
    peso: 1
  },
  {
    nivel: 3,
    label: "P3 - Média",
    tag: "P3 - MÉDIA",
    desc: "Prioridade intermediária",
    Icon: Star,
    badgeCls: "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 font-bold text-xs",
    menuCls: "text-amber-600 font-bold focus:bg-amber-50 dark:focus:bg-amber-950/40",
    cor: "text-amber-500",
    peso: 2
  },
  {
    nivel: 4,
    label: "P4 - Normal",
    tag: "P4 - NORMAL",
    desc: "Fila padrão de produção",
    Icon: Shield,
    badgeCls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 font-semibold text-xs",
    menuCls: "text-blue-600 font-semibold focus:bg-blue-50 dark:focus:bg-blue-950/40",
    cor: "text-blue-500",
    peso: 3
  },
  {
    nivel: 5,
    label: "P5 - Baixa",
    tag: "P5 - BAIXA",
    desc: "Produzir quando houver folga",
    Icon: ArrowDown,
    badgeCls: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-medium text-xs",
    menuCls: "text-slate-600 dark:text-slate-400 focus:bg-slate-50 dark:focus:bg-slate-900",
    cor: "text-slate-500",
    peso: 4
  }
];

export function getPrioridadeNivel(pedido) {
  if (!pedido) return null;
  const n = Number(pedido.prioridade_nivel);
  if (n >= 1 && n <= 5) return n;
  if (pedido.prioridade === true || pedido.prioridade === 1) return 1;
  return null;
}

export function getPrioridadeConfig(pedido) {
  const nivel = getPrioridadeNivel(pedido);
  if (!nivel) return null;
  return NIVEIS_PRIORIDADE.find(p => p.nivel === nivel) || null;
}

export function getPesoOrdenacaoPrioridade(pedido) {
  const nivel = getPrioridadeNivel(pedido);
  if (nivel === 1) return 0; // P1 é a mais urgente absoluta
  if (pedido?.rota) return 0.5; // Pedido de Rota
  if (nivel === 2) return 1;
  if (nivel === 3) return 2;
  if (nivel === 4) return 3;
  if (nivel === 5) return 4;
  return 10; // Sem prioridade definida
}

export function PrioridadeBadge({ pedido, className = "" }) {
  const cfg = getPrioridadeConfig(pedido);
  if (!cfg) return null;

  const { Icon, tag, badgeCls } = cfg;
  return (
    <Badge className={`gap-1 select-none ${badgeCls} ${className}`}>
      <Icon className="w-3 h-3 fill-current" />
      {tag}
    </Badge>
  );
}

export function SeletorPrioridadeDropdown({
  pedido,
  onSelectPrioridade,
  disabled = false,
  size = "sm",
  variant = "ghost",
  className = ""
}) {
  const nivelAtual = getPrioridadeNivel(pedido);
  const cfgAtual = getPrioridadeConfig(pedido);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={disabled}
          className={`text-xs h-7 px-2.5 gap-1.5 font-bold transition-all ${
            cfgAtual
              ? `${cfgAtual.cor} border border-current/20 bg-current/5 hover:bg-current/10`
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          } ${className}`}
          title="Definir nível de prioridade (P1 a P5)"
        >
          {cfgAtual ? (
            <>
              <cfgAtual.Icon className="w-3.5 h-3.5 fill-current" />
              <span>P{cfgAtual.nivel}</span>
            </>
          ) : (
            <>
              <Star className="w-3.5 h-3.5 text-slate-400" />
              <span>Prioridade</span>
            </>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1">
        <div className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
          Escolher Prioridade (1 a 5)
        </div>
        {NIVEIS_PRIORIDADE.map((p) => {
          const isAtivo = nivelAtual === p.nivel;
          const Icon = p.Icon;
          return (
            <DropdownMenuItem
              key={p.nivel}
              onClick={(e) => {
                e.stopPropagation();
                onSelectPrioridade(p.nivel);
              }}
              className={`flex items-center justify-between gap-2 text-xs py-2 px-2.5 cursor-pointer rounded-md ${
                p.menuCls
              } ${isAtivo ? "bg-slate-100 dark:bg-slate-800" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 fill-current" />
                <div>
                  <div className="font-bold leading-tight">{p.label}</div>
                  <div className="text-[10px] text-slate-400 font-normal">{p.desc}</div>
                </div>
              </div>
              {isAtivo && <span className="text-xs">✓</span>}
            </DropdownMenuItem>
          );
        })}
        {nivelAtual && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onSelectPrioridade(null);
              }}
              className="text-xs py-2 px-2.5 text-slate-500 hover:text-red-600 cursor-pointer flex items-center gap-2"
            >
              <Ban className="w-3.5 h-3.5" />
              Remover Prioridade
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}