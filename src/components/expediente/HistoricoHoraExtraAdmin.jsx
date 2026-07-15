import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Clock, AlertCircle, CheckCircle2, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m`;
}

export default function HistoricoHoraExtraAdmin({ filters }) {
  const [filtroSetor, setFiltroSetor] = useState("todos");

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["hora-extra-admin", filters],
    queryFn: async () => {
      let query = {};
      if (filters?.filial) query.unidade = filters.filial;
      const result = await base44.entities.HoraExtra.filter(query, "-data", 500);
      return result;
    },
  });

  const registrosFiltrados = useMemo(() => {
    let r = registros;
    if (filters?.dataInicial) r = r.filter(x => x.data >= filters.dataInicial);
    if (filters?.dataFinal) r = r.filter(x => x.data <= filters.dataFinal);
    if (filtroSetor !== "todos") r = r.filter(x => x.setor === filtroSetor);
    return r;
  }, [registros, filters, filtroSetor]);

  const porData = useMemo(() => {
    const groups = {};
    registrosFiltrados.forEach(r => {
      if (!groups[r.data]) groups[r.data] = [];
      groups[r.data].push(r);
    });
    return Object.keys(groups).sort().reverse().map(d => ({ data: d, itens: groups[d] }));
  }, [registrosFiltrados]);

  // Stats
  const totalRegistros = registrosFiltrados.length;
  const totalHoraExtra = registrosFiltrados.filter(r => r.tem_hora_extra).length;
  const totalSegundos = registrosFiltrados.reduce((s, r) => s + (r.duracao_extra_seg || 0), 0);

  // Por máquina
  const porMaquina = useMemo(() => {
    const map = {};
    registrosFiltrados.forEach(r => {
      if (!map[r.maquina]) map[r.maquina] = { total: 0, extras: 0, seg: 0 };
      map[r.maquina].total++;
      if (r.tem_hora_extra) { map[r.maquina].extras++; map[r.maquina].seg += r.duracao_extra_seg || 0; }
    });
    return Object.entries(map).sort((a, b) => b[1].seg - a[1].seg);
  }, [registrosFiltrados]);

  return (
    <div className="space-y-4">
      {/* Stats gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Registros</span>
          </div>
          <p className="text-2xl font-bold">{totalRegistros}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-muted-foreground">c/ Hora Extra</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{totalHoraExtra}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">No Horário</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{totalRegistros - totalHoraExtra}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-muted-foreground">Total Extra</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{formatTempo(totalSegundos)}</p>
        </Card>
      </div>

      {/* Filtro por setor */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Setor:</span>
        {["todos", "telhas", "corte_dobra"].map(s => (
          <button
            key={s}
            onClick={() => setFiltroSetor(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${filtroSetor === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted/50"}`}
          >
            {s === "todos" ? "Todos" : s === "telhas" ? "Telhas" : "Corte e Dobra"}
          </button>
        ))}
      </div>

      {/* Ranking por máquina */}
      {porMaquina.length > 0 && (
        <Card className="p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Ranking de Horas Extras por Máquina
          </h3>
          <div className="space-y-2">
            {porMaquina.map(([maquina, stats]) => (
              <div key={maquina} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{maquina}</p>
                  <p className="text-xs text-muted-foreground">{stats.total} registros · {stats.extras} com extra</p>
                </div>
                <span className="text-sm font-bold text-red-600">{formatTempo(stats.seg)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Histórico detalhado */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : porData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhum registro encontrado para o período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {porData.map(({ data, itens }) => (
            <Card key={data} className="overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b border-border">
                <p className="font-bold text-sm capitalize">
                  {format(new Date(data + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <div className="divide-y divide-border">
                {itens.map(r => (
                  <div key={r.id} className="px-4 py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {r.tem_hora_extra ? (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {r.maquina} <span className="text-muted-foreground font-normal">— {r.operador_nome}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {r.setor === "telhas" ? "Telhas" : "Corte e Dobra"}
                          {r.unidade && ` · ${r.unidade}`}
                          {` · Fim: ${r.horario_fim_expediente ? format(new Date(r.horario_fim_expediente), "HH:mm") : "—"}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {r.tem_hora_extra ? (
                        <span className="text-sm font-bold text-red-600">{formatTempo(r.duracao_extra_seg)}</span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">No horário</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}