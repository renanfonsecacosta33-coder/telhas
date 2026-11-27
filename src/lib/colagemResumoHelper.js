import { calcularMetrosPedido, calcMetrosDeKg } from "./metrosHelper";
import { detectarEPSTelha } from "./pedidoOdooHelper";
import { isTelhaBandeja } from "./bandejaHelper";

// Nomes de EPS usados no estoque, na ordem em que aparecem no painel
const EPS_LABELS = {
  "EPS - TP 25": "EPS 25",
  "EPS - TP 40": "EPS 40",
  "EPS - TP 40 BANDEJA": "EPS Bandeja 40",
  "EPS - TP 25 BANDEJA": "EPS Bandeja 25",
  "EPS - COLONIAL": "EPS Colonial",
  "EPS - COLONIAL BANDEJA": "EPS Bandeja Colonial",
  "EPS - ONDULADO": "EPS Ondulado",
};
const EPS_ORDEM = Object.keys(EPS_LABELS);

/** Modelo de colagem de um pedido do chão de fábrica (null = não passa pela colagem). */
export function modeloColagem(p) {
  const prod = String(p?.produto || p?.modelo || "").toUpperCase();
  if (prod.includes("BOBININHA") || prod.includes("CUMEEIRA")) return null;
  if (isTelhaBandeja(p) || prod.includes("BANDEJA")) return "bandeja";
  if (prod.includes("MANTA")) return "manta";
  if (prod.includes("TELHA + EPS + TELHA") || /EPS\s*\+\s*TELHA/.test(prod)) return "eps_telha";
  if (prod.includes("EPS") || prod.includes("SANDU") || prod.includes("TERMO")) return "eps";
  return null;
}

/** Modelo de colagem a partir do texto de um item do Odoo (null = não passa pela colagem). */
export function modeloColagemTexto(texto) {
  const t = String(texto || "").toUpperCase();
  if (t.includes("BOBININHA") || t.includes("CUMEEIRA")) return null;
  if (t.includes("BANDEJA")) return "bandeja";
  if (t.includes("MANTA")) return "manta";
  if (/EPS\s*\+\s*TELHA|TELHA\s*\+\s*EPS\s*\+\s*TELHA|DUPLA/.test(t)) return "eps_telha";
  if (t.includes("EPS") || t.includes("SANDU") || t.includes("TERMO") || t.includes("ISOPOR")) return "eps";
  return null;
}

function chaveEps(tipo) {
  const base = String(tipo || "").split(" (")[0].trim().toUpperCase();
  return EPS_LABELS[base] ? base : "";
}

/** Metros lineares de um item de pedido Odoo (MT direto, KG convertido). */
function metrosDoItem(it) {
  const q = Number(it?.quantidade) || 0;
  if (q <= 0) return 0;
  const u = String(it?.unidade || "").toUpperCase();
  if (u === "KG") {
    const esp = (String(it?.produto || "").match(/\((\d[,.]\d+)\)/) || [])[1];
    return calcMetrosDeKg(q, esp ? Number(String(esp).replace(",", ".")) : 0.43);
  }
  if (u === "MT" || u === "M" || u === "") return q;
  return 0;
}

/**
 * Resumo do que ainda falta colar.
 * Considera todos os pedidos distribuídos no PCP (PedidoOdoo) e as ordens já
 * abertas no chão de fábrica (Pedido), sem contar o mesmo pedido duas vezes.
 */
export function resumirColagem({ pedidos = [], pedidosOdoo = [] } = {}) {
  const porModelo = { eps: 0, manta: 0, eps_telha: 0, bandeja: 0 };
  const eps = {};
  let total = 0;
  let prontos = 0;
  let qtd = 0;

  const somar = (modelo, metros, tipoEps, pronto) => {
    if (!modelo || metros <= 0) return;
    porModelo[modelo] += metros;
    total += metros;
    qtd += 1;
    if (pronto) prontos += metros;
    const chave = tipoEps || "OUTROS";
    eps[chave] = eps[chave] || { metros: 0 };
    eps[chave].metros += metros;
  };

  // 1. Chão de fábrica: verdade física da produção
  const ofsComPedido = new Set();
  (pedidos || []).forEach((p) => {
    if (!p) return;
    if (p.pedido_odoo_id) ofsComPedido.add(p.pedido_odoo_id);
    if (p.of_odoo_id) ofsComPedido.add(`of:${p.of_odoo_id}`);
    if (p.status === "finalizado" || p.status === "cancelado") return;
    const modelo = modeloColagem(p);
    if (!modelo) return;
    const tipoEps = chaveEps(detectarEPSTelha(`${p.produto || ""} ${p.modelo || ""}`, p.maquina));
    const pronto = p.status === "aguardando_colagem" || p.perfilacao_concluida === true;
    somar(modelo, calcularMetrosPedido(p), tipoEps, pronto);
  });

  // 2. Pedidos distribuídos que ainda não chegaram ao chão de fábrica
  (pedidosOdoo || []).forEach((p) => {
    if (!p || !["distribuido", "em_producao"].includes(p.status_pcp)) return;
    if (ofsComPedido.has(p.id)) return;
    if (p.of_odoo_id && ofsComPedido.has(`of:${p.of_odoo_id}`)) return;
    let itens = [];
    try {
      itens = JSON.parse(p.itens_json || "[]");
    } catch {
      itens = [];
    }
    (Array.isArray(itens) ? itens : []).forEach((it) => {
      if (!it || it.concluido || it.status === "cancelado") return;
      const texto = `${it.produto || ""} ${it.descricao || ""} ${it.observacao || ""}`;
      const modelo = modeloColagemTexto(texto);
      if (!modelo) return;
      somar(modelo, metrosDoItem(it), chaveEps(detectarEPSTelha(texto, it.maquina)), false);
    });
  });

  const porEps = Object.entries(eps)
    .map(([chave, v]) => ({
      chave,
      label: EPS_LABELS[chave] || "EPS a definir",
      metros: v.metros,
      pecas: Math.ceil(v.metros / 2),
    }))
    .sort((a, b) => {
      const ia = EPS_ORDEM.indexOf(a.chave);
      const ib = EPS_ORDEM.indexOf(b.chave);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  return { total, prontos, qtd, porModelo, porEps };
}