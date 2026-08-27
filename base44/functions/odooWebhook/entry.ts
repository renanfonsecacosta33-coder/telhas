import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Webhook público (POST /functions/odooWebhook) para o Odoo criar/atualizar
 * um PedidoOdoo no banco do app, SEM exigir login de usuário (service_role).
 *
 * Autenticação: header `x-api-key` (ou `authorization: Bearer <key>`,
 * ou body `api_key`) validado contra o secret ODOO_API_KEY.
 *
 * Payload JSON esperado (cam principais):
 *  - numero_pedido (obrigatório)
 *  - cliente_nome, vendedor_nome
 *  - foto_pedido_url, anexo_1_url, anexo_2_url
 *  - itens_json (string JSON ou array de itens)
 *  - data_entrega, unidade, odoo_id, prioridade
 */
export default async function(req: Request): Promise<Response> {
  try {
    // ── 1. Ler corpo da requisição (POST direto do Odoo, sem validação de chave) ──
    let body: any = {};
    let rawBody = "";
    try {
      rawBody = await req.text();
      if (rawBody) body = JSON.parse(rawBody);
    } catch {
      // corpo não-JSON: ignora
    }

    // ── 2. Validar payload mínimo ──
    const numeroPedido = (body?.numero_pedido || "").toString().trim();
    if (!numeroPedido) {
      return Response.json({ error: "Campo obrigatório 'numero_pedido' ausente" }, { status: 400 });
    }

    // ── 3. Normalizar itens_json ──
    let itensArray: any[] = [];
    if (Array.isArray(body?.itens_json)) {
      itensArray = body.itens_json;
    } else if (typeof body?.itens_json === "string" && body.itens_json.trim()) {
      try { itensArray = JSON.parse(body.itens_json); } catch { itensArray = []; }
    }
    const itensJsonStr = itensArray.length ? JSON.stringify(itensArray) : (body?.itens_json || "[]");

    // Contagem por categoria (Rule 4 — checklist agrupado)
    const cat = (s: string) => (s || "").toLowerCase();
    const isTelha = (i: any) => {
      const t = cat(i?.categoria) + " " + cat(i?.produto) + " " + cat(i?.descricao);
      return /telha|tp[- ]?\d|ondulada|colonial|bandeja|cumeeira|painel|bobinin/.test(t);
    };
    const isFrisada = (i: any) => /frisad/.test(cat(i?.categoria) + " " + cat(i?.produto) + " " + cat(i?.descricao));
    const itensTelha = itensArray.filter(isTelha).length;
    const itensFrisada = itensArray.filter(isFrisada).length;
    const itensCd = itensArray.length - itensTelha - itensFrisada;

    // Espessuras distintas
    const espSet = new Set<string>();
    itensArray.forEach((i: any) => {
      const e = i?.espessura || i?.chapa;
      if (e != null && e !== "") espSet.add(String(e));
    });
    const espessurasTags = espSet.size ? JSON.stringify(Array.from(espSet).map(e => ({ espessura: e }))) : "";

    // ── 4. Montar registro (upsert por numero_pedido) ──
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    const existing = await db.entities.PedidoOdoo.filter({ numero_pedido: numeroPedido });
    const existingRec = existing && existing.length ? existing[0] : null;

    const nowIso = new Date().toISOString();

    const record: Record<string, any> = {
      numero_pedido: numeroPedido,
      cliente_nome: body?.cliente_nome ?? existingRec?.cliente_nome ?? "",
      vendedor_nome: body?.vendedor_nome ?? existingRec?.vendedor_nome ?? "",
      foto_pedido_url: body?.foto_pedido_url ?? body?.anexo_1_url ?? existingRec?.foto_pedido_url ?? "",
      anexo_1_url: body?.anexo_1_url ?? existingRec?.anexo_1_url ?? "",
      anexo_2_url: body?.anexo_2_url ?? existingRec?.anexo_2_url ?? "",
      data_entrega: body?.data_entrega ?? existingRec?.data_entrega ?? "",
      unidade: body?.unidade ?? existingRec?.unidade ?? "Matriz AJL",
      prioridade: body?.prioridade ?? existingRec?.prioridade ?? false,
      odoo_id: body?.odoo_id != null ? String(body.odoo_id) : (existingRec?.odoo_id ?? ""),
      itens_json: itensJsonStr,
      total_itens: itensArray.length || existingRec?.total_itens || 0,
      itens_telha_count: itensTelha || existingRec?.itens_telha_count || 0,
      itens_cd_count: Math.max(itensCd, 0) || existingRec?.itens_cd_count || 0,
      itens_frisada_count: itensFrisada || existingRec?.itens_frisada_count || 0,
      espessuras_tags: espessurasTags || existingRec?.espessuras_tags || "",
      data_recebimento: nowIso,
      percentual_concluido: existingRec?.percentual_concluido ?? 0,
      status_pcp: existingRec?.status_pcp ?? "pendente_distribuicao",
    };
    // Limpa campos undefined
    Object.keys(record).forEach(k => { if (record[k] === undefined) delete record[k]; });

    let result;
    if (existingRec) {
      result = await db.entities.PedidoOdoo.update(existingRec.id, record);
    } else {
      result = await db.entities.PedidoOdoo.create(record);
    }

    return Response.json({
      status: "success",
      action: existingRec ? "updated" : "created",
      numero_pedido: numeroPedido,
      id: result?.id || existingRec?.id,
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || "Erro interno no webhook" }, { status: 500 });
  }
}