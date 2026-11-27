/**
 * TRAVA DEFINITIVA DE STATUS DA OP
 *
 * Regra única para todas as máquinas (Telhas, Desbobinadeira, Corte e Dobra):
 * - "finalizado" é TERMINAL. A OP não volta para a mesma etapa, não muda de máquina
 *   por engano e não pode ser reprocessada por clique duplo, refetch ou automação.
 * - Regravar a OP já finalizada com o mesmo status é permitido (foto, observação),
 *   mas nunca dispara de novo baixa de estoque nem avanço de roteiro.
 * - Reabrir só por ação humana explícita e autorizada (gestor com PIN / PCP).
 */

export const STATUS_TERMINAIS = ["finalizado", "concluido", "cancelado", "expedido", "entregue"];

export function isStatusTerminal(status) {
  return STATUS_TERMINAIS.includes(String(status || "").toLowerCase());
}

export function mensagemTrava(ordem) {
  const ref = ordem?.numero_pedido
    ? `#${String(ordem.numero_pedido).replace(/^#/, "")}`
    : "selecionada";
  return `Trava de segurança: a OP ${ref} está finalizada e é definitiva. Para refazer, gere um retrabalho; para reabrir, use a liberação do gestor.`;
}

/**
 * Bloqueia qualquer transição que tire uma OP de um status terminal.
 * `reaberturaAutorizada` só pode ser passado por uma ação humana explícita
 * (gestor com senha ou PCP), nunca por automação, refetch ou clique duplo.
 */
export function validarTransicaoStatus(atual, dados, { reaberturaAutorizada = false } = {}) {
  if (!atual || !dados || dados.status == null) return true;

  const statusAtual = String(atual.status || "").toLowerCase();
  const novoStatus = String(dados.status || "").toLowerCase();

  if (!statusAtual || novoStatus === statusAtual) return true; // regravação idempotente
  if (!isStatusTerminal(statusAtual)) return true;
  if (reaberturaAutorizada) return true;

  throw new Error(mensagemTrava(atual));
}

/**
 * Finalização já processada: evita rodar baixa de estoque, geração de chapa
 * e avanço de roteiro duas vezes na mesma OP.
 */
export function finalizacaoJaProcessada(anterior, dados) {
  return String(anterior?.status || "").toLowerCase() === "finalizado" &&
    String(dados?.status || "").toLowerCase() === "finalizado";
}