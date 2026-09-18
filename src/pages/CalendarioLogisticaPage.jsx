import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserAvatarButton from "@/components/UserAvatarButton";
import NotificationBell from "@/components/NotificationBell";
import CalendarioEntregas from "@/components/logistica/CalendarioEntregas";
import { useFilial } from "@/contexts/FilialContext";

export default function CalendarioLogisticaPage() {
  const navigate = useNavigate();
  const { filialAtiva } = useFilial();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header Standalone */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 h-8 px-2.5"
            title="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Calendário de Entregas & Cargas</h1>
                <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 font-medium">
                  {filialAtiva || "Geral"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Planejamento diário/semanal de rotas, detecção de conflitos e reagendamento
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserAvatarButton size="sm" />
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <CalendarioEntregas filial={filialAtiva} />
      </main>
    </div>
  );
}
