import React, { useState } from "react";
import { Weight, ChevronDown, Factory, Disc, Ruler } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function HistoricoBobinasTelhas({ historico }) {
  const [expanded, setExpanded] = useState(null);

  if (!historico || historico.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
          <Disc className="w-4 h-4 text-blue-600" /> Histórico de Bobinas de Telhas — Período
        </h2>
        <p className="text-xs text-muted-foreground text-center py-8">Sem dados no período selecionado</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h2 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Disc className="w-4 h-4 text-blue-600" /> Histórico de Bobinas de Telhas — Período
      </h2>
      <div className="space-y-2">
        {historico.map((b, idx) => (
          <div key={idx} className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === idx ? null : idx)}
              className="w-full flex items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                  <Disc className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-bold text-sm truncate">{b.bobina_descricao || b.codigo || "Bobina Telhas"}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.metros_total ? `${b.metros_total.toFixed(1)}m · ` : ""}{b.ordens.length} ordem(ns)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-blue-200 text-xs">
                  {b.kg_total > 0 ? `${b.kg_total.toFixed(0)} kg` : `${b.metros_total?.toFixed(0) || 0} m`}
                </Badge>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded === idx ? "rotate-180" : ""}`} />
              </div>
            </button>
            {expanded === idx && (
              <div className="border-t border-border bg-muted/30 p-3 space-y-1.5">
                {b.ordens.map((o, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Factory className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-bold truncate">{o.maquina}</span>
                      <span className="text-muted-foreground truncate">· {o.produto || "Telha"}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-muted-foreground">
                        {o.data ? format(new Date(o.data + "T12:00:00"), "dd/MM", { locale: ptBR }) : "—"}
                      </span>
                      <span className="font-bold text-blue-600">{o.metros ? `${o.metros.toFixed(1)}m` : `${o.quantidade} telhas`}</span>
                      {o.kg > 0 && <span className="text-orange-600 font-medium">{o.kg.toFixed(0)}kg</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
