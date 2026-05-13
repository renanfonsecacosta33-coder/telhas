import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Circle, Snowflake, Package, Menu, X, ChevronRight,
  Factory, Settings, Droplets, Wrench, Layers, Box, ShoppingCart,
  Truck, BarChart2, FileText, Tag, Archive, Zap
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
        </nav>

        {/* Settings at bottom */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
          {renderLink({ path: "/configuracoes", label: "Configurações", icon: Settings })}
          <p className="text-xs text-sidebar-foreground/40 text-center mt-2">AJL ERP v2.0</p>
        </div>
      </aside>
    </>
  );
}