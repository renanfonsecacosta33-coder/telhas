import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Normaliza qualquer formato de número de pedido:
 * "#299065", "299065", "S00299065", " 299065-01 " -> "299065"
 */
export function limparNumeroPedido(num) {
  if (!num) return "";
  const raw = String(num).trim().toUpperCase();
  const digits = raw.replace(/\D/g, "");
  if (digits) {
    const semZeros = digits.replace(/^0+/, "");
    return semZeros || digits;
  }
  return raw.replace(/^#/, "").trim();
}

/**
 * Classifica um conjunto de pedidos cruzando com as bases de Telhas e Corte & Dobra
 */
export function processarMapaBarracoes({
  pedidosTelhas = [],
  ordensCD = [],
  ordensDesbob = [],
  pedidosOdoo = [],
}) {
  const mapa = {};

  // 1. Processa pedidos de Telhas (OPs nas máquinas perfiladeiras)
  pedidosTelhas.forEach((p) => {
    if (p.status === "cancelado") return;
    const chave = limparNumeroPedido(p.numero_pedido);
    if (!chave) return;

    if (!mapa[chave]) {
      mapa[chave] = {
        chave,
        numero_original: p.numero_pedido,
        cliente: p.cliente || "",
        temTelhas: false,
        temCD: false,
        statusTelhas: null,
        statusCD: null,
        maquinasTelhas: [],
        maquinasCD: [],
        produtosTelhas: [],
        produtosCD: [],
      };
    }

    mapa[chave].temTelhas = true;
    if (p.cliente && !mapa[chave].cliente) mapa[chave].cliente = p.cliente;
    if (p.maquina && !mapa[chave].maquinasTelhas.includes(p.maquina)) {
      mapa[chave].maquinasTelhas.push(p.maquina);
    }
    if (p.produto) mapa[chave].produtosTelhas.push(p.produto);

    const stAtual = mapa[chave].statusTelhas;
    const stNovo = p.status;
    if (!stAtual || stNovo === "em_producao" || (stNovo === "pausado" && stAtual !== "em_producao")) {
      mapa[chave].statusTelhas = stNovo;
    } else if (stAtual === "finalizado" && stNovo !== "finalizado") {
      mapa[chave].statusTelhas = stNovo;
    }
  });

  // 2. Processa ordens de Corte & Dobra (Guilhotinas, Dobradeiras, etc.)
  ordensCD.forEach((o) => {
    if (o.status === "cancelado") return;
    const chave = limparNumeroPedido(o.numero_pedido);
    if (!chave) return;

    if (!mapa[chave]) {
      mapa[chave] = {
        chave,
        numero_original: o.numero_pedido,
        cliente: o.cliente || "",
        temTelhas: false,
        temCD: false,
        statusTelhas: null,
        statusCD: null,
        maquinasTelhas: [],
        maquinasCD: [],
        produtosTelhas: [],
        produtosCD: [],
      };
    }

    mapa[chave].temCD = true;
    if (o.cliente && !mapa[chave].cliente) mapa[chave].cliente = o.cliente;
    if (o.maquina && !mapa[chave].maquinasCD.includes(o.maquina)) {
      mapa[chave].maquinasCD.push(o.maquina);
    }
    if (o.descricao_peca || o.produto) {
      mapa[chave].produtosCD.push(o.descricao_peca || o.produto);
    }

    const stAtual = mapa[chave].statusCD;
    const stNovo = o.status;
    if (!stAtual || stNovo === "em_producao" || (stNovo === "pausado" && stAtual !== "em_producao")) {
      mapa[chave].statusCD = stNovo;
    } else if (stAtual === "finalizado" && stNovo !== "finalizado") {
      mapa[chave].statusCD = stNovo;
    }
  });

  // 3. Processa ordens da Desbobinadeira (Slitter / Chapas)
  ordensDesbob.forEach((o) => {
    if (o.status === "cancelado") return;
    const chave = limparNumeroPedido(o.numero_pedido);
    if (!chave) return;

    if (!mapa[chave]) {
      mapa[chave] = {
        chave,
        numero_original: o.numero_pedido,
        cliente: o.cliente || "",
        temTelhas: false,
        temCD: false,
        statusTelhas: null,
        statusCD: null,
        maquinasTelhas: [],
        maquinasCD: [],
        produtosTelhas: [],
        produtosCD: [],
      };
    }

    mapa[chave].temCD = true;
    if (o.cliente && !mapa[chave].cliente) mapa[chave].cliente = o.cliente;
    if (!mapa[chave].maquinasCD.includes("DESBOBINADEIRA")) {
      mapa[chave].maquinasCD.push("DESBOBINADEIRA");
    }

    const stAtual = mapa[chave].statusCD;
    const stNovo = o.status;
    if (!stAtual || stNovo === "em_producao") {
      mapa[chave].statusCD = stNovo;
    }
  });

  // 4. Cruza com PedidoOdoo para pedidos ainda não puxados para a fábrica
  pedidosOdoo.forEach((p) => {
    const chave = limparNumeroPedido(p.numero_pedido);
    if (!chave) return;

    let temTelhaOdoo = (p.itens_telha_count || 0) > 0;
    let temCdOdoo = (p.itens_cd_count || 0) > 0;

    // Varredura profunda no texto de itens_json, produto, descrição e OF
    const textToScan = [
      p.itens_json || "",
      p.produto || "",
      p.descricao || "",
      p.of_nome || "",
      p.identificacao_1 || "",
      p.identificacao_2 || ""
    ].join(" ").toLowerCase();

    if (/(telha|tp\s*-?\s*25|tp\s*-?\s*40|termoac|sandu[ií]|eps|manta|cumeeir|ondulad|coloni|bandej|bobininha|isopor)/i.test(textToScan)) {
      temTelhaOdoo = true;
    }
    if (/(chapa|perfil|dobra|corte|guilhot|calha|rufo|tubo|barra|cantoneira|slitter|desbobin)/i.test(textToScan)) {
      temCdOdoo = true;
    }

    if (!mapa[chave]) {
      mapa[chave] = {
        chave,
        numero_original: p.numero_pedido,
        cliente: p.cliente || p.cliente_nome || "",
        temTelhas: temTelhaOdoo,
        temCD: temCdOdoo,
        statusTelhas: temTelhaOdoo ? (p.status_pcp || "pendente") : null,
        statusCD: temCdOdoo ? (p.status_pcp || "pendente") : null,
        maquinasTelhas: [],
        maquinasCD: [],
        produtosTelhas: [],
        produtosCD: [],
      };
    } else {
      if (temTelhaOdoo) mapa[chave].temTelhas = true;
      if (temCdOdoo) mapa[chave].temCD = true;
      if ((p.cliente || p.cliente_nome) && !mapa[chave].cliente) {
        mapa[chave].cliente = p.cliente || p.cliente_nome;
      }
    }
  });

  // 5. Finaliza a classificação de cada pedido
  Object.values(mapa).forEach((item) => {
    if (item.temTelhas && item.temCD) {
      item.barracao = "ambos";
      item.barracaoLabel = "Ambos os Barracões";
      item.barracaoIcon = "📦";
      item.barracaoBadgeClass = "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300";
    } else if (item.temTelhas) {
      item.barracao = "telhas";
      item.barracaoLabel = "Telhas";
      item.barracaoIcon = "🏠";
      item.barracaoBadgeClass = "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300";
    } else if (item.temCD) {
      item.barracao = "corte_dobra";
      item.barracaoLabel = "Corte & Dobra";
      item.barracaoIcon = "🏗️";
      item.barracaoBadgeClass = "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300";
    } else {
      item.barracao = "aguardando";
      item.barracaoLabel = "Aguardando Entrada";
      item.barracaoIcon = "⏳";
      item.barracaoBadgeClass = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
    }

    const statuses = [item.statusTelhas, item.statusCD].filter(Boolean);
    if (statuses.some((s) => s === "em_producao" || s === "produzindo")) {
      item.statusGeral = "produzindo";
      item.statusGeralLabel = "⚡ Em Produção";
      item.statusGeralBadge = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300";
    } else if (statuses.some((s) => s === "pausado")) {
      item.statusGeral = "pausado";
      item.statusGeralLabel = "⏸️ Pausado";
      item.statusGeralBadge = "bg-orange-100 text-orange-800 border-orange-300";
    } else if (statuses.length > 0 && statuses.every((s) => s === "finalizado" || s === "pronto")) {
      item.statusGeral = "pronto";
      item.statusGeralLabel = "✓ Pronto";
      item.statusGeralBadge = "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300";
    } else if (statuses.length > 0) {
      item.statusGeral = "pendente";
      item.statusGeralLabel = "⏳ Pendente";
      item.statusGeralBadge = "bg-slate-100 text-slate-700 border-slate-300";
    } else {
      item.statusGeral = "aguardando";
      item.statusGeralLabel = "⏳ Aguardando Entrada";
      item.statusGeralBadge = "bg-slate-100 text-slate-700 border-slate-300";
    }
  });

  return mapa;
}

/**
 * Hook em tempo real para investigar os pedidos da rota nos 2 barracões.
 * Atualiza automaticamente a cada 10s: se um pedido for cadastrado depois da rota,
 * ele é detectado dinamicamente!
 */
export function useInvestigacaoBarracoes(filialAtiva) {
  const query = useQuery({
    queryKey: ["investigacao-barracoes-realtime", filialAtiva],
    queryFn: async () => {
      const filialQuery = filialAtiva ? { unidade: filialAtiva } : {};

      let [pedidosTelhas, ordensCD, ordensDesbob, pedidosOdoo] = await Promise.all([
        base44.entities.Pedido.filter(filialQuery, "-created_date", 500).catch(() => []),
        base44.entities.OrdemMaquinaCD.filter(filialQuery, "-created_date", 500).catch(() => []),
        base44.entities.OrdemDesbobinadeira.filter(filialQuery, "-created_date", 500).catch(() => []),
        base44.entities.PedidoOdoo.filter(filialQuery, "-created_date", 500).catch(() => []),
      ]);

      // Fallback resiliente caso a busca por filial venha vazia
      if (pedidosTelhas.length === 0) {
        pedidosTelhas = await base44.entities.Pedido.filter({}, "-created_date", 500).catch(() => []);
      }
      if (ordensCD.length === 0) {
        ordensCD = await base44.entities.OrdemMaquinaCD.filter({}, "-created_date", 500).catch(() => []);
      }
      if (pedidosOdoo.length === 0) {
        pedidosOdoo = await base44.entities.PedidoOdoo.filter({}, "-created_date", 500).catch(() => []);
      }

      return processarMapaBarracoes({
        pedidosTelhas,
        ordensCD,
        ordensDesbob,
        pedidosOdoo,
      });
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const mapa = query.data || {};

  const getInfoPedido = (numPedido) => {
    const chave = limparNumeroPedido(numPedido);
    if (!chave) return null;

    if (mapa[chave]) return mapa[chave];

    const digits = chave.replace(/\D/g, "");
    if (digits) {
      for (const [k, v] of Object.entries(mapa)) {
        if (k.includes(digits) || digits.includes(k)) {
          return v;
        }
      }
    }

    return {
      chave,
      numero_original: numPedido,
      temTelhas: false,
      temCD: false,
      barracao: "aguardando",
      barracaoLabel: "Aguardando Entrada",
      barracaoIcon: "⏳",
      barracaoBadgeClass: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
      statusGeral: "aguardando",
      statusGeralLabel: "⏳ Aguardando Entrada",
      statusGeralBadge: "bg-slate-100 text-slate-700 border-slate-300",
      maquinasTelhas: [],
      maquinasCD: [],
    };
  };

  return {
    mapa,
    isLoading: query.isLoading,
    refetch: query.refetch,
    getInfoPedido,
  };
}

/**
 * Investigação pontual durante a extração da imagem da rota
 */
export async function investigarBarracoesParaPedidos(listaNumeros = [], filialAtiva) {
  if (!listaNumeros || listaNumeros.length === 0) return {};
  const filialQuery = filialAtiva ? { unidade: filialAtiva } : {};

  try {
    let [pedidosTelhas, ordensCD, ordensDesbob, pedidosOdoo] = await Promise.all([
      base44.entities.Pedido.filter(filialQuery, "-created_date", 500).catch(() => []),
      base44.entities.OrdemMaquinaCD.filter(filialQuery, "-created_date", 500).catch(() => []),
      base44.entities.OrdemDesbobinadeira.filter(filialQuery, "-created_date", 500).catch(() => []),
      base44.entities.PedidoOdoo.filter(filialQuery, "-created_date", 500).catch(() => []),
    ]);

    if (pedidosTelhas.length === 0) {
      pedidosTelhas = await base44.entities.Pedido.filter({}, "-created_date", 500).catch(() => []);
    }
    if (ordensCD.length === 0) {
      ordensCD = await base44.entities.OrdemMaquinaCD.filter({}, "-created_date", 500).catch(() => []);
    }
    if (pedidosOdoo.length === 0) {
      pedidosOdoo = await base44.entities.PedidoOdoo.filter({}, "-created_date", 500).catch(() => []);
    }

    return processarMapaBarracoes({
      pedidosTelhas,
      ordensCD,
      ordensDesbob,
      pedidosOdoo,
    });
  } catch (e) {
    console.error("[investigarBarracoesParaPedidos] erro:", e);
    return {};
  }
}
