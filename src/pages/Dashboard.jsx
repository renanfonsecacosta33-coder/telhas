import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Circle, Snowflake, Package, ArrowRight, Ruler, Factory, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatsCard from "@/components/stock/StatsCard";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas"],
    queryFn: () => base44.entities.Bobina.list(),
  });

  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores"],
    queryFn: () => base44.entities.Isopor.list(),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => base44.entities.Produto.list(),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-dash"],
    queryFn: () => base44.entities.Pedido.list("-data", 200),
  });

  const hoje = format(new Date(), "yyyy-MM-dd");
  const pedidosHoje = pedidos.filter(p => p.data === hoje);
  const emProducaoAgora = pedidos.filter(p => p.status === "em_producao" || p.status === "pausado").length;
  const finalizadosHoje = pedidosHoje.filter(p => p.status === "finalizado").length;
  const metrosHoje = pedidosHoje.reduce((s, p) => s + (p.metros || 0), 0);
  const aguardandoColagem = pedidos.filter(p => p.status === "aguardando_colagem").length;

  const totalBobinas = bobinas.length;
  const totalIsopor = isopores.length;
  const totalProdutos = produtos.length;
  const totalMetragem = isopores.reduce((s, i) => s + (i.metragem_total || 0), 0);
  const totalPesoBobinas = bobinas.reduce((s, b) => s + (b.peso_kg || 0), 0);

  const categorias = ["Bobininha", "Cumeeira", "Cola", "Consumivel"];
  const produtosPorCategoria = categorias.map((cat) => ({
    categoria: cat,
    count: produtos.filter((p) => p.categoria === cat).length,
  }));

  const sections = [
    {
      title: "Bobinas",
      icon: Circle,
      path: "/bobinas",
      count: totalBobinas,
      color: "blue",
      desc: `${totalPesoBobinas > 0 ? totalPesoBobinas.toLocaleString("pt-BR") + " kg total" : "Aço galvanizado"}`,
      items: bobinas.slice(0, 4),
      renderItem: (b) => (
        <div key={b.id} className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">{b.cor}</span>
          <span className="text-xs text-muted-foreground">{b.espessura}</span>
        </div>
      ),
    },
    {
      title: "Isopor",
      icon: Snowflake,
      path: "/isopor",
      count: totalIsopor,
      color: "orange",
      desc: `${totalMetragem > 0 ? totalMetragem + "m de metragem" : "EPS térmico"}`,
      badge: "Foco",
      items: isopores.slice(0, 4),
      renderItem: (i) => (
        <div key={i.id} className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">{i.tipo}</span>
          <div className="flex items-center gap-2">
            {i.quantidade && <Badge variant="outline" className="text-xs">{i.quantidade} un</Badge>}
            {i.metragem_total && <Badge variant="secondary" className="text-xs">{i.metragem_total}m</Badge>}
          </div>
        </div>
      ),
    },
    {
      title: "Outros Produtos",
      icon: Package,
      path: "/estoque",
      count: totalProdutos,
      color: "green",
      desc: categorias.map((c) => {
        const n = produtos.filter((p) => p.categoria === c).length;
        return n > 0 ? `${n} ${c.toLowerCase()}` : null;
      }).filter(Boolean).join(", ") || "Bobininha, Cumeeira, Cola, Consumível",
      items: produtos.slice(0, 4),
      renderItem: (p) => (
        <div key={p.id} className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">{p.nome}</span>
          <Badge variant="outline" className="text-xs">{p.categoria}</Badge>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral do estoque AJL Ferro e Aço</p>
        </div>
        <Link to="/dashboard-producao">
          <Button variant="outline" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Dashboard Produção
          </Button>
        </Link>
      </div>

      {/* Produção hoje */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Metros Hoje", value: `${metrosHoje.toFixed(0)}m`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", link: "/dashboard-producao" },
          { label: "Em Produção Agora", value: emProducaoAgora, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", link: "/producao" },
          { label: "Finalizados Hoje", value: finalizadosHoje, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", link: "/producao" },
          { label: "Aguard. Colagem", value: aguardandoColagem, icon: Factory, color: "text-orange-600", bg: "bg-orange-50", link: "/maquina/colagem" },
        ].map(k => (
          <Link key={k.label} to={k.link}>
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.bg}`}>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <div>
                <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{k.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats estoque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Bobinas" value={totalBobinas} subtitle="itens cadastrados" icon={Circle} color="blue" />
        <StatsCard title="Isopor" value={totalIsopor} subtitle="tipos em estoque" icon={Snowflake} color="orange" />
        <StatsCard title="Metragem Isopor" value={`${totalMetragem}m`} subtitle="total linear" icon={Ruler} color="green" />
        <StatsCard title="Outros" value={totalProdutos} subtitle="produtos diversos" icon={Package} color="purple" />
      </div>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300"
          >
            <div className="p-5 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    section.color === "blue" ? "bg-primary/10" :
                    section.color === "orange" ? "bg-accent/10" :
                    "bg-green-500/10"
                  }`}>
                    <section.icon className={`w-5 h-5 ${
                      section.color === "blue" ? "text-primary" :
                      section.color === "orange" ? "text-accent-foreground" :
                      "text-green-600"
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{section.title}</h2>
                      {section.badge && (
                        <Badge className="bg-accent text-accent-foreground text-xs">{section.badge}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{section.desc}</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-muted-foreground/50">{section.count}</span>
              </div>
            </div>
            <div className="p-5">
              {section.items.length > 0 ? (
                <div className="divide-y divide-border">
                  {section.items.map(section.renderItem)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado</p>
              )}
            </div>
            <div className="px-5 pb-4">
              <Link to={section.path}>
                <Button variant="outline" className="w-full gap-2" size="sm">
                  Ver tudo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}