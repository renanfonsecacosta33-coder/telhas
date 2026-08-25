import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Truck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import RotaEntregaCard from "@/components/logistica/RotaEntregaCard";

/**
 * Seção reutilizável que exibe as Rotas de Entrega distribuídas pela IA.
 * Filtra automaticamente pelo departamento do barracão onde é exibida.
 *
 * Props:
 * - departamento: "telhas" | "corte_dobra" | "expedicao" | null (null = mostra tudo)
 * - filialAtiva: unidade atual
 * - title: título opcional da seção
 * - compact: se true, limita a 3 cards
 */
export default function RotasEntregaSection({ departamento, filialAtiva, title, compact = false }) {
  const { data: rotas = [], isLoading } = useQuery({
    queryKey: ["rotas-entrega", filialAtiva],
    queryFn: () =>
      base44.entities.RotaEntrega.filter(
        { unidade: filialAtiva, status: { $ne: "cancelado" } },
        "-data_criacao",
        50
      ),
    refetchInterval: 20000,
  });

  const rotasFiltradas = useMemo(() => {
    let result = rotas.filter((r) => {
      if (!departamento) return true;
      try {
        const itens = JSON.parse(r.itens_json || "[]");
        return itens.some((i) => (i.departamentos || []).includes(departamento));
      } catch {
        return false;
      }
    });
    if (compact) result = result.slice(0, 4);
    return result;
  }, [rotas, departamento, compact]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando rotas de entrega...
      </div>
    );
  }

  if (rotasFiltradas.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">{title || "Rotas de Entrega"}</h2>
        <Badge className="bg-primary/10 text-primary border-primary/20">{rotasFiltradas.length}</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {rotasFiltradas.map((r) => (
          <RotaEntregaCard key={r.id} rota={r} departamento={departamento} />
        ))}
      </div>
    </div>
  );
}