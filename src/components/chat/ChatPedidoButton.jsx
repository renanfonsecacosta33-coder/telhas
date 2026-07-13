import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";
import ChatPanel from "./ChatPanel";
import { useUnreadCount } from "@/hooks/useUnreadMessages";

export default function ChatPedidoButton({ canal_id, canal_label, currentUser, variant = "icon" }) {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(currentUser, "pedido", canal_id);

  if (variant === "button") {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button className="relative inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-muted transition-colors text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
            Chat
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md p-0 flex flex-col max-h-[80vh] overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="w-4 h-4 text-orange-500" /> Chat — {canal_label}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <ChatPanel canal_tipo="pedido" canal_id={canal_id} canal_label={canal_label} currentUser={currentUser} heightClass="h-[400px]" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors" title="Chat do pedido">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-0 flex flex-col max-h-[80vh] overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="w-4 h-4 text-orange-500" /> Chat — {canal_label}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <ChatPanel canal_tipo="pedido" canal_id={canal_id} canal_label={canal_label} currentUser={currentUser} heightClass="h-[400px]" />
        </div>
      </DialogContent>
    </Dialog>
  );
}