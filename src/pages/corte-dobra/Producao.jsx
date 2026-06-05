import React from "react";
import { Factory } from "lucide-react";

export default function ProducaoCD() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Produção — Corte e Dobra</h1>
        <p className="text-sm text-muted-foreground">Ordens de produção do setor</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
        <Factory className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Módulo de produção em desenvolvimento</p>
      </div>
    </div>
  );
}