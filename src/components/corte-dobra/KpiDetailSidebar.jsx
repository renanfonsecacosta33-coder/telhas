import React, { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Weight, Boxes, DollarSign, RefreshCw, Pause, CheckCircle2,
  Layers, Clock, Zap, Wrench, Activity, X, Loader2, Factory,
  TrendingUp, AlertCircle, FileText, ChevronRight, Circle,
  ShoppingBag, Calendar, TrendingDown
} from "lucide-react";

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
  aguardando_corte: { label: "Aguard. Corte", color: "text-orange-600", bg: "bg-orange-100 border-orange-200" },
  em_producao: { label: "Em Produção", color: "text-amber-600", bg: "bg-amber-100 border-amber-200" },
  pausado: { label: "Pausado", color: "text-purple-600", bg: "bg-purple-100 border-purple-200" },
  finalizado: { label: "Finalizado", color: "text-green-600", bg: "bg-green-100 border-green-200" },
  cancelado: { label: "Cancelado", color: "text-red-600", bg: "bg-red-100 border-red-200" },
};

const HEADER_CFG = {
  kg: { title: "KG no Período", desc: "Bobinas utilizadas, OPs e custos de material", icon: Weight, hex: "#ea580c" },
  custo: { title: "Custo de Produção", desc: "Custo de material por bobina e por OP", icon: DollarSign, hex: "#16a34a" },
  ordens: { title: "Ordens no Período", desc: "Todas as ordens de produção do período", icon: Layers, hex: "#475569" },
  retrabalhos: { title: "Retrabalhos", desc: "Ordens de retrabalho do período", icon: RefreshCw, hex: "#ef4444" },
  pausadas: { title: "Pausadas Agora", desc: "Ordens pausadas no momento", icon: Pause, hex: "#a855f7" },
  pecas: { title: "Peças no Período", desc: "Peças finalizadas no período", icon: CheckCircle2, hex: "#16a34a" },
  finalizados: { title: "Finalizados no Período", desc: "Ordens finalizadas no período", icon: TrendingUp, hex: "#2563eb" },
  eficiencia: { title: "Eficiência", desc: "Distribuição de tempo produtivo", icon: Activity, hex: "#f59e0b" },
};

