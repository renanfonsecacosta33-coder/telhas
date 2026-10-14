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
import { Flame, Zap, Star, Shield, ArrowDown, Ban, ChevronDown, Truck } from "lucide-react";

export const NIVEIS_PRIORIDADE = [
  {
    nivel: "RETIRA_AGORA",
    label: "⚡🚨 Cliente Retira Agora",
    tag: "⚡🚨 RETIRA AGORA",
    desc: "1º Lugar Absoluto: Cliente esperando no balcão da fábrica",
    Icon: Zap,
    badgeCls: "bg-red-600 hover:bg-red-700 text-white border-2 border-red-300 shadow-md animate-pulse font-black text-xs ring-2 ring-red-500/50",
    menuCls: "text-red-700 dark:text-red-400 font-black focus:bg-red-100 dark:focus:bg-red-950/60",
    cor: "text-red-600 dark:text-red-400",
    peso: 0
  },
  {
    nivel: "ROTA",
    label: "🚚 Pedido de Rota",
    tag: "🚚 CARGA DE ROTA",
    desc: "2º Lugar: Carga programada para rota de entrega",
    Icon: Truck,
    badgeCls: "bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-400 shadow-sm font-black text-xs tracking-wide",
    menuCls: "text-indigo-600 dark:text-indigo-400 font-bold focus:bg-indigo-50 dark:focus:bg-indigo-950/40",
    cor: "text-indigo-600 dark:text-indigo-400",
    peso: 1
  },
  {
    nivel: 1,
    label: "P1 - Mais Urgente",
    tag: "P1 - URGENTE",
    desc: "3º Lugar: Prioridade Máxima (Urgente)",
    Icon: Flame,
    badgeCls: "bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-sm animate-pulse font-black text-xs",
    menuCls: "text-red-600 font-bold focus:bg-red-50 dark:focus:bg-red-950/40",
    cor: "text-red-600",
    peso: 2
  },
  {
    nivel: 2,
    label: "P2 - Alta",
    tag: "P2 - ALTA",
    desc: "4º Lugar: Alta prioridade de produção",
    Icon: Zap,
    badgeCls: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600 font-bold text-xs",
    menuCls: "text-orange-600 font-bold focus:bg-orange-50 dark:focus:bg-orange-950/40",
    cor: "text-orange-500",
    peso: 3
  },
  {
    nivel: 3,
    label: "P3 - Média",
    tag: "P3 - MÉDIA",
    desc: "5º Lugar: Prioridade intermediária",
    Icon: Star,
    badgeCls: "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 font-bold text-xs",
    menuCls: "text-amber-600 font-bold focus:bg-amber-50 dark:focus:bg-amber-950/40",
    cor: "text-amber-500",
    peso: 4
  },
  {
    nivel: 4,
    label: "P4 - Normal",
    tag: "P4 - NORMAL",
    desc: "6º Lugar: Fila padrão de produção",
    Icon: Shield,
    badgeCls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 font-semibold text-xs",
    menuCls: "text-blue-600 font-semibold focus:bg-blue-50 dark:focus:bg-blue-950/40",
    cor: "text-blue-500",
    peso: 5
  },
  {
    nivel: 5,
    label: "P5 - Baixa",
    tag: "P5 - BAIXA",
    desc: "7º Lugar: Produzir quando houver folga",
    Icon: ArrowDown,
    badgeCls: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-medium text-xs",
    menuCls: "text-slate-600 dark:text-slate-400 focus:bg-slate-50 dark:focus:bg-slate-900",
    cor: "text-slate-500",
    peso: 6
  }
];

export function isPedidoRetiraAgora(pedido) {
  if (!pedido) return false;
  return Boolean(
    pedido.prioridade_nivel === "RETIRA_AGORA" ||
    pedido.cliente_retira_agora === true ||
    pedido.retira_agora === true ||
    pedido.cliente_retira === true ||
    pedido.retira === true
  );
}

