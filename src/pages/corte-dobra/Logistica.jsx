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
  const [dataSelecionada, setDataSelecionada] = useState("todas");

  useEffect(() => {
    if (defaultTab) {
      setTab(defaultTab);
    }
  }, [defaultTab]);

  // Função auxiliar para extrair a data em que a carga foi colocada no sistema (estritamente created_date automático do Base44 ou data_criacao)
  // NUNCA usa data_entrega ou entrega_date (que são datas antigas impressas no papel lidas pelo OCR)
  const extrairDataColocacaoCarga = (r) => {
    let d = r.created_date || r.data_criacao || "";
    if (!d) return "";
    if (d.includes("T")) {
      d = d.split("T")[0];
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
      const parts = d.split("/");
      d = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else if (/^\d{2}\/\d{2}$/.test(d)) {
      const parts = d.split("/");
      const ano = new Date().getFullYear();
      d = `${ano}-${parts[1]}-${parts[0]}`;
    }
    return d;
  };

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

  // Lista dinâmica apenas com as datas que realmente contêm cargas cadastradas
  const datasComCargas = useMemo(() => {
    const mapa = {};
    rotas.forEach((r) => {
      const dIso = extrairDataColocacaoCarga(r);
      if (dIso) {
        mapa[dIso] = (mapa[dIso] || 0) + 1;
      }
    });

    return Object.entries(mapa)
      .sort((a, b) => b[0].localeCompare(a[0])) // Ordena das mais recentes para as mais antigas
      .map(([dataIso, qtd]) => {
        let rotulo = dataIso;
        let rotuloCurto = dataIso;
        try {
          const dt = parseISO(dataIso);
          if (!isNaN(dt)) {
            const diaSemana = format(dt, "EEE", { locale: ptBR }).replace(".", "");
            const diaMes = format(dt, "dd/MMM", { locale: ptBR });
            if (isToday(dt)) {
              rotulo = `Hoje (${diaMes})`;
              rotuloCurto = "Hoje";
            } else if (isTomorrow(dt)) {
              rotulo = `Amanhã (${diaMes})`;
              rotuloCurto = "Amanhã";
            } else {
              rotulo = `${diaSemana}, ${diaMes}`;
              rotuloCurto = diaMes;
            }
          }
        } catch {}

        return {
          dataIso,
          rotulo,
          rotuloCurto,
          qtd,
        };
      });
  }, [rotas]);

  // Filtra as rotas conforme a data selecionada (data de colocação), setor ativo e busca
  const rotasFiltradas = useMemo(() => {
    return rotas.filter((r) => {
      // 1. Filtro por data de colocação da carga
      if (dataSelecionada && dataSelecionada !== "todas") {
        const rData = extrairDataColocacaoCarga(r);
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
          {/* BARRA DE CONTROLE COMPACTA: Seletor do Dia da Expedição posicionado ao lado da Busca */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border shadow-xs">
            {/* Lado Esquerdo: Identificação e Total de Cargas */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary" /> Cargas da Filial:
              </span>
              <Badge variant="secondary" className="font-bold text-xs">
                {rotasFiltradas.length} de {rotas.length} {rotas.length === 1 ? "carga" : "cargas"}
              </Badge>
            </div>

            {/* Lado Direito: Seletor Compacto do Dia da Expedição + Busca Rápida */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Seletor Compacto de Data (Agrupado pela Data que a Carga foi Colocada) */}
              <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 py-1.5 shadow-2xs">
                <CalendarIcon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                  Dia da Expedição:
                </span>
                <select
                  value={dataSelecionada}
                  onChange={(e) => setDataSelecionada(e.target.value)}
                  className="text-xs font-black bg-transparent border-none text-foreground focus:outline-none cursor-pointer pr-1"
                >
                  <option value="todas">Todas as Datas ({rotas.length})</option>
                  {datasComCargas.map((d) => (
                    <option key={d.dataIso} value={d.dataIso}>
                      {d.rotulo} ({d.qtd} {d.qtd === 1 ? "carga" : "cargas"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Busca Rápida por Motorista, Placa, Cidade ou Pedido */}
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar carga, cidade, placa..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
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
