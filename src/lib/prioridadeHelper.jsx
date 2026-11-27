import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Star, Ban, ChevronDown, Truck, Calendar, Clock, AlertTriangle } from "lucide-react";
import { format, addDays, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const STATUS_LOGISTICOS = {
  RETIRA_AGORA: "RETIRA_AGORA",
  ROTA: "ROTA",
  PRIORIDADE: "PRIORIDADE",
  NORMAL: null
};

export const NIVEIS_PRIORIDADE = [
  {
    nivel: "RETIRA_AGORA",
    label: "⚡ Cliente Retira Agora",
    tag: "⚡ CLIENTE RETIRA AGORA",
    desc: "1º Lugar Absoluto: Cliente no balcão da fábrica / retirando hoje",
    Icon: Zap,
    badgeCls: "bg-red-600 hover:bg-red-700 text-white border-2 border-red-300 shadow-md animate-pulse font-black text-xs ring-2 ring-red-500/50",
    menuCls: "text-red-700 dark:text-red-400 font-black focus:bg-red-100 dark:focus:bg-red-950/60",
    cor: "text-red-600 dark:text-red-400",
    peso: 0
  },
  {
    nivel: "ROTA",
    label: "🚚 Rota (Carga Agendada)",
    tag: "🚚 Rota",
    desc: "2º Lugar: Carga programada para caminhão de rota",
    Icon: Truck,
    badgeCls: "bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-400 shadow-sm font-black text-xs tracking-wide",
    menuCls: "text-indigo-600 dark:text-indigo-400 font-bold focus:bg-indigo-50 dark:focus:bg-indigo-950/40",
    cor: "text-indigo-600 dark:text-indigo-400",
    peso: 1
  },
  {
    nivel: "PRIORIDADE",
    label: "⭐ Prioridade (Prazo Fabril)",
    tag: "⭐ Prioridade",
    desc: "2º Lugar: Pedido avulso prioritário com compromisso de entrega",
    Icon: Star,
    badgeCls: "bg-amber-500 hover:bg-amber-600 text-white border border-amber-300 shadow-sm font-black text-xs tracking-wide",
    menuCls: "text-amber-600 dark:text-amber-400 font-bold focus:bg-amber-50 dark:focus:bg-amber-950/40",
    cor: "text-amber-500 dark:text-amber-400",
    peso: 2
  }
];

export function isPedidoRetiraAgora(pedido) {
  if (!pedido) return false;
  return Boolean(
    pedido.prioridade_nivel === "RETIRA_AGORA" ||
    pedido.tipo_prioridade === "RETIRA_AGORA" ||
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
    pedido.tipo_prioridade === "ROTA" ||
    pedido.is_rota === true ||
    pedido.rota === true ||
    pedido.carga_rota ||
    pedido.romaneio_id ||
    pedido.nome_rota
  );
}

/**
 * Identifica pedidos com Prioridade com Data (Prazo Fabril Prometido).
 * Conforme alinhado na transição:
 * - P1 e P2 legados são mapeados como "⭐ Prioridade"
 * - P3, P4 e P5 legados são tratados como fila Normal
 */
export function isPedidoPrioridadeComData(pedido) {
  if (!pedido) return false;
  if (isPedidoRetiraAgora(pedido) || isPedidoRota(pedido)) return false;
  return Boolean(
    pedido.prioridade_nivel === "PRIORIDADE" ||
    pedido.tipo_prioridade === "PRIORIDADE" ||
    pedido.prioridade_nivel === 1 ||
    pedido.prioridade_nivel === 2 ||
    pedido.prioridade_nivel === "1" ||
    pedido.prioridade_nivel === "2" ||
    pedido.prioridade === true ||
    pedido.prioridade === 1
  );
}

export function getPrioridadeNivel(pedido) {
  if (!pedido) return null;
  if (isPedidoRetiraAgora(pedido)) return "RETIRA_AGORA";
  if (isPedidoRota(pedido)) return "ROTA";
  if (isPedidoPrioridadeComData(pedido)) return "PRIORIDADE";
  return null;
}

export function getPrioridadeConfig(pedido) {
  const nivel = getPrioridadeNivel(pedido);
  if (!nivel) return null;
  return NIVEIS_PRIORIDADE.find(p => p.nivel === nivel) || null;
}

/**
 * 🔒 NOVA REGRA PCP:
 * Verifica se o pedido já teve sua prioridade classificada conscientemente pelo programador do PCP.
 * Nenhuma OP é distribuída para as máquinas sem prioridade definida (Retira Agora, Rota, Prioridade ou Normal).
 */
export function hasPrioridadeDefinida(pedido) {
  if (!pedido) return false;
  if (pedido.prioridade_selecionada === false) return false;
  if (pedido.prioridade_nivel === "SEM_PRIORIDADE" || pedido.tipo_prioridade === "SEM_PRIORIDADE" || pedido.prioridade_logistica === "SEM_PRIORIDADE") return false;
  if (pedido.prioridade_selecionada === true || pedido.prioridade_logistica_definida === true) return true;
  const nivel = pedido.prioridade_nivel || pedido.tipo_prioridade || pedido.prioridade_logistica;
  if (nivel === "RETIRA_AGORA" || nivel === "ROTA" || nivel === "PRIORIDADE" || nivel === "NORMAL" || nivel === "normal") return true;
  if (isPedidoRetiraAgora(pedido) || isPedidoRota(pedido) || isPedidoPrioridadeComData(pedido)) return true;
  return false;
}

/**
 * Normaliza qualquer valor de prioridade_nivel para o tipo aceito pelo banco Base44 (NUMBER 1..5 ou null).
 * Evita o erro fatal: "Error in field prioridade_nivel: Input should be a valid number, unable to parse string as a number".
 */
export function normalizarPrioridadeNivelNumerico(valor, fallbackTipo = null) {
  if (typeof valor === "number" && !isNaN(valor)) {
    return Math.max(1, Math.min(5, Math.round(valor)));
  }
  if (typeof valor === "string") {
    const num = parseInt(valor, 10);
    if (!isNaN(num) && num >= 1 && num <= 5) return num;
    const vUpper = valor.toUpperCase();
    if (vUpper === "RETIRA_AGORA") return 1;
    if (vUpper === "ROTA") return 2;
    if (vUpper === "PRIORIDADE") return 2;
    if (vUpper === "NORMAL") return null;
  }
  if (fallbackTipo) {
    const tUpper = String(fallbackTipo).toUpperCase();
    if (tUpper === "RETIRA_AGORA") return 1;
    if (tUpper === "ROTA") return 2;
    if (tUpper === "PRIORIDADE") return 2;
  }
  return null;
}

/**
 * Monta o payload padronizado de campos para salvar a prioridade no Pedido/OP.
 * 🛡️ REGRA CRÍTICA DO SCHEMA BASE44:
 * `prioridade_nivel` DEVE ser NUMBER (1..5) ou null. NUNCA passar string neste campo!
 * O rótulo em texto fica em `prioridade_logistica` e `tipo_prioridade`.
 */
export function montarUpdatesPrioridade(tipo, dataProgramada) {
  if (tipo === "RETIRA_AGORA") {
    return {
      prioridade_nivel: 1,
      tipo_prioridade: "RETIRA_AGORA",
      prioridade_logistica: "RETIRA_AGORA",
      prioridade_selecionada: true,
      prioridade_logistica_definida: true,
      cliente_retira_agora: true,
      cliente_retira: true,
      retira_agora: true,
      is_rota: false,
      rota: false,
      prioridade: true,
      data_programada_pcp: null
    };
  }
  if (tipo === "ROTA") {
    return {
      prioridade_nivel: 2,
      tipo_prioridade: "ROTA",
      prioridade_logistica: "ROTA",
      prioridade_selecionada: true,
      prioridade_logistica_definida: true,
      is_rota: true,
      rota: true,
      cliente_retira_agora: false,
      cliente_retira: false,
      retira_agora: false,
      prioridade: false,
      data_programada_pcp: dataProgramada || null,
      data_carregamento_rota: dataProgramada || null
    };
  }
  if (tipo === "PRIORIDADE") {
    return {
      prioridade_nivel: 2,
      tipo_prioridade: "PRIORIDADE",
      prioridade_logistica: "PRIORIDADE",
      prioridade_selecionada: true,
      prioridade_logistica_definida: true,
      prioridade: true,
      is_rota: false,
      rota: false,
      cliente_retira_agora: false,
      cliente_retira: false,
      retira_agora: false,
      data_programada_pcp: dataProgramada || null,
      data_prontidao: dataProgramada || null
    };
  }
  // NORMAL (Fila Padrão consciente)
  return {
    prioridade_nivel: null,
    tipo_prioridade: "NORMAL",
    prioridade_logistica: "NORMAL",
    prioridade_selecionada: true,
    prioridade_logistica_definida: true,
    prioridade: false,
    cliente_retira_agora: false,
    cliente_retira: false,
    retira_agora: false,
    is_rota: false,
    rota: false,
    data_programada_pcp: null
  };
}

/**
 * Extrai a data programada do PCP (data de carregamento da rota ou de prontidão).
 */
export function getDataProgramadaPcp(pedido) {
  if (!pedido) return null;
  const presets = pedido._presets || {};
  const raw = pedido.data_programada_pcp ||
              pedido.data_carregamento_rota ||
              pedido.data_prontidao ||
              pedido.data_entrega ||
              pedido.data_previsao_fabrica ||
              pedido.data_prevista ||
              pedido.data ||
              presets.data_entrega ||
              presets.data_prevista ||
              presets.data ||
              pedido.data_pedido ||
              null;
  if (!raw) return null;
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
 * Formata data ISO (YYYY-MM-DD) para formato amigável para badge:
 * Ex: "19/11 (Quinta-feira)" ou "18/11 (Hoje • Quarta-feira)"
 */
export function formatarDataProgramadaAmigavel(dataIso) {
  if (!dataIso) return "";
  try {
    const s = String(dataIso).slice(0, 10);
    const partes = s.split("-");
    if (partes.length !== 3) return s;
    const y = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10);
    const d = parseInt(partes[2], 10);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    if (isNaN(date.getTime())) return s;

    const diaMes = format(date, "dd/MM", { locale: ptBR });
    const diaSemanaRaw = format(date, "EEEE", { locale: ptBR });
    const diaSemana = diaSemanaRaw.charAt(0).toUpperCase() + diaSemanaRaw.slice(1);

    if (isToday(date)) {
      return `${diaMes} (${diaSemana})`;
    }
    if (isTomorrow(date)) {
      return `${diaMes} (${diaSemana})`;
    }
    return `${diaMes} (${diaSemana})`;
  } catch {
    return String(dataIso);
  }
}

/**
 * Retorna o peso geral de ordenação:
 * 0: Cliente Retira Agora (1º lugar absoluto)
 * 1: Rota / Prioridade com data programada (2º lugar unificado)
 * 10: Pedidos Normais (3º lugar)
 */
export function getPesoOrdenacaoPrioridade(pedido) {
  if (!pedido) return 10;
  if (isPedidoRetiraAgora(pedido)) return 0;
  if (isPedidoRota(pedido) || isPedidoPrioridadeComData(pedido)) return 1;
  return 10;
}

/**
 * Extrai a data de entrega / previsão fabril em formato ISO comparável (YYYY-MM-DD).
 */
export function getDataEntregaParaOrdenacao(pedido) {
  if (!pedido) return "9999-99-99";
  const presets = pedido._presets || {};
  const raw = pedido.data_programada_pcp ||
              pedido.data_entrega ||
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
 * 🎯 COMPARADOR OFICIAL DA FILA DAS MÁQUINAS (Hierarquia Estrita AJL):
 * 1º Lugar Absoluto: Todos os pedidos com "⚡ Cliente Retira Agora"
 * 2º Lugar (Fila Unificada por Data Programada):
 *    - Todos os pedidos de Rota e Prioridade organizados cronologicamente
 *      pela data programada pelo PCP (da mais próxima para a mais distante).
 *    - No mesmo dia: Rota primeiro (caminhões têm horário fixo de saída), depois Prioridade.
 * 3º Lugar: Pedidos Normais sem data programada (ordem de chegada FIFO / data entrega).
 */
export function compararPrioridadeEData(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  // 1º Lugar Absoluto: Cliente Retira Agora
  const retiraA = isPedidoRetiraAgora(a);
  const retiraB = isPedidoRetiraAgora(b);
  if (retiraA && !retiraB) return -1;
  if (!retiraA && retiraB) return 1;
  if (retiraA && retiraB) {
    const dA = getDataEntregaParaOrdenacao(a);
    const dB = getDataEntregaParaOrdenacao(b);
    if (dA !== dB) return dA.localeCompare(dB);
    return 0;
  }

  // 2º Lugar: Fila Unificada de Rota e Prioridade por Data Programada
  const progA = isPedidoRota(a) || isPedidoPrioridadeComData(a);
  const progB = isPedidoRota(b) || isPedidoPrioridadeComData(b);

  if (progA && !progB) return -1;
  if (!progA && progB) return 1;

  if (progA && progB) {
    const dataA = getDataProgramadaPcp(a) || getDataEntregaParaOrdenacao(a) || "9999-99-99";
    const dataB = getDataProgramadaPcp(b) || getDataEntregaParaOrdenacao(b) || "9999-99-99";

    // Cronológico ascendente: data mais próxima primeiro
    if (dataA !== dataB) {
      return dataA.localeCompare(dataB);
    }

    // MESMO DIA: Rota primeiro (caminhão agendado), depois Prioridade
    const rotaA = isPedidoRota(a);
    const rotaB = isPedidoRota(b);
    if (rotaA && !rotaB) return -1;
    if (!rotaA && rotaB) return 1;

    // Desempate secundário estável
    const metrosA = a.metros || a.total_metros || 0;
    const metrosB = b.metros || b.total_metros || 0;
    if (metrosB !== metrosA) return metrosB - metrosA;
    return 0;
  }

  // 3º Lugar: Pedidos Normais
  const dataA = getDataEntregaParaOrdenacao(a);
  const dataB = getDataEntregaParaOrdenacao(b);
  if (dataA !== dataB) {
    return dataA.localeCompare(dataB);
  }
  const metrosA = a.metros || a.total_metros || 0;
  const metrosB = b.metros || b.total_metros || 0;
  return metrosB - metrosA;
}

/**
 * 🏷️ Classifica a relação de data do pedido com o dia selecionado na máquina:
 * 1. RETIRA (Cliente Retira no Balcão) -> 1º Lugar Absoluto
 * 2. ATRASADO (Dias anteriores a selectedDay) -> 2º Lugar
 * 3. HOJE (data === selectedDay) -> 3º Lugar
 * 4. D_MAIS_1 (data === selectedDay + 1 dia) -> 4º Lugar
 * 5. SEM_DATA (atribuído à máquina mas sem agendamento no PCP) -> 5º Lugar
 */
export function classificarCategoriaDiaPedido(pedido, selectedDay) {
  if (!pedido) return null;
  const hoje = selectedDay || format(new Date(), "yyyy-MM-dd");

  let diaSeguinte = hoje;
  try {
    diaSeguinte = format(addDays(new Date(hoje + "T12:00:00"), 1), "yyyy-MM-dd");
  } catch {
    diaSeguinte = hoje;
  }

  // 1. Cliente Retira Balcão
  if (isPedidoRetiraAgora(pedido)) {
    return {
      categoria: "RETIRA",
      label: "⚡ RETIRA BALCÃO",
      badgeCls: "bg-red-600 text-white border-red-500 shadow-sm animate-pulse font-black",
      pesoVisual: 1
    };
  }

  const dataRaw = getDataProgramadaPcp(pedido) || (pedido.data ? String(pedido.data).slice(0, 10) : "") || (pedido.data_entrega ? String(pedido.data_entrega).slice(0, 10) : "");
  const dataLimpa = dataRaw ? dataRaw.slice(0, 10) : "";

  // 🔒 REGRA AJL: Se o pedido ainda está SEM PRIORIDADE definida pelo PCP, o badge principal DEVE estampar "⚠️ SEM PRIORIDADE"!
  if (!hasPrioridadeDefinida(pedido)) {
    let diaMes = "";
    if (dataLimpa) {
      try {
        const p = dataLimpa.split("-");
        if (p.length === 3) diaMes = ` (${p[2]}/${p[1]})`;
      } catch {}
    }
    return {
      categoria: "SEM_PRIORIDADE",
      label: `⚠️ SEM PRIORIDADE${diaMes}`,
      badgeCls: "bg-amber-500 text-slate-950 border-amber-600 shadow-sm font-black tracking-wide",
      pesoVisual: 99
    };
  }

  // 5. Sem Data Definida
  if (!dataLimpa || dataLimpa === "") {
    return {
      categoria: "SEM_DATA",
      label: "⏳ SEM DATA PCP",
      badgeCls: "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 font-semibold",
      pesoVisual: 5
    };
  }

  // 2. Atrasado (Dias Anteriores)
  if (dataLimpa < hoje) {
    let diaMes = dataLimpa;
    try {
      const p = dataLimpa.split("-");
      if (p.length === 3) diaMes = `${p[2]}/${p[1]}`;
    } catch {}
    return {
      categoria: "ATRASADO",
      label: `🚨 ATRASADO (${diaMes})`,
      badgeCls: "bg-amber-600 text-white border-amber-500 shadow-sm font-black",
      pesoVisual: 2
    };
  }

  // 3. Hoje
  if (dataLimpa === hoje) {
    return {
      categoria: "HOJE",
      label: "📅 HOJE",
      badgeCls: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 border-emerald-400 font-bold",
      pesoVisual: 3
    };
  }

  // 4. D+1 (Amanhã / Antecipação)
  if (dataLimpa === diaSeguinte) {
    return {
      categoria: "D_MAIS_1",
      label: "⏩ D+1 (AMANHÃ)",
      badgeCls: "bg-blue-600/15 text-blue-800 dark:text-blue-300 border-blue-400 font-bold",
      pesoVisual: 4
    };
  }

  // Futuro além de D+1
  let diaMesFuturo = dataLimpa;
  try {
    const p = dataLimpa.split("-");
    if (p.length === 3) diaMesFuturo = `${p[2]}/${p[1]}`;
  } catch {}
  return {
    categoria: "FUTURO",
    label: `📅 ${diaMesFuturo}`,
    badgeCls: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 font-medium",
    pesoVisual: 6
  };
}

/**
 * 🏭 Checa se um item (Pedido ou Ordem CD) pertence à fila de exibição da máquina no dia selecionado:
 * - Pedidos do dia
 * - Dias anteriores (atrasados/pendentes que não foram concluídos)
 * - D+1 (dia seguinte, antecipação)
 * - Cliente retira balcão (sempre visível)
 * - Sem data cadastrada no PCP (atribuídos à máquina)
 * - Em produção ou pausados agora
 */
export function pertenceAFilaDaMaquinaNoDia(item, selectedDay, targetNorm = "", isConcluidoFn = null) {
  if (!item) return false;
  if (item.status === "cancelado" || item.status_pcp === "cancelado") return false;

  const hoje = selectedDay || format(new Date(), "yyyy-MM-dd");
  let diaSeguinte = hoje;
  try {
    diaSeguinte = format(addDays(new Date(hoje + "T12:00:00"), 1), "yyyy-MM-dd");
  } catch {
    diaSeguinte = hoje;
  }

  // Se já está concluído:
  const concluido = isConcluidoFn ? isConcluidoFn(item) : (item.status === "finalizado");
  if (concluido) {
    const dataConcl = item.data_finalizacao || item.data_perfilacao || (item.hora_perfilacao ? item.hora_perfilacao.slice(0, 10) : "");
    const dataItem = getDataProgramadaPcp(item) || (item.data ? String(item.data).slice(0, 10) : "");
    return dataConcl === hoje || dataItem === hoje;
  }

  // Se está ativo no momento (em produção ou pausado)
  if (item.status === "em_producao" || item.status === "pausado") return true;

  // 1. Cliente Retira Balcão
  if (isPedidoRetiraAgora(item)) return true;

  const dataItem = getDataProgramadaPcp(item) || (item.data ? String(item.data).slice(0, 10) : "");

  // 2. Pedido do dia selecionado
  if (dataItem === hoje) return true;
  if (item.data_perfilacao === hoje) return true;
  if (item.hora_perfilacao && item.hora_perfilacao.startsWith(hoje)) return true;

  // 3. Atrasados / Dias anteriores
  if (dataItem && dataItem < hoje) return true;

  // 4. D+1 (Amanhã)
  if (dataItem === diaSeguinte) return true;

  // 5. Sem data definida na Central PCP
  if (!dataItem || dataItem === "") return true;

  return false;
}

/**
 * 🎯 Comparador hierárquico oficial AJL para a fila da máquina:
 * 1º: Status ativo imediato (em_producao, pausado)
 * 2º: 🔒 Regra de Ouro: Pedidos SEM PRIORIDADE (não classificados pelo PCP) vão para o FINAL ABSOLUTO da fila
 * 3º: Categoria do Dia (Retira -> Atrasados -> Hoje -> D+1 -> Sem Data)
 * 4º: Prioridade Logística AJL (Rotas agendadas -> Prioridade com data -> FIFO)
 */
export function compararFilaMaquinaAJL(a, b, selectedDay) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  // 1º Lugar Absoluto: Status ativo imediato na máquina (em_producao em 1º, depois pausado)
  const orderAtivo = { em_producao: 0, pausado: 1 };
  const stA = orderAtivo[a.status] ?? 2;
  const stB = orderAtivo[b.status] ?? 2;
  if (stA !== stB && (stA <= 1 || stB <= 1)) return stA - stB;

  // 🔒 REGRA DE OURO AJL:
  // Pedidos SEM PRIORIDADE definida conscientemente pelo PCP (com o aviso "⚠️ Sem Prioridade")
  // DEVEM IR PARA O FINAL ABSOLUTO DA FILA da máquina, mesmo se tiverem data anterior ou de hoje!
  const temPrioA = hasPrioridadeDefinida(a);
  const temPrioB = hasPrioridadeDefinida(b);
  if (temPrioA && !temPrioB) return -1;
  if (!temPrioA && temPrioB) return 1;

  // 2º Lugar: Categoria do Dia (Retira -> Atrasados -> Hoje -> D+1 -> Sem Data)
  const catA = classificarCategoriaDiaPedido(a, selectedDay);
  const catB = classificarCategoriaDiaPedido(b, selectedDay);
  const pA = catA?.pesoVisual ?? 99;
  const pB = catB?.pesoVisual ?? 99;

  if (pA !== pB) {
    return pA - pB;
  }

  return compararPrioridadeEData(a, b);
}

/**
 * Badge de Categoria de Dia para Cards de Máquina (Exibe "⚡ RETIRA BALCÃO", "🚨 ATRASADO (24/11)", "📅 HOJE", "⏩ D+1 (AMANHÃ)", "⏳ SEM DATA PCP")
 */
export function CategoriaDiaBadge({ pedido, selectedDay, className = "" }) {
  const info = classificarCategoriaDiaPedido(pedido, selectedDay);
  if (!info) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] md:text-xs border tracking-tight uppercase ${info.badgeCls} ${className}`}>
      {info.label}
    </span>
  );
}

/**
 * Badge de Prioridade de Alta Visibilidade para Tablets de Máquina e Telas do PCP
 */
export function PrioridadeBadge({ pedido, prioridade, dataProgramada, className = "" }) {
  const p = pedido || (prioridade ? { prioridade_nivel: prioridade, data_programada_pcp: dataProgramada } : null);
  if (!p) return null;

  if (isPedidoRetiraAgora(p)) {
    return (
      <Badge className={`gap-1 select-none bg-red-600 hover:bg-red-700 text-white border-2 border-red-300 shadow-md animate-pulse font-black text-xs ring-2 ring-red-500/50 ${className}`}>
        <Zap className="w-3.5 h-3.5 fill-current text-amber-300 animate-bounce" />
        ⚡ CLIENTE RETIRA AGORA
      </Badge>
    );
  }

  if (isPedidoRota(p)) {
    const dataIso = dataProgramada || getDataProgramadaPcp(p);
    const dataFmt = formatarDataProgramadaAmigavel(dataIso);
    return (
      <Badge className={`gap-1 select-none bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-400 shadow-sm font-black text-xs tracking-wide ${className}`}>
        <Truck className="w-3.5 h-3.5 shrink-0" />
        <span>🚚 Rota{dataFmt ? ` • Carregar: ${dataFmt}` : ""}</span>
      </Badge>
    );
  }

  if (isPedidoPrioridadeComData(p)) {
    const dataIso = dataProgramada || getDataProgramadaPcp(p);
    const dataFmt = formatarDataProgramadaAmigavel(dataIso);
    return (
      <Badge className={`gap-1 select-none bg-amber-500 hover:bg-amber-600 text-white border border-amber-300 shadow-sm font-black text-xs tracking-wide ${className}`}>
        <Star className="w-3.5 h-3.5 fill-current shrink-0" />
        <span>⭐ Prioridade{dataFmt ? ` • Pronto: ${dataFmt}` : ""}</span>
      </Badge>
    );
  }

  // Normal selecionado conscientemente
  if (p?.prioridade_selecionada && (p?.prioridade_nivel === "NORMAL" || p?.prioridade_logistica === "NORMAL")) {
    return (
      <Badge variant="outline" className={`gap-1 select-none font-bold text-xs text-slate-600 dark:text-slate-300 border-slate-300 bg-slate-50 dark:bg-slate-900 ${className}`}>
        <span>⚪ Normal (Padrão)</span>
      </Badge>
    );
  }

  // Sem prioridade definida
  if (!hasPrioridadeDefinida(p)) {
    return (
      <Badge className={`gap-1 select-none font-black text-xs text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 border border-amber-400 animate-pulse ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>⚠️ Sem Prioridade</span>
      </Badge>
    );
  }

  return null;
}

