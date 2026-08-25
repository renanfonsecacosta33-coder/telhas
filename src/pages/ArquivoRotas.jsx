import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, Archive, Loader2, Folder, MapPin, Calendar } from "lucide-react";
import RotaArquivadaCard from "@/components/logistica/RotaArquivadaCard";

export default function ArquivoRotas() {
  const navigate = useNavigate();
  const { filialAtiva } = useFilial();
  const [filtroDia, setFiltroDia] = useState("");

  const { data: rotas = [], isLoading } = useQuery({
    queryKey: ["rotas-arquivadas", filialAtiva],
    queryFn: () =>
      base44.entities.RotaEntrega.filter(
        { unidade: filialAtiva, status: "expedido" },
        "-data_finalizacao",
        200
      ),
    refetchInterval: 30000,
  });

  const grupos = useMemo(() => {
    const map = {};
    rotas.forEach((r) => {
      const ref = r.data_finalizacao || r.data_criacao;
      const dia = ref ? format(new Date(ref), "yyyy-MM-dd") : "sem-data";
      if (!map[dia]) map[dia] = [];
      map[dia].push(r);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [rotas]);

  const diasFiltrados = useMemo(() => {
    if (!filtroDia) return grupos;
    return grupos.filter(([dia]) => dia === filtroDia);
  }, [grupos, filtroDia]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-2.5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="h-4 w-px bg-border" />
        <Archive className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-semibold">Arquivo de Rotas de Entrega</span>
        <div className="ml-auto flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-input bg-transparent">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <input type="date" value={filtroDia} onChange={(e) => setFiltroDia(e.target.value)} className="text-sm bg-transparent outline-none" />
          {filtroDia && <button onClick={() => setFiltroDia("")} className="text-muted-foreground hover:text-foreground text-xs">limpar</button>}
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : diasFiltrados.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma rota arquivada ainda</p>
            <p className="text-xs mt-1">Rotas finalizadas aparecerão aqui, organizadas por dia e localização.</p>
          </div>
        ) : (
          diasFiltrados.map(([dia, rotasDia]) => {
            const diaLabel = dia === "sem-data" ? "Sem data" : format(new Date(dia + "T12:00:00"), "EEEE, dd 'de' MMMM yyyy", { locale: ptBR });
            const porRota = {};
            rotasDia.forEach((r) => {
              const key = r.titulo || "Sem título";
              if (!porRota[key]) porRota[key] = [];
              porRota[key].push(r);
            });
            return (
              <div key={dia} className="space-y-3">
                <div className="flex items-center gap-2 sticky top-[49px] z-20 bg-background/80 backdrop-blur py-2">
                  <Folder className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-base capitalize">{diaLabel}</h2>
                  <span className="text-xs text-muted-foreground">· {rotasDia.length} rota(s)</span>
                </div>
                {Object.entries(porRota).map(([titulo, rotas]) => (
                  <div key={titulo} className="space-y-2 ml-2 border-l-2 border-emerald-200 pl-4">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                      <MapPin className="w-4 h-4" /> {titulo}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {rotas.map((r) => <RotaArquivadaCard key={r.id} rota={r} />)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}