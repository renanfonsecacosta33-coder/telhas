import { classGrupo } from "@/lib/pedidoOdooHelper";

// Regras de Roteamento Industrial e Normalização de Lojas da Central PCP - AJL Ferro & Aço
// Lojas e Filiais Suportadas:
// - "Matriz AJL" (Comércio Atacadista de Ferragens e Ferramentas)
// - "Pinhais" (AJL - Pinhais)
// - "Ivaiporã" (Ivaiporã / IVP)
// - "Ponta Grossa" (Ponta Grossa / PG)

export const FILIAIS_PCP = [
  { id: "Matriz AJL", nome: "Matriz AJL", label: "🏢 Matriz AJL", sigla: "MTZ", cor: "orange" },
  { id: "Pinhais", nome: "Pinhais", label: "🏭 Pinhais", sigla: "PNH", cor: "blue" },
  { id: "Ivaiporã", nome: "Ivaiporã", label: "🌾 Ivaiporã", sigla: "IVP", cor: "emerald" },
  { id: "Ponta Grossa", nome: "Ponta Grossa", label: "🌲 Ponta Grossa", sigla: "PG", cor: "violet" }
];

/**
 * Identifica se um campo de armazenagem / estoque corresponde à filial de Pinhais
 */
export function isLocalArmazenagemPinhais(val) {
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

/**
 * Extrai o local de armazenagem / estoque de um pedido ou item Odoo
 */
export function extrairLocalArmazenagem(bodyOrItem) {
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

/**
 * Normaliza o nome da empresa comercial ou vendedor enviado pelo Odoo ERP
 * para uma das 4 lojas do ecossistema AJL.
 */
export function normalizarLojaVenda(empresaRaw, vendedorNome = "") {
  const raw = String(empresaRaw || "").trim().toLowerCase();
  const vend = String(vendedorNome || "").trim().toLowerCase();
  const combinado = `${raw} ${vend}`;

  // 1. Pinhais
  if (combinado.includes("pinhais")) {
    return "Pinhais";
  }

  // 2. Ivaiporã
  if (
    combinado.includes("ivaipora") ||
    combinado.includes("ivaiporã") ||
    /\bivp\b/.test(combinado)
  ) {
    return "Ivaiporã";
  }

  // 3. Ponta Grossa / PG
  if (
    combinado.includes("ponta grossa") ||
    combinado.includes("pontagrossa") ||
    /\bpg\b/.test(combinado) ||
    combinado.includes("ajl pg")
  ) {
    return "Ponta Grossa";
  }

  // 4. Matriz AJL (Comércio Atacadista de Ferragens e Ferramentas)
  if (
    combinado.includes("matriz") ||
    combinado.includes("atacadista") ||
    combinado.includes("ferragens e ferramentas") ||
    combinado.includes("ferramentas") ||
    combinado.includes("comercio")
  ) {
    return "Matriz AJL";
  }

  // Fallback padrão se não especificado: Matriz AJL
  return "Matriz AJL";
}

/**
 * Calcula a unidade fabril responsável pela produção (Central PCP de destino)
 * aplicando as regras estritas da AJL:
 *
 * 1. SE É FRISADA SEMPRE É NA MATRIZ:
 *    - Independente de onde foi vendida (Pinhais, PG, Ivaiporã ou Matriz), frisadas são fabricadas exclusivamente na Matriz AJL.
 *
 * 2. SE MATERIAL É DE CORTE E DOBRA (C&D):
 *    - Vendido na MATRIZ   -> Produção na MATRIZ AJL
 *    - Vendido em PINHAIS  -> Produção na MATRIZ AJL (Pinhais não corta/dobra)
 *    - Vendido em PG       -> Produção na MATRIZ AJL (PG não corta/dobra)
 *    - Vendido em IVAIPORÃ -> Produção em IVAIPORÃ (Ivaiporã tem maquinário de C&D)
 *
 * 3. SE MATERIAL É DE TELHA:
 *    - Vendido na MATRIZ   -> Produção na MATRIZ AJL
 *    - Vendido em PINHAIS  -> Produção em PINHAIS (Pinhais perfila telhas)
 *    - Vendido em PG       -> Produção na MATRIZ AJL (PG não perfila telhas)
 *    - Vendido em IVAIPORÃ -> Produção em IVAIPORÃ (Ivaiporã perfila telhas)
 */
export function rotearUnidadeProducao({
  lojaVenda = "Matriz AJL",
  localArmazenagem = "",
  itensTelha = 0,
  itensCd = 0,
  itensFrisada = 0,
  itens = []
}) {
  // Garante identificação precisa se tiver o array de itens completo
  let temFrisada = itensFrisada > 0;
  let temTelha = itensTelha > 0;
  let temCd = itensCd > 0;
  let armazenagemPinhais = isLocalArmazenagemPinhais(localArmazenagem);

  if (Array.isArray(itens) && itens.length > 0) {
    for (const it of itens) {
      const g = classGrupo(it);
      if (g === "frisada") temFrisada = true;
      else if (g === "telha") temTelha = true;
      else if (g === "cd") temCd = true;

      const locItem = extrairLocalArmazenagem(it);
      if (isLocalArmazenagemPinhais(locItem)) {
        armazenagemPinhais = true;
      }
    }
  }

  const lojaNormalizada = normalizarLojaVenda(lojaVenda);

  // REGRA SUPREMA 1: Se tem Frisada -> SEMPRE MATRIZ (Pinhais não fabrica frisadas)
  if (temFrisada) {
    return {
      unidade: "Matriz AJL",
      lojaVenda: lojaNormalizada,
      localArmazenagem: armazenagemPinhais ? "Pinhais" : (localArmazenagem || ""),
      motivoRoteamento: "Frisadas são fabricadas exclusivamente na Matriz AJL (Pinhais não fabrica frisadas).",
      roteadoDeOutraLoja: lojaNormalizada !== "Matriz AJL"
    };
  }

  // REGRA SUPREMA 2: Se é apenas Corte & Dobra (sem telha) -> SEMPRE MATRIZ ou Ivaiporã (Pinhais não tem C&D)
  if (temCd && !temTelha) {
    if (lojaNormalizada === "Ivaiporã") {
      return {
        unidade: "Ivaiporã",
        lojaVenda: "Ivaiporã",
        localArmazenagem: localArmazenagem || "",
        motivoRoteamento: "C&D vendido e fabricado em Ivaiporã.",
        roteadoDeOutraLoja: false
      };
    }
    // Pinhais, Ponta Grossa ou Matriz -> Matriz
    return {
      unidade: "Matriz AJL",
      lojaVenda: lojaNormalizada,
      localArmazenagem: armazenagemPinhais ? "Pinhais" : (localArmazenagem || ""),
      motivoRoteamento: lojaNormalizada === "Matriz AJL"
        ? "C&D fabricado na Matriz AJL."
        : `C&D vendido em ${lojaNormalizada} direcionado para fabricação na Matriz AJL (Pinhais não possui corte & dobra).`,
      roteadoDeOutraLoja: lojaNormalizada !== "Matriz AJL"
    };
  }

  // REGRA ESPECIAL PINHAIS: Se for TELHAS e o local de armazenagem for Pinhais -> VAI DIRETO PARA PINHAIS!
  if (temTelha && armazenagemPinhais) {
    return {
      unidade: "Pinhais",
      lojaVenda: lojaNormalizada,
      localArmazenagem: "Pinhais",
      motivoRoteamento: "Telhas com local de armazenagem em Pinhais direcionadas diretamente à fábrica de Pinhais.",
      roteadoDeOutraLoja: lojaNormalizada !== "Pinhais"
    };
  }

  // REGRA 3: Se tem Telha (roteamento padrão por loja de venda)
  if (temTelha) {
    if (lojaNormalizada === "Pinhais") {
      return {
        unidade: "Pinhais",
        lojaVenda: "Pinhais",
        localArmazenagem: localArmazenagem || "",
        motivoRoteamento: "Telhas perfiladas na fábrica de Pinhais.",
        roteadoDeOutraLoja: false
      };
    }

    if (lojaNormalizada === "Ivaiporã") {
      return {
        unidade: "Ivaiporã",
        lojaVenda: "Ivaiporã",
        localArmazenagem: localArmazenagem || "",
        motivoRoteamento: "Telhas perfiladas na fábrica de Ivaiporã.",
        roteadoDeOutraLoja: false
      };
    }

    // Ponta Grossa e Matriz -> Matriz
    return {
      unidade: "Matriz AJL",
      lojaVenda: lojaNormalizada,
      localArmazenagem: localArmazenagem || "",
      motivoRoteamento: lojaNormalizada === "Matriz AJL"
        ? "Telhas perfiladas na Matriz AJL."
        : `Telhas vendidas em ${lojaNormalizada} direcionadas para fabricação na Matriz AJL.`,
      roteadoDeOutraLoja: lojaNormalizada !== "Matriz AJL"
    };
  }

  // Fallback se não identificado
  if (lojaNormalizada === "Ivaiporã") {
    return {
      unidade: "Ivaiporã",
      lojaVenda: "Ivaiporã",
      localArmazenagem: localArmazenagem || "",
      motivoRoteamento: "Produção direcionada a Ivaiporã.",
      roteadoDeOutraLoja: false
    };
  }

  return {
    unidade: "Matriz AJL",
    lojaVenda: lojaNormalizada,
    localArmazenagem: localArmazenagem || "",
    motivoRoteamento: "Produção na Matriz AJL.",
    roteadoDeOutraLoja: lojaNormalizada !== "Matriz AJL"
  };
}
