import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Loads configurable espessura tolerances (min/max acceptable per nominal espessura).
 * Used by the strict bobina validation across all selection points.
 */
export function useTolerancias() {
  return useQuery({
    queryKey: ["tolerancias-espessura"],
    queryFn: async () => {
      const list = await base44.entities.ToleranciaEspessura.list();
      return list || [];
    },
    staleTime: 60000,
  });
}