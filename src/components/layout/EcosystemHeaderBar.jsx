import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FilialSwitcher from "@/components/FilialSwitcher";
import UserAvatarButton from "@/components/UserAvatarButton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, ChevronDown, PackageCheck, Factory, Home, ArrowLeftRight } from "lucide-react";

export default function EcosystemHeaderBar({ user, sidebarOpen, onToggleSidebar, children }) {
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shadow-sm relative overflow-hidden">
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

      {/* Direita: Ações customizadas (Chats, Alertas) + FilialSwitcher + UserAvatarButton */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {children}
        <FilialSwitcher />
        <UserAvatarButton size="default" />
      </div>
    </header>
  );
}
