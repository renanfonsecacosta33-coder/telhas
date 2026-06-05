import React from "react";
import { Scissors, TrendingUp, Circle, Layers } from "lucide-react";

export default function DashboardCD() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          ✂️ Dashboard — Corte e Dobra
        </h1>
        <p className="text-sm text-muted-foreground">Visão geral do setor de corte e dobra</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Bobinas em Estoque", value: "—", sub: "corte e dobra", color: "text-blue-600" },
          { label: "Produção Hoje", value: "—", sub: "metros produzidos", color: "text-green-600" },
          { label: "Chapas Disponíveis", value: "—", sub: "em estoque", color: "text-orange-600" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
        <Scissors className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Setor de Corte e Dobra em configuração</p>
        <p className="text-xs mt-1">Em breve: ordens de produção, chaparia e controle de EPIs</p>
      </div>
    </div>
  );
}