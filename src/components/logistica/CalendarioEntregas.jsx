import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Truck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  MapPin,
  User,
  Filter,
  Search,
  ArrowRight,
  Edit2
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
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MESES_PT = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };

function parseDataFlexivel(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return new Date(ano, +m[2] - 1, +m[1]);
  }
  m = s.match(/^(\d{1,2})\/([a-zç]{3})/);
  if (m) {
    const mes = MESES_PT[m[2]];
    if (mes === undefined) return null;
    return new Date(new Date().getFullYear(), mes, +m[1]);
  }
  return null;
}

const STATUS_CONFIG = {
  planejado: { label: "Planejada", bg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", dot: "bg-blue-500" },
  distribuido: { label: "Planejada", bg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", dot: "bg-blue-500" },
  carregando: { label: "Carregando", bg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-500" },
  carregado: { label: "Carregado", bg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-500" },
  em_transito: { label: "Em Trânsito", bg: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30", dot: "bg-purple-500" },
  entregue: { label: "Entregue", bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  finalizado: { label: "Concluída", bg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  atrasado: { label: "Atrasada", bg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30", dot: "bg-rose-500" }
};

export default function CalendarioEntregas({ filial = null }) {
  const { filialAtiva } = useFilial();
  const unidadeAlvo = filial || filialAtiva;
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("mes"); // mes | semana
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [filtroTexto, setFiltroTexto] = useState("");

  const [rotaDetalhe, setRotaDetalhe] = useState(null);
  const [reagendando, setReagendando] = useState(false);
  const [novaDataEntrega, setNovaDataEntrega] = useState("");

  // Buscar todas as rotas
  const { data: rotas = [], isLoading } = useQuery({
    queryKey: ["calendario-rotas", unidadeAlvo],
    queryFn: async () => {
      try {
        const q = unidadeAlvo && unidadeAlvo !== "Todas" ? { unidade: unidadeAlvo } : {};
        return await base44.entities.RotaEntrega.filter(q, "-created_date", 300);
      } catch {
        return [];
      }
    },
    refetchInterval: 15000
  });

  // Mapear rotas por chave de data "YYYY-MM-DD"
  const { mapaPorData, conflitosPorData } = useMemo(() => {
    const mapa = {};
    const motoristasNoDia = {};
    const veiculosNoDia = {};
    const conflitos = {};

    rotas.forEach((r) => {
      const d = parseDataFlexivel(r.entrega_date);
      if (!d) return;
      const chave = format(d, "yyyy-MM-dd");

      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push({ ...r, _dataParsed: d });

      // Verificação de conflito: mesmo motorista em duas rotas no mesmo dia
      if (r.motorista && r.status !== "entregue" && r.status !== "finalizado") {
        if (!motoristasNoDia[chave]) motoristasNoDia[chave] = {};
        if (!motoristasNoDia[chave][r.motorista]) motoristasNoDia[chave][r.motorista] = [];
        motoristasNoDia[chave][r.motorista].push(r);
      }

      // Verificação de conflito: mesmo veículo em duas rotas no mesmo dia
      if (r.veiculo && r.status !== "entregue" && r.status !== "finalizado") {
        if (!veiculosNoDia[chave]) veiculosNoDia[chave] = {};
        if (!veiculosNoDia[chave][r.veiculo]) veiculosNoDia[chave][r.veiculo] = [];
        veiculosNoDia[chave][r.veiculo].push(r);
      }
    });

    // Detectar onde há mais de 1 rota com o mesmo recurso
    Object.keys(mapa).forEach((dia) => {
      const confMotorista = motoristasNoDia[dia]
        ? Object.entries(motoristasNoDia[dia]).filter(([_, lista]) => lista.length > 1)
        : [];
      const confVeiculo = veiculosNoDia[dia]
        ? Object.entries(veiculosNoDia[dia]).filter(([_, lista]) => lista.length > 1)
        : [];

      if (confMotorista.length > 0 || confVeiculo.length > 0) {
        conflitos[dia] = {
          motoristas: confMotorista.map(([mot]) => mot),
          veiculos: confVeiculo.map(([veic]) => veic)
        };
      }
    });

    return { mapaPorData: mapa, conflitosPorData: conflitos };
  }, [rotas]);

  // Intervalo de datas a exibir
  const diasParaExibir = useMemo(() => {
    if (viewMode === "mes") {
      const mesInicio = startOfMonth(currentDate);
      const mesFim = endOfMonth(currentDate);
      const calInicio = startOfWeek(mesInicio, { weekStartsOn: 0 }); // Domingo
      const calFim = endOfWeek(mesFim, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calInicio, end: calFim });
    } else {
      const semInicio = startOfWeek(currentDate, { weekStartsOn: 0 });
      const semFim = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: semInicio, end: semFim });
    }
  }, [currentDate, viewMode]);

  // Navegação
  const handleAnterior = () => {
    setCurrentDate((d) => (viewMode === "mes" ? subMonths(d, 1) : subWeeks(d, 1)));
  };
  const handleProximo = () => {
    setCurrentDate((d) => (viewMode === "mes" ? addMonths(d, 1) : addWeeks(d, 1)));
  };
  const handleHoje = () => setCurrentDate(new Date());

  // Reagendamento de rota
  const reagendarMutation = useMutation({
    mutationFn: async ({ id, novaData }) => {
      return await base44.entities.RotaEntrega.update(id, {
        entrega_date: novaData
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendario-rotas"] });
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      toast.success("Data de entrega reagendada com sucesso!");
      setReagendando(false);
      setRotaDetalhe(null);
    },
    onError: (err) => {
      toast.error("Erro ao reagendar rota: " + (err?.message || "Tente novamente"));
    }
  });

  const handleSalvarReagendamento = () => {
    if (!rotaDetalhe || !novaDataEntrega) return;
    reagendarMutation.mutate({ id: rotaDetalhe.id, novaData: novaDataEntrega });
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Barra de Ferramentas Superior */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navegação de Data */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleAnterior} className="h-9 w-9">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleHoje} className="text-xs font-semibold h-9">
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={handleProximo} className="h-9 w-9">
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="ml-2">
            <h2 className="text-lg font-bold text-foreground capitalize">
              {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {rotas.length} rotas cadastradas no total
            </p>
          </div>
        </div>

        {/* Alternador de Visão & Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Busca rápida */}
          <div className="relative w-48 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar polo, motorista..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Toggle Mês / Semana */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => setViewMode("mes")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "mes" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => setViewMode("semana")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === "semana" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      {/* Grade do Calendário */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-bold text-muted-foreground py-2.5">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
            <div key={d} className={i === 0 || i === 6 ? "text-rose-500/80 dark:text-rose-400/80" : ""}>
              {d}
            </div>
          ))}
        </div>

        {/* Células de Dias */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
          {diasParaExibir.map((dia) => {
            const chave = format(dia, "yyyy-MM-dd");
            const rotasDoDia = mapaPorData[chave] || [];
            const conflito = conflitosPorData[chave];
            const pertenceAoMes = isSameMonth(dia, currentDate);
            const eHoje = isToday(dia);

            // Filtrar rotas por texto se digitado
            const rotasFiltradas = rotasDoDia.filter((r) => {
              if (statusFiltro !== "todos" && r.status !== statusFiltro) return false;
              if (filtroTexto) {
                const busca = filtroTexto.toLowerCase();
                const polo = (r.cidade_polo || "").toLowerCase();
                const mot = (r.motorista || "").toLowerCase();
                const veic = (r.veiculo || "").toLowerCase();
                return polo.includes(busca) || mot.includes(busca) || veic.includes(busca);
              }
              return true;
            });

            return (
              <div
                key={chave}
                className={`min-h-[110px] sm:min-h-[135px] p-1.5 flex flex-col justify-between transition-colors ${
                  !pertenceAoMes && viewMode === "mes" ? "bg-muted/15 text-muted-foreground/40" : "bg-card"
                } ${eHoje ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : ""}`}
              >
                {/* Cabeçalho do Dia */}
                <div className="flex items-center justify-between mb-1 px-1">
                  <span
                    className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${
                      eHoje
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : pertenceAoMes
                        ? "text-foreground"
                        : "text-muted-foreground/50"
                    }`}
                  >
                    {format(dia, "d")}
                  </span>

                  {conflito && (
                    <Badge
                      className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 text-[9px] px-1 py-0 gap-0.5"
                      title={`Conflito: ${conflito.motoristas.join(", ")}`}
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      Conflito
                    </Badge>
                  )}
                </div>

                {/* Lista de Rotas do Dia */}
                <div className="space-y-1 flex-1 overflow-y-auto max-h-24">
                  {rotasFiltradas.slice(0, 3).map((r) => {
                    const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.planejado;
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setRotaDetalhe(r);
                          setNovaDataEntrega(r.entrega_date || chave);
                        }}
                        className={`p-1 rounded-md border text-[10px] font-medium leading-tight cursor-pointer hover:scale-[1.02] transition-transform ${st.bg}`}
                        title={`${r.cidade_polo || "Rota"} — ${r.motorista || "Sem motorista"}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold truncate">
                            {r.cidade_polo || r.nome || "Rota"}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
                        </div>
                        {r.motorista && (
                          <div className="truncate text-[9px] opacity-80 mt-0.5">
                            🚛 {r.motorista}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {rotasFiltradas.length > 3 && (
                    <p className="text-[9px] font-bold text-muted-foreground text-center pt-0.5">
                      +{rotasFiltradas.length - 3} rotas
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Detalhes da Rota & Reagendamento */}
      <Dialog open={!!rotaDetalhe} onOpenChange={(op) => !op && setRotaDetalhe(null)}>
        <DialogContent className="max-w-md font-sans">
          {rotaDetalhe && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    {rotaDetalhe.cidade_polo || "Rota de Entrega"}
                  </DialogTitle>
                  <Badge className={STATUS_CONFIG[rotaDetalhe.status]?.bg || "bg-muted"}>
                    {STATUS_CONFIG[rotaDetalhe.status]?.label || rotaDetalhe.status}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  {rotaDetalhe.unidade || "AJL"} · Entrega prevista: <strong>{rotaDetalhe.entrega_date || "Não definida"}</strong>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                {/* Motorista e Veículo */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-xl border border-border">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Motorista</span>
                    <strong className="text-foreground flex items-center gap-1 mt-0.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      {rotaDetalhe.motorista || "Não alocado"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Caminhão / Placa</span>
                    <strong className="text-foreground flex items-center gap-1 mt-0.5">
                      <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                      {rotaDetalhe.veiculo || "Não definido"}
                    </strong>
                  </div>
                </div>

                {/* Métricas de Carga */}
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Peso Total Estimado</span>
                    <strong className="text-sm font-black text-primary">
                      {Number(rotaDetalhe.peso_total_kg || 0).toLocaleString("pt-BR")} kg
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Pedidos Agrupados</span>
                    <strong className="text-sm font-black text-foreground">
                      {Array.isArray(rotaDetalhe.pedidos) ? rotaDetalhe.pedidos.length : 0} pedidos
                    </strong>
                  </div>
                </div>

                {/* Área de Reagendamento */}
                {reagendando ? (
                  <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/5 space-y-2">
                    <Label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" /> Reagendar Data de Entrega:
                    </Label>
                    <Input
                      type="date"
                      value={novaDataEntrega}
                      onChange={(e) => setNovaDataEntrega(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setReagendando(false)} className="h-7 text-xs">
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSalvarReagendamento}
                        disabled={reagendarMutation.isPending}
                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {reagendarMutation.isPending ? "Salvando..." : "Confirmar Nova Data"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReagendando(true)}
                    className="w-full text-xs gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Alterar / Reagendar Data de Entrega
                  </Button>
                )}
              </div>

              <DialogFooter>
                <Button size="sm" variant="outline" onClick={() => setRotaDetalhe(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
