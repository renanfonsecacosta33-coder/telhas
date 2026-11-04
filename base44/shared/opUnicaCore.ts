// TRAVA ANTI-DUPLICAÇÃO DE OPs (entidade Pedido) — compartilhada pelo backend.
// Verificação FRESCA no servidor (nada de cache do navegador) + reconciliação
// pós-criação: se duas chamadas concorrentes criarem OPs para o mesmo item ao
// mesmo tempo, apenas a mais antiga sobrevive e a(s) duplicata(s) é/são apagada(s).

const norm = (v) => String(v ?? "").trim();

/**
 * Uma OP candidata pertence à MESMA OF que o dedup?
 * Casamento rígido por OF (pedido_odoo_id / of_odoo_id / of_nome).
 * OP legado sem NENHUM vínculo de OF só casa pelo número da venda.
 */
export function opMesmaOf(o, dedup) {
  const pedId = norm(dedup?.pedido_odoo_id);
  const ofId = norm(dedup?.of_odoo_id);
  const ofNome = norm(dedup?.of_nome).toUpperCase();
  const numPed = norm(dedup?.numero_pedido);
  if (o?.pedido_odoo_id) return Boolean(pedId) && norm(o.pedido_odoo_id) === pedId;
  if (o?.of_odoo_id) return Boolean(ofId) && norm(o.of_odoo_id) === ofId;
  if (o?.of_nome) return Boolean(ofNome) && norm(o.of_nome).toUpperCase() === ofNome;
  return false;
}

/**
 * A OP candidata já cobre o item-alvo?
 * 1. Por índice do item (item_idx / itens_indices) — casamento exato.
 * 2. Fallback: mesmo produto + mesma máquina na mesma OF (pega OPs legadas
 *    criadas sem índice — eram exatamente as que escapavam da checagem antiga).
 */
function indicesOp(o) {
  const raw = o?.itens_indices || o?.item_indices;
  const lista = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);
  return [...new Set([...(Array.isArray(lista) ? lista : []), o?.item_idx]
    .filter(v => v !== null && v !== undefined && v !== "").map(Number).filter(Number.isInteger))];
}

export function opCobreMesmoItem(o, dedup) {
  const solicitados = (dedup?.indices || []).map(Number).filter(Number.isInteger);
  const registrados = indicesOp(o);
  if (solicitados.length || registrados.length) {
    return solicitados.length > 0 && solicitados.every(idx => registrados.includes(idx));
  }
  return Boolean(dedup?.item_produto && dedup?.maquina) &&
    norm(o?.item_produto) === norm(dedup.item_produto) && norm(o?.maquina) === norm(dedup.maquina);
}

async function buscarCandidatas(client, dedup) {
  const condicoes = [];
  const pedId = norm(dedup?.pedido_odoo_id);
  const ofId = norm(dedup?.of_odoo_id);
  const numPed = norm(dedup?.numero_pedido);
  if (pedId) condicoes.push({ pedido_odoo_id: pedId });
  if (ofId) condicoes.push({ of_odoo_id: ofId });
  if (numPed) condicoes.push({ numero_pedido: numPed });
  if (condicoes.length === 0) return [];
  const query = condicoes.length === 1 ? condicoes[0] : { $or: condicoes };
  const ops = [];
  let cursor;
  do {
    const page = await client.entities.Pedido.filter({ ...query, status: { $ne: "cancelado" } }, { limit: 100, ...(cursor ? { cursor } : {}) });
    ops.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return ops.filter(o => opMesmaOf(o, dedup));
}

const maisAntiga = (a, b) => String(a?.created_date || "").localeCompare(String(b?.created_date || ""));

/**
 * GARANTE UMA ÚNICA OP para o item:
 * - Se já existe OP viva da mesma OF cobrindo o item → devolve ela, NÃO cria outra.
 * - Se não existe → cria e re-verifica: numa corrida concorrente, mantém a OP mais
 *   antiga e apaga a(s) duplicata(s) recente(s) (só apaga OPs ainda 'pendente').
 * Retorna { op, criada, motivo }.
 */
export async function garantirOpUnica(client, { dadosOp, dedup }) {
  // 1. Verificação fresca no servidor, no momento da criação
  const candidatas = await buscarCandidatas(client, dedup);
  const existente = candidatas.filter(o => opCobreMesmoItem(o, dedup)).sort((a, b) =>
    Number(a.status === "finalizado") - Number(b.status === "finalizado") || maisAntiga(a, b))[0];
  if (existente) {
    return { op: existente, criada: false, motivo: "op_existente" };
  }

  const solicitados = (dedup.indices || []).map(Number);
  if (candidatas.some(o => indicesOp(o).some(idx => solicitados.includes(idx)))) {
    throw new Error("Há OP cobrindo apenas parte deste grupo. Revise os itens já enviados antes de distribuir o restante.");
  }
  if (candidatas.some(o => !indicesOp(o).length && norm(o.item_produto) === norm(dedup.item_produto))) {
    throw new Error("Há OP legada sem identificação de item para este produto. Revise o vínculo no PCP antes de reenviar.");
  }

  // 2. Cria a OP
  const nova = await client.entities.Pedido.create(dadosOp);

  // 3. Reconciliação anti-corrida: re-busca imediatamente após criar
  const recheck = await buscarCandidatas(client, dedup);
  const conflitos = recheck.filter((o) => o?.id !== nova?.id && opCobreMesmoItem(o, dedup));
  if (conflitos.length > 0) {
    const vencedora = [nova, ...conflitos].sort((a, b) => maisAntiga(a, b) || norm(a.id).localeCompare(norm(b.id)))[0];
    if (vencedora.id !== nova.id) {
      // Nunca apaga OPs de terceiros, nem produção iniciada. Só cancela a cópia recém-criada nesta chamada.
      const atual = await client.entities.Pedido.get(nova.id);
      if (atual.status === "pendente") await client.entities.Pedido.update(nova.id, {
        status: "cancelado", observacoes: `${atual.observacoes || ""}\nCópia concorrente cancelada; OP mantida: ${vencedora.id}`
      });
      return { op: vencedora, criada: false, motivo: "concorrencia_reconciliada" };
    }
  }

  return { op: nova, criada: true, motivo: "criada" };
}