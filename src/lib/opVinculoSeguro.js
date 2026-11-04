const norm = value => String(value ?? "").trim().toUpperCase();

export function indicesDaOp(op) {
  const raw = op?.itens_indices || op?.item_indices;
  const values = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);
  return [...new Set([...(Array.isArray(values) ? values : []), op?.item_idx]
    .filter(value => value !== null && value !== undefined && value !== "")
    .map(Number).filter(Number.isInteger))];
}

export function opDaMesmaOf(op, pedido) {
  if (!op || !pedido || op.status === "cancelado") return false;
  if (op.pedido_odoo_id) return norm(op.pedido_odoo_id) === norm(pedido.id);
  if (op.of_odoo_id) return norm(op.of_odoo_id) === norm(pedido.of_odoo_id);
  if (op.of_nome) return norm(op.of_nome) === norm(pedido.of_nome);
  return false; // Uma venda pode conter várias OFs; vínculo legado exige revisão.
}

export function opCobreIndices(op, indices) {
  const registrados = indicesDaOp(op);
  return indices.length > 0 && indices.every(idx => registrados.includes(Number(idx)));
}

export function validarOpConfirmada(op, pedido, indices, maquina) {
  if (!op?.id || !opDaMesmaOf(op, pedido) || !opCobreIndices(op, indices)) {
    throw new Error("A OP retornada não cobre exatamente os itens desta OF. Distribuição interrompida para evitar perda de itens.");
  }
  const atual = norm(op.maquina).replace(/[^A-Z0-9]/g, "");
  const destino = norm(maquina).replace(/[^A-Z0-9]/g, "");
  if (op.status === "pendente" && atual !== destino) {
    throw new Error(`Item já possui OP na ${op.maquina}, mas a programação aponta ${maquina}. Revise a programação no PCP; nenhuma máquina foi alterada.`);
  }
}