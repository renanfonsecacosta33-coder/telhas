import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Scissors, Package, Layers, CheckCircle2, Clock, AlertCircle,
  Camera, ChevronRight, Factory, Wrench, Image as ImageIcon,
  Edit3, Zap, Pause, Circle, History, X, Loader2, ShoppingCart
} from "lucide-react";

const MAQUINA_INFO = {
  "DESBOBINADEIRA": { label: "Desbobinadeira", hex: "#ea580c", icon: Factory },
  "CORTE 3M": { label: "Guilhotina 3m", hex: "#8b5cf6", icon: Scissors },
  "CORTE 6M": { label: "Guilhotina 6m", hex: "#6366f1", icon: Scissors },
  "DOBRA 3M": { label: "Dobradeira 3m", hex: "#3b82f6", icon: Layers },
  "DOBRA FUNDO 6M": { label: "Dobra Fundo 6m", hex: "#14b8a6", icon: Layers },
  "DOBRA INICIO 6M": { label: "Dobra Início 6m", hex: "#10b981", icon: Layers },
  "PERFILADEIRA": { label: "Perfiladeira", hex: "#22c55e", icon: Wrench },
};

const STATUS_CFG = {
  pendente: { label: "Pendente", icon: Circle, color: "text-slate-500", bg: "bg-slate-100 border-slate-200" },
  aguardando_corte: { label: "Aguard. Corte", icon: Clock, color: "text-orange-600", bg: "bg-orange-100 border-orange-200" },
  em_producao: { label: "Em Produção", icon: Zap, color: "text-amber-600", bg: "bg-amber-100 border-amber-200" },
  pausado: { label: "Pausado", icon: Pause, color: "text-purple-600", bg: "bg-purple-100 border-purple-200" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-100 border-green-200" },
  cancelado: { label: "Cancelado", icon: AlertCircle, color: "text-red-600", bg: "bg-red-100 border-red-200" },
};

function formatTempo(seg) {
  const s = Math.floor(seg || 0);
  if (s === 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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

  const totalKG = etapas.filter(e => e.status === "finalizado").reduce((s, e) => s + (e.peso_kg || e.kg_estimado || 0), 0);
  const totalPecas = etapas.filter(e => e.status === "finalizado").reduce((s, e) => s + (e.quantidade || 0), 0);
  const etapasFinalizadas = etapas.filter(e => e.status === "finalizado").length;
  const temModificacao = etapas.some(e => e.modificacao_blank);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-4 sticky top-0 z-10">
          <SheetHeader className="space-y-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-white">
                <History className="w-5 h-5 text-orange-400" />
                Linha de Produção
              </SheetTitle>
              <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SheetDescription className="text-white/60">
              Trajeto completo do pedido pela fábrica
            </SheetDescription>
          </SheetHeader>
          {numeroPedido && (
            <div className="mt-3 flex items-center gap-2">
              <Badge className="bg-orange-500 text-white border-orange-600 text-sm font-bold">
                <ShoppingCart className="w-3 h-3 mr-1" /> #{numeroPedido}
              </Badge>
              {etapas[0]?.cliente && (
                <span className="text-white/70 text-sm truncate">{etapas[0].cliente}</span>
              )}
            </div>
          )}
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : etapas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="w-12 h-12 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma etapa encontrada para este pedido.</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-orange-600">{etapas.length}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Etapas</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-green-600">{etapasFinalizadas}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Finalizadas</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-blue-600">{totalPecas}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Peças</p>
                </div>
              </div>

              {/* Modification alert */}
              {temModificacao && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 mb-4">
                  <Edit3 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-800 font-medium">
                    Há modificação de blank registrada no processo de corte — repassada como OBD para a dobra.
                  </p>
                </div>
              )}

              {/* Timeline */}
              <div className="relative">
                {etapas.map((etapa, idx) => {
                  const maqInfo = MAQUINA_INFO[etapa.maquina] || { label: etapa.maquina, hex: "#64748b", icon: Factory };
                  const stCfg = STATUS_CFG[etapa.status] || STATUS_CFG.pendente;
                  const isLast = idx === etapas.length - 1;
                  const kg = etapa.peso_kg || etapa.kg_estimado || 0;
                  const isRetrabalho = etapa.is_retrabalho;

                  return (
                    <div key={etapa.id} className="relative flex gap-3 pb-6 last:pb-0">
                      {/* Vertical line */}
                      {!isLast && (
                        <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-border" />
                      )}

                      {/* Node */}
                      <div className="flex-shrink-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                          style={{ backgroundColor: maqInfo.hex }}
                        >
                          <maqInfo.icon className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* Content card */}
                      <div className={`flex-1 rounded-xl border ${stCfg.bg} p-3 shadow-sm`}>
                        {/* Machine + status */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm" style={{ color: maqInfo.hex }}>{maqInfo.label}</span>
                            {isRetrabalho && (
                              <Badge className="bg-red-500 text-white border-red-600 text-[10px]">
                                <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                                RETRABALHO{etapa.retrabalho_etapa > 1 ? ` E${etapa.retrabalho_etapa}` : ""}
                              </Badge>
                            )}
                          </div>
                          <Badge className={`border text-[10px] ${stCfg.bg} ${stCfg.color}`}>
                            <stCfg.icon className="w-2.5 h-2.5 mr-0.5" />
                            {stCfg.label}
                          </Badge>
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Clock className="w-3 h-3" />
                          <span>{format(new Date(etapa.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>
                          {etapa.data_finalizacao && (
                            <span className="text-green-600 font-medium">
                              ✓ Finalizado em {format(new Date(etapa.data_finalizacao + "T12:00:00"), "dd/MM")}
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex items-center gap-3 flex-wrap text-xs">
                          {etapa.tipo_peca && (
                            <span className="font-medium text-foreground">{etapa.tipo_peca}</span>
                          )}
                          {etapa.bobina_descricao && !etapa.tipo_peca && (
                            <span className="font-mono text-foreground">{etapa.bobina_descricao}</span>
                          )}
                          {etapa.quantidade > 0 && (
                            <span className="font-semibold text-foreground">{etapa.quantidade} pç</span>
                          )}
                          {kg > 0 && (
                            <span className="font-semibold text-emerald-600">{kg.toFixed(1)}kg</span>
                          )}
                          {etapa.dimensoes_livres && (
                            <span className="text-muted-foreground font-mono">{etapa.dimensoes_livres}</span>
                          )}
                          {etapa.tempo_producao_seg > 0 && (
                            <span className="text-muted-foreground">⏱ {formatTempo(etapa.tempo_producao_seg)}</span>
                          )}
                        </div>

                        {/* Material */}
                        {etapa.chapa_descricao && etapa._tipo === "maquina" && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                            {etapa.chapa_origem === "chaparia" ? (
                              <><Layers className="w-3 h-3 text-orange-500" /><span className="font-mono">{etapa.chapa_descricao}</span></>
                            ) : (
                              <><Package className="w-3 h-3 text-blue-500" /><span className="font-mono">{etapa.bobina_descricao || etapa.chapa_descricao}</span></>
                            )}
                          </div>
                        )}

                        {/* Guilhotina info (from desbobinadeira) */}
                        {etapa._tipo === "desbobinadeira" && etapa.guilhotina && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-orange-600 font-medium">
                            <ChevronRight className="w-3 h-3" />
                            Envia para {etapa.guilhotina}{etapa.tamanho_corte_guilhotina ? ` · ${etapa.tamanho_corte_guilhotina}mm` : ""}
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
                            📋 {etapa.observacoes}
                          </div>
                        )}

                        {/* Retrabalho motivo */}
                        {isRetrabalho && etapa.retrabalho_motivo && (
                          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-700">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            {etapa.retrabalho_motivo}
                          </div>
                        )}

                        {/* Fotos */}
                        <div className="flex gap-2 mt-2">
                          {etapa.foto_pedido_url && (
                            <a href={etapa.foto_pedido_url} target="_blank" rel="noopener noreferrer">
                              <img src={etapa.foto_pedido_url} alt="Pedido" className="w-14 h-14 object-cover rounded-lg border-2 border-blue-300" />
                            </a>
                          )}
                          {etapa.foto_finalizacao_url && (
                            <a href={etapa.foto_finalizacao_url} target="_blank" rel="noopener noreferrer">
                              <img src={etapa.foto_finalizacao_url} alt="Finalização" className="w-14 h-14 object-cover rounded-lg border-2 border-green-300" />
                            </a>
                          )}
                          {etapa.retrabalho_foto_1_url && (
                            <a href={etapa.retrabalho_foto_1_url} target="_blank" rel="noopener noreferrer">
                              <img src={etapa.retrabalho_foto_1_url} alt="Retrabalho 1" className="w-14 h-14 object-cover rounded-lg border-2 border-red-300" />
                            </a>
                          )}
                          {etapa.retrabalho_foto_2_url && (
                            <a href={etapa.retrabalho_foto_2_url} target="_blank" rel="noopener noreferrer">
                              <img src={etapa.retrabalho_foto_2_url} alt="Retrabalho 2" className="w-14 h-14 object-cover rounded-lg border-2 border-red-300" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
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