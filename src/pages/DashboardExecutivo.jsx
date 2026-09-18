import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useFilial, FILIAIS } from "@/contexts/FilialContext";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  TrendingUp,
  Package,
  Truck,
  Factory,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Sparkles,
  Trophy,
  Filter,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UserAvatarButton from "@/components/UserAvatarButton";
import NotificationBell from "@/components/NotificationBell";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  PieChart,
  Pie
} from "recharts";

const CORES_FILIAIS = {
  "Matriz AJL": "#0d9488", // teal-600
  "Pinhais": "#3b82f6",    // blue-500
  "Ivaiporã": "#f59e0b",   // amber-500
  "Ponta Grossa": "#8b5cf6" // purple-500
};

export default function DashboardExecutivo() {
  const navigate = useNavigate();
  const { filialAtiva, trocarFilial } = useFilial();
  const [periodo, setPeriodo] = useState("mes"); // hoje | semana | mes

  // 1. Pedidos Telhas
  const { data: pedidosTelhas = [], isLoading: loadingTelhas, refetch: refetchTelhas } = useQuery({
    queryKey: ["exec-pedidos-telhas"],
    queryFn: () => base44.entities.Pedido.list("-data_finalizacao", 1000),
    refetchInterval: 30000
  });

  // 2. Ordens Corte e Dobra
  const { data: ordensCD = [], isLoading: loadingCD, refetch: refetchCD } = useQuery({
    queryKey: ["exec-ordens-cd"],
    queryFn: () => base44.entities.OrdemMaquinaCD.list("-data_finalizacao", 1000),
    refetchInterval: 30000
  });

  // 3. Estoque de Bobinas
  const { data: bobinas = [], isLoading: loadingBobinas, refetch: refetchBobinas } = useQuery({
    queryKey: ["exec-bobinas"],
    queryFn: () => base44.entities.Bobina.list("-created_date", 1000),
    refetchInterval: 30000
  });

  // 4. Rotas de Entrega
  const { data: rotas = [], isLoading: loadingRotas, refetch: refetchRotas } = useQuery({
    queryKey: ["exec-rotas"],
    queryFn: () => base44.entities.RotaEntrega.list("-created_date", 500),
    refetchInterval: 30000
  });

  const isLoading = loadingTelhas || loadingCD || loadingBobinas || loadingRotas;

  const handleAtualizarTudo = () => {
    refetchTelhas();
    refetchCD();
    refetchBobinas();
    refetchRotas();
  };

  // Consolidação de métricas por Filial
  const dadosFiliais = useMemo(() => {
    const mapa = {};
    FILIAIS.forEach((f) => {
      mapa[f] = {
        nome: f,
        telhasMetros: 0,
        telhasOps: 0,
        cdPecas: 0,
        cdOps: 0,
        estoqueKg: 0,
        estoqueBobinas: 0,
        rotasEntregues: 0,
        rotasAtivas: 0,
        alertasEstoque: 0
      };
    });

    // Somar Telhas
    pedidosTelhas.forEach((p) => {
      const u = p.unidade || "Matriz AJL";
      if (!mapa[u]) mapa[u] = { nome: u, telhasMetros: 0, telhasOps: 0, cdPecas: 0, cdOps: 0, estoqueKg: 0, estoqueBobinas: 0, rotasEntregues: 0, rotasAtivas: 0, alertasEstoque: 0 };
      if (p.status === "finalizado") {
        mapa[u].telhasOps += 1;
        mapa[u].telhasMetros += Number(p.metros || p.quantidade_telhas || 0);
      }
    });

    // Somar Corte e Dobra
    ordensCD.forEach((o) => {
      const u = o.unidade || "Matriz AJL";
      if (!mapa[u]) mapa[u] = { nome: u, telhasMetros: 0, telhasOps: 0, cdPecas: 0, cdOps: 0, estoqueKg: 0, estoqueBobinas: 0, rotasEntregues: 0, rotasAtivas: 0, alertasEstoque: 0 };
      if (o.status === "finalizado") {
        mapa[u].cdOps += 1;
        mapa[u].cdPecas += Number(o.quantidade_produzida || o.quantidade || 0);
      }
    });

    // Somar Bobinas
    bobinas.forEach((b) => {
      const u = b.unidade || "Matriz AJL";
      if (!mapa[u]) mapa[u] = { nome: u, telhasMetros: 0, telhasOps: 0, cdPecas: 0, cdOps: 0, estoqueKg: 0, estoqueBobinas: 0, rotasEntregues: 0, rotasAtivas: 0, alertasEstoque: 0 };
      if (b.status !== "esgotada") {
        mapa[u].estoqueBobinas += 1;
        mapa[u].estoqueKg += Number(b.peso_liquido || b.peso_atual_kg || 0);
        if (Number(b.peso_liquido || b.peso_atual_kg || 0) < 500) {
          mapa[u].alertasEstoque += 1;
        }
      }
    });

    // Somar Rotas
    rotas.forEach((r) => {
      const u = r.unidade || "Matriz AJL";
      if (!mapa[u]) mapa[u] = { nome: u, telhasMetros: 0, telhasOps: 0, cdPecas: 0, cdOps: 0, estoqueKg: 0, estoqueBobinas: 0, rotasEntregues: 0, rotasAtivas: 0, alertasEstoque: 0 };
      if (r.status === "entregue" || r.status === "finalizado") {
        mapa[u].rotasEntregues += 1;
      } else {
        mapa[u].rotasAtivas += 1;
      }
    });

    return FILIAIS.map((f) => mapa[f]);
  }, [pedidosTelhas, ordensCD, bobinas, rotas]);

  // Totais Globais
  const totais = useMemo(() => {
    return dadosFiliais.reduce(
      (acc, d) => ({
        telhasMetros: acc.telhasMetros + d.telhasMetros,
        cdPecas: acc.cdPecas + d.cdPecas,
        opsTotal: acc.opsTotal + d.telhasOps + d.cdOps,
        estoqueKg: acc.estoqueKg + d.estoqueKg,
        estoqueBobinas: acc.estoqueBobinas + d.estoqueBobinas,
        rotasAtivas: acc.rotasAtivas + d.rotasAtivas,
        rotasEntregues: acc.rotasEntregues + d.rotasEntregues
      }),
      { telhasMetros: 0, cdPecas: 0, opsTotal: 0, estoqueKg: 0, estoqueBobinas: 0, rotasAtivas: 0, rotasEntregues: 0 }
    );
  }, [dadosFiliais]);

  // Ranking de Produtividade
  const rankingFiliais = useMemo(() => {
    return [...dadosFiliais].sort((a, b) => (b.telhasMetros + b.cdPecas) - (a.telhasMetros + a.cdPecas));
  }, [dadosFiliais]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header Executivo */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/setor")}
            className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2.5"
            title="Voltar ao Hub de Setores"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Dashboard Executivo Cross-Filial</h1>
                <Badge className="bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30 text-[10px] py-0 font-bold">
                  Diretoria / CEO
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Consolidação ao vivo de Matriz AJL, Pinhais, Ivaiporã e Ponta Grossa
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAtualizarTudo}
            disabled={isLoading}
            className="h-8 text-xs gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <NotificationBell />
          <UserAvatarButton size="sm" />
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* KPIs Globais em Cartões */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5">
              <span>Produção Telhas (Total)</span>
              <Factory className="w-4 h-4 text-teal-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground">
              {totais.telhasMetros.toLocaleString("pt-BR")} <span className="text-sm font-bold text-muted-foreground">m</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Distribuído nas 4 fábricas
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5">
              <span>Corte e Dobra (Total)</span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground">
              {totais.cdPecas.toLocaleString("pt-BR")} <span className="text-sm font-bold text-muted-foreground">peças</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Chapas, calhas e perfis
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5">
              <span>Estoque de Aço Ativo</span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground">
              {(totais.estoqueKg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}{" "}
              <span className="text-sm font-bold text-muted-foreground">ton</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {totais.estoqueBobinas} bobinas ativas
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1.5">
              <span>Rotas & Expedição</span>
              <Truck className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-black text-foreground">
              {totais.rotasAtivas}{" "}
              <span className="text-sm font-bold text-muted-foreground">ativas / {totais.rotasEntregues} concluídas</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Despachos em trânsito
            </p>
          </div>
        </div>

        {/* Visão Comparativa das 4 Filiais Lado a Lado */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> Status ao Vivo por Unidade Fabril
              </h2>
              <p className="text-xs text-muted-foreground">
                Clique em uma fábrica para trocar seu foco de operação instantaneamente
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dadosFiliais.map((f, idx) => {
              const cor = CORES_FILIAIS[f.nome] || "#0d9488";
              const isAtiva = filialAtiva === f.nome;
              return (
                <div
                  key={f.nome}
                  className={`bg-card rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                    isAtiva ? "ring-2 ring-primary border-transparent shadow-md" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />
                        {f.nome}
                      </span>
                      {isAtiva && (
                        <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] py-0 font-bold">
                          Ativa
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 py-2 text-xs border-y border-border/60 my-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Telhas Prontas:</span>
                        <strong className="text-foreground">{f.telhasMetros.toLocaleString("pt-BR")} m</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Corte & Dobra:</span>
                        <strong className="text-foreground">{f.cdPecas.toLocaleString("pt-BR")} un</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Estoque de Aço:</span>
                        <strong className="text-foreground">{Math.round(f.estoqueKg).toLocaleString("pt-BR")} kg</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Rotas Ativas:</span>
                        <strong className="text-foreground">{f.rotasAtivas}</strong>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant={isAtiva ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      trocarFilial(f.nome);
                      toast.success(`Filial ativa alterada para ${f.nome}`);
                    }}
                    className="w-full text-xs gap-1.5 mt-2"
                  >
                    <span>{isAtiva ? "Visualizando Esta Filial" : "Alternar para esta Filial"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráficos Comparativos Recharts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Produção */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Volume de Produção por Filial
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Metros de telhas e peças de Corte & Dobra</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFiliais} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      color: "#fff",
                      border: "none",
                      fontSize: "12px"
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Bar dataKey="telhasMetros" name="Telhas (m)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cdPecas" name="Corte & Dobra (un)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Estoque de Matéria-Prima */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" /> Saldo de Aço em Estoque (kg)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Total de bobinas ativas por fábrica</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosFiliais} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      color: "#fff",
                      border: "none",
                      fontSize: "12px"
                    }}
                  />
                  <Bar dataKey="estoqueKg" name="Peso em Estoque (kg)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Pódio de Produtividade das Fábricas */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Ranking Geral de Desempenho
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Classificação das fábricas por volume entregue e finalizado</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {rankingFiliais.map((f, idx) => (
              <div
                key={f.nome}
                className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center gap-3"
              >
                <div className="text-2xl font-black">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                </div>
                <div>
                  <strong className="text-sm text-foreground block">{f.nome}</strong>
                  <span className="text-xs text-muted-foreground">
                    {(f.telhasMetros + f.cdPecas).toLocaleString("pt-BR")} itens produzidos
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}