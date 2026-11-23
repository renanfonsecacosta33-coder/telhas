import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Weight, DollarSign, RefreshCw, Pause, CheckCircle2,
  Layers, Clock, Zap, Activity, X, Loader2, Factory,
  TrendingUp, Snowflake, Ruler, Calendar, ChevronRight,
  ExternalLink, History, Search, Pencil, ArrowUpDown
} from "lucide-react";
import { calcularMetrosPedido, calcularKgPedido } from "@/lib/metrosHelper";
import { calcularCustoOrdem, formatarMoeda } from "@/lib/custoPedidoHelper";
import HistoricoPedidoTelhasSidebar from "@/components/producao/HistoricoPedidoTelhasSidebar";
import RaioXCustoPedidoModal from "@/components/telhas/RaioXCustoPedidoModal";

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
  eficiencia, tempoProdTotal, tempoPausaTotal, tempoSetupTotal, tempoTotal,
  onEditarOrdem, onAjustarMetragens
}) {
  const navigate = useNavigate();
  const [allBobinas, setAllBobinas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historicoPedido, setHistoricoPedido] = useState(null);
  const [ordemRaioX, setOrdemRaioX] = useState(null);

  useEffect(() => {
    if (open) {
      fetchBobinas();
    }
  }, [open]);

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

  const handleIrAtePedido = (o) => {
    const num = o.numero_pedido || o.pedido_numero || o.id;
    const dia = o.data_finalizacao || o.data || "";
    toast.info(`Localizando pedido #${num} na produção...`);
    
    // 1. Fecha o sheet
    if (onClose) onClose();

    // 2. Garante que os estilos do body sejam restaurados
    document.body.style.pointerEvents = "";
    document.body.removeAttribute("data-scroll-locked");

    // 3. Aguarda o ciclo de animação do Radix antes de trocar de rota
    setTimeout(() => {
      document.body.style.pointerEvents = "";
      document.body.removeAttribute("data-scroll-locked");
      navigate(`/producao?busca=${encodeURIComponent(num)}&dia=${encodeURIComponent(dia)}`);
    }, 100);
  };

  const handleEditar = (o) => {
    const raw = o.rawObj || o;
    if (onClose) onClose();
    document.body.style.pointerEvents = "";
    document.body.removeAttribute("data-scroll-locked");
    if (onEditarOrdem) {
      setTimeout(() => {
        onEditarOrdem(raw);
      }, 80);
    } else {
      handleIrAtePedido(raw);
    }
  };

  const handleAbrirHistorico = (o) => {
    setHistoricoPedido({
      numero: o.numero_pedido || o.id,
      obj: o,
    });
  };

  const bobinaMap = useMemo(() => {
    const map = {};
    [...bobinasAtivas, ...allBobinas].forEach(b => {
      if (b && b.id) map[b.id] = b;
    });
    return map;
  }, [bobinasAtivas, allBobinas]);

  // KG & Custo Data consolidado por ordem e por bobina
  const kgCustoData = useMemo(() => {
    const finOrdens = ordensPeriodo.filter(o => o.status === "finalizado");
    const byBobina = {};
    let totalKG = 0;
    let totalCusto = 0;
    let totalMetros = 0;

    finOrdens.forEach(o => {
      const custoInfo = calcularCustoOrdem(o, bobinaMap);
      totalKG += custoInfo.kgAco;
      totalCusto += custoInfo.custoTotal;
      totalMetros += custoInfo.metros;

      const key = o.bobina_id || o.bobina_superior_id || o.bobina_descricao || custoInfo.bobinaCodigo || "outros";
      if (!byBobina[key]) {
        byBobina[key] = {
          bobina_id: o.bobina_id || o.bobina_superior_id,
          bobina: o.bobina_id ? bobinaMap[o.bobina_id] : (o.bobina_superior_id ? bobinaMap[o.bobina_superior_id] : null),
          descricao: o.bobina_descricao || custoInfo.bobinaCodigo || "Bobina Telhas",
          kg_total: 0,
          metros_total: 0,
          custo_total: 0,
          ops: [],
        };
      }
      byBobina[key].kg_total += custoInfo.kgAco;
      byBobina[key].metros_total += custoInfo.metros;
      byBobina[key].custo_total += custoInfo.custoTotal;
      byBobina[key].ops.push({
        id: o.id,
        maquina: o.maquina,
        produto: o.produto,
        cliente: o.cliente,
        numero_pedido: o.numero_pedido,
        data: o.data_finalizacao || o.data,
        metros: custoInfo.metros,
        kg: custoInfo.kgAco,
        custo: custoInfo.custoTotal,
        custoKg: custoInfo.custoKgAco,
        custoInfo,
        rawObj: o,
      });
    });

    const bobinasList = Object.values(byBobina).sort((a, b) => b.kg_total - a.kg_total);
    return {
      finOrdens,
      bobinasList,
      totalKG,
      totalMetros,
      totalCusto,
      custoMedio: totalKG > 0 ? totalCusto / totalKG : 0,
      custoMedioMetro: totalMetros > 0 ? totalCusto / totalMetros : 0,
      bobinaMap,
    };
  }, [ordensPeriodo, bobinaMap]);

  const cfg = HEADER_CFG[type] || HEADER_CFG.ordens;

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          {/* Header */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4 sticky top-0 z-10 border-b border-white/10">
            <SheetHeader className="space-y-0">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2.5 text-white">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.hex + "20", border: `1px solid ${cfg.hex}40` }}>
                    <cfg.icon className="w-5 h-5" style={{ color: cfg.hex }} />
                  </div>
                  <div>
                    <span className="block text-base font-bold">{cfg.title}</span>
                    <span className="block text-[11px] font-normal text-white/60">{cfg.desc}</span>
                  </div>
                </SheetTitle>
                <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </SheetHeader>

            <div className="mt-3 flex items-center justify-between text-[11px] text-white/70 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              <span>👉 Clique em qualquer pedido para <strong>Editar valores</strong> ou ir à Produção</span>
              <span className="font-semibold text-blue-300">#{ordensPeriodo.length} ordens</span>
            </div>
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
                  <>
                    {onAjustarMetragens && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="text-xs text-blue-300 font-semibold">
                            Metragens com valores errados ou muito altos?
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={onAjustarMetragens}
                          className="h-7 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shrink-0 shadow-xs"
                        >
                          Ajustar Maiores Valores
                        </Button>
                      </div>
                    )}
                    <MetrosContent
                      ordens={ordensPeriodo.filter(o => o.status === "finalizado")}
                      bobinaMap={bobinaMap}
                      onGoToPedido={handleIrAtePedido}
                      onEditarOrdem={handleEditar}
                      onOpenHistorico={handleAbrirHistorico}
                      onAbrirRaioX={(o) => setOrdemRaioX(o)}
                    />
                  </>
                )}

                {/* === KG TYPE === */}
                {type === "kg" && (
                  <KgContent
                    data={kgCustoData}
                    onGoToPedido={handleIrAtePedido}
                    onEditarOrdem={handleEditar}
                    onOpenHistorico={handleAbrirHistorico}
                  />
                )}

                {/* === CUSTO TYPE === */}
                {type === "custo" && (
                  <CustoContent
                    data={kgCustoData}
                    onGoToPedido={handleIrAtePedido}
                    onEditarOrdem={handleEditar}
                    onOpenHistorico={handleAbrirHistorico}
                    onAbrirRaioX={(o) => setOrdemRaioX(o)}
                  />
                )}

                {/* === ORDENS TYPE === */}
                {type === "ordens" && (
                  <OrdensContent
                    ordens={ordensPeriodo}
                    onGoToPedido={handleIrAtePedido}
                    onEditarOrdem={handleEditar}
                    onOpenHistorico={handleAbrirHistorico}
                  />
                )}

                {/* === RETRABALHOS TYPE === */}
                {type === "retrabalhos" && (
                  <RetrabalhosContent
                    ordens={ordensPeriodo.filter(o => o.is_retrabalho || o.retrabalho)}
                    onGoToPedido={handleIrAtePedido}
                    onEditarOrdem={handleEditar}
                    onOpenHistorico={handleAbrirHistorico}
                  />
                )}

                {/* === PAUSADAS TYPE === */}
                {type === "pausadas" && (
                  <PausadasContent
                    ordens={ordensPeriodo.filter(o => o.status === "pausado")}
                    onGoToPedido={handleIrAtePedido}
                    onEditarOrdem={handleEditar}
                    onOpenHistorico={handleAbrirHistorico}
                  />
                )}

                {/* === FINALIZADOS TYPE === */}
                {type === "finalizados" && (
                  <MetrosContent
                    ordens={ordensPeriodo.filter(o => o.status === "finalizado")}
                    bobinaMap={bobinaMap}
                    onGoToPedido={handleIrAtePedido}
                    onEditarOrdem={handleEditar}
                    onOpenHistorico={handleAbrirHistorico}
                    onAbrirRaioX={(o) => setOrdemRaioX(o)}
                  />
                )}

                {/* === SANDUICHE TYPE === */}
                {type === "sanduiche" && (
                  <SanduicheContent
                    ordens={ordensPeriodo.filter(o => /(eps|manta|sanduiche|isopor|termoacustica)/i.test(o.produto || ""))}
                    onGoToPedido={handleIrAtePedido}
                    onEditarOrdem={handleEditar}
                    onOpenHistorico={handleAbrirHistorico}
                  />
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
                    onGoToPedido={handleIrAtePedido}
                    onEditarOrdem={handleEditar}
                  />
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Sidebar de Histórico Completo do Pedido */}
      {historicoPedido && (
        <HistoricoPedidoTelhasSidebar
          open={!!historicoPedido}
          onClose={() => setHistoricoPedido(null)}
          pedidoNumero={historicoPedido.numero}
          pedidoObj={historicoPedido.obj}
        />
      )}

      {/* Modal de Raio-X Completo de Custo Industrial & Rentabilidade */}
      {ordemRaioX && (
        <RaioXCustoPedidoModal
          open={Boolean(ordemRaioX)}
          onOpenChange={(v) => !v && setOrdemRaioX(null)}
          ordem={ordemRaioX}
          bobinaMap={bobinaMap}
          onAtualizado={() => {
            fetchBobinas();
          }}
        />
      )}
    </>
  );
}

