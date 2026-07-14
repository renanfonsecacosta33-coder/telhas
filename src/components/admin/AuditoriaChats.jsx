import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, X, Factory, ClipboardList, MessageCircle, Plus, User, Truck, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ChatPanel from "@/components/chat/ChatPanel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MAQUINAS = [
  { nome: "TP - 25", setor: "Telhas" }, { nome: "TP - 40", setor: "Telhas" }, { nome: "ONDULADA", setor: "Telhas" },
  { nome: "COLONIAL", setor: "Telhas" }, { nome: "BANDEJA", setor: "Telhas" }, { nome: "DESBOBINADOR", setor: "Telhas" },
  { nome: "CUMEEIRA", setor: "Telhas" }, { nome: "COLAGEM", setor: "Telhas" },
  { nome: "DESBobINADEIRA", setor: "Corte e Dobra" }, { nome: "CORTE 3M", setor: "Corte e Dobra" },
  { nome: "DOBRA 3M", setor: "Corte e Dobra" }, { nome: "CORTE 6M", setor: "Corte e Dobra" },
  { nome: "DOBRA FUNDO 6M", setor: "Corte e Dobra" }, { nome: "DOBRA INICIO 6M", setor: "Corte e Dobra" },
  { nome: "PERFILADEIRA", setor: "Corte e Dobra" },
];

function getDirectChannelId(a, b) { return [a, b].sort().join("_"); }

