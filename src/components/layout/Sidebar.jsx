import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Circle, Snowflake, Package, Menu, X, ChevronRight,
  Factory, Settings, Droplets, Wrench, Layers, Box, ShoppingCart,
  Truck, BarChart2, FileText, Tag, Archive, Zap, Users, LogOut, Cog
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP = {
  LayoutDashboard, Circle, Snowflake, Package, Factory, Settings,
  Droplets, Wrench, Layers, Box, ShoppingCart, Truck, BarChart: BarChart2,
  FileText, Tag, Archive, Zap
};

const FIXED_NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/producao", label: "Produção", icon: Factory },
  { path: "/bobinas", label: "Bobinas", icon: Circle },
  { path: "/isopor", label: "Isopor", icon: Snowflake },
  { path: "/estoque", label: "Outros Produtos", icon: Package },
];

export default function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isAdmin = user?.role === "admin";

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => base44.entities.Categoria.list("ordem"),
    staleTime: 30000,
  });

  const dynamicItems = categorias
    .filter(c => c.ativa !== false)
    .map(c => ({
      path: `/${c.path}`,
      label: c.nome,
      icon: ICON_MAP[c.icone] || Package,
      cor: c.cor,
    }));

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
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-lg">A</span>
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-sidebar-foreground">AJL</h1>
              <p className="text-xs text-sidebar-foreground/60">ERP Estoque</p>
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
                {user.maquina && <span className="text-xs text-sidebar-foreground/50">· {user.maquina}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-3">
            Principal
          </p>
          {FIXED_NAV.map(renderLink)}

          {dynamicItems.length > 0 && (
            <>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mt-5 mb-3">
                Categorias
              </p>
              {dynamicItems.map(renderLink)}
            </>
          )}

          {/* Maquinários */}
          <>
            <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mt-5 mb-3">
              Maquinários
            </p>
            {[
              { path: "/maquina/tp40",         label: "TP - 40",       color: "bg-green-500" },
              { path: "/maquina/tp25",         label: "TP - 25",       color: "bg-blue-500" },
              { path: "/maquina/ondulada",     label: "Ondulada",      color: "bg-purple-500" },
              { path: "/maquina/colonial",     label: "Colonial",      color: "bg-orange-500" },
              { path: "/maquina/bandeja",      label: "Bandeja",       color: "bg-pink-500" },
              { path: "/maquina/desbobinador", label: "Desbobinador",  color: "bg-yellow-500" },
              { path: "/maquina/cumeeira",     label: "Cumeeira",      color: "bg-teal-500" },
            ].map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => window.innerWidth < 1024 && onToggle()}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 opacity-60" />}
                </Link>
              );
            })}
          </>

          {/* Admin only */}
          {isAdmin && (
            <>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mt-5 mb-3">
                Administração
              </p>
              {renderLink({ path: "/usuarios", label: "Usuários", icon: Users })}
            </>
          )}
        </nav>

        {/* Settings at bottom */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
          {isAdmin && renderLink({ path: "/configuracoes", label: "Configurações", icon: Settings })}
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