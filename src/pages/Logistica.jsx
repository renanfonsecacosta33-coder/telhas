import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import Logistica from "@/pages/corte-dobra/Logistica";

export default function LogisticaStandalone() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-card border-b border-border px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => navigate("/setor")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm font-semibold">Setor Logística</span>
      </div>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Logistica />
      </div>
    </div>
  );
}