import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, PenLine, Loader2, FileSignature, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ImageLink from "@/components/ui/ImageLink";
import ApontamentoEtapaDialog from "@/components/producao/ApontamentoEtapaDialog";

export const ETAPAS_OP = [
  { id: "desbobinadeira", label: "1. Desbobinadeira / Desbobinador", icon: "🌀" },
  { id: "perfilagem",    label: "2. Dobradeira / Perfiladeira",       icon: "📐" },
  { id: "qualidade",     label: "3. Inspeção de Qualidade",           icon: "🔍" },
  { id: "carregamento",  label: "4. Amarrado / Carregamento",         icon: "📦", is_final: true },
];

export default function ApontamentosEtapaPanel({ ordem, ordem_tipo, compact = false }) {
  const queryClient = useQueryClient();
  const [dialogEtapa, setDialogEtapa] = useState(null);

  const { data: apontamentos = [], isLoading } = useQuery({
    queryKey: ["apontamentos-etapa", ordem?.id],
    queryFn: () => base44.entities.ApontamentoEtapa.filter({ ordem_id: ordem.id, ordem_tipo }, "data_hora", 50),
    enabled: !!ordem?.id,
    refetchInterval: 15000,
  });

  const byEtapa = (id) => apontamentos.find((a) => a.etapa === id);
  const concluidas = apontamentos.length;
  const total = ETAPAS_OP.length;
  const pct = Math.round((concluidas / total) * 100);
  const finalGerado = apontamentos.some((a) => a.is_etapa_final && a.pdf_final_gerado);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["apontamentos-etapa", ordem?.id] });

  return (
    <div className="space-y-3">
      {/* Progresso */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Progresso do Documento Vivo</span>
            <span className="text-xs font-bold text-slate-700">{concluidas}/{total} etapas</span>
          </div>
          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${finalGerado ? "bg-green-500" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        {finalGerado && (
          <Badge className="bg-green-100 text-green-700 border-green-300 gap-1 shrink-0">
            <FileSignature className="w-3 h-3" /> PDF Final Gerado
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className={compact ? "space-y-2" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
          {ETAPAS_OP.map((etapa) => {
            const ap = byEtapa(etapa.id);
            return (
              <div key={etapa.id} className={`rounded-xl border-2 p-3 ${ap ? "border-green-300 bg-green-50/40" : "border-dashed border-slate-300 bg-slate-50/60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{etapa.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 leading-tight">{etapa.label}</p>
                      {ap ? (
                        <p className="text-[11px] text-green-700 font-semibold mt-0.5">
                          ✓ {ap.operador_nome} · {format(new Date(ap.data_hora), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-0.5">Aguardando apontamento</p>
                      )}
                    </div>
                  </div>
                  {ap ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  ) : (
                    <Button size="sm" className="gap-1 h-7 text-xs bg-orange-500 hover:bg-orange-600 border-0 shrink-0" onClick={() => setDialogEtapa(etapa)}>
                      <PenLine className="w-3 h-3" /> Assinar
                    </Button>
                  )}
                </div>

                {ap && (
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                    {ap.pecas_produzidas > 0 && <div><span className="text-slate-400">Peças:</span> <strong>{ap.pecas_produzidas}</strong></div>}
                    {ap.metros_reais > 0 && <div><span className="text-slate-400">Metros:</span> <strong>{ap.metros_reais} m</strong></div>}
                    {ap.refuga_kg > 0 && <div><span className="text-slate-400">Refuga:</span> <strong className="text-red-600">{ap.refuga_kg} kg</strong></div>}
                    {ap.maquina && <div><span className="text-slate-400">Máquina:</span> <strong>{ap.maquina}</strong></div>}
                    {ap.observacoes && <div className="col-span-2 italic text-slate-500">"{ap.observacoes}"</div>}
                  </div>
                )}

                {ap?.assinatura_url && (
                  <div className="mt-2">
                    <ImageLink url={ap.assinatura_url} name={`Assinatura ${etapa.label}`} className="block">
                      <img src={ap.assinatura_url} alt="Assinatura" className="h-14 object-contain bg-white rounded border border-slate-200 px-1" />
                    </ImageLink>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ApontamentoEtapaDialog
        open={!!dialogEtapa}
        onClose={() => setDialogEtapa(null)}
        ordem={ordem}
        ordem_tipo={ordem_tipo}
        etapa={dialogEtapa}
        onComplete={() => invalidate()}
      />
    </div>
  );
}