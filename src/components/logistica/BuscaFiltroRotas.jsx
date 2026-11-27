import React from "react";
import { Truck } from "lucide-react";

export default function BuscaFiltroRotas({
  busca = "",
  onBusca = () => {},
  status = "todas",
  onStatus = () => {},
  somenteSemFoto = false,
  onSomenteSemFoto = () => {},
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[220px]">
        <input
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder="Buscar por rota, cliente, pedido, motorista ou placa"
          className="w-full h-9 rounded-lg border border-border bg-background pl-8 pr-3 text-xs font-medium outline-none focus:border-primary/50"
        />
        <Truck className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { id: "todas", label: "Todas" },
          { id: "distribuido", label: "Distribuída" },
          { id: "carregado", label: "Carregada" },
          { id: "em_transito", label: "Em trânsito" },
        ].map((op) => (
          <button
            key={op.id}
            onClick={() => onStatus(op.id)}
            className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
              status === op.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {op.label}
          </button>
        ))}
        <button
          onClick={() => onSomenteSemFoto(!somenteSemFoto)}
          className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
            somenteSemFoto
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-background text-muted-foreground border-border hover:border-amber-400"
          }`}
        >
          Só sem foto
        </button>
      </div>
    </div>
  );
}