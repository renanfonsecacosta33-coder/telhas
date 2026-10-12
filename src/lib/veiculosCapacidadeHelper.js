/**
 * Utilitários de Veículos e Cálculo de Capacidade / Peso de Carga para Logística
 */

export const TIPOS_VEICULOS = [
  { id: "vuc", label: "3/4 / VUC", capacidade_kg: 3500, comp_carroceria_m: 4.5, icone: "🚚" },
  { id: "toco", label: "Toco", capacidade_kg: 8000, comp_carroceria_m: 6.5, icone: "🚛" },
  { id: "truck", label: "Truck", capacidade_kg: 14000, comp_carroceria_m: 8.5, icone: "🚛" },
  { id: "bitruck", label: "Bitruck", capacidade_kg: 18000, comp_carroceria_m: 9.5, icone: "🚛" },
  { id: "carreta", label: "Carreta", capacidade_kg: 27000, comp_carroceria_m: 14.0, icone: "🚚" },
  { id: "outro", label: "Outro / Personalizado", capacidade_kg: 10000, comp_carroceria_m: 7.0, icone: "📦" }
];

export function obterVeiculoPorIdOuNome(identificador) {
  if (!identificador) return TIPOS_VEICULOS[2]; // Default: Truck (14t)
  const s = String(identificador).toLowerCase().trim();
  const achado = TIPOS_VEICULOS.find(v =>
    v.id === s ||
    v.label.toLowerCase().includes(s) ||
    s.includes(v.id) ||
    (s.includes("carreta") && v.id === "carreta") ||
    (s.includes("truck") && !s.includes("bitruck") && v.id === "truck") ||
    (s.includes("bitruck") && v.id === "bitruck") ||
    (s.includes("toco") && v.id === "toco") ||
    ((s.includes("vuc") || s.includes("3/4")) && v.id === "vuc")
  );
  return achado || TIPOS_VEICULOS[2];
}

/**
 * Calcula o peso estimado total de uma rota somando seus pedidos
 */
export function calcularPesoRota(rota, infoPedidosMap = {}) {
  let itens = [];
  try {
    itens = Array.isArray(rota.itens_json) ? rota.itens_json : JSON.parse(rota.itens_json || "[]");
  } catch {
    itens = [];
  }

  let pesoTelhasKg = 0;
  let pesoCdKg = 0;
  let pesoInformadoTotal = 0;

  itens.forEach((it) => {
    const numPed = it.numero_pedido || it.pedido;
    const info = infoPedidosMap[numPed] || {};
    const pedOdoo = info.pedidoOdoo;

    // 1. Tenta extrair peso direto se existir no item ou na rota
    const pesoDireto = Number(it.peso_kg || it.peso || it.kg) || 0;
    if (pesoDireto > 0) {
      pesoInformadoTotal += pesoDireto;
      return;
    }

    // 2. Se temos o PedidoOdoo vinculado
    if (pedOdoo && pedOdoo.itens_json) {
      let subItens = [];
      try { subItens = JSON.parse(pedOdoo.itens_json); } catch {}
      subItens.forEach((sub) => {
        const pKg = Number(sub.peso_kg || sub.kg) || 0;
        if (pKg > 0) {
          pesoInformadoTotal += pKg;
        } else {
          // Estimativa física básica de telhas: metragem * kg/m
          const qtd = Number(sub.quantidade || 1);
          const esp = Number(String(sub.espessura || "0.43").replace(",", ".")) || 0.43;
          const kgM = +(esp * 7.85 * 1.2).toFixed(2);
          const metragem = Number(sub.metragem_total || (qtd * 6.0));
          pesoTelhasKg += metragem * kgM;
        }
      });
      return;
    }

    // 3. Estimativa proporcional por valor ou padrão de mercado (média 350kg por pedido de telha/CD)
    const valorNum = parseFloat(String(it.valor || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    if (valorNum > 0) {
      // Regra industrial aproximada: ~R$ 8 a R$ 10 por kg de aço beneficiado
      const kgEstimado = Math.round(valorNum / 9.0);
      pesoInformadoTotal += kgEstimado;
    } else {
      pesoInformadoTotal += 400; // Padrão seguro por entrega média
    }
  });

  const pesoTotalKg = Math.round(pesoInformadoTotal + pesoTelhasKg + pesoCdKg);
  return {
    pesoTotalKg,
    pesoTelhasKg: Math.round(pesoTelhasKg),
    pesoCdKg: Math.round(pesoCdKg),
    qtdPedidos: itens.length
  };
}

/**
 * Retorna diagnóstico de ocupação e alerta de sobrepeso
 */
export function analisarCapacidadeCaminhao(pesoTotalKg, capacidadeKg) {
  const cap = Number(capacidadeKg) > 0 ? Number(capacidadeKg) : 14000;
  const pct = Math.round((pesoTotalKg / cap) * 100);
  const sobrepesoKg = Math.max(0, pesoTotalKg - cap);

  let status = "normal"; // normal | cheia | sobrepeso
  let corBarra = "bg-emerald-500";
  let badgeCls = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";

  if (pct > 100) {
    status = "sobrepeso";
    corBarra = "bg-red-500";
    badgeCls = "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 animate-pulse";
  } else if (pct >= 85) {
    status = "cheia";
    corBarra = "bg-amber-500";
    badgeCls = "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  }

  return {
    pesoTotalKg,
    capacidadeKg: cap,
    percentual: pct,
    sobrepesoKg,
    status,
    corBarra,
    badgeCls
  };
}
