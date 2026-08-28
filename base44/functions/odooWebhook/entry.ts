import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Webhook público (POST /functions/odooWebhook) para o Odoo criar/atualizar
 * um PedidoOdoo no banco do app, SEM exigir login de usuário (service_role).
 *
 * Autenticação: header `x-api-key` (ou `authorization: Bearer <key>`,
 * ou body `api_key`) validado contra o secret ODOO_API_KEY.
 *
 * Payload JSON esperado (campos principais):
 *  - numero_pedido (obrigatório)
 *  - cliente_nome, vendedor_nome
 *  - foto_pedido_url, anexo_1_url, anexo_2_url (URL pública OU Base64 da imagem)
 *  - itens_json (string JSON ou array de itens)
 *  - data_entrega, unidade, odoo_id, prioridade
 */

// ── Helpers de Base64 ──────────────────────────────────────────────
// Detecta se uma string é uma imagem em Base64 (data URI ou Base64 puro),
// em vez de uma URL pública já pronta.
const DATA_URI_RE = /^data:([\w./+-]+);base64,(.+)$/i;
const URL_RE = /^(https?:|blob:|file:|\/)/i;
// Base64 puro: sem prefixo, sem espaços, tamanho razoável, apenas chars base64
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function isBase64Image(value: any): boolean {
  if (typeof value !== "string" || value.length < 64) return false;
  if (URL_RE.test(value)) return false;
  // data URI
  if (DATA_URI_RE.test(value)) return true;
  // base64 puro (sem prefixo) — evita confundir com texto/URL curto
  return B64_RE.test(value.trim()) && value.length > 256;
}

// Decodifica Base64 → Blob, extraindo o MIME quando possível.
function base64ToBlob(value: string): Blob {
  const m = value.match(DATA_URI_RE);
  if (m) {
    const mime = m[1] || "image/png";
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  // base64 puro → assume PNG
  const bin = atob(value.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

function extFromMime(mime: string): string {
  if (!mime) return "png";
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
  };
  return map[mime] || "png";
}

// Identifica o formato da imagem pelo magic number (primeiros chars do Base64)
// e monta um Data URI pronto para <img>: data:image/<mime>;base64,<string>.
// Se a string já for um Data URI, mantém. Retorna "" se não houver Base64 válido.
function formatBase64DataUri(value: any): string {
  if (typeof value !== "string") return "";
  let s = value.trim();
  if (!s) return "";
  // Já é Data URI de imagem — mantém original
  if (s.startsWith("data:image")) return s;
  // Remove prefixo data: genérico se existir
  const m = s.match(/^data:[\w./+-]+;base64,(.+)$/i);
  if (m) s = m[1];
  // Limpa whitespaces/newlines que quebram o Base64
  s = s.replace(/\s+/g, "");
  if (!s || s.length < 64) return "";
  if (!B64_RE.test(s)) return "";
  // Identifica o MIME pelo magic number
  let mime = "image/png";
  if (s.startsWith("/9j/")) mime = "image/jpeg";
  else if (s.startsWith("iVBORw0KGgo")) mime = "image/png";
  else if (s.startsWith("R0lGOD")) mime = "image/gif";
  else if (s.startsWith("UklGR")) mime = "image/webp";
  return `data:${mime};base64,${s}`;
}

// Resolve um campo de ANEXO (anexo_1/anexo_2): prioriza o campo *_base64,
// formatando-o como Data URI (sem upload — abre direto sem sessão Odoo).
// Se não houver base64, usa a URL pública como está.
function resolveAnexoField(base64Val: any, urlVal: any): string {
  const fromBase64 = formatBase64DataUri(base64Val);
  if (fromBase64) return fromBase64;
  const fromUrl = formatBase64DataUri(urlVal);
  if (fromUrl) return fromUrl;
  if (typeof urlVal === "string" && urlVal.trim()) return urlVal.trim();
  return "";
}

// Faz upload de uma imagem Base64 via integração nativa e retorna a file_url pública.
// Retorna a string original se não for Base64 (URL já pronta) ou "" se vazia.
async function resolveImageField(
  value: any,
  field: string,
  integrations: any
): Promise<string> {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return "";
  if (!isBase64Image(v)) return v; // já é URL pública — mantém

  try {
    const blob = base64ToBlob(v);
    const ext = extFromMime(blob.type);
    const fileName = `odoo_${field}_${Date.now()}.${ext}`;
    const fileObj = new File([blob], fileName, { type: blob.type });
    const res = await integrations.Core.UploadFile({ file: fileObj as any });
    if (res?.file_url) return res.file_url;
    throw new Error("UploadFile não retornou file_url");
  } catch (e) {
    // Se o upload falhar, descarta o Base64 para não estourar o tamanho do campo
    console.error(`[odooWebhook] Falha no upload de ${field}:`, e?.message || e);
    return "";
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    // ── 1. Ler corpo da requisição (POST direto do Odoo) ──
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

    // ── 4. Montar cliente + resolver imagens Base64 ──
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    // TRAVA ESTRITA DE ANTIDUPLICIDADE — numero_pedido é chave única.
    // Consulta por match EXATO antes de qualquer create/update.
    const existing = await db.entities.PedidoOdoo.filter({ numero_pedido: numeroPedido });
    const existingRec = existing && existing.length ? existing[0] : null;

    // Higiene: se já existirem duplicatas históricas do mesmo numero_pedido,
    // mantém apenas a mais antiga (existingRec) e remove as demais para garantir
    // unicidade absoluta na fila de produção (nunca duas OPs para o mesmo pedido).
    if (existing && existing.length > 1) {
      const idsParaRemover = existing.slice(1).map((r: any) => r.id);
      try {
        for (const id of idsParaRemover) {
          await db.entities.PedidoOdoo.delete(id);
        }
      } catch {
        // tolerante: não aborta o upsert se a limpeza falhar
      }
    }

    // foto_pedido_url: se vier em Base64, faz upload e grava a URL pública leve.
    const fotoUrl = await resolveImageField(body?.foto_pedido_url ?? body?.anexo_1_url, "foto_pedido", base44.integrations);
    // anexo_1 / anexo_2: prioriza campos *_base64, formatando como Data URI
    // (data:image/<mime>;base64,...) pelo magic number. Salva a string Data URI
    // diretamente em anexo_1_url/anexo_2_url — abre sem exigir sessão Odoo.
    const anexo1Url = resolveAnexoField(body?.anexo_1_base64, body?.anexo_1_url);
    const anexo2Url = resolveAnexoField(body?.anexo_2_base64, body?.anexo_2_url);

    const nowIso = new Date().toISOString();

    const record: Record<string, any> = {
      numero_pedido: numeroPedido,
      cliente_nome: body?.cliente_nome ?? existingRec?.cliente_nome ?? "",
      vendedor_nome: body?.vendedor_nome ?? existingRec?.vendedor_nome ?? "",
      foto_pedido_url: (fotoUrl || existingRec?.foto_pedido_url) ?? "",
      anexo_1_url: (anexo1Url || existingRec?.anexo_1_url) ?? "",
      anexo_2_url: (anexo2Url || existingRec?.anexo_2_url) ?? "",
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

    // Upsert: NUNCA cria duplicata — se existingRec existe, atualiza; senão, cria.
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