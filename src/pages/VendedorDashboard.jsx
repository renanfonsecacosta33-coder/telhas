import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Package, Factory, CheckCircle2, Truck, Bell } from "lucide-react";
import PedidoVendedorCard from "@/components/vendedor/PedidoVendedorCard";
import PedidoDetalheDrawer from "@/components/vendedor/PedidoDetalheDrawer";

export default function VendedorDashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState(null);
  const [cardSelecionado, setCardSelecionado] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const vendedorNome = user?.full_name;

  const { data: pedidosTelhas = [], isLoading: loadingTelhas } = useQuery({
    queryKey: ["pedidos-vendedor", vendedorNome],
    queryFn: () => base44.entities.Pedido.filter({ vendedor: vendedorNome }, "-data", 500),
    enabled: !!vendedorNome,
  });

  const { data: opsDesbob = [], isLoading: loadingDesbob } = useQuery({
    queryKey: ["ops-desbob-vendedor", vendedorNome],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ vendedor: vendedorNome }, "-data", 500),
    enabled: !!vendedorNome,
  });

  const { data: opsMaquina = [], isLoading: loadingMaquina } = useQuery({
    queryKey: ["ops-maquina-vendedor", vendedorNome],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ vendedor: vendedorNome }, "-data", 500),
    enabled: !!vendedorNome,
  });

  const { data: msgsNaoLidas = [] } = useQuery({
    queryKey: ["msgs-nao-lidas-vendedor", user?.id],
    queryFn: () => base44.entities.MensagemChat.filter({ lido: false }, "data_hora", 200),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const cards = useMemo(() => {
    const result = [];

    pedidosTelhas.forEach(p => {
      if (p.status === "cancelado") return;
      result.push({
        tipo: "telhas",
        id: p.id,
        numero_pedido: p.numero_pedido || p.id,
        cliente: p.cliente || "—",
        setor: "Telhas",
        data_prevista: p.data_prevista || p.data,
        descricao: `${p.produto || "Telha"}${p.modelo ? ` — ${p.modelo}` : ""}${p.quantidade_telhas ? ` · ${p.quantidade_telhas} telhas` : ""}`,
        status: p.status,
        status_expedicao: p.status_expedicao,
        ops: [],
        pedido_original: p,
      });
    });

    const cdOps = [...opsDesbob, ...opsMaquina].filter(o => o.numero_pedido);
    const grupos = {};
    cdOps.forEach(op => {
      const key = op.numero_pedido;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(op);
    });

    Object.entries(grupos).forEach(([numero, ops]) => {
      if (ops.every(o => o.status === "cancelado")) return;
      const datas = ops.map(o => o.data).filter(Boolean).sort();
      const allFinalizado = ops.every(o => o.status === "finalizado");
      const anyProducao = ops.some(o => ["em_producao", "aguardando_corte", "pausado"].includes(o.status));
      const overallStatus = allFinalizado ? "finalizado" : anyProducao ? "em_producao" : (ops[0]?.status || "pendente");
      const allExpedido = ops.every(o => o.status_expedicao === "expedido");
      const anyExpedido = ops.some(o => ["expedido", "em_transito", "carregado"].includes(o.status_expedicao));
      const overallExp = allExpedido ? "expedido" : anyExpedido ? "em_transito" : "aguardando";

      const pecas = ops.map(o => o.tipo_peca || o.dimensoes_livres || "").filter(Boolean);
      const totalPecas = ops.reduce((s, o) => s + (o.quantidade || 0), 0);
      const desc = pecas.length > 0
        ? `${pecas.slice(0, 3).join(", ")}${pecas.length > 3 ? "..." : ""} · ${totalPecas} pç`
        : `${ops.length} OP(s) · ${totalPecas} peças`;

      result.push({
        tipo: "corte_dobra",
        id: numero,
        numero_pedido: numero,
        cliente: ops[0]?.cliente || "—",
        setor: "Corte e Dobra",
        data_prevista: datas[0] || null,
        descricao: desc,
        status: overallStatus,
        status_expedicao: overallExp,
        ops: ops,
        pedido_original: null,
      });
    });

    return result;
  }, [pedidosTelhas, opsDesbob, opsMaquina]);

  const kpis = useMemo(() => {
    const ativos = cards.filter(c => c.status !== "finalizado" && c.status !== "cancelado" && c.status_expedicao !== "expedido").length;
    const emFabricacao = cards.filter(c => ["em_producao", "aguardando_corte", "aguardando_colagem"].includes(c.status)).length;
    const prontos = cards.filter(c => c.status === "finalizado" && c.status_expedicao !== "expedido").length;
    const entregues = cards.filter(c => c.status_expedicao === "expedido").length;
    return { ativos, emFabricacao, prontos, entregues };
  }, [cards]);

  const unreadMap = useMemo(() => {
    const map = {};
    msgsNaoLidas.forEach(m => {
      if (m.canal_tipo === "pedido" && m.remetente_id !== user?.id) {
        map[m.canal_id] = (map[m.canal_id] || 0) + 1;
      }
    });
    return map;
  }, [msgsNaoLidas, user?.id]);

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  const cardsFiltrados = useMemo(() => {
    let result = cards;
    if (filtroSetor !== "todos") {
      result = result.filter(c => filtroSetor === "telhas" ? c.setor === "Telhas" : c.setor === "Corte e Dobra");
    }
    if (filtroStatus) {
      result = result.filter(c => {
        if (filtroStatus === "ativos") return c.status !== "finalizado" && c.status !== "cancelado" && c.status_expedicao !== "expedido";
        if (filtroStatus === "fabricacao") return ["em_producao", "aguardando_corte", "aguardando_colagem"].includes(c.status);
        if (filtroStatus === "prontos") return c.status === "finalizado" && c.status_expedicao !== "expedido";
        if (filtroStatus === "entregues") return c.status_expedicao === "expedido";
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(c =>
        (c.cliente || "").toLowerCase().includes(q) ||
        (c.numero_pedido || "").toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      const da = a.data_prevista ? new Date(a.data_prevista).getTime() : Infinity;
      const db = b.data_prevista ? new Date(b.data_prevista).getTime() : Infinity;
      return da - db;
    });
  }, [cards, filtroSetor, filtroStatus, search]);

  const handleVerDetalhes = (card) => {
    setCardSelecionado(card);
    setDrawerOpen(true);
  };

  const isLoading = loadingTelhas || loadingDesbob || loadingMaquina;

  const kpiCards = [
    { key: "ativos", label: "Ativos", value: kpis.ativos, icon: Package, color: "text-blue-600 bg-blue-50" },
    { key: "fabricacao", label: "Em Fabricação", value: kpis.emFabricacao, icon: Factory, color: "text-orange-600 bg-orange-50" },
    { key: "prontos", label: "Prontos no Pátio", value: kpis.prontos, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
    { key: "entregues", label: "Entregues", value: kpis.entregues, icon: Truck, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">AJL Ferro & Aço — Painel do Vendedor</h1>
            <p className="text-xs text-muted-foreground">{vendedorNome || "—"}</p>
          </div>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map(k => {
            const Icon = k.icon;
            const active = filtroStatus === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setFiltroStatus(active ? null : k.key)}
                className={`text-left rounded-xl border p-3 transition-all ${active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-2xl font-black text-foreground">{k.value}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou nº pedido..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            {[
              { key: "todos", label: "Todos" },
              { key: "telhas", label: "Telhas" },
              { key: "corte_dobra", label: "CD" },
            ].map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={filtroSetor === f.key ? "default" : "outline"}
                onClick={() => setFiltroSetor(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : cardsFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">Nenhum pedido encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cardsFiltrados.map(card => (
              <PedidoVendedorCard
                key={card.id}
                card={card}
                onVerDetalhes={handleVerDetalhes}
                unreadCount={unreadMap[card.numero_pedido] || 0}
              />
            ))}
          </div>
        )}
      </div>

      <PedidoDetalheDrawer
        card={cardSelecionado}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}