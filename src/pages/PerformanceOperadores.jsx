import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import {
  Trophy,
  Award,
  Medal,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  Filter,
  Flame,
  Search,
  Zap,
  BarChart2,
  Calendar,
  Sparkles,
  UserPlus,
  UserCheck,
  Factory
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import NovoOperadorModal from "@/components/usuarios/NovoOperadorModal";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell
} from "recharts";

const CORES_PODIO = ["#eab308", "#94a3b8", "#b45309", "#3b82f6", "#10b981", "#8b5cf6"];

export default function PerformanceOperadores() {
  const { filialAtiva } = useFilial();
  const [periodo, setPeriodo] = useState("mes"); // hoje | semana | mes
  const [setorFiltro, setSetorFiltro] = useState("todos"); // todos | telhas | corte_dobra
  const [busca, setBusca] = useState("");
  const [novoOperadorOpen, setNovoOperadorOpen] = useState(false);

  // 1. Buscar apontamentos e ordens finalizadas de telhas
  const { data: pedidosTelhas = [], isLoading: loadingTelhas } = useQuery({
    queryKey: ["perf-pedidos-telhas", filialAtiva],
    queryFn: async () => {
      try {
        const q = { status: "finalizado" };
        if (filialAtiva) q.unidade = filialAtiva;
        return await base44.entities.Pedido.filter(q, "-data_finalizacao", 300);
      } catch {
        return [];
      }
    }
  });

  // 2. Buscar ordens finalizadas de corte e dobra
  const { data: ordensCD = [], isLoading: loadingCD } = useQuery({
    queryKey: ["perf-ordens-cd", filialAtiva],
    queryFn: async () => {
      try {
        const q = { status: "finalizado" };
        if (filialAtiva) q.unidade = filialAtiva;
        return await base44.entities.OrdemMaquinaCD.filter(q, "-data_finalizacao", 300);
      } catch {
        return [];
      }
    }
  });

  // 3. Buscar equipe
  const { data: equipe = [] } = useQuery({
    queryKey: ["perf-equipe"],
    queryFn: async () => {
      try {
        return await base44.entities.User.list("-full_name", 100);
      } catch {
        return [];
      }
    }
  });

  const isLoading = loadingTelhas || loadingCD;

  // Processar e tabular métricas por operador
  const rankingOperadores = useMemo(() => {
    const mapa = {};

    // Inicializar com a equipe cadastrada
    equipe.forEach((u) => {
      if (setorFiltro !== "todos" && u.setor && u.setor !== setorFiltro) return;
      const nome = u.full_name || u.email;
      let maqArray = [];
      try {
        if (Array.isArray(u.maquinas)) maqArray = u.maquinas;
        else if (typeof u.maquina === "string") {
          try {
            const p = JSON.parse(u.maquina);
            if (Array.isArray(p)) maqArray = p;
            else maqArray = [u.maquina];
          } catch {
            maqArray = [u.maquina];
          }
        }
      } catch {}

      mapa[nome] = {
        id: u.id,
        nome,
        role: u.role || "operador",
        setor: u.setor || "Geral",
        maquinasCadastradas: maqArray,
        totalOps: 0,
        totalPecasOuMetros: 0,
        totalSegundos: 0,
        maquinasUsadas: new Set()
      };
    });

    // Processar Telhas
    if (setorFiltro === "todos" || setorFiltro === "telhas") {
      pedidosTelhas.forEach((p) => {
        let listaOps = [];
        try {
          if (Array.isArray(p.operadores_json)) listaOps = p.operadores_json.map(o => o.nome || o);
          else if (typeof p.operadores_json === "string") listaOps = JSON.parse(p.operadores_json).map(o => o.nome || o);
        } catch {}

        if (listaOps.length === 0 && p.vendedor) {
          // Fallback se não preenchido
          listaOps = ["Equipe Telhas"];
        }

        const metros = Number(p.metros || p.quantidade_telhas || 0);
        const seg = Number(p.tempo_producao_seg || 1200);

        listaOps.forEach((opNome) => {
          if (!mapa[opNome]) {
            mapa[opNome] = {
              id: opNome,
              nome: opNome,
              role: "operador",
              setor: "Telhas",
              totalOps: 0,
              totalPecasOuMetros: 0,
              totalSegundos: 0,
              maquinasUsadas: new Set()
            };
          }
          mapa[opNome].totalOps += 1;
          mapa[opNome].totalPecasOuMetros += Math.round(metros / listaOps.length);
          mapa[opNome].totalSegundos += Math.round(seg / listaOps.length);
          if (p.maquina) mapa[opNome].maquinasUsadas.add(p.maquina);
        });
      });
    }

    // Processar Corte e Dobra
    if (setorFiltro === "todos" || setorFiltro === "corte_dobra") {
      ordensCD.forEach((o) => {
        let listaOps = [];
        try {
          if (Array.isArray(o.operadores_json)) listaOps = o.operadores_json.map(op => op.nome || op);
          else if (typeof o.operadores_json === "string") listaOps = JSON.parse(o.operadores_json).map(op => op.nome || op);
        } catch {}

        if (listaOps.length === 0) {
          listaOps = ["Equipe C&D"];
        }

        const qtd = Number(o.quantidade_produzida || o.quantidade || 0);
        const seg = Number(o.tempo_producao_seg || 900);

        listaOps.forEach((opNome) => {
          if (!mapa[opNome]) {
            mapa[opNome] = {
              id: opNome,
              nome: opNome,
              role: "operador",
              setor: "Corte e Dobra",
              totalOps: 0,
              totalPecasOuMetros: 0,
              totalSegundos: 0,
              maquinasUsadas: new Set()
            };
          }
          mapa[opNome].totalOps += 1;
          mapa[opNome].totalPecasOuMetros += Math.round(qtd / listaOps.length);
          mapa[opNome].totalSegundos += Math.round(seg / listaOps.length);
          if (o.maquina) mapa[opNome].maquinasUsadas.add(o.maquina);
        });
      });
    }

    return Object.values(mapa)
      .map((item) => {
        const mediaMin = item.totalOps > 0 ? Math.round(item.totalSegundos / item.totalOps / 60) : 0;
        return {
          ...item,
          mediaMinutosPorOp: mediaMin,
          maquinasCount: item.maquinasUsadas.size
        };
      })
      .filter((item) => item.totalOps > 0 || !item.nome.startsWith("Equipe"))
      .sort((a, b) => b.totalOps - a.totalOps || b.totalPecasOuMetros - a.totalPecasOuMetros);
  }, [pedidosTelhas, ordensCD, equipe, setorFiltro]);

  const filtrados = useMemo(() => {
    return rankingOperadores.filter((item) => {
      if (busca.trim()) {
        return item.nome.toLowerCase().includes(busca.toLowerCase().trim());
      }
      return true;
    });
  }, [rankingOperadores, busca]);

  const top3 = filtrados.slice(0, 3);

  // Dados para o gráfico de barras
  const chartData = useMemo(() => {
    return filtrados.slice(0, 8).map((op) => ({
      name: op.nome.split(" ")[0],
      totalOps: op.totalOps,
      producao: op.totalPecasOuMetros,
      mediaMinutos: op.mediaMinutosPorOp
    }));
  }, [filtrados]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              Performance dos Operadores
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs font-bold gap-1">
                <Flame className="w-3 h-3 fill-current" /> Gamificação
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Produtividade, OPs concluídas e tempo médio por ciclo no chão de fábrica
            </p>
          </div>
        </div>

        {/* Ações e Filtro Setor */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setNovoOperadorOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Cadastrar Operador
          </Button>

          {/* Filtro Setor */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSetorFiltro("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                setorFiltro === "todos"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Todos
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
          </div>
        </div>
      </div>

      {/* PÓDIO DOS 3 PRIMEIROS COLOCADOS */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((op, idx) => {
            const pos = idx + 1;
            const isFirst = pos === 1;
            const medalhaIcon = isFirst ? (
              <Trophy className="w-6 h-6 text-yellow-500 fill-current" />
            ) : pos === 2 ? (
              <Award className="w-6 h-6 text-slate-400" />
            ) : (
              <Medal className="w-6 h-6 text-amber-700" />
            );

            const cardBorda = isFirst
              ? "border-amber-400 dark:border-amber-500/60 bg-gradient-to-b from-amber-50/50 to-card dark:from-amber-950/20 shadow-lg ring-1 ring-amber-400/30"
              : "border-border bg-card shadow-xs";

            return (
              <div
                key={op.id}
                className={`rounded-2xl border p-5 relative overflow-hidden transition-all hover:scale-101 ${cardBorda}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-foreground">#{pos}</span>
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                      {isFirst ? "Operador Destaque" : `Top ${pos}`}
                    </span>
                  </div>
                  {medalhaIcon}
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-black text-lg flex items-center justify-center uppercase border border-primary/20">
                    {op.nome.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground line-clamp-1">
                      {op.nome}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {op.setor} · {op.maquinasCount} máquinas
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-background/60 p-2.5 rounded-xl border border-border text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">OPs Concluídas</span>
                    <span className="text-base font-black text-foreground">{op.totalOps}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Média de Ciclo</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {op.mediaMinutosPorOp > 0 ? `${op.mediaMinutosPorOp} min` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gráfico Comparativo */}
      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Comparativo de OPs Finalizadas por Operador
              </h2>
              <p className="text-xs text-muted-foreground">Top operadores com mais ordens produzidas no período</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} />
                <YAxis fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", borderColor: "#334155", borderRadius: "12px", color: "#fff", fontSize: "12px" }}
                />
                <Bar dataKey="totalOps" name="Total OPs" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CORES_PODIO[index % CORES_PODIO.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela de Classificação Completa */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Classificação Geral da Fábrica</h2>
            <p className="text-xs text-muted-foreground">Listagem de toda a equipe e produtividade</p>
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar operador..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Posição</th>
                <th className="py-3 px-4">Operador</th>
                <th className="py-3 px-4">Máquinas</th>
                <th className="py-3 px-4">Setor</th>
                <th className="py-3 px-4 text-center">OPs Prontas</th>
                <th className="py-3 px-4 text-center">Volume Total</th>
                <th className="py-3 px-4 text-center">Tempo Médio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhum operador encontrado.
                  </td>
                </tr>
              ) : (
                filtrados.map((op, idx) => (
                  <tr key={op.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-black">
                      {idx === 0 ? "🥇 1º" : idx === 1 ? "🥈 2º" : idx === 2 ? "🥉 3º" : `#${idx + 1}`}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {op.nome}
                    </td>
                    <td className="py-3 px-4">
                      {op.maquinasCadastradas && op.maquinasCadastradas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {op.maquinasCadastradas.map((m) => (
                            <Badge
                              key={m}
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                            >
                              {m}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {op.setor}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-primary">
                      {op.totalOps}
                    </td>
                    <td className="py-3 px-4 text-center text-foreground">
                      {op.totalPecasOuMetros.toLocaleString("pt-BR")} {op.setor === "Telhas" ? "m" : "un"}
                    </td>
                    <td className="py-3 px-4 text-center text-muted-foreground font-mono">
                      {op.mediaMinutosPorOp > 0 ? `${op.mediaMinutosPorOp} min` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para cadastrar operador direto */}
      <NovoOperadorModal
        open={novoOperadorOpen}
        onOpenChange={setNovoOperadorOpen}
        defaultSetor={setorFiltro === "corte_dobra" ? "corte_dobra" : "telhas"}
      />
    </div>
  );
}
