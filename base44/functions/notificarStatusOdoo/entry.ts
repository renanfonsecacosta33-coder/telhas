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

    // Payload EXATO confirmado pelo Odoo (Mini BI Industrial)
    let itensParsed: any[] = [];
    try {
      const raw = JSON.parse(body.itens_json || "[]");
      itensParsed = Array.isArray(raw) ? raw : [];
    } catch { itensParsed = []; }
    const maquinas: any[] = Array.isArray(body.maquinas) ? body.maquinas : [];
    const etapas: any[] = Array.isArray(body.etapas) ? body.etapas : [];

    const isOrderConcluida = Number(body.percentual_concluido) >= 100 ||
      String(body.status_novo || "").toLowerCase() === "concluido" ||
      String(body.status_novo || "").toLowerCase() === "finalizado" ||
      String(body.evento || "").toLowerCase() === "concluido";

    const formatStatusCD = (st: string, maq: string) => {
      const s = String(st || "").trim().toLowerCase();
      if (isOrderConcluida || s === "concluido" || s === "finalizado" || s.includes("conclu")) return "Concluído";
      if (s === "em_producao") return maq ? `Em Produção (${maq})` : "Em Produção (C&D)";
      if (s.includes("revis")) return st;
      if (s.includes("início") || s.includes("inicio")) return st;
      return "Aguardando Revisão (C&D)";
    };

    const formatStatusTelha = (st: string, maq: string) => {
      const s = String(st || "").trim().toLowerCase();
      if (isOrderConcluida || s === "concluido" || s === "finalizado" || s.includes("conclu") || (body.evento === "maquina_fim" && Number(body.percentual_concluido) >= 100)) return "Concluído";
      if (s.includes("colagem") || body.evento === "etapa_colagem") return "Aguardando Colagem";
      if (s === "em_producao" || s.includes("produ") || body.evento === "maquina_inicio" || body.status_novo === "em_producao") {
        return maq ? `Em Produção (${maq})` : "Em Produção (Telhas)";
      }
      if (s.includes("início") || s.includes("inicio")) return st;
      if (s.includes("revis")) return st;
      return maq ? `Aguardando Início (${maq})` : "Aguardando Início (Telhas)";
    };

    const isTelhaEvent = body.evento === "maquina_inicio" || body.evento === "etapa_concluida" || /(telha|tp|colonial|bandeja|colagem)/i.test(body.maquina_atual || "");

    const itens_cd_arr = itensParsed
      .filter((i) => /(chapa|perfil|barra|tubo|zincado|serralheiro|corte)/i.test(String(i.produto || i.categoria || "")))
      .map((i) => {
        const isTarget = Boolean(body.item_nome) && (
          String(i.produto || "").toLowerCase().includes(String(body.item_nome || "").toLowerCase()) ||
          String(body.item_nome || "").toLowerCase().includes(String(i.produto || "").toLowerCase())
        );
        const itemSt = isOrderConcluida ? "concluido" : ((isTarget && (body.evento === "maquina_inicio" && !/(telha|tp)/i.test(body.maquina_atual || ""))) ? "em_producao" : i.status);
        const itemMaq = (isTarget && body.maquina_atual) ? body.maquina_atual : (i.maquina || "");
        const rawMaquinas = Array.isArray(i.maquinas) && i.maquinas.length ? i.maquinas : maquinas;
        const maquinasProcessadas = rawMaquinas.map((m: any) =>
          typeof m === "string"
            ? { nome: m, status: isOrderConcluida ? "concluido" : "pendente" }
            : { ...m, status: isOrderConcluida ? "concluido" : (m.status || "pendente") }
        );

        return {
          produto: i.produto,
          quantidade: i.quantidade,
          unidade: i.unidade || "UN",
          observacao: i.observacao || "",
          status: formatStatusCD(itemSt, itemMaq),
          status_detalhado: isOrderConcluida ? "Concluído" : (i.status_detalhado || formatStatusCD(itemSt, itemMaq)),
          maquinas: maquinasProcessadas
        };
      });

    const itens_telha_arr = itensParsed
      .filter((i) => /(telha|TP|EPS|manta|cumeeira|ondulada|colonial)/i.test(String(i.produto || i.categoria || "")))
      .map((i) => {
        const isTarget = !body.item_nome ||
                         String(i.produto || "").toLowerCase().includes(String(body.item_nome || "").toLowerCase()) ||
                         String(body.item_nome || "").toLowerCase().includes(String(i.produto || "").toLowerCase()) ||
                         isTelhaEvent;
        const itemSt = isOrderConcluida ? "concluido" : ((isTarget && isTelhaEvent) ? "em_producao" : (i.status || body.status_novo));
        const itemMaq = (isTarget && body.maquina_atual) ? body.maquina_atual : (i.maquina || body.maquina_atual || "");
        const rawEtapas = Array.isArray(i.maquinas) && i.maquinas.length ? i.maquinas : etapas;
        const etapasProcessadas = rawEtapas.map((e: any) =>
          typeof e === "string"
            ? { nome: e, status: isOrderConcluida ? "concluido" : "pendente" }
            : { ...e, status: isOrderConcluida ? "concluido" : (e.status || "pendente") }
        );

        return {
          produto: i.produto,
          quantidade: i.quantidade,
          unidade: i.unidade || "MT",
          observacao: i.observacao || "",
          status: formatStatusTelha(itemSt, itemMaq),
          status_detalhado: isOrderConcluida ? "Concluído" : formatStatusTelha(itemSt, itemMaq),
          maquinas: etapasProcessadas
        };
      });

    const itens_cd_count = Number(body.itens_cd_count != null ? body.itens_cd_count : itens_cd_arr.length);
    const itens_telha_count = Number(body.itens_telha_count != null ? body.itens_telha_count : itens_telha_arr.length);
    const total_itens = Number(body.total_itens != null ? body.total_itens : (itens_cd_count + itens_telha_count) || itensParsed.length);

    const usuario = String(body.usuario || user?.full_name || user?.email || "Operador Fábrica").trim();

    const payload = {
      api_key: ODOO_BI_KEY,
      numero_pedido: body.numero_pedido || "",
      odoo_id: body.odoo_id || "",
      of_odoo_id: body.of_odoo_id || body.odoo_id || "",
      of_nome: body.of_nome || "",
      evento: isOrderConcluida ? "concluido" : (body.evento || ""),
      timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
      item_nome: body.item_nome || "",
      galpao: body.galpao || "",
      maquina_atual: body.maquina_atual || "",
      usuario,
      foto_finalizacao_url: body.foto_finalizacao_url || "",
      inicio_fmt: body.inicio_fmt || "",
      fim_fmt: body.fim_fmt || "",
      duracao_min: body.duracao_min != null ? body.duracao_min : null,
      hora_corte: body.hora_corte || "",
      hora_colagem: body.hora_colagem || "",
      percentual_concluido: isOrderConcluida ? 100 : (body.percentual_concluido || 0),
      status_novo: isOrderConcluida ? "Concluído" : (body.status_novo || ""),
      itens_cd_count,
      itens_telha_count,
      total_itens,
      itens_cd_json: JSON.stringify(itens_cd_arr),
      itens_telha_json: JSON.stringify(itens_telha_arr)
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
      payload_enviado: payload,
      odoo_response: odooResp
    }, { status: res.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({ error: error.message || "Erro no notificarStatusOdoo" }, { status: 500 });
  }
}