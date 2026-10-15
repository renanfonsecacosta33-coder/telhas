import React, { useState, useEffect, useRef } from "react";
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import FilialSwitcher from "@/components/FilialSwitcher";
import UserAvatarButton from "@/components/UserAvatarButton";
import EcosystemHeaderBar from "@/components/layout/EcosystemHeaderBar";
import PageTransition from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CentralChats from "@/components/chat/CentralChats";
import CentralMensagensDireto from "@/components/chat/CentralMensagensDireto";
import { useAllUnreadCount, useUnreadCount } from "@/hooks/useUnreadMessages";
import { playAlertSound } from "@/lib/sounds";
import { toast } from "sonner";
import AjlCopilot from "@/components/ai/AjlCopilot";
import ScrollNavigationFab from "@/components/ui/ScrollNavigationFab";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centralChatsOpen, setCentralChatsOpen] = useState(false);
  const [centralDiretoOpen, setCentralDiretoOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Limpeza de overlays órfãos em trocas de rota para evitar telas esmaecidas ou bloqueadas
  useEffect(() => {
    document.body.style.pointerEvents = "";
    document.body.removeAttribute("data-scroll-locked");
    const overlaysOrfaos = document.querySelectorAll(
      '[data-radix-portal] > [data-state="closed"], [data-radix-dialog-overlay][data-state="closed"]'
    );
    overlaysOrfaos.forEach(el => el.remove());
  }, [location.pathname, location.search]);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const isGestorTelhas = user?.role === "admin" || user?.role === "super_admin" || user?.gerencia === true;
  const unreadChats = useAllUnreadCount(user);
  const unreadDirect = useUnreadCount(user, "direto");
  const prevChatRef = useRef(null);

  useEffect(() => {
    if (!isGestorTelhas) return;
    if (prevChatRef.current !== null && unreadChats > prevChatRef.current) {
      playAlertSound();
      toast.info("💬 Nova mensagem no chat!", { duration: 4000 });
    }
    prevChatRef.current = unreadChats;
  }, [unreadChats, isGestorTelhas]);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Operador do CD acessando layout de Telhas → redireciona
  if (user && user.setor === "corte_dobra") {
    return <Navigate to="/corte-dobra" replace />;
  }

  // Usuário sem setor/papel definido → redireciona ao seletor de setor
  if (user && user.role !== "admin" && !user.setor && !user.maquina) {
    return <Navigate to="/setor" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className={`min-h-screen transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-16"}`}>
        <EcosystemHeaderBar
          user={user}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        >
          <button onClick={() => setCentralDiretoOpen(true)} className="relative p-2 rounded-xl border border-border bg-card hover:bg-muted transition-colors cursor-pointer" title="Mensagens Diretas">
            <MessageCircle className={`w-4 h-4 ${unreadDirect > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
            {unreadDirect > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unreadDirect}</span>}
          </button>
          {isGestorTelhas && (
            <button
              onClick={() => setCentralChatsOpen(true)}
              className="relative p-2 rounded-xl border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
              title="Central de Chats"
            >
              <MessageCircle className={`w-4 h-4 ${unreadChats > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
              {unreadChats > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                  {unreadChats}
                </span>
              )}
            </button>
          )}
        </EcosystemHeaderBar>
        <div className="p-4 sm:p-6 lg:p-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </main>

      {isGestorTelhas && (
        <CentralChats user={user} open={centralChatsOpen} onOpenChange={setCentralChatsOpen} />
      )}
      <CentralMensagensDireto user={user} open={centralDiretoOpen} onOpenChange={setCentralDiretoOpen} />
      <AjlCopilot />
      <ScrollNavigationFab />
    </div>
  );
}