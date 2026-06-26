import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Circle, Factory, Users, Menu, X, ChevronRight, ChevronDown,
  LogOut, Layers, ShieldCheck, ArrowLeftRight, Calculator, BookOpen, Scissors,
  FlaskConical, Wrench, Map, BookmarkPlus
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

  const isSuperAdmin = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;
  const isOperador = user?.role !== "admin" && user?.role !== "super_admin" && !!user;
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
              <p className="text-xs text-sidebar-foreground/50 tracking-wider uppercase">Corte e Dobra</p>
            </div>
          </div>
          {user && (
            <div className="mt-3 px-1">
              <p className="text-xs font-semibold text-sidebar-foreground/80 truncate">{user.full_name || user.email}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-white/10 text-sidebar-foreground/70 border border-white/10">
                  {user.role || "user"}
                </span>
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
              {user?.maquina && MAQUINA_CD_ROUTE_MAP[user.maquina] && renderLink({
                path: MAQUINA_CD_ROUTE_MAP[user.maquina],
                label: user.maquina,
                icon: Wrench,
              })}
              {renderLink({ path: "/corte-dobra/calculos", label: "Cálculos", icon: FlaskConical })}
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mt-5 mb-3">
                Reservas
              </p>
              {renderLink({ path: "/vendedor", label: "Reservar Bobinas", icon: BookmarkPlus })}
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
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-sidebar-border space-y-1">
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
          {isAmbos && (
            <button
              onClick={() => navigate("/setor")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all cursor-pointer"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Trocar Setor</span>
            </button>
          )}
          <button
            onClick={() => base44.auth.logout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all cursor-pointer"
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