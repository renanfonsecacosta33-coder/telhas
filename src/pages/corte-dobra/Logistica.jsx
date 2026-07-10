import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck, Plus, Package, Search, X, Loader2, Factory, Layers, CheckCircle, Calendar, Filter, ChevronDown, ChevronRight, PackageCheck } from "lucide-react";
import { useFilial } from "@/contexts/FilialContext";
import CargaFormDialog from "@/components/logistica/CargaFormDialog";
import CargaCard from "@/components/logistica/CargaCard";
import AuditSidebar from "@/components/logistica/AuditSidebar";

export default function Logistica({ mode = "montagem" }) {
  const isDespacho = mode === "despacho";
  const [user, setUser] = useState(null);
  const [busca, setBusca] = useState("");
  const [dialogCarga, setDialogCarga] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [tab, setTab] = useState("telhas");
  const [filtroData, setFiltroData] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [mostrarEntregues, setMostrarEntregues] = useState(false);
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Fetch all finalized orders from Telhas
  const { data: pedidosTelhas = [], isLoading: loadingTelhas } = useQuery({
    queryKey: ["logistica-telhas", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva, status: "finalizado" }, "-data_finalizacao", 300),
    refetchInterval: 15000,
  });

  // Fetch all finalized orders from CD
  const { data: ordensMaq = [], isLoading: loadingMaq } = useQuery({
    queryKey: ["logistica-cd-maq", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva, status: "finalizado" }, "-data_finalizacao", 300),
    refetchInterval: 15000,
  });

  const { data: ordensDesb = [], isLoading: loadingDesb } = useQuery({
    queryKey: ["logistica-cd-desb", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva, status: "finalizado" }, "-data_finalizacao", 300),
    refetchInterval: 15000,
  });

  // Fetch all cargas
  const { data: cargas = [], isLoading: loadingCargas } = useQuery({
    queryKey: ["cargas", filialAtiva],
    queryFn: () => base44.entities.Carga.filter({ unidade: filialAtiva }, "-data_criacao", 100),
    refetchInterval: 10000,
  });

  // Normalize all items
  const allItens = useMemo(() => {
    const telhas = pedidosTelhas.map(p => ({
      ...p,
      _tipo: "pedido",
      _setor: "Telhas",
      _label: p.produto || "Telha",
      _qtd: p.metros || p.quantidade_telhas || 0,
    }));
    const maq = ordensMaq.map(o => ({
      ...o,
      _tipo: "ordem_maquina",
      _setor: "Corte e Dobra",
      _label: o.tipo_peca || o.maquina || "Peça CD",
      _qtd: o.quantidade || 0,
    }));
    const desb = ordensDesb
      .filter(o => o.destino === "pedido_direto")
      .map(o => ({
        ...o,
        _tipo: "ordem_desb",
        _setor: "Corte e Dobra",
        _label: o.destino === "pedido_direto" ? "Chapa p/ Cliente" : "Chapa p/ Estoque",
        _qtd: o.quantidade || 0,
      }));
    return [...telhas, ...maq, ...desb];
  }, [pedidosTelhas, ordensMaq, ordensDesb]);

  // Items filtered by active tab
  const itensFiltradosTab = useMemo(() => {
    let items = tab === "telhas" ? allItens.filter(i => i._setor === "Telhas") : allItens.filter(i => i._setor === "Corte e Dobra");
    if (filtroData) {
      items = items.filter(i => (i.data_finalizacao || i.data || "") === filtroData);
    }
    return items;
  }, [allItens, tab, filtroData]);

  // Group by numero_pedido
  const pedidosAgrupados = useMemo(() => {
    const grupos = {};
    itensFiltradosTab.forEach(item => {
      const key = item.numero_pedido || `SEM_PEDIDO_${item.id}`;
      if (!grupos[key]) {
        grupos[key] = {
          numero_pedido: item.numero_pedido || "—",
          cliente: item.cliente || "—",
          itens: [],
        };
      }
      grupos[key].itens.push(item);
    });

    // Compute status for each group
    return Object.values(grupos).map(g => {
      const total = g.itens.length;
      const carregados = g.itens.filter(i => i.status_expedicao === "carregado" || i.status_expedicao === "em_transito" || i.status_expedicao === "expedido").length;
      const expedidos = g.itens.filter(i => i.status_expedicao === "em_transito" || i.status_expedicao === "expedido").length;

      let statusCarga = "em_producao";
      if (expedidos === total && total > 0) statusCarga = "pronto_expedicao";
      else if (carregados > 0) statusCarga = "pronto_parcial";

      // Also check if all are still finalizado (not loaded yet) = pronto
      const todosNoPatio = g.itens.every(i => !i.status_expedicao || i.status_expedicao === "aguardando");
      if (todosNoPatio && total > 0) statusCarga = "pronto_expedicao";

      // All items delivered = entregue
      const todosExpedidos = g.itens.every(i => i.status_expedicao === "expedido");
      if (todosExpedidos && total > 0) statusCarga = "entregue";

      return { ...g, total, carregados, expedidos, statusCarga };
    }).sort((a, b) => {
      const order = { pronto_expedicao: 0, pronto_parcial: 1, em_producao: 2, entregue: 3 };
      return (order[a.statusCarga] ?? 2) - (order[b.statusCarga] ?? 2);
    });
  }, [itensFiltradosTab]);

  // Filter by search + status
  const gruposFiltrados = useMemo(() => {
    let result = pedidosAgrupados;
    if (filtroStatus !== "todos") {
      result = result.filter(g => g.statusCarga === filtroStatus);
    }
    if (!busca.trim()) return result;
    const q = busca.toLowerCase().trim();
    return result.filter(g => (g.numero_pedido || "").toLowerCase().includes(q) || (g.cliente || "").toLowerCase().includes(q));
  }, [pedidosAgrupados, busca, filtroStatus]);

  // Split: active (not all delivered) vs delivered
  const gruposAtivos = useMemo(() => gruposFiltrados.filter(g => g.statusCarga !== "entregue"), [gruposFiltrados]);
  const gruposEntregues = useMemo(() => gruposFiltrados.filter(g => g.statusCarga === "entregue"), [gruposFiltrados]);

  // Available items (not yet linked to a carga)
  const pedidosDisponiveis = useMemo(() => {
    const linkedIds = new Set();
    cargas.forEach(c => {
      if (c.pedidos_json) {
        try {
          JSON.parse(c.pedidos_json).forEach(p => linkedIds.add(p.id));
        } catch {}
      }
    });
    return itensFiltradosTab.filter(i => !linkedIds.has(i.id) && (!i.status_expedicao || i.status_expedicao === "aguardando"));
  }, [itensFiltradosTab, cargas]);

  // Filter cargas by active tab — only show cargas that have at least one pedido from the active sector
  const cargasAtivas = useMemo(() => {
    return cargas.filter(c => {
      if (c.status !== "carregando" && c.status !== "em_transito") return false;
      if (!c.pedidos_json) return true; // empty carga — show in both tabs
      try {
        const linked = JSON.parse(c.pedidos_json);
        if (tab === "telhas") return linked.some(p => p.tipo === "pedido");
        return linked.some(p => p.tipo === "ordem_maquina" || p.tipo === "ordem_desb");
      } catch {
        return true;
      }
    });
  }, [cargas, tab]);
  const isLoading = loadingTelhas || loadingMaq || loadingDesb || loadingCargas;

  const statusConfig = {
    em_producao: { label: "🔴 Em Produção", cor: "bg-red-100 text-red-700 border-red-200" },
    pronto_parcial: { label: "🟡 Pronto Parcial", cor: "bg-amber-100 text-amber-700 border-amber-200" },
    pronto_expedicao: { label: "🟢 Pronto para Expedição", cor: "bg-green-100 text-green-700 border-green-200" },
    entregue: { label: "✅ Entregue", cor: "bg-blue-100 text-blue-700 border-blue-200" },
  };

  const handleSelectItem = (item, tipo) => {
    // For CargaCard linked items, we need to fetch the full item
    if (item.id && !item._tipo) {
      // It's a minimal object from pedidos_json — find in allItens
      const full = allItens.find(i => i.id === item.id);
      if (full) {
        setSelectedItem(full);
        setSelectedTipo(full._tipo);
        return;
      }
    }
    setSelectedItem(item);
    setSelectedTipo(tipo || item._tipo);
  };

  const renderGrupoCard = (g) => {
    const sc = statusConfig[g.statusCarga];
    const telhasCount = g.itens.filter(i => i._setor === "Telhas").length;
    const cdCount = g.itens.filter(i => i._setor === "Corte e Dobra").length;
    return (
      <button key={g.numero_pedido} onClick={() => { if (g.itens[0]) handleSelectItem(g.itens[0], g.itens[0]._tipo); }}
        className="text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow transition-all">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-bold text-sm">{g.numero_pedido}</p>
            <p className="text-xs text-muted-foreground truncate">{g.cliente}</p>
          </div>
          <Badge className={`text-xs ${sc.cor}`}>{sc.label}</Badge>
        </div>
        <div className="space-y-1.5">
          {telhasCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground"><Factory className="w-3 h-3" /> Telhas</span>
              <span className="font-semibold">{g.itens.filter(i => i._setor === "Telhas" && (i.status_expedicao === "em_transito" || i.status_expedicao === "expedido")).length}/{telhasCount} ✓</span>
            </div>
          )}
          {cdCount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground"><Layers className="w-3 h-3" /> Corte e Dobra</span>
              <span className="font-semibold">{g.itens.filter(i => i._setor === "Corte e Dobra" && (i.status_expedicao === "em_transito" || i.status_expedicao === "expedido")).length}/{cdCount} ✓</span>
            </div>
          )}
        </div>
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${g.total > 0 ? (g.expedidos / g.total) * 100 : 0}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{g.expedidos}/{g.total} OPs expedidas</p>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Logística — Expedição
          </h1>
          <p className="text-sm text-muted-foreground">Agrupamento de cargas e carregamento de caminhões</p>
        </div>
        {!isDespacho && (
          <Button onClick={() => setDialogCarga(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Carga
          </Button>
        )}
      </div>

      {/* Tabs Barracões */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setTab("telhas")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${tab === "telhas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Factory className="w-4 h-4" /> Telhas
        </button>
        <button
          onClick={() => setTab("cd")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${tab === "cd" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Layers className="w-4 h-4" /> Corte e Dobra
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Package className="w-3.5 h-3.5" /> Pedidos Agrupados
          </div>
          <p className="text-2xl font-bold">{pedidosAgrupados.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Prontos p/ Expedição
          </div>
          <p className="text-2xl font-bold text-green-600">{pedidosAgrupados.filter(g => g.statusCarga === "pronto_expedicao").length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Truck className="w-3.5 h-3.5 text-blue-500" /> Cargas Ativas
          </div>
          <p className="text-2xl font-bold text-blue-600">{cargasAtivas.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Factory className="w-3.5 h-3.5" /> OPs no Pátio
          </div>
          <p className="text-2xl font-bold">{pedidosDisponiveis.length}</p>
        </div>
      </div>

      {/* Cargas ativas */}
      {cargasAtivas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" /> Caminhões / Cargas
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {cargasAtivas.map(c => (
              <CargaCard key={c.id} carga={c} pedidosDisponiveis={pedidosDisponiveis} onSelectItem={handleSelectItem} mode={mode} tab={tab} />
            ))}
          </div>
        </div>
      )}

      {/* Pedidos agrupados — apenas na montagem */}
      {!isDespacho && (
      <div className="space-y-3">
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Pedidos Agrupados por Número</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro por data */}
            <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-input bg-transparent">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={filtroData}
                onChange={e => setFiltroData(e.target.value)}
                className="text-sm bg-transparent outline-none min-w-[140px]"
              />
              {filtroData && (
                <button onClick={() => setFiltroData("")} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* Filtro por status */}
            <div className="flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-input bg-transparent">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
                className="text-sm bg-transparent outline-none cursor-pointer"
              >
                <option value="todos">Todos os status</option>
                <option value="pronto_expedicao">Pronto p/ Expedição</option>
                <option value="pronto_parcial">Pronto Parcial</option>
                <option value="em_producao">Em Produção</option>
                <option value="entregue">Entregue</option>
              </select>
            </div>
            {/* Busca */}
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por pedido ou cliente..."
                className="h-9 pl-8 pr-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-64"
              />
              {busca && (
                <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : gruposAtivos.length === 0 && gruposEntregues.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
            Nenhum pedido finalizado encontrado
          </div>
        ) : (
          <>
            {gruposAtivos.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {gruposAtivos.map(renderGrupoCard)}
              </div>
            )}
            {gruposAtivos.length === 0 && gruposEntregues.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
                Nenhum pedido ativo encontrado
              </div>
            )}
          </>
        )}

        {/* Pedidos Entregues — seção separada e recolhível */}
        {gruposEntregues.length > 0 && (
          <div className="space-y-3 mt-6">
            <button
              onClick={() => setMostrarEntregues(!mostrarEntregues)}
              className="flex items-center gap-2 w-full text-left group"
            >
              {mostrarEntregues ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
              <PackageCheck className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold">Pedidos Entregues</h2>
              <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">{gruposEntregues.length}</Badge>
            </button>
            {mostrarEntregues && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {gruposEntregues.map(renderGrupoCard)}
              </div>
            )}
          </div>
        )}
        </div>
        )}

        <CargaFormDialog open={dialogCarga} onClose={() => setDialogCarga(false)} filialAtiva={filialAtiva} />
      <AuditSidebar open={!!selectedItem} onClose={() => setSelectedItem(null)} item={selectedItem} tipo={selectedTipo} />
    </div>
  );
}