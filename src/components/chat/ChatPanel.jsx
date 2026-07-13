import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ChatPanel({ canal_tipo, canal_id, canal_label, currentUser, heightClass = "h-[400px]" }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!canal_id) return;
    let active = true;
    const carregar = async () => {
      try {
        const msgs = await base44.entities.MensagemChat.filter({ canal_tipo, canal_id }, "data_hora", 500);
        if (!active) return;
        setMensagens(msgs);
        msgs.forEach(m => {
          if (!m.lido && m.remetente_id !== currentUser?.id) {
            base44.entities.MensagemChat.update(m.id, { lido: true });
          }
        });
      } catch {}
    };
    carregar();
    const unsubscribe = base44.entities.MensagemChat.subscribe((event) => {
      if (event.type === "create") {
        const msg = event.data;
        if (msg.canal_tipo === canal_tipo && msg.canal_id === canal_id) {
          setMensagens(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (!msg.lido && msg.remetente_id !== currentUser?.id) {
            base44.entities.MensagemChat.update(msg.id, { lido: true });
          }
        }
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [canal_tipo, canal_id, currentUser?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens]);

  const handleSend = async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const conteudo = texto.trim();
    setTexto("");
    try {
      const msg = await base44.entities.MensagemChat.create({
        canal_tipo,
        canal_id,
        canal_label: canal_label || canal_id,
        remetente_id: currentUser?.id || "",
        remetente_nome: currentUser?.full_name || "Usuário",
        conteudo,
        lido: false,
        data_hora: new Date().toISOString(),
      });
      setMensagens(prev => [...prev, msg]);
    } catch (e) {
      alert("Erro ao enviar: " + e.message);
      setTexto(conteudo);
    }
    setEnviando(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className={`flex-1 overflow-y-auto space-y-2 p-3 ${heightClass}`}>
        {mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground text-center">
            Nenhuma mensagem ainda.<br/>Inicie a conversa!
          </div>
        ) : (
          mensagens.map(m => {
            const isMine = m.remetente_id === currentUser?.id;
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                {!isMine && <span className="text-xs font-semibold text-muted-foreground mb-0.5">{m.remetente_nome}</span>}
                <div className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                  <span className={`text-[10px] block mt-0.5 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {m.data_hora ? format(new Date(m.data_hora), "dd/MM HH:mm", { locale: ptBR }) : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-border">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Digite sua mensagem..."
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!texto.trim() || enviando}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}