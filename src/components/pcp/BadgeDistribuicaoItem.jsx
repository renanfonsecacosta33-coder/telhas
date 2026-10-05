import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Selo visual que mostra se um item de um pedido do Odoo foi (ou não)
 * distribuído para uma máquina da fábrica — usado nas Filas PCP dos barracões.
 */
export default function BadgeDistribuicaoItem({ distribuido = false, maquina = "", className = "" }) {
  return distribuido ? (
    <Badge
      className={`shrink-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 ${className}`}
      title="Item distribuído para a máquina"
    >
      <CheckCircle2 className="w-3 h-3 mr-0.5" />
      Distribuído{maquina ? ` → ${maquina}` : ""}
    </Badge>
  ) : (
    <Badge
      className={`shrink-0 bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40 text-[10px] font-black px-2 py-0.5 uppercase tracking-wide ${className}`}
      title="Item ainda NÃO distribuído para nenhuma máquina"
    >
      <XCircle className="w-3 h-3 mr-0.5" />
      Não Distribuído
    </Badge>
  );
}

/**
 * Determina se um item foi distribuído para a fábrica:
 * 1. Já possui OP real criada na máquina;
 * 2. Foi marcado explicitamente como distribuído (flag ou status);
 * 3. Possui máquina designada no item;
 * 4. Se nenhum item tem flag explícita, herda o status do pedido PCP.
 */
export function itemEstaDistribuido(item, opExistente, pedido, algumItemComFlag = false) {
  if (opExistente) return true;
  if (item?.distribuido === true) return true;
  if (["distribuido", "em_producao", "concluido"].includes(item?.status)) return true;
  if (item?.maquina) return true;
  if (item?.distribuido === false) return false;
  if (algumItemComFlag) return false;
  return ["distribuido", "em_producao"].includes(pedido?.status_pcp);
}