// Card de Ordem Clicável Reutilizável com Custo Industrial
function OrdemItemCard({ ordem, metros, bobinaMap = {}, onGoToPedido, onEditarOrdem, onOpenHistorico, onAbrirRaioX, badgeText, badgeColor }) {
  const m = metros != null ? metros : calcularMetrosPedido(ordem);
  const custo = calcularCustoOrdem(ordem, bobinaMap);

  const handleClickCard = () => {
    if (onAbrirRaioX) {
      onAbrirRaioX(ordem);
    } else if (onEditarOrdem) {
      onEditarOrdem(ordem);
    } else if (onGoToPedido) {
      onGoToPedido(ordem);
    }
  };

  return (
    <div
      onClick={handleClickCard}
      className="p-3 border border-border/80 hover:border-blue-500 rounded-xl bg-card hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all cursor-pointer shadow-2xs hover:shadow-sm group relative"
      title="Clique para ver o Raio-X de Custo ou editar valores"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-xs truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {ordem.produto || "Telha"}
          </span>
          {badgeText && (
            <Badge className={`text-[10px] py-0 px-1.5 ${badgeColor || "bg-blue-100 text-blue-700"}`}>
              {badgeText}
            </Badge>
          )}
          {custo.isTermoacustica && (
            <span className="text-[9px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800">
              EPS + Cola
            </span>
          )}
        </div>
        <div
          onClick={(e) => {
            if (onAbrirRaioX) {
              e.stopPropagation();
              onAbrirRaioX(ordem);
            }
          }}
          className="flex items-center gap-2 shrink-0 hover:scale-105 transition-transform"
          title="Clique para abrir o Raio-X de Custos completo"
        >
          <div className="text-right">
            <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 block">
              {formatarMoeda(custo.custoTotal)}
            </span>
            <span className="text-[10px] text-muted-foreground block font-medium">
              {m > 0 ? `${m.toFixed(1)}m · ${formatarMoeda(custo.custoPorMetro)}/m` : `${custo.kgAco.toFixed(0)} kg`}
            </span>
          </div>
          <div className="w-5 h-5 rounded-md bg-muted/60 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center transition-colors">
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 gap-2">
        <span className="truncate">
          {ordem.cliente || "S/ Cliente"} ·{" "}
          <strong className="text-foreground group-hover:text-blue-600 font-mono">
            #{ordem.numero_pedido || "S/N"}
          </strong>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {custo.bobinaCodigo && (
            <span className="text-[10px] text-slate-500 font-mono bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-[130px]" title={`Bobina: ${custo.bobinaCodigo}`}>
              {custo.bobinaCodigo}
            </span>
          )}
          <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0 bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">
            {ordem.maquina}
          </span>
        </div>
      </div>

      {/* Barra de ações rápida com hover */}
      <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          {onAbrirRaioX && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAbrirRaioX(ordem);
              }}
              className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
              title="Abrir Raio-X completo de custos deste pedido"
            >
              <Calculator className="w-3 h-3" /> Raio-X
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onEditarOrdem) onEditarOrdem(ordem);
              else onGoToPedido(ordem);
            }}
            className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 hover:underline cursor-pointer"
            title="Editar valores e dados do pedido"
          >
            <Pencil className="w-3 h-3" /> Editar
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onGoToPedido(ordem);
            }}
            className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 hover:underline cursor-pointer"
            title="Ver pedido na tela de Produção"
          >
            <ExternalLink className="w-3 h-3" /> Produção
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">
            Aço: {custo.kgAco.toFixed(0)}kg @ {formatarMoeda(custo.custoKgAco)}/kg
          </span>
          {onOpenHistorico && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenHistorico(ordem);
              }}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted font-medium transition-colors cursor-pointer"
              title="Ver histórico e rastreabilidade"
            >
              <History className="w-3 h-3" /> Histórico
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-componentes do Sheet de Detalhes
function MetrosContent({ ordens = [], bobinaMap = {}, onGoToPedido, onEditarOrdem, onOpenHistorico, onAbrirRaioX }) {
  const totalM = ordens.reduce((s, o) => s + calcularMetrosPedido(o), 0);
  const totalTelhas = ordens.reduce((s, o) => s + (o.quantidade || o.quantidade_telhas || 1), 0);
  const totalCusto = ordens.reduce((s, o) => s + calcularCustoOrdem(o, bobinaMap).custoTotal, 0);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalM.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total finalizado no período</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {Math.round(totalTelhas).toLocaleString("pt-BR")} telhas
          </p>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatarMoeda(totalCusto)} ({formatarMoeda(totalM > 0 ? totalCusto / totalM : 0)}/m)
          </p>
          <p className="text-[10px] text-muted-foreground">{ordens.length} ordem(ns)</p>
        </div>
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {ordens.map(o => (
          <OrdemItemCard
            key={o.id}
            ordem={o}
            bobinaMap={bobinaMap}
            onGoToPedido={onGoToPedido}
            onEditarOrdem={onEditarOrdem}
            onOpenHistorico={onOpenHistorico}
            onAbrirRaioX={onAbrirRaioX}
          />
        ))}
      </div>
    </div>
  );
}

