import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, Factory, ClipboardList, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AuditoriaChats() {
  const [canalSelecionado, setCanalSelecionado] = useState(null);
  const [busca, setBusca] = useState("");

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ["admin-auditoria-chats"],
    queryFn: () => base44.entities.MensagemChat.list("-data_hora", 500),
    refetchInterval: 15000,
  });

  const canais = useMemo(() => {
    const map = {};
    mensagens.forEach(m => {
      const key = `${m.canal_tipo}:${m.canal_id}`;
      if (!map[key]) map[key] = { canal_tipo: m.canal_tipo, canal_id: m.canal_id, label: m.canal_label || m.canal_id, ultima_msg: m, total: 0 };
      map[key].total++;
      if (new Date(m.data_hora) > new Date(map[key].ultima_msg.data_hora)) map[key].ultima_msg = m;
    });
    return Object.values(map).sort((a, b) => new Date(b.ultima_msg.data_hora) - new Date(a.ultima_msg.data_hora));
  }, [mensagens]);

  const canaisFiltrados = useMemo(() => {
    if (!busca.trim()) return canais;
    const q = busca.toLowerCase().trim();
    return canais.filter(c => c.label.toLowerCase().includes(q) || c.ultima_msg.conteudo?.toLowerCase().includes(q));
  }, [canais, busca]);

  const mensagensCanal = useMemo(() => {
    if (!canalSelecionado) return [];
    return mensagens
      .filter(m => m.canal_tipo === canalSelecionado.tipo && m.canal_id === canalSelecionado.id)
      .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
  }, [mensagens, canalSelecionado]);

  const getIcon = (tipo) => tipo === "maquina" ? Factory : tipo === "pedido" ? ClipboardList : MessageCircle;
  const getColor = (tipo) => tipo === "maquina" ? "bg-blue-100 text-blue-600" : tipo === "pedido" ? "bg-orange-100 text-orange-600" : "bg-purple-100 text-purple-600";
  const getTipoLabel = (tipo) => tipo === "maquina" ? "Máquina" : tipo === "pedido" ? "Pedido/OP" : "Direto";

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="flex gap-4 h-[600px]">
      <div className={`flex flex-col border border-border rounded-xl overflow-hidden ${canalSelecionado ? "hidden sm:flex w-[300px]" : "flex-1"} flex-shrink-0`}>
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar canal..." className="h-8 pl-8 pr-3 text-xs" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {canaisFiltrados.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">Nenhum chat encontrado.</div>
          ) : (
            canaisFiltrados.map(c => {
              const Icon = getIcon(c.canal_tipo);
              return (
                <button key={`${c.canal_tipo}:${c.canal_id}`} onClick={() => setCanalSelecionado({ tipo: c.canal_tipo, id: c.canal_id, label: c.label })}
                  className={`w-full text-left px-3 py-3 border-b border-border hover:bg-muted/50 transition-colors flex items-start gap-2 ${canalSelecionado?.id === c.canal_id ? "bg-muted" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getColor(c.canal_tipo)}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold truncate block">{c.label}</span>
                    <p className="text-xs text-muted-foreground truncate">{c.ultima_msg.conteudo}</p>
                    <span className="text-[10px] text-muted-foreground/70">{getTipoLabel(c.canal_tipo)} · {c.total} msgs · {c.ultima_msg.data_hora ? format(new Date(c.ultima_msg.data_hora), "dd/MM HH:mm", { locale: ptBR }) : ""}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {canalSelecionado ? (
        <div className="flex-1 flex flex-col border border-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-7 sm:hidden text-xs" onClick={() => setCanalSelecionado(null)}>← Voltar</Button>
            <span className="text-sm font-semibold truncate">{canalSelecionado.label}</span>
            <span className="text-xs text-muted-foreground ml-auto">{getTipoLabel(canalSelecionado.tipo)}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {mensagensCanal.map(m => (
              <div key={m.id} className="flex flex-col items-start">
                <span className="text-xs font-semibold mb-0.5 text-muted-foreground">{m.remetente_nome || "—"}</span>
                <div className="max-w-[80%] rounded-lg px-3 py-1.5 text-sm bg-muted">
                  <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                  <span className="text-[10px] block mt-0.5 text-muted-foreground">{m.data_hora ? format(new Date(m.data_hora), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="hidden sm:flex flex-1 items-center justify-center border border-border rounded-xl text-sm text-muted-foreground">
          Selecione um canal para visualizar a conversa completa
        </div>
      )}
    </div>
  );
}