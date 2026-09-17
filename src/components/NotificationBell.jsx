import React, { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import NotificationsDrawer from "@/components/notifications/NotificationsDrawer";
import { playAlertSound } from "@/lib/sounds";
import { toast } from "sonner";

export default function NotificationBell({ user }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();
  const prevUnreadRef = useRef(null);

  // Busca notificações relevantes (para a filial atual ou 'Todas')
  const { data: notificacoes = [], refetch } = useQuery({
    queryKey: ["notificacoes", filialAtiva],
    queryFn: async () => {
      try {
        const list = await base44.entities.Notificacao.filter(
          {
            $or: [
              { unidade: filialAtiva },
              { unidade: "Todas" }
            ]
          },
          "-data_hora",
          50
        );
        return list;
      } catch (e) {
        // Fallback para caso filtro $or não seja suportado diretamente
        try {
          const all = await base44.entities.Notificacao.list("-data_hora", 50);
          return all.filter(n => !n.unidade || n.unidade === "Todas" || n.unidade === filialAtiva);
        } catch {
          return [];
        }
      }
    },
    refetchInterval: 15000,
  });

  const unreadCount = notificacoes.filter(n => !n.lida).length;

  // Notificar sonoramente e com toast quando uma nova notificação chega
  useEffect(() => {
    if (prevUnreadRef.current !== null && unreadCount > prevUnreadRef.current) {
      playAlertSound();
      const maisRecente = notificacoes.find(n => !n.lida);
      if (maisRecente) {
        toast.info(maisRecente.titulo || "🔔 Nova Notificação!", {
          description: maisRecente.mensagem,
          action: maisRecente.link ? {
            label: "Ver",
            onClick: () => setDrawerOpen(true)
          } : undefined,
          duration: 5000
        });
      }
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, notificacoes]);

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="relative p-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all duration-200 cursor-pointer shadow-xs hover:scale-105 active:scale-95"
        title="Central de Notificações"
        aria-label="Notificações"
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? "text-primary animate-bounce" : "text-muted-foreground"}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm ring-2 ring-background animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        notificacoes={notificacoes}
        refetch={refetch}
      />
    </>
  );
}
