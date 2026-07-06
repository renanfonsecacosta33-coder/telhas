import React, { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Scissors, Package, Layers, CheckCircle2, Clock, AlertCircle,
  Camera, ChevronRight, Factory, Wrench, Image as ImageIcon,
  Edit3, Zap, Pause, Circle, History, X, Loader2, ShoppingCart,
  TrendingUp, Boxes, Weight, Timer, ArrowRight, FileText, MapPin,
  Ruler, Hammer, ClipboardList, Truck, PlayCircle, Hourglass,
  CircleDot, Calendar
} from "lucide-react";

const MAQUINA_INFO = {
  "DESBOBINADEIRA": { label: "Desbobinadeira", hex: "#ea580c", icon: Factory, short: "Desbob.", ordem: 1 },
  "CORTE 3M": { label: "Guilhotina 3m", hex: "#8b5cf6", icon: Scissors, short: "Corte 3m", ordem: 2 },
  "CORTE 6M": { label: "Guilhotina 6m", hex: "#6366f1", icon: Scissors, short: "Corte 6m", ordem: 2 },
  "DOBRA 3M": { label: "Dobradeira 3m", hex: "#3b82f6", icon: Layers, short: "Dobra 3m", ordem: 3 },
  "DOBRA FUNDO 6M": { label: "Dobra Fundo 6m", hex: "#14b8a6", icon: Layers, short: "Dobra Fundo", ordem: 3 },
  "DOBRA INICIO 6M": { label: "Dobra Início 6m", hex: "#10b981", icon: Layers, short: "Dobra Início", ordem: 3 },
  "PERFILADEIRA": { label: "Perfiladeira", hex: "#22c55e", icon: Wrench, short: "Perfil.", ordem: 2 },
};

