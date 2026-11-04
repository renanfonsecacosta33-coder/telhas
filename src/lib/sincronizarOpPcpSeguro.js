import { base44 } from "@/api/base44Client";
import { getItens, buildItensJson, calcularProgressoRealPedido } from "@/lib/pedidoOdooHelper";
import { indicesDaOp, opDaMesmaOf } from "@/lib/opVinculoSeguro";
import { notificarStatus } from "@/lib/biNotificador";

export async function localizarOfDaOp(op) {
  if (op.pedido_odoo_id) return base44.entities.PedidoOdoo.get(op.pedido_odoo_id);
  const query = op.of_odoo_id ? { of_odoo_id: op.of_odoo_id } : op.of_nome ? { of_nome: op.of_nome }
    : op.numero_pedido ? { numero_pedido: op.numero_pedido } : null;
  if (!query) return null;
  const page = await base44.entities.PedidoOdoo.filter(query, { limit: 2 });
  if (page.items.length !== 1 || page.has_more) throw new Error("Vínculo da OF ambíguo. A OP foi salva, mas o PCP precisa revisar o vínculo; nenhuma OF irmã foi alterada.");
  return page.items[0];
}

export async function sincronizarStatusOpPcp(op, usuario = "Operador") {
  const pedido = await localizarOfDaOp(op);
  if (!pedido) return;
  const itens = getItens(pedido);
  let indices = indicesDaOp(op);
  if (!indices.length && itens.length === 1) indices = [0];
  if (!indices.length || indices.some(idx => !itens[idx])) throw new Error("OP salva, mas sem índices de item válidos para sincronizar com o PCP.");
  const status = op.status === "finalizado" ? "concluido" : op.status === "pendente" ? "distribuido" : op.status;
  for (const idx of indices) {
    if (itens[idx].concluido && status !== "concluido") continue;
    itens[idx] = { ...itens[idx], status, concluido: status === "concluido", distribuido: true, maquina: op.maquina,
      iniciada: ["em_producao", "pausado"].includes(status),
      ...(op.foto_finalizacao_url ? { foto_url: op.foto_finalizacao_url } : {}) };
  }
  const fontes = [];
  let cursor;
  do {
    const page = await base44.entities.Pedido.filter({ pedido_odoo_id: pedido.id, status: { $ne: "cancelado" } }, { limit: 100, ...(cursor ? { cursor } : {}) });
    fontes.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  if (!fontes.some(o => o.id === op.id)) fontes.push(op);
  const valido = fontes.filter(o => opDaMesmaOf(o, pedido) || o.id === op.id);
  const atualizadoPedido = { ...pedido, itens_json: buildItensJson(itens) };
  const percentual = calcularProgressoRealPedido(atualizadoPedido, valido);
  const statusPcp = percentual >= 100 ? "concluido" : valido.some(o => ["em_producao", "pausado", "aguardando_colagem"].includes(o.status)) ? "em_producao" : "distribuido";
  const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, { itens_json: buildItensJson(itens), percentual_concluido: percentual, status_pcp: statusPcp });
  await notificarStatus(atualizado, statusPcp === "concluido" ? "concluido" : op.status === "em_producao" ? "maquina_inicio" : "etapa_concluida", {
    maquina_atual: op.maquina, item_nome: op.item_produto || op.produto, usuario, status_novo: statusPcp, percentual_concluido: percentual
  });
}