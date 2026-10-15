import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FilialSwitcher from "@/components/FilialSwitcher";
import UserAvatarButton from "@/components/UserAvatarButton";
import NotificationBell from "@/components/NotificationBell";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, PackageCheck, Factory, Home, ArrowLeftRight, Sun, Moon, Search } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";

export default function EcosystemHeaderBar({ user, sidebarOpen, onToggleSidebar, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Listener global de teclado para Ctrl + K / Cmd + K em todo o sistema
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Detectar setor ativo pelo caminho da URL
  const isExpedicao = location.pathname.startsWith("/expedicao");
  const isCorteDobra = location.pathname.startsWith("/corte-dobra");
  const isTelhas = !isExpedicao && !isCorteDobra;

  let moduloInfo = {
    nome: "Telhas & Perfis",
    icon: Home,
    color: "bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    route: "/"
  };

  if (isExpedicao) {
    moduloInfo = {
      nome: "Expedição",
      icon: PackageCheck,
      color: "bg-teal-600/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800",
      route: "/expedicao"
    };
  } else if (isCorteDobra) {
    moduloInfo = {
      nome: "Corte & Dobra",
      icon: Factory,
      color: "bg-orange-600/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
      route: "/corte-dobra"
    };
  }

  const ModuloIcon = moduloInfo.icon;
  const { isDark, toggleTema } = useTheme();

  return (
    <>
      <header className="sticky top-0 z-30 bg-background border-b border-border px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shadow-sm relative overflow-hidden">
        {/* Linha Fina Brilhante de Topo do Ecossistema */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-500 via-orange-500 to-blue-500 opacity-80" />

        {/* Esquerda: Seletor de Ecossistema */}
        <div className="flex items-center gap-2">
          {/* Dropdown de Troca Rápida de Ecossistema (Expedição / CD / Telhas) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={`gap-1.5 font-extrabold text-xs h-9 px-3 rounded-xl border ${moduloInfo.color}`}>
                <ModuloIcon className="w-4 h-4" />
                <span className="truncate max-w-[120px] sm:max-w-none">{moduloInfo.nome}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 font-sans">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground uppercase font-bold">
                Ecossistema AJL — Módulos
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/expedicao")} className="gap-2 text-xs font-semibold py-2.5 cursor-pointer">
                <PackageCheck className="w-4 h-4 text-teal-600" />
                <span>📦 Expedição & Logística</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/corte-dobra")} className="gap-2 text-xs font-semibold py-2.5 cursor-pointer">
                <Factory className="w-4 h-4 text-orange-600" />
                <span>🏭 Corte & Dobra</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/")} className="gap-2 text-xs font-semibold py-2.5 cursor-pointer">
                <Home className="w-4 h-4 text-blue-600" />
                <span>🏠 Fábrica de Telhas</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/setor")} className="gap-2 text-xs text-muted-foreground py-2 cursor-pointer">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Tela de Escolha de Setor</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Direita: Busca Inteligente + Ações customizadas (Chats, Alertas) + Notificações + FilialSwitcher + Alternador de Tema + UserAvatarButton */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botão de Busca Rápida e Inteligente Ctrl+K */}
          <button 
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 text-xs text-muted-foreground bg-muted/60 hover:bg-muted border border-border rounded-xl transition-all hover:text-foreground cursor-pointer shadow-xs hover:border-primary/40 group"
            title="Pesquisa Inteligente de Pedidos, OPs, Bobinas e Telas (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="hidden md:inline font-medium">Buscar Pedidos, OPs, Bobinas...</span>
            <span className="inline md:hidden font-medium">Buscar...</span>
            <kbd className="hidden sm:inline-block bg-background border border-border text-[10px] px-1.5 py-0.5 rounded font-mono font-bold text-muted-foreground">
              Ctrl+K
            </kbd>
          </button>

          {children}
          <NotificationBell user={user} />
          <FilialSwitcher />

          {/* Botão Rápido de Alternar Tema (Visão Preta / Visão Clara) */}
          <button
            onClick={toggleTema}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 active:scale-95"
            title={isDark ? "Mudar para Modo Claro (Visão Clara)" : "Mudar para Modo Escuro (Visão Preta)"}
            aria-label="Alternar Modo Escuro / Claro"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 animate-in fade-in zoom-in duration-200" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 animate-in fade-in zoom-in duration-200" />
            )}
          </button>

          <UserAvatarButton size="default" />
        </div>
      </header>

      {/* Palette de Comando e Pesquisa Inteligente */}
      <GlobalCommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  );
}