export default function AuditoriaChats() {
  const [canalSelecionado, setCanalSelecionado] = useState(null);
  const [busca, setBusca] = useState("");
  const [showIniciar, setShowIniciar] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ["admin-auditoria-chats-v2"],
    queryFn: () => base44.entities.MensagemChat.list("-data_hora", 500),
    refetchInterval: 10000,
  });

  const { data: equipe = [] } = useQuery({
    queryKey: ["admin-equipe-chats"],
    queryFn: async () => { const res = await base44.functions.invoke("listarEquipe", {}); return res.data?.equipe || []; },
  });

  const { data: pedidosRecentes = [] } = useQuery({
    queryKey: ["admin-pedidos-chats"],
    queryFn: async () => {
      const [p, om, od] = await Promise.all([
        base44.entities.Pedido.list("-created_date", 50),
        base44.entities.OrdemMaquinaCD.list("-created_date", 50),
        base44.entities.OrdemDesbobinadeira.list("-created_date", 50),
      ]);
      return [
        ...p.map(x => ({ id: x.id, label: `#${x.numero_pedido || "—"} ${x.cliente || ""}`, tipo: "pedido" })),
        ...om.map(x => ({ id: x.id, label: `OP CD ${x.numero_pedido || "—"} ${x.cliente || ""}`, tipo: "pedido" })),
        ...od.map(x => ({ id: x.id, label: `OP DESB ${x.numero_pedido || "—"} ${x.cliente || ""}`, tipo: "pedido" })),
      ];
    },
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

  const getIcon = (tipo) => tipo === "maquina" ? Factory : tipo === "pedido" ? ClipboardList : MessageCircle;
  const getColor = (tipo) => tipo === "maquina" ? "bg-blue-100 text-blue-600" : tipo === "pedido" ? "bg-orange-100 text-orange-600" : "bg-purple-100 text-purple-600";
  const getTipoLabel = (tipo) => tipo === "maquina" ? "Máquina" : tipo === "pedido" ? "Pedido/OP" : "Direto";

  const iniciarComFuncionario = (func) => {
    setCanalSelecionado({ tipo: "direto", id: getDirectChannelId(user?.id, func.id), label: func.full_name, destinatarioId: func.id });
    setShowIniciar(false);
  };
  const iniciarComMaquina = (maq) => {
    setCanalSelecionado({ tipo: "maquina", id: maq.nome, label: maq.nome });
    setShowIniciar(false);
  };
  const iniciarComPedido = (ped) => {
    setCanalSelecionado({ tipo: "pedido", id: ped.id, label: ped.label });
    setShowIniciar(false);
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar canal..." className="h-9 pl-8 pr-3" />
        </div>
        <Button onClick={() => setShowIniciar(true)} className="gap-1.5"><Plus className="w-4 h-4" /> Iniciar Conversa</Button>
      </div>

      <div className="flex gap-4 h-[600px]">
        {/* Channel list */}
        <div className={`flex flex-col border border-border rounded-xl overflow-hidden ${canalSelecionado ? "hidden sm:flex w-[300px]" : "flex-1"} flex-shrink-0`}>
          <div className="flex-1 overflow-y-auto">
            {canaisFiltrados.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">Nenhum chat encontrado.</div>
            ) : canaisFiltrados.map(c => {
              const Icon = getIcon(c.canal_tipo);
              return (
                <button key={`${c.canal_tipo}:${c.canal_id}`} onClick={() => setCanalSelecionado({ tipo: c.canal_tipo, id: c.canal_id, label: c.label })}
                  className={`w-full text-left px-3 py-3 border-b border-border hover:bg-muted/50 transition-colors flex items-start gap-2 ${canalSelecionado?.id === c.canal_id ? "bg-muted" : ""}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getColor(c.canal_tipo)}`}><Icon className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold truncate block">{c.label}</span>
                    <p className="text-xs text-muted-foreground truncate">{c.ultima_msg.conteudo}</p>
                    <span className="text-[10px] text-muted-foreground/70">{getTipoLabel(c.canal_tipo)} · {c.total} msgs · {c.ultima_msg.data_hora ? format(new Date(c.ultima_msg.data_hora), "dd/MM HH:mm", { locale: ptBR }) : ""}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation viewer */}
        {canalSelecionado ? (
          <div className="flex-1 flex flex-col border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
              <Button variant="ghost" size="sm" className="h-7 sm:hidden text-xs" onClick={() => setCanalSelecionado(null)}>← Voltar</Button>
              <span className="text-sm font-semibold truncate">{canalSelecionado.label}</span>
              <span className="text-xs text-muted-foreground ml-auto">{getTipoLabel(canalSelecionado.tipo)}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              {user && (
                <ChatPanel
                  canal_tipo={canalSelecionado.tipo}
                  canal_id={canalSelecionado.id}
                  canal_label={canalSelecionado.label}
                  currentUser={user}
                  destinatarioId={canalSelecionado.destinatarioId}
                  heightClass="h-[calc(100vh-200px)]"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex flex-1 items-center justify-center border border-border rounded-xl text-sm text-muted-foreground">
            Selecione um canal ou inicie uma nova conversa
          </div>
        )}
      </div>

      {/* Iniciar Conversa Dialog */}
      <Dialog open={showIniciar} onOpenChange={setShowIniciar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Iniciar Conversa</DialogTitle></DialogHeader>
          <Tabs defaultValue="funcionario">
            <TabsList className="w-full">
              <TabsTrigger value="funcionario" className="flex-1"><User className="w-3 h-3 mr-1" />Funcionário</TabsTrigger>
              <TabsTrigger value="maquina" className="flex-1"><Factory className="w-3 h-3 mr-1" />Máquina</TabsTrigger>
              <TabsTrigger value="pedido" className="flex-1"><FileText className="w-3 h-3 mr-1" />Pedido</TabsTrigger>
            </TabsList>
            <TabsContent value="funcionario">
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {equipe.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum funcionário.</p> :
                  equipe.map(f => (
                    <button key={f.id} onClick={() => iniciarComFuncionario(f)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{(f.full_name || "?").charAt(0)}</div>
                      <div><p className="text-sm font-medium">{f.full_name}</p><p className="text-xs text-muted-foreground">{f.role}</p></div>
                    </button>
                  ))
                }
              </div>
            </TabsContent>
            <TabsContent value="maquina">
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {MAQUINAS.map(m => (
                  <button key={m.nome} onClick={() => iniciarComMaquina(m)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.setor === "Telhas" ? "bg-blue-100 text-blue-600" : "bg-orange-100 text-orange-600"}`}><Factory className="w-4 h-4" /></div>
                    <div><p className="text-sm font-medium">{m.nome}</p><p className="text-xs text-muted-foreground">{m.setor}</p></div>
                  </button>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="pedido">
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {pedidosRecentes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido.</p> :
                  pedidosRecentes.map(p => (
                    <button key={p.id} onClick={() => iniciarComPedido(p)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-100 text-orange-600"><ClipboardList className="w-4 h-4" /></div>
                      <p className="text-sm font-medium truncate">{p.label}</p>
                    </button>
                  ))
                }
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}