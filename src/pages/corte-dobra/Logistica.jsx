import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Truck, Plus, Package, Factory, Layers, Calendar, Camera, Maximize2 } from "lucide-react";
import { useFilial } from "@/contexts/FilialContext";
import NovaCargaDialog from "@/components/logistica/NovaCargaDialog";
import RotasEntregaSection from "@/components/logistica/RotasEntregaSection";
import ResumoDiaRotas from "@/components/logistica/ResumoDiaRotas";
import BuscaFiltroRotas from "@/components/logistica/BuscaFiltroRotas";
import ModoPatioRotas from "@/components/logistica/ModoPatioRotas";
import { filtrarRotas } from "@/lib/rotaDataHelper";
import DateNavigatorStrip from "@/components/logistica/DateNavigatorStrip";
import CargaCard from "@/components/logistica/CargaCard";
import AuditSidebar from "@/components/logistica/AuditSidebar";
import CalendarioEntregas from "@/components/logistica/CalendarioEntregas";

export default function Logistica({ mode = "montagem", defaultTab = "todos" }) {
  const isDespacho = mode === "despacho";
  const [user, setUser] = useState(null);
  const [dialogCarga, setDialogCarga] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const [tab, setTab] = useState(defaultTab);
  const [dataSelecionadaCalendario, setDataSelecionadaCalendario] = useState(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todas");
  const [somenteSemFoto, setSomenteSemFoto] = useState(false);
  const [patioAberto, setPatioAberto] = useState(false);
  const { filialAtiva } = useFilial();


  useEffect(() => {
    if (defaultTab) {
      setTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Fetch orders from Telhas — pendente, em_producao, finalizado (not cancelado)
  const { data: pedidosTelhas = [] } = useQuery({
    queryKey: ["logistica-telhas", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva, status: { $in: ["pendente", "em_producao", "finalizado"] } }, "-data_finalizacao", 250),
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch orders from CD — pendente, em_producao, finalizado (not cancelado)
  const { data: ordensMaq = [] } = useQuery({
    queryKey: ["logistica-cd-maq", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva, status: { $in: ["pendente", "aguardando_corte", "em_producao", "finalizado"] } }, "-data_finalizacao", 250),
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: ordensDesb = [] } = useQuery({
    queryKey: ["logistica-cd-desb", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva, status: { $in: ["pendente", "em_producao", "finalizado"] } }, "-data_finalizacao", 250),
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch all cargas
  const { data: cargas = [] } = useQuery({
    queryKey: ["cargas", filialAtiva],
    queryFn: () => base44.entities.Carga.filter({ unidade: filialAtiva }, "-data_criacao", 100),
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch rotas de entrega para o DateNavigatorStrip
  const { data: rotas = [] } = useQuery({
    queryKey: ["rotas-entrega", filialAtiva],
    queryFn: () =>
      base44.entities.RotaEntrega.filter(
        { unidade: filialAtiva, status: { $ne: "cancelado" } },
        "-data_criacao",
        50
      ),
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
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
    let items = tab === "todos"
      ? allItens
      : tab === "telhas"
      ? allItens.filter(i => i._setor === "Telhas")
      : allItens.filter(i => i._setor === "Corte e Dobra");
    if (dataSelecionadaCalendario) {
      items = items.filter(i => (i.data_finalizacao || i.data || "") === dataSelecionadaCalendario);
    }
    return items;
  }, [allItens, tab, dataSelecionadaCalendario]);

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
        if (linked.length === 0) return true; // empty carga — show in both tabs
        if (tab === "todos") return true;
        if (tab === "telhas") return linked.some(p => p.tipo === "pedido");
        return linked.some(p => p.tipo === "ordem_maquina" || p.tipo === "ordem_desb");
      } catch {
        return true;
      }
    });
  }, [cargas, tab]);

  // Rotas do dia (ou de todas as datas) conforme aba e filtros escolhidos
  const departamentoAtivo = tab === "todos" ? null : tab === "telhas" ? "telhas" : "corte_dobra";
  const rotasDoDia = useMemo(
    () =>
      filtrarRotas(rotas, {
        departamento: departamentoAtivo,
        dataSelecionada: dataSelecionadaCalendario,
        busca,
        statusFiltro,
        somenteSemFoto,
      }),
    [rotas, departamentoAtivo, dataSelecionadaCalendario, busca, statusFiltro, somenteSemFoto]
  );


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
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setPatioAberto(true)}
            className="gap-2 border-amber-400/60 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
            title="Ver as rotas do dia em tela cheia, para uso no pátio"
          >
            <Maximize2 className="w-4 h-4" /> Modo Pátio
          </Button>
          <Button asChild variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
            <Link to="/timeline-carregamento">
              <Camera className="w-4 h-4" /> Timeline de Carregamento (5 Etapas)
            </Link>
          </Button>
          {!isDespacho && (
            <Button onClick={() => setDialogCarga(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova Carga
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Barracões */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setTab("todos")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab === "todos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Package className="w-4 h-4" /> Ambos os Barracões (Todos)
        </button>
        <button
          onClick={() => setTab("telhas")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab === "telhas" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Factory className="w-4 h-4" /> Telhas
        </button>
        <button
          onClick={() => setTab("cd")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab === "cd" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Layers className="w-4 h-4" /> Corte e Dobra
        </button>
        <button
          onClick={() => setTab("calendario")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab === "calendario" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Calendar className="w-4 h-4 text-emerald-500" /> Calendário de Entregas
        </button>
      </div>

      {tab === "calendario" ? (
        <CalendarioEntregas filial={filialAtiva} />
      ) : (
        <>
          {/* Resumo do dia + busca e filtros de rotas */}
          <ResumoDiaRotas rotas={rotasDoDia} dataSelecionada={dataSelecionadaCalendario} />

          <BuscaFiltroRotas
            busca={busca}
            onBusca={setBusca}
            status={statusFiltro}
            onStatus={setStatusFiltro}
            somenteSemFoto={somenteSemFoto}
            onSomenteSemFoto={setSomenteSemFoto}
          />

      {/* Faixa Deslizante de Navegação por Calendário */}
      <DateNavigatorStrip
        dataSelecionada={dataSelecionadaCalendario}
        onSelectData={setDataSelecionadaCalendario}
        rotas={rotas}
        pedidos={allItens}
      />

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

      {/* Rotas de Entrega distribuídas pela IA — visão completa da expedição */}
      <RotasEntregaSection
        departamento={tab === "todos" ? null : tab === "telhas" ? "telhas" : "corte_dobra"}
        filialAtiva={filialAtiva}
        title="Rotas de Entrega — IA"
        allowDelete
        dataSelecionada={dataSelecionadaCalendario}
        onLimparFiltroData={() => setDataSelecionadaCalendario(null)}
        busca={busca}
        statusFiltro={statusFiltro}
        somenteSemFoto={somenteSemFoto}
        inicialAberto={false}
      />

        </>
      )}

      <ModoPatioRotas
        aberto={patioAberto}
        onClose={() => setPatioAberto(false)}
        rotas={rotasDoDia}
        tituloDia={
          dataSelecionadaCalendario
            ? format(parseISO(dataSelecionadaCalendario), "dd/MM/yyyy")
            : "Todas as datas"
        }
      />
      <NovaCargaDialog open={dialogCarga} onClose={() => setDialogCarga(false)} filialAtiva={filialAtiva} />
      <AuditSidebar open={!!selectedItem} onClose={() => setSelectedItem(null)} item={selectedItem} tipo={selectedTipo} />
    </div>
  );
}