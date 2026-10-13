import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History, Circle, Play, Pause, CheckCircle2, Star, Edit3,
  Trash2, Plus, Clock, User, FileText, ChevronRight,
  Factory, Package, Camera, ExternalLink, Calendar, AlertTriangle
} from "lucide-react";
import { reconstruirLinhaDoTempoPedido } from "@/lib/reconstruirHistoricoHelper";
import SmartImage from "@/components/ui/SmartImage";

const COR_CONFIG = {
  blue: { bg: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300", dot: "bg-blue-500", icon: Plus },
  indigo: { bg: "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500", icon: ChevronRight },
  amber: { bg: "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300", dot: "bg-amber-500", icon: Package },
  orange: { bg: "bg-orange-500/10 border-orange-500/30 text-orange-800 dark:text-orange-300", dot: "bg-orange-500", icon: Play },
  purple: { bg: "bg-purple-500/10 border-purple-500/30 text-purple-800 dark:text-purple-300", dot: "bg-purple-500", icon: Pause },
  emerald: { bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500", icon: CheckCircle2 },
  slate: { bg: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300", dot: "bg-slate-400", icon: Circle },
};

export default function HistoricoPedidoTelhasSidebar({ open, onClose, pedidoId, pedidoNumero, pedidoObj }) {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState(null);
  const [fotoModal, setFotoModal] = useState(null);

  useEffect(() => {
    if (open) {
      carregarLinhaDoTempo();
    } else {
      setDados(null);
    }
  }, [open, pedidoId, pedidoNumero, pedidoObj]);

  const carregarLinhaDoTempo = async () => {
    setLoading(true);
    try {
      const res = await reconstruirLinhaDoTempoPedido({
        pedidoId,
        numeroPedido: pedidoNumero,
        pedidoObj,
        setor: "telhas",
      });
      setDados(res);
    } catch (e) {
      console.error("[HistoricoSidebar] Erro ao carregar histórico:", e);
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  const timeline = dados?.timeline || [];
  const ped = dados?.pedido || pedidoObj;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
        <SheetHeader className="pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base font-black">
            <History className="w-5 h-5 text-orange-500" />
            Rastreabilidade & Linha do Tempo
          </SheetTitle>
          <SheetDescription className="text-xs">
            {dados?.numeroPedido ? `Pedido #${dados.numeroPedido} — ${dados.cliente}` : "Histórico detalhado do processo"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground font-medium">Reconstruindo rastreabilidade do pedido...</span>
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Nenhum evento registrado ainda.</p>
              <p className="text-xs opacity-75">O pedido aguarda entrada de dados ou programação no PCP.</p>
            </div>
          ) : (
            <>
              {/* Card Resumo do Pedido no Topo */}
              <div className="bg-muted/40 border border-border rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-foreground bg-background px-2 py-0.5 rounded border border-border">
                      #{dados?.numeroPedido}
                    </span>
                    <Badge className={dados?.isFinalizado ? "bg-emerald-600 text-white font-bold" : "bg-orange-500 text-white font-bold"}>
                      {dados?.isFinalizado ? "100% Concluído" : "Em Processo"}
                    </Badge>
                  </div>
                  {ped?.unidade && (
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {ped.unidade}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">Cliente:</span>
                    <span className="font-bold text-foreground truncate block">{dados?.cliente || "Cliente Balcão"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Vendedor:</span>
                    <span className="font-bold text-foreground truncate block">{dados?.vendedor || "—"}</span>
                  </div>
                  {ped?.maquina && (
                    <div>
                      <span className="text-muted-foreground block">Máquina:</span>
                      <span className="font-bold text-orange-600 dark:text-orange-400 block">{ped.maquina}</span>
                    </div>
                  )}
                  {ped?.metros && (
                    <div>
                      <span className="text-muted-foreground block">Metragem Total:</span>
                      <span className="font-bold text-foreground block">{ped.metros} metros</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Linha do Tempo Visual */}
              <div className="space-y-3 pt-1 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border">
                {timeline.map((item, idx) => {
                  const cfg = COR_CONFIG[item.cor] || COR_CONFIG.slate;
                  const Icon = cfg.icon;

                  return (
                    <div key={item.id || idx} className="relative flex items-start gap-3 pl-1">
                      {/* Ponto / Ícone na Linha */}
                      <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border shadow-2xs ${cfg.bg}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>

                      {/* Conteúdo do Card do Evento */}
                      <div className="flex-1 bg-card border border-border rounded-xl p-3 shadow-2xs space-y-1.5">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-bold text-xs text-foreground">{item.titulo}</p>
                            {item.subtitulo && (
                              <p className="text-[11px] text-muted-foreground font-medium">{item.subtitulo}</p>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap bg-muted px-1.5 py-0.5 rounded">
                            {item.dataFmt}
                          </span>
                        </div>

                        {item.usuario && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{item.usuario}</span>
                          </div>
                        )}

                        {item.detalhes && item.detalhes.length > 0 && (
                          <div className="bg-muted/30 rounded-lg p-2 space-y-0.5 text-[11px] text-foreground/90 border border-border/50">
                            {item.detalhes.map((det, dIdx) => (
                              <p key={dIdx} className="leading-tight">• {det}</p>
                            ))}
                          </div>
                        )}

                        {/* Fotos do Evento (ex: Balança, Peça) */}
                        {item.fotos && item.fotos.length > 0 && (
                          <div className="pt-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                              Comprovante / Foto da Balança:
                            </span>
                            <div className="flex gap-2 flex-wrap">
                              {item.fotos.map((url, fIdx) => (
                                <button
                                  key={fIdx}
                                  type="button"
                                  onClick={() => setFotoModal(url)}
                                  className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-orange-500 transition-all cursor-pointer relative group"
                                >
                                  <SmartImage src={url} alt={`Foto ${fIdx + 1}`} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px]">
                                    <Camera className="w-4 h-4" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>

      {/* Modal de Foto Ampliada */}
      {fotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setFotoModal(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <SmartImage src={fotoModal} alt="Foto Ampliada" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            <p className="text-center text-white text-xs mt-2 opacity-80">Clique em qualquer lugar para fechar</p>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function HistoricoPedidoTelhasButton({ pedido, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${className}`}
      >
        <History className="w-3.5 h-3.5" />
        Histórico
      </button>
      <HistoricoPedidoTelhasSidebar
        open={open}
        onClose={() => setOpen(false)}
        pedidoId={pedido?.id}
        pedidoNumero={pedido?.numero_pedido}
        pedidoObj={pedido}
      />
    </>
  );
}