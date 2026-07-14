import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import SidebarCD from "./SidebarCD";
import FilialSwitcher from "@/components/FilialSwitcher";
import AlertBellCD from "@/components/corte-dobra/AlertBellCD";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CentralMensagensDireto from "@/components/chat/CentralMensagensDireto";
import { useUnreadCount } from "@/hooks/useUnreadMessages";

export default function AppLayoutCD() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centralDiretoOpen, setCentralDiretoOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const unreadDirect = useUnreadCount(user, "direto");

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  // Operador de Telhas acessando layout do CD → redireciona
  if (user && user.setor === "telhas") {
    return <Navigate to="/" replace />;
  }

  // Usuário sem setor/papel definido → redireciona ao seletor de setor
  if (user && user.role !== "admin" && !user.setor && !user.maquina) {
    return <Navigate to="/setor" replace />;
  }

  // Operador restrito: só acessa suas máquinas + cálculos, bloqueia outras páginas
  const isOperadorRestrito = user && user.role !== "admin" && user.role !== "super_admin";
  if (isOperadorRestrito) {
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
    const maquinas = parseMaquinas(user.maquina);
    const rotasMaquina = maquinas.map(m => MAQUINA_CD_ROUTE_MAP[m]).filter(Boolean);
    const pathname = window.location.pathname;
    // Operador no dashboard → redireciona pra primeira máquina
    if (pathname === "/corte-dobra" && rotasMaquina.length > 0) {
      return <Navigate to={rotasMaquina[0]} replace />;
    }
    const rotasPermitidas = ["/corte-dobra/calculos", ...rotasMaquina];
    const permitido = rotasPermitidas.some(r => pathname === r || pathname.startsWith(r));
    if (!permitido) {
      return <Navigate to={rotasMaquina[0] || "/corte-dobra/calculos"} replace />;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SidebarCD isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="lg:ml-64 min-h-screen">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-end gap-2 lg:hidden">
          <AlertBellCD user={user} />
          <button onClick={() => setCentralDiretoOpen(true)} className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer" title="Mensagens Diretas">
            <MessageCircle className={`w-4 h-4 ${unreadDirect > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
            {unreadDirect > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unreadDirect}</span>}
          </button>
          <FilialSwitcher />
        </div>
        <div className="hidden lg:flex sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-8 py-2 items-center justify-end gap-2">
          <AlertBellCD user={user} />
          <button onClick={() => setCentralDiretoOpen(true)} className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer" title="Mensagens Diretas">
            <MessageCircle className={`w-4 h-4 ${unreadDirect > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
            {unreadDirect > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unreadDirect}</span>}
          </button>
          <FilialSwitcher />
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      <CentralMensagensDireto user={user} open={centralDiretoOpen} onOpenChange={setCentralDiretoOpen} />
    </div>
  );
}