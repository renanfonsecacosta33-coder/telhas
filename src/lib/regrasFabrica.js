// Regras Industriais de Fábrica — utilitários centrais
// Implementa as 7 regras industriais (SLA, Prioridade PIN, Trava de fila, Roteamento, Capacidade, Checklist, Financeiros)

import { diasUteisRestantes } from "@/lib/sla";

// ════════════════════════════════════════════════════════════
// REGRA 1 + PIN: Senha do Gestor (PCP)
// ════════════════════════════════════════════════════════════
// A senha de liberação para alterar prioridade é "0000".
export const SENHA_GESTOR_PADRAO = "0000";

export function validarSenhaGestor(pin) {
  return String(pin || "").trim() === SENHA_GESTOR_PADRAO;
}

// ════════════════════════════════════════════════════════════
// REGRA 6: Contagem Regressiva de SLA em Dias Úteis
// ════════════════════════════════════════════════════════════
// Retorna { texto, tom } para exibir no card.
//  "⏱️ Faltam 4 dias úteis"
//  "⚠️ Vence amanhã!"   (1 dia)
//  "⏱️ Vence hoje!"     (0)
//  "🔴 ATRASADO 1 dia!"
export function slaCountdown(dataPrometida) {
  const r = diasUteisRestantes(dataPrometida);
  if (r < 0) {
    const dias = Math.abs(r);
    return {
      texto: `🔴 ATRASADO ${dias} ${dias === 1 ? "dia" : "dias"}!`,
      tom: "atrasado",
      dias: r,
    };
  }
  if (r === 0) return { texto: "⏱️ Vence hoje!", tom: "hoje", dias: 0 };
  if (r === 1) return { texto: "⚠️ Vence amanhã!", tom: "amanha", dias: 1 };
  return { texto: `⏱️ Faltam ${r} dias úteis`, tom: "normal", dias: r };
}

// Classe Tailwind (literal) para o badge de SLA
export function slaCountdownCls(tom) {
  switch (tom) {
    case "atrasado":
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40";
    case "hoje":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40";
    case "amanha":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40";
    default:
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40";
  }
}

// ════════════════════════════════════════════════════════════
// REGRA 3: Roteamento de Matéria-Prima (Bobina vs Chapa)
// ════════════════════════════════════════════════════════════
// Itens da categoria "CHAPA" → Desbobinadora (consome BOBINA).
// Demais itens de Corte & Dobra (Perfis, Calhas, Rufos) → consome CHAPA cortada.
export function isItemChapa(categoriaRaw) {
  const c = String(categoriaRaw || "").trim().toLowerCase();
  return c === "chapa" || c === "chapas";
}

export function roteamentoMaterial(categoriaRaw) {
  // Retorna { maquina, consome }
  if (isItemChapa(categoriaRaw)) {
    return { maquina: "DESBobINADEIRA", consome: "bobina", label: "Desbobinadora (Bobina)" };
  }
  return { maquina: "Corte & Dobra", consome: "chapa", label: "Guilhotina/Dobra (Chapa)" };
}

// ════════════════════════════════════════════════════════════
// REGRA 5: IA Assistente de Capacidade Diária (KG / Toneladas)
// ════════════════════════════════════════════════════════════
// Capacidade diária configurável (kg). Default 10.000 kg (10 ton).
export const CAPACIDADE_DIARIA_KG = 10000;

// Soma o peso total agendado para um dia específico.
// aceita ordens com campo peso_kg ou kg_estimado.
export function pesoAgendadoDia(ordens, dataISO) {
  return (ordens || [])
    .filter((o) => o.data === dataISO && o.status !== "cancelado" && o.status !== "finalizado")
    .reduce((s, o) => s + (Number(o.peso_kg) || Number(o.kg_estimado) || 0), 0);
}

// Avalia capacidade: { pesoAtual, capacidade, excedente, percentual, aviso }
export function avaliarCapacidade(ordens, dataISO, capacidade = CAPACIDADE_DIARIA_KG) {
  const pesoAtual = pesoAgendadoDia(ordens, dataISO);
  const percentual = capacidade > 0 ? Math.round((pesoAtual / capacidade) * 100) : 0;
  const excedente = Math.max(0, pesoAtual - capacidade);
  return {
    pesoAtual,
    capacidade,
    excedente,
    percentual,
    aviso: excedente > 0,
  };
}

// Formata KG em toneladas quando aplicável (ex: 10.500 kg → "10,5 ton")
export function formatarPeso(kg) {
  if (kg >= 1000) {
    return `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ton`;
  }
  return `${Math.round(kg).toLocaleString("pt-BR")} kg`;
}

// ════════════════════════════════════════════════════════════
// REGRA 4: Agrupamento / Checklist de itens
// ════════════════════════════════════════════════════════════
// Parse seguro do itens_json
export function parseItensPedido(itensJson) {
  try {
    const arr = JSON.parse(itensJson || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Conta itens concluídos do checklist
export function progressoChecklist(itensJson) {
  const itens = parseItensPedido(itensJson);
  if (itens.length === 0) return { total: 0, concluidos: 0, percentual: 0 };
  const concluidos = itens.filter((i) => i.concluido).length;
  return {
    total: itens.length,
    concluidos,
    percentual: Math.round((concluidos / itens.length) * 100),
  };
}