const STATUS_CFG = {
  pendente: { label: "Pendente", icon: Circle, color: "text-slate-600", bg: "bg-slate-100 border-slate-200", dot: "#94a3b8" },
  aguardando_corte: { label: "Aguard. Corte", icon: Hourglass, color: "text-orange-600", bg: "bg-orange-100 border-orange-200", dot: "#f97316" },
  em_producao: { label: "Em Produção", icon: Zap, color: "text-amber-600", bg: "bg-amber-100 border-amber-200", dot: "#f59e0b" },
  pausado: { label: "Pausado", icon: Pause, color: "text-purple-600", bg: "bg-purple-100 border-purple-200", dot: "#a855f7" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100 border-green-200", dot: "#22c55e" },
  cancelado: { label: "Cancelado", icon: AlertCircle, color: "text-red-600", bg: "bg-red-100 border-red-200", dot: "#ef4444" },
};

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatTempoCurto(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
  return `${m}m`;
}

function safeDate(d) {
  if (!d) return null;
  try { return new Date(d.includes("T") ? d : d + "T12:00:00"); } catch { return null; }
}

export default function HistoricoPedidoSidebar({ open, onClose, numeroPedido }) {
  const [loading, setLoading] = useState(false);
  const [etapas, setEtapas] = useState([]);

  useEffect(() => {
    if (open && numeroPedido) {
      loadHistorico();
    }
    if (!open) setEtapas([]);
  }, [open, numeroPedido]);

  const loadHistorico = async () => {
    setLoading(true);
    try {
      const [ordensDesb, ordensMaq] = await Promise.all([
        base44.entities.OrdemDesbobinadeira.filter({ numero_pedido: numeroPedido }, "data", 50),
        base44.entities.OrdemMaquinaCD.filter({ numero_pedido: numeroPedido }, "data", 50),
      ]);

      const desbFmt = ordensDesb.map(o => ({
        ...o, _tipo: "desbobinadeira", maquina: "DESBOBINADEIRA",
        _sortData: o.data, _created: o.created_date
      }));
      const maqFmt = ordensMaq.map(o => ({
        ...o, _tipo: "maquina",
        _sortData: o.data, _created: o.created_date
      }));

      const todas = [...desbFmt, ...maqFmt].sort((a, b) => {
        const da = a._sortData || "";
        const db = b._sortData || "";
        if (da !== db) return da.localeCompare(db);
        return (a._created || "").localeCompare(b._created || "");
      });

      setEtapas(todas);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // === MÉTRICAS ===
  const metrics = useMemo(() => {
    const finalizadas = etapas.filter(e => e.status === "finalizado");
    const emAndamento = etapas.filter(e => ["em_producao", "pausado"].includes(e.status));
    const pendentes = etapas.filter(e => ["pendente", "aguardando_corte"].includes(e.status));
    const totalKG = etapas.reduce((s, e) => s + (e.peso_kg || e.kg_estimado || 0), 0);
    const totalPecas = etapas.reduce((s, e) => s + (e.quantidade || 0), 0);
    const totalTempo = etapas.reduce((s, e) => s + (e.tempo_producao_seg || 0) + (e.tempo_setup_seg || 0), 0);
    const totalSetup = etapas.reduce((s, e) => s + (e.tempo_setup_seg || 0), 0);
    const totalProd = etapas.reduce((s, e) => s + (e.tempo_producao_seg || 0), 0);
    const totalPausa = etapas.reduce((s, e) => s + (e.tempo_pausa_seg || 0), 0);
    const retrabalhos = etapas.filter(e => e.is_retrabalho);
    const modificacoes = etapas.filter(e => e.modificacao_blank);
    const pctConcluido = etapas.length > 0 ? Math.round((finalizadas.length / etapas.length) * 100) : 0;

    // Primeira data e última data
    const datas = etapas.map(e => safeDate(e.data || e.data_finalizacao)).filter(Boolean);
    const primeiraData = datas.length ? new Date(Math.min(...datas.map(d => d.getTime()))) : null;
    const ultimaData = datas.length ? new Date(Math.max(...datas.map(d => d.getTime()))) : null;
    const diasDecorridos = primeiraData && ultimaData ? Math.max(0, differenceInDays(ultimaData, primeiraData)) : 0;

    // Cliente e unidade
    const cliente = etapas.find(e => e.cliente)?.cliente || "";
    const unidade = etapas.find(e => e.unidade)?.unidade || "";

    return {
      finalizadas, emAndamento, pendentes,
      totalKG, totalPecas, totalTempo, totalSetup, totalProd, totalPausa,
      retrabalhos, modificacoes, pctConcluido,
      primeiraData, ultimaData, diasDecorridos, cliente, unidade
    };
  }, [etapas]);

  // === PRÓXIMOS PASSOS ===
  const proximosPassos = useMemo(() => {
    const passos = [];
    const maquinasCriadas = new Set(etapas.map(e => e.maquina));

    // Passos pendentes (já criados mas não finalizados)
    etapas.filter(e => ["pendente", "aguardando_corte", "em_producao", "pausado"].includes(e.status))
      .forEach(e => {
        const maqInfo = MAQUINA_INFO[e.maquina] || { label: e.maquina, hex: "#64748b", icon: Factory, ordem: 99 };
        passos.push({
          maquina: e.maquina,
          maqInfo,
          status: e.status,
          origem: "criada",
          ordemId: e.id,
          data: e.data,
          quantidade: e.quantidade,
          tipo_peca: e.tipo_peca,
          ordem_dobra_maquina: e.ordem_dobra_maquina,
          guilhotina: e.guilhotina,
          espessura: e.espessura_utilizada || e.bobina_descricao,
        });
      });

    // Inferir próximos passos não criados a partir do fluxo
    // Se há desbobinadeira com guilhotina mas não há ordem de guilhotina criada
    const desbComGuilhotina = etapas.find(e => e._tipo === "desbobinadeira" && e.guilhotina && !maquinasCriadas.has(e.guilhotina));
    if (desbComGuilhotina) {
      const maqInfo = MAQUINA_INFO[desbComGuilhotina.guilhotina] || { label: desbComGuilhotina.guilhotina, hex: "#6366f1", icon: Scissors, ordem: 2 };
      passos.push({
        maquina: desbComGuilhotina.guilhotina,
        maqInfo,
        status: "previsto",
        origem: "inferido_desb",
        ordemId: null,
        data: desbComGuilhotina.data,
        quantidade: desbComGuilhotina.quantidade,
        tipo_peca: null,
        tamanho_corte: desbComGuilhotina.tamanho_corte_guilhotina,
      });
    }

    // Se há corte com ordem_dobra_maquina mas não há ordem de dobra criada
    etapas.filter(e => e._tipo === "maquina" && e.ordem_dobra_maquina && !maquinasCriadas.has(e.ordem_dobra_maquina))
      .forEach(corte => {
        const maqInfo = MAQUINA_INFO[corte.ordem_dobra_maquina] || { label: corte.ordem_dobra_maquina, hex: "#3b82f6", icon: Layers, ordem: 3 };
        passos.push({
          maquina: corte.ordem_dobra_maquina,
          maqInfo,
          status: "previsto",
          origem: "inferido_corte",
          ordemId: null,
          data: corte.data,
          quantidade: corte.quantidade,
          tipo_peca: corte.tipo_peca,
        });
      });

    return passos.sort((a, b) => (a.maqInfo.ordem || 99) - (b.maqInfo.ordem || 99));
  }, [etapas]);

  const etapaAtual = metrics.emAndamento[0] || null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        {/* === HEADER === */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-black px-6 py-5 sticky top-0 z-20">
          <SheetHeader className="space-y-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2.5 text-white text-lg">
                <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                  <Factory className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <span className="block">Linha de Produção</span>
                  <span className="block text-[11px] font-normal text-white/50">Trajeto completo do pedido pela fábrica</span>
                </div>
              </SheetTitle>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>

          {/* Order badge + cliente */}
          {numeroPedido && (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-orange-500 rounded-full pl-3 pr-4 py-1.5 shadow-lg shadow-orange-500/20">
                <ShoppingCart className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">#{numeroPedido}</span>
              </div>
              {metrics.cliente && (
                <div className="flex items-center gap-1.5 text-white/80">
                  <Package className="w-3.5 h-3.5" />
                  <span className="text-sm font-medium">{metrics.cliente}</span>
                </div>
              )}
              {metrics.unidade && (
                <div className="flex items-center gap-1.5 text-white/60">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-xs">{metrics.unidade}</span>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {etapas.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-white/60 font-medium">Progresso geral</span>
                <span className="text-[11px] text-white font-bold">{metrics.pctConcluido}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 via-green-500 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.pctConcluido}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : etapas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <History className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma etapa encontrada para este pedido.</p>
            </div>
          ) : (
            <>
              {/* === MÉTRICAS GLOBAIS === */}
              <div className="grid grid-cols-4 gap-2">
                <MetricCard icon={ClipboardList} value={etapas.length} label="Etapas" color="text-orange-600" bg="bg-orange-50" />
                <MetricCard icon={CheckCircle2} value={metrics.finalizadas.length} label="Finalizadas" color="text-green-600" bg="bg-green-50" />
                <MetricCard icon={Boxes} value={metrics.totalPecas} label="Peças" color="text-blue-600" bg="bg-blue-50" />
                <MetricCard icon={Weight} value={metrics.totalKG.toFixed(0)} label="KG Total" color="text-emerald-600" bg="bg-emerald-50" />
              </div>

              {/* === TEMPOS === */}
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Controle de Tempo</span>
                  {metrics.diasDecorridos > 0 && (
                    <Badge variant="outline" className="ml-auto text-[10px] gap-1">
                      <Calendar className="w-2.5 h-2.5" /> {metrics.diasDecorridos} dia{metrics.diasDecorridos > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <TimeBlock label="Setup" seg={metrics.totalSetup} icon={Wrench} color="text-purple-600" />
                  <TimeBlock label="Produção" seg={metrics.totalProd} icon={Zap} color="text-amber-600" />
                  <TimeBlock label="Pausa" seg={metrics.totalPausa} icon={Pause} color="text-slate-500" />
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Tempo total acumulado</span>
                  <span className="text-sm font-bold text-foreground">{formatTempoCurto(metrics.totalTempo)}</span>
                </div>
              </div>

              {/* === STATUS ATUAL === */}
              {etapaAtual && (
                <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Em Andamento Agora</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const mi = MAQUINA_INFO[etapaAtual.maquina] || { label: etapaAtual.maquina, hex: "#64748b", icon: Factory };
                      return (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: mi.hex + "20" }}>
                          <mi.icon className="w-5 h-5" style={{ color: mi.hex }} />
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">
                        {(MAQUINA_INFO[etapaAtual.maquina] || {}).label || etapaAtual.maquina}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {etapaAtual.tipo_peca || etapaAtual.bobina_descricao || "—"}
                        {etapaAtual.quantidade > 0 && ` · ${etapaAtual.quantidade} pç`}
                      </p>
                    </div>
                    {etapaAtual.inicio_producao_ts && (
                      <LiveTimer inicioTs={etapaAtual.inicio_producao_ts} pausado={etapaAtual.status === "pausado"} />
                    )}
                  </div>
                </div>
              )}

              {/* === ALERTAS === */}
              {(metrics.retrabalhos.length > 0 || metrics.modificacoes.length > 0) && (
                <div className="space-y-2">
                  {metrics.retrabalhos.length > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <p className="text-xs text-red-800 font-medium">
                        <strong>{metrics.retrabalhos.length}</strong> retrabalho{metrics.retrabalhos.length > 1 ? "s" : ""} registrado{metrics.retrabalhos.length > 1 ? "s" : ""} neste pedido
                      </p>
                    </div>
                  )}
                  {metrics.modificacoes.length > 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5">
                      <Edit3 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs text-amber-800 font-medium">
                        Modificação de blank registrada no corte — repassada como OBD para a dobra
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* === PRÓXIMOS PASSOS === */}
              {proximosPassos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight className="w-4 h-4 text-orange-500" />
                    <h3 className="text-sm font-bold text-foreground">Próximos Passos</h3>
                    <Badge variant="outline" className="text-[10px]">{proximosPassos.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {proximosPassos.map((p, idx) => {
                      const st = STATUS_CFG[p.status] || STATUS_CFG.pendente;
                      const isPrevisto = p.status === "previsto";
                      return (
                        <div key={idx} className={`flex items-center gap-3 rounded-xl border ${isPrevisto ? "border-dashed border-blue-300 bg-blue-50/50" : st.bg} px-3 py-2.5`}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: p.maqInfo.hex + "20" }}>
                            <p.maqInfo.icon className="w-4 h-4" style={{ color: p.maqInfo.hex }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{p.maqInfo.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {isPrevisto ? "Previsto · " : ""}
                              {p.quantidade > 0 && `${p.quantidade} pç`}
                              {p.tipo_peca && ` · ${p.tipo_peca}`}
                              {p.tamanho_corte && ` · ${p.tamanho_corte}mm`}
                              {p.espessura && ` · ${p.espessura}`}
                            </p>
                          </div>
                          {isPrevisto ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] gap-1">
                              <CircleDot className="w-2.5 h-2.5" /> Previsto
                            </Badge>
                          ) : (
                            <Badge className={`border text-[10px] gap-1 ${st.bg} ${st.color}`}>
                              <st.icon className="w-2.5 h-2.5" /> {st.label}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* === TIMELINE COMPLETA === */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-foreground" />
                  <h3 className="text-sm font-bold text-foreground">Histórico Completo</h3>
                  <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                    {metrics.primeiraData && <span>{format(metrics.primeiraData, "dd/MM", { locale: ptBR })}</span>}
                    {metrics.ultimaData && metrics.primeiraData && metrics.ultimaData.getTime() !== metrics.primeiraData.getTime() && (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        <span>{format(metrics.ultimaData, "dd/MM/yyyy", { locale: ptBR })}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="relative">
                  {etapas.map((etapa, idx) => {
                    const maqInfo = MAQUINA_INFO[etapa.maquina] || { label: etapa.maquina, hex: "#64748b", icon: Factory };
                    const stCfg = STATUS_CFG[etapa.status] || STATUS_CFG.pendente;
                    const isLast = idx === etapas.length - 1;
                    const kg = etapa.peso_kg || etapa.kg_estimado || 0;
                    const isRetrabalho = etapa.is_retrabalho;
                    const isFinalizado = etapa.status === "finalizado";
                    const dataFmt = safeDate(etapa.data);
                    const dataFin = safeDate(etapa.data_finalizacao);

                    return (
                      <div key={etapa.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {/* Vertical line */}
                        {!isLast && (
                          <div className="absolute left-[18px] top-12 bottom-0 w-0.5"
                            style={{ backgroundColor: isFinalizado ? "#22c55e" : "#e2e8f0" }} />
                        )}

                        {/* Node */}
                        <div className="flex-shrink-0 relative z-10">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 shadow-sm"
                            style={{ backgroundColor: isFinalizado ? stCfg.dot : maqInfo.hex, borderColor: "#fff" }}>
                            {isFinalizado ? (
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                              <maqInfo.icon className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </div>

                        {/* Content card */}
                        <div className={`flex-1 rounded-xl border ${stCfg.bg} p-3 shadow-sm`}>
                          {/* Machine + status */}
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="font-bold text-sm" style={{ color: maqInfo.hex }}>{maqInfo.label}</span>
                              {isRetrabalho && (
                                <Badge className="bg-red-500 text-white border-red-600 text-[10px]">
                                  <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                  RETRABALHO{etapa.retrabalho_etapa > 1 ? ` E${etapa.retrabalho_etapa}` : ""}
                                </Badge>
                              )}
                            </div>
                            <Badge className={`border text-[10px] ${stCfg.bg} ${stCfg.color} flex-shrink-0`}>
                              <stCfg.icon className="w-2.5 h-2.5 mr-0.5" />
                              {stCfg.label}
                            </Badge>
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                            {dataFmt && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(dataFmt, "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            )}
                            {dataFin && (
                              <span className="text-green-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Finalizado em {format(dataFin, "dd/MM", { locale: ptBR })}
                              </span>
                            )}
                            {etapa.unidade && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />{etapa.unidade}
                              </span>
                            )}
                          </div>

                          {/* Specs bar */}
                          <div className="flex items-center gap-2 flex-wrap text-xs bg-white/60 rounded-lg px-2.5 py-1.5 mb-2 border border-black/5">
                            {etapa.tipo_peca && (
                              <span className="font-semibold text-foreground">{etapa.tipo_peca}</span>
                            )}
                            {etapa.bobina_descricao && !etapa.tipo_peca && (
                              <span className="font-mono text-foreground">{etapa.bobina_descricao}</span>
                            )}
                            {etapa.quantidade > 0 && (
                              <span className="flex items-center gap-0.5 font-semibold text-foreground">
                                <Boxes className="w-3 h-3 text-blue-500" />{etapa.quantidade} pç
                              </span>
                            )}
                            {kg > 0 && (
                              <span className="flex items-center gap-0.5 font-semibold text-emerald-600">
                                <Weight className="w-3 h-3" />{kg.toFixed(1)}kg
                              </span>
                            )}
                            {etapa.comprimento_mm > 0 && (
                              <span className="flex items-center gap-0.5 text-muted-foreground font-mono">
                                <Ruler className="w-3 h-3" />{etapa.comprimento_mm}mm
                              </span>
                            )}
                            {etapa.dimensoes_livres && (
                              <span className="text-muted-foreground font-mono">{etapa.dimensoes_livres}</span>
                            )}
                            {(etapa.tempo_producao_seg > 0 || etapa.tempo_setup_seg > 0) && (
                              <span className="flex items-center gap-0.5 text-muted-foreground">
                                <Clock className="w-3 h-3" />{formatTempoCurto((etapa.tempo_producao_seg || 0) + (etapa.tempo_setup_seg || 0))}
                              </span>
                            )}
                          </div>

                          {/* Time breakdown */}
                          {(etapa.tempo_setup_seg > 0 || etapa.tempo_pausa_seg > 0) && (
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
                              {etapa.tempo_setup_seg > 0 && (
                                <span className="flex items-center gap-0.5"><Wrench className="w-2.5 h-2.5" /> Setup: {formatTempoCurto(etapa.tempo_setup_seg)}</span>
                              )}
                              {etapa.tempo_pausa_seg > 0 && (
                                <span className="flex items-center gap-0.5"><Pause className="w-2.5 h-2.5" /> Pausa: {formatTempoCurto(etapa.tempo_pausa_seg)}</span>
                              )}
                            </div>
                          )}

                          {/* Material / chapa traceability */}
                          {etapa.chapa_descricao && etapa._tipo === "maquina" && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                              {etapa.chapa_origem === "chaparia" ? (
                                <><Layers className="w-3 h-3 text-orange-500" /><span className="font-mono">{etapa.chapa_descricao}</span></>
                              ) : (
                                <><Package className="w-3 h-3 text-blue-500" /><span className="font-mono">{etapa.bobina_descricao || etapa.chapa_descricao}</span></>
                              )}
                            </div>
                          )}

                          {/* Desenvolvimento */}
                          {etapa.desenvolvimento_descricao && (
                            <div className="flex items-center gap-1.5 text-xs text-purple-600 mb-1.5">
                              <FileText className="w-3 h-3" /><span>{etapa.desenvolvimento_descricao}</span>
                            </div>
                          )}

                          {/* Guilhotina routing */}
                          {etapa._tipo === "desbobinadeira" && etapa.guilhotina && (
                            <div className="flex items-center gap-1.5 text-xs text-orange-600 font-medium mb-1.5">
                              <ChevronRight className="w-3 h-3" />
                              Envia para {etapa.guilhotina}{etapa.tamanho_corte_guilhotina ? ` · ${etapa.tamanho_corte_guilhotina}mm` : ""}
                            </div>
                          )}

                          {/* Dobra routing */}
                          {etapa._tipo === "maquina" && etapa.ordem_dobra_maquina && (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium mb-1.5">
                              <ArrowRight className="w-3 h-3" />
                              Gera ordem para {(MAQUINA_INFO[etapa.ordem_dobra_maquina] || {}).label || etapa.ordem_dobra_maquina}
                            </div>
                          )}

                          {/* MODIFICAÇÃO DE BLANK (OBD) */}
                          {etapa._tipo === "maquina" && etapa.modificacao_blank && (
                            <div className="mt-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                <span className="text-xs font-bold text-amber-800">Modificação no Blank — OBD</span>
                              </div>
                              <p className="text-xs text-amber-700 whitespace-pre-line">{etapa.modificacao_descricao || "Sem descrição"}</p>
                            </div>
                          )}

                          {/* Observações */}
                          {etapa.observacoes && (
                            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 text-xs text-yellow-800 whitespace-pre-line">
                              <FileText className="w-3 h-3 inline mr-1" />{etapa.observacoes}
                            </div>
                          )}

                          {/* Retrabalho motivo */}
                          {isRetrabalho && etapa.retrabalho_motivo && (
                            <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-700">
                              <AlertCircle className="w-3 h-3 inline mr-1" />{etapa.retrabalho_motivo}
                            </div>
                          )}

                          {/* Fotos */}
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {etapa.foto_pedido_url && (
                              <PhotoThumb url={etapa.foto_pedido_url} label="Pedido" color="border-blue-300" icon={ShoppingCart} />
                            )}
                            {etapa.foto_finalizacao_url && (
                              <PhotoThumb url={etapa.foto_finalizacao_url} label="Finalização" color="border-green-300" icon={Camera} />
                            )}
                            {etapa.retrabalho_foto_1_url && (
                              <PhotoThumb url={etapa.retrabalho_foto_1_url} label="Retrab. 1" color="border-red-300" icon={AlertCircle} />
                            )}
                            {etapa.retrabalho_foto_2_url && (
                              <PhotoThumb url={etapa.retrabalho_foto_2_url} label="Retrab. 2" color="border-red-300" icon={AlertCircle} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// === SUB-COMPONENTES ===

function MetricCard({ icon: Icon, value, label, color, bg }) {
  return (
    <div className="bg-card border border-border rounded-xl p-2.5 text-center">
      <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

function TimeBlock({ label, seg, icon: Icon, color }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={`text-sm font-bold ${color}`}>{formatTempoCurto(seg)}</p>
    </div>
  );
}

function PhotoThumb({ url, label, color, icon: Icon }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="relative group">
      <img src={url} alt={label} className={`w-14 h-14 object-cover rounded-lg border-2 ${color}`} />
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[8px] px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5">
        <Icon className="w-2 h-2" />{label}
      </span>
    </a>
  );
}

function LiveTimer({ inicioTs, pausado }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => {
      const start = new Date(inicioTs).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [inicioTs]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const timeStr = h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;

  return (
    <div className="flex items-center gap-1.5 bg-amber-100 border border-amber-300 rounded-lg px-2 py-1 flex-shrink-0">
      <div className={`w-1.5 h-1.5 rounded-full ${pausado ? "bg-purple-500" : "bg-amber-500 animate-pulse"}`} />
      <span className="text-xs font-bold text-amber-700 font-mono">{timeStr}</span>
    </div>
  );
}

/**
 * Botão auto-contido que abre a sidebar de histórico do pedido.
 * Use em qualquer row de ordem: <HistoricoPedidoButton numeroPedido={o.numero_pedido} />
 */
export function HistoricoPedidoButton({ numeroPedido, size = "sm" }) {
  const [open, setOpen] = useState(false);

  if (!numeroPedido) return null;

  return (
    <>
      <Button variant="ghost" size={size} className="gap-1 text-blue-600 hover:bg-blue-50"
        onClick={() => setOpen(true)}>
        <History className="w-3.5 h-3.5" />
        Histórico
      </Button>
      <HistoricoPedidoSidebar open={open} onClose={() => setOpen(false)} numeroPedido={numeroPedido} />
    </>
  );
}