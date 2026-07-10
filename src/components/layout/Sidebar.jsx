import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Circle, Snowflake, Package, Menu, X, ChevronRight,
  Factory, Settings, Droplets, Wrench, Layers, Box, ShoppingCart,
  Truck, BarChart2, FileText, Tag, Archive, Zap, Users, LogOut, Cog, FlaskConical, ArrowLeftRight, Map, BookmarkPlus
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
  { path: "/cola", label: "Cola", icon: FlaskConical },
  { path: "/estoque", label: "Outros Produtos", icon: Package },
  { path: "/mapa-barracao", label: "Mapa do Barracão", icon: Map },
  { path: "/corte-dobra/logistica", label: "Logística", icon: Truck },
];

const MAQUINA_ROUTE_MAP = {
  "TP - 40": "/maquina/tp40",
  "TP - 25": "/maquina/tp25",
  "ONDULADA": "/maquina/ondulada",
  "COLONIAL": "/maquina/colonial",
  "BANDEJA": "/maquina/bandeja",
  "DESBOBINADOR": "/maquina/desbobinador",
  "CUMEEIRA": "/maquina/cumeeira",
  "COLAGEM": "/maquina/colagem",
};

function parseMaquinas(maquina) {
  if (!maquina) return [];
  try {
    const parsed = JSON.parse(maquina);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [maquina];
  }
}

export default function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin || user?.role === "user";
  const isOperador = !!user && user.role === "operador";
  const isAmbos = user?.setor === "ambos" || isAdmin;
  const isGerencia = user?.gerencia === true;

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
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <img
              src="https://media.base44.com/images/public/6a0467e5d5ff5dda4351d2c3/9bae84333_LOGO_AJL_.png"
              alt="AJL Logo"
              className="h-10 w-auto object-contain brightness-0 invert"
            />
            <div>
              <h1 className="font-bold text-base tracking-widest text-sidebar-foreground uppercase">Ferro e Aço</h1>
              <p className="text-xs text-sidebar-foreground/50 tracking-wider uppercase">ERP Estoque</p>
            </div>
          </div>
          {user && (
            <div className="mt-3 px-1">
              <p className="text-xs font-semibold text-sidebar-foreground/80 truncate">{user.full_name || user.email}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-white/10 text-sidebar-foreground/70 border border-white/10">
                  {user.role || "user"}
                </span>
                {user.maquina && <span className="text-xs text-sidebar-foreground/50">· {user.maquina}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {isOperador ? (
            <>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-3">
                Minha Máquina
              </p>
              {parseMaquinas(user?.maquina)
                .filter(m => MAQUINA_ROUTE_MAP[m])
                .map(m => renderLink({
                  path: MAQUINA_ROUTE_MAP[m],
                  label: m,
                  icon: Factory,
                }))}
              {renderLink({ path: "/calculadora-isopor", label: "Calculadora Isopor", icon: Snowflake })}
            </>
          ) : (
            <>
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

              {isSuperAdmin && (
                <>
                  <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mt-5 mb-3">
                    Administração
                  </p>
                  {renderLink({ path: "/usuarios", label: "Usuários", icon: Users })}
                </>
              )}
            </>
          )}
        </nav>

        {/* Settings at bottom */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
          {isAdmin && renderLink({ path: "/configuracoes", label: "Configurações", icon: Settings })}
          {isGerencia && (
            <a
              href="https://gerencial-fabricas.base44.app"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-sidebar-accent hover:text-amber-300 transition-all"
            >
              <Factory className="w-4 h-4" />
              <span>Gerência Fábricas</span>
            </a>
          )}
          {user && !isOperador && (
            <button
              onClick={() => navigate("/setor")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
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