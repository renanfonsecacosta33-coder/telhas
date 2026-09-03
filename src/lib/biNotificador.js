import { base44 } from "@/api/base44Client";
import { getItens, classGrupo } from "@/lib/pedidoOdooHelper";

// ── Mini BI Industrial — Rastreamento por Máquina ──────────────────────
// Helpers compartilhados para sequência de máquinas C&D e etapas de Telhas.

export const MAQUINAS_CD = ["Guilhotina", "Dobradeira", "Puncionadeira", "Acabamento"];
export const ETAPAS_TELHA = ["Perfiladeira", "Corte", "Colagem", "Embalagem"];

function parseArr(raw) {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}

export function getMaquinasState(pedido) {
  const arr = parseArr(pedido?.maquinas_json);
  if (arr.length) return arr;
  return MAQUINAS_CD.map((nome) => ({ nome, status: "pendente", operador: "", inicio_ts: "", fim_ts: "" }));
}

export function getEtapasTelhaState(pedido) {
  const arr = parseArr(pedido?.etapas_telha_json);
  if (arr.length) return arr;
  return ETAPAS_TELHA.map((nome) => ({ nome, status: "pendente", hora_ts: "" }));
}

export function maquinaAtual(maquinas) {
  return maquinas.find((m) => m.status === "em_andamento") || null;
}

export function maquinasConcluidas(maquinas) {
  return maquinas.filter((m) => m.status === "concluido").map((m) => m.nome);
}

export function maquinasPendentes(maquinas) {
  return maquinas.filter((m) => m.status !== "concluido").map((m) => m.nome);
}

// Persiste maquinas_json no pedido e retorna o array atualizado.
export async function persistirMaquinas(pedido, maquinas) {
  const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
    maquinas_json: JSON.stringify(maquinas)
  });
  return atualizado;
}

export async function persistirEtapasTelha(pedido, etapas) {
  const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
    etapas_telha_json: JSON.stringify(etapas)
  });
  return atualizado;
}

/**
 * Dispara a notificação BI para o Odoo via função notificarStatusOdoo.
 * O payload EXATO (filtro por produto, _model, etc.) é montado no backend.
 * Tolerante a falhas: nunca quebra o fluxo principal.
 */
export async function notificarStatus(pedido, evento, extra = {}) {
  const maquinas = getMaquinasState(pedido);
  const etapas = getEtapasTelhaState(pedido);
  const atual = maquinaAtual(maquinas);

  // item_nome padrão por evento, se não informado pelo chamador
  const itens = getItens(pedido);
  let itemNomeDefault = "";
  if (evento.startsWith("etapa_")) {
    itemNomeDefault = itens.find((i) => classGrupo(i) === "telha")?.produto || "";
  } else if (evento.startsWith("maquina_")) {
    itemNomeDefault = itens.find((i) => classGrupo(i) === "cd")?.produto || "";
  }

  let usuarioNome = extra.usuario || extra.operador || "";
  if (!usuarioNome) {
    try {
      const u = await base44.auth.me();
      usuarioNome = u?.full_name || u?.email || "Operador Fábrica";
    } catch {
      usuarioNome = "Operador Fábrica";
    }
  }

  try {
    await base44.functions.invoke("notificarStatusOdoo", {
      numero_pedido: pedido.numero_pedido,
      odoo_id: pedido.odoo_id || "",
      evento,
      status_novo: extra.status_novo || pedido.status_pcp || "",
      item_nome: extra.item_nome || itemNomeDefault,
      galpao: pedido.galpao_responsavel || pedido.unidade || "",
      maquina_atual: extra.maquina_atual || atual?.nome || "",
      usuario: usuarioNome,
      inicio_fmt: extra.inicio_fmt || atual?.inicio_ts || "",
      fim_fmt: extra.fim_fmt || atual?.fim_ts || "",
      duracao_min: extra.duracao_min != null ? extra.duracao_min : null,
      hora_corte: extra.hora_corte || "",
      hora_colagem: extra.hora_colagem || "",
      percentual_concluido: extra.percentual_concluido != null ? extra.percentual_concluido : (pedido.percentual_concluido ?? 0),
      itens_telha_count: pedido.itens_telha_count || itens.filter((i) => classGrupo(i) === "telha").length,
      itens_cd_count: pedido.itens_cd_count || itens.filter((i) => classGrupo(i) === "cd").length,
      total_itens: pedido.total_itens || itens.length,
      itens_json: pedido.itens_json || JSON.stringify(itens),
      maquinas,
      etapas
    });
  } catch (e) {
    console.error("[biNotificador] falha notificarStatus:", e?.message || e);
  }
}