/**
 * Banner de Destaque Visual para o topo do Card do Operador da Máquina
 */
export function BannerPrioridadeDestaque({ pedido, className = "" }) {
  if (!pedido) return null;
  const isRetira = isPedidoRetiraAgora(pedido);
  const isRota = isPedidoRota(pedido);
  const isPrioridade = isPedidoPrioridadeComData(pedido);

  if (isRetira) {
    return (
      <div
        className={`bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black text-xs px-3.5 py-2 rounded-lg flex items-center justify-between shadow-lg mb-2.5 animate-pulse border-2 border-red-300 ring-2 ring-red-500/60 select-none ${className}`}
      >
        <span className="flex items-center gap-2">
          <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-bounce" />
          <span className="tracking-wider uppercase font-black text-xs sm:text-sm drop-shadow-sm">
            ⚡ CLIENTE RETIRA AGORA — PRIORIDADE ABSOLUTA (NO BALCÃO)
          </span>
        </span>
        <span className="text-[10px] bg-black/40 text-amber-200 px-2.5 py-0.5 rounded font-mono font-black uppercase tracking-widest border border-amber-300/40 shrink-0">
          1º LUGAR
        </span>
      </div>
    );
  }

  if (isRota) {
    const dataIso = getDataProgramadaPcp(pedido);
    const dataFmt = formatarDataProgramadaAmigavel(dataIso);
    return (
      <div
        className={`bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center justify-between shadow-sm mb-2 border border-indigo-400/40 select-none ${className}`}
      >
        <span className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-200 shrink-0" />
          <span className="tracking-wide uppercase font-black text-xs">
            🚚 PEDIDO DE ROTA — CARGA PROGRAMADA: {dataFmt || "SEM DATA"}
          </span>
        </span>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-black uppercase tracking-wider shrink-0">
          ROTA
        </span>
      </div>
    );
  }

  if (isPrioridade) {
    const dataIso = getDataProgramadaPcp(pedido);
    const dataFmt = formatarDataProgramadaAmigavel(dataIso);
    return (
      <div
        className={`bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center justify-between shadow-sm mb-2 border border-amber-300/40 select-none ${className}`}
      >
        <span className="flex items-center gap-2">
          <Star className="w-4 h-4 fill-current text-amber-200 shrink-0" />
          <span className="tracking-wide uppercase font-black text-xs">
            ⭐ PEDIDO PRIORITÁRIO — PRONTIDÃO: {dataFmt || "SEM DATA"}
          </span>
        </span>
        <span className="text-[10px] bg-black/25 text-amber-100 px-2 py-0.5 rounded font-mono font-black uppercase tracking-wider shrink-0">
          PRIORIDADE
        </span>
      </div>
    );
  }

  return null;
}

