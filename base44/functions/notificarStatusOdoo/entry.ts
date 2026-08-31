import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * notificarStatusOdoo — Mini BI Industrial
 * Recebe eventos de produção e reenvia (POST) para o webhook BI do Odoo.
 *
 * Body base enviado:
 *  { api_key, numero_pedido, odoo_id, evento, status_novo, timestamp,
 *    galpao, percentual_concluido,
 *    itens_cd_json (C&D com maquinas[]), itens_telha_json (Telha com maquinas[]) }
 *
 * Extras por evento (opcionais, repassados do front):
 *  maquina_atual, maquina_anterior, item_nome, duracao_min, hora_corte, hora_colagem, operador
 */

const ODOO_BI_URL = "https://ajlferroeaco.odoo.com/web/hook/56a16770-c0d5-49ab-a711-0fcefc90d210";
const ODOO_BI_KEY = "AJL_BASE44_DELETE_OF_2026_8fk92xLm";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const payload = {
      api_key: ODOO_BI_KEY,
      numero_pedido: body.numero_pedido || "",
      odoo_id: body.odoo_id || "",
      evento: body.evento || "",
      status_novo: body.status_novo || "",
      timestamp: new Date().toISOString(),
      galpao: body.galpao || "",
      percentual_concluido: typeof body.percentual_concluido === "number" ? body.percentual_concluido : 0,
      itens_cd_json: body.itens_cd_json || "[]",
      itens_telha_json: body.itens_telha_json || "[]",
      operador: body.operador || user.email || "",
      maquina_atual: body.maquina_atual || "",
      maquina_anterior: body.maquina_anterior || "",
      item_nome: body.item_nome || "",
      duracao_min: body.duracao_min != null ? body.duracao_min : null,
      hora_corte: body.hora_corte || "",
      hora_colagem: body.hora_colagem || ""
    };

    const res = await fetch(ODOO_BI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let odooResp: any = null;
    try { odooResp = await res.json(); }
    catch { odooResp = await res.text(); }

    return Response.json({
      status: res.ok ? "ok" : "erro_odoo",
      http_status: res.status,
      evento: payload.evento,
      numero_pedido: payload.numero_pedido,
      odoo_response: odooResp
    }, { status: res.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({ error: error.message || "Erro no notificarStatusOdoo" }, { status: 500 });
  }
}