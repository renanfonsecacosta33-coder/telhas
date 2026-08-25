import React, { useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Loader2, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import RotaEntregaCard from "@/components/logistica/RotaEntregaCard";

const MESES_PT = { jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11 };
function parseEntregaDate(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return new Date(ano, +m[2]-1, +m[1]);
  }
  m = s.match(/^(\d{1,2})\/([a-zç]{3})/);
  if (m) {
    const mes = MESES_PT[m[2]];
    if (mes === undefined) return null;
    return new Date(new Date().getFullYear(), mes, +m[1]);
  }
  m = s.match(/^(\d{1,2})\s+de\s+([a-zç]{3,})/);
  if (m) {
    const mes = MESES_PT[m[2].substring(0,3)];
    if (mes === undefined) return null;
    return new Date(new Date().getFullYear(), mes, +m[1]);
  }
  return null;
}
function isRotaExpirada(rota) {
  const d = parseEntregaDate(rota.entrega_date);
  if (!d) return false;
  const entrega = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const hoje = new Date();
  const hojeMid = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diaSeguinte = new Date(entrega);
  diaSeguinte.setDate(diaSeguinte.getDate() + 1);
  return hojeMid >= diaSeguinte;
}

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
export default function RotasEntregaSection({ departamento, filialAtiva, title, compact = false, allowDelete = false }) {
  const queryClient = useQueryClient();
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

  // Arquiva automaticamente rotas cuja data de ENTREGA já passou (no dia seguinte)
  const arquivarExpiradas = useCallback(async (lista) => {
    const expiradas = lista.filter((r) => r.status !== "expedido" && r.status !== "cancelado" && isRotaExpirada(r));
    if (expiradas.length === 0) return;
    await Promise.all(expiradas.map((r) =>
      base44.entities.RotaEntrega.update(r.id, { status: "expedido", data_finalizacao: new Date().toISOString() })
    ));
    queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
    queryClient.invalidateQueries({ queryKey: ["rotas-arquivadas"] });
  }, [queryClient]);

  useEffect(() => {
    if (rotas.length) arquivarExpiradas(rotas);
  }, [rotas, arquivarExpiradas]);

  const rotasFiltradas = useMemo(() => {
    let result = rotas.filter((r) => r.status !== "expedido").filter((r) => {
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
        <Link to="/arquivo-rotas" className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1">
          <Archive className="w-3.5 h-3.5" /> Ver Arquivo
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {rotasFiltradas.map((r) => (
          <RotaEntregaCard key={r.id} rota={r} departamento={departamento} allowDelete={allowDelete} />
        ))}
      </div>
    </div>
  );
}