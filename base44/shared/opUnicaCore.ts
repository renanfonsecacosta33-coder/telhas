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
  if (pedId && norm(o?.pedido_odoo_id) === pedId) return true;
  if (ofId && norm(o?.of_odoo_id) === ofId) return true;
  if (ofNome && norm(o?.of_nome).toUpperCase() === ofNome) return true;
  if (!o?.pedido_odoo_id && !o?.of_odoo_id && !o?.of_nome && numPed && norm(o?.numero_pedido) === numPed) return true;
  return false;
}

/**
 * A OP candidata já cobre o item-alvo?
 * 1. Por índice do item (item_idx / itens_indices) — casamento exato.
 * 2. Fallback: mesmo produto + mesma máquina na mesma OF (pega OPs legadas
 *    criadas sem índice — eram exatamente as que escapavam da checagem antiga).
 */
export function opCobreMesmoItem(o, dedup) {
  const indices = (dedup?.indices || []).map(Number).filter((n) => !isNaN(n));
  if (indices.length > 0) {
    if (o?.item_idx != null && indices.includes(Number(o.item_idx))) return true;
    if (o?.itens_indices) {
      try {
        const l = Array.isArray(o.itens_indices) ? o.itens_indices : JSON.parse(o.itens_indices);
        if (Array.isArray(l) && l.some((i) => indices.includes(Number(i)))) return true;
      } catch { /* itens_indices inválido — ignora */ }
    }
  }
  const prod = norm(dedup?.item_produto).toUpperCase();
  const maq = norm(dedup?.maquina).toUpperCase();
  if (prod && maq && norm(o?.item_produto).toUpperCase() === prod && norm(o?.maquina).toUpperCase() === maq) return true;
  return false;
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
  const ops = await client.entities.Pedido.filter(query);
  return (ops || []).filter((o) => String(o?.status || "").toLowerCase() !== "cancelado" && opMesmaOf(o, dedup));
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
  const existente = candidatas.filter((o) => opCobreMesmoItem(o, dedup)).sort(maisAntiga)[0];
  if (existente) {
    return { op: existente, criada: false, motivo: "op_existente" };
  }

  // 2. Cria a OP
  const nova = await client.entities.Pedido.create(dadosOp);

  // 3. Reconciliação anti-corrida: re-busca imediatamente após criar
  const recheck = await buscarCandidatas(client, dedup);
  const conflitos = recheck.filter((o) => o?.id !== nova?.id && opCobreMesmoItem(o, dedup));
  if (conflitos.length > 0) {
    const todas = [nova, ...conflitos];
    const vencedora = [...todas].sort(maisAntiga)[0];
    // A mais antiga vence: se a nossa é a duplicata, apagamos ela
    if (vencedora?.id !== nova?.id) {
      await client.entities.Pedido.delete(nova.id).catch(() => {});
      return { op: vencedora, criada: false, motivo: "concorrencia_reconciliada" };
    }
    // A nossa é a mais antiga: apaga as duplicatas concorrentes que ainda estão pendentes
    for (const c of conflitos) {
      if (String(c?.status || "").toLowerCase() === "pendente") {
        await client.entities.Pedido.delete(c.id).catch(() => {});
      }
    }
  }

  return { op: nova, criada: true, motivo: "criada" };
}