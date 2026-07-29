import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, PackageCheck, Package, Map, Wrench, History, RotateCcw,
  ChevronLeft, ArrowLeftRight, Menu, ArrowUpRight, BookmarkCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/expedicao",             label: "Dashboard",          icon: LayoutDashboard, end: true },
  { to: "/expedicao/recebimento", label: "Receber Material",   icon: PackageCheck },
  { to: "/expedicao/saida",       label: "Saída / Transfer.",   icon: ArrowUpRight },
  { to: "/expedicao/reservas",    label: "Reservas de Vendas", icon: BookmarkCheck },
  { to: "/expedicao/devolucoes",   label: "Devoluções",         icon: RotateCcw },
  { to: "/expedicao/estoque",     label: "Estoque Expedição",  icon: Package },
  { to: "/expedicao/mapa",        label: "Mapa Armazenagem",   icon: Map },
  { to: "/expedicao/frisada",     label: "Frisada",            icon: Wrench },
  { to: "/expedicao/historico",   label: "Histórico",          icon: History },
];

export default function SidebarExpedicao({ isOpen, onToggle, user }) {
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={onToggle} />
      )}

      {/* Sidebar Tablet Dock */}
      <aside className={cn(
        "fixed top-0 left-0 h-full bg-slate-950 text-white z-50 flex flex-col transition-all duration-300 border-r border-slate-800 shadow-2xl",
        isOpen ? "w-64" : "w-16"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-3.5 border-b border-slate-800">
          {isOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <PackageCheck className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <p className="text-xs font-black text-white leading-none tracking-wider">EXPEDIÇÃO</p>
                <p className="text-[10px] text-slate-400 font-medium">AJL Ferro & Aço</p>
              </div>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={isOpen ? "Recolher Menu" : "Expandir Menu"}
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Nav Items Otimizados para Tablet (Touch Targets de 48px) */}
        <nav className="flex-1 py-3 space-y-1 px-2 overflow-y-auto no-scrollbar">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={!isOpen ? label : undefined}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all touch-manipulation min-h-[48px]",
                isActive
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm"
                  : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          {isOpen && user && (
            <div className="px-3 py-2 mb-1 bg-slate-900/60 rounded-xl border border-slate-800">
              <p className="text-xs font-bold text-slate-200 truncate">{user.full_name || user.email}</p>
              <p className="text-[10px] text-teal-400 font-semibold">Operador de Expedição</p>
            </div>
          )}
          <button
            onClick={() => navigate("/setor")}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white text-sm font-semibold transition-colors touch-manipulation min-h-[48px]"
            title={!isOpen ? "Trocar Setor" : undefined}
          >
            <ArrowLeftRight className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span>Trocar Setor</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
