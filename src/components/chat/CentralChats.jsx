import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatPanel from "./ChatPanel";
import { MessageCircle, Factory, ClipboardList, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CentralChats({ user, open, onOpenChange }) {
  const [mensagens, setMensagens] = useState([]);
  const [canalSelecionado, setCanalSelecionado] = useState(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    const carregar = async () => {
      try {
        const msgs = await base44.entities.MensagemChat.list("-data_hora", 500);
        if (!active) return;
        setMensagens(msgs);
      } catch {}
    };
    carregar();
    const interval = setInterval(carregar, 5000);
    const unsubscribe = base44.entities.MensagemChat.subscribe(carregar);
    return () => { active = false; clearInterval(interval); unsubscribe(); };
  }, [open]);

  const canais = useMemo(() => {
    const map = {};
    mensagens.forEach(m => {
      const key = `${m.canal_tipo}:${m.canal_id}`;
      if (!map[key]) {
        map[key] = {
          canal_tipo: m.canal_tipo,
          canal_id: m.canal_id,
          label: m.canal_label || m.canal_id,
          ultima_msg: m,
          nao_lidas: 0,
          total: 0,
        };
      }
      map[key].total++;
      if (!m.lido && m.remetente_id !== user?.id) map[key].nao_lidas++;
      if (new Date(m.data_hora) > new Date(map[key].ultima_msg.data_hora)) {
        map[key].ultima_msg = m;
      }
    });
    return Object.values(map).sort((a, b) => new Date(b.ultima_msg.data_hora) - new Date(a.ultima_msg.data_hora));
  }, [mensagens, user?.id]);

  const canaisFiltrados = useMemo(() => {
    if (!busca.trim()) return canais;
    const q = busca.toLowerCase().trim();
    return canais.filter(c => c.label.toLowerCase().includes(q) || c.ultima_msg.conteudo.toLowerCase().includes(q));
  }, [canais, busca]);

  const totalNaoLidas = canais.reduce((s, c) => s + c.nao_lidas, 0);

  const canalSel = canalSelecionado
    ? canais.find(c => c.canal_tipo === canalSelecionado.tipo && c.canal_id === canalSelecionado.id)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-orange-500" />
            Central de Chats
            {totalNaoLidas > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{totalNaoLidas}</span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Lista de canais */}
          <div className={`flex flex-col border-r border-border ${canalSelecionado ? "hidden sm:flex w-[280px]" : "flex-1"} flex-shrink-0`}>
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar canal..."
                  className="h-8 pl-8 pr-3 text-xs"
                />
                {busca && (
                  <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {canaisFiltrados.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground text-center p-4">
                  Nenhum chat ativo ainda.
                </div>
              ) : (
                canaisFiltrados.map(c => (
                  <button
                    key={`${c.canal_tipo}:${c.canal_id}`}
                    onClick={() => setCanalSelecionado({ tipo: c.canal_tipo, id: c.canal_id, label: c.label })}
                    className={`w-full text-left px-3 py-3 border-b border-border hover:bg-muted/50 transition-colors flex items-start gap-2 ${canalSelecionado?.id === c.canal_id ? "bg-muted" : ""}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.canal_tipo === "maquina" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"}`}>
                      {c.canal_tipo === "maquina" ? <Factory className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">{c.label}</span>
                        {c.nao_lidas > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">{c.nao_lidas}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.ultima_msg.conteudo}</p>
                      <span className="text-[10px] text-muted-foreground/70">
                        {c.ultima_msg.data_hora ? format(new Date(c.ultima_msg.data_hora), "dd/MM HH:mm", { locale: ptBR }) : ""}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat selecionado */}
          {canalSelecionado ? (
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-7 sm:hidden text-xs" onClick={() => setCanalSelecionado(null)}>← Voltar</Button>
                <span className="text-sm font-semibold truncate">{canalSelecionado.label}</span>
                <Button variant="ghost" size="sm" className="h-7 ml-auto text-xs" onClick={() => setCanalSelecionado(null)}>Fechar</Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel
                  canal_tipo={canalSelecionado.tipo}
                  canal_id={canalSelecionado.id}
                  canal_label={canalSelecionado.label}
                  currentUser={user}
                  heightClass="h-[calc(100vh-120px)]"
                />
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Selecione um canal para ver as mensagens
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}