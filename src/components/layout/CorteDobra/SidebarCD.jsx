import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Circle, Factory, Users, Menu, X, ChevronRight, ChevronDown, ChevronLeft,
  LogOut, Layers, ShieldCheck, ArrowLeftRight, Calculator, BookOpen, Scissors,
  FlaskConical, Wrench, Map, BookmarkPlus, Truck, Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/corte-dobra", label: "Dashboard", icon: LayoutDashboard },
  { path: "/corte-dobra/catalogo", label: "Catálogo", icon: BookOpen },
  { path: "/corte-dobra/desenvolvimento", label: "Desenvolvimento", icon: Calculator },
  { path: "/corte-dobra/producao", label: "Produção Geral", icon: Factory },
  { path: "/corte-dobra/retalhos", label: "Retalhos", icon: Scissors },
  { path: "/corte-dobra/calculos", label: "Cálculos", icon: FlaskConical },
  { path: "/corte-dobra/bobinas", label: "Bobinas", icon: Circle },
  { path: "/corte-dobra/chaparia", label: "Chaparia", icon: Layers },
  { path: "/corte-dobra/slitter", label: "Slitter", icon: ArrowLeftRight },
  { path: "/corte-dobra/epi", label: "EPI", icon: ShieldCheck },
  { path: "/corte-dobra/mapa", label: "Mapa do Barracão", icon: Map },
  { path: "/corte-dobra/logistica", label: "Logística", icon: Truck },
];

const MAQUINAS_NAV = [
  { path: "/corte-dobra/maquina/corte-3m", label: "Guilhotina 3m" },
  { path: "/corte-dobra/maquina/dobra-3m", label: "Dobradeira 3m" },
  { path: "/corte-dobra/maquina/corte-6m", label: "Guilhotina 6m" },
  { path: "/corte-dobra/maquina/dobra-fundo-6m", label: "Dobradeira Fundo 6m" },
  { path: "/corte-dobra/maquina/dobra-inicio-6m", label: "Dobradeira Início 6m" },
  { path: "/corte-dobra/maquina/perfiladeira", label: "Perfiladeira" },
  { path: "/corte-dobra/maquina/desbobinadeira", label: "Desbobinadeira" },
];

const ADMIN_NAV = [
  { path: "/corte-dobra/usuarios", label: "Usuários", icon: Users },
];

export default function SidebarCD({ isOpen, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [maquinasOpen, setMaquinasOpen] = useState(
    MAQUINAS_NAV.some(m => location.pathname === m.path)
  );

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isSuperAdmin = user?.role === "super_admin" || user?.email === "renanfonsecacosta33@gmail.com";
  const isAdmin = user?.role === "admin" || isSuperAdmin;
  const isOperador = user?.role !== "admin" && user?.role !== "super_admin" && user?.email !== "renanfonsecacosta33@gmail.com" && !!user;
  const isAmbos = user?.setor === "ambos" || isAdmin;
  const isGerencia = user?.gerencia === true;

  const MAQUINA_CD_ROUTE_MAP = {
    "CORTE 3M": "/corte-dobra/maquina/corte-3m",
    "DOBRA 3M": "/corte-dobra/maquina/dobra-3m",
    "CORTE 6M": "/corte-dobra/maquina/corte-6m",
    "DOBRA FUNDO 6M": "/corte-dobra/maquina/dobra-fundo-6m",
    "DOBRA INICIO 6M": "/corte-dobra/maquina/dobra-inicio-6m",
    "PERFILADEIRA": "/corte-dobra/maquina/perfiladeira",
    "DESBOBINADEIRA": "/corte-dobra/maquina/desbobinadeira",
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
            ? "bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm"
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
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
              <Factory className="w-4 h-4 text-orange-400" />
            </div>
            {isOpen && (
              <div>
                <h1 className="font-black text-xs tracking-wider text-white uppercase leading-none">AJL FERRO & AÇO</h1>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Corte & Dobra</p>
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
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
          {isOperador ? (
            <>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-3">
                Minha Máquina
              </p>
              {parseMaquinas(user?.maquina).map(m => {
                const route = MAQUINA_CD_ROUTE_MAP[m];
                if (!route) return null;
                return renderLink({ path: route, label: m, icon: Wrench });
              })}
              {renderLink({ path: "/corte-dobra/calculos", label: "Cálculos", icon: FlaskConical })}
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-3">
                Principal
              </p>
              {NAV.map(renderLink)}

              {/* Máquinas individuais */}
              <div>
                <button
                  onClick={() => setMaquinasOpen(o => !o)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all cursor-pointer"
                >
                  <Wrench className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">Máquinas</span>
                  {maquinasOpen ? <ChevronDown className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />}
                </button>
                {maquinasOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
                    {MAQUINAS_NAV.map(item => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => window.innerWidth < 1024 && onToggle()}
                          className={cn(
                            "flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all",
                            isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {isSuperAdmin && (
                <>
                  <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mt-5 mb-3">
                    Administração
                  </p>
                  {ADMIN_NAV.map(renderLink)}
                </>
              )}

              {(isSuperAdmin || user?.permitido_central_alertas === true) && (
                <>
                  <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mt-4 mb-3">
                    Configurações
                  </p>
                  {renderLink({ path: "/corte-dobra/alertas", label: "Central de Alertas", icon: Bell })}
                </>
              )}
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-slate-800 space-y-1">
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