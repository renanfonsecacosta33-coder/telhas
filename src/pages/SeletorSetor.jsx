import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { 
  ChevronRight, 
  BookmarkPlus, 
  Truck, 
  BarChart3, 
  Factory, 
  Scissors, 
  LayoutDashboard, 
  Settings, 
  ShieldAlert, 
  Users, 
  GripVertical,
  Move
} from "lucide-react";
import UserAvatarButton from "@/components/UserAvatarButton";
import { cn } from "@/lib/utils";

const ALL_MODULES = [
  {
    key: "app_fabrica_telhas",
    title: "Barracão Telhas",
    description: "Operação, máquinas e produção de telhas",
    icon: <Factory className="w-7 h-7 text-white" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-slate-500",
    iconBg: "bg-slate-700 shadow-slate-900/50",
    type: "action_setor",
    setorTarget: "telhas"
  },
  {
    key: "app_corte_dobra",
    title: "Barracão C&D",
    description: "Operação, máquinas e produção de corte e dobra",
    icon: <Scissors className="w-7 h-7 text-white" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-slate-500",
    iconBg: "bg-slate-700 shadow-slate-900/50",
    type: "action_setor",
    setorTarget: "corte_dobra"
  },
  {
    key: "app_logistica",
    title: "Logística",
    description: "Expedição, cargas, romaneios e frota",
    icon: <Truck className="w-7 h-7 text-emerald-400" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-emerald-500/50",
    iconBg: "bg-emerald-500/10 shadow-emerald-900/20",
    type: "route",
    routeTarget: "/logistica"
  },
  {
    key: "app_consulta_estoque",
    title: "Estoque Rápido",
    description: "Consulte saldo e realize reservas de bobinas",
    icon: <BookmarkPlus className="w-7 h-7 text-blue-400" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-blue-500/50",
    iconBg: "bg-blue-500/10 shadow-blue-900/20",
    type: "route",
    routeTarget: "/vendedor"
  },
  {
    key: "app_painel_vendedor",
    title: "Painel de Vendas",
    description: "Visão geral, metas, comissões e histórico",
    icon: <BarChart3 className="w-7 h-7 text-indigo-400" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-indigo-500/50",
    iconBg: "bg-indigo-500/10 shadow-indigo-900/20",
    type: "route",
    routeTarget: "/vendedor-dashboard"
  },
  {
    key: "app_dashboard_ajl",
    title: "Dashboard AJL",
    description: "Painel principal de indicadores e metas",
    icon: <LayoutDashboard className="w-7 h-7 text-orange-400" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-orange-500/50",
    iconBg: "bg-orange-500/10 shadow-orange-900/20",
    type: "link",
    href: "https://dashboard-ajl.base44.app"
  },
  {
    key: "app_gerencia_fabricas",
    title: "Gerencial",
    description: "Controle avançado, OEE e eficiência",
    icon: <Settings className="w-7 h-7 text-amber-400" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-amber-500/50",
    iconBg: "bg-amber-500/10 shadow-amber-900/20",
    type: "link",
    href: "https://gerencial-fabricas.base44.app"
  },
  {
    key: "app_control_tower",
    title: "Painel Administrativo",
    description: "Acesso irrestrito às configurações do ERP",
    icon: <ShieldAlert className="w-7 h-7 text-rose-400" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-rose-500/50",
    iconBg: "bg-rose-500/10 shadow-rose-900/20",
    type: "route",
    routeTarget: "/painel-admin"
  },
  {
    key: "app_gestao_usuarios",
    title: "Usuários",
    description: "Permissões, layouts e acessos Odoo-style",
    icon: <Users className="w-7 h-7 text-purple-400" />,
    gradient: "from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950",
    borderColor: "border-slate-700/50 hover:border-purple-500/50",
    iconBg: "bg-purple-500/10 shadow-purple-900/20",
    type: "route",
    routeTarget: "/usuarios"
  }
];

