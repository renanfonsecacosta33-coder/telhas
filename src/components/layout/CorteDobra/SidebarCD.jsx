import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Circle, Factory, Users, Menu, X, ChevronRight,
  LogOut, Layers, ShieldCheck, ArrowLeftRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/corte-dobra", label: "Dashboard", icon: LayoutDashboard },
  { path: "/corte-dobra/producao", label: "Produção", icon: Factory },
  { path: "/corte-dobra/bobinas", label: "Bobinas", icon: Circle },
  { path: "/corte-dobra/chaparia", label: "Chaparia", icon: Layers },
  { path: "/corte-dobra/epi", label: "EPI", icon: ShieldCheck },
];

const ADMIN_NAV = [
  { path: "/corte-dobra/usuarios", label: "Usuários", icon: Users },
];

export default function SidebarCD({ isOpen, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === "admin";
  const isAmbos = user?.setor === "ambos" || isAdmin;

  const renderLink = (item) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => window.innerWidth < 1024 && onToggle()}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/25"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{item.label}</span>
        {isActive && <ChevronRight className="w-4 h-4 opacity-60" />}
      </Link>
    );
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onToggle} />
      )}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden bg-card border border-border rounded-lg p-2 shadow-lg"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <aside className={cn(
        "fixed top-0 left-0 h-full z-40 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out",
        "w-64 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">✂</span>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-sidebar-foreground">AJL</h1>
              <p className="text-xs text-orange-400">Corte e Dobra</p>
            </div>
          </div>
          {user && (
            <div className="mt-3 px-1">
              <p className="text-xs font-semibold text-sidebar-foreground/80 truncate">{user.full_name || user.email}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  user.role === "admin" ? "bg-red-900/40 text-red-300" :
                  user.role === "operador" ? "bg-blue-900/40 text-blue-300" :
                  "bg-green-900/40 text-green-300"
                }`}>{user.role || "user"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-3">
            Principal
          </p>
          {NAV.map(renderLink)}

          {isAdmin && (
            <>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mt-5 mb-3">
                Administração
              </p>
              {ADMIN_NAV.map(renderLink)}
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
          {isAmbos && (
            <button
              onClick={() => navigate("/setor")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-orange-400 hover:bg-sidebar-accent hover:text-orange-300 transition-all"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Trocar Setor</span>
            </button>
          )}
          <button
            onClick={() => base44.auth.logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
          <p className="text-xs text-sidebar-foreground/30 text-center mt-1">AJL ERP v2.0</p>
        </div>
      </aside>
    </>
  );
}