export function isPedidoRota(pedido) {
  if (!pedido) return false;
  if (isPedidoRetiraAgora(pedido)) return false;
  return Boolean(
    pedido.prioridade_nivel === "ROTA" ||
    pedido.is_rota === true ||
    pedido.rota === true ||
    pedido.carga_rota ||
    pedido.romaneio_id ||
    pedido.nome_rota
  );
}

export function getPrioridadeNivel(pedido) {
  if (!pedido) return null;
  // 1. Cliente Retira Agora em 1º lugar absoluto!
  if (isPedidoRetiraAgora(pedido)) {
    return "RETIRA_AGORA";
  }
  // 2. As Rotas em 2º lugar
  if (isPedidoRota(pedido)) {
    return "ROTA";
  }
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

/**
 * Escala Estrita de Prioridades das Máquinas AJL:
 * 1. Cliente Retira Agora (peso 0) -> Absoluto, cliente esperando no balcão da fábrica
 * 2. Pedidos de Rota (peso 1) -> Cargas agendadas para caminhão/logística
 * 3. P1 (peso 2) -> Mais Urgente
 * 4. P2 (peso 3) -> Alta
 * 5. P3 (peso 4) -> Média
 * 6. P4 (peso 5) -> Normal
 * 7. P5 (peso 6) -> Baixa
 * 8. Sem prioridade explícita (peso 10 -> desempate por data de entrega mais próxima)
 */
export function getPesoOrdenacaoPrioridade(pedido) {
  const nivel = getPrioridadeNivel(pedido);
  if (nivel === "RETIRA_AGORA") return 0;
  if (nivel === "ROTA") return 1;
  if (nivel === 1) return 2;
  if (nivel === 2) return 3;
  if (nivel === 3) return 4;
  if (nivel === 4) return 5;
  if (nivel === 5) return 6;
  return 10;
}

/**
 * Extrai a data de entrega / previsão fabril em formato ISO comparável (YYYY-MM-DD).
 */
export function getDataEntregaParaOrdenacao(pedido) {
  if (!pedido) return "9999-99-99";
  const presets = pedido._presets || {};
  const raw = pedido.data_entrega ||
              pedido.data_previsao_fabrica ||
              pedido.data_prevista ||
              presets.data_entrega ||
              presets.data_prevista ||
              pedido.data ||
              presets.data ||
              pedido.data_pedido ||
              "";
  if (!raw) return "9999-99-99";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  const mBr = String(raw).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (mBr) {
    return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
  }
  return String(raw).slice(0, 10);
}

/**
 * Comparador Oficial da Fila das Máquinas AJL:
 * 1. as rotas
 * 2. P1
 * 3. P2
 * 4. P3
 * 5. P4
 * 6. P5
 * 7. Por data mais próxima de entrega (crescente: atrasadas e mais próximas primeiro)
 */
export function compararPrioridadeEData(a, b) {
  const priA = getPesoOrdenacaoPrioridade(a);
  const priB = getPesoOrdenacaoPrioridade(b);
  if (priA !== priB) {
    return priA - priB;
  }
  // Desempate obrigatório por data mais próxima de entrega:
  const dataA = getDataEntregaParaOrdenacao(a);
  const dataB = getDataEntregaParaOrdenacao(b);
  if (dataA !== dataB) {
    return dataA.localeCompare(dataB);
  }
  // Desempate estável secundário
  const metrosA = a.metros || a.total_metros || 0;
  const metrosB = b.metros || b.total_metros || 0;
  return metrosB - metrosA;
}

export function PrioridadeBadge({ pedido, prioridade, className = "" }) {
  const p = pedido || (prioridade ? { prioridade_nivel: prioridade } : null);
  const cfg = getPrioridadeConfig(p);
  if (!cfg) return null;

  const { Icon, tag, badgeCls } = cfg;
  return (
    <Badge className={`gap-1 select-none ${badgeCls} ${className}`}>
      <Icon className="w-3 h-3 fill-current" />
      {tag}
    </Badge>
  );
}

/**
 * Banner de Destaque Visual para Pedidos de Altíssimo Impacto:
 * - ⚡🚨 CLIENTE RETIRA AGORA: Banner pulsante neon vermelho-fogo no topo do card
 * - 🚚 PEDIDO DE ROTA: Banner azul-índigo com caminhão de carga agendada
 */
export function BannerPrioridadeDestaque({ pedido, className = "" }) {
  if (!pedido) return null;
  const isRetira = isPedidoRetiraAgora(pedido);
  const isRota = isPedidoRota(pedido);

  if (isRetira) {
    return (
      <div
        className={`bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black text-xs px-3.5 py-2 rounded-lg flex items-center justify-between shadow-lg mb-2.5 animate-pulse border-2 border-red-300 ring-2 ring-red-500/60 select-none ${className}`}
      >
        <span className="flex items-center gap-2">
          <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-bounce" />
          <span className="tracking-wider uppercase font-black text-xs sm:text-sm drop-shadow-sm">
            ⚡🚨 CLIENTE RETIRA AGORA — PRIORIDADE ABSOLUTA (NO BALCÃO)
          </span>
        </span>
        <span className="text-[10px] bg-black/40 text-amber-200 px-2.5 py-0.5 rounded font-mono font-black uppercase tracking-widest border border-amber-300/40 shrink-0">
          1º LUGAR
        </span>
      </div>
    );
  }

  if (isRota) {
    return (
      <div
        className={`bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center justify-between shadow-sm mb-2 border border-indigo-400/40 select-none ${className}`}
      >
        <span className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-200 shrink-0" />
          <span className="tracking-wide uppercase font-black text-xs">
            🚚 PEDIDO DE ROTA — CARGA PROGRAMADA PARA EXPEDIÇÃO
          </span>
        </span>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-black uppercase tracking-wider shrink-0">
          2º LUGAR
        </span>
      </div>
    );
  }

  return null;
}

/**
 * Retorna classes CSS de contorno e fundo para os cards externos
 */
export function getCardPrioridadeClasses(pedido) {
  if (!pedido) return "";
  if (isPedidoRetiraAgora(pedido)) {
    return "ring-2 ring-red-500 border-2 border-red-500 bg-red-50/40 dark:bg-red-950/30 shadow-lg shadow-red-500/15";
  }
  if (isPedidoRota(pedido)) {
    return "ring-1 ring-indigo-400/60 border-l-4 border-l-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20";
  }
  return "";
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

  const getLabelTrigger = () => {
    if (!cfgAtual) return "Prioridade";
    if (cfgAtual.nivel === "RETIRA_AGORA") return "⚡ Retira Agora";
    if (cfgAtual.nivel === "ROTA") return "🚚 Rota";
    return `P${cfgAtual.nivel}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={disabled}
          className={`text-xs h-7 px-2.5 gap-1.5 font-bold transition-all ${
            cfgAtual
              ? cfgAtual.nivel === "RETIRA_AGORA"
                ? "bg-red-600 text-white border-2 border-red-300 hover:bg-red-700 shadow-md animate-pulse font-black"
                : cfgAtual.nivel === "ROTA"
                ? "bg-indigo-600 text-white border border-indigo-400 hover:bg-indigo-700 shadow-sm font-bold"
                : `${cfgAtual.cor} border border-current/20 bg-current/5 hover:bg-current/10`
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          } ${className}`}
          title="Definir nível de prioridade (Retira Agora, Rota, P1 a P5)"
        >
          {cfgAtual ? (
            <>
              <cfgAtual.Icon className="w-3.5 h-3.5 fill-current" />
              <span>{getLabelTrigger()}</span>
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
      <DropdownMenuContent align="end" className="w-64 p-1">
        <div className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
          Escolher Prioridade / Rota
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