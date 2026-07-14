import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatPanel from "./ChatPanel";
import { MessageCircle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function getDirectChannelId(userA, userB) {
  return [userA, userB].sort().join("_");
}

const ROLE_CONFIG = {
  admin: { label: "Admin", color: "bg-red-100 text-red-700" },
  super_admin: { label: "Admin", color: "bg-red-100 text-red-700" },
  gestor: { label: "Gestor", color: "bg-blue-100 text-blue-700" },
  vendedor: { label: "Vendedor", color: "bg-emerald-100 text-emerald-700" },
};

export default function CentralMensagensDireto({ user, open, onOpenChange }) {
  const [equipe, setEquipe] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [contatoSelecionado, setContatoSelecionado] = useState(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    const carregarEquipe = async () => {
      try {
        const res = await base44.functions.invoke("listarEquipe", {});
        if (!active) return;
        setEquipe(res.data?.equipe || []);
      } catch {}
    };
    carregarEquipe();
  }, [open]);

  useEffect(() => {
    if (!open || !user?.id) return;
    let active = true;
    const carregar = async () => {
      try {
        const msgs = await base44.entities.MensagemChat.filter({ canal_tipo: "direto" }, "-data_hora", 500);
        if (!active) return;
        setMensagens(msgs);
      } catch {}
    };
    carregar();
    const interval = setInterval(carregar, 5000);
    const unsubscribe = base44.entities.MensagemChat.subscribe(carregar);
    return () => { active = false; clearInterval(interval); unsubscribe(); };
  }, [open, user?.id]);

  const contatos = useMemo(() => {
    const map = {};
    equipe.forEach(m => {
      map[m.id] = { ...m, ultima_msg: null, nao_lidas: 0 };
    });
    mensagens.forEach(m => {
      const otherId = m.remetente_id === user?.id ? m.destinatario_id : m.remetente_id;
      if (!otherId) return;
      if (!map[otherId]) {
        map[otherId] = {
          id: otherId,
          full_name: m.remetente_id === user?.id ? (m.canal_label?.split(" → ")[1] || "Contato") : m.remetente_nome,
          role: "",
          ultima_msg: null,
          nao_lidas: 0,
        };
      }
      if (!m.lido && m.remetente_id !== user?.id) map[otherId].nao_lidas++;
      if (!map[otherId].ultima_msg || new Date(m.data_hora) > new Date(map[otherId].ultima_msg.data_hora)) {
        map[otherId].ultima_msg = m;
      }
    });
    return Object.values(map).sort((a, b) => {
      if (a.ultima_msg && b.ultima_msg) return new Date(b.ultima_msg.data_hora) - new Date(a.ultima_msg.data_hora);
      if (a.ultima_msg) return -1;
      if (b.ultima_msg) return 1;
      return (a.full_name || "").localeCompare(b.full_name || "");
    });
  }, [equipe, mensagens, user?.id]);

  const contatosFiltrados = useMemo(() => {
    if (!busca.trim()) return contatos;
    const q = busca.toLowerCase().trim();
    return contatos.filter(c => (c.full_name || "").toLowerCase().includes(q));
  }, [contatos, busca]);

  const totalNaoLidas = contatos.reduce((s, c) => s + c.nao_lidas, 0);
  const canalId = contatoSelecionado ? getDirectChannelId(user?.id, contatoSelecionado.id) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            Mensagens Diretas
            {totalNaoLidas > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{totalNaoLidas}</span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          <div className={`flex flex-col border-r border-border ${contatoSelecionado ? "hidden sm:flex w-[280px]" : "flex-1"} flex-shrink-0`}>
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar contato..." className="h-8 pl-8 pr-3 text-xs" />
                {busca && (
                  <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {contatosFiltrados.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground text-center p-4">
                  Nenhum contato disponível.
                </div>
              ) : (
                contatosFiltrados.map(c => {
                  const roleCfg = ROLE_CONFIG[c.role] || { label: "", color: "bg-muted text-muted-foreground" };
                  return (
                    <button
                      key={c.id}
                      onClick={() => setContatoSelecionado(c)}
                      className={`w-full text-left px-3 py-3 border-b border-border hover:bg-muted/50 transition-colors flex items-start gap-2 ${contatoSelecionado?.id === c.id ? "bg-muted" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                        {(c.full_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold truncate">{c.full_name || "—"}</span>
                          {c.nao_lidas > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">{c.nao_lidas}</span>
                          )}
                        </div>
                        {c.role && <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 inline-block mt-0.5 ${roleCfg.color}`}>{roleCfg.label}</span>}
                        {c.ultima_msg && (
                          <>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{c.ultima_msg.conteudo}</p>
                            <span className="text-[10px] text-muted-foreground/70">
                              {c.ultima_msg.data_hora ? format(new Date(c.ultima_msg.data_hora), "dd/MM HH:mm", { locale: ptBR }) : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {contatoSelecionado ? (
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-7 sm:hidden text-xs" onClick={() => setContatoSelecionado(null)}>← Voltar</Button>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(contatoSelecionado.full_name || "?").charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-semibold truncate">{contatoSelecionado.full_name}</span>
                <Button variant="ghost" size="sm" className="h-7 ml-auto text-xs" onClick={() => setContatoSelecionado(null)}>Fechar</Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel
                  canal_tipo="direto"
                  canal_id={canalId}
                  canal_label={`${user?.full_name || ""} → ${contatoSelecionado.full_name}`}
                  currentUser={user}
                  destinatarioId={contatoSelecionado.id}
                  heightClass="h-[calc(100vh-120px)]"
                />
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Selecione um contato para iniciar uma conversa
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}