import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, PackageCheck, Package, Map, Wrench, History,
  ChevronLeft, ChevronRight, ArrowLeftRight, LogOut, Menu, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/expedicao",             label: "Dashboard",         icon: LayoutDashboard, end: true },
  { to: "/expedicao/recebimento", label: "Receber Material",  icon: PackageCheck },
  { to: "/expedicao/estoque",     label: "Estoque Expedição", icon: Package },
  { to: "/expedicao/mapa",        label: "Mapa Armazenagem",  icon: Map },
  { to: "/expedicao/frisada",     label: "Frisada",           icon: Wrench },
  { to: "/expedicao/historico",   label: "Histórico",         icon: History },
];

export default function SidebarExpedicao({ isOpen, onToggle, user }) {
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full bg-slate-900 text-white z-50 flex flex-col transition-all duration-300",
        isOpen ? "w-64" : "w-16",
        "shadow-2xl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700/50">
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <PackageCheck className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-none">EXPEDIÇÃO</p>
                <p className="text-[10px] text-slate-400">AJL Ferro & Aço</p>
              </div>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
          >
            {isOpen ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                  : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {isOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/50 space-y-1">
          {isOpen && user && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs text-slate-400 truncate">{user.full_name || user.email}</p>
              <p className="text-[10px] text-teal-400 font-medium">Expedição</p>
            </div>
          )}
          <button
            onClick={() => navigate("/setor")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white text-sm transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
            {isOpen && <span>Trocar Setor</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