export function getCardPrioridadeClasses(pedido) {
  if (!pedido) return "";
  if (isPedidoRetiraAgora(pedido)) {
    return "ring-2 ring-red-500 border-2 border-red-500 bg-red-50/40 dark:bg-red-950/30 shadow-lg shadow-red-500/15";
  }
  if (isPedidoRota(pedido)) {
    return "ring-1 ring-indigo-400/60 border-l-4 border-l-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20";
  }
  if (isPedidoPrioridadeComData(pedido)) {
    return "ring-1 ring-amber-400/60 border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/20";
  }
  return "";
}

/**
 * Gera lista de atalhos rápidos de datas (Hoje, Amanhã, Depois de Amanhã e próximos dias da semana)
 */
function gerarAtalhosDeDatas() {
  const hoje = new Date();
  const opcoes = [];

  // 1. Hoje
  opcoes.push({
    iso: format(hoje, "yyyy-MM-dd"),
    label: `Hoje (${format(hoje, "dd/MM")})`,
    destaque: true
  });

  // 2. Amanhã
  const amanha = addDays(hoje, 1);
  const diaSemAmanha = format(amanha, "EEEE", { locale: ptBR });
  opcoes.push({
    iso: format(amanha, "yyyy-MM-dd"),
    label: `Amanhã (${format(amanha, "dd/MM")} • ${diaSemAmanha.charAt(0).toUpperCase() + diaSemAmanha.slice(1)})`,
    destaque: true
  });

  // 3. Depois de Amanhã
  const depois = addDays(hoje, 2);
  const diaSemDepois = format(depois, "EEEE", { locale: ptBR });
  opcoes.push({
    iso: format(depois, "yyyy-MM-dd"),
    label: `Depois de Amanhã (${format(depois, "dd/MM")} • ${diaSemDepois.charAt(0).toUpperCase() + diaSemDepois.slice(1)})`,
    destaque: false
  });

  // 4. Próximos 3 dias úteis subsequentes
  for (let i = 3; i <= 6; i++) {
    const d = addDays(hoje, i);
    const sem = format(d, "EEEE", { locale: ptBR });
    opcoes.push({
      iso: format(d, "yyyy-MM-dd"),
      label: `${format(d, "dd/MM")} (${sem.charAt(0).toUpperCase() + sem.slice(1)})`,
      destaque: false
    });
  }

  return opcoes;
}

