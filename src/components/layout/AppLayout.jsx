import React, { useState, useEffect, useRef } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import FilialSwitcher from "@/components/FilialSwitcher";
import UserAvatarButton from "@/components/UserAvatarButton";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import CentralChats from "@/components/chat/CentralChats";
import CentralMensagensDireto from "@/components/chat/CentralMensagensDireto";
import { useAllUnreadCount, useUnreadCount } from "@/hooks/useUnreadMessages";
import { playAlertSound } from "@/lib/sounds";
import { toast } from "sonner";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";
import { Search } from "lucide-react";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centralChatsOpen, setCentralChatsOpen] = useState(false);
  const [centralDiretoOpen, setCentralDiretoOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const navigate = useNavigate();

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

  // Listener global de teclado para Ctrl + K / Cmd + K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
          <button onClick={() => setCentralDiretoOpen(true)} className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer" title="Mensagens Diretas">
            <MessageCircle className={`w-4 h-4 ${unreadDirect > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
            {unreadDirect > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unreadDirect}</span>}
          </button>
          <FilialSwitcher />
          <UserAvatarButton size="sm" />
        </div>
        <div className="hidden lg:flex sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-8 py-2 items-center justify-end gap-2">
          {/* Botão de Busca Rápida Ctrl+K */}
          <button 
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors cursor-pointer mr-auto"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar OPs, Bobinas, Clientes...</span>
            <kbd className="bg-background border border-border text-[10px] px-1.5 py-0.5 rounded font-mono">Ctrl+K</kbd>
          </button>

          <button onClick={() => setCentralDiretoOpen(true)} className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer" title="Mensagens Diretas">
            <MessageCircle className={`w-4 h-4 ${unreadDirect > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
            {unreadDirect > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unreadDirect}</span>}
          </button>
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
          <UserAvatarButton size="sm" />
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {isGestorTelhas && (
        <CentralChats user={user} open={centralChatsOpen} onOpenChange={setCentralChatsOpen} />
      )}
      <CentralMensagensDireto user={user} open={centralDiretoOpen} onOpenChange={setCentralDiretoOpen} />
      <GlobalCommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </div>
  );
}