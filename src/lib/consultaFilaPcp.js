export function montarConsultaPcp({ filtro, lojaSelecionada, busca, tipoBusca, filtroSetor, filtroDataCampo, filtroDataInicio, filtroDataFim, filtroDataPreset }) {
  const query = {};
  if (lojaSelecionada !== "todas") query.unidade = lojaSelecionada;
  if (["ativos", "produzindo_agora", "aguardando_maquina"].includes(filtro)) query.status_pcp = { $nin: ["concluido", "cancelado"] };
  else if (filtro !== "todos") query.status_pcp = filtro;
  if (filtroSetor === "telhas") query.itens_telha_count = { $gt: 0 };
  if (filtroSetor === "corte_dobra") query.itens_cd_count = { $gt: 0 };
  const inicio = filtroDataInicio;
  const fim = filtroDataFim;
  if (inicio || fim) {
    const campo = filtroDataCampo || "data_entrega";
    query[campo] = inicio && fim ? { $gte: `${inicio < fim ? inicio : fim}`, $lt: `${inicio < fim ? fim : inicio}T23:59:59.999` }
      : inicio ? { $gte: inicio, $lt: `${inicio}T23:59:59.999` } : { [filtroDataPreset === "atrasados" ? "$lt" : "$lte"]: fim };
  }
  const termo = String(busca || "").trim();
  if (termo) {
    const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Explicit character classes preserve case-insensitive matching without unsupported regex flags.
    const regex = escaped.replace(/[a-zA-Z]/g, c => `[${c.toLowerCase()}${c.toUpperCase()}]`);
    const campos = tipoBusca === "cliente" ? ["cliente_nome"] : tipoBusca === "vendedor" ? ["vendedor_nome"]
      : tipoBusca === "numero_pedido" ? ["numero_pedido", "numero_oc", "of_nome", "of_odoo_id", "odoo_id"]
      : tipoBusca === "modelo" ? ["itens_json", "descricao", "identificacao_1", "identificacao_2"]
      : ["numero_pedido", "numero_oc", "of_nome", "of_odoo_id", "cliente_nome", "vendedor_nome", "itens_json", "descricao", "identificacao_1", "identificacao_2"];
    query.$or = campos.map(campo => ({ [campo]: { $regex: regex } }));
  }
  return query;
}

export async function buscarOpsDasOfs(base44, entidade, pedidos) {
  const ids = pedidos.map(p => p.id).filter(Boolean);
  if (!ids.length) return [];
  const ofOdooIds = pedidos.map(p => p.of_odoo_id).filter(Boolean);
  const ofNomes = pedidos.map(p => p.of_nome).filter(Boolean);
  const numerosPedidos = Array.from(new Set(pedidos.flatMap(p => {
    const raw = String(p.numero_pedido || "").trim();
    if (!raw) return [];
    const limpo = raw.replace(/^#/, "");
    return [raw, limpo, `#${limpo}`];
  })));

  let query;
  if (entidade === "Pedido") {
    query = {
      $or: [
        { pedido_odoo_id: { $in: ids } },
        ...(ofOdooIds.length ? [{ of_odoo_id: { $in: ofOdooIds } }] : []),
        ...(ofNomes.length ? [{ of_nome: { $in: ofNomes } }] : [])
      ],
      status: { $ne: "cancelado" }
    };
  } else {
    // OrdemMaquinaCD ou OrdemDesbobinadeira
    query = {
      $or: [
        { numero_pedido: { $in: numerosPedidos } },
        { pedido_odoo_id: { $in: ids } },
        ...(ofOdooIds.length ? [{ of_odoo_id: { $in: ofOdooIds } }] : [])
      ],
      status: { $ne: "cancelado" }
    };
  }

  const records = [];
  let cursor;
  do {
    const page = await base44.entities[entidade].filter(query, { limit: 250, ...(cursor ? { cursor } : {}) });
    records.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return records;
}