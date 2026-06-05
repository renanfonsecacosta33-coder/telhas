import React from "react";
import { Layers } from "lucide-react";

export default function Chaparia() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chaparia</h1>
        <p className="text-sm text-muted-foreground">Estoque e controle de chapas</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
        <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Módulo de chaparia em desenvolvimento</p>
      </div>
    </div>
  );
}