export default function SeletorSetor() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [navegando, setNavegando] = useState(false);
  const [modulesList, setModulesList] = useState(ALL_MODULES);

  // Estados de Drag and Drop
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    base44.auth.me().then(fetchedUser => {
      setUser(fetchedUser);

      // Carregar ordem salva do usuário
      const savedOrderKeys = fetchedUser?.layout_preferences?.app_order || 
        JSON.parse(localStorage.getItem(`ajl_app_order_${fetchedUser?.id}`) || "[]");

      if (savedOrderKeys && savedOrderKeys.length > 0) {
        const ordered = [...ALL_MODULES].sort((a, b) => {
          const idxA = savedOrderKeys.indexOf(a.key);
          const idxB = savedOrderKeys.indexOf(b.key);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        setModulesList(ordered);
      }
    }).catch(() => {});
  }, []);

  const selecionarSetor = async (setor) => {
    if (navegando) return;
    setNavegando(true);
    try {
      await base44.auth.updateMe({ setor });
    } catch (e) {}
    navigate(setor === "telhas" ? "/" : "/corte-dobra");
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : "Usuário";

  // Verificar visibilidade do app por usuário
  const isAppVisible = (appKey) => {
    if (!user) return true;
    const role = user.role;
    const perms = user.permissions || {};

    if (typeof perms[appKey] === "boolean") {
      return perms[appKey];
    }

    if (role === "super_admin" || role === "admin") return true;

    if (role === "encarregado") {
      return ["app_fabrica_telhas", "app_corte_dobra", "app_logistica", "app_consulta_estoque", "app_dashboard_ajl"].includes(appKey);
    }

    if (role === "vendedor") {
      return ["app_painel_vendedor", "app_consulta_estoque", "app_dashboard_ajl"].includes(appKey);
    }

    if (role === "operador") {
      if (user.setor === "corte_dobra") return appKey === "app_corte_dobra";
      if (user.setor === "telhas") return appKey === "app_fabrica_telhas";
      return ["app_fabrica_telhas", "app_corte_dobra"].includes(appKey);
    }

    return true;
  };

  // Drag and Drop Handlers (Odoo-Style)
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Torna a imagem de drag levemente transparente
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...modulesList];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);

    setModulesList(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Salva a nova ordem de aplicativos no perfil do usuário e localStorage
    const newOrderKeys = updated.map(m => m.key);
    if (user?.id) {
      localStorage.setItem(`ajl_app_order_${user.id}`, JSON.stringify(newOrderKeys));
      base44.auth.updateMe({
        layout_preferences: {
          ...(user.layout_preferences || {}),
          app_order: newOrderKeys
        }
      }).catch(() => {});
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Filtrar apenas módulos visíveis para o usuário
  const visibleModules = modulesList.filter(m => isAppVisible(m.key));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col p-6 lg:p-12 relative overflow-hidden select-none">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

      {/* Header */}
      <div className="w-full max-w-6xl mx-auto flex justify-between items-start z-10 mb-12 mt-4 lg:mt-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-3xl">A</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {firstName} 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-base flex items-center gap-2">
              <span>Selecione um módulo ou arraste para reordenar a sua tela inicial Odoo-style.</span>
            </p>
          </div>
        </div>
        <div>
          <UserAvatarButton size="lg" />
        </div>
      </div>

      {/* Grid de Módulos com Arrastar e Soltar (Drag and Drop) */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 z-10 pb-12">
        {visibleModules.map((mod, index) => {
          const isBeingDragged = draggedIndex === index;
          const isHoveredTarget = dragOverIndex === index && draggedIndex !== index;

          const handleCardClick = () => {
            if (mod.type === "action_setor") {
              selecionarSetor(mod.setorTarget);
            } else if (mod.type === "route") {
              setNavegando(true);
              navigate(mod.routeTarget);
            } else if (mod.type === "link") {
              window.open(mod.href, "_blank", "noopener,noreferrer");
            }
          };

          return (
            <div
              key={mod.key}
              draggable={!navegando}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "transition-all duration-200 cursor-grab active:cursor-grabbing relative rounded-2xl",
                isBeingDragged && "opacity-30 scale-95 ring-2 ring-dashed ring-primary",
                isHoveredTarget && "ring-4 ring-primary ring-offset-2 ring-offset-background scale-105 z-20"
              )}
            >
              <ModuleCard
                title={mod.title}
                description={mod.description}
                icon={mod.icon}
                gradient={mod.gradient}
                borderColor={mod.borderColor}
                iconBg={mod.iconBg}
                textColor="text-white"
                descColor="text-slate-400"
                onClick={handleCardClick}
                disabled={navegando}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleCard({ 
  title, 
  description, 
  icon, 
  onClick, 
  disabled, 
  gradient, 
  borderColor = "border-transparent",
  iconBg = "bg-white/20",
  textColor = "text-white",
  descColor = "text-white/70"
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "relative h-full flex flex-col p-6 rounded-2xl border transition-all duration-300 group overflow-hidden select-none",
        "hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 active:translate-y-0",
        `bg-gradient-to-br ${gradient} ${borderColor}`,
        disabled && "opacity-60 pointer-events-none"
      )}
    >
      {/* Alça de Arrastar (Odoo-Style Drag Handle) */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded-md text-white/60 hover:text-white cursor-grab">
        <GripVertical className="w-5 h-5" />
      </div>

      <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center mb-5 shadow-inner transition-transform duration-300 group-hover:scale-110", iconBg)}>
        {icon}
      </div>
      
      <div className="mt-auto">
        <h3 className={cn("text-lg font-bold tracking-tight mb-1.5", textColor)}>
          {title}
        </h3>
        <p className={cn("text-sm leading-relaxed", descColor)}>
          {description}
        </p>
      </div>

      <div className="absolute bottom-6 right-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-md shadow-sm", textColor)}>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}