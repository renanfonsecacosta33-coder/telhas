import React, { useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Loader2, Archive, CalendarX, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import RotaEntregaCard from "@/components/logistica/RotaEntregaCard";
import { isRotaExpirada, filtrarRotas } from "@/lib/rotaDataHelper";

/**
 * Seção reutilizável que exibe as Rotas de Entrega distribuídas pela IA.
 * Filtra automaticamente pelo departamento do barracão onde é exibida.
 *
 * Props:
 * - departamento: "telhas" | "corte_dobra" | "expedicao" | null (null = mostra tudo)
 * - filialAtiva: unidade atual
 * - title: título opcional da seção
 * - compact: se true, limita a 3 cards
 * - busca / statusFiltro / somenteSemFoto: filtros aplicados pela página
 * - inicialAberto: abre a rota já expandida (padrão) ou recolhida
 */
export default function RotasEntregaSection({
  departamento,
  filialAtiva,
  title,
  compact = false,
  allowDelete = false,
  dataSelecionada = null,
  onLimparFiltroData = null,
  busca = "",
  statusFiltro = "todas",
  somenteSemFoto = false,
  inicialAberto = true,
}) {
  const queryClient = useQueryClient();
  const { data: rotas = [], isLoading } = useQuery({
    queryKey: ["rotas-entrega", filialAtiva],
    queryFn: () =>
      base44.entities.RotaEntrega.filter(
        { unidade: filialAtiva, status: { $ne: "cancelado" } },
        "-data_criacao",
        50
      ),
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Aplica o documento recebido diretamente na rota em tela, sem polling
  // por pedido e sem prazo de 21s para deixar de acompanhar os PDFs.
  useEffect(() => base44.entities.RotaEntrega.subscribe((evento) => {
    if (evento.type !== "update" || !evento.data?.itens_json) return;
    queryClient.setQueriesData({ queryKey: ["rotas-entrega"] }, (lista) =>
      Array.isArray(lista)
        ? lista.map(rota => rota.id === evento.id ? { ...rota, ...evento.data } : rota)
        : lista
    );
  }), [queryClient]);

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
    const result = filtrarRotas(rotas, {
      departamento,
      dataSelecionada,
      busca,
      statusFiltro,
      somenteSemFoto,
    });
    return compact ? result.slice(0, 4) : result;
  }, [rotas, departamento, compact, dataSelecionada, busca, statusFiltro, somenteSemFoto]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando rotas de entrega...
      </div>
    );
  }

  // Se estiver filtrado por data e não houver rotas, mostra aviso interativo
  if (rotasFiltradas.length === 0) {
    if (dataSelecionada) {
      const dataFmt = (() => {
        try {
          return format(parseISO(dataSelecionada), "dd 'de' MMMM (EEEE)", { locale: ptBR });
        } catch {
          return dataSelecionada;
        }
      })();

      return (
        <div className="bg-muted/30 border border-dashed border-border rounded-xl p-5 text-center space-y-2">
          <CalendarX className="w-6 h-6 mx-auto text-muted-foreground opacity-60" />
          <p className="text-sm font-semibold text-foreground">
            Nenhuma rota de entrega programada para {dataFmt}
          </p>
          <p className="text-xs text-muted-foreground">
            Não há caminhões ou rotas da IA registrados para este dia.
          </p>
          {onLimparFiltroData && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLimparFiltroData}
              className="text-xs gap-1.5 mt-1"
            >
              <X className="w-3.5 h-3.5" />
              Ver todas as rotas
            </Button>
          )}
        </div>
      );
    }
    return (
      <div className="bg-muted/30 border border-dashed border-border rounded-xl p-5 text-center space-y-1">
        <CalendarX className="w-6 h-6 mx-auto text-muted-foreground opacity-60" />
        <p className="text-sm font-semibold text-foreground">Nenhuma rota encontrada</p>
        <p className="text-xs text-muted-foreground">
          Ajuste a busca ou os filtros de situação e foto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">{title || "Rotas de Entrega"}</h2>
        <Badge className="bg-primary/10 text-primary border-primary/20">{rotasFiltradas.length}</Badge>
        {dataSelecionada && (
          <Badge variant="outline" className="text-xs border-primary/30 text-primary">
            Dia: {format(parseISO(dataSelecionada), "dd/MM")}
          </Badge>
        )}
        <Link to="/arquivo-rotas" className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1">
          <Archive className="w-3.5 h-3.5" /> Ver Arquivo
        </Link>
      </div>
      <div className="space-y-3">
        {rotasFiltradas.map((r) => (
          <RotaEntregaCard
            key={r.id}
            rota={r}
            departamento={departamento}
            allowDelete={allowDelete}
            inicialAberto={inicialAberto}
          />
        ))}
      </div>
    </div>
  );
}