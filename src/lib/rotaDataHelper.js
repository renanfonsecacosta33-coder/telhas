// Utilitários compartilhados de data, fotos e filtros das rotas de entrega.
const MESES_PT = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };

export function parseEntregaDate(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return new Date(ano, +m[2] - 1, +m[1]);
  }
  m = s.match(/^(\d{1,2})\/([a-zç]{3})/);
  if (m) {
    const mes = MESES_PT[m[2]];
    if (mes === undefined) return null;
    return new Date(new Date().getFullYear(), mes, +m[1]);
  }
  m = s.match(/^(\d{1,2})\s+de\s+([a-zç]{3,})/);
  if (m) {
    const mes = MESES_PT[m[2].substring(0, 3)];
    if (mes === undefined) return null;
    return new Date(new Date().getFullYear(), mes, +m[1]);
  }
  return null;
}

export function chaveDia(str) {
  const d = parseEntregaDate(str);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isRotaExpirada(rota) {
  const d = parseEntregaDate(rota.entrega_date);
  if (!d) return false;
  const entrega = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const hoje = new Date();
  const hojeMid = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diaSeguinte = new Date(entrega);
  diaSeguinte.setDate(diaSeguinte.getDate() + 1);
  return hojeMid >= diaSeguinte;
}

const CAMPOS_FOTOS = [
  "fotos_telhas_json",
  "fotos_corte_dobra_json",
  "fotos_expedicao_json",
  "fotos_caminhao_traseira_json",
];

// Quantidade de barracões/etapas com pelo menos uma foto registrada.
export function contarFotos(rota) {
  let total = 0;
  CAMPOS_FOTOS.forEach((campo) => {
    let qtd = 0;
    try {
      const arr = JSON.parse(rota[campo] || "[]");
      qtd = Array.isArray(arr) ? arr.length : 0;
    } catch {
      qtd = 0;
    }
    if (!qtd && rota[`imagem_carregamento_${campo.replace("fotos_", "").replace("_json", "")}_url`]) qtd = 1;
    if (qtd > 0) total += 1;
  });
  return total;
}

export const TOTAL_SLOTS_FOTOS = CAMPOS_FOTOS.length;

function itensDaRota(rota) {
  try {
    const arr = JSON.parse(rota.itens_json || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function filtrarRotas(rotas, { departamento = null, dataSelecionada = null, busca = "", statusFiltro = "todas", somenteSemFoto = false } = {}) {
  let result = rotas.filter((r) => r.status !== "expedido" && r.status !== "cancelado");

  if (dataSelecionada) {
    result = result.filter((r) => chaveDia(r.entrega_date || r.embarque_date) === dataSelecionada);
  }

  if (departamento) {
    result = result.filter((r) =>
      itensDaRota(r).some((i) => {
        const deps = i.departamentos || [];
        const b = i.barracao_sugerido;
        if (deps.includes(departamento)) return true;
        if (departamento === "telhas" && (b === "telhas" || b === "ambos")) return true;
        if (departamento === "corte_dobra" && (b === "corte_dobra" || b === "ambos")) return true;
        if (departamento === "expedicao") return true;
        return false;
      })
    );
  }

  if (statusFiltro && statusFiltro !== "todas") {
    result = result.filter((r) => (r.status || "distribuido") === statusFiltro);
  }

  if (somenteSemFoto) {
    result = result.filter((r) => contarFotos(r) === 0);
  }

  if (busca && busca.trim()) {
    const q = busca.trim().toLowerCase();
    result = result.filter((r) => {
      if ((r.titulo || "").toLowerCase().includes(q)) return true;
      if ((r.motorista_nome || "").toLowerCase().includes(q)) return true;
      if ((r.placa || "").toLowerCase().includes(q)) return true;
      return itensDaRota(r).some(
        (i) =>
          (i.cliente || "").toLowerCase().includes(q) ||
          String(i.numero_pedido || "").toLowerCase().includes(q) ||
          String(i.numero_odoo || "").toLowerCase().includes(q)
      );
    });
  }

  return result;
}