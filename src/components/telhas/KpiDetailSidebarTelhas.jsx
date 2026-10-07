import React, { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Weight, DollarSign, RefreshCw, Pause, CheckCircle2,
  Layers, Clock, Zap, Activity, X, Loader2, Factory,
  TrendingUp, Snowflake, Ruler, Calendar
} from "lucide-react";
import { calcularMetrosPedido } from "@/lib/metrosHelper";

function formatBRL(v) {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_CFG = {
  pendente: { label: "Pendente", color: "text-slate-600", bg: "bg-slate-100 border-slate-200" },
  aguardando_colagem: { label: "Aguard. Colagem", color: "text-orange-600", bg: "bg-orange-100 border-orange-200" },
  em_producao: { label: "Em Produção", color: "text-blue-600", bg: "bg-blue-100 border-blue-200" },
  pausado: { label: "Pausado", color: "text-purple-600", bg: "bg-purple-100 border-purple-200" },
  finalizado: { label: "Finalizado", color: "text-green-600", bg: "bg-green-100 border-green-200" },
  cancelado: { label: "Cancelado", color: "text-red-600", bg: "bg-red-100 border-red-200" },
};

const HEADER_CFG = {
  metros: { title: "Metros Lineares no Período", desc: "Metragem total de telhas finalizadas", icon: Ruler, hex: "#2563eb" },
  kg: { title: "KG no Período", desc: "Bobinas de telhas e consumo de matéria-prima", icon: Weight, hex: "#ea580c" },
  custo: { title: "Custo de Produção", desc: "Custo de matéria-prima por bobina e OP", icon: DollarSign, hex: "#16a34a" },
  ordens: { title: "Ordens no Período", desc: "Todas as OPs de telhas do período selecionado", icon: Layers, hex: "#475569" },
  retrabalhos: { title: "Retrabalhos", desc: "Ordens de retrabalho de telhas do período", icon: RefreshCw, hex: "#ef4444" },
  pausadas: { title: "Pausadas Agora", desc: "Ordens atualmente pausadas nas perfiladeiras", icon: Pause, hex: "#a855f7" },
  finalizados: { title: "Finalizados no Período", desc: "Ordens de telhas concluídas no período", icon: TrendingUp, hex: "#16a34a" },
  eficiencia: { title: "Eficiência", desc: "Distribuição entre tempo produtivo, pausas e setup", icon: Activity, hex: "#f59e0b" },
  sanduiche: { title: "Termoacústicas (Sanduíche)", desc: "Telhas com EPS, manta e colagem", icon: Snowflake, hex: "#06b6d4" },
};

export default function KpiDetailSidebarTelhas({
  open, onClose, type, ordensPeriodo = [], bobinasAtivas = [], filialAtiva,
  eficiencia, tempoProdTotal, tempoPausaTotal, tempoSetupTotal, tempoTotal
}) {
  const [allBobinas, setAllBobinas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && (type === "kg" || type === "custo")) {
      fetchBobinas();
    }
  }, [open, type]);

  const fetchBobinas = async () => {
    setLoading(true);
    try {
      const bobs = await base44.entities.Bobina.filter({ arquivada: false }, "-created_date", 500);
      setAllBobinas((bobs || []).filter(b => b.setor !== "corte_dobra"));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const bobinaMap = useMemo(() => {
    const map = {};
    [...bobinasAtivas, ...allBobinas].forEach(b => {
      if (b && b.id) map[b.id] = b;
    });
    return map;
  }, [bobinasAtivas, allBobinas]);

  // KG & Custo Data
  const kgCustoData = useMemo(() => {
    const finOrdens = ordensPeriodo.filter(o => o.status === "finalizado");
    const byBobina = {};
    let totalKG = 0;
    let totalCusto = 0;

    finOrdens.forEach(o => {
      const kg = o.kg_total || o.peso_kg || 0;
      const bob = o.bobina_id ? bobinaMap[o.bobina_id] : null;
      const custoKg = bob?.custo || 0;
      const custo = kg * custoKg;
      totalKG += kg;
      totalCusto += custo;

      const key = o.bobina_id || o.bobina_descricao || "outros";
      if (!byBobina[key]) {
        byBobina[key] = {
          bobina_id: o.bobina_id,
          bobina: bob,
          descricao: o.bobina_descricao || bob?.codigo || "Bobina Telhas",
          kg_total: 0,
          metros_total: 0,
          custo_total: 0,
          ops: [],
        };
      }
      byBobina[key].kg_total += kg;
      byBobina[key].metros_total += calcularMetrosPedido(o);
      byBobina[key].custo_total += custo;
      byBobina[key].ops.push({
        id: o.id,
        maquina: o.maquina,
        produto: o.produto,
        numero_pedido: o.numero_pedido,
        data: o.data_finalizacao || o.data,
        metros: calcularMetrosPedido(o),
        kg,
        custo,
        custoKg,
      });
    });

    const bobinasList = Object.values(byBobina).sort((a, b) => b.kg_total - a.kg_total);
    return { finOrdens, bobinasList, totalKG, totalCusto, custoMedio: totalKG > 0 ? totalCusto / totalKG : 0 };
  }, [ordensPeriodo, bobinaMap]);

  const cfg = HEADER_CFG[type] || HEADER_CFG.ordens;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4 sticky top-0 z-10">
          <SheetHeader className="space-y-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2.5 text-white">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.hex + "20", border: `1px solid ${cfg.hex}40` }}>
                  <cfg.icon className="w-5 h-5" style={{ color: cfg.hex }} />
                </div>
                <div>
                  <span className="block">{cfg.title}</span>
                  <span className="block text-[11px] font-normal text-white/50">{cfg.desc}</span>
                </div>
              </SheetTitle>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: cfg.hex }} />
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            </div>
          ) : (
            <>
              {/* === METROS TYPE === */}
              {type === "metros" && (
                <MetrosContent ordens={ordensPeriodo.filter(o => o.status === "finalizado")} />
              )}

              {/* === KG TYPE === */}
              {type === "kg" && (
                <KgContent data={kgCustoData} />
              )}

              {/* === CUSTO TYPE === */}
              {type === "custo" && (
                <CustoContent data={kgCustoData} />
              )}

              {/* === ORDENS TYPE === */}
              {type === "ordens" && (
                <OrdensContent ordens={ordensPeriodo} />
              )}

              {/* === RETRABALHOS TYPE === */}
              {type === "retrabalhos" && (
                <RetrabalhosContent ordens={ordensPeriodo.filter(o => o.is_retrabalho || o.retrabalho)} />
              )}

              {/* === PAUSADAS TYPE === */}
              {type === "pausadas" && (
                <PausadasContent ordens={ordensPeriodo.filter(o => o.status === "pausado")} />
              )}

              {/* === FINALIZADOS TYPE === */}
              {type === "finalizados" && (
                <MetrosContent ordens={ordensPeriodo.filter(o => o.status === "finalizado")} />
              )}

              {/* === SANDUICHE TYPE === */}
              {type === "sanduiche" && (
                <SanduicheContent ordens={ordensPeriodo.filter(o => /(eps|manta|sanduiche|isopor|termoacustica)/i.test(o.produto || ""))} />
              )}

              {/* === EFICIENCIA TYPE === */}
              {type === "eficiencia" && (
                <EficienciaContent
                  eficiencia={eficiencia}
                  tempoProdTotal={tempoProdTotal}
                  tempoPausaTotal={tempoPausaTotal}
                  tempoSetupTotal={tempoSetupTotal}
                  tempoTotal={tempoTotal}
                  ordens={ordensPeriodo}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Sub-componentes do Sheet de Detalhes
function MetrosContent({ ordens = [] }) {
  const totalM = ordens.reduce((s, o) => s + calcularMetrosPedido(o), 0);
  const totalTelhas = ordens.reduce((s, o) => s + (o.quantidade || o.quantidade_telhas || 1), 0);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalM.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m</p>
          <p className="text-xs text-muted-foreground">Total finalizado no período</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{totalTelhas} telhas</p>
          <p className="text-xs text-muted-foreground">{ordens.length} ordem(ns)</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {ordens.map(o => {
          const m = calcularMetrosPedido(o);
          return (
            <div key={o.id} className="p-3 border rounded-xl bg-card hover:bg-muted/40 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs truncate">{o.produto || "Telha"}</span>
                <span className="font-black text-xs text-blue-600">{m.toFixed(1)} m</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                <span>{o.cliente || "S/ Cliente"} · #{o.numero_pedido || "S/N"}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{o.maquina}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KgContent({ data }) {
  return (
    <div className="space-y-4">
      <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-black text-orange-700 dark:text-orange-300">{data.totalKG.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg</p>
          <p className="text-xs text-muted-foreground">Aço consumido no período</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{data.bobinasList.length} bobina(s)</p>
          <p className="text-xs text-muted-foreground">{data.finOrdens.length} ordem(ns)</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {data.bobinasList.map((b, i) => (
          <div key={i} className="p-3 border rounded-xl bg-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs truncate">{b.descricao}</span>
              <span className="font-black text-xs text-orange-600">{b.kg_total.toFixed(0)} kg</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{b.ops.length} ordem(ns)</span>
              <span>{b.metros_total ? `${b.metros_total.toFixed(1)} m` : ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustoContent({ data }) {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-black text-green-700 dark:text-green-300">{formatBRL(data.totalCusto)}</p>
          <p className="text-xs text-muted-foreground">Custo total de material</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Custo Médio/kg</p>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatBRL(data.custoMedio)}/kg</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {data.bobinasList.map((b, i) => (
          <div key={i} className="p-3 border rounded-xl bg-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs truncate">{b.descricao}</span>
              <span className="font-black text-xs text-green-600">{formatBRL(b.custo_total)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{b.kg_total.toFixed(0)} kg · {b.ops.length} ordem(ns)</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdensContent({ ordens = [] }) {
  return (
    <div className="space-y-2 max-h-[65vh] overflow-y-auto">
      {ordens.map(o => {
        const cfg = STATUS_CFG[o.status] || STATUS_CFG.pendente;
        return (
          <div key={o.id} className="p-3 border rounded-xl bg-card space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs truncate">{o.produto || "Telha"}</span>
              <Badge className={`text-[10px] ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{o.cliente || "S/ Cliente"} · #{o.numero_pedido || "S/N"}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{o.maquina}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RetrabalhosContent({ ordens = [] }) {
  if (ordens.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">Nenhum retrabalho registrado no período.</p>;
  }
  return (
    <div className="space-y-2 max-h-[65vh] overflow-y-auto">
      {ordens.map(o => (
        <div key={o.id} className="p-3 border border-red-200 bg-red-50/30 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-red-700 truncate">{o.produto}</span>
            <Badge className="bg-red-100 text-red-700 text-[10px]">Retrabalho</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{o.cliente} · #{o.numero_pedido} · {o.maquina}</p>
        </div>
      ))}
    </div>
  );
}

function PausadasContent({ ordens = [] }) {
  if (ordens.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">Nenhuma ordem pausada no momento.</p>;
  }
  return (
    <div className="space-y-2 max-h-[65vh] overflow-y-auto">
      {ordens.map(o => (
        <div key={o.id} className="p-3 border border-purple-200 bg-purple-50/40 rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs truncate">{o.maquina}</span>
            <Badge className="bg-purple-100 text-purple-700 text-[10px]">Pausado</Badge>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">{o.produto} · {o.quantidade} telhas</p>
          {o.observacoes && <p className="text-[11px] text-muted-foreground italic">"{o.observacoes}"</p>}
        </div>
      ))}
    </div>
  );
}

function SanduicheContent({ ordens = [] }) {
  const totalM = ordens.reduce((s, o) => s + calcularMetrosPedido(o), 0);
  return (
    <div className="space-y-4">
      <div className="bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-900/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-black text-cyan-700 dark:text-cyan-300">{totalM.toFixed(1)} m</p>
          <p className="text-xs text-muted-foreground">Volume Termoacústico no período</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{ordens.length} ordem(ns)</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {ordens.map(o => (
          <div key={o.id} className="p-3 border rounded-xl bg-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs truncate">{o.produto}</span>
              <span className="font-black text-xs text-cyan-600">{calcularMetrosPedido(o).toFixed(1)} m</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{o.cliente} · #{o.numero_pedido} · {o.maquina}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EficienciaContent({ eficiencia, tempoProdTotal, tempoPausaTotal, tempoSetupTotal, tempoTotal }) {
  return (
    <div className="space-y-4">
      <div className="text-center p-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-xl">
        <p className="text-4xl font-black text-amber-600">{eficiencia}%</p>
        <p className="text-xs text-muted-foreground mt-1">Eficiência Geral das Perfiladeiras</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg border bg-green-50 text-center">
          <p className="font-black text-sm text-green-700">{formatTempo(tempoProdTotal)}</p>
          <p className="text-[10px] text-muted-foreground">Produção</p>
        </div>
        <div className="p-3 rounded-lg border bg-amber-50 text-center">
          <p className="font-black text-sm text-amber-700">{formatTempo(tempoPausaTotal)}</p>
          <p className="text-[10px] text-muted-foreground">Pausa</p>
        </div>
        <div className="p-3 rounded-lg border bg-purple-50 text-center">
          <p className="font-black text-sm text-purple-700">{formatTempo(tempoSetupTotal)}</p>
          <p className="text-[10px] text-muted-foreground">Setup</p>
        </div>
      </div>
    </div>
  );
}
