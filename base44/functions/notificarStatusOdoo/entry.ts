import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * notificarStatusOdoo — Mini BI Industrial
 * Recebe eventos de produção da fábrica e reenvia (POST) para o webhook BI do Odoo.
 *
 * Payload esperado (vindo do front via base44.functions.invoke):
 *  - numero_pedido, odoo_id, evento, status_novo
 *  - operador, galpao, maquina_atual, maquina_anterior
 *  - maquinas_concluidas (array), maquinas_pendentes (array)
 *  - percentual_concluido (number)
 *  - hora_corte, hora_colagem (ISO string)
 *
 * O timestamp é gerado aqui; api_key é fixa do Odoo BI.
 */

const ODOO_BI_URL = "https://ajlferroeaco.odoo.com/web/hook/bi-fabricas";
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
      operador: body.operador || user.email || "",
      galpao: body.galpao || "",
      maquina_atual: body.maquina_atual || "",
      maquina_anterior: body.maquina_anterior || "",
      maquinas_concluidas: Array.isArray(body.maquinas_concluidas) ? body.maquinas_concluidas : [],
      maquinas_pendentes: Array.isArray(body.maquinas_pendentes) ? body.maquinas_pendentes : [],
      percentual_concluido: typeof body.percentual_concluido === "number" ? body.percentual_concluido : 0,
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