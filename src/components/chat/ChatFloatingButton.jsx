import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MessageCircle } from "lucide-react";
import ChatPanel from "./ChatPanel";
import { useUnreadCount } from "@/hooks/useUnreadMessages";

export default function ChatFloatingButton({ canal_id, canal_label, currentUser }) {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(currentUser, "maquina", canal_id);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-orange-500 text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
      >
        <MessageCircle className="w-6 h-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-orange-500" /> Chat — {canal_label}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ChatPanel canal_tipo="maquina" canal_id={canal_id} canal_label={canal_label} currentUser={currentUser} heightClass="h-[calc(100vh-120px)]" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}