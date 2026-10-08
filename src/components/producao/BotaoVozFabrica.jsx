import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Mic, Play, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getModoVoz, setModoVoz, testarVoz } from "@/lib/sounds";

export default function BotaoVozFabrica({ compact = false }) {
  const [modo, setModo] = useState(getModoVoz());

  useEffect(() => {
    const handleChanged = (e) => {
      setModo(e.detail || getModoVoz());
    };
    window.addEventListener("ajl_modo_voz_changed", handleChanged);
    return () => window.removeEventListener("ajl_modo_voz_changed", handleChanged);
  }, []);

  const handleTrocarModo = (novoModo) => {
    setModo(novoModo);
    setModoVoz(novoModo);
    if (novoModo !== "desativado") {
      testarVoz(novoModo);
    }
  };

  const labelModo = {
    bolsonaro: "🇧🇷 Voz do Bolsonaro",
    padrao: "🤖 Voz Padrão",
    desativado: "🔇 Sem Voz"
  }[modo] || "🇧🇷 Voz do Bolsonaro";

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 gap-1.5 font-bold shadow-xs border-amber-300/80 bg-amber-50/60 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300 ${
              compact ? "px-2 text-xs" : "px-3 text-xs"
            }`}
            title="Configurar a voz dos anúncios de produção das telhas"
          >
            {modo === "desativado" ? (
              <VolumeX className="w-4 h-4 text-slate-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-600 animate-pulse" />
            )}
            {!compact && <span>{labelModo}</span>}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl border-border">
          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            Voz dos Avisos de Produção
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="flex items-center justify-between cursor-pointer py-2 font-medium"
            onClick={() => handleTrocarModo("bolsonaro")}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🇧🇷</span>
              <div>
                <p className="text-xs font-bold text-foreground">Voz do Bolsonaro</p>
                <p className="text-[10px] text-muted-foreground">Com bordões clássicos ("Talkei?!")</p>
              </div>
            </div>
            {modo === "bolsonaro" && <Check className="w-4 h-4 text-emerald-600" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center justify-between cursor-pointer py-2 font-medium"
            onClick={() => handleTrocarModo("padrao")}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🤖</span>
              <div>
                <p className="text-xs font-bold text-foreground">Voz Neutra Padrão</p>
                <p className="text-[10px] text-muted-foreground">Avisos diretos e convencionais</p>
              </div>
            </div>
            {modo === "padrao" && <Check className="w-4 h-4 text-emerald-600" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center justify-between cursor-pointer py-2 font-medium"
            onClick={() => handleTrocarModo("desativado")}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🔇</span>
              <div>
                <p className="text-xs font-bold text-foreground">Desativar Voz</p>
                <p className="text-[10px] text-muted-foreground">Apenas sinais sonoros (beeps)</p>
              </div>
            </div>
            {modo === "desativado" && <Check className="w-4 h-4 text-emerald-600" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="pt-1">
            <Button
              size="sm"
              variant="secondary"
              className="w-full text-xs gap-1.5 font-bold bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => testarVoz()}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Ouvir Teste de Voz
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-2 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-950/40"
        onClick={() => testarVoz()}
        title="Ouvir teste de voz agora"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
      </Button>
    </div>
  );
}
