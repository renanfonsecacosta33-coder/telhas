import { detectarMaquinaTelha, detectarTipoProdutoTelha } from "@/lib/pedidoOdooHelper";

const MAQUINAS = { TP25: "TP - 25", TP40: "TP - 40", ONDULADA: "ONDULADA", COLONIAL: "COLONIAL", BANDEJA: "BANDEJA", DESBOBINADOR: "DESBOBINADOR", CUMEEIRA: "CUMEEIRA" };
export function resolverRoteamentoTelha(item) {
  const nome = item.produto || "";
  const descricao = item.descricao || item.observacao || "";
  const texto = `${nome} ${descricao} ${item.modelo || ""}`;
  const prodTipo = detectarTipoProdutoTelha(nome, descricao);
  if (prodTipo === "CUMEEIRA") return { prodTipo, maquina: "CUMEEIRA" };
  if (prodTipo === "BOBININHA") return { prodTipo, maquina: "DESBOBINADOR" };
  if (prodTipo === "TELHA BANDEJA") return { prodTipo, maquina: "TP - 40" };
  const programada = String(item.maquina || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const maquina = programada ? MAQUINAS[programada] : detectarMaquinaTelha(texto);
  if (!maquina || ["CUMEEIRA", "DESBOBINADOR"].includes(maquina)) {
    throw new Error(`Máquina não definida ou incompatível para "${nome}". Defina o modelo no PCP; não será assumida TP - 40.`);
  }
  return { prodTipo, maquina };
}