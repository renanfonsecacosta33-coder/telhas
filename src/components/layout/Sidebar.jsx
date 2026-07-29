import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Circle, Snowflake, Package, Menu, X, ChevronRight, ChevronLeft,
  Factory, Settings, Droplets, Wrench, Layers, Box, ShoppingCart,
  Truck, BarChart2, FileText, Tag, Archive, Zap, Users, LogOut, Cog, FlaskConical, ArrowLeftRight, Map, BookmarkPlus, Scissors, Home
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
  { path: "/isopor", label: "Estoque Isopor", icon: Snowflake },
  { path: "/maquina/corte-eps", label: "Corte de EPS", icon: Scissors },
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
  "CORTE DE EPS": "/maquina/corte-eps",
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
        title={!isOpen ? item.label : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all touch-manipulation min-h-[48px]",
          isActive
            ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm"
            : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {isOpen && <span className="flex-1 truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={onToggle} />
      )}

      <aside className={cn(
        "fixed top-0 left-0 h-full z-50 bg-slate-950 text-white transition-all duration-300 border-r border-slate-800 shadow-2xl flex flex-col",
        isOpen ? "w-64" : "w-16"
      )}>
        {/* Logo */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
              <Home className="w-4 h-4 text-teal-400" />
            </div>
            {isOpen && (
              <div>
                <h1 className="font-black text-xs tracking-wider text-white uppercase leading-none">AJL FERRO & AÇO</h1>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Fábrica de Telhas</p>
              </div>
            )}
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={isOpen ? "Recolher Menu" : "Expandir Menu"}
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto no-scrollbar">
          {isOperador ? (
            <>
              {isOpen && (
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 my-2">
                  Minha Máquina
                </p>
              )}
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
              {isOpen && (
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 my-2">
                  Principal
                </p>
              )}
              {FIXED_NAV.map(renderLink)}

              {dynamicItems.length > 0 && (
                <>
                  {isOpen && (
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mt-4 mb-2">
                      Categorias
                    </p>
                  )}
                  {dynamicItems.map(renderLink)}
                </>
              )}

              {isSuperAdmin && (
                <>
                  {isOpen && (
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mt-4 mb-2">
                      Administração
                    </p>
                  )}
                  {renderLink({ path: "/usuarios", label: "Usuários", icon: Users })}
                </>
              )}
            </>
          )}
        </nav>

        {/* Settings at bottom */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          {isAdmin && renderLink({ path: "/configuracoes", label: "Configurações", icon: Settings })}
          {isGerencia && (
            <a
              href="https://gerencial-fabricas.base44.app"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-amber-400 hover:bg-slate-800 transition-all touch-manipulation min-h-[48px]"
            >
              <Factory className="w-5 h-5 flex-shrink-0" />
              {isOpen && <span>Gerência Fábricas</span>}
            </a>
          )}
          {user && !isOperador && (
            <button
              onClick={() => navigate("/setor")}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all touch-manipulation min-h-[48px]"
              title={!isOpen ? "Trocar Setor" : undefined}
            >
              <ArrowLeftRight className="w-5 h-5 flex-shrink-0" />
              {isOpen && <span>Trocar Setor</span>}
            </button>
          )}
          <button
            onClick={() => base44.auth.logout()}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition-all touch-manipulation min-h-[48px]"
            title={!isOpen ? "Sair" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}