import React, { useState, useEffect, useRef } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import FilialSwitcher from "@/components/FilialSwitcher";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CentralChats from "@/components/chat/CentralChats";
import { useAllUnreadCount } from "@/hooks/useUnreadMessages";
import { playAlertSound } from "@/lib/sounds";
import { toast } from "sonner";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centralChatsOpen, setCentralChatsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const isGestorTelhas = user?.role === "admin" || user?.role === "super_admin" || user?.gerencia === true;
  const unreadChats = useAllUnreadCount(user);
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
      <main className="lg:ml-64 min-h-screen">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-end gap-2 lg:hidden">
          <FilialSwitcher />
        </div>
        <div className="hidden lg:flex sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-8 py-2 items-center justify-end gap-2">
          {isGestorTelhas && (
            <button
              onClick={() => setCentralChatsOpen(true)}
              className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
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
          <FilialSwitcher />
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {isGestorTelhas && (
        <CentralChats user={user} open={centralChatsOpen} onOpenChange={setCentralChatsOpen} />
      )}
    </div>
  );
}