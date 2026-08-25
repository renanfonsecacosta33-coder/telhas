import React from "react";
import { Truck } from "lucide-react";
import { useFilial } from "@/contexts/FilialContext";
import RotasEntregaSection from "@/components/logistica/RotasEntregaSection";

export default function LogisticaExpedicao() {
  const { filialAtiva } = useFilial();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="w-6 h-6 text-teal-600" /> Logística — Expedição
        </h1>
        <p className="text-sm text-muted-foreground">Foto de carregamento do barracão de Expedição</p>
      </div>
      <RotasEntregaSection departamento="expedicao" filialAtiva={filialAtiva} title="Rotas de Entrega — Expedição" />
    </div>
  );
}