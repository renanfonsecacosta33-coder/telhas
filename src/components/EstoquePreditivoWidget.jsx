import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, ShoppingCart, CheckCircle, Package } from "lucide-react";
import { soundService } from "@/lib/SoundNotificationService";

export default function EstoquePreditivoWidget() {
  const alertasEstoque = [
    {
      id: 1,
      bobina: "Galvalume 0.43mm x 1200mm (AZ150)",
      estoqueAtualKg: 4200,
      consumoDiarioKg: 700,
      diasRestantes: 6,
      status: "critico",
      usina: "CSN / Arcelor"
    },
    {
      id: 2,
      bobina: "Zincada 0.50mm x 1200mm (Z275)",
      estoqueAtualKg: 8500,
      consumoDiarioKg: 950,
      diasRestantes: 9,
      status: "atencao",
      usina: "Usiminas"
    },
    {
      id: 3,
      bobina: "Pré-Pintada Azul 0.50mm x 1200mm",
      estoqueAtualKg: 14200,
      consumoDiarioKg: 600,
      diasRestantes: 23,
      status: "ok",
      usina: "Ternium"
    }
  ];

  return (
    <Card className="border border-border/80 bg-card shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-amber-500" />
            Estoque Preditivo & Alertas de Recompra
          </CardTitle>
          <CardDescription className="text-xs">Projeção baseada na velocidade de consumo dos últimos 30 dias</CardDescription>
        </div>
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs font-semibold">
          2 Alertas de Pedido
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        {alertasEstoque.map(item => {
          const isCritico = item.status === "critico";
          const isAtencao = item.status === "atencao";

          return (
            <div 
              key={item.id} 
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                isCritico 
                  ? "border-rose-300 bg-rose-50/50 dark:bg-rose-950/30 dark:border-rose-800" 
                  : isAtencao 
                  ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/30 dark:border-rose-800"
                  : "border-border/60 bg-muted/20"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {isCritico ? (
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : isAtencao ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                  <span className="text-sm font-bold text-foreground">{item.bobina}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saldo: <strong>{item.estoqueAtualKg.toLocaleString()} kg</strong> — Consumo: <strong>{item.consumoDiarioKg} kg/dia</strong> — Usina: {item.usina}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                <div className="text-right">
                  <p className={`text-xs font-extrabold ${isCritico ? "text-rose-600 dark:text-rose-400" : isAtencao ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
                    Restam ~{item.diasRestantes} dias
                  </p>
                  <p className="text-[10px] text-muted-foreground">Recompra Recomendada</p>
                </div>

                {isCritico && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-8 text-xs gap-1.5 shadow-sm"
                    onClick={() => {
                      soundService.playWarningSound();
                      alert(`Solicitação de Recompra emitida para a Usina ${item.usina} (${item.bobina})`);
                    }}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Solicitar Usina
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