/**
 * ⚡ SELETOR RÁPIDO DO PCP (Dropdown com Atalhos de Data em 2 Cliques)
 * - Ao clicar em "Cliente Retira Agora", salva imediatamente
 * - Ao clicar em "Rota" ou "Prioridade", abre submenu de atalhos rápidos de data:
 *   [Hoje] [Amanhã] [Depois de Amanhã / Dias da Semana] [📅 Escolher no Calendário]
 */
export function SeletorPrioridadeDropdown({
  pedido,
  onSelectPrioridade,
  disabled = false,
  size = "sm",
  variant = "ghost",
  className = ""
}) {
  const nivelAtual = getPrioridadeNivel(pedido);
  const dataAtual = getDataProgramadaPcp(pedido);
  const dataFmtCurta = dataAtual ? format(new Date(dataAtual + "T12:00:00"), "dd/MM") : "";

  const [modalCustomDateOpen, setModalCustomDateOpen] = useState(false);
  const [modalTipo, setModalTipo] = useState("ROTA"); // ROTA ou PRIORIDADE
  const [customDateValue, setCustomDateValue] = useState(format(new Date(), "yyyy-MM-dd"));

  const atalhosData = gerarAtalhosDeDatas();

  const isDefinida = hasPrioridadeDefinida(pedido);
  const isNormalDefinido = isDefinida && (pedido?.prioridade_nivel === "NORMAL" || pedido?.prioridade_logistica === "NORMAL");

  const getLabelTrigger = () => {
    if (nivelAtual === "RETIRA_AGORA") return "⚡ Retira Agora";
    if (nivelAtual === "ROTA") return `🚚 Rota${dataFmtCurta ? ` • ${dataFmtCurta}` : ""}`;
    if (nivelAtual === "PRIORIDADE") return `⭐ Prioridade${dataFmtCurta ? ` • ${dataFmtCurta}` : ""}`;
    if (isNormalDefinido) return "⚪ Normal (Padrão)";
    return "⚠️ Definir Prioridade";
  };

  const abrirSeletorCustom = (tipo) => {
    setModalTipo(tipo);
    setCustomDateValue(dataAtual || format(new Date(), "yyyy-MM-dd"));
    setModalCustomDateOpen(true);
  };

  const handleConfirmarCustomDate = () => {
    if (customDateValue) {
      onSelectPrioridade(modalTipo, customDateValue);
    }
    setModalCustomDateOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={size}
            variant={variant}
            disabled={disabled}
            className={`text-xs h-7 px-2.5 gap-1.5 font-bold transition-all ${
              nivelAtual === "RETIRA_AGORA"
                ? "bg-red-600 text-white border-2 border-red-300 hover:bg-red-700 shadow-md animate-pulse font-black"
                : nivelAtual === "ROTA"
                ? "bg-indigo-600 text-white border border-indigo-400 hover:bg-indigo-700 shadow-sm font-bold"
                : nivelAtual === "PRIORIDADE"
                ? "bg-amber-500 text-white border border-amber-300 hover:bg-amber-600 shadow-sm font-bold"
                : isNormalDefinido
                ? "border border-slate-300 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                : "border-2 border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 font-black animate-pulse"
            } ${className}`}
            title={!isDefinida ? "⚠️ Prioridade obrigatória antes de distribuir para as máquinas" : "Definir status logístico (Cliente Retira, Rota com Data ou Prioridade com Data)"}
          >
            {nivelAtual === "RETIRA_AGORA" ? (
              <Zap className="w-3.5 h-3.5 fill-current" />
            ) : nivelAtual === "ROTA" ? (
              <Truck className="w-3.5 h-3.5" />
            ) : nivelAtual === "PRIORIDADE" ? (
              <Star className="w-3.5 h-3.5 fill-current" />
            ) : !isDefinida ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-400" />
            )}
            <span>{getLabelTrigger()}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72 p-1.5 shadow-xl">
          <div className="px-2 py-1 text-[11px] font-black text-slate-400 uppercase tracking-wider">
            Status Logístico do PCP
          </div>

          {/* 1. ⚡ Cliente Retira Agora (1 Clique direto) */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onSelectPrioridade("RETIRA_AGORA", null);
            }}
            className={`flex items-center justify-between gap-2 text-xs py-2 px-2.5 cursor-pointer rounded-md text-red-700 dark:text-red-400 font-black focus:bg-red-50 dark:focus:bg-red-950/40 ${
              nivelAtual === "RETIRA_AGORA" ? "bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 fill-current text-red-600 animate-bounce" />
              <div>
                <div className="font-black leading-tight text-red-600 dark:text-red-400">⚡ Cliente Retira Agora</div>
                <div className="text-[10px] text-slate-400 font-normal">1º Lugar Absoluto (Balcão da fábrica)</div>
              </div>
            </div>
            {nivelAtual === "RETIRA_AGORA" && <span className="text-xs font-black">✓</span>}
          </DropdownMenuItem>

          {/* 2. 🚚 Rota (Carga Agendada com Data de Carregamento) */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={`flex items-center justify-between gap-2 text-xs py-2 px-2.5 cursor-pointer rounded-md text-indigo-700 dark:text-indigo-400 font-bold focus:bg-indigo-50 dark:focus:bg-indigo-950/40 ${
                nivelAtual === "ROTA" ? "bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <div className="text-left">
                  <div className="font-bold leading-tight">🚚 Rota (Carga Agendada)</div>
                  <div className="text-[10px] text-slate-400 font-normal">Definir data de carregamento →</div>
                </div>
              </div>
              {nivelAtual === "ROTA" && <span className="text-xs font-bold mr-1">✓</span>}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wide">
                <Calendar className="w-3.5 h-3.5" />
                Data de Carregamento
              </div>
              <DropdownMenuSeparator />
              {atalhosData.map((op) => (
                <DropdownMenuItem
                  key={`rota-${op.iso}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPrioridade("ROTA", op.iso);
                  }}
                  className={`text-xs py-1.5 px-2.5 cursor-pointer rounded-md flex items-center justify-between ${
                    op.destaque ? "font-bold text-indigo-950 dark:text-indigo-200" : "text-slate-600 dark:text-slate-300"
                  } ${nivelAtual === "ROTA" && dataAtual === op.iso ? "bg-indigo-100 dark:bg-indigo-950/80 font-black text-indigo-700" : ""}`}
                >
                  <span>{op.label}</span>
                  {nivelAtual === "ROTA" && dataAtual === op.iso && <span className="text-xs font-black">✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  abrirSeletorCustom("ROTA");
                }}
                className="text-xs py-2 px-2.5 cursor-pointer rounded-md text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
              >
                <Calendar className="w-3.5 h-3.5" />
                📅 Escolher no Calendário...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* 3. ⭐ Prioridade (Prazo Fabril Prometido com Data) */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={`flex items-center justify-between gap-2 text-xs py-2 px-2.5 cursor-pointer rounded-md text-amber-700 dark:text-amber-400 font-bold focus:bg-amber-50 dark:focus:bg-amber-950/40 ${
                nivelAtual === "PRIORIDADE" ? "bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-current text-amber-500" />
                <div className="text-left">
                  <div className="font-bold leading-tight">⭐ Prioridade (Prazo Fabril)</div>
                  <div className="text-[10px] text-slate-400 font-normal">Definir data de prontidão →</div>
                </div>
              </div>
              {nivelAtual === "PRIORIDADE" && <span className="text-xs font-bold mr-1">✓</span>}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                <Clock className="w-3.5 h-3.5" />
                Data de Prontidão
              </div>
              <DropdownMenuSeparator />
              {atalhosData.map((op) => (
                <DropdownMenuItem
                  key={`prio-${op.iso}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPrioridade("PRIORIDADE", op.iso);
                  }}
                  className={`text-xs py-1.5 px-2.5 cursor-pointer rounded-md flex items-center justify-between ${
                    op.destaque ? "font-bold text-amber-950 dark:text-amber-200" : "text-slate-600 dark:text-slate-300"
                  } ${nivelAtual === "PRIORIDADE" && dataAtual === op.iso ? "bg-amber-100 dark:bg-amber-950/80 font-black text-amber-700" : ""}`}
                >
                  <span>{op.label}</span>
                  {nivelAtual === "PRIORIDADE" && dataAtual === op.iso && <span className="text-xs font-black">✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  abrirSeletorCustom("PRIORIDADE");
                }}
                className="text-xs py-2 px-2.5 cursor-pointer rounded-md text-amber-600 dark:text-amber-400 font-bold flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/50"
              >
                <Calendar className="w-3.5 h-3.5" />
                📅 Escolher no Calendário...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* 4. ⚪ Fila Normal (Padrão / FIFO) */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onSelectPrioridade("NORMAL", null);
            }}
            className={`flex items-center justify-between gap-2 text-xs py-2 px-2.5 cursor-pointer rounded-md text-slate-700 dark:text-slate-300 font-semibold focus:bg-slate-100 dark:focus:bg-slate-800 ${
              isNormalDefinido ? "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              </div>
              <div className="text-left">
                <div className="font-bold leading-tight">⚪ Fila Normal (Padrão)</div>
                <div className="text-[10px] text-slate-400 font-normal">Sem prioridade forçada (ordem FIFO)</div>
              </div>
            </div>
            {isNormalDefinido && <span className="text-xs font-black">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modal Rápido para Escolha de Data no Calendário */}
      <Dialog open={modalCustomDateOpen} onOpenChange={setModalCustomDateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {modalTipo === "ROTA" ? (
                <>
                  <Truck className="w-5 h-5 text-indigo-600" />
                  <span>Definir Data de Carregamento (Rota)</span>
                </>
              ) : (
                <>
                  <Star className="w-5 h-5 text-amber-500 fill-current" />
                  <span>Definir Data de Prontidão (Prioridade)</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-xs text-slate-500">
              Escolha o dia em que este pedido deve ser{" "}
              {modalTipo === "ROTA" ? "carregado no caminhão de rota" : "entregue/pronto na fábrica"}:
            </p>
            <Input
              type="date"
              value={customDateValue}
              onChange={(e) => setCustomDateValue(e.target.value)}
              className="text-sm font-semibold"
            />
          </div>

          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalCustomDateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarCustomDate}
              className={modalTipo === "ROTA" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-amber-600 hover:bg-amber-700"}
            >
              Confirmar Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SeletorPrioridadeDropdown;
