import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Processador central compartilhado de Webhook do Odoo ERP para as Centrais PCP da AJL Ferro & Aço.
 * Suporta roteamento geral dinâmico ou endpoints dedicados por filial:
 * - /functions/odooWebhook (Roteamento Dinâmico Geral)
 * - /functions/odooWebhookMatriz (Central Matriz AJL)
 * - /functions/odooWebhookPinhais (Central Pinhais)
 * - /functions/odooWebhookIvaipora (Central Ivaiporã)
 * - /functions/odooWebhookPontaGrossa (Central Ponta Grossa)
 */

// ── Helpers de Base64 ──────────────────────────────────────────────
const DATA_URI_RE = /^data:([\w./+-]+);base64,(.+)$/i;
const URL_RE = /^(https?:|blob:|file:|\/)/i;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function isBase64Image(value: any): boolean {
  if (typeof value !== "string" || value.length < 64) return false;
  const s = value.trim();
  if (DATA_URI_RE.test(value)) return true;
  if (s.startsWith("/9j/") || s.startsWith("iVBORw0KGgo") || s.startsWith("R0lGOD") || s.startsWith("UklGR")) return true;
  if (URL_RE.test(value)) return false;
  return B64_RE.test(s) && value.length > 500;
}

function base64ToBlob(value: string): Blob {
  const m = value.match(DATA_URI_RE);
  if (m) {
    const mime = m[1] || "image/png";
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
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

async function resolveImageField(
  value: any,
  field: string,
  integrations: any
): Promise<string> {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return "";
  if (!isBase64Image(v)) return v;

  try {
    const blob = base64ToBlob(v);
    const ext = extFromMime(blob.type);
    const fileName = `odoo_${field}_${Date.now()}.${ext}`;
    const fileObj = new File([blob], fileName, { type: blob.type });
    const res = await integrations.Core.UploadFile({ file: fileObj as any });
    if (res?.file_url) return res.file_url;
    throw new Error("UploadFile não retornou file_url");
  } catch (e: any) {
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

function normalizarUnidadeMedidaOdoo(it: any): string {
  if (!it || typeof it !== "object") return "UN";

  const prod = String(it.produto || it.product || it.product_name || "").trim();
  const desc = String(it.descricao || it.description || it.observacao || it.obs || "").trim();
  const cat = String(it.categoria || it.category || "").trim().toLowerCase();
  const textoCompleto = `${prod} ${desc}`.toUpperCase();
  const rawUnidade = String(it.unidade || it.uom || it.product_uom || "").trim().toUpperCase();

  if (["KG", "KGS", "QUILO", "QUILOS"].includes(rawUnidade)) {
    return "KG";
  }

  if (
    /\(PADR[AÃ]O\s*-\s*BR\)/i.test(textoCompleto) ||
    /\[PADR[AÃ]O\s*-\s*BR\]/i.test(textoCompleto) ||
    /\bPADR[AÃ]O\s*-\s*BR\b/i.test(textoCompleto) ||
    /\bPOR\s+METRO\s*\(PADR[AÃ]O\s*-\s*BR\)/i.test(textoCompleto) ||
    /\b\(BR\)/i.test(textoCompleto) ||
    /\/BR\b/i.test(textoCompleto)
  ) {
    return "BR";
  }

  if (
    /\(PADR[AÃ]O\s*-\s*UN\)/i.test(textoCompleto) ||
    /\[PADR[AÃ]O\s*-\s*UN\]/i.test(textoCompleto) ||
    /\bPADR[AÃ]O\s*-\s*UN\b/i.test(textoCompleto) ||
    /\(PADR[AÃ]O\s*-\s*P[EÇ]A\)/i.test(textoCompleto) ||
    /\[PADR[AÃ]O\s*-\s*P[EÇ]A\]/i.test(textoCompleto)
  ) {
    return "UN";
  }

  if (
    /\(PADR[AÃ]O\s*-\s*KG\)/i.test(textoCompleto) ||
    /\[PADR[AÃ]O\s*-\s*KG\]/i.test(textoCompleto) ||
    /\bPADR[AÃ]O\s*-\s*KG\b/i.test(textoCompleto)
  ) {
    return "KG";
  }

  const isFrisada = ["frisadas", "frisada"].includes(cat) || /(frisad|lambri)/i.test(textoCompleto);
  const isCd = /(perfil|cantoneir|chapa|chaparia|corte\s*e\s*dobra|corte_dobra|\bcd\b)/i.test(cat) ||
               /(perfil|cantoneir|chapa|chaparia|corte\s*e\s*dobra|corte_dobra)/i.test(textoCompleto);

  if (isCd || isFrisada) {
    if (
      ["BR", "BARRA", "BARRAS"].includes(rawUnidade) ||
      /\bPERFIL\b/i.test(textoCompleto) ||
      /\bTRILHO\b/i.test(textoCompleto) ||
      /\bCANTONEIRA\b/i.test(textoCompleto) ||
      /\bBARRA\b/i.test(textoCompleto) ||
      /\bc\/\s*3000\b/i.test(textoCompleto) ||
      /\bc\/\s*6000\b/i.test(textoCompleto) ||
      /\bc\/\s*2000\b/i.test(textoCompleto) ||
      /\b3000\s*MM\b/i.test(textoCompleto) ||
      /\b6000\s*MM\b/i.test(textoCompleto)
    ) {
      return "BR";
    }

    if (["UN", "UND", "UNID", "UNIDADE", "UNIDADES", "PC", "PCS", "PÇ", "PÇS", "PECA", "PECAS"].includes(rawUnidade)) {
      return "UN";
    }

    if (["KG", "KGS", "QUILO", "QUILOS"].includes(rawUnidade)) {
      return "KG";
    }

    if (isFrisada) {
      return "BR";
    }

    return "KG";
  }

  if (["MT", "M", "METRO", "METROS"].includes(rawUnidade)) return "MT";
  if (["KG", "KGS"].includes(rawUnidade)) return "KG";
  if (["BR", "BARRA", "BARRAS"].includes(rawUnidade)) return "BR";
  if (["UN", "UND", "UNID", "UNIDADE", "UNIDADES", "PC", "PCS", "PÇ", "PÇS", "PECA", "PECAS"].includes(rawUnidade)) return "UN";

  return rawUnidade || "UN";
}

function sanitizarItemOdoo(it: any): any {
  if (!it || typeof it !== "object") return it;

  const itemNormalizado = { ...it };
  if (itemNormalizado.foto_url) itemNormalizado.foto_url = normalizarUrlOdoo(itemNormalizado.foto_url);
  if (itemNormalizado.imagem_url) itemNormalizado.imagem_url = normalizarUrlOdoo(itemNormalizado.imagem_url);
  if (itemNormalizado.anexo_url) itemNormalizado.anexo_url = normalizarUrlOdoo(itemNormalizado.anexo_url);
  if (itemNormalizado.croqui_url) itemNormalizado.croqui_url = normalizarUrlOdoo(itemNormalizado.croqui_url);

  itemNormalizado.unidade = normalizarUnidadeMedidaOdoo(itemNormalizado);

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
    resto = "";
  }

  itemNormalizado.observacao = resto;
  itemNormalizado.descricao = resto;

  const isBobininha = /(bobininha|bobinina|bobina|fita|desbobinamento|desbobinador)/i.test(`${prod} ${candidata}`);
  if (isBobininha) {
    const matchNxM = candidata.match(/\b(\d+)\s*[xX*]\s*(\d+(?:[.,]\d+)?)\s*(?:m\b|mts?\b|metros?|mt\b)?/i);
    if (matchNxM) {
      const qBob = parseInt(matchNxM[1], 10);
      const mBob = parseFloat(matchNxM[2].replace(",", "."));
      if (qBob > 0 && mBob > 0) {
        const totalLinear = +(qBob * mBob).toFixed(2);
        itemNormalizado.quantidade = qBob;
        itemNormalizado.medida = String(Math.round(mBob * 1000));
        itemNormalizado.metragem_total = totalLinear;
        itemNormalizado.unidade = "UN";
      }
    } else {
      const matchCompProd = `${prod} ${candidata}`.match(/\b(\d{1,3})\s*(?:mt|mts|m\b|metros)/i);
      if (matchCompProd) {
        const mBob = parseFloat(matchCompProd[1]);
        const qAtual = Number(itemNormalizado.quantidade) || 1;
        if (mBob > 0 && qAtual >= mBob && qAtual % mBob === 0) {
          itemNormalizado.quantidade = Math.round(qAtual / mBob);
          itemNormalizado.medida = String(Math.round(mBob * 1000));
          itemNormalizado.metragem_total = qAtual;
          itemNormalizado.unidade = "UN";
        }
      }
    }
  }

  return itemNormalizado;
}

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

function isLocalArmazenagemPinhais(val: any): boolean {
  if (!val) return false;
  if (Array.isArray(val)) {
    return val.some(v => isLocalArmazenagemPinhais(v));
  }
  if (typeof val === "object") {
    return isLocalArmazenagemPinhais(val.name || val.label || val.display_name || val.nome || "");
  }
  const s = String(val).toLowerCase();
  return s.includes("pinhais") || /\bpnh\b/.test(s);
}

function extrairLocalArmazenagem(bodyOrItem: any): string {
  if (!bodyOrItem || typeof bodyOrItem !== "object") return "";
  const raw = 
    bodyOrItem.local_armazenagem ||
    bodyOrItem.loja_estoque ||
    bodyOrItem.armazem ||
    bodyOrItem.warehouse_id ||
    bodyOrItem.warehouse ||
    bodyOrItem.location_id ||
    bodyOrItem.location_dest_id ||
    bodyOrItem.location_src_id ||
    bodyOrItem.location ||
    bodyOrItem.estoque_loja ||
    bodyOrItem.local_estoque ||
    "";

  if (Array.isArray(raw)) {
    return String(raw[1] || raw[0] || "").trim();
  }
  if (typeof raw === "object" && raw !== null) {
    return String(raw.name || raw.display_name || raw.nome || "").trim();
  }
  return String(raw).trim();
}

function rotearUnidadeProducao(params: {
  lojaVenda: string;
  localArmazenagem?: string;
  armazenagemPinhais?: boolean;
  itensTelha: number;
  itensCd: number;
  itensFrisada: number;
}): { unidade: string; lojaVenda: string; localArmazenagem: string; motivo: string } {
  const { lojaVenda, localArmazenagem = "", armazenagemPinhais = false, itensTelha, itensCd, itensFrisada } = params;
  const loja = normalizarLojaVenda(lojaVenda);

  // REGRA 1: Se é frisada SEMPRE é na MATRIZ (Pinhais não fabrica frisadas)
  if (itensFrisada > 0) {
    return {
      unidade: "Matriz AJL",
      lojaVenda: loja,
      localArmazenagem: armazenagemPinhais ? "Pinhais" : localArmazenagem,
      motivo: "Frisadas fabricadas exclusivamente na Matriz AJL (Pinhais não possui frisadas)"
    };
  }

  // REGRA 2: Corte & Dobra puro -> SEMPRE MATRIZ ou Ivaiporã (Pinhais não corta/dobra)
  if (itensCd > 0 && itensTelha === 0) {
    if (loja === "Ivaiporã") {
      return { unidade: "Ivaiporã", lojaVenda: "Ivaiporã", localArmazenagem, motivo: "C&D Ivaiporã fabricado em Ivaiporã" };
    }
    return {
      unidade: "Matriz AJL",
      lojaVenda: loja,
      localArmazenagem: armazenagemPinhais ? "Pinhais" : localArmazenagem,
      motivo: `C&D vendido em ${loja} direcionado à Matriz AJL (Pinhais não possui corte & dobra)`
    };
  }

  // REGRA ESPECIAL PINHAIS: Se for TELHAS e o local de armazenagem for Pinhais -> VAI DIRETO PARA PINHAIS!
  if (itensTelha > 0 && armazenagemPinhais) {
    return {
      unidade: "Pinhais",
      lojaVenda: loja,
      localArmazenagem: "Pinhais",
      motivo: "Telhas destinadas ao estoque/armazenagem de Pinhais direcionadas diretamente à fábrica de Pinhais"
    };
  }

  // REGRA 3: Telha (por loja de venda)
  if (itensTelha > 0) {
    if (loja === "Pinhais") {
      return { unidade: "Pinhais", lojaVenda: "Pinhais", localArmazenagem, motivo: "Telhas perfiladas em Pinhais" };
    }
    if (loja === "Ivaiporã") {
      return { unidade: "Ivaiporã", lojaVenda: "Ivaiporã", localArmazenagem, motivo: "Telhas perfiladas em Ivaiporã" };
    }
    return { unidade: "Matriz AJL", lojaVenda: loja, localArmazenagem, motivo: `Telhas vendidas em ${loja} direcionadas à Matriz AJL` };
  }

  if (loja === "Ivaiporã") return { unidade: "Ivaiporã", lojaVenda: "Ivaiporã", localArmazenagem, motivo: "Produção direcionada a Ivaiporã" };
  return { unidade: "Matriz AJL", lojaVenda: loja, localArmazenagem, motivo: "Produção na Matriz AJL" };
}

/**
 * Executa o processamento do webhook do Odoo com suporte a unidade forçada (endpoints dedicados por filial)
 */
export async function processarOdooWebhookCore(req: Request, unidadeForcada?: string): Promise<Response> {
  try {
    // ── 1. Ler corpo da requisição (POST direto do Odoo) ──
    let body: any = {};
    let rawBody = "";
    try {
      rawBody = await req.text();
      if (rawBody) body = JSON.parse(rawBody);
    } catch {
      // corpo não-JSON
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
    } else if (Array.isArray(body?.order_line)) {
      newItems = body.order_line;
    } else if (Array.isArray(body?.lines)) {
      newItems = body.lines;
    } else if (Array.isArray(body?.itens)) {
      newItems = body.itens;
    } else if (body?.produto || body?.product || body?.product_name || body?.product_id) {
      const prodNome = typeof body.product_id === "object" && body.product_id?.[1]
        ? body.product_id[1]
        : (body.produto || body.product || body.product_name || String(body.product_id || ""));
      const descItem = body.descricao || body.observacao || body.name || "";
      const rawUnid = body.product_uom || body.unidade || "";
      const unidCorrigida = normalizarUnidadeMedidaOdoo({
        produto: prodNome,
        descricao: descItem,
        unidade: rawUnid
      });
      newItems = [{
        produto: prodNome,
        descricao: descItem,
        observacao: descItem,
        quantidade: Number(body.product_qty || body.quantidade || body.qty || 1),
        unidade: unidCorrigida,
        medida: body.medida || "",
        espessura: body.espessura || "",
        peso: body.peso || 0,
        status: "pendente"
      }];
    }

    // Se o payload do Odoo veio com todas as order_lines da cotação mas a requisição é sobre uma OF específica
    const ofQtd = Number(body?.product_qty || body?.quantidade || 0);
    const ofProdId = body?.product_id;
    if (newItems.length > 1 && (ofQtd > 0 || ofProdId) && (body?.of_nome || body?.of_odoo_id || body?.odoo_id)) {
      const matchLinhaOf = newItems.find((it: any) => {
        const itQtd = Number(it.quantidade || it.qty || it.product_uom_qty || 0);
        return ofQtd > 0 ? Math.abs(itQtd - ofQtd) < 0.05 : true;
      });
      if (matchLinhaOf) {
        newItems = [matchLinhaOf];
      }
    }

    // Descarta itens que explicitamente não devem ser fabricados
    newItems = newItems.filter((it: any) => {
      if (!it || typeof it !== "object") return false;
      if (it.fabricar === false || it.x_fabricar === false || it.a_fabricar === false || it.produzir === false) {
        return false;
      }
      return true;
    });
    newItems = newItems.map(sanitizarItemOdoo);

    // ── 4. Resolver identificador da OF (odoo_id / of_odoo_id / of_nome) ──
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole;

    const ofIdRaw = body?.of_odoo_id ?? body?.odoo_id;
    const ofId = ofIdRaw != null && String(ofIdRaw).trim() !== "" ? String(ofIdRaw).trim() : null;
    const ofNome = (body?.of_nome || "").toString().trim();
    const isNovaOf = Boolean(body?.nova_of);

    let existingRec: any = null;
    const duplicatasParaLimpar: string[] = [];

    // Busca otimizada de OF existente
    if (ofId) {
      const byOfId = await db.entities.PedidoOdoo.filter({ of_odoo_id: ofId });
      if (byOfId && byOfId.length > 0) {
        existingRec = byOfId[0];
        if (byOfId.length > 1) {
          duplicatasParaLimpar.push(...byOfId.slice(1).map((d: any) => d.id));
        }
      } else {
        const byOdooId = await db.entities.PedidoOdoo.filter({ odoo_id: ofId });
        if (byOdooId && byOdooId.length > 0) {
          existingRec = byOdooId[0];
          if (byOdooId.length > 1) {
            duplicatasParaLimpar.push(...byOdooId.slice(1).map((d: any) => d.id));
          }
        }
      }
    }

    if (!existingRec && ofNome) {
      const byOfNome = await db.entities.PedidoOdoo.filter({ of_nome: ofNome });
      if (byOfNome && byOfNome.length > 0) {
        existingRec = byOfNome[0];
        if (byOfNome.length > 1) {
          duplicatasParaLimpar.push(...byOfNome.slice(1).map((d: any) => d.id));
        }
      }
    }

    if (!existingRec && numeroPedido) {
      const byPed = await db.entities.PedidoOdoo.filter({ numero_pedido: numeroPedido });
      if (byPed && byPed.length > 0) {
        const match = byPed.find((r: any) => 
          (ofNome && r.of_nome === ofNome) || 
          (ofId && (r.of_odoo_id === ofId || r.odoo_id === ofId))
        );
        if (match) {
          existingRec = match;
        } else if (!ofId && !ofNome && !isNovaOf) {
          existingRec = byPed[0];
        }
      }
    }

    const resetarExecucao = (!existingRec && isNovaOf) || Boolean(body?.reset);

    // ── 5. Tratamento de Cancelamento via Odoo ──
    const isCancelado =
      body?.state === "cancel" ||
      body?.status === "cancel" ||
      body?.status_pcp === "cancelado" ||
      body?.cancelado === true ||
      body?.action === "cancel";

    if (isCancelado && existingRec) {
      await db.entities.PedidoOdoo.update(existingRec.id, {
        status_pcp: "cancelado",
        motivo_cancelamento: body?.motivo || "Cancelado pelo Odoo ERP",
        data_cancelamento: new Date().toISOString()
      });

      try {
        const opsTelhas = await db.entities.Pedido.filter({ numero_pedido: numeroPedido });
        for (const op of opsTelhas) {
          if (op.status !== "cancelado") {
            await db.entities.Pedido.update(op.id, {
              status: "cancelado",
              observacoes: `${op.observacoes || ""} [Cancelado pelo Odoo ERP]`.trim()
            });
          }
        }
      } catch (e) {
        console.warn("[odooWebhook] Erro ao cancelar OPs de Telhas:", e);
      }

      try {
        const opsCD = await db.entities.OrdemMaquinaCD.filter({ numero_pedido: numeroPedido });
        for (const op of opsCD) {
          if (op.status !== "cancelado") {
            await db.entities.OrdemMaquinaCD.update(op.id, {
              status: "cancelado",
              observacoes: `${op.observacoes || ""} [Cancelado pelo Odoo ERP]`.trim()
            });
          }
        }
      } catch (e) {
        console.warn("[odooWebhook] Erro ao cancelar OPs de CD:", e);
      }

      try {
        await db.entities.Notificacao.create({
          titulo: `❌ Pedido Odoo #${numeroPedido} CANCELADO`,
          mensagem: `O pedido #${numeroPedido} (${existingRec.cliente_nome || "Cliente"}) foi cancelado no Odoo ERP. OPs vinculadas foram suspensas e marcadas como canceladas.`,
          tipo: "alerta",
          unidade: existingRec.unidade || "Todas",
          link: "/pcp",
          autor_nome: "Odoo ERP",
          data_hora: new Date().toISOString(),
          lida: false
        });
      } catch (e) {
        console.warn("[odooWebhook] Falha ao registrar Notificacao de cancelamento:", e);
      }

      return Response.json({
        status: "success",
        action: "cancelled",
        numero_pedido: numeroPedido,
        id: existingRec.id
      }, { status: 200 });
    }

    // ── 6. Merge de itens ──
    let mergedItems: any[] = [];
    if (existingRec && !resetarExecucao) {
      const itensExistentes: any[] = existingRec?.itens_json
        ? ((() => { try { return JSON.parse(existingRec.itens_json); } catch { return []; } })() as any[])
        : [];
      mergedItems = [...itensExistentes];
      const normalizar = (s: any) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
      const EXEC_FIELDS = ["concluido", "status", "status_detalhado", "maquina", "distribuido", "iniciada", "foto_url", "bobina_superior_id", "bobina_superior", "bobina_inferior_id", "bobina_inferior", "setor_forcado"];
      for (const novoItem of newItems) {
        const idx = mergedItems.findIndex(i => normalizar(i?.produto) === normalizar(novoItem?.produto));
        if (idx >= 0) {
          const prev = mergedItems[idx] || {};
          const preservados: Record<string, any> = {};
          for (const f of EXEC_FIELDS) {
            if (prev?.[f] !== undefined && prev?.[f] !== null && prev?.[f] !== "") preservados[f] = prev[f];
          }
          mergedItems[idx] = { ...novoItem, ...preservados };
        } else {
          mergedItems.push(novoItem);
        }
      }
    } else {
      mergedItems = [...newItems];
    }
    const itensJsonStr = JSON.stringify(mergedItems);

    // ── 7. Classificação e contagem de setores ──
    const classificarItem = (i: any): "frisada" | "cd" | "telha" => {
      if (["frisada", "cd", "telha"].includes(i?.setor_forcado)) return i.setor_forcado;
      const t = `${i?.categoria || ""} ${i?.produto || ""} ${i?.descricao || ""} ${i?.observacao || ""}`.toLowerCase();
      const unid = String(i?.unidade || i?.uom || i?.product_uom || "").trim().toUpperCase();

      if (/frisad|lambri/.test(t)) return "frisada";

      const isChapa = /(\bch+a+p+a[s]?\b|\bchpas?\b|\bchaparia\b|\bch\s*[0-9]+[,\.]|\bchapa\s*dobrad)/i.test(t);
      const isPerfilCd = /(perfil|perfis|cantoneir|trilho|barra|tubo|corte\s*e\s*dobra|corte_dobra|\bcd\b|guilhot|slitter|oxicorte|oxiacet|chanfr|dobradeir|dobrada|dobrado|\bdobra\b)/i.test(t);
      const temCotasDobra = /\b\d+\s*x\s*\d+\s*x\s*\d+/i.test(t);
      const temKg = (
        ["KG", "KGS", "QUILO", "QUILOS"].includes(unid) ||
        /\(padr[aã]o\s*-\s*kg\)/i.test(t) ||
        /\[padr[aã]o\s*-\s*kg\]/i.test(t) ||
        /\bpadr[aã]o\s*-\s*kg\b/i.test(t) ||
        /\b\d+([,\.]\d+)?\s*kg\b/i.test(t)
      );
      const isTelhaOuBobininhaExpressa = /\b(telha|bobininha|bobinina|bobina|desbobinamento|cumeeira|calha|rufo|pingadeira)\b/i.test(t);

      if (isChapa || isPerfilCd || temCotasDobra || (temKg && !isTelhaOuBobininhaExpressa)) {
        return "cd";
      }

      return "telha";
    };

    const itensFrisada = mergedItems.filter(i => classificarItem(i) === "frisada").length;
    const itensCd = mergedItems.filter(i => classificarItem(i) === "cd").length;
    const itensTelha = mergedItems.filter(i => classificarItem(i) === "telha").length;

    const espSet = new Set<string>();
    mergedItems.forEach((i: any) => {
      const e = i?.espessura || i?.chapa;
      if (e != null && e !== "") espSet.add(String(e));
    });
    const espessurasTags = espSet.size ? JSON.stringify(Array.from(espSet).map(e => ({ espessura: e }))) : "";

    // ── 8. Anexos e Imagens ──
    const toDataUri = (raw: any): string => {
      if (typeof raw !== "string") return "";
      const s = raw.replace(/\s+/g, "");
      if (s.length <= 100) return "";
      if (s.length > 250000) return "";
      if (s.startsWith("data:")) return s;
      if (s.startsWith("/9j/")) return `data:image/jpeg;base64,${s}`;
      if (s.startsWith("iVBORw0KGgo")) return `data:image/png;base64,${s}`;
      if (s.startsWith("R0lGOD")) return `data:image/gif;base64,${s}`;
      if (s.startsWith("UklGR")) return `data:image/webp;base64,${s}`;
      if (/^[A-Za-z0-9+/=]+$/.test(s)) return `data:image/png;base64,${s}`;
      return "";
    };

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
    const rawFoto = body?.foto_pedido_url || newItems[0]?.foto_url || newItems[0]?.imagem_url || anexo1Url || "";
    const fotoUrl = rawFoto.startsWith("data:") ? rawFoto : normalizarUrlOdoo(rawFoto);

    const nowIso = new Date().toISOString();
    const progressoInicial = body?.progresso_inicial != null ? Number(body.progresso_inicial) : 0;

    // ── 9. Roteamento Industrial e Unidade Fabril ──
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

    const localArmazenagemPayload = extrairLocalArmazenagem(body);
    let armazenagemPinhais = isLocalArmazenagemPinhais(localArmazenagemPayload);
    if (!armazenagemPinhais && mergedItems.some(it => isLocalArmazenagemPinhais(extrairLocalArmazenagem(it)))) {
      armazenagemPinhais = true;
    }

    const roteamento = rotearUnidadeProducao({
      lojaVenda,
      localArmazenagem: localArmazenagemPayload,
      armazenagemPinhais,
      itensTelha,
      itensCd: Math.max(itensCd, 0),
      itensFrisada
    });

    let unidadeCalculada = roteamento.unidade;
    let motivoRoteamento = roteamento.motivo;

    // Aplica Regras Específicas se chamado via Endpoint Dedicado de Central PCP
    if (unidadeForcada) {
      if (unidadeForcada === "Pinhais") {
        if (itensFrisada > 0 || (itensCd > 0 && itensTelha === 0)) {
          // Proteção AJL: Pinhais NÃO tem maquinário de Corte & Dobra nem de Frisadas
          unidadeCalculada = "Matriz AJL";
          motivoRoteamento = "[Roteamento Seguro] Re-roteado para Matriz AJL: Pinhais não produz Corte e Dobra nem Frisadas.";
        } else {
          unidadeCalculada = "Pinhais";
          motivoRoteamento = "Recebido diretamente no Webhook Central PCP Pinhais";
        }
      } else if (unidadeForcada === "Ivaiporã") {
        if (itensFrisada > 0) {
          unidadeCalculada = "Matriz AJL";
          motivoRoteamento = "[Roteamento Seguro] Re-roteado para Matriz AJL: Frisadas fabricadas exclusivamente na Matriz.";
        } else {
          unidadeCalculada = "Ivaiporã";
          motivoRoteamento = "Recebido diretamente no Webhook Central PCP Ivaiporã";
        }
      } else if (unidadeForcada === "Matriz AJL") {
        unidadeCalculada = "Matriz AJL";
        motivoRoteamento = "Recebido diretamente no Webhook Central PCP Matriz AJL";
      } else if (unidadeForcada === "Ponta Grossa") {
        unidadeCalculada = "Ponta Grossa";
        motivoRoteamento = "Recebido diretamente no Webhook Central PCP Ponta Grossa";
      } else {
        unidadeCalculada = unidadeForcada;
      }
    }

    // Se a ordem já foi transferida manualmente pelo PCP, respeita a filial de transferência
    if (existingRec?.unidade_transferida_de) {
      unidadeCalculada = existingRec.unidade;
    }

    const rawOc = (
      body?.numero_oc ||
      body?.numero_da_oc ||
      body?.oc ||
      body?.ordem_compra ||
      body?.numero_ordem_compra ||
      body?.client_order_ref ||
      body?.client_order_reference ||
      body?.ref_oc ||
      body?.purchase_order ||
      existingRec?.numero_oc ||
      ""
    ).toString().trim();

    const record: Record<string, any> = {
      numero_pedido: numeroPedido,
      numero_oc: rawOc || existingRec?.numero_oc || "",
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
      local_armazenagem: (armazenagemPinhais ? "Pinhais" : localArmazenagemPayload) || existingRec?.local_armazenagem || "",
      prioridade: body?.prioridade ?? existingRec?.prioridade ?? false,
      itens_json: itensJsonStr,
      total_itens: mergedItems.length,
      itens_telha_count: itensTelha,
      itens_cd_count: Math.max(itensCd, 0),
      itens_frisada_count: itensFrisada,
      espessuras_tags: espessurasTags,
      data_recebimento: nowIso,
      percentual_concluido: resetarExecucao
        ? progressoInicial
        : (body?.progresso_inicial != null ? Number(body.progresso_inicial) : (body?.percentual_concluido != null ? Number(body.percentual_concluido) : (existingRec?.percentual_concluido ?? 0))),
      status_pcp: resetarExecucao
        ? "pendente_distribuicao"
        : (body?.status_pcp || existingRec?.status_pcp || "pendente_distribuicao"),
    };

    if (motivoRoteamento && !record.motivo_transferencia && existingRec?.motivo_transferencia) {
      record.motivo_transferencia = existingRec.motivo_transferencia;
    }

    Object.keys(record).forEach(k => { if (record[k] === undefined) delete record[k]; });

    // ── 10. Upsert e Notificação ──
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

    if (duplicatasParaLimpar.length > 0) {
      (async () => {
        for (const dupId of duplicatasParaLimpar) {
          try {
            await db.entities.PedidoOdoo.delete(dupId);
          } catch (err: any) {
            console.warn(`[odooWebhook] Falha ao remover duplicata fantasma ${dupId}:`, err?.message);
          }
        }
      })().catch(() => {});
    }

    return Response.json({
      status: "success",
      action: existingRec ? "updated" : "created",
      numero_pedido: numeroPedido,
      of_odoo_id: ofId,
      of_nome: ofNome,
      unidade: unidadeCalculada,
      id: result?.id || existingRec?.id,
    }, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Erro interno no webhook" }, { status: 500 });
  }
}
