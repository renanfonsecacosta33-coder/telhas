import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import RotaEntregaCard from "@/components/logistica/RotaEntregaCard";

/**
 * Mostra as rotas lado a lado (duas por tela no desktop)
 * com setas para avançar e voltar entre as rotas.
 */
export default function RotasCarrossel({ rotas = [], departamento, allowDelete = false, porPagina = 2 }) {
  const [inicio, setInicio] = useState(0);
  const maxInicio = Math.max(0, rotas.length - porPagina);

  useEffect(() => {
    if (inicio > maxInicio) setInicio(maxInicio);
  }, [inicio, maxInicio]);

  const visiveis = rotas.slice(inicio, inicio + porPagina);
  const primeiro = inicio + 1;
  const ultimo = Math.min(inicio + porPagina, rotas.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {rotas.map((r, idx) => (
            <span
              key={r.id}
              className={`h-1.5 rounded-full transition-all ${
                idx >= inicio && idx < inicio + porPagina ? "w-6 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            {rotas.length === 0 ? "0 rotas" : `Rotas ${primeiro}-${ultimo} de ${rotas.length}`}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInicio((p) => Math.max(0, p - 1))}
            disabled={inicio === 0}
            className="h-8 w-8 p-0 cursor-pointer"
            title="Rotas anteriores"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setInicio((p) => Math.min(maxInicio, p + 1))}
            disabled={inicio >= maxInicio}
            className="h-8 w-8 p-0 cursor-pointer"
            title="Próximas rotas"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        {visiveis.map((r) => (
          <RotaEntregaCard key={r.id} rota={r} departamento={departamento} allowDelete={allowDelete} />
        ))}
      </div>
    </div>
  );
}