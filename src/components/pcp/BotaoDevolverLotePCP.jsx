import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { devolverPedidosPCPLote } from "@/lib/devolverPcpHelper";

// Botão de ação em lote: devolve os pedidos selecionados (checkboxes da fila)
// de volta para a Central PCP, cancelando as OPs ativas nos galpões.
export default function BotaoDevolverLotePCP({
  selecionados = new Set(),
  pedidos = [],
  queryClient,
  toast,
  disabled,
  onDevolvidos
}) {
  const [devolvendo, setDevolvendo] = useState(false);
  if (!selecionados || selecionados.size === 0) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={devolvendo || disabled}
      onClick={async () => {
        const lista = pedidos.filter(p => selecionados.has(p.id));
        setDevolvendo(true);
        try {
          const ok = await devolverPedidosPCPLote({ lista, queryClient, toast });
          if (ok && onDevolvidos) onDevolvidos();
        } finally {
          setDevolvendo(false);
        }
      }}
      className="border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs h-8 gap-1.5 font-bold"
      title="Cancelar as OPs ativas nos galpões e devolver os pedidos selecionados para a fila da Central PCP (0%)"
    >
      <RotateCcw className={`w-3.5 h-3.5 ${devolvendo ? "animate-spin" : ""}`} />
      {devolvendo ? "Devolvendo..." : `Devolver ao PCP (${selecionados.size})`}
    </Button>
  );
}