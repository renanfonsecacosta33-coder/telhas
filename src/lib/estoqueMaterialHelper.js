import { extrairEspecificacao } from "./descricaoExtractor.js";
import { getItens, classGrupo } from "./pedidoOdooHelper.js";

/**
 * Normaliza espessura para formato numérico float.
 * Aceita "0,43", "0.43", "1,95", etc.
 */
export function parseEspessuraToNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const s = String(value).replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Normaliza espessura em string formatada brasileira (ex: "0,43", "1,95").
 */
export function normalizeEspessura(val) {
  if (val == null || val === "") return "";
  const n = parseEspessuraToNumber(val);
  if (n == null) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Extrai a espessura da descrição ou nome do produto se não houver campo explícito.
 */
export function extrairEspessuraDoTexto(texto) {
  if (!texto) return null;
  const str = String(texto);
  
  // 1. Regex entre parênteses: (0,43) ou (1.95)
  const mPar = str.match(/\((\d+[.,]\d+)\)/);
  if (mPar) return mPar[1].replace(".", ",");

  // 2. Notação de chapa: ch 1,95 ou ch. 1.95 ou chapa 1,95
  const mCh = str.match(/(?:ch\b|ch\.|chapa)\s*(\d+[.,]\d+)/i);
  if (mCh) return mCh[1].replace(".", ",");

  // 3. Notação em milímetros: 0,43mm ou 0.43 mm ou 1,95mm
  const mMm = str.match(/(\d+[.,]\d+)\s*mm/i);
  if (mMm) return mMm[1].replace(".", ",");

  // 4. Polegadas fracionárias comuns na metalurgia
  if (str.includes("5/16")) return "7,93";
  if (str.includes("1/4")) return "6,35";
  if (str.includes("3/16")) return "4,75";
  if (str.includes("1/8")) return "3,17";
  if (str.includes("1/2")) return "12,70";

  return null;
}

/**
 * Extrai a cor do texto do produto ou descrição.
 */
export function extrairCorDoTexto(texto) {
  if (!texto) return null;
  const CORES = [
    { nome: "Branca", regex: /\b(branc[ao]|white)\b/i },
    { nome: "Preto", regex: /\b(pret[ao]|black)\b/i },
    { nome: "Azul", regex: /\b(azul|blue)\b/i },
    { nome: "Cinza", regex: /\b(cinza|gray|grey)\b/i },
    { nome: "Vermelha", regex: /\b(vermelh[ao]|red)\b/i },
    { nome: "Verde", regex: /\b(verde|green)\b/i },
    { nome: "Bege", regex: /\b(bege|beige)\b/i },
    { nome: "Grafite", regex: /\b(grafite)\b/i },
    { nome: "Terracota", regex: /\b(terracota)\b/i },
    { nome: "Marrom", regex: /\b(marrom|brown)\b/i }
  ];
  for (const c of CORES) {
    if (c.regex.test(texto)) return c.nome;
  }
  return null;
}

/**
 * Retorna lista de espessuras numéricas suportadas por uma bobina.
 */
export function getBobinaEspessuras(bobina) {
  const vals = [];
  const add = (v) => {
    const n = parseEspessuraToNumber(v);
    if (n != null && !vals.includes(n)) vals.push(n);
  };
  if (bobina.espessura_utilizada) {
    String(bobina.espessura_utilizada).split("/").forEach((p) => add(p));
  }
  add(bobina.espessura_real);
  add(bobina.chapa);
  add(bobina.espessura_mm);
  return vals;
}

/**
 * Verifica se a bobina atende à espessura nominal solicitada (tolerância de até 0,05mm).
 */
export function isEspCompativel(b, espNominal) {
  const reqNum = parseEspessuraToNumber(espNominal);
  if (reqNum == null) return true;
  const bList = getBobinaEspessuras(b);
  if (bList.length === 0) return false;
  return bList.some((e) => Math.abs(e - reqNum) < 0.05);
}

/**
 * Verifica compatibilidade de cor da bobina.
 */
export function isCorCompativel(bCor, itemCor) {
  const ic = (itemCor || "Natural").trim().toLowerCase();
  const bc = (bCor || "Natural").trim().toLowerCase();
  if (ic === "natural" || ic === "galvalume" || ic === "gv" || ic === "gl") {
    return (
      bc.includes("natural") ||
      bc.includes("galv") ||
      bc.includes("gv") ||
      bc.includes("gl") ||
      bc === ""
    );
  }
  return bc.includes(ic) || ic.includes(bc);
}

/**
 * Extrai a demanda em metros lineares e peças de um item.
 */
export function extrairDemandaItem(item) {
  const desc = item.descricao || item.observacao || "";
  const prod = item.produto || "";
  const qtdOdoo = Number(item.quantidade || item.qtd || 1);
  const unid = String(item.unidade || "UN").toUpperCase();

  let pecas = qtdOdoo;
  let metros = 0;
  let compMm = 0;

  const spec = extrairEspecificacao(desc, qtdOdoo, unid);
  if (spec && spec.tem_especificacao) {
    pecas = spec.pecas || pecas;
    metros = spec.metragem_total || 0;
    compMm = spec.comprimento_mm || 0;
  } else if (unid.startsWith("M")) {
    metros = qtdOdoo;
  }

  return { pecas, metros, compMm, spec };
}

/**
 * Avalia a disponibilidade de matéria-prima de um item específico do PCP.
 * Retorna diagnóstico detalhado: disponível, parcial ou indisponível.
 */
export function verificarEstoqueItem(item, { bobinas = [], chapas = [], slitters = [] } = {}, pedido = null) {
  const prod = String(item.produto || item.descricao || "").trim();
  const desc = item.descricao || item.observacao || "";
  const setor = classGrupo(item);

  // Espessura exigida
  let espessura = item.espessura || extrairEspessuraDoTexto(prod) || extrairEspessuraDoTexto(desc) || (setor === "telha" ? "0,43" : "");
  espessura = normalizeEspessura(espessura);

  // Cor exigida
  const cor = item.cor || extrairCorDoTexto(desc) || extrairCorDoTexto(prod) || "Natural";

  // Demanda
  const demanda = extrairDemandaItem(item);

  // Telhas Termoacústicas (sanduíche com EPS/PU) exigem 2 chapas (superior e inferior)
  const isSanduiche = /(sandu[ií]che|termoac[uú]stica|eps|isopor|pir|pu)/i.test(prod);
  const metrosNecessarios = isSanduiche ? demanda.metros * 2 : demanda.metros;

  // ─────────────────────────────────────────────────────────────
  // 1. FÁBRICA DE TELHAS: Verifica Bobinas
  // ─────────────────────────────────────────────────────────────
  if (setor === "telha") {
    const bobsCompativeis = bobinas.filter((b) => {
      if (b.arquivada) return false;
      if (b.setor && b.setor !== "telhas") return false;
      const espOk = isEspCompativel(b, espessura);
      const corOk = isCorCompativel(b.cor, cor);
      const saldoOk = (b.peso_kg || 0) > 0 || (b.metragem_restante || 0) > 0;
      return espOk && corOk && saldoOk;
    });

    const saldoMetros = bobsCompativeis.reduce((acc, b) => {
      if (b.metragem_restante > 0) return acc + b.metragem_restante;
      if (b.metragem > 0) return acc + b.metragem;
      if (b.peso_kg > 0) return acc + Math.round(b.peso_kg / 4.05);
      return acc;
    }, 0);

    const saldoKg = bobsCompativeis.reduce((acc, b) => acc + (b.peso_kg || 0), 0);

    let status = "indisponivel";
    if (bobsCompativeis.length > 0) {
      if (saldoMetros >= metrosNecessarios || metrosNecessarios === 0) {
        status = "disponivel";
      } else {
        status = "parcial";
      }
    }

    const bPrincipal = bobsCompativeis[0];
    let badgeText = "";
    let shortBadge = "";
    let detalhe = "";

    if (status === "disponivel") {
      badgeText = `🟢 Bobina ${bPrincipal?.codigo || ""} (${espessura}mm): ${saldoMetros.toLocaleString()}m disp.`;
      shortBadge = `🟢 Bobina OK (${saldoMetros}m)`;
      detalhe = `Matéria-prima 100% disponível: ${bobsCompativeis.length} bobina(s) em estoque somando ${saldoMetros.toLocaleString()}m (${saldoKg.toLocaleString()}kg). Necessário para o pedido: ${metrosNecessarios || demanda.pecas}m.`;
    } else if (status === "parcial") {
      badgeText = `🟡 Bobina Parcial: ${saldoMetros}m disp. (Nec: ${metrosNecessarios}m)`;
      shortBadge = `🟡 Parcial (${saldoMetros}m)`;
      detalhe = `Saldo insuficiente: Temos ${saldoMetros}m disponíveis, mas o pedido necessita de ${metrosNecessarios}m de chapa.`;
    } else {
      badgeText = `🔴 Falta Bobina: ${espessura ? espessura + "mm" : ""} ${cor} (0m)`;
      shortBadge = `🔴 Sem Bobina (${espessura || "0,43"}mm)`;
      detalhe = `Nenhuma bobina compatível de ${espessura || "0,43"}mm na cor ${cor} encontrada no estoque de Telhas.`;
    }

    return {
      setor: "telha",
      espessura,
      cor,
      status,
      demanda: { ...demanda, metrosNecessarios, isSanduiche },
      saldo: { metros: saldoMetros, kg: saldoKg, bobinasCount: bobsCompativeis.length },
      materiais: bobsCompativeis.map((b) => ({
        tipo: "bobina",
        codigo: b.codigo,
        chapa: b.chapa,
        cor: b.cor,
        metros: b.metragem_restante || Math.round((b.peso_kg || 0) / 4.05),
        peso_kg: b.peso_kg
      })),
      badgeText,
      shortBadge,
      detalhe
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. FRISADAS: Verifica Bobinas de Frisada / Expedição
  // ─────────────────────────────────────────────────────────────
  if (setor === "frisada") {
    const bobsCompativeis = bobinas.filter((b) => {
      if (b.arquivada) return false;
      const espOk = isEspCompativel(b, espessura);
      const saldoOk = (b.peso_kg || 0) > 0 || (b.metragem_restante || 0) > 0;
      return espOk && saldoOk;
    });

    const saldoMetros = bobsCompativeis.reduce((acc, b) => {
      if (b.metragem_restante > 0) return acc + b.metragem_restante;
      if (b.metragem > 0) return acc + b.metragem;
      if (b.peso_kg > 0) return acc + Math.round(b.peso_kg / 4.05);
      return acc;
    }, 0);

    const status =
      bobsCompativeis.length > 0 && (saldoMetros >= demanda.metros || demanda.metros === 0)
        ? "disponivel"
        : bobsCompativeis.length > 0
        ? "parcial"
        : "indisponivel";

    const bPrincipal = bobsCompativeis[0];
    let badgeText = "";
    let shortBadge = "";
    let detalhe = "";

    if (status === "disponivel") {
      badgeText = `🟢 Bobina Frisada ${bPrincipal?.codigo || ""}: ${saldoMetros.toLocaleString()}m disp.`;
      shortBadge = `🟢 Frisada OK (${saldoMetros}m)`;
      detalhe = `Bobinas para frisada disponíveis: ${saldoMetros.toLocaleString()}m em estoque (Necessário: ${demanda.metros || demanda.pecas}m).`;
    } else if (status === "parcial") {
      badgeText = `🟡 Frisada Parcial: ${saldoMetros}m disp. (Nec: ${demanda.metros}m)`;
      shortBadge = `🟡 Parcial (${saldoMetros}m)`;
      detalhe = `Saldo parcial de bobina para frisada: ${saldoMetros}m disponíveis para ${demanda.metros}m necessários.`;
    } else {
      badgeText = `🔴 Falta Bobina Frisada: ${espessura ? espessura + "mm" : ""}`;
      shortBadge = `🔴 Sem Bobina Frisada`;
      detalhe = `Nenhuma bobina de frisada encontrada no estoque para a espessura ${espessura}mm.`;
    }

    return {
      setor: "frisada",
      espessura,
      cor,
      status,
      demanda,
      saldo: { metros: saldoMetros, bobinasCount: bobsCompativeis.length },
      materiais: bobsCompativeis.map((b) => ({
        tipo: "bobina",
        codigo: b.codigo,
        metros: b.metragem_restante,
        peso_kg: b.peso_kg
      })),
      badgeText,
      shortBadge,
      detalhe
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CORTE & DOBRA (C&D): Verifica Chapas E Bobinas E Slitters!
  // ─────────────────────────────────────────────────────────────
  const chapasCompativeis = chapas.filter((c) => {
    if (c.status === "cancelado") return false;
    const espNum = parseEspessuraToNumber(espessura);
    const cEspNum = parseEspessuraToNumber(c.espessura_mm);
    const matchEsp = espNum != null && cEspNum != null ? Math.abs(espNum - cEspNum) < 0.05 : true;
    const qtdDisp = c.quantidade_disponivel != null ? c.quantidade_disponivel : c.quantidade_total;
    return matchEsp && qtdDisp > 0;
  });

  const bobsCDCompativeis = bobinas.filter((b) => {
    if (b.arquivada) return false;
    const espOk = isEspCompativel(b, espessura);
    return espOk && (b.peso_kg || 0) > 0;
  });

  const slittersCompativeis = slitters.filter((s) => {
    const espOk = isEspCompativel(s, espessura);
    return espOk && (s.peso_kg || 0) > 0;
  });

  const totalChapasDisp = chapasCompativeis.reduce(
    (acc, c) => acc + (c.quantidade_disponivel != null ? c.quantidade_disponivel : c.quantidade_total || 0),
    0
  );
  const totalKgBobinas =
    bobsCDCompativeis.reduce((acc, b) => acc + (b.peso_kg || 0), 0) +
    slittersCompativeis.reduce((acc, s) => acc + (s.peso_kg || 0), 0);

  let statusCD = "indisponivel";
  let tipoMaterial = "nenhum";
  let badgeText = "";
  let shortBadge = "";
  let detalhe = "";

  if (totalChapasDisp > 0 && totalKgBobinas > 0) {
    statusCD = "disponivel";
    tipoMaterial = "chapa_e_bobina";
    badgeText = `🟢 Chapa (${totalChapasDisp} un) e Bobina (${totalKgBobinas.toLocaleString()}kg)`;
    shortBadge = `🟢 Chapa & Bobina OK`;
    detalhe = `Pronto para produzir! Temos ${totalChapasDisp} chapa(s) cortada(s) no estoque de chaparia e ${bobsCDCompativeis.length} bobina(s) somando ${totalKgBobinas.toLocaleString()}kg.`;
  } else if (totalChapasDisp > 0) {
    statusCD = "disponivel";
    tipoMaterial = "chapa";
    badgeText = `🟢 Chapa Pronta: ${totalChapasDisp} un em estoque`;
    shortBadge = `🟢 Chapa OK (${totalChapasDisp} un)`;
    detalhe = `Chapas cortadas disponíveis na chaparia: ${totalChapasDisp} peças prontas para guilhotina e dobradeira.`;
  } else if (totalKgBobinas > 0) {
    statusCD = "parcial"; // Bobina existe, mas precisa desbobinar
    tipoMaterial = "bobina";
    badgeText = `🟡 Bobina OK (${totalKgBobinas.toLocaleString()}kg) — Desbobinar`;
    shortBadge = `🟡 Desbobinar (${totalKgBobinas.toLocaleString()}kg)`;
    detalhe = `Sem chapa cortada na chaparia, mas temos ${bobsCDCompativeis.length} bobina(s) (${totalKgBobinas.toLocaleString()}kg) prontas para desbobinadeira.`;
  } else {
    statusCD = "indisponivel";
    tipoMaterial = "nenhum";
    badgeText = `🔴 Falta Chapa e Bobina ${espessura ? espessura + "mm" : ""}`;
    shortBadge = `🔴 Falta Chapa/Bobina`;
    detalhe = `Falta matéria-prima: Nenhuma chapa cortada nem bobina de ${espessura}mm encontrada no estoque de Corte e Dobra.`;
  }

  return {
    setor: "cd",
    espessura,
    cor,
    status: statusCD,
    tipoMaterial,
    demanda,
    saldo: {
      chapasUn: totalChapasDisp,
      bobinasKg: totalKgBobinas,
      chapasCount: chapasCompativeis.length,
      bobinasCount: bobsCDCompativeis.length
    },
    materiais: [
      ...chapasCompativeis.map((c) => ({
        tipo: "chapa",
        codigo: c.codigo,
        espessura: c.espessura_mm,
        qtd: c.quantidade_disponivel || c.quantidade_total
      })),
      ...bobsCDCompativeis.map((b) => ({
        tipo: "bobina",
        codigo: b.codigo,
        espessura: b.chapa,
        peso_kg: b.peso_kg
      }))
    ],
    badgeText,
    shortBadge,
    detalhe
  };
}

/**
 * Avalia todos os itens de uma Ordem de Fabricação (OF) ou Pedido individual.
 */
export function verificarEstoquePedido(pedido, { bobinas = [], chapas = [], slitters = [] } = {}) {
  if (!pedido) {
    return {
      statusGeral: "indisponivel",
      totalItens: 0,
      itensOk: 0,
      itensParcial: 0,
      itensFalta: 0,
      badgeGeral: "🔴 Sem Itens",
      analises: []
    };
  }

  const itens = getItens(pedido);
  if (itens.length === 0) {
    const single = verificarEstoqueItem(pedido, { bobinas, chapas, slitters }, pedido);
    return {
      statusGeral: single.status,
      totalItens: 1,
      itensOk: single.status === "disponivel" ? 1 : 0,
      itensParcial: single.status === "parcial" ? 1 : 0,
      itensFalta: single.status === "indisponivel" ? 1 : 0,
      badgeGeral: single.badgeText,
      shortBadge: single.shortBadge,
      analises: [single]
    };
  }

  const analises = itens.map((it) => verificarEstoqueItem(it, { bobinas, chapas, slitters }, pedido));

  const totalItens = analises.length;
  const itensOk = analises.filter((a) => a.status === "disponivel").length;
  const itensParcial = analises.filter((a) => a.status === "parcial").length;
  const itensFalta = analises.filter((a) => a.status === "indisponivel").length;

  let statusGeral = "disponivel";
  let badgeGeral = "";
  let shortBadge = "";

  if (itensFalta > 0) {
    statusGeral = "indisponivel";
    badgeGeral = `🔴 Falta Matéria-Prima (${itensFalta}/${totalItens} sem estoque)`;
    shortBadge = `🔴 Sem Estoque (${itensFalta})`;
  } else if (itensParcial > 0) {
    statusGeral = "parcial";
    badgeGeral = `🟡 MP Parcial / Desbobinar (${itensParcial}/${totalItens})`;
    shortBadge = `🟡 MP Parcial`;
  } else {
    statusGeral = "disponivel";
    badgeGeral = `🟢 Matéria-Prima 100% Disponível`;
    shortBadge = `🟢 MP 100% OK`;
  }

  return {
    statusGeral,
    totalItens,
    itensOk,
    itensParcial,
    itensFalta,
    badgeGeral,
    shortBadge,
    analises
  };
}

/**
 * Avalia todas as Ordens de Fabricação (OFs) pertencentes a um Pedido Consolidado (Grupo).
 * Retorna o diagnóstico global de matéria-prima do pedido.
 */
export function verificarEstoqueGrupo(grupo, { bobinas = [], chapas = [], slitters = [] } = {}) {
  const ofs = grupo?.ofs || [];
  if (ofs.length === 0) {
    return {
      statusGeral: "indisponivel",
      totalOfs: 0,
      ofsOk: 0,
      ofsParcial: 0,
      ofsFalta: 0,
      badgeGeral: "Sem OFs",
      resumoSetores: { telha: { ok: 0, total: 0 }, cd: { ok: 0, total: 0 }, frisada: { ok: 0, total: 0 } },
      analisesOfs: []
    };
  }

  const analisesOfs = ofs.map((ofItem) => {
    return {
      of: ofItem,
      diagnostico: verificarEstoquePedido(ofItem, { bobinas, chapas, slitters })
    };
  });

  const totalOfs = analisesOfs.length;
  const ofsOk = analisesOfs.filter((a) => a.diagnostico.statusGeral === "disponivel").length;
  const ofsParcial = analisesOfs.filter((a) => a.diagnostico.statusGeral === "parcial").length;
  const ofsFalta = analisesOfs.filter((a) => a.diagnostico.statusGeral === "indisponivel").length;

  let statusGeral = "disponivel";
  let badgeGeral = "";
  let shortBadge = "";

  if (ofsFalta > 0) {
    statusGeral = "indisponivel";
    badgeGeral = `🔴 Falta Matéria-Prima (${ofsFalta} OFs)`;
    shortBadge = `🔴 Falta MP (${ofsFalta})`;
  } else if (ofsParcial > 0) {
    statusGeral = "parcial";
    badgeGeral = `🟡 MP Parcial / Desbobinar (${ofsParcial} OFs)`;
    shortBadge = `🟡 MP Parcial`;
  } else {
    statusGeral = "disponivel";
    badgeGeral = `🟢 Matéria-Prima 100% Pronta`;
    shortBadge = `🟢 MP 100% OK`;
  }

  // Resumo por setor
  const resumoSetores = {
    telha: { total: 0, ok: 0, falta: 0 },
    cd: { total: 0, ok: 0, falta: 0 },
    frisada: { total: 0, ok: 0, falta: 0 }
  };

  analisesOfs.forEach(({ of: p, diagnostico }) => {
    const g = classGrupo(p);
    if (!resumoSetores[g]) resumoSetores[g] = { total: 0, ok: 0, falta: 0 };
    resumoSetores[g].total++;
    if (diagnostico.statusGeral === "disponivel") resumoSetores[g].ok++;
    else if (diagnostico.statusGeral === "indisponivel") resumoSetores[g].falta++;
  });

  return {
    statusGeral,
    totalOfs,
    ofsOk,
    ofsParcial,
    ofsFalta,
    badgeGeral,
    shortBadge,
    resumoSetores,
    analisesOfs
  };
}
