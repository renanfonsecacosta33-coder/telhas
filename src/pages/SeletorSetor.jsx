import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChevronRight, BookmarkPlus, Truck, BarChart3, Factory, Scissors, LayoutDashboard, Settings, ShieldAlert, Users } from "lucide-react";
import UserAvatarButton from "@/components/UserAvatarButton";
import { cn } from "@/lib/utils";

export default function SeletorSetor() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [navegando, setNavegando] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isGerencia = user?.gerencia === true;
  const isAdmin = user?.role === "admin";

  const selecionarSetor = async (setor) => {
    if (navegando) return;
    setNavegando(true);
    try {
      await base44.auth.updateMe({ setor });
    } catch (e) {
      // Segue mesmo se falhar
    }
    navigate(setor === "telhas" ? "/" : "/corte-dobra");
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = user?.full_name ? user.full_name.split(' ')[0] : "Usuário";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col p-6 lg:p-12 relative overflow-hidden">
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
            <p className="text-muted-foreground mt-1 text-base">
              Bem-vindo ao AJL ERP. Selecione um módulo para acessar.
            </p>
          </div>
        </div>
        <div>
          <UserAvatarButton size="lg" />
        </div>
      </div>

      {/* Grid of Modules */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 z-10 pb-12">
        
        {/* Produção Group */}
        <ModuleCard
          title="Fábrica de Telhas"
          description="Operação, máquinas e produção de telhas"
          icon={<Factory className="w-7 h-7 text-white" />}
          gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
          borderColor="border-slate-700/50 hover:border-slate-500"
          iconBg="bg-slate-700 shadow-slate-900/50"
          textColor="text-white"
          descColor="text-slate-400"
          onClick={() => selecionarSetor("telhas")}
          disabled={navegando}
        />

        <ModuleCard
          title="Corte e Dobra"
          description="Operação, máquinas e produção de corte e dobra"
          icon={<Scissors className="w-7 h-7 text-white" />}
          gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
          borderColor="border-slate-700/50 hover:border-slate-500"
          iconBg="bg-slate-700 shadow-slate-900/50"
          textColor="text-white"
          descColor="text-slate-400"
          onClick={() => selecionarSetor("corte_dobra")}
          disabled={navegando}
        />

        {/* Logística */}
        <ModuleCard
          title="Logística & Frota"
          description="Expedição, cargas, romaneios e frota"
          icon={<Truck className="w-7 h-7 text-emerald-400" />}
          gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
          borderColor="border-slate-700/50 hover:border-emerald-500/50"
          iconBg="bg-emerald-500/10 shadow-emerald-900/20"
          textColor="text-white"
          descColor="text-slate-400"
          onClick={() => { setNavegando(true); navigate("/logistica"); }}
          disabled={navegando}
        />

        {/* Vendas */}
        <ModuleCard
          title="Consulta de Estoque"
          description="Consulte saldo e realize reservas de bobinas"
          icon={<BookmarkPlus className="w-7 h-7 text-blue-400" />}
          gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
          borderColor="border-slate-700/50 hover:border-blue-500/50"
          iconBg="bg-blue-500/10 shadow-blue-900/20"
          textColor="text-white"
          descColor="text-slate-400"
          onClick={() => navigate("/vendedor")}
          disabled={navegando}
        />

        <ModuleCard
          title="Painel do Vendedor"
          description="Visão geral, metas, comissões e histórico"
          icon={<BarChart3 className="w-7 h-7 text-indigo-400" />}
          gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
          borderColor="border-slate-700/50 hover:border-indigo-500/50"
          iconBg="bg-indigo-500/10 shadow-indigo-900/20"
          textColor="text-white"
          descColor="text-slate-400"
          onClick={() => navigate("/vendedor-dashboard")}
          disabled={navegando}
        />

        {/* Admin / Gestão */}
        <ModuleCard
          title="Dashboard AJL"
          description="Painel principal de indicadores e metas"
          icon={<LayoutDashboard className="w-7 h-7 text-orange-400" />}
          gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
          borderColor="border-slate-700/50 hover:border-orange-500/50"
          iconBg="bg-orange-500/10 shadow-orange-900/20"
          textColor="text-white"
          descColor="text-slate-400"
          href="https://dashboard-ajl.base44.app"
        />

        {isGerencia && (
          <ModuleCard
            title="Gerência de Fábricas"
            description="Controle avançado, OEE e eficiência"
            icon={<Settings className="w-7 h-7 text-amber-400" />}
            gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
            borderColor="border-slate-700/50 hover:border-amber-500/50"
            iconBg="bg-amber-500/10 shadow-amber-900/20"
            textColor="text-white"
            descColor="text-slate-400"
            href="https://gerencial-fabricas.base44.app"
          />
        )}

        {isAdmin && (
          <>
            <ModuleCard
              title="Control Tower"
              description="Acesso irrestrito às configurações do ERP"
              icon={<ShieldAlert className="w-7 h-7 text-rose-400" />}
              gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
              borderColor="border-slate-700/50 hover:border-rose-500/50"
              iconBg="bg-rose-500/10 shadow-rose-900/20"
              textColor="text-white"
              descColor="text-slate-400"
              onClick={() => navigate("/painel-admin")}
              disabled={navegando}
            />
            <ModuleCard
              title="Gestão de Usuários"
              description="Permissões, layouts e acessos Odoo-style"
              icon={<Users className="w-7 h-7 text-purple-400" />}
              gradient="from-slate-800 to-slate-900 dark:from-slate-900 dark:to-slate-950"
              borderColor="border-slate-700/50 hover:border-purple-500/50"
              iconBg="bg-purple-500/10 shadow-purple-900/20"
              textColor="text-white"
              descColor="text-slate-400"
              onClick={() => navigate("/usuarios")}
              disabled={navegando}
            />
          </>
        )}

      </div>
    </div>
  );
}

function ModuleCard({ 
  title, 
  description, 
  icon, 
  onClick, 
  href, 
  disabled, 
  gradient, 
  borderColor = "border-transparent",
  iconBg = "bg-white/20",
  textColor = "text-white",
  descColor = "text-white/70"
}) {
  const content = (
    <div className={cn(
      "relative h-full flex flex-col p-6 rounded-2xl border transition-all duration-300 group overflow-hidden",
      "hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 active:translate-y-0",
      `bg-gradient-to-br ${gradient} ${borderColor}`,
      disabled && "opacity-60 pointer-events-none"
    )}>
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

      <div className="absolute top-6 right-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-md shadow-sm", textColor)}>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className="block w-full h-full text-left outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
      {content}
    </button>
  );
}