function KgContent({ data, onGoToPedido, onEditarOrdem, onOpenHistorico }) {
  return (
    <div className="space-y-4">
      <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-black text-orange-700 dark:text-orange-300">{data.totalKG.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg</p>
          <p className="text-xs text-muted-foreground">Aço consumido no período (real ou teórico)</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{data.bobinasList.length} bobina(s)</p>
          <p className="text-xs text-muted-foreground">{data.finOrdens.length} ordem(ns)</p>
        </div>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {data.bobinasList.map((b, i) => (
          <div key={i} className="p-3 border rounded-xl bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs truncate">{b.descricao}</span>
              <span className="font-black text-xs text-orange-600">{b.kg_total.toFixed(0)} kg</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{b.ops.length} ordem(ns)</span>
              <span>{b.metros_total ? `${b.metros_total.toFixed(1)} m` : ""}</span>
            </div>

            {/* Lista de OPs clicáveis desta bobina */}
            {b.ops.length > 0 && (
              <div className="pt-2 border-t border-border/50 space-y-1.5">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                  Ordens produzidas com esta bobina (clique para editar):
                </span>
                {b.ops.map((op) => (
                  <div
                    key={op.id}
                    onClick={() => {
                      const raw = op.rawObj || op;
                      if (onEditarOrdem) onEditarOrdem(raw);
                      else onGoToPedido(raw);
                    }}
                    className="p-2 rounded-lg bg-muted/40 hover:bg-orange-500/10 hover:border-orange-500/40 border border-transparent transition-all cursor-pointer flex items-center justify-between text-xs group"
                    title="Clique para editar valores desta ordem"
                  >
                    <div className="min-w-0">
                      <span className="font-bold block truncate group-hover:text-orange-600">
                        {op.produto || "Telha"} · #{op.numero_pedido || "S/N"}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {op.cliente || "S/ Cliente"} · {op.maquina}
                      </span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <span className="font-bold text-orange-600 block">{op.kg.toFixed(0)} kg</span>
                      <span className="text-[10px] text-muted-foreground">{op.metros.toFixed(1)}m</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CustoContent({ data, onGoToPedido, onEditarOrdem, onAbrirRaioX }) {
  const [visao, setVisao] = useState("ordens"); // "ordens" | "bobinas"
  const [busca, setBusca] = useState("");

  // Todas as OPs finalizadas com dados calculados
  const todasOps = useMemo(() => {
    const list = [];
    (data.bobinasList || []).forEach(b => {
      (b.ops || []).forEach(op => list.push(op));
    });
    return list.sort((a, b) => (b.custo || 0) - (a.custo || 0));
  }, [data]);

  const opsFiltradas = useMemo(() => {
    if (!busca.trim()) return todasOps;
    const q = busca.toLowerCase().trim();
    return todasOps.filter(op => {
      const cli = String(op.cliente || "").toLowerCase();
      const num = String(op.numero_pedido || "").toLowerCase();
      const prod = String(op.produto || "").toLowerCase();
      const bob = String(op.custoInfo?.bobinaCodigo || "").toLowerCase();
      return cli.includes(q) || num.includes(q) || prod.includes(q) || bob.includes(q);
    });
  }, [todasOps, busca]);

  return (
    <div className="space-y-4">
      {/* 1. Header Consolidado de Custos */}
      <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-green-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatBRL(data.totalCusto)}</p>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Custo real de fabricação no período</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {formatBRL(data.custoMedioMetro)}<span className="text-[10px] text-muted-foreground font-normal">/metro</span>
            </p>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {formatBRL(data.custoMedio)}<span className="text-[10px] text-muted-foreground font-normal">/kg</span>
            </p>
            <p className="text-[10px] text-muted-foreground">{data.finOrdens?.length || 0} ordens · {data.totalMetros?.toFixed(0) || 0}m</p>
          </div>
        </div>
      </div>

      {/* 2. Barra de Controle: Alternância de Visão e Busca */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setVisao("ordens")}
            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
              visao === "ordens" ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Por Pedido ({todasOps.length})
          </button>
          <button
            type="button"
            onClick={() => setVisao("bobinas")}
            className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
              visao === "bobinas" ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Por Bobina ({data.bobinasList?.length || 0})
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pedido, cliente..."
            className="h-8 pl-8 text-xs bg-card"
          />
        </div>
      </div>

      {/* 3. Conteúdo da Visão Selecionada */}
      {visao === "ordens" ? (
        <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
          {opsFiltradas.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido encontrado com este filtro.</p>
          ) : (
            opsFiltradas.map((op) => {
              const c = op.custoInfo || {};
              const raw = op.rawObj || op;
              return (
                <div
                  key={op.id}
                  onClick={() => {
                    if (onAbrirRaioX) onAbrirRaioX(raw);
                    else if (onEditarOrdem) onEditarOrdem(raw);
                    else onGoToPedido(raw);
                  }}
                  className="p-3 border border-border/80 hover:border-emerald-500 rounded-xl bg-card hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all cursor-pointer shadow-2xs group"
                  title="Clique para abrir o Raio-X de Custo completo deste pedido"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {op.produto || "Telha"}
                        </span>
                        {c.isTermoacustica && (
                          <span className="text-[9px] font-bold text-cyan-700 bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300 px-1 rounded">
                            Termoacústica
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate block mt-0.5">
                        {op.cliente || "S/ Cliente"} · <strong className="text-foreground font-mono">#{op.numero_pedido || "S/N"}</strong> · {op.maquina}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 block">
                        {formatBRL(op.custo)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {op.metros > 0 ? `${op.metros.toFixed(1)}m · ${formatBRL(c.custoPorMetro)}/m` : `${op.kg.toFixed(0)} kg`}
                      </span>
                    </div>
                  </div>

                  {/* Composição detalhada de custos */}
                  <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                    <div className="bg-muted/40 p-1 rounded">
                      <span className="text-muted-foreground block text-[9px]">Aço ({op.kg.toFixed(0)} kg)</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{formatBRL(c.custoAco || 0)}</span>
                    </div>

                    {c.custoEps > 0 && (
                      <div className="bg-cyan-50/50 dark:bg-cyan-950/30 p-1 rounded">
                        <span className="text-cyan-700 dark:text-cyan-400 block text-[9px]">EPS / Isopor</span>
                        <span className="font-bold text-cyan-800 dark:text-cyan-300">{formatBRL(c.custoEps)}</span>
                      </div>
                    )}

                    {c.custoCola > 0 && (
                      <div className="bg-blue-50/50 dark:bg-blue-950/30 p-1 rounded">
                        <span className="text-blue-700 dark:text-blue-400 block text-[9px]">Cola PU</span>
                        <span className="font-bold text-blue-800 dark:text-blue-300">{formatBRL(c.custoCola)}</span>
                      </div>
                    )}

                    <div className="bg-muted/40 p-1 rounded">
                      <span className="text-muted-foreground block text-[9px]">Operação</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{formatBRL(c.custoOperacional || 0)}</span>
                    </div>

                    {c.bobinaCodigo && (
                      <div className="col-span-2 sm:col-span-1 bg-amber-50/40 dark:bg-amber-950/30 p-1 rounded">
                        <span className="text-amber-700 dark:text-amber-400 block text-[9px]">Bobina</span>
                        <span className="font-mono font-bold text-amber-800 dark:text-amber-300 truncate block">{c.bobinaCodigo}</span>
                      </div>
                    )}
                  </div>

                  {/* Barra de Ações Rápidas do Card de Custo */}
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      {onAbrirRaioX && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAbrirRaioX(raw);
                          }}
                          className="h-6 px-2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1 cursor-pointer shadow-2xs"
                        >
                          <Calculator className="w-3 h-3" /> Raio-X Completo
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditarOrdem) onEditarOrdem(raw);
                          else onGoToPedido(raw);
                        }}
                        className="text-amber-600 dark:text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGoToPedido(raw);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" /> Produção
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
          {data.bobinasList.map((b, i) => (
            <div key={i} className="p-3 border rounded-xl bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs truncate">{b.descricao}</span>
                <span className="font-black text-xs text-emerald-600">{formatBRL(b.custo_total)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{b.kg_total.toFixed(0)} kg · {b.metros_total?.toFixed(1) || 0}m · {b.ops.length} ordem(ns)</p>

              {b.ops.length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1.5">
                  {b.ops.map((op) => {
                    const raw = op.rawObj || op;
                    return (
                      <div
                        key={op.id}
                        onClick={() => {
                          if (onAbrirRaioX) onAbrirRaioX(raw);
                          else if (onEditarOrdem) onEditarOrdem(raw);
                          else onGoToPedido(raw);
                        }}
                        className="p-2 rounded-lg bg-muted/40 hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-transparent transition-all cursor-pointer flex items-center justify-between text-xs group"
                        title="Clique para ver o Raio-X desta ordem"
                      >
                        <div className="min-w-0">
                          <span className="font-bold block truncate group-hover:text-emerald-600">
                            {op.produto || "Telha"} · #{op.numero_pedido || "S/N"}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {op.cliente || "S/ Cliente"}
                          </span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-bold text-emerald-600 block">{formatBRL(op.custo)}</span>
                          <span className="text-[10px] text-muted-foreground">{op.metros.toFixed(1)}m · {op.kg.toFixed(0)} kg</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdensContent({ ordens = [], onGoToPedido, onEditarOrdem, onOpenHistorico }) {
  return (
    <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
      {ordens.map(o => {
        const cfg = STATUS_CFG[o.status] || STATUS_CFG.pendente;
        return (
          <OrdemItemCard
            key={o.id}
            ordem={o}
            onGoToPedido={onGoToPedido}
            onEditarOrdem={onEditarOrdem}
            onOpenHistorico={onOpenHistorico}
            badgeText={cfg.label}
            badgeColor={`${cfg.bg} ${cfg.color}`}
          />
        );
      })}
    </div>
  );
}

function RetrabalhosContent({ ordens = [], onGoToPedido, onEditarOrdem, onOpenHistorico }) {
  if (ordens.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">Nenhum retrabalho registrado no período.</p>;
  }
  return (
    <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
      {ordens.map(o => (
        <OrdemItemCard
          key={o.id}
          ordem={o}
          onGoToPedido={onGoToPedido}
          onEditarOrdem={onEditarOrdem}
          onOpenHistorico={onOpenHistorico}
          badgeText="Retrabalho"
          badgeColor="bg-red-100 text-red-700 border border-red-200"
        />
      ))}
    </div>
  );
}

function PausadasContent({ ordens = [], onGoToPedido, onEditarOrdem, onOpenHistorico }) {
  if (ordens.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-8">Nenhuma ordem pausada no momento.</p>;
  }
  return (
    <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
      {ordens.map(o => (
        <OrdemItemCard
          key={o.id}
          ordem={o}
          onGoToPedido={onGoToPedido}
          onEditarOrdem={onEditarOrdem}
          onOpenHistorico={onOpenHistorico}
          badgeText="Pausado"
          badgeColor="bg-purple-100 text-purple-700 border border-purple-200"
        />
      ))}
    </div>
  );
}

function SanduicheContent({ ordens = [], onGoToPedido, onEditarOrdem, onOpenHistorico }) {
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

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {ordens.map(o => (
          <OrdemItemCard
            key={o.id}
            ordem={o}
            onGoToPedido={onGoToPedido}
            onEditarOrdem={onEditarOrdem}
            onOpenHistorico={onOpenHistorico}
            badgeText="Termoacústica"
            badgeColor="bg-cyan-100 text-cyan-700 border border-cyan-200"
          />
        ))}
      </div>
    </div>
  );
}

function EficienciaContent({ eficiencia, tempoProdTotal, tempoPausaTotal, tempoSetupTotal, tempoTotal, ordens = [], onGoToPedido, onEditarOrdem }) {
  return (
    <div className="space-y-4">
      <div className="text-center p-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 rounded-xl">
        <p className="text-4xl font-black text-amber-600">{eficiencia}%</p>
        <p className="text-xs text-muted-foreground mt-1">Eficiência Geral das Perfiladeiras</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/40 text-center">
          <p className="font-black text-sm text-green-700 dark:text-green-300">{formatTempo(tempoProdTotal)}</p>
          <p className="text-[10px] text-muted-foreground">Produção</p>
        </div>
        <div className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/40 text-center">
          <p className="font-black text-sm text-amber-700 dark:text-amber-300">{formatTempo(tempoPausaTotal)}</p>
          <p className="text-[10px] text-muted-foreground">Pausa</p>
        </div>
        <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/40 text-center">
          <p className="font-black text-sm text-purple-700 dark:text-purple-300">{formatTempo(tempoSetupTotal)}</p>
          <p className="text-[10px] text-muted-foreground">Setup</p>
        </div>
      </div>
    </div>
  );
}

