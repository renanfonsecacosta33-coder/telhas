import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, addDays, isToday, isTomorrow, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  Truck,
  Plus,
  Package,
  Factory,
  Layers,
  Calendar as CalendarIcon,
  Camera,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Sparkles
} from "lucide-react";
import { useFilial } from "@/contexts/FilialContext";
import NovaCargaDialog from "@/components/logistica/NovaCargaDialog";
import VisualizadorRotaFoco from "@/components/logistica/VisualizadorRotaFoco";
import CalendarioEntregas from "@/components/logistica/CalendarioEntregas";

export default function Logistica({ mode = "montagem", defaultTab = "todos" }) {
  const isDespacho = mode === "despacho";
  const { filialAtiva } = useFilial();
  const [dialogCarga, setDialogCarga] = useState(false);
  const [tab, setTab] = useState(defaultTab);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todas");
  const [dataSelecionada, setDataSelecionada] = useState(() => format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    if (defaultTab) {
      setTab(defaultTab);
    }
  }, [defaultTab]);

  // Carrega apenas as Rotas de Entrega da filial (100% focado em rotas)
  const {
    data: rotas = [],
    isLoading,
    refetch: refetchRotas,
  } = useQuery({
    queryKey: ["rotas-entrega", filialAtiva],
    queryFn: () =>
      base44.entities.RotaEntrega.filter(
        { unidade: filialAtiva, status: { $ne: "cancelado" } },
        "-data_criacao",
        100
      ),
    placeholderData: (prev) => prev,
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  // Mapa de contagem de rotas por data
  const rotasPorDataMap = useMemo(() => {
    const map = {};
    rotas.forEach((r) => {
      // Normaliza a data da rota (pode vir em entrega_date, data_entrega ou data_criacao)
      let dStr = r.data_entrega || r.entrega_date || r.data_criacao || "";
      if (dStr) {
        if (/^\d{2}\/\d{2}(\/\d{4})?$/.test(dStr)) {
          // Converte formato DD/MM ou DD/MM/YYYY para YYYY-MM-DD
          const parts = dStr.split("/");
          const ano = parts[2] || new Date().getFullYear();
          dStr = `${ano}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        } else if (dStr.includes("T")) {
          dStr = dStr.split("T")[0];
        }
        map[dStr] = (map[dStr] || 0) + 1;
      }
    });
    return map;
  }, [rotas]);

  // Dias rápidos para a barra horizontal do topo: Ontem, Hoje, +5 dias futuros
  const diasNavegacao = useMemo(() => {
    const hoje = new Date();
    const lista = [];
    for (let offset = -1; offset <= 5; offset++) {
      const data = addDays(hoje, offset);
      const dataIso = format(data, "yyyy-MM-dd");
      const diaSemana = format(data, "EEE", { locale: ptBR }).replace(".", "");
      const diaMes = format(data, "dd/MMM", { locale: ptBR });

      let rotulo = isToday(data)
        ? "Hoje"
        : isTomorrow(data)
        ? "Amanhã"
        : `${diaSemana}, ${diaMes}`;

      lista.push({
        dataIso,
        rotulo,
        diaMes,
        qtd: rotasPorDataMap[dataIso] || 0,
      });
    }
    return lista;
  }, [rotasPorDataMap]);

  // Filtra as rotas conforme a data selecionada, setor ativo e busca
  const rotasFiltradas = useMemo(() => {
    return rotas.filter((r) => {
      // 1. Filtro por data (se houver uma data selecionada específica)
      if (dataSelecionada && dataSelecionada !== "todas") {
        let rData = r.data_entrega || r.entrega_date || r.data_criacao || "";
        if (/^\d{2}\/\d{2}/.test(rData)) {
          const parts = rData.split("/");
          const ano = parts[2] || new Date().getFullYear();
          rData = `${ano}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        } else if (rData.includes("T")) {
          rData = rData.split("T")[0];
        }
        if (rData && rData !== dataSelecionada) {
          return false;
        }
      }

      // 2. Filtro por setor / barracão
      if (tab === "telhas") {
        const itensStr = r.itens_json || "";
        if (!itensStr.includes("telhas") && !itensStr.includes("ambos") && !(r.departamentos || []).includes("telhas")) {
          return false;
        }
      } else if (tab === "cd") {
        const itensStr = r.itens_json || "";
        if (!itensStr.includes("corte_dobra") && !itensStr.includes("ambos") && !(r.departamentos || []).includes("corte_dobra")) {
          return false;
        }
      }

      // 3. Filtro por busca de texto (título, motorista, placa, pedido ou cidade)
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const noTitulo = (r.titulo || "").toLowerCase().includes(q);
        const noMotorista = (r.motorista_nome || "").toLowerCase().includes(q);
        const naPlaca = (r.placa || "").toLowerCase().includes(q);
        const naCidade = (r.cidade_destino || "").toLowerCase().includes(q);
        const nosItens = (r.itens_json || "").toLowerCase().includes(q);
        if (!noTitulo && !noMotorista && !naPlaca && !naCidade && !nosItens) {
          return false;
        }
      }

      return true;
    });
  }, [rotas, dataSelecionada, tab, busca]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho Principal da Logística */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Truck className="w-6 h-6" />
              </span>
              Logística & Expedição de Cargas
            </h1>
            <Badge variant="outline" className="text-xs font-bold border-primary/30 text-primary bg-primary/5">
              Modo Foco em Rotas
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Visualização ampla de cargas, romaneio oficial, galeria de fotos e rastreamento em chão de fábrica
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" className="gap-2 border-primary/40 text-primary hover:bg-primary/10 h-9 font-semibold text-xs">
            <Link to="/timeline-carregamento">
              <Camera className="w-4 h-4" /> Timeline de Amarração (5 Etapas)
            </Link>
          </Button>

          {!isDespacho && (
            <Button onClick={() => setDialogCarga(true)} className="gap-2 font-bold h-9 text-xs shadow-sm cursor-pointer">
              <Plus className="w-4 h-4" /> Nova Carga
            </Button>
          )}

          <Button
            size="icon"
            variant="outline"
            onClick={() => refetchRotas()}
            className="h-9 w-9 border-border cursor-pointer"
            title="Atualizar dados de rotas"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Tabs por Barracão + Calendário */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setTab("todos")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            tab === "todos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="w-4 h-4" /> Todas as Cargas (Ambos os Barracões)
        </button>
        <button
          onClick={() => setTab("telhas")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            tab === "telhas"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Factory className="w-4 h-4" /> Cargas com Telhas
        </button>
        <button
          onClick={() => setTab("cd")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            tab === "cd"
              ? "border-orange-600 text-orange-600 dark:text-orange-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" /> Cargas com Corte & Dobra
        </button>
        <button
          onClick={() => setTab("calendario")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            tab === "calendario"
              ? "border-primary text-primary font-black"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CalendarIcon className="w-4 h-4 text-emerald-500" /> Visão Calendário Mensal
        </button>
      </div>

      {tab === "calendario" ? (
        <CalendarioEntregas filial={filialAtiva} />
      ) : (
        <>
          {/* BARRA HORIZONTAL DE DIAS (Separação de Rotas por Dia com Badges) */}
          <div className="bg-card p-3 rounded-2xl border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-primary" /> Selecione o Dia de Expedição:
              </span>

              {/* Busca Rápida por Motorista, Placa, Cidade ou Pedido */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar carga, cidade, placa..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Pílulas de Dias */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setDataSelecionada("todas")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  dataSelecionada === "todas"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-black"
                    : "bg-background hover:bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Todas as Datas</span>
                <Badge variant="secondary" className="text-[10px] h-4.5 px-1 font-bold">
                  {rotas.length}
                </Badge>
              </button>

              {diasNavegacao.map((d) => {
                const isSelected = dataSelecionada === d.dataIso;
                return (
                  <button
                    key={d.dataIso}
                    type="button"
                    onClick={() => setDataSelecionada(d.dataIso)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.02] font-black"
                        : "bg-background hover:bg-muted/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{d.rotulo}</span>
                    <Badge
                      className={`text-[10px] h-4.5 px-1.5 font-black ${
                        isSelected
                          ? "bg-white text-primary hover:bg-white"
                          : d.qtd > 0
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d.qtd} {d.qtd === 1 ? "carga" : "cargas"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* VISUALIZADOR PRINCIPAL: MODO FOCO EM 1 ROTA GRANDE COM SETAS LATERAIS */}
          <VisualizadorRotaFoco
            rotas={rotasFiltradas}
            departamento={tab === "todos" ? null : tab === "telhas" ? "telhas" : "corte_dobra"}
            allowDelete
            dataSelecionada={dataSelecionada}
          />
        </>
      )}

      {/* Modal para Nova Carga */}
      <NovaCargaDialog open={dialogCarga} onClose={() => setDialogCarga(false)} filialAtiva={filialAtiva} />
    </div>
  );
}
