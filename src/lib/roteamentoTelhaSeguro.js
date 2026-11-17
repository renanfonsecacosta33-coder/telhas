import { detectarMaquinaTelha, detectarTipoProdutoTelha } from "@/lib/pedidoOdooHelper";

const MAQUINAS = {
  TP25: "TP - 25",
  TP40: "TP - 40",
  ONDULADA: "ONDULADA",
  COLONIAL: "COLONIAL",
  BANDEJA: "BANDEJA",
  DESBOBINADOR: "DESBOBINADOR",
  CUMEEIRA: "CUMEEIRA"
};

export function resolverRoteamentoTelha(item) {
  const nome = item.produto || item.item_produto || "";
  const descricao = item.descricao || item.observacao || item.observacoes_odoo || item.observacoes || "";
  const prodTipo = detectarTipoProdutoTelha(nome, descricao);

  if (prodTipo === "CUMEEIRA") return { prodTipo, maquina: "CUMEEIRA" };
  if (prodTipo === "BOBININHA") return { prodTipo, maquina: "DESBOBINADOR" };

  // Prioridade 1: Máquina explicitamente programada pelo PCP (exceto Colagem temporária)
  const programada = String(item.maquina || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  // Prioridade 2: Detecção dinâmica inteligente
  // A descrição técnica digitada pelo vendedor é a verdade absoluta sobre o modelo
  const maquinaDetectada = detectarMaquinaTelha(nome, descricao);

  const maquina = (programada && MAQUINAS[programada] && programada !== "COLAGEM")
    ? MAQUINAS[programada]
    : maquinaDetectada;

  if (!maquina || ["CUMEEIRA", "DESBOBINADOR"].includes(maquina)) {
    throw new Error(`Máquina não definida ou incompatível para "${nome}". Defina o modelo no PCP; não será assumida TP - 40.`);
  }

  return { prodTipo, maquina };
}
