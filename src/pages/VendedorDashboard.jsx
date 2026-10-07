import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Package, Factory, CheckCircle2, Truck, Bell, Home,
  ArrowLeft, Layers, BookOpen, User, Users, RefreshCw, ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import PedidoVendedorCard from "@/components/vendedor/PedidoVendedorCard";
import PedidoDetalheDrawer from "@/components/vendedor/PedidoDetalheDrawer";
import UserAvatarButton from "@/components/UserAvatarButton";
import {
  consolidarPedidoParaVendedor,
  nomesCorrespondem,
  normalizarNome
} from "@/lib/vendedorHelper";

export default function VendedorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState(null);
  const [cardSelecionado, setCardSelecionado] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Perfil e Vínculo do Vendedor
  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.role === "gerente";
  const [vendedorFiltroAdmin, setVendedorFiltroAdmin] = useState("todos");

  // 1. Pedidos recebidos do Odoo ERP
  const { data: pedidosOdooRaw = [], isLoading: loadingOdoo, refetch: refetchOdoo } = useQuery({
    queryKey: ["pedidos-odoo-vendedor"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 1000),
    refetchInterval: 10000,
  });

  // 2. Ordens de chão de fábrica (Telhas e Corte & Dobra) para cruzar fotos, operadores e bobinas
  const { data: ordensTelhas = [], isLoading: loadingTelhas } = useQuery({
    queryKey: ["ordens-telhas-vendedor"],
    queryFn: () => base44.entities.Pedido.list("-data", 1000),
    refetchInterval: 15000,
  });

  const { data: opsDesbob = [], isLoading: loadingDesbob } = useQuery({
    queryKey: ["ops-desbob-vendedor"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 1000),
    refetchInterval: 15000,
  });

  const { data: opsMaquina = [], isLoading: loadingMaquina } = useQuery({
    queryKey: ["ops-maquina-vendedor"],
    queryFn: () => base44.entities.OrdemMaquinaCD.list("-data", 1000),
    refetchInterval: 15000,
  });

  // 3. Catálogo de Bobinas para cruzar rastreabilidade técnica (sem dados de NF/custo)
  const { data: todasBobinas = [] } = useQuery({
    queryKey: ["bobinas-vendedor"],
    queryFn: () => base44.entities.Bobina.list(),
    staleTime: 60000,
  });

  // 4. Mensagens não lidas de chat
  const { data: msgsNaoLidas = [] } = useQuery({
    queryKey: ["msgs-nao-lidas-vendedor", user?.id],
    queryFn: () => base44.entities.MensagemChat.filter({ lido: false }, "data_hora", 200),
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  // Lista de todos os vendedores únicos presentes nos pedidos para o seletor de Admin
  const listaVendedores = useMemo(() => {
    const setV = new Set();
    pedidosOdooRaw.forEach(p => {
      const v = String(p.vendedor_nome || "").trim();
      if (v) setV.add(v);
    });
    return Array.from(setV).sort();
  }, [pedidosOdooRaw]);

  // Vendedor ativo para visualização:
  const vendedorExibidoNome = useMemo(() => {
    if (isAdmin) {
      return vendedorFiltroAdmin === "todos" ? "Visão Geral (Todos os Vendedores)" : vendedorFiltroAdmin;
    }
    return user?.full_name || "Vendedor";
  }, [isAdmin, vendedorFiltroAdmin, user?.full_name]);

  // Deduplicação de pedidos Odoo por numero_pedido mantendo o registro mais atualizado
  const pedidosOdooDeduplicados = useMemo(() => {
    const map = new Map();
    pedidosOdooRaw.forEach(p => {
      if (!p || !p.numero_pedido) return;
      const chave = String(p.numero_pedido).trim();
      if (!map.has(chave)) {
        map.set(chave, p);
      }
    });
    return Array.from(map.values());
  }, [pedidosOdooRaw]);

  // Consolidação dos cards de pedidos do vendedor
  const cards = useMemo(() => {
    const result = [];

    pedidosOdooDeduplicados.forEach(p => {
      // Regra de Vínculo:
      // Se não for admin: filtra apenas pedidos do vendedor logado
      if (!isAdmin) {
        if (!nomesCorrespondem(p.vendedor_nome, user?.full_name)) {
          return;
        }
      } else {
        // Se for admin e selecionou um vendedor específico:
        if (vendedorFiltroAdmin !== "todos" && !nomesCorrespondem(p.vendedor_nome, vendedorFiltroAdmin)) {
          return;
        }
      }

      const card = consolidarPedidoParaVendedor(
        p,
        ordensTelhas,
        opsDesbob,
        opsMaquina,
        todasBobinas
      );

      if (card) {
        result.push(card);
      }
    });

    return result;
  }, [pedidosOdooDeduplicados, isAdmin, vendedorFiltroAdmin, user?.full_name, ordensTelhas, opsDesbob, opsMaquina, todasBobinas]);

  // KPIs dos 4 estágios do painel
  const kpis = useMemo(() => {
    const ativos = cards.filter(c => c.statusOperacional.chave !== "pronto_patio" && c.statusOperacional.chave !== "em_transito").length;
    const emFabricacao = cards.filter(c => c.statusOperacional.chave === "produzindo" || c.statusOperacional.chave === "colagem").length;
    const prontos = cards.filter(c => c.statusOperacional.chave === "pronto_patio").length;
    const entregues = cards.filter(c => c.statusOperacional.chave === "em_transito").length;
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

  // Filtros de busca, setor e status de card
  const cardsFiltrados = useMemo(() => {
    let result = cards;

    if (filtroSetor !== "todos") {
      result = result.filter(c => filtroSetor === "telhas" ? c.setor === "Telhas" : c.setor === "Corte e Dobra");
    }

    if (filtroStatus) {
      result = result.filter(c => {
        if (filtroStatus === "ativos") return c.statusOperacional.chave !== "pronto_patio" && c.statusOperacional.chave !== "em_transito";
        if (filtroStatus === "fabricacao") return c.statusOperacional.chave === "produzindo" || c.statusOperacional.chave === "colagem";
        if (filtroStatus === "prontos") return c.statusOperacional.chave === "pronto_patio";
        if (filtroStatus === "entregues") return c.statusOperacional.chave === "em_transito";
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(c =>
        (c.cliente || "").toLowerCase().includes(q) ||
        (c.numero_pedido || "").toLowerCase().includes(q) ||
        (c.vendedor || "").toLowerCase().includes(q) ||
        (c.descricao || "").toLowerCase().includes(q)
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

  const isLoading = loadingOdoo || loadingTelhas || loadingDesbob || loadingMaquina;

  const kpiCards = [
    { key: "ativos", label: "Ativos", value: kpis.ativos, icon: Package, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/60" },
    { key: "fabricacao", label: "Em Fabricação", value: kpis.emFabricacao, icon: Factory, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/60" },
    { key: "prontos", label: "Prontos no Pátio", value: kpis.prontos, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60" },
    { key: "entregues", label: "Entregues", value: kpis.entregues, icon: Truck, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/60" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Linha principal: título + perfil + notificações */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate(-1)}
                className="h-9 w-9 shrink-0 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-foreground truncate">
                  AJL Ferro & Aço — Painel do Vendedor
                </h1>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 font-medium">
                  <User className="w-3 h-3 text-primary" />
                  {vendedorExibidoNome}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetchOdoo()}
                disabled={isLoading}
                title="Atualizar Pedidos"
                className="h-9 w-9"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
              </Button>

              <Button variant="outline" size="icon" className="relative h-9 w-9">
                <Bell className="w-4 h-4" />
                {totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </Button>
              <UserAvatarButton size="sm" />
            </div>
          </div>

          {/* Barra de navegação rápida e seletor de vendedor para Admin */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/50 flex-wrap">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/setor")}
                className="gap-1.5 text-xs font-semibold shrink-0 border-slate-300 dark:border-slate-700"
              >
                <Home className="w-3.5 h-3.5 text-primary" />
                Painel ADM
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/vendedor")}
                className="gap-1.5 text-xs font-semibold shrink-0 border-blue-300 text-blue-700 bg-blue-50/50 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/40"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Consultar Estoque
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/setor")}
                className="gap-1.5 text-xs font-semibold shrink-0 border-slate-300 dark:border-slate-700"
              >
                <Layers className="w-3.5 h-3.5" />
                Trocar Setor
              </Button>
            </div>

            {/* Seletor de Vendedor para Administradores / Gestores */}
            {isAdmin && listaVendedores.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-orange-500" />
                  Filtrar Vendedor:
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="truncate max-w-[160px]">
                        {vendedorFiltroAdmin === "todos" ? "Todos os Vendedores" : vendedorFiltroAdmin}
                      </span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 max-h-72 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={() => setVendedorFiltroAdmin("todos")}
                      className={`text-xs font-semibold cursor-pointer ${vendedorFiltroAdmin === "todos" ? "bg-orange-50 text-orange-600 dark:bg-orange-950 font-bold" : ""}`}
                    >
                      🌐 Todos os Vendedores
                    </DropdownMenuItem>
                    {listaVendedores.map(v => (
                      <DropdownMenuItem
                        key={v}
                        onClick={() => setVendedorFiltroAdmin(v)}
                        className={`text-xs cursor-pointer ${vendedorFiltroAdmin === v ? "bg-orange-50 text-orange-600 dark:bg-orange-950 font-bold" : ""}`}
                      >
                        👤 {v}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* KPI Cards de 4 estágios */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpiCards.map(k => {
            const Icon = k.icon;
            const active = filtroStatus === k.key;
            return (
              <button
                key={k.key}
                onClick={() => setFiltroStatus(active ? null : k.key)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  active
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border bg-card hover:border-primary/40 shadow-2xs"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-2xl font-black text-foreground">{k.value}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-semibold">{k.label}</p>
              </button>
            );
          })}
        </div>

        {/* Barra de Busca + Filtros de Setor */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, nº do pedido ou produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            {[
              { key: "todos", label: "Todos" },
              { key: "telhas", label: "Telhas" },
              { key: "corte_dobra", label: "Corte & Dobra" },
            ].map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={filtroSetor === f.key ? "default" : "outline"}
                onClick={() => setFiltroSetor(f.key)}
                className="text-xs font-semibold"
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Listagem de Pedidos */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-9 h-9 border-4 border-muted border-t-primary rounded-full animate-spin" />
            <p className="text-xs font-semibold text-muted-foreground">Sincronizando pedidos com o chão de fábrica...</p>
          </div>
        ) : cardsFiltrados.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border bg-card/50 p-8 space-y-2">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-base font-bold text-foreground">Nenhum pedido encontrado</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {!isAdmin && user?.full_name
                ? `Não encontramos pedidos vinculados ao vendedor "${user.full_name}". Se os pedidos forem de outro nome no Odoo, verifique seu cadastro de usuário.`
                : "Nenhum pedido atende aos filtros selecionados."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {cardsFiltrados.map(card => (
              <PedidoVendedorCard
                key={card.id || card.numero_pedido}
                card={card}
                onVerDetalhes={handleVerDetalhes}
                unreadCount={unreadMap[card.numero_pedido] || 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer de Detalhes Completo */}
      <PedidoDetalheDrawer
        card={cardSelecionado}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}