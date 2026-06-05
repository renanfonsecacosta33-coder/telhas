import React from "react";
import { ShieldCheck } from "lucide-react";

export default function EPI() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">EPI</h1>
        <p className="text-sm text-muted-foreground">Controle de Equipamentos de Proteção Individual</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
        <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Módulo de EPI em desenvolvimento</p>
      </div>
    </div>
  );
}