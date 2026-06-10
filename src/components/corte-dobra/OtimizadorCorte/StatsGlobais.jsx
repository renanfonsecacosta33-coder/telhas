import React from "react";
import { CheckCircle2, AlertTriangle, Layers, Scissors, TrendingUp, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function StatBox({ label, value, sub, color = "text-foreground", icon: Icon, bg = "bg-white" }) {
  return (
    <div className={`${bg} border border-border rounded-xl p-3 flex items-center gap-3`}>
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      )}
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function StatsGlobais({ stats, naoCouberam }) {
  if (!stats) return null;

  const aprovPct = parseFloat(stats.aproveitamento_geral);
  const corAprov = aprovPct >= 85 ? "text-green-700" : aprovPct >= 65 ? "text-amber-700" : "text-red-700";
  const bgAprov = aprovPct >= 85 ? "bg-green-50" : aprovPct >= 65 ? "bg-amber-50" : "bg-red-50";

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-slate-500" />
        Estatísticas Globais
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatBox
          label="Aproveitamento Geral"
          value={`${stats.aproveitamento_geral}%`}
          color={corAprov}
          bg={bgAprov}
          icon={TrendingUp}
        />
        <StatBox
          label="Chapas Utilizadas"
          value={stats.chapas_usadas}
          color="text-blue-700"
          icon={Layers}
        />
        <StatBox
          label="Peças Encaixadas"
          value={`${stats.pecas_encaixadas} / ${stats.total_pecas}`}
          color={stats.nao_couberam > 0 ? "text-amber-700" : "text-green-700"}
          icon={CheckCircle2}
        />
        <StatBox
          label="Área Total"
          value={`${(stats.area_total_mm2 / 1e6).toFixed(3)} m²`}
          icon={Layers}
        />
        <StatBox
          label="Área Usada"
          value={`${(stats.area_usada_mm2 / 1e6).toFixed(3)} m²`}
          color="text-green-700"
          icon={CheckCircle2}
        />
        <StatBox
          label="Desperdício"
          value={`${(stats.area_desperdicada_mm2 / 1e6).toFixed(3)} m²`}
          color="text-red-600"
          icon={AlertTriangle}
        />
      </div>

      {/* Peças que não couberam */}
      {naoCouberam.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-xs font-bold text-red-700">
              {naoCouberam.length} {naoCouberam.length === 1 ? "peça não coube" : "peças não couberam"} nas chapas disponíveis
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {naoCouberam.map((p, i) => (
              <Badge key={i} variant="outline" className="text-[10px] border-red-300 bg-red-100 text-red-700">
                {p.nome || `Peça`} ({p.comp}×{p.larg}mm)
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-red-600">
            Adicione chapas maiores ou verifique as dimensões das peças.
          </p>
        </div>
      )}

      {/* Barra de aproveitamento visual */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Área usada ({stats.aproveitamento_geral}%)</span>
          <span>Desperdício ({(100 - parseFloat(stats.aproveitamento_geral)).toFixed(1)}%)</span>
        </div>
        <div className="h-3 rounded-full bg-red-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${stats.aproveitamento_geral}%`,
              background: aprovPct >= 85 ? "#16a34a" : aprovPct >= 65 ? "#d97706" : "#dc2626",
            }}
          />
        </div>
      </div>
    </div>
  );
}