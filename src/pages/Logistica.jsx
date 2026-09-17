import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserAvatarButton from "@/components/UserAvatarButton";
import NotificationBell from "@/components/NotificationBell";
import Logistica from "@/pages/corte-dobra/Logistica";

export default function LogisticaStandalone() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header Limpo Standalone — Sem seleção de fábrica e sem sidebar de máquinas */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/setor")}
            className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 h-8 px-2.5"
            title="Voltar para a Seleção de Setores"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Logística & Expedição</h1>
                <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-medium">
                  Operação
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Montagem de cargas, romaneios, rotas de entrega e despacho
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserAvatarButton size="sm" />
        </div>
      </header>

      {/* Conteúdo Principal de Logística */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <Logistica mode="montagem" defaultTab="todos" />
      </main>
    </div>
  );
}