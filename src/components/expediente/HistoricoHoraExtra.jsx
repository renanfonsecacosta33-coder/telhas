import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, CheckCircle2, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

export default function HistoricoHoraExtra({ maquina, setor, filialAtiva, onClose, isAdminView = false, filters }) {
  const [page, setPage] = useState(0);
  const limit = 50;

  const queryKey = isAdminView
    ? ["hora-extra-historico-admin", filters]
    : ["hora-extra-historico", maquina, filialAtiva];

  const { data: registros = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = {};
      if (!isAdminView) {
        query = { maquina, unidade: filialAtiva };
      } else {
        if (filialAtiva) query.unidade = filialAtiva;
        if (setor) query.setor = setor;
      }
      const result = await base44.entities.HoraExtra.filter(query, "-data", 200);
      return result;
    },
  });

  // Filtra por data se admin
  const registrosFiltrados = isAdminView && filters
    ? registros.filter(r => {
        if (filters.dataInicial && r.data < filters.dataInicial) return false;
        if (filters.dataFinal && r.data > filters.dataFinal) return false;
        return true;
      })
    : registros;

  // Agrupa por data
  const porData = {};
  registrosFiltrados.forEach(r => {
    if (!porData[r.data]) porData[r.data] = [];
    porData[r.data].push(r);
  });
  const datas = Object.keys(porData).sort().reverse();

  // Stats
  const totalRegistros = registrosFiltrados.length;
  const totalHoraExtra = registrosFiltrados.filter(r => r.tem_hora_extra).length;
  const totalSegundos = registrosFiltrados.reduce((s, r) => s + (r.duracao_extra_seg || 0), 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" /> Historico de Horas Extras
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-50 border border-border rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-slate-700">{totalRegistros}</p>
            <p className="text-xs text-muted-foreground">Registros</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-red-700">{totalHoraExtra}</p>
            <p className="text-xs text-muted-foreground">c/ Hora Extra</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-orange-700">{formatTempo(totalSegundos)}</p>
            <p className="text-xs text-muted-foreground">Total Extra</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : datas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum registro de expediente encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {datas.map(data => {
              const regs = porData[data];
              return (
                <div key={data} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b border-border">
                    <p className="font-bold text-sm capitalize">
                      {format(new Date(data + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {regs.map(r => (
                      <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {r.tem_hora_extra ? (
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {r.maquina} <span className="text-muted-foreground font-normal">- {r.operador_nome}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Finalizado: {r.horario_fim_expediente ? format(new Date(r.horario_fim_expediente), "HH:mm") : "--"}
                              {r.unidade && ` - ${r.unidade}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {r.tem_hora_extra ? (
                            <span className="text-sm font-bold text-red-600">{formatTempo(r.duracao_extra_seg)}</span>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">No horario</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}