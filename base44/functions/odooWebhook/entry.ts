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
  const s = value.trim();
  // data URI
  if (DATA_URI_RE.test(value)) return true;
  // Magic numbers de imagem (antes da checagem de URL, pois "/9j/" começa com "/")
  if (s.startsWith("/9j/") || s.startsWith("iVBORw0KGgo") || s.startsWith("R0lGOD") || s.startsWith("UklGR")) return true;
  // URL pública — não é Base64
  if (URL_RE.test(value)) return false;
  // base64 puro (sem prefixo) — exige string longa p/ evitar falso positivo com texto/URL curto
  return B64_RE.test(s) && value.length > 500;
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
  // base64 puro → identifica o MIME pelo magic number
  const raw = value.trim();
  let mime = "image/png";
  if (raw.startsWith("/9j/")) mime = "image/jpeg";
  else if (raw.startsWith("iVBORw0KGgo")) mime = "image/png";
  else if (raw.startsWith("R0lGOD")) mime = "image/gif";
  else if (raw.startsWith("UklGR")) mime = "image/webp";
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
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

    // ── 3. Normalizar itens_json do payload ATUAL (novo lote recebido) ──
    let newItems: any[] = [];
    if (Array.isArray(body?.itens_json)) {
      newItems = body.itens_json;
    } else if (typeof body?.itens_json === "string" && body.itens_json.trim()) {
      try { newItems = JSON.parse(body.itens_json); } catch { newItems = []; }
    }

    // ── 4. Montar cliente + buscar registro existente ──
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    // TRAVA ESTRITA DE ANTIDUPLICIDADE — numero_pedido é chave única.
    // Consulta por match EXATO antes de qualquer create/update.
    const existing = await db.entities.PedidoOdoo.filter({ numero_pedido: numeroPedido });
    const existingRec = existing && existing.length ? existing[0] : null;

    // Higiene: se já existirem duplicatas históricas do mesmo numero_pedido,
    // mantém apenas a mais antiga (existingRec) e remove as demais.
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

    // ── MERGE de itens por 'produto' (SUBSTITUI, nunca soma) ──
    // Cada webhook do Odoo traz 1 item. Se o produto já existe no registro,
    // SUBSTITUIMOS o item pelos dados mais recentes (quantidade, observacao,
    // espessura...). Só adicionamos ao final se for um produto NOVO.
    const itensExistentes: any[] = existingRec?.itens_json
      ? ((() => { try { return JSON.parse(existingRec.itens_json); } catch { return []; } })() as any[])
      : [];
    const mergedItems: any[] = [...itensExistentes];
    for (const novoItem of newItems) {
      const produto = String(novoItem?.produto || "").trim();
      const idx = mergedItems.findIndex(i => String(i?.produto || "").trim() === produto);
      if (idx >= 0) {
        // SUBSTITUI o item existente — NÃO SOMA
        mergedItems[idx] = novoItem;
      } else {
        // Só adiciona se for produto NOVO
        mergedItems.push(novoItem);
      }
    }
    const itensJsonStr = JSON.stringify(mergedItems);

    // Contagem por categoria (recalculada sobre o array MERGED — Rule 4)
    const cat = (s: string) => (s || "").toLowerCase();
    const isTelha = (i: any) => {
      const t = cat(i?.categoria) + " " + cat(i?.produto) + " " + cat(i?.descricao);
      return /telha|tp[- ]?\d|ondulada|colonial|bandeja|cumeeira|painel|bobinin/.test(t);
    };
    const isFrisada = (i: any) => /frisad/.test(cat(i?.categoria) + " " + cat(i?.produto) + " " + cat(i?.descricao));
    const itensTelha = mergedItems.filter(isTelha).length;
    const itensFrisada = mergedItems.filter(isFrisada).length;
    const itensCd = mergedItems.length - itensTelha - itensFrisada;

    // Espessuras distintas (sobre o array MERGED)
    const espSet = new Set<string>();
    mergedItems.forEach((i: any) => {
      const e = i?.espessura || i?.chapa;
      if (e != null && e !== "") espSet.add(String(e));
    });
    const espessurasTags = espSet.size ? JSON.stringify(Array.from(espSet).map(e => ({ espessura: e }))) : "";

    // ── Converte Base64 puro em Data URI pronta para <img> (sem UploadFile) ──
    // Prioriza o campo *_base64 (>100 chars); se não houver, mantém *_url como está.
    const toDataUri = (raw: any): string => {
      if (typeof raw !== "string") return "";
      // Odoo envia Base64 com quebras de linha (MIME) — remove TODOS os espaços/whitespaces.
      const s = raw.replace(/\s+/g, "");
      if (s.length <= 100) return "";
      if (s.startsWith("data:")) return s;
      if (s.startsWith("/9j/")) return `data:image/jpeg;base64,${s}`;
      if (s.startsWith("iVBORw0KGgo")) return `data:image/png;base64,${s}`;
      if (s.startsWith("R0lGOD")) return `data:image/gif;base64,${s}`;
      if (s.startsWith("UklGR")) return `data:image/webp;base64,${s}`;
      return "";
    };
    const anexo1Url = body?.anexo_1_base64 ? toDataUri(body.anexo_1_base64) : (body?.anexo_1_url || "");
    const anexo2Url = body?.anexo_2_base64 ? toDataUri(body.anexo_2_base64) : (body?.anexo_2_url || "");
    // foto_pedido_url: espelha o Data URI do anexo_1 quando anexo_1_base64 presente.
    let fotoUrl = "";
    if (body?.foto_pedido_url) {
      fotoUrl = body.foto_pedido_url;
    } else if (body?.anexo_1_base64 && anexo1Url) {
      fotoUrl = anexo1Url;
    }

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
      odoo_id: (body?.odoo_id != null && String(body.odoo_id).trim() !== "") ? String(body.odoo_id) : (existingRec?.odoo_id ?? ""),
      itens_json: itensJsonStr,
      total_itens: mergedItems.length,
      itens_telha_count: itensTelha,
      itens_cd_count: Math.max(itensCd, 0),
      itens_frisada_count: itensFrisada,
      espessuras_tags: espessurasTags,
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