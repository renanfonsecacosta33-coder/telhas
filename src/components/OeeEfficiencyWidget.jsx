import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Zap, CheckCircle2, Clock, AlertTriangle, TrendingUp } from "lucide-react";

export default function OeeEfficiencyWidget({ 
  maquinaNome = "Linha General", 
  disponibilidade = 92, 
  performance = 88, 
  qualidade = 99 
}) {
  const oeeTotal = Math.round((disponibilidade * performance * qualidade) / 10000);

  const getOeeColor = (val) => {
    if (val >= 85) return "text-emerald-500 border-emerald-500/30 bg-emerald-500/10";
    if (val >= 70) return "text-amber-500 border-amber-500/30 bg-amber-500/10";
    return "text-rose-500 border-rose-500/30 bg-rose-500/10";
  };

  return (
    <Card className="border border-border/80 bg-card shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            OEE & Eficiência — {maquinaNome}
          </CardTitle>
          <CardDescription className="text-xs">Medição contínua de produtividade da linha</CardDescription>
        </div>
        <Badge className={`border text-sm font-bold px-3 py-1 ${getOeeColor(oeeTotal)}`}>
          OEE {oeeTotal}%
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        {/* Barra Global de OEE */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-semibold">
            <span>Eficiência Global (OEE Misto)</span>
            <span className="text-primary font-bold">{oeeTotal}%</span>
          </div>
          <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full rounded-full transition-all duration-500" 
              style={{ width: `${oeeTotal}%` }}
            />
          </div>
        </div>

        {/* 3 Pilares do OEE */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          
          {/* Disponibilidade */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Disponib.</span>
            </div>
            <p className="text-lg font-bold text-foreground">{disponibilidade}%</p>
            <p className="text-[10px] text-emerald-600 font-semibold">Rodando 7h15m</p>
          </div>

          {/* Performance */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Cadência</span>
            </div>
            <p className="text-lg font-bold text-foreground">{performance}%</p>
            <p className="text-[10px] text-muted-foreground">18.5 m/min</p>
          </div>

          {/* Qualidade */}
          <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Qualidade</span>
            </div>
            <p className="text-lg font-bold text-foreground">{qualidade}%</p>
            <p className="text-[10px] text-emerald-600 font-semibold">Refugo 0.8%</p>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