export default function KpiDetailSidebar({ open, onClose, type, ordensPeriodo, bobinasAtivas, filialAtiva, eficiencia, tempoProdTotal, tempoPausaTotal, tempoSetupTotal, tempoTotal }) {
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
      const bobs = await base44.entities.Bobina.filter({ setor: "corte_dobra", unidade: filialAtiva }, "-created_date", 500);
      setAllBobinas(bobs);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const bobinaMap = useMemo(() => {
    const map = {};
    [...bobinasAtivas, ...allBobinas].forEach(b => {
      if (!map[b.id]) map[b.id] = b;
    });
    return map;
  }, [bobinasAtivas, allBobinas]);

  // === KG & CUSTO DATA ===
  const kgCustoData = useMemo(() => {
    const finOrdens = ordensPeriodo.filter(o => o.status === "finalizado" && o.bobina_id);
    const byBobina = {};
    let totalKG = 0;
    let totalCusto = 0;

    finOrdens.forEach(o => {
      const kg = o.peso_kg || o.kg_estimado || 0;
      const bob = bobinaMap[o.bobina_id];
      const custoKg = bob?.custo || 0;
      const custo = kg * custoKg;
      totalKG += kg;
      totalCusto += custo;

      if (!byBobina[o.bobina_id]) {
        byBobina[o.bobina_id] = {
          bobina_id: o.bobina_id,
          bobina: bob,
          descricao: o.bobina_descricao || bob?.codigo || "—",
          kg_total: 0,
          custo_total: 0,
          ops: [],
        };
      }
      byBobina[o.bobina_id].kg_total += kg;
      byBobina[o.bobina_id].custo_total += custo;
      byBobina[o.bobina_id].ops.push({
        id: o.id,
        maquina: o.maquina,
        tipo_peca: o.tipo_peca || o.bobina_descricao,
        numero_pedido: o.numero_pedido,
        data: o.data,
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
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all">
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
                <RetrabalhosContent ordens={ordensPeriodo.filter(o => o.is_retrabalho)} />
              )}

              {/* === PAUSADAS TYPE === */}
              {type === "pausadas" && (
                <PausadasContent ordens={ordensPeriodo.filter(o => o.status === "pausado")} />
              )}

              {/* === PEÇAS TYPE === */}
              {type === "pecas" && (
                <PecasContent ordens={ordensPeriodo.filter(o => o.status === "finalizado")} />
              )}

              {/* === FINALIZADOS TYPE === */}
              {type === "finalizados" && (
                <FinalizadosContent ordens={ordensPeriodo.filter(o => o.status === "finalizado")} />
              )}

              {/* === EFICIÊNCIA TYPE === */}
              {type === "eficiencia" && (
                <EficienciaContent
                  eficiencia={eficiencia}
                  tempoProdTotal={tempoProdTotal}
                  tempoPausaTotal={tempoPausaTotal}
                  tempoSetupTotal={tempoSetupTotal}
                  tempoTotal={tempoTotal}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// === SUB-COMPONENTS ===

function SummaryCard({ items }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((it, i) => (
        <div key={i} className={`rounded-xl border p-3 ${it.bg || "bg-card border-border"}`}>
          <div className="flex items-center gap-1.5 mb-1">
            {it.icon && <it.icon className={`w-3.5 h-3.5 ${it.color}`} />}
            <span className="text-[10px] text-muted-foreground font-medium">{it.label}</span>
          </div>
          <p className={`text-xl font-black ${it.color}`}>{it.value}</p>
          {it.sub && <p className="text-[10px] text-muted-foreground">{it.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function KgContent({ data }) {
  const { bobinasList, totalKG, totalCusto, custoMedio } = data;
  return (
    <>
      <SummaryCard items={[
        { label: "KG Total", value: `${totalKG.toFixed(1)}kg`, icon: Weight, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
        { label: "Custo Material", value: formatBRL(totalCusto), icon: DollarSign, color: "text-green-600", bg: "bg-green-50 border-green-200" },
        { label: "Bobinas Usadas", value: bobinasList.length, icon: Factory, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
        { label: "Custo Médio/kg", value: formatBRL(custoMedio), icon: TrendingDown, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
      ]} />

      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <Factory className="w-4 h-4 text-orange-500" /> Bobinas Utilizadas
        </h3>
        <div className="space-y-2">
          {bobinasList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhuma bobina utilizada no período</p>
          ) : bobinasList.map(b => (
            <div key={b.bobina_id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-orange-600 text-sm">{b.bobina?.codigo || "—"}</span>
                  {b.bobina?.cor && <span className="text-xs text-blue-600 truncate">{b.bobina.cor}</span>}
                  {b.bobina?.chapa && <span className="text-xs text-muted-foreground">{b.bobina.chapa}mm</span>}
                </div>
                <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">{b.ops.length} OP{b.ops.length > 1 ? "s" : ""}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 font-semibold text-emerald-600">
                  <Weight className="w-3 h-3" />{b.kg_total.toFixed(1)}kg
                </span>
                {b.bobina?.custo > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {formatBRL(b.bobina.custo)}/kg
                  </span>
                )}
                <span className="flex items-center gap-1 font-bold text-green-600 ml-auto">
                  <DollarSign className="w-3 h-3" />{formatBRL(b.custo_total)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" /> Ordens Finalizadas
        </h3>
        <div className="space-y-1.5">
          {data.finOrdens.map(o => (
            <div key={o.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
              {o.numero_pedido && <span className="font-mono font-bold text-blue-600">#{o.numero_pedido}</span>}
              <span className="font-medium truncate flex-1">{o.tipo_peca || o.bobina_descricao || "—"}</span>
              <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{o.maquina}</Badge>
              <span className="font-semibold text-emerald-600">{(o.peso_kg || o.kg_estimado || 0).toFixed(1)}kg</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CustoContent({ data }) {
  const { bobinasList, totalKG, totalCusto, custoMedio } = data;
  return (
    <>
      <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-5 h-5 text-green-600" />
          <span className="text-sm font-bold text-green-800">Custo Total de Material</span>
        </div>
        <p className="text-3xl font-black text-green-600">{formatBRL(totalCusto)}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-green-700">
          <span>{totalKG.toFixed(1)}kg produzidos</span>
          <span>·</span>
          <span>{formatBRL(custoMedio)}/kg médio</span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <Factory className="w-4 h-4 text-green-500" /> Custo por Bobina
        </h3>
        <div className="space-y-2">
          {bobinasList.map(b => (
            <div key={b.bobina_id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-orange-600 text-sm">{b.bobina?.codigo || "—"}</span>
                  {b.bobina?.qualidade && <Badge variant="outline" className="text-[9px]">{b.bobina.qualidade}</Badge>}
                </div>
                <span className="font-bold text-green-600">{formatBRL(b.custo_total)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Weight className="w-3 h-3" />{b.kg_total.toFixed(1)}kg</span>
                <span>× {formatBRL(b.bobina?.custo || 0)}/kg</span>
                <span className="ml-auto">{b.ops.length} OP{b.ops.length > 1 ? "s" : ""}</span>
              </div>
              {/* Cost bar */}
              {totalCusto > 0 && (
                <div className="mt-2 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${(b.custo_total / totalCusto) * 100}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" /> Custo por OP
        </h3>
        <div className="space-y-1.5">
          {data.finOrdens.map(o => {
            const custo = (o.peso_kg || o.kg_estimado || 0) * getBobinaCusto(o, data);
            return (
              <div key={o.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                {o.numero_pedido && <span className="font-mono font-bold text-blue-600">#{o.numero_pedido}</span>}
                <span className="font-medium truncate flex-1">{o.tipo_peca || o.bobina_descricao || "—"}</span>
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{o.maquina}</Badge>
                <span className="font-semibold text-emerald-600">{(o.peso_kg || o.kg_estimado || 0).toFixed(1)}kg</span>
                <span className="font-bold text-green-600">{formatBRL(custo)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function getBobinaCusto(o, data) {
  const b = data.bobinasList.find(bl => bl.bobina_id === o.bobina_id);
  return b?.bobina?.custo || 0;
}

function OrdensContent({ ordens }) {
  return (
    <>
      <SummaryCard items={[
        { label: "Total", value: ordens.length, icon: Layers, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
        { label: "Finalizadas", value: ordens.filter(o => o.status === "finalizado").length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
        { label: "Em Produção", value: ordens.filter(o => o.status === "em_producao").length, icon: Zap, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
        { label: "Pendentes", value: ordens.filter(o => o.status === "pendente" || o.status === "aguardando_corte").length, icon: Clock, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
      ]} />
      <div className="space-y-1.5">
        {ordens.map(o => {
          const st = STATUS_CFG[o.status] || STATUS_CFG.pendente;
          return (
            <div key={o.id} className={`rounded-lg border px-3 py-2.5 ${st.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  {o.numero_pedido && <span className="font-mono font-bold text-blue-600 text-xs">#{o.numero_pedido}</span>}
                  <Badge className="bg-white/70 text-slate-600 border-slate-200 text-[10px]">{o.maquina}</Badge>
                </div>
                <Badge className={`border text-[10px] ${st.bg} ${st.color}`}>{st.label}</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground truncate">{o.tipo_peca || o.bobina_descricao || "—"}</span>
                {o.quantidade > 0 && <span className="font-semibold">{o.quantidade} pç</span>}
                {(o.peso_kg || o.kg_estimado) > 0 && <span className="text-emerald-600">{(o.peso_kg || o.kg_estimado).toFixed(1)}kg</span>}
                {o.data && <span className="ml-auto">{format(new Date(o.data + "T12:00:00"), "dd/MM", { locale: ptBR })}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function RetrabalhosContent({ ordens }) {
  return (
    <>
      <SummaryCard items={[
        { label: "Total", value: ordens.length, icon: RefreshCw, color: "text-red-600", bg: "bg-red-50 border-red-200" },
        { label: "Peças", value: ordens.reduce((s, o) => s + (o.retrabalho_quantidade || o.quantidade || 0), 0), icon: Boxes, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
        { label: "KG", value: `${ordens.reduce((s, o) => s + (o.peso_kg || o.kg_estimado || 0), 0).toFixed(1)}kg`, icon: Weight, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
      ]} />
      <div className="space-y-2">
        {ordens.map(rt => {
          const etapaCor = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-pink-500"][Math.min((rt.retrabalho_etapa || 1) - 1, 4)];
          return (
            <div key={rt.id} className="rounded-xl border border-red-200 bg-red-50/30 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${etapaCor}`}>E{rt.retrabalho_etapa || 1}</span>
                {rt.numero_pedido && <span className="font-mono font-bold text-blue-600 text-xs">#{rt.numero_pedido}</span>}
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{rt.maquina}</Badge>
              </div>
              <p className="text-xs font-medium text-foreground mb-0.5">{rt.tipo_peca || rt.bobina_descricao || "—"}</p>
              {rt.retrabalho_motivo && <p className="text-xs text-red-600/80 mb-1">⚠ {rt.retrabalho_motivo}</p>}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{rt.retrabalho_quantidade || rt.quantidade || 0} pç</span>
                {(rt.peso_kg || rt.kg_estimado) > 0 && <span className="text-emerald-600">{(rt.peso_kg || rt.kg_estimado).toFixed(1)}kg</span>}
                {rt.cliente && <span className="truncate">{rt.cliente}</span>}
                {rt.data && <span className="ml-auto">{format(new Date(rt.data + "T12:00:00"), "dd/MM", { locale: ptBR })}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PausadasContent({ ordens }) {
  return (
    <>
      <SummaryCard items={[
        { label: "Pausadas", value: ordens.length, icon: Pause, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
        { label: "Tempo Pausa", value: formatTempo(ordens.reduce((s, o) => s + (o.tempo_pausa_seg || 0), 0)), icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
      ]} />
      <div className="space-y-2">
        {ordens.map(o => (
          <div key={o.id} className="rounded-xl border border-purple-200 bg-purple-50/30 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {o.numero_pedido && <span className="font-mono font-bold text-blue-600 text-xs">#{o.numero_pedido}</span>}
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{o.maquina}</Badge>
              </div>
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
                <Pause className="w-2.5 h-2.5 mr-0.5" /> Pausado
              </Badge>
            </div>
            <p className="text-xs font-medium text-foreground mb-0.5">{o.tipo_peca || o.bobina_descricao || "—"}</p>
            {o.motivo_pausa && <p className="text-xs text-purple-600 mb-1">⏸ {o.motivo_pausa === "setup" ? "Setup" : o.motivo_pausa}</p>}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {o.quantidade > 0 && <span className="font-semibold text-foreground">{o.quantidade} pç</span>}
              {o.tempo_pausa_seg > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTempo(o.tempo_pausa_seg)}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PecasContent({ ordens }) {
  const totalPecas = ordens.reduce((s, o) => s + (o.quantidade || 0), 0);
  return (
    <>
      <SummaryCard items={[
        { label: "Peças Total", value: totalPecas, icon: Boxes, color: "text-green-600", bg: "bg-green-50 border-green-200" },
        { label: "Ordens", value: ordens.length, icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
      ]} />
      <div className="space-y-1.5">
        {ordens.map(o => (
          <div key={o.id} className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/30 px-3 py-2 text-xs">
            {o.numero_pedido && <span className="font-mono font-bold text-blue-600">#{o.numero_pedido}</span>}
            <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{o.maquina}</Badge>
            <span className="font-medium truncate flex-1">{o.tipo_peca || o.bobina_descricao || "—"}</span>
            <span className="font-bold text-green-600">{o.quantidade} pç</span>
            {o.data && <span className="text-muted-foreground">{format(new Date(o.data + "T12:00:00"), "dd/MM", { locale: ptBR })}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

function FinalizadosContent({ ordens }) {
  return (
    <>
      <SummaryCard items={[
        { label: "Finalizadas", value: ordens.length, icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
        { label: "Peças", value: ordens.reduce((s, o) => s + (o.quantidade || 0), 0), icon: Boxes, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
        { label: "KG", value: `${ordens.reduce((s, o) => s + (o.peso_kg || o.kg_estimado || 0), 0).toFixed(0)}kg`, icon: Weight, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
      ]} />
      <div className="space-y-1.5">
        {ordens.map(o => (
          <div key={o.id} className="rounded-lg border border-green-200 bg-green-50/30 px-3 py-2 text-xs">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                {o.numero_pedido && <span className="font-mono font-bold text-blue-600">#{o.numero_pedido}</span>}
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{o.maquina}</Badge>
              </div>
              <span className="text-green-600 font-medium">{o.data_finalizacao ? format(new Date(o.data_finalizacao + "T12:00:00"), "dd/MM", { locale: ptBR }) : ""}</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="font-medium text-foreground truncate">{o.tipo_peca || o.bobina_descricao || "—"}</span>
              {o.quantidade > 0 && <span className="font-semibold text-foreground">{o.quantidade} pç</span>}
              {(o.peso_kg || o.kg_estimado) > 0 && <span className="text-emerald-600">{(o.peso_kg || o.kg_estimado).toFixed(1)}kg</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function EficienciaContent({ eficiencia, tempoProdTotal, tempoPausaTotal, tempoSetupTotal, tempoTotal }) {
  const items = [
    { label: "Produção", val: tempoProdTotal, color: "text-green-600", bg: "bg-green-50 border-green-200", bar: "bg-green-500", icon: Zap },
    { label: "Pausa", val: tempoPausaTotal, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", bar: "bg-amber-500", icon: Pause },
    { label: "Setup", val: tempoSetupTotal, color: "text-purple-600", bg: "bg-purple-50 border-purple-200", bar: "bg-purple-500", icon: Wrench },
  ];
  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-center">
        <p className="text-sm font-bold text-amber-800 mb-1">Eficiência Geral</p>
        <p className={`text-5xl font-black ${eficiencia >= 70 ? "text-green-600" : eficiencia >= 50 ? "text-amber-600" : "text-red-600"}`}>{eficiencia}%</p>
        <p className="text-xs text-muted-foreground mt-1">Tempo produtivo / tempo total</p>
      </div>

      <div className="space-y-2">
        {items.map(t => {
          const pct = tempoTotal > 0 ? Math.round((t.val / tempoTotal) * 100) : 0;
          return (
            <div key={t.label} className={`rounded-xl p-3 border ${t.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <t.icon className={`w-4 h-4 ${t.color}`} />
                  <span className="text-sm font-bold">{t.label}</span>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${t.color}`}>{formatTempo(t.val)}</p>
                  <p className="text-[10px] text-muted-foreground">{pct}%</p>
                </div>
              </div>
              <div className="bg-white/70 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">Tempo Total Acumulado</p>
        <p className="text-2xl font-black text-foreground">{formatTempo(tempoTotal)}</p>
      </div>
    </>
  );
}