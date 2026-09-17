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

function canonicoTexto(s: any): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/^\s*\d+\s*[-–]?\s*/g, "")
    .replace(/\(padrao[^)]*\)/gi, "")
    .replace(/[^\w\d]/g, "")
    .trim();
}

function normalizarUrlOdoo(url: any): string {
  if (typeof url !== "string") return "";
  let s = url.trim();
  if (s.includes("odoo.com/web/content/")) {
    s = s.replace("/web/content/", "/web/image/");
  } else if (s.startsWith("/web/content/") || s.startsWith("web/content/")) {
    const limpo = s.startsWith("/") ? s.slice(1) : s;
    s = `https://ajlferroeaco.odoo.com/${limpo}`.replace("/web/content/", "/web/image/");
  }
  return s;
}

function sanitizarItemOdoo(it: any): any {
  if (!it || typeof it !== "object") return it;

  // Normalizar URLs de imagem para /web/image/ inline (evita Content-Disposition: attachment)
  const itemNormalizado = { ...it };
  if (itemNormalizado.foto_url) itemNormalizado.foto_url = normalizarUrlOdoo(itemNormalizado.foto_url);
  if (itemNormalizado.imagem_url) itemNormalizado.imagem_url = normalizarUrlOdoo(itemNormalizado.imagem_url);
  if (itemNormalizado.anexo_url) itemNormalizado.anexo_url = normalizarUrlOdoo(itemNormalizado.anexo_url);
  if (itemNormalizado.croqui_url) itemNormalizado.croqui_url = normalizarUrlOdoo(itemNormalizado.croqui_url);

  const prod = String(itemNormalizado.produto || "").trim();
  const obs = String(itemNormalizado.observacao || "").trim();
  const desc = String(itemNormalizado.descricao || "").trim();

  let candidata = obs || (desc !== prod ? desc : "");
  if (!candidata) {
    return { ...itemNormalizado, observacao: "", descricao: "" };
  }

  const cProd = canonicoTexto(prod);
  const cCandidata = canonicoTexto(candidata);

  if (!cCandidata || cCandidata === cProd || (cProd && cProd.includes(cCandidata) && cCandidata.length >= 6)) {
    return { ...itemNormalizado, observacao: "", descricao: "" };
  }

  let resto = candidata;
  const linhas = candidata.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  if (linhas.length > 1 && (canonicoTexto(linhas[0]) === cProd || (cProd && cProd.includes(canonicoTexto(linhas[0]))))) {
    resto = linhas.slice(1).join("\n").trim();
  } else if (prod && resto.toLowerCase().startsWith(prod.toLowerCase())) {
    resto = resto.slice(prod.length).replace(/^[\s\-–—:;,\/]+/, "").trim();
  } else {
    const prodBase = prod
      .replace(/^\[\d+\]\s*/, "")
      .replace(/^\d+\s*[-–]\s*/, "")
      .replace(/\s*\(padr[aã]o[^)]*\)/i, "")
      .trim();
    if (prodBase && prodBase.length >= 4 && resto.toLowerCase().startsWith(prodBase.toLowerCase())) {
      resto = resto.slice(prodBase.length).replace(/^[\s\-–—:;,\/]+/, "").trim();
    }
  }

  const cResto = canonicoTexto(resto);
  if (!cResto || cResto === cProd || (cProd && cProd.includes(cResto) && cResto.length >= 6)) {
    return { ...it, observacao: "", descricao: "" };
  }

  return { ...it, observacao: resto, descricao: resto };
}

// ── Helpers de Roteamento Industrial Central PCP ──────────────────
function normalizarLojaVenda(empresaRaw: any, vendedorNome: any = ""): string {
  const raw = String(empresaRaw || "").trim().toLowerCase();
  const vend = String(vendedorNome || "").trim().toLowerCase();
  const combinado = `${raw} ${vend}`;

  if (combinado.includes("pinhais")) return "Pinhais";
  if (combinado.includes("ivaipora") || combinado.includes("ivaiporã") || /\bivp\b/.test(combinado)) return "Ivaiporã";
  if (combinado.includes("ponta grossa") || combinado.includes("pontagrossa") || /\bpg\b/.test(combinado) || combinado.includes("ajl pg")) return "Ponta Grossa";
  if (combinado.includes("matriz") || combinado.includes("atacadista") || combinado.includes("ferragens e ferramentas") || combinado.includes("ferramentas") || combinado.includes("comercio")) return "Matriz AJL";
  return "Matriz AJL";
}

function rotearUnidadeProducao(params: {
  lojaVenda: string;
  itensTelha: number;
  itensCd: number;
  itensFrisada: number;
}): { unidade: string; lojaVenda: string; motivo: string } {
  const { lojaVenda, itensTelha, itensCd, itensFrisada } = params;
  const loja = normalizarLojaVenda(lojaVenda);

  // REGRA 1: Se é frisada SEMPRE é na MATRIZ
  if (itensFrisada > 0) {
    return { unidade: "Matriz AJL", lojaVenda: loja, motivo: "Frisadas fabricadas exclusivamente na Matriz AJL" };
  }

  // REGRA 2: Corte & Dobra puro
  if (itensCd > 0 && itensTelha === 0) {
    if (loja === "Ivaiporã") {
      return { unidade: "Ivaiporã", lojaVenda: "Ivaiporã", motivo: "C&D Ivaiporã fabricado em Ivaiporã" };
    }
    return { unidade: "Matriz AJL", lojaVenda: loja, motivo: `C&D vendido em ${loja} direcionado à Matriz AJL` };
  }

  // REGRA 3: Telha
  if (itensTelha > 0) {
    if (loja === "Pinhais") {
      return { unidade: "Pinhais", lojaVenda: "Pinhais", motivo: "Telhas perfiladas em Pinhais" };
    }
    if (loja === "Ivaiporã") {
      return { unidade: "Ivaiporã", lojaVenda: "Ivaiporã", motivo: "Telhas perfiladas em Ivaiporã" };
    }
    return { unidade: "Matriz AJL", lojaVenda: loja, motivo: `Telhas vendidas em ${loja} direcionadas à Matriz AJL` };
  }

  if (loja === "Ivaiporã") return { unidade: "Ivaiporã", lojaVenda: "Ivaiporã", motivo: "Produção direcionada a Ivaiporã" };
  return { unidade: "Matriz AJL", lojaVenda: loja, motivo: "Produção na Matriz AJL" };
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
    // Descarta itens que explicitamente não devem ser fabricados (ex: desmarcados na cotação)
    newItems = newItems.filter((it: any) => {
      if (!it || typeof it !== "object") return false;
      if (it.fabricar === false || it.x_fabricar === false || it.a_fabricar === false || it.produzir === false) {
        return false;
      }
      return true;
    });
    newItems = newItems.map(sanitizarItemOdoo);

    // ── 4. Montar cliente + resolver identificador da OF (odoo_id / of_odoo_id / of_nome) ──
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    const ofIdRaw = body?.of_odoo_id ?? body?.odoo_id;
    const ofId = ofIdRaw != null && String(ofIdRaw).trim() !== "" ? String(ofIdRaw).trim() : null;
    const ofNome = (body?.of_nome || "").toString().trim();
    const isNovaOf = Boolean(body?.nova_of);

    let existingRec: any = null;

    // Regra de Ouro: of_odoo_id / odoo_id / of_nome é o identificador único da OF no Odoo.
    // INDEPENDENTE de 'nova_of', se já existe um registro com esse of_odoo_id, odoo_id ou of_nome,
    // trata-se da MESMA Ordem de Fabricação (evita duplicações por retentativa ou loop de webhook).
    if (ofId) {
      const byOfId = await db.entities.PedidoOdoo.filter({ of_odoo_id: ofId });
      if (byOfId && byOfId.length > 0) {
        existingRec = byOfId[0];
      } else {
        const byOdooId = await db.entities.PedidoOdoo.filter({ odoo_id: ofId });
        if (byOdooId && byOdooId.length > 0) {
          existingRec = byOdooId[0];
        }
      }
    }

    if (!existingRec && ofNome) {
      const byOfNome = await db.entities.PedidoOdoo.filter({ of_nome: ofNome });
      if (byOfNome && byOfNome.length > 0) {
        existingRec = byOfNome[0];
      }
    }

    if (!existingRec && ofNome && numeroPedido) {
      const byPed = await db.entities.PedidoOdoo.filter({ numero_pedido: numeroPedido });
      if (byPed && byPed.length > 0) {
        const match = byPed.find((r: any) => r.of_nome === ofNome || (ofId && r.of_odoo_id === ofId));
        if (match) existingRec = match;
      }
    }

    if (!existingRec && !ofId && !ofNome && !isNovaOf) {
      // Fallback legado: se não foi enviado of_odoo_id nem odoo_id nem of_nome, busca por numero_pedido
      const byPed = await db.entities.PedidoOdoo.filter({ numero_pedido: numeroPedido });
      if (byPed && byPed.length > 0) {
        existingRec = byPed[0];
      }
    }

    // ── MERGE de itens: apenas se for atualização da MESMA OF existente ──
    // Se for uma nova_of ou OF inédita, newItems é a lista limpa daquela produção específica.
    let mergedItems: any[] = [];
    if (existingRec && !isNovaOf) {
      const itensExistentes: any[] = existingRec?.itens_json
        ? ((() => { try { return JSON.parse(existingRec.itens_json); } catch { return []; } })() as any[])
        : [];
      mergedItems = [...itensExistentes];
      const normalizar = (s: any) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
      for (const novoItem of newItems) {
        const idx = mergedItems.findIndex(i => normalizar(i?.produto) === normalizar(novoItem?.produto));
        if (idx >= 0) {
          mergedItems[idx] = novoItem;
        } else {
          mergedItems.push(novoItem);
        }
      }
    } else {
      mergedItems = [...newItems];
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
      if (/^[A-Za-z0-9+/=]+$/.test(s)) return `data:image/png;base64,${s}`;
      return "";
    };
    // Se foram enviados anexos em array (anexos, fotos, imagens, imagens_anexos)
    let arrayAnexosPayload: any[] = [];
    if (Array.isArray(body?.anexos)) arrayAnexosPayload = body.anexos;
    else if (Array.isArray(body?.imagens_anexos)) arrayAnexosPayload = body.imagens_anexos;
    else if (Array.isArray(body?.fotos)) arrayAnexosPayload = body.fotos;
    else if (Array.isArray(body?.imagens)) arrayAnexosPayload = body.imagens;

    const resolveAnexo = (idx: number) => {
      const dataUri = toDataUri(body?.[`anexo_${idx}_base64`]) || toDataUri(body?.[`anexo_${idx}_url`]);
      if (dataUri) return dataUri;
      const rawItemArray = arrayAnexosPayload[idx - 1];
      const itemUrl = typeof rawItemArray === "string" ? rawItemArray : (rawItemArray?.url || rawItemArray?.src || rawItemArray?.foto_url || "");
      const rawUrl = body?.[`anexo_${idx}_url`] || body?.[`anexo_${idx}`] || body?.[`anexo${idx}`] || itemUrl || "";
      return normalizarUrlOdoo(rawUrl);
    };

    const anexo1Url = resolveAnexo(1);
    const anexo2Url = resolveAnexo(2);
    const anexo3Url = resolveAnexo(3);
    const anexo4Url = resolveAnexo(4);
    const anexo5Url = resolveAnexo(5);
    const anexo6Url = resolveAnexo(6);
    const anexo7Url = resolveAnexo(7);
    const anexo8Url = resolveAnexo(8);
    const anexo9Url = resolveAnexo(9);
    const anexo10Url = resolveAnexo(10);
    // foto_pedido_url: prioriza o campo específico, a foto do primeiro item ou anexo1Url
    const rawFoto = body?.foto_pedido_url || newItems[0]?.foto_url || newItems[0]?.imagem_url || anexo1Url || "";
    const fotoUrl = rawFoto.startsWith("data:") ? rawFoto : normalizarUrlOdoo(rawFoto);

    const nowIso = new Date().toISOString();

    const progressoInicial = body?.progresso_inicial != null ? Number(body.progresso_inicial) : 0;

    // ── Extração da Empresa/Loja de Venda e Roteamento Industrial ──
    const rawEmpresa = (
      body?.empresa ||
      body?.company_name ||
      body?.empresa_vendedor ||
      body?.vendedor_empresa ||
      (Array.isArray(body?.company_id) ? body?.company_id[1] : body?.company_id) ||
      body?.company ||
      ""
    ).toString().trim();

    const vendedorNome = (body?.vendedor_nome || existingRec?.vendedor_nome || "").toString().trim();
    const lojaVenda = normalizarLojaVenda(rawEmpresa || existingRec?.empresa_venda || existingRec?.loja_venda, vendedorNome);

    // Roteamento industrial estrito da AJL
    const roteamento = rotearUnidadeProducao({
      lojaVenda,
      itensTelha,
      itensCd: Math.max(itensCd, 0),
      itensFrisada
    });

    // Se a ordem já foi transferida manualmente pelo PCP, respeita a filial de destino da transferência
    let unidadeCalculada = roteamento.unidade;
    if (existingRec?.unidade_transferida_de) {
      unidadeCalculada = existingRec.unidade;
    } else if (body?.unidade && body?.unidade !== "Matriz AJL") {
      unidadeCalculada = body.unidade;
    }

    const record: Record<string, any> = {
      numero_pedido: numeroPedido,
      odoo_id: ofId || existingRec?.odoo_id || "",
      of_odoo_id: ofId || existingRec?.of_odoo_id || "",
      of_nome: ofNome || existingRec?.of_nome || "",
      cliente_nome: body?.cliente_nome ?? existingRec?.cliente_nome ?? "",
      vendedor_nome: body?.vendedor_nome ?? existingRec?.vendedor_nome ?? "",
      foto_pedido_url: (fotoUrl || existingRec?.foto_pedido_url) ?? "",
      anexo_1_url: (anexo1Url || existingRec?.anexo_1_url) ?? "",
      anexo_2_url: (anexo2Url || existingRec?.anexo_2_url) ?? "",
      anexo_3_url: (anexo3Url || existingRec?.anexo_3_url) ?? "",
      anexo_4_url: (anexo4Url || existingRec?.anexo_4_url) ?? "",
      anexo_5_url: (anexo5Url || existingRec?.anexo_5_url) ?? "",
      anexo_6_url: (anexo6Url || existingRec?.anexo_6_url) ?? "",
      anexo_7_url: (anexo7Url || existingRec?.anexo_7_url) ?? "",
      anexo_8_url: (anexo8Url || existingRec?.anexo_8_url) ?? "",
      anexo_9_url: (anexo9Url || existingRec?.anexo_9_url) ?? "",
      anexo_10_url: (anexo10Url || existingRec?.anexo_10_url) ?? "",
      identificacao_1: body?.identificacao_1 ?? existingRec?.identificacao_1 ?? "",
      identificacao_2: body?.identificacao_2 ?? existingRec?.identificacao_2 ?? "",
      descricao: body?.descricao ?? existingRec?.descricao ?? "",
      nova_of: isNovaOf,
      data_entrega: body?.data_entrega ?? existingRec?.data_entrega ?? "",
      unidade: unidadeCalculada,
      empresa_venda: rawEmpresa || existingRec?.empresa_venda || "",
      loja_venda: lojaVenda || existingRec?.loja_venda || "Matriz AJL",
      prioridade: body?.prioridade ?? existingRec?.prioridade ?? false,
      itens_json: itensJsonStr,
      total_itens: mergedItems.length,
      itens_telha_count: itensTelha,
      itens_cd_count: Math.max(itensCd, 0),
      itens_frisada_count: itensFrisada,
      espessuras_tags: espessurasTags,
      data_recebimento: nowIso,
      percentual_concluido: (isNovaOf || body?.reset)
        ? progressoInicial
        : (body?.progresso_inicial != null ? Number(body.progresso_inicial) : (body?.percentual_concluido != null ? Number(body.percentual_concluido) : (existingRec?.percentual_concluido ?? 0))),
      status_pcp: (isNovaOf || body?.reset)
        ? "pendente_distribuicao"
        : (body?.status_pcp || existingRec?.status_pcp || "pendente_distribuicao"),
    };
    // Limpa campos undefined
    Object.keys(record).forEach(k => { if (record[k] === undefined) delete record[k]; });

    // Upsert da OF: se existingRec existe (mesma OF), atualiza; senão, cria nova OF.
    let result;
    if (existingRec) {
      result = await db.entities.PedidoOdoo.update(existingRec.id, record);
    } else {
      result = await db.entities.PedidoOdoo.create(record);
      try {
        await db.entities.Notificacao.create({
          titulo: `📦 Novo Pedido Odoo #${numeroPedido}`,
          mensagem: `Cliente: ${record.cliente_nome || "—"} | Loja: ${record.loja_venda || "—"} | Filial de Destino: ${record.unidade}.`,
          tipo: "pedido_odoo",
          unidade: record.unidade || "Todas",
          link: "/pcp",
          autor_nome: "Odoo ERP",
          data_hora: nowIso,
          lida: false
        });
      } catch (e) {
        console.warn("Falha ao registrar Notificacao para odooWebhook:", e);
      }
    }

    return Response.json({
      status: "success",
      action: existingRec ? "updated" : "created",
      numero_pedido: numeroPedido,
      of_odoo_id: ofId,
      of_nome: ofNome,
      id: result?.id || existingRec?.id,
    }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message || "Erro interno no webhook" }, { status: 500 });
  }
}