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
  itensTelha = 0,
  itensCd = 0,
  itensFrisada = 0,
  itens = []
}) {
  // Garante identificação precisa se tiver o array de itens completo
  let temFrisada = itensFrisada > 0;
  let temTelha = itensTelha > 0;
  let temCd = itensCd > 0;

  if (Array.isArray(itens) && itens.length > 0) {
    const cat = (s) => String(s || "").toLowerCase();
    for (const it of itens) {
      const t = cat(it.categoria) + " " + cat(it.produto) + " " + cat(it.descricao) + " " + cat(it.observacao);
      if (/frisad/.test(t)) {
        temFrisada = true;
      } else if (/telha|tp[- ]?\d|ondulada|colonial|bandeja|cumeeira|painel|bobinin/.test(t)) {
        temTelha = true;
      } else {
        temCd = true;
      }
    }
  }

  const lojaNormalizada = normalizarLojaVenda(lojaVenda);

  // REGRA SUPREMA 1: Se tem Frisada -> SEMPRE MATRIZ
  if (temFrisada) {
    return {
      unidade: "Matriz AJL",
      lojaVenda: lojaNormalizada,
      motivoRoteamento: "Frisadas são fabricadas exclusivamente na Matriz AJL.",
      roteadoDeOutraLoja: lojaNormalizada !== "Matriz AJL"
    };
  }

  // REGRA 2: Se é apenas Corte & Dobra (sem telha)
  if (temCd && !temTelha) {
    if (lojaNormalizada === "Ivaiporã") {
      return {
        unidade: "Ivaiporã",
        lojaVenda: "Ivaiporã",
        motivoRoteamento: "C&D vendido e fabricado em Ivaiporã.",
        roteadoDeOutraLoja: false
      };
    }
    // Pinhais, Ponta Grossa ou Matriz -> Matriz
    return {
      unidade: "Matriz AJL",
      lojaVenda: lojaNormalizada,
      motivoRoteamento: lojaNormalizada === "Matriz AJL"
        ? "C&D fabricado na Matriz AJL."
        : `C&D vendido em ${lojaNormalizada} direcionado para fabricação na Matriz AJL.`,
      roteadoDeOutraLoja: lojaNormalizada !== "Matriz AJL"
    };
  }

  // REGRA 3: Se tem Telha
  if (temTelha) {
    if (lojaNormalizada === "Pinhais") {
      return {
        unidade: "Pinhais",
        lojaVenda: "Pinhais",
        motivoRoteamento: "Telhas perfiladas na fábrica de Pinhais.",
        roteadoDeOutraLoja: false
      };
    }

    if (lojaNormalizada === "Ivaiporã") {
      return {
        unidade: "Ivaiporã",
        lojaVenda: "Ivaiporã",
        motivoRoteamento: "Telhas perfiladas na fábrica de Ivaiporã.",
        roteadoDeOutraLoja: false
      };
    }

    // Ponta Grossa e Matriz -> Matriz
    return {
      unidade: "Matriz AJL",
      lojaVenda: lojaNormalizada,
      motivoRoteamento: lojaNormalizada === "Matriz AJL"
        ? "Telhas perfiladas na Matriz AJL."
        : `Telhas vendidas em ${lojaNormalizada} direcionadas para fabricação na Matriz AJL.`,
      roteadoDeOutraLoja: lojaNormalizada !== "Matriz AJL"
    };
  }

  // Fallback se não identificado: Ivaiporã se foi em Ivaiporã, senão Matriz
  if (lojaNormalizada === "Ivaiporã") {
    return {
      unidade: "Ivaiporã",
      lojaVenda: "Ivaiporã",
      motivoRoteamento: "Produção direcionada a Ivaiporã.",
      roteadoDeOutraLoja: false
    };
  }

  return {
    unidade: "Matriz AJL",
    lojaVenda: lojaNormalizada,
    motivoRoteamento: "Produção na Matriz AJL.",
    roteadoDeOutraLoja: lojaNormalizada !== "Matriz AJL"
  };
}
