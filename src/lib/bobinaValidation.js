// Shared validation for bobina selection against Odoo-required espessura + origem.
// Used across all bobina selection points (Nova Ordem, validação etiqueta, retrabalho, vinculação).

export function parseEspessuraToNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const s = String(value).trim();
  if (!s) return null;
  // Extrai o primeiro número decimal da string (suporta "0,43", "0.43", "0.43mm", "0,43 mm", etc.)
  const match = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const numStr = match[1].replace(",", ".");
  const n = parseFloat(numStr);
  return isNaN(n) ? null : n;
}

// Returns array of numeric espessuras from a bobina (utilizada OR real OR chapa/espessura_mm).
export function getBobinaEspessuras(bobina) {
  if (!bobina) return [];
  const vals = [];
  const add = (v) => {
    if (v == null) return;
    const parts = String(v).split("/");
    for (const p of parts) {
      const n = parseEspessuraToNumber(p);
      if (n != null && !vals.includes(n)) vals.push(n);
    }
  };
  add(bobina.espessura_utilizada);
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
      return reqNum != null && tn != null && Math.abs(tn - reqNum) < 1e-4;
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
    const minVal = parseEspessuraToNumber(tol.min_aceitavel) ?? tol.min_aceitavel;
    const maxVal = parseEspessuraToNumber(tol.max_aceitavel) ?? tol.max_aceitavel;
    const within = bobEspessuras.some((e) => e >= (minVal - 0.005) && e <= (maxVal + 0.005));
    return within
      ? { ok: true, reason: null }
      : {
          ok: false,
          reason: "espessura",
          detail: `Espessura da bobina (${bobEspessuras.join(" / ")}mm) fora da faixa aceitável (${tol.min_aceitavel}–${tol.max_aceitavel}mm) para o pedido de ${espessuraExigida}mm`,
        };
  }
  // No tolerance configured → exact match (com tolerância de ponto flutuante)
  const reqNum = parseEspessuraToNumber(espessuraExigida);
  if (reqNum != null) {
    const match = bobEspessuras.some((e) => Math.abs(e - reqNum) < 0.02);
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

function normalizeOrigem(val) {
  const s = String(val || "").toLowerCase().trim();
  if (!s || s === "ambas" || s === "todas" || s === "qualquer") return "ambas";
  if (s.includes("nac")) return "nacional";
  if (s.includes("imp")) return "importado";
  return s;
}

export function isOrigemCompatible(bobina, origemExigida) {
  const reqNorm = normalizeOrigem(origemExigida);
  if (reqNorm === "ambas") return { ok: true, reason: null };
  const bobOrigem = bobina?.origem || (String(bobina?.qualidade || "").toUpperCase().includes("IMP") ? "Importado" : "Nacional");
  const bobNorm = normalizeOrigem(bobOrigem);
  if (bobNorm === reqNorm) return { ok: true, reason: null };
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
  if (!bobinas || !Array.isArray(bobinas)) return [];
  if (!opts || (!opts.espessuraExigida && (!opts.origemExigida || opts.origemExigida === "ambas"))) return bobinas;
  return bobinas.filter((b) => validarBobina(b, opts).ok);
}