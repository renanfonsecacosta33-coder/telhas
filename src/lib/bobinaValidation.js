// Shared validation for bobina selection against Odoo-required espessura + origem.
// Used across all bobina selection points (Nova Ordem, validação etiqueta, retrabalho, vinculação).

export function parseEspessuraToNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const s = String(value).replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Returns array of numeric espessuras from a bobina (utilizada OR real OR chapa/espessura_mm).
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
  add(bobina.espessura_mm); // Slitter
  return vals;
}

function normalizeEsp(s) {
  if (s == null) return "";
  return String(s).replace(/\s/g, "").replace(".", ",");
}

// Find tolerance config matching the required espessura (by nominal string or numeric).
export function findTolerancia(espessuraExigida, tolerancias) {
  if (!espessuraExigida || !tolerancias || !tolerancias.length) return null;
  const reqNum = parseEspessuraToNumber(espessuraExigida);
  const reqNorm = normalizeEsp(espessuraExigida);
  return (
    tolerancias.find((t) => normalizeEsp(t.espessura_nominal) === reqNorm && t.ativo !== false) ||
    tolerancias.find((t) => {
      if (t.ativo === false) return false;
      const tn = parseEspessuraToNumber(t.espessura_nominal);
      return reqNum != null && tn != null && Math.abs(tn - reqNum) < 1e-6;
    }) ||
    null
  );
}

export function isEspessuraCompatible(bobina, espessuraExigida, tolerancias) {
  if (!espessuraExigida) return { ok: true, reason: null };
  const bobEspessuras = getBobinaEspessuras(bobina);
  if (bobEspessuras.length === 0) {
    return { ok: false, reason: "espessura", detail: "Bobina sem espessura cadastrada" };
  }
  const tol = findTolerancia(espessuraExigida, tolerancias);
  if (tol && tol.min_aceitavel != null && tol.max_aceitavel != null) {
    const within = bobEspessuras.some((e) => e >= tol.min_aceitavel && e <= tol.max_aceitavel);
    return within
      ? { ok: true, reason: null }
      : {
          ok: false,
          reason: "espessura",
          detail: `Espessura da bobina (${bobEspessuras.join(" / ")}mm) fora da faixa aceitável (${tol.min_aceitavel}–${tol.max_aceitavel}mm) para o pedido de ${espessuraExigida}mm`,
        };
  }
  // No tolerance configured → exact match
  const reqNum = parseEspessuraToNumber(espessuraExigida);
  if (reqNum != null) {
    const match = bobEspessuras.some((e) => Math.abs(e - reqNum) < 1e-6);
    return match
      ? { ok: true, reason: null }
      : {
          ok: false,
          reason: "espessura",
          detail: `Espessura da bobina (${bobEspessuras.join(" / ")}mm) ≠ exigida pelo pedido (${espessuraExigida}mm)`,
        };
  }
  return { ok: true, reason: null };
}

export function isOrigemCompatible(bobina, origemExigida) {
  if (!origemExigida || origemExigida === "ambas") return { ok: true, reason: null };
  const bobOrigem = bobina.origem || "Nacional";
  if (bobOrigem === origemExigida) return { ok: true, reason: null };
  return {
    ok: false,
    reason: "origem",
    detail: `Origem da bobina (${bobOrigem}) incompatível com o pedido Odoo (${origemExigida})`,
  };
}

export function validarBobina(bobina, { espessuraExigida, origemExigida, tolerancias }) {
  const esp = isEspessuraCompatible(bobina, espessuraExigida, tolerancias);
  if (!esp.ok) return esp;
  const ori = isOrigemCompatible(bobina, origemExigida);
  if (!ori.ok) return ori;
  return { ok: true, reason: null };
}

export function filtrarBobinasCompativeis(bobinas, opts) {
  if (!opts || (!opts.espessuraExigida && !opts.origemExigida)) return bobinas;
  return bobinas.filter((b) => validarBobina(b, opts).ok);
}