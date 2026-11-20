import React from "react";
import BadgeDataEntregaEChegada from "@/components/corte-dobra/BadgeDataEntregaEChegada";

/**
 * Selo de data de entrega e chegada do card de OP na máquina de telhas.
 */
export default function PedidoRowEntrega({ pedido: p, maquinaAtual = null }) {
  if (!p) return null;
  return <BadgeDataEntregaEChegada ordem={p} maquinaAtual={maquinaAtual || p.maquina} />;
}