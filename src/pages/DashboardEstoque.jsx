import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Bell,
  Sparkles,
  Building2,
  Package,
  TrendingDown,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Download,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { criarNotificacao } from "@/lib/notificacoesHelper";

// Estoque mínimo padrão sugerido (em KG) por espessura comum
const DEFAULT_MINIMOS_KG = {
  "0.35": 3000,
  "0.40": 5000,
  "0.43": 10000, // Alto giro
  "0.47": 4000,
  "0.50": 8000, // Alto giro
  "0.65": 4000,
  "0.80": 3000,
  "0.90": 2000,
  "0.95": 3000,
  "1.20": 2500,
  "1.50": 2000,
  "1.95": 3000,
  "2.00": 2000,
  "DEFAULT": 2000
};

export function normalizeEspessura(val) {
  if (!val) return "Outros";
  const s = String(val).trim().replace(/\s/g, "").replace(",", ".");
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const num = parseFloat(m[1]);
    if (isNaN(num)) return "Outros";
    return num.toFixed(2);
  }
  return "Outros";
}

function fmtKg(num) {
  if (!num || isNaN(num)) return "0";
  return Number(num).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export default function DashboardEstoque() {
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();

  const [setorFiltro, setSetorFiltro] = useState("todos"); // todos | telhas | corte_dobra
  const [busca, setBusca] = useState("");
  const [somenteCriticos, setSomenteCriticos] = useState(false);
  const [selectedEspessuraModal, setSelectedEspessuraModal] = useState(null);
  const [configMinimosOpen, setConfigMinimosOpen] = useState(false);
  const [notificando, setNotificando] = useState(false);

  // Carregar limites mínimos customizados do localStorage
  const [limitesMinimos, setLimitesMinimos] = useState(() => {
    try {
      const saved = localStorage.getItem("ajl_estoque_minimos_kg");
      return saved ? JSON.parse(saved) : DEFAULT_MINIMOS_KG;
    } catch {
      return DEFAULT_MINIMOS_KG;
    }
  });

  const salvarLimites = (novos) => {
    setLimitesMinimos(novos);
    localStorage.setItem("ajl_estoque_minimos_kg", JSON.stringify(novos));
    toast.success("Limites mínimos de estoque atualizados!");
    setConfigMinimosOpen(false);
  };

  // Buscar Bobinas
  const { data: bobinas = [], isLoading: loadingBobinas, refetch: refetchBobinas } = useQuery({
    queryKey: ["dashboard-estoque-bobinas", filialAtiva],
    queryFn: async () => {
      try {
        const query = { arquivada: false };
        if (filialAtiva) query.unidade = filialAtiva;
        return await base44.entities.Bobina.filter(query, "-peso_kg", 500);
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  // Buscar Chapas CD
  const { data: chapas = [], isLoading: loadingChapas, refetch: refetchChapas } = useQuery({
    queryKey: ["dashboard-estoque-chapas", filialAtiva],
    queryFn: async () => {
      try {
        const query = {};
        if (filialAtiva) query.unidade = filialAtiva;
        return await base44.entities.ChapaCD.filter(query, "-data_corte", 500);
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  // Buscar Slitters
  const { data: slitters = [], isLoading: loadingSlitters, refetch: refetchSlitters } = useQuery({
    queryKey: ["dashboard-estoque-slitters", filialAtiva],
    queryFn: async () => {
      try {
        const query = { status: { $ne: "encerrado" } };
        if (filialAtiva) query.unidade = filialAtiva;
        return await base44.entities.Slitter.filter(query, "-data", 300);
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  const isLoading = loadingBobinas || loadingChapas || loadingSlitters;

  // Processamento e agrupamento por Espessura
  const gruposEspessura = useMemo(() => {
    const mapa = {};

    // 1. Processar Bobinas
    bobinas.forEach((b) => {
      if (setorFiltro !== "todos" && b.setor !== setorFiltro) return;
      const esp = normalizeEspessura(b.chapa || b.espessura_utilizada || b.espessura_real);
      if (!mapa[esp]) {
        mapa[esp] = {
          espessura: esp,
          pesoTotalKg: 0,
          pesoDisponivelKg: 0,
          pesoReservadoKg: 0,
          bobinasCount: 0,
          chapasCount: 0,
          slittersCount: 0,
          itensBobinas: [],
          itensChapas: [],
          itensSlitters: []
        };
      }
      const peso = Number(b.peso_kg) || 0;
      const res = Number(b.reserva_kg) || (b.reservada ? peso : 0);
      const disp = Math.max(0, peso - res);

      mapa[esp].pesoTotalKg += peso;
      mapa[esp].pesoDisponivelKg += disp;
      mapa[esp].pesoReservadoKg += res;
      mapa[esp].bobinasCount += 1;
      mapa[esp].itensBobinas.push(b);
    });

    // 2. Processar Chapas CD (se setor for todos ou corte_dobra)
    if (setorFiltro === "todos" || setorFiltro === "corte_dobra") {
      chapas.forEach((c) => {
        const esp = normalizeEspessura(c.espessura_mm);
        if (!mapa[esp]) {
          mapa[esp] = {
            espessura: esp,
            pesoTotalKg: 0,
            pesoDisponivelKg: 0,
            pesoReservadoKg: 0,
            bobinasCount: 0,
            chapasCount: 0,
            slittersCount: 0,
            itensBobinas: [],
            itensChapas: [],
            itensSlitters: []
          };
        }
        const peso = Number(c.peso_kg) || 0;
        const res = Number(c.reserva_kg) || (c.reservada ? peso : 0);
        const disp = Math.max(0, peso - res);

        mapa[esp].pesoTotalKg += peso;
        mapa[esp].pesoDisponivelKg += disp;
        mapa[esp].pesoReservadoKg += res;
        mapa[esp].chapasCount += Number(c.quantidade_disponivel || c.quantidade_total || 1);
        mapa[esp].itensChapas.push(c);
      });
    }

    // 3. Processar Slitters (se setor for todos ou corte_dobra)
    if (setorFiltro === "todos" || setorFiltro === "corte_dobra") {
      slitters.forEach((s) => {
        const esp = normalizeEspessura(s.espessura_mm);
        if (!mapa[esp]) {
          mapa[esp] = {
            espessura: esp,
            pesoTotalKg: 0,
            pesoDisponivelKg: 0,
            pesoReservadoKg: 0,
            bobinasCount: 0,
            chapasCount: 0,
            slittersCount: 0,
            itensBobinas: [],
            itensChapas: [],
            itensSlitters: []
          };
        }
        const peso = Number(s.peso_kg) || 0;
        const res = Number(s.reserva_kg) || (s.reservada ? peso : 0);
        const disp = Math.max(0, peso - res);

        mapa[esp].pesoTotalKg += peso;
        mapa[esp].pesoDisponivelKg += disp;
        mapa[esp].pesoReservadoKg += res;
        mapa[esp].slittersCount += 1;
        mapa[esp].itensSlitters.push(s);
      });
    }

    // Calcular status de cada espessura
    return Object.values(mapa).map((g) => {
      const minimo = limitesMinimos[g.espessura] ?? limitesMinimos.DEFAULT ?? 2000;
      let status = "seguro"; // seguro | atencao | critico

      if (g.pesoDisponivelKg <= minimo) {
        status = "critico";
      } else if (g.pesoDisponivelKg <= minimo * 1.3) {
        status = "atencao";
      }

      const percentualMinimo = minimo > 0 ? Math.min(200, Math.round((g.pesoDisponivelKg / minimo) * 100)) : 100;

      return {
        ...g,
        minimoKg: minimo,
        status,
        percentualMinimo
      };
    }).sort((a, b) => {
      // Ordena por ordem numérica da espessura
      const nA = parseFloat(a.espessura) || 999;
      const nB = parseFloat(b.espessura) || 999;
      return nA - nB;
    });
  }, [bobinas, chapas, slitters, setorFiltro, limitesMinimos]);

  // Filtros aplicados
  const gruposFiltrados = useMemo(() => {
    return gruposEspessura.filter((g) => {
      if (somenteCriticos && g.status === "seguro") return false;
      if (busca.trim()) {
        const q = busca.toLowerCase().trim();
        return g.espessura.toLowerCase().includes(q);
      }
      return true;
    });
  }, [gruposEspessura, somenteCriticos, busca]);

  // Totais consolidados
  const totais = useMemo(() => {
    let totalKg = 0;
    let dispKg = 0;
    let resKg = 0;
    let criticosCount = 0;
    let atencaoCount = 0;
    let totalBobinas = 0;

    gruposEspessura.forEach((g) => {
      totalKg += g.pesoTotalKg;
      dispKg += g.pesoDisponivelKg;
      resKg += g.pesoReservadoKg;
      totalBobinas += g.bobinasCount;
      if (g.status === "critico") criticosCount++;
      if (g.status === "atencao") atencaoCount++;
    });

    return { totalKg, dispKg, resKg, criticosCount, atencaoCount, totalBobinas };
  }, [gruposEspessura]);

  // Ação: Notificar Encarregados e Compras imediatamente
  const handleNotificarCompras = async () => {
    const criticos = gruposEspessura.filter((g) => g.status === "critico");
    if (criticos.length === 0) {
      toast.info("Nenhuma espessura está abaixo do estoque mínimo no momento.");
      return;
    }

    setNotificando(true);
    try {
      const listaStr = criticos
        .map((c) => `• ${c.espessura}mm: ${fmtKg(c.pesoDisponivelKg)} kg (Mín: ${fmtKg(c.minimoKg)} kg)`)
        .join("\n");

      await criarNotificacao({
        titulo: `🚨 ALERTA: ${criticos.length} espessura(s) em estoque crítico!`,
        mensagem: `Atenção Encarregados e Setor de Compras. As seguintes espessuras estão abaixo do mínimo:\n${listaStr}`,
        tipo: "estoque_minimo",
        unidade: filialAtiva || "Todas",
        link: "/estoque-dashboard",
        autor_nome: "Monitor de Estoque IA"
      });

      toast.success("Alerta urgente enviado com sucesso para a Central de Notificações!");
    } catch (e) {
      toast.error("Erro ao enviar alerta: " + (e?.message || ""));
    } finally {
      setNotificando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                Estoque Inteligente por Espessura
                {totais.criticosCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-2 py-0.5 animate-pulse font-bold">
                    {totais.criticosCount} críticas
                  </Badge>
                )}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitoramento por espessura em tempo real para nunca deixar zerar
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigMinimosOpen(true)}
            className="gap-1.5 text-xs font-semibold h-9"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Ajustar Mínimos
          </Button>

          <Button
            size="sm"
            onClick={handleNotificarCompras}
            disabled={notificando || totais.criticosCount === 0}
            className="gap-1.5 text-xs font-bold h-9 bg-rose-600 hover:bg-rose-700 text-white shadow-sm disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5" />
            {notificando ? "Enviando..." : "Avisar Encarregado & Compras"}
          </Button>
        </div>
      </div>

      {/* KPI Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-blue-500" /> Estoque Disponível
          </span>
          <p className="text-2xl font-black text-foreground mt-1.5">
            {fmtKg(totais.dispKg)} <span className="text-xs font-semibold text-muted-foreground">kg</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Total bruto: {fmtKg(totais.totalKg)} kg
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Espessuras Críticas
          </span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5">
            {totais.criticosCount}{" "}
            <span className="text-xs font-semibold text-muted-foreground">de {gruposEspessura.length}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Abaixo do estoque mínimo
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Em Atenção
          </span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
            {totais.atencaoCount}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Próximas do limite de reposição
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-xs">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-emerald-500" /> Bobinas em Pátio
          </span>
          <p className="text-2xl font-black text-foreground mt-1.5">
            {totais.totalBobinas}{" "}
            <span className="text-xs font-semibold text-muted-foreground">unidades</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Filial: {filialAtiva || "Todas"}
          </p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSetorFiltro("todos")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              setorFiltro === "todos"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todos os Setores
          </button>
          <button
            onClick={() => setSetorFiltro("telhas")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              setorFiltro === "telhas"
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            🏗️ Telhas
          </button>
          <button
            onClick={() => setSetorFiltro("corte_dobra")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              setorFiltro === "corte_dobra"
                ? "bg-orange-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            ✂️ Corte & Dobra
          </button>

          <button
            onClick={() => setSomenteCriticos(!somenteCriticos)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              somenteCriticos
                ? "bg-rose-50 dark:bg-rose-950 border-rose-300 text-rose-700 dark:text-rose-300"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Só Críticos ({totais.criticosCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar espessura (ex: 0.43)..."
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      {/* Grade de Espessuras */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mb-2" />
          <span className="text-xs">Calculando estoque por espessura...</span>
        </div>
      ) : gruposFiltrados.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-xl text-muted-foreground">
          <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm font-semibold">Nenhuma espessura encontrada com os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {gruposFiltrados.map((g) => {
            const isCritico = g.status === "critico";
            const isAtencao = g.status === "atencao";

            const statusCor = isCritico
              ? "border-rose-300 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20"
              : isAtencao
              ? "border-amber-300 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20"
              : "border-border bg-card";

            const badgeStatus = isCritico ? (
              <Badge variant="destructive" className="text-[10px] font-bold gap-1">
                <AlertTriangle className="w-3 h-3" /> CRÍTICO / REPOR
              </Badge>
            ) : isAtencao ? (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px] font-bold gap-1">
                <AlertCircle className="w-3 h-3" /> ATENÇÃO
              </Badge>
            ) : (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-[10px] font-semibold gap-1">
                <CheckCircle2 className="w-3 h-3" /> SEGURO
              </Badge>
            );

            return (
              <div
                key={g.espessura}
                className={`border rounded-2xl p-4 shadow-xs transition-all hover:shadow-md ${statusCor}`}
              >
                {/* Topo do Card */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm border border-primary/20">
                      {g.espessura}
                    </div>
                    <div>
                      <p className="text-xs font-black text-foreground">
                        Espessura {g.espessura} mm
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Mínimo estipulado: {fmtKg(g.minimoKg)} kg
                      </p>
                    </div>
                  </div>
                  {badgeStatus}
                </div>

                {/* Barra de Estoque Visual */}
                <div className="space-y-1 mb-3">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-muted-foreground">Nível em relação ao mínimo:</span>
                    <span className={isCritico ? "text-rose-600 font-bold" : isAtencao ? "text-amber-600 font-bold" : "text-emerald-600"}>
                      {g.percentualMinimo}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isCritico
                          ? "bg-rose-500"
                          : isAtencao
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, g.percentualMinimo)}%` }}
                    />
                  </div>
                </div>

                {/* Saldo e Métricas */}
                <div className="grid grid-cols-2 gap-2 bg-background/60 rounded-xl p-2.5 border border-border/60 text-xs mb-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Disponível</span>
                    <span className="text-sm font-black text-foreground">
                      {fmtKg(g.pesoDisponivelKg)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Reservado</span>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                      {fmtKg(g.pesoReservadoKg)} kg
                    </span>
                  </div>
                </div>

                {/* Unidades Físicas */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-3 border-b border-border/60">
                  <span>{g.bobinasCount} bobina(s)</span>
                  {g.chapasCount > 0 && <span>{g.chapasCount} chapa(s)</span>}
                  {g.slittersCount > 0 && <span>{g.slittersCount} slitter(s)</span>}
                </div>

                {/* Botão de Detalhes */}
                <button
                  onClick={() => setSelectedEspessuraModal(g)}
                  className="w-full mt-3 flex items-center justify-center gap-1 text-xs font-bold text-primary hover:text-primary/80 py-1.5 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver Bobinas e Chapas ({g.itensBobinas.length + g.itensChapas.length})
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalhes dos Itens da Espessura */}
      <Dialog
        open={!!selectedEspessuraModal}
        onOpenChange={(open) => !open && setSelectedEspessuraModal(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Layers className="w-5 h-5 text-primary" />
              Itens em Estoque — Espessura {selectedEspessuraModal?.espessura} mm
            </DialogTitle>
            <DialogDescription>
              Detalhamento de bobinas, chapas e slitters desta espessura na filial {filialAtiva || "Todas"}
            </DialogDescription>
          </DialogHeader>

          {selectedEspessuraModal && (
            <div className="space-y-4 py-2">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-xl border border-border text-center text-xs">
                <div>
                  <span className="text-muted-foreground block">Total KG</span>
                  <span className="font-bold text-sm">{fmtKg(selectedEspessuraModal.pesoTotalKg)} kg</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Disponível</span>
                  <span className="font-bold text-sm text-emerald-600">{fmtKg(selectedEspessuraModal.pesoDisponivelKg)} kg</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Reservado</span>
                  <span className="font-bold text-sm text-amber-600">{fmtKg(selectedEspessuraModal.pesoReservadoKg)} kg</span>
                </div>
              </div>

              {/* Lista de Bobinas */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Bobinas ({selectedEspessuraModal.itensBobinas.length})
                </h4>
                {selectedEspessuraModal.itensBobinas.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma bobina cadastrada.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {selectedEspessuraModal.itensBobinas.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-2 p-2.5 bg-card border border-border rounded-lg text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground">
                              {b.codigo || b.id?.slice(0, 8)}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {b.cor || "Natural"}
                            </Badge>
                            {b.reservada && (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1 py-0">
                                Reservada
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {b.unidade} · NF: {b.nf || "—"} · Origem: {b.origem || "Nacional"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-foreground block">
                            {fmtKg(b.peso_kg)} kg
                          </span>
                          {b.metragem_restante && (
                            <span className="text-[10px] text-muted-foreground">
                              {b.metragem_restante}m
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lista de Chapas */}
              {selectedEspessuraModal.itensChapas.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Chapas Cortadas ({selectedEspessuraModal.itensChapas.length})
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedEspessuraModal.itensChapas.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 p-2.5 bg-card border border-border rounded-lg text-xs"
                      >
                        <div>
                          <span className="font-bold text-foreground">{c.codigo || "Chapa"}</span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {c.comprimento_mm}x{c.largura_mm} mm · Qtd: {c.quantidade_disponivel || c.quantidade_total}
                          </p>
                        </div>
                        <div className="text-right font-black text-foreground">
                          {fmtKg(c.peso_kg)} kg
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Configuração de Mínimos */}
      <Dialog open={configMinimosOpen} onOpenChange={setConfigMinimosOpen}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Configurar Estoque Mínimo (KG)
            </DialogTitle>
            <DialogDescription>
              Defina o peso mínimo aceitável antes de disparar alerta para compras e encarregados.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const novos = { ...limitesMinimos };
              for (const [key, val] of formData.entries()) {
                novos[key] = Number(val) || 0;
              }
              salvarLimites(novos);
            }}
            className="space-y-3 py-2"
          >
            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {gruposEspessura.map((g) => (
                <div key={g.espessura} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold w-24">Espessura {g.espessura} mm:</span>
                  <Input
                    name={g.espessura}
                    type="number"
                    defaultValue={limitesMinimos[g.espessura] ?? limitesMinimos.DEFAULT ?? 2000}
                    className="h-8 text-xs font-bold text-right w-32"
                    step="500"
                  />
                  <span className="text-muted-foreground">kg</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setConfigMinimosOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="font-bold">
                Salvar Limites
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
