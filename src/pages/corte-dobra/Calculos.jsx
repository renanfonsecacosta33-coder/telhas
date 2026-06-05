import { Calculator } from "lucide-react";
import { Chapas, BarrasRedondas, BarrasSextavadas, TuboRedondo, TuboQuadrado, TuboRetangular, BarrasChatas, Cantoneiras } from "@/components/corte-dobra/calculadoras/Calculadoras";

export default function Calculos() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
          <Calculator className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cálculos de Peso Teórico</h1>
          <p className="text-xs text-muted-foreground">Densidade do aço: 7,85 kg/dm³</p>
        </div>
      </div>

      <div className="space-y-6">
        <Chapas />
        <BarrasRedondas />
        <BarrasSextavadas />
        <TuboRedondo />
        <TuboQuadrado />
        <TuboRetangular />
        <BarrasChatas />
        <Cantoneiras />
      </div>
    </